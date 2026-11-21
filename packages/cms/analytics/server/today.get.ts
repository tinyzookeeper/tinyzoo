import { addDays } from '../core/range'
import { liveHoursOf, liveListOf, ROLLUP_LISTS, type RollupListDimension } from '../core/rollups'
import { ROLLUP_TOP, type AnalyticsLive } from '../format'
import { analyticsOptions, siteTimeZone, today } from './context'
import { activeNow, listOf, seriesOf, totalsOf, yesterdaySoFar, type Window } from './queries'

// GET /api/content/_analytics/live — today's visits so far, for a tool that watches many sites
// (AnalyticsLive in format.ts, a frozen format). Guarded like /api/health/status and the
// rollups: off (404) without NUXT_CMS_STATUS_TOKEN, 30 requests a minute, then that token.
// Counted from the raw views with the admin report's own queries, so both show the same.
export default defineEventHandler(async (event): Promise<AnalyticsLive> => {
  setResponseHeader(event, 'cache-control', 'no-store')
  await requireCmsStatusToken(event, 'analytics-live')
  const opts = analyticsOptions()
  const { db } = useCms()
  const tz = siteTimeZone()
  const day = today()
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  const w: Window = { range: { from: day, to: day }, tz, firstRawDay: addDays(day, -opts.keepRawDays), filters: [] }
  const dims = Object.keys(ROLLUP_LISTS) as RollupListDimension[]

  const [active, totals, hours, yesterday, lists] = await Promise.all([
    activeNow(db),
    totalsOf(db, w),
    seriesOf(db, w, 'hour', hour),
    yesterdaySoFar(db, day, tz),
    Promise.all(dims.map(async (dim) => [ROLLUP_LISTS[dim], liveListOf(await listOf(db, w, dim), ROLLUP_TOP)] as const)),
  ])
  const t = (x: typeof totals) => ({ visitors: x.visitors, visits: x.visits, pageviews: x.pageviews, bounces: x.bounces, engagedMs: Number(x.engagedMs) })
  const byKey = Object.fromEntries(lists) as Record<(typeof ROLLUP_LISTS)[RollupListDimension], AnalyticsLive['today']['pages']>

  return {
    format: 'tinyzoo-analytics-live',
    version: 1,
    at: new Date().toISOString(),
    timeZone: tz,
    day,
    hour,
    active,
    today: { day, ...t(totals), pages: byKey.pages, sources: byKey.sources, countries: byKey.countries, devices: byKey.devices },
    yesterdaySoFar: t(yesterday),
    hours: liveHoursOf(hours, hour),
  }
})
