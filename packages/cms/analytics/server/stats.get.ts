import { parseFilters, type Dimension } from '../core/dimensions'
import { addDays, isPeriod, resolveRange } from '../core/range'
import { headline } from '../core/rollup'
import { requireAnalyticsReader, serverAllowsCollecting, settingsAllowCollecting, siteTimeZone, today } from './context'
import { listOf, seriesOf, totalsOf, type Window } from './queries'

// GET /api/cms/_p/analytics/stats?period=7d&compare=1&f.source=Google — everything the
// Analytics page shows for a period: the headline numbers (and the period before), the chart,
// and the lists. `period=custom` takes `from` and `to` (YYYY-MM-DD, in the site's time zone).
const LISTS: Dimension[] = ['page', 'entry_page', 'source', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'country', 'device', 'browser', 'os', 'locale', 'language']

export default defineEventHandler(async (event) => {
  const { opts, user } = requireAnalyticsReader(event)
  const { db } = useCms()
  const q = getQuery(event) as Record<string, any>
  const tz = siteTimeZone()
  const day = today()
  const range = resolveRange(isPeriod(q.period) ? q.period : '7d', day, { from: q.from, to: q.to })
  const filters = parseFilters(q)
  const compare = q.compare === '1' || q.compare === 'true'
  const firstRawDay = addDays(day, -opts.keepRawDays)
  const now: Window = { range, tz, firstRawDay, filters }
  const before: Window = { range: range.previous, tz, firstRawDay, filters }
  // Today's chart ends at the current hour.
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  const untilHour = range.bucket === 'hour' && range.to === day ? hour : undefined

  const [totals, series, previousTotals, previousSeries, lists, settingsOn] = await Promise.all([
    totalsOf(db, now),
    seriesOf(db, now, range.bucket, untilHour),
    compare ? totalsOf(db, before) : null,
    compare ? seriesOf(db, before, range.bucket) : null,
    Promise.all(LISTS.map(async (dim) => [dim, await listOf(db, now, dim)] as const)),
    settingsAllowCollecting(),
  ])
  const serverOn = serverAllowsCollecting()

  return {
    range: { period: range.period, from: range.from, to: range.to, bucket: range.bucket, days: range.days },
    previous: compare ? range.previous : null,
    today: day,
    timeZone: tz,
    keepRawDays: opts.keepRawDays,
    // Filters could not cover the days that only have totals.
    partial: filters.length > 0 && range.from < firstRawDay,
    collecting: { on: serverOn && settingsOn, server: serverOn, settings: settingsOn, canSwitch: (roleOf(user)?.base ?? user.role) === 'admin' },
    totals: headline(totals),
    previousTotals: previousTotals ? headline(previousTotals) : null,
    series,
    previousSeries,
    lists: Object.fromEntries(lists),
  }
})
