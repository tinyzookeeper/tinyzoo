import { and, gte, inArray, lte } from 'drizzle-orm'
import type { ScopeTraffic, ScopeTrafficPage, ScopeTrafficSite, TrafficItem, TrafficTotals } from '#keeper/types/traffic'
import type { SiteRow } from './sites'

/**
 * The visits of many sites at once: a workspace, a team, or every workspace someone works in.
 * Days come from the totals Keeper keeps (traffic.ts); today comes live from the sites (live.ts).
 * Visitors add up per site: a visitor id lasts a day on one site, so one person on two sites
 * counts twice, as two sites' own numbers would.
 */

export type TrafficPeriod = ScopeTraffic['period']
export const isTrafficPeriod = (v: unknown): v is TrafficPeriod => v === 'today' || v === '7' || v === '30' || v === '90'

type Row = Pick<SiteRow, 'id' | 'name' | 'url' | 'status' | 'tokenEnc' | 'trafficThrough' | 'trafficCheckedAt' | 'trafficError' | 'trafficDrop'> & {
  workspace: { slug: string; name: string }
  team: { slug: string; name: string }
}

const zero = (): TrafficTotals => ({ visitors: 0, visits: 0, pageviews: 0, bounces: 0, engagedMs: 0 })
function add(acc: TrafficTotals, r: TrafficTotals): TrafficTotals {
  acc.visitors += r.visitors
  acc.visits += r.visits
  acc.pageviews += r.pageviews
  acc.bounces += r.bounces
  acc.engagedMs += Number(r.engagedMs)
  return acc
}
const minIso = (list: (string | null | undefined)[]) => list.filter((x): x is string => !!x).sort()[0] ?? null

/** The pages of every site, each with its site, the most visitors first. */
function pagesOf(perSite: { site: Row; pages: TrafficItem[] }[], limit = 10): ScopeTrafficPage[] {
  return perSite.flatMap(({ site, pages }) => pages.map((p) => ({ ...p, site: { id: site.id, name: site.name } })))
    .sort((a, b) => b.visitors - a.visitors || b.pageviews - a.pageviews || a.site.name.localeCompare(b.site.name))
    .slice(0, limit)
}

function siteLine(s: Row, extra: Partial<ScopeTrafficSite> = {}): ScopeTrafficSite {
  return {
    id: s.id,
    name: s.name,
    url: s.url,
    workspace: { slug: s.workspace.slug, name: s.workspace.name },
    team: { slug: s.team.slug, name: s.team.name },
    available: hasAnalytics(s.status),
    error: null,
    totals: zero(),
    previous: zero(),
    spark: [],
    ...(s.trafficDrop ? { drop: s.trafficDrop } : {}),
    ...extra,
  }
}

/** Today on every site, live: hours added up, yesterday up to the same time to compare. */
async function todayOf(rows: Row[]): Promise<ScopeTraffic> {
  const live = await sitesLive(rows)
  const answered = rows.filter((s) => live.get(s.id)?.at)
  const lastHour = Math.max(-1, ...answered.map((s) => live.get(s.id)!.hour ?? -1))
  const hours = Array.from({ length: lastHour + 1 }, (_, h) => ({ visitors: 0, pageviews: 0, h }))
  const sites = rows.map((s) => {
    const l = live.get(s.id)!
    const spark = Array.from({ length: lastHour + 1 }, (_, h) => l.hours.find((x) => x.hour === h)?.visitors ?? 0)
    for (const x of l.hours) {
      const slot = hours[x.hour]
      if (!slot) continue
      slot.visitors += x.visitors
      slot.pageviews += x.pageviews
    }
    return siteLine(s, { available: l.available, error: l.error, ...(l.update ? { update: true } : {}), totals: l.totals, previous: l.yesterdaySoFar, spark, ...(l.at ? { active: l.active } : {}) })
  })
  const lists = (key: 'sources' | 'countries' | 'devices') => topOf(answered.map((s) => live.get(s.id)![key]))
  const day = answered.map((s) => live.get(s.id)!.day).filter((d): d is string => !!d).sort().at(-1) ?? utcToday()
  return {
    period: 'today',
    through: day,
    at: minIso(answered.map((s) => live.get(s.id)!.at)),
    active: sites.reduce((n, s) => n + (s.active ?? 0), 0),
    series: hours.map((x) => ({ day: `${day}T${String(x.h).padStart(2, '0')}`, visitors: x.visitors, pageviews: x.pageviews })),
    hourly: true,
    totals: sites.reduce((acc, s) => add(acc, s.totals), zero()),
    previous: sites.reduce((acc, s) => add(acc, s.previous), zero()),
    today: null,
    sites,
    pages: pagesOf(answered.map((s) => ({ site: s, pages: live.get(s.id)!.pages }))),
    sources: lists('sources'),
    countries: lists('countries'),
    devices: lists('devices'),
  }
}

/** The last `days` complete days of every site from the stored totals, against the days before. */
async function daysOf(rows: Row[], days: number, period: TrafficPeriod): Promise<ScopeTraffic> {
  const through = rows.map((s) => s.trafficThrough).filter((d): d is string => !!d).sort().at(-1) ?? null
  const counting = rows.filter((s) => hasAnalytics(s.status))
  // Today live, for the chart's last point and who is on the sites now: only sites that count.
  const live = await sitesLive(counting)
  const answered = counting.map((s) => live.get(s.id)!).filter((l) => l.at)
  const today = answered.length
    ? {
        day: answered.map((l) => l.day!).filter(Boolean).sort().at(-1) ?? utcToday(),
        visitors: answered.reduce((n, l) => n + l.totals.visitors, 0),
        pageviews: answered.reduce((n, l) => n + l.totals.pageviews, 0),
        active: answered.reduce((n, l) => n + l.active, 0),
      }
    : null
  const empty: ScopeTraffic = {
    period, through, at: null, active: today?.active ?? null, series: [], hourly: false, totals: zero(), previous: zero(), today,
    sites: rows.map((s) => siteLine(s, { error: s.trafficError, active: live.get(s.id)?.at ? live.get(s.id)!.active : undefined })),
    pages: [], sources: [], countries: [], devices: [],
  }
  if (!through || !counting.length) return empty
  const from = addDays(through, -(days - 1))
  const before = addDays(from, -days)
  const t = schema.siteTraffic
  const found = await useDb().select().from(t)
    .where(and(inArray(t.siteId, counting.map((s) => s.id)), gte(t.day, before), lte(t.day, through)))
  const bySite = new Map<string, typeof found>()
  for (const r of found) {
    const list = bySite.get(r.siteId) ?? []
    list.push(r)
    bySite.set(r.siteId, list)
  }
  const span = eachDay(from, through)
  const series = new Map(span.map((d) => [d, { day: d, visitors: 0, pageviews: 0 }]))
  const perSite = rows.map((s) => {
    const own = bySite.get(s.id) ?? []
    const now = own.filter((r) => r.day >= from)
    const byDay = new Map(now.map((r) => [r.day, r]))
    for (const r of now) {
      const p = series.get(r.day)
      if (p) {
        p.visitors += r.visitors
        p.pageviews += r.pageviews
      }
    }
    const l = live.get(s.id)
    return {
      site: s,
      now,
      line: siteLine(s, {
        error: s.trafficError,
        totals: now.reduce((acc, r) => add(acc, r), zero()),
        previous: own.filter((r) => r.day < from).reduce((acc, r) => add(acc, r), zero()),
        spark: span.map((d) => byDay.get(d)?.visitors ?? 0),
        ...(l?.at ? { active: l.active } : {}),
      }),
    }
  })
  const sites = perSite.map((p) => p.line)
  const lists = (key: 'sources' | 'countries' | 'devices') => topOf(perSite.flatMap((p) => p.now.map((r) => r[key])))
  return {
    ...empty,
    at: minIso(counting.map((s) => s.trafficCheckedAt?.toISOString())),
    series: [...series.values()],
    totals: sites.reduce((acc, s) => add(acc, s.totals), zero()),
    previous: sites.reduce((acc, s) => add(acc, s.previous), zero()),
    sites,
    pages: pagesOf(perSite.map((p) => ({ site: p.site, pages: topOf(p.now.map((r) => r.pages)) }))),
    sources: lists('sources'),
    countries: lists('countries'),
    devices: lists('devices'),
  }
}

/** The visits of these sites over `period`. */
export function scopeTraffic(rows: Row[], period: TrafficPeriod): Promise<ScopeTraffic> {
  return period === 'today' ? todayOf(rows) : daysOf(rows, Number(period), period)
}
