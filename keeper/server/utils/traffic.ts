import { and, asc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm'
import type { CmsStatus } from '#keeper/types/status'
import type { AnalyticsRollups, TrafficDrop, TrafficGlance, TrafficItem, TrafficReport, TrafficTotals } from '#keeper/types/traffic'

/**
 * Visits. A site with tinyzoo's analytics plugin shares its daily totals with Keeper
 * (GET /api/content/_analytics/rollups, read with the status token). Keeper asks about once an
 * hour: 90 days the first time, then from 2 days before the last complete day it has (a day's
 * totals are made in the night after it, so yesterday's become final), and keeps them per day.
 *
 * A drop: the last 7 complete days had fewer than 40 % of the visitors a day of the 4 weeks
 * before, on a site with at least 20 visitors a day in those 4 weeks. The team hears once, and
 * once more when visits are back to 60 % of that level. After 4 weeks the lower level counts as
 * the new usual one, without an e-mail.
 */

type Site = typeof schema.sites.$inferSelect

export const TRAFFIC_EVERY_MS = 60 * 60_000
export const TRAFFIC_FIRST_DAYS = 90
export const TRAFFIC_REFETCH_DAYS = 3
export const TRAFFIC_KEEP_DAYS = 400
const DROP_SHARE = 0.4
const BACK_SHARE = 0.6
const DROP_MIN_BASELINE = 20
const DROP_GIVE_UP_DAYS = 28
const DEFAULT_PATH = '/api/content/_analytics/rollups'

// ── days as YYYY-MM-DD ──────────────────────────────────────────────────────────

const DAY_MS = 86_400_000
export const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
export const utcToday = (): string => new Date().toISOString().slice(0, 10)
export function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

// ── reading a site ──────────────────────────────────────────────────────────────

/** Whether the site's last status says it counts visits. */
export const hasAnalytics = (status: CmsStatus | null | undefined): boolean => !!status?.plugins?.some((p) => p.name === 'analytics')

/** Whether it is time to ask the site for its visits again. */
export function trafficDue(site: Pick<Site, 'trafficCheckedAt'>, now = Date.now()): boolean {
  return !site.trafficCheckedAt || now - site.trafficCheckedAt.getTime() >= TRAFFIC_EVERY_MS - 30_000
}

/** The days to ask for: 90 days the first time, then from 2 days before the last complete one. */
export function rangeToFetch(through: string | null, today = utcToday()): { from: string; to: string } {
  // `to` a day ahead: the site's day may already be tomorrow in its time zone.
  const to = addDays(today, 1)
  let from = through ? addDays(through, -(TRAFFIC_REFETCH_DAYS - 1)) : addDays(today, -TRAFFIC_FIRST_DAYS)
  const oldest = addDays(to, -(TRAFFIC_KEEP_DAYS - 1))
  if (from < oldest) from = oldest
  return { from, to }
}

async function fetchRollups(url: string, path: string, token: string, range: { from: string; to: string }): Promise<{ rollups: AnalyticsRollups } | { error: string }> {
  const target = new URL(path, url)
  target.searchParams.set('from', range.from)
  target.searchParams.set('to', range.to)
  let res: Response
  try {
    res = await fetch(target, {
      headers: { 'accept': 'application/json', 'user-agent': 'tinyzoo-keeper (+traffic)', 'x-api-key': token },
      signal: AbortSignal.timeout(20_000),
      redirect: 'follow',
    })
  }
  catch (err: any) {
    return { error: err?.name === 'TimeoutError' ? 'The site took too long to answer.' : 'The site could not be reached.' }
  }
  if (res.status === 404) return { error: 'This site’s tinyzoo does not share its visits yet. They show here after an update.' }
  if (res.status === 401) return { error: 'The site did not accept the status token for its visits.' }
  if (res.status === 429) return { error: 'The site asked Keeper to slow down; it tries again within the hour.' }
  if (!res.ok) return { error: `The site answered HTTP ${res.status}.` }
  const body = await res.json().catch(() => null) as AnalyticsRollups | null
  if (!body || body.format !== 'tinyzoo-analytics-rollups' || !Array.isArray(body.days)) return { error: 'The site’s answer is not a list of visits Keeper knows.' }
  if (body.version !== 1) return { error: 'The site shares its visits in a newer format; update Keeper.' }
  return { rollups: body }
}

const num = (v: unknown): number => Math.max(0, Math.round(Number(v) || 0))
const items = (list: unknown): TrafficItem[] => (Array.isArray(list) ? list : []).slice(0, 10).map((i: any) => ({
  value: String(i?.value ?? '').slice(0, 500),
  ...(i?.title ? { title: String(i.title).slice(0, 300) } : {}),
  visitors: num(i?.visitors),
  visits: num(i?.visits),
  pageviews: num(i?.pageviews),
}))
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/**
 * Read a site's visits when it is due (or `force`): only for a site whose status lists the
 * analytics plugin. Stores the days, then looks for a drop. Never throws.
 */
export async function checkTraffic(siteId: string, token: string | null, opts: { force?: boolean } = {}): Promise<void> {
  const db = useDb()
  const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, siteId))
  if (!site) return
  if (!token || !hasAnalytics(site.status)) {
    // Nothing to read (any more): no error to show, what was read stays.
    if (site.trafficError) await db.update(schema.sites).set({ trafficError: null }).where(eq(schema.sites.id, siteId))
    return
  }
  if (!opts.force && !trafficDue(site)) return
  const now = new Date()
  const range = rangeToFetch(site.trafficThrough)
  const r = await fetchRollups(site.url, site.status?.analytics?.rollupsPath || DEFAULT_PATH, token, range)
  if ('error' in r) {
    await db.update(schema.sites).set({ trafficCheckedAt: now, trafficError: r.error }).where(eq(schema.sites.id, siteId))
    return
  }
  const days = r.rollups.days.filter((d) => isDay(d?.day))
  for (let i = 0; i < days.length; i += 200) {
    const rows = days.slice(i, i + 200).map((d) => ({
      siteId,
      day: d.day,
      visitors: num(d.visitors),
      visits: num(d.visits),
      pageviews: num(d.pageviews),
      bounces: num(d.bounces),
      engagedMs: num(d.engagedMs),
      pages: items(d.pages),
      sources: items(d.sources),
      countries: items(d.countries),
      devices: items(d.devices),
      fetchedAt: now,
    }))
    await db.insert(schema.siteTraffic).values(rows).onConflictDoUpdate({
      target: [schema.siteTraffic.siteId, schema.siteTraffic.day],
      set: {
        visitors: sql`excluded.visitors`, visits: sql`excluded.visits`, pageviews: sql`excluded.pageviews`,
        bounces: sql`excluded.bounces`, engagedMs: sql`excluded.engaged_ms`, pages: sql`excluded.pages`,
        sources: sql`excluded.sources`, countries: sql`excluded.countries`, devices: sql`excluded.devices`,
        fetchedAt: sql`excluded.fetched_at`,
      },
    })
  }
  const read = {
    trafficCheckedAt: now,
    trafficError: null,
    trafficSince: isDay(r.rollups.since) ? r.rollups.since : site.trafficSince,
    trafficThrough: isDay(r.rollups.through) ? r.rollups.through : site.trafficThrough,
  }
  await db.update(schema.sites).set(read).where(eq(schema.sites.id, siteId))
  if (read.trafficThrough) await checkDrop({ ...site, ...read })
}

// ── a drop ──────────────────────────────────────────────────────────────────────

export interface DropReading {
  /** Visitors a day over the last 7 complete days, and over the 28 days before. */
  perDay: number
  baselinePerDay: number
  /** perDay against baselinePerDay (0.3 = 30 %), or null without a baseline. */
  share: number | null
}

/** The last 7 days to `through` against the 28 before, from visitors per day (missing days are 0). */
export function readDrop(visitors: ReadonlyMap<string, number>, through: string): DropReading {
  const sum = (from: string, to: string) => eachDay(from, to).reduce((acc, d) => acc + (visitors.get(d) ?? 0), 0)
  const recent = sum(addDays(through, -6), through)
  const before = sum(addDays(through, -34), addDays(through, -7))
  const perDay = recent / 7
  const baselinePerDay = before / 28
  return { perDay, baselinePerDay, share: baselinePerDay > 0 ? perDay / baselinePerDay : null }
}

/** What to do about a drop: tell the team it started, that it is over, quietly let it go, or nothing. */
export function dropDecision(reading: DropReading, current: TrafficDrop | null, through: string, enoughHistory: boolean): 'drop' | 'back' | 'forget' | null {
  if (!current) {
    if (!enoughHistory || reading.baselinePerDay < DROP_MIN_BASELINE || reading.share == null) return null
    return reading.share < DROP_SHARE ? 'drop' : null
  }
  if (reading.perDay >= current.baselinePerDay * BACK_SHARE) return 'back'
  if (addDays(current.day, DROP_GIVE_UP_DAYS) <= through) return 'forget'
  return null
}

const round = (n: number) => Math.round(n)

async function checkDrop(site: Site): Promise<void> {
  const through = site.trafficThrough!
  const db = useDb()
  const rows = await db.select({ day: schema.siteTraffic.day, visitors: schema.siteTraffic.visitors }).from(schema.siteTraffic)
    .where(and(eq(schema.siteTraffic.siteId, site.id), gte(schema.siteTraffic.day, addDays(through, -34)), lte(schema.siteTraffic.day, through)))
  const reading = readDrop(new Map(rows.map((r) => [r.day, r.visitors])), through)
  // The 4 weeks before must all be counted days, or a new site would look like it grew.
  const enoughHistory = !!site.trafficSince && site.trafficSince <= addDays(through, -34)
  const decision = dropDecision(reading, site.trafficDrop, through, enoughHistory)
  if (!decision) return
  const perDay = round(reading.perDay)
  if (decision === 'drop') {
    const baseline = round(reading.baselinePerDay)
    // From the rounded numbers, as the site list shows it.
    const fell = baseline ? round((1 - perDay / baseline) * 100) : 0
    const drop: TrafficDrop = { day: through, perDay, baselinePerDay: baseline, alertedAt: new Date().toISOString() }
    await db.update(schema.sites).set({ trafficDrop: drop }).where(eq(schema.sites.id, site.id))
    await alertTeam(site, 'traffic', `${site.name}: visitors down by ${fell} %`, [
      `${site.name} (${site.url}) had ${perDay} visitors a day over the last 7 days, against ${baseline} a day in the 4 weeks before.`,
      '',
      'A drop like this often has a plain cause:',
      '- a deploy that broke pages, or left the tracker out of them;',
      '- counting switched off in the site’s admin, or NUXT_CMS_ANALYTICS_ENABLED=false on the server;',
      '- the site lost its place in search (a robots.txt or noindex that slipped through, a changed address without a redirect).',
      '',
      'Open a few pages of the site, then look at its sources in Keeper: a fall in Google alone points at search.',
    ].join('\n'))
  }
  else if (decision === 'back') {
    await db.update(schema.sites).set({ trafficDrop: null }).where(eq(schema.sites.id, site.id))
    const was = site.trafficDrop!
    await alertTeam(site, 'traffic-back', `${site.name}: visitors are back`, `${site.name} (${site.url}) is back to ${perDay} visitors a day over the last 7 days. Before the drop Keeper wrote about, it had ${was.baselinePerDay} a day.`)
  }
  else {
    await db.update(schema.sites).set({ trafficDrop: null }).where(eq(schema.sites.id, site.id))
  }
}

// ── what the pages and the MCP server show ──────────────────────────────────────

const emptyTotals = (): TrafficTotals => ({ visitors: 0, visits: 0, pageviews: 0, bounces: 0, engagedMs: 0 })

/** The site list's glance at visits, per site that has any. */
export async function trafficGlances(sites: Pick<Site, 'id' | 'trafficThrough' | 'trafficDrop'>[]): Promise<Map<string, TrafficGlance>> {
  const out = new Map<string, TrafficGlance>()
  const counted = sites.filter((s) => s.trafficThrough)
  if (!counted.length) return out
  const oldest = counted.map((s) => addDays(s.trafficThrough!, -29)).sort()[0]!
  const rows = await useDb().select({ siteId: schema.siteTraffic.siteId, day: schema.siteTraffic.day, visitors: schema.siteTraffic.visitors })
    .from(schema.siteTraffic)
    .where(and(inArray(schema.siteTraffic.siteId, counted.map((s) => s.id)), gte(schema.siteTraffic.day, oldest)))
  const bySite = new Map<string, Map<string, number>>()
  for (const r of rows) {
    let m = bySite.get(r.siteId)
    if (!m) bySite.set(r.siteId, m = new Map())
    m.set(r.day, r.visitors)
  }
  for (const s of counted) {
    const m = bySite.get(s.id) ?? new Map<string, number>()
    const spark = eachDay(addDays(s.trafficThrough!, -29), s.trafficThrough!).map((d) => m.get(d) ?? 0)
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
    out.set(s.id, { spark, through: s.trafficThrough!, week: sum(spark.slice(-7)), previousWeek: sum(spark.slice(-14, -7)), drop: s.trafficDrop ?? null })
  }
  return out
}

/** Add up the top lists of several days: per value, its visitors, visits and pageviews, the most first. */
function topOf(lists: TrafficItem[][], limit = 10): TrafficItem[] {
  const by = new Map<string, TrafficItem>()
  for (const list of lists) {
    for (const i of list) {
      const acc = by.get(i.value) ?? { value: i.value, visitors: 0, visits: 0, pageviews: 0 }
      acc.visitors += i.visitors
      acc.visits += i.visits
      acc.pageviews += i.pageviews
      if (i.title) acc.title = i.title
      by.set(i.value, acc)
    }
  }
  return [...by.values()].sort((a, b) => b.visitors - a.visitors || b.pageviews - a.pageviews || a.value.localeCompare(b.value)).slice(0, limit)
}

/** A site's visits over the last `days` complete days, against the same number before. */
export async function trafficReport(site: Site, days: number): Promise<TrafficReport> {
  const through = site.trafficThrough
  const base: TrafficReport = {
    days,
    available: hasAnalytics(site.status),
    error: site.trafficError,
    checkedAt: site.trafficCheckedAt?.toISOString() ?? null,
    since: site.trafficSince,
    through,
    series: [],
    totals: emptyTotals(),
    previous: emptyTotals(),
    pages: [],
    sources: [],
    countries: [],
    devices: [],
    drop: site.trafficDrop ?? null,
  }
  if (!through) return base
  const from = addDays(through, -(days - 1))
  const before = addDays(from, -days)
  const t = schema.siteTraffic
  const rows = await useDb().select().from(t)
    .where(and(eq(t.siteId, site.id), gte(t.day, before), lte(t.day, through)))
    .orderBy(asc(t.day))
  const now = rows.filter((r) => r.day >= from)
  const add = (acc: TrafficTotals, r: TrafficTotals) => {
    acc.visitors += r.visitors
    acc.visits += r.visits
    acc.pageviews += r.pageviews
    acc.bounces += r.bounces
    acc.engagedMs += Number(r.engagedMs)
    return acc
  }
  const byDay = new Map(now.map((r) => [r.day, r]))
  return {
    ...base,
    series: eachDay(from, through).map((day) => ({ day, visitors: byDay.get(day)?.visitors ?? 0, pageviews: byDay.get(day)?.pageviews ?? 0 })),
    totals: now.reduce(add, emptyTotals()),
    previous: rows.filter((r) => r.day < from).reduce(add, emptyTotals()),
    pages: topOf(now.map((r) => r.pages)),
    sources: topOf(now.map((r) => r.sources)),
    countries: topOf(now.map((r) => r.countries)),
    devices: topOf(now.map((r) => r.devices)),
  }
}

/** Days of visits older than Keeper keeps (400). */
export async function pruneTraffic(): Promise<void> {
  await useDb().delete(schema.siteTraffic).where(lt(schema.siteTraffic.day, addDays(utcToday(), -TRAFFIC_KEEP_DAYS)))
}
