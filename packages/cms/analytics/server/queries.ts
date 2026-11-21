import { and, eq, gte, inArray, isNotNull, lt, sql, type SQL } from 'drizzle-orm'
import type { Dimension, Filter } from '../core/dimensions'
import { addDays, type DayRange, seriesKeys, splitByCutoff } from '../core/range'
import { addTotals, emptyTotals, type Totals } from '../core/rollup'
import { dayStart } from '../rollup'
import { analyticsDaily, analyticsEvents } from '../tables'
import { entryAt } from './context'

/**
 * The reports' numbers for a range of days: recent days from the raw views (filters apply),
 * days older than `keepRawDays` from the daily totals (no filters: the totals are one
 * dimension at a time). Both are added up: the visitor id changes every day, so visitors of
 * different days add up exactly as a count over the raw views does.
 */

const e = analyticsEvents
const d = analyticsDaily

export interface Window {
  range: DayRange
  tz: string
  /** The first day that still has raw views (today minus keepRawDays). */
  firstRawDay: string
  filters: readonly Filter[]
}

export interface Plan {
  raw: DayRange | null
  /** Null too when filters are set: totals cannot be filtered (`partial`). */
  rolled: DayRange | null
  /** Filters left days out (they had totals only). */
  partial: boolean
}

export function planOf(w: Window): Plan {
  const split = splitByCutoff(w.range, w.firstRawDay)
  const partial = !!split.rolled && w.filters.length > 0
  return { raw: split.raw, rolled: partial ? null : split.rolled, partial }
}

const COLUMN: Record<Dimension, any> = {
  page: e.path, entry_page: e.path, entry: e.entity, source: e.source, referrer: e.referrerHost,
  utm_source: e.utmSource, utm_medium: e.utmMedium, utm_campaign: e.utmCampaign, country: e.country,
  device: e.device, browser: e.browser, os: e.os, language: e.language, locale: e.locale,
}

function filterCond(f: Filter): SQL | undefined {
  if (f.dimension === 'entry') {
    const at = f.value.indexOf(':')
    return at > 0 ? and(eq(e.entity, f.value.slice(0, at)), eq(e.entryId, f.value.slice(at + 1))) : sql`false`
  }
  if (f.dimension === 'entry_page') return and(eq(e.isEntry, true), eq(e.path, f.value))
  return eq(COLUMN[f.dimension], f.value)
}

const span = (r: DayRange, tz: string): SQL => and(gte(e.at, dayStart(r.from, tz)), lt(e.at, dayStart(addDays(r.to, 1), tz)))!
export const rawWhere = (r: DayRange, w: Window): SQL => and(span(r, w.tz), ...w.filters.map(filterCond))!
const rolledWhere = (r: DayRange, dimension: string): SQL => and(eq(d.dimension, dimension), gte(d.day, r.from), lt(d.day, addDays(r.to, 1)))!

/** Visitors, visits, pageviews, bounces and time of the range. */
export async function totalsOf(db: any, w: Window): Promise<Totals> {
  const plan = planOf(w)
  let t = emptyTotals()
  // A bounce: a visit of one view in all (not one view among those the filters keep).
  if (plan.raw) t = addTotals(t, await rawTotals(db, rawWhere(plan.raw, w), span(plan.raw, w.tz)))
  if (plan.rolled) {
    const [row]: any[] = await db.select({
      visitors: sql<number>`coalesce(sum(${d.visitors}), 0)::int`,
      visits: sql<number>`coalesce(sum(${d.visits}), 0)::int`,
      pageviews: sql<number>`coalesce(sum(${d.pageviews}), 0)::int`,
      bounces: sql<number>`coalesce(sum(${d.bounces}), 0)::int`,
      engagedMs: sql<number>`coalesce(sum(${d.engagedMs}), 0)::bigint`,
    }).from(d).where(rolledWhere(plan.rolled, 'total'))
    t = addTotals(t, row ?? {})
  }
  return t
}

/** The totals of the raw views matching `where`; a bounce is a visit with one view within `all`. */
async function rawTotals(db: any, where: SQL, all: SQL): Promise<Partial<Totals>> {
  const singles = sql`select ${e.session} from ${e} where ${all} group by ${e.session} having count(*) = 1`
  const [row]: any[] = await db.select({
    visitors: sql<number>`count(distinct ${e.visitor})::int`,
    visits: sql<number>`count(distinct ${e.session})::int`,
    pageviews: sql<number>`count(*)::int`,
    engagedMs: sql<number>`coalesce(sum(${e.engagedMs}), 0)::bigint`,
    bounces: sql<number>`count(distinct ${e.session}) filter (where ${e.session} in (${singles}))::int`,
  }).from(e).where(where)
  return row ?? {}
}

/**
 * Yesterday from its midnight to the same time of day as now (now minus 24 hours), to compare
 * today with. From the raw views only (yesterday always has them).
 */
export async function yesterdaySoFar(db: any, today: string, tz: string): Promise<Totals> {
  const yesterday = addDays(today, -1)
  const where = and(gte(e.at, dayStart(yesterday, tz)), lt(e.at, dayStart(today, tz)), lt(e.at, sql`now() - interval '1 day'`))!
  return addTotals(emptyTotals(), await rawTotals(db, where, where))
}

export interface Point { key: string; visitors: number; pageviews: number }

/** Visitors and pageviews per hour (one day) or per day, every point there, empty ones as 0. */
export async function seriesOf(db: any, w: Window, bucket: 'hour' | 'day', untilHour?: number): Promise<Point[]> {
  const plan = planOf(w)
  const byKey = new Map<string, Point>()
  const add = (key: string, visitors: number, pageviews: number) => {
    const p = byKey.get(key) ?? { key, visitors: 0, pageviews: 0 }
    p.visitors += Number(visitors) || 0
    p.pageviews += Number(pageviews) || 0
    byKey.set(key, p)
  }
  if (plan.raw) {
    const local = sql`(${e.at} at time zone ${w.tz})`
    const key = bucket === 'hour' ? sql<string>`extract(hour from ${local})::int::text` : sql<string>`(${local})::date::text`
    const rows: any[] = await db.select({ key, visitors: sql<number>`count(distinct ${e.visitor})::int`, pageviews: sql<number>`count(*)::int` })
      .from(e).where(rawWhere(plan.raw, w)).groupBy(sql`1`)
    for (const r of rows) add(String(r.key), r.visitors, r.pageviews)
  }
  if (plan.rolled && bucket === 'day') {
    const rows: any[] = await db.select({ key: sql<string>`${d.day}::text`, visitors: d.visitors, pageviews: d.pageviews })
      .from(d).where(rolledWhere(plan.rolled, 'total'))
    for (const r of rows) add(String(r.key), r.visitors, r.pageviews)
  }
  return seriesKeys({ ...w.range, bucket }, untilHour).map((key) => byKey.get(key) ?? { key, visitors: 0, pageviews: 0 })
}

export interface ListItem {
  value: string
  visitors: number
  visits: number
  pageviews: number
  /** The entry at this address (pages), when tinyzoo knows it. */
  entity?: string
  id?: string
  title?: string
}

const LIST_LIMIT = 100

/** The values of one dimension, most visitors first. */
export async function listOf(db: any, w: Window, dimension: Dimension): Promise<ListItem[]> {
  const plan = planOf(w)
  const byValue = new Map<string, ListItem>()
  const add = (r: any) => {
    const value = String(r.value)
    const item = byValue.get(value) ?? { value, visitors: 0, visits: 0, pageviews: 0 }
    item.visitors += Number(r.visitors) || 0
    item.visits += Number(r.visits) || 0
    item.pageviews += Number(r.pageviews) || 0
    if (r.entity && r.entryId && !item.entity) Object.assign(item, { entity: r.entity, id: r.entryId })
    byValue.set(value, item)
  }
  if (plan.raw) {
    const value = dimension === 'entry' ? sql<string>`${e.entity} || ':' || ${e.entryId}` : COLUMN[dimension]
    const conds = [rawWhere(plan.raw, w), isNotNull(COLUMN[dimension])]
    if (dimension === 'entry_page') conds.push(eq(e.isEntry, true))
    if (dimension === 'entry') conds.push(isNotNull(e.entryId))
    const withEntry = dimension === 'page' || dimension === 'entry_page'
    const rows: any[] = await db.select({
      value,
      visitors: sql<number>`count(distinct ${e.visitor})::int`,
      visits: sql<number>`count(distinct ${e.session})::int`,
      pageviews: sql<number>`count(*)::int`,
      ...(withEntry ? { entity: sql<string | null>`max(${e.entity})`, entryId: sql<string | null>`max(${e.entryId})` } : {}),
    }).from(e).where(and(...conds)).groupBy(sql`1`).orderBy(sql`2 desc`, sql`4 desc`).limit(LIST_LIMIT)
    rows.forEach(add)
  }
  if (plan.rolled) {
    const rows: any[] = await db.select({
      value: d.value,
      visitors: sql<number>`sum(${d.visitors})::int`,
      visits: sql<number>`sum(${d.visits})::int`,
      pageviews: sql<number>`sum(${d.pageviews})::int`,
    }).from(d).where(rolledWhere(plan.rolled, dimension)).groupBy(d.value).orderBy(sql`2 desc`, sql`4 desc`).limit(LIST_LIMIT)
    rows.forEach(add)
  }
  const items = [...byValue.values()].sort((a, b) => b.visitors - a.visitors || b.pageviews - a.pageviews || a.value.localeCompare(b.value)).slice(0, LIST_LIMIT)
  if (dimension === 'page' || dimension === 'entry_page') {
    // An address the totals kept without its entry: the entry at it today.
    for (const item of items) {
      if (item.entity) continue
      const at = await entryAt(item.value).catch(() => null)
      if (at) Object.assign(item, { entity: at.entity, id: at.id })
    }
  }
  if (dimension === 'entry') {
    for (const item of items) {
      const i = item.value.indexOf(':')
      Object.assign(item, { entity: item.value.slice(0, i), id: item.value.slice(i + 1) })
    }
  }
  await addTitles(db, items)
  return items
}

/** The titles of the entries in a list (each collection's `titleField`), for the admin to show instead of the address. */
export async function addTitles(db: any, items: { entity?: string; id?: string; title?: string }[]): Promise<void> {
  const { reg } = useCms()
  const ids = new Map<string, Set<string>>()
  for (const item of items) if (item.entity && item.id) (ids.get(item.entity) ?? ids.set(item.entity, new Set()).get(item.entity)!).add(item.id)
  for (const [name, set] of ids) {
    const ent = reg.byName.get(name)
    const col = ent ? (ent.table as any)[ent.titleField] : null
    if (!ent || !col) continue
    const valid = [...set].filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    if (!valid.length) continue
    const rows: any[] = await db.select({ id: ent.table.id, title: col }).from(ent.table).where(inArray(ent.table.id, valid))
    const titles = new Map(rows.map((r) => [String(r.id), String(r.title ?? '')]))
    for (const item of items) {
      if (item.entity !== name || !item.id) continue
      const title = titles.get(item.id)
      if (title) item.title = title
      else { delete item.entity; delete item.id } // the entry is gone
    }
  }
}

/** Visitors in the last five minutes. */
export async function activeNow(db: any): Promise<number> {
  const [row]: any[] = await db.select({ n: sql<number>`count(distinct ${e.visitor})::int` }).from(e).where(sql`${e.at} > now() - interval '5 minutes'`)
  return Number(row?.n ?? 0)
}
