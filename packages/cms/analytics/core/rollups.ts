import type { AnalyticsRollupDay, AnalyticsRollupItem } from '../format'
import { MAX_ROLLUP_DAYS } from '../format'
import { daysBetween, eachDay, isDay } from './range'

/**
 * The pure part of `GET /api/content/_analytics/rollups` (server/rollups.get.ts): the range a
 * request asks for, and the answer's days from `analytics_daily` rows. No `import`s of anything
 * server-side, so the unit tests read it as it is.
 */

/** The dimensions the answer carries, and the key of each list in a day. */
export const ROLLUP_LISTS = { page: 'pages', source: 'sources', country: 'countries', device: 'devices' } as const
export type RollupListDimension = keyof typeof ROLLUP_LISTS

/** `from` and `to` of a request, or why they are no range (for a 400). */
export function parseRollupsRange(from: unknown, to: unknown): { from: string; to: string } | { error: string } {
  if (!isDay(from) || !isDay(to)) return { error: 'from and to are days (YYYY-MM-DD)' }
  if (from > to) return { error: 'from is after to' }
  if (daysBetween(from, to) > MAX_ROLLUP_DAYS) return { error: `at most ${MAX_ROLLUP_DAYS} days at once` }
  return { from, to }
}

/** The days of the answer: those of `from`…`to` that are between `since` and `through`. */
export function answerDays(from: string, to: string, since: string | null, through: string | null): string[] {
  if (!since || !through) return []
  const start = from > since ? from : since
  const end = to < through ? to : through
  return start <= end ? eachDay(start, end) : []
}

/** One row of `analytics_daily`, as the route reads it (top lists already cut to their first few). */
export interface RollupRowIn {
  day: string
  dimension: string
  value: string
  visitors: number
  visits: number
  pageviews: number
  bounces: number
  engagedMs: number
}

/**
 * Every day of `days`, with its totals (zeros when the day had no visit) and its lists in the
 * order of the rows (most visitors first). `titles` names the entries at some addresses.
 */
export function rollupDaysOf(days: readonly string[], rows: readonly RollupRowIn[], titles: ReadonlyMap<string, string> = new Map()): AnalyticsRollupDay[] {
  const byDay = new Map<string, AnalyticsRollupDay>()
  for (const day of days) {
    byDay.set(day, { day, visitors: 0, visits: 0, pageviews: 0, bounces: 0, engagedMs: 0, pages: [], sources: [], countries: [], devices: [] })
  }
  for (const r of rows) {
    const d = byDay.get(r.day)
    if (!d) continue
    if (r.dimension === 'total') {
      Object.assign(d, { visitors: n(r.visitors), visits: n(r.visits), pageviews: n(r.pageviews), bounces: n(r.bounces), engagedMs: n(r.engagedMs) })
      continue
    }
    const key = ROLLUP_LISTS[r.dimension as RollupListDimension]
    if (!key) continue
    const item: AnalyticsRollupItem = { value: r.value, visitors: n(r.visitors), visits: n(r.visits), pageviews: n(r.pageviews) }
    const title = r.dimension === 'page' ? titles.get(r.value) : undefined
    if (title) item.title = title
    d[key].push(item)
  }
  return days.map((day) => byDay.get(day)!)
}

const n = (v: unknown): number => Number(v) || 0

// ── today's visits (GET /api/content/_analytics/live) ───────────────────────────

/** An item of a list as the admin's queries give it (with `entity`/`id` the answer leaves out). */
export interface LiveListIn { value: string; title?: string; visitors: number; visits: number; pageviews: number }

/** The first `top` items of a list, in the shape of the rollups' lists (`title` only when there is one). */
export function liveListOf(items: readonly LiveListIn[], top: number): AnalyticsRollupItem[] {
  return items.slice(0, top).map((i) => {
    const item: AnalyticsRollupItem = { value: String(i.value), visitors: n(i.visitors), visits: n(i.visits), pageviews: n(i.pageviews) }
    if (i.title) item.title = i.title
    return item
  })
}

/** Hours 0…`hour` from the hourly points (keyed '0'…'23'), every hour there, empty ones as 0. */
export function liveHoursOf(points: readonly { key: string; visitors: number; pageviews: number }[], hour: number): { hour: number; visitors: number; pageviews: number }[] {
  const by = new Map(points.map((p) => [Number(p.key), p]))
  const last = Math.max(0, Math.min(23, Math.floor(hour)))
  return Array.from({ length: last + 1 }, (_, h) => ({ hour: h, visitors: n(by.get(h)?.visitors), pageviews: n(by.get(h)?.pageviews) }))
}
