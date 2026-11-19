import { addDays, resolveRange } from '../core/range'
import { change } from '../core/rollup'
import { requireAnalyticsReader, siteTimeZone, today } from './context'
import { listOf, seriesOf, totalsOf, type Window } from './queries'

// GET /api/cms/_p/analytics/summary — the home page's card: visitors of the last 7 days against
// the 7 before, a small chart of them, and the three most read pages.
export default defineEventHandler(async (event) => {
  const { opts } = requireAnalyticsReader(event)
  const { db } = useCms()
  const tz = siteTimeZone()
  const day = today()
  const range = resolveRange('7d', day)
  const firstRawDay = addDays(day, -opts.keepRawDays)
  const now: Window = { range, tz, firstRawDay, filters: [] }
  const [totals, before, series, pages] = await Promise.all([
    totalsOf(db, now),
    totalsOf(db, { ...now, range: range.previous }),
    seriesOf(db, now, 'day'),
    listOf(db, now, 'page'),
  ])
  return {
    visitors: totals.visitors,
    previousVisitors: before.visitors,
    change: change(totals.visitors, before.visitors),
    series: series.map((p) => p.visitors),
    pages: pages.slice(0, 3).map(({ value, visitors, entity, id, title }) => ({ path: value, visitors, entity, id, title })),
  }
})
