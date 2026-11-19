import { and, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm'
import type { CmsRetentionContext } from '../src/plugin'
import { rollupDay } from './core/rollup'
import { addDays, eachDay } from './core/range'
import { localDay } from './core/visitor'
import type { ResolvedAnalyticsOptions } from './options'
import { timeZoneOf } from './runtime'
import { analyticsDaily, analyticsEvents } from './tables'

/**
 * The nightly part: daily totals from the raw page views, then the raw views past
 * `keepRawDays` deleted. It runs in tinyzoo's daily retention task (`cms:retention`), in its
 * transaction and under its lock, so the totals of a day are always written before its views
 * go, and only one server does it. Explicit imports only (the CLI loads this file too).
 *
 * The salt of the visitor ids goes as well when its day is over, if no visit replaced it yet.
 */

/** The instant a day starts in `tz`, in SQL. */
export const dayStart = (day: string, tz: string): SQL => sql`((${day}::date)::timestamp at time zone ${tz})`

/** The key of the day's salt in `cms_state`. */
export const SALT_KEY = 'analytics:salt'

const INSERT_CHUNK = 500

/** Write the totals of each day, replacing what the day had: running a day again gives the same rows. */
export async function rollupDays(db: any, days: readonly string[], tz: string): Promise<void> {
  const e = analyticsEvents
  for (const day of days) {
    const views: any[] = await db.select({
      path: e.path, entity: e.entity, entryId: e.entryId, locale: e.locale, visitor: e.visitor, session: e.session,
      isEntry: e.isEntry, referrerHost: e.referrerHost, source: e.source, utmSource: e.utmSource, utmMedium: e.utmMedium,
      utmCampaign: e.utmCampaign, country: e.country, device: e.device, browser: e.browser, os: e.os, language: e.language,
      engagedMs: e.engagedMs,
    }).from(e).where(and(gte(e.at, dayStart(day, tz)), lt(e.at, dayStart(addDays(day, 1), tz))))
    const rows = rollupDay(views)
    await db.delete(analyticsDaily).where(eq(analyticsDaily.day, day))
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      await db.insert(analyticsDaily).values(rows.slice(i, i + INSERT_CHUNK).map((r) => ({ day, ...r })))
    }
  }
}

/**
 * The days to roll up, up to yesterday: from the day before the last one done (a visit read
 * past midnight still adds time to it), or from the first day with views when nothing is done.
 * Never a day before the first day that still has views: its totals were made while it had
 * them, and rolling it again now would replace them with nothing.
 */
export async function pendingRollupDays(db: any, today: string, tz: string): Promise<string[]> {
  const [first]: any[] = await db.select({ at: sql<Date | null>`min(${analyticsEvents.at})` }).from(analyticsEvents)
  if (!first?.at) return []
  const firstDay = localDay(new Date(first.at), tz)
  const [last]: any[] = await db.select({ day: sql<string | null>`max(${analyticsDaily.day})::text` }).from(analyticsDaily).where(eq(analyticsDaily.dimension, 'total'))
  let start = last?.day ? addDays(String(last.day), -1) : firstDay
  if (start < firstDay) start = firstDay
  const end = addDays(today, -1)
  return start <= end ? eachDay(start, end) : []
}

/** The retention hook of the plugin. Returns how many raw page views were deleted. */
export function analyticsRetention(opts: ResolvedAnalyticsOptions) {
  return async ({ tx, reg, batch }: CmsRetentionContext): Promise<Record<string, number>> => {
    const tz = timeZoneOf(opts)
    const today = localDay(new Date(), tz)
    await rollupDays(tx, await pendingRollupDays(tx, today, tz), tz)

    // Raw views of whole days only, so a day is either all there or all in its totals.
    const cutoff = dayStart(addDays(today, -opts.keepRawDays), tz)
    let deleted = 0
    for (;;) {
      const res: any = await tx.execute(sql`delete from ${analyticsEvents} where ${analyticsEvents.id} in (select ${analyticsEvents.id} from ${analyticsEvents} where ${analyticsEvents.at} < ${cutoff} limit ${batch * 4})`)
      const n = Number(res?.rowCount ?? 0)
      deleted += n
      if (n < batch * 4) break
    }
    // A salt of a day that is over is deleted even if nobody visited since (a visit would have replaced it).
    await tx.execute(sql`delete from ${reg.cmsState} where ${reg.cmsState.key} = ${SALT_KEY} and (${reg.cmsState.value}->>'day') < ${today}`)
    return deleted ? { pageviews: deleted } : {}
  }
}

/** One row of `analytics_daily`: totals of a day, by one dimension. No personal data. */
export interface DailyRollup {
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
 * The daily totals of `from`…`to` (days, both included), optionally of some dimensions only
 * (`['total', 'source']`). Days are complete from yesterday back; today has none yet. Nothing in
 * them identifies a visitor, so they can leave the site: a fleet monitor pulling them for an
 * overview of many sites wraps this in an endpoint of its own.
 */
export async function dailyRollups(db: any, from: string, to: string, dimensions?: readonly string[]): Promise<DailyRollup[]> {
  const d = analyticsDaily
  const rows: any[] = await db.select({
    day: sql<string>`${d.day}::text`, dimension: d.dimension, value: d.value, visitors: d.visitors, visits: d.visits,
    pageviews: d.pageviews, bounces: d.bounces, engagedMs: d.engagedMs,
  }).from(d).where(and(gte(d.day, from), lt(d.day, addDays(to, 1)), dimensions?.length ? inArray(d.dimension, [...dimensions]) : undefined))
    .orderBy(d.day, d.dimension, d.value)
  return rows.map((r) => ({ ...r, engagedMs: Number(r.engagedMs) }))
}
