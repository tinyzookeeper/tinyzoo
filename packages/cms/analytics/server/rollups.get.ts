import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { addDays } from '../core/range'
import { answerDays, parseRollupsRange, ROLLUP_LISTS, rollupDaysOf, type RollupRowIn } from '../core/rollups'
import { ROLLUP_TOP, type AnalyticsRollups } from '../format'
import { dayStart } from '../rollup'
import { analyticsDaily, analyticsEvents } from '../tables'
import { addTitles } from './queries'
import { entryAt, siteTimeZone, today } from './context'

// GET /api/content/_analytics/rollups?from=YYYY-MM-DD&to=YYYY-MM-DD — the daily totals, for a
// tool that watches many sites (AnalyticsRollups in format.ts, a frozen format). Guarded like
// /api/health/status: off (404) without NUXT_CMS_STATUS_TOKEN, 30 requests a minute, then that
// token. Only the totals of `analytics_daily`: never a raw view, a visitor or a consent id.
export default defineEventHandler(async (event): Promise<AnalyticsRollups> => {
  setResponseHeader(event, 'cache-control', 'no-store')
  await requireCmsStatusToken(event, 'analytics-rollups')
  const q = getQuery(event)
  const range = parseRollupsRange(q.from, q.to)
  if ('error' in range) throw createError({ statusCode: 400, statusMessage: range.error, data: { code: 'analytics-range' } })

  const { db } = useCms()
  const d = analyticsDaily
  const tz = siteTimeZone()
  const day = today()
  const [bounds]: any[] = await db.select({ since: sql<string | null>`min(${d.day})::text`, last: sql<string | null>`max(${d.day})::text` })
    .from(d).where(eq(d.dimension, 'total'))
  const since: string | null = bounds?.since ?? null
  const through = await throughDay(db, bounds?.last ?? null, day, tz)
  const days = answerDays(range.from, range.to, since, through)

  let rows: RollupRowIn[] = []
  if (days.length) {
    const first = days[0]!
    const end = addDays(days.at(-1)!, 1)
    const dims = ['total', ...Object.keys(ROLLUP_LISTS)]
    // The first few values of each day and dimension, most visitors first.
    const ranked = db.select({
      day: sql<string>`${d.day}::text`.as('day'), dimension: d.dimension, value: d.value, visitors: d.visitors, visits: d.visits,
      pageviews: d.pageviews, bounces: d.bounces, engagedMs: d.engagedMs,
      rank: sql<number>`row_number() over (partition by ${d.day}, ${d.dimension} order by ${d.visitors} desc, ${d.pageviews} desc, ${d.value})`.as('rank'),
    }).from(d).where(and(gte(d.day, first), lt(d.day, end), inArray(d.dimension, dims))).as('ranked')
    const found: any[] = await db.select().from(ranked).where(sql`${ranked.rank} <= ${ROLLUP_TOP}`)
      .orderBy(ranked.day, ranked.dimension, ranked.rank)
    rows = found.map((r) => ({ ...r, day: String(r.day), engagedMs: Number(r.engagedMs) }))
  }

  return {
    format: 'tinyzoo-analytics-rollups',
    version: 1,
    at: new Date().toISOString(),
    timeZone: tz,
    from: range.from,
    to: range.to,
    since,
    through,
    days: rollupDaysOf(days, rows, await pageTitles(db, rows)),
  }
})

/**
 * The last day with its totals made: yesterday when every view before today is in the totals
 * (days after the last total then had no visit), else the last day the night rolled up.
 */
async function throughDay(db: any, last: string | null, day: string, tz: string): Promise<string | null> {
  if (!last) return null
  const yesterday = addDays(day, -1)
  if (last >= yesterday) return yesterday
  const e = analyticsEvents
  const [waiting]: any[] = await db.select({ id: e.id }).from(e)
    .where(and(gte(e.at, dayStart(addDays(last, 1), tz)), lt(e.at, dayStart(day, tz)))).limit(1)
  return waiting ? last : yesterday
}

/** The titles of the entries at the listed addresses (an address with no entry has none). */
async function pageTitles(db: any, rows: readonly RollupRowIn[]): Promise<Map<string, string>> {
  const paths = [...new Set(rows.filter((r) => r.dimension === 'page').map((r) => r.value))]
  const items: { path: string; entity?: string; id?: string; title?: string }[] = []
  for (const path of paths) {
    const at = await entryAt(path).catch(() => null)
    if (at) items.push({ path, entity: at.entity, id: at.id })
  }
  await addTitles(db, items)
  return new Map(items.filter((i) => i.title).map((i) => [i.path, i.title!]))
}
