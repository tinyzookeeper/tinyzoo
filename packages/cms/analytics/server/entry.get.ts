import { addDays } from '../core/range'
import { requireAnalyticsReader, siteTimeZone, today } from './context'
import { listOf, seriesOf, totalsOf, type Window } from './queries'

// GET /api/cms/_p/analytics/entry?entity=post&id=… — the editor's panel: views, visitors and the
// average time on this entry's pages (every language) over the last 30 days, a point per day,
// and where the visits came from. `tracked: false` for a collection without pages on the website.
const DAYS = 30

export default defineEventHandler(async (event) => {
  const { opts } = requireAnalyticsReader(event)
  const { db, reg } = useCms()
  const q = getQuery(event)
  const ent = reg.byName.get(String(q.entity ?? ''))
  const id = String(q.id ?? '')
  if (!ent || ent.singleton || !ent.content?.public || !ent.content.path || !/^[0-9a-f-]{36}$/i.test(id)) return { tracked: false }
  const tz = siteTimeZone()
  const day = today()
  // The raw views only (the totals keep no sources per entry): at most keepRawDays.
  const days = Math.min(DAYS, opts.keepRawDays)
  const from = addDays(day, -(days - 1))
  const w: Window = { range: { from, to: day }, tz, firstRawDay: from, filters: [{ dimension: 'entry', value: `${ent.name}:${id}` }] }
  const [totals, series, sources] = await Promise.all([totalsOf(db, w), seriesOf(db, w, 'day'), listOf(db, w, 'source')])
  return {
    tracked: true,
    days,
    pageviews: totals.pageviews,
    visitors: totals.visitors,
    avgEngagedMs: totals.pageviews ? Math.round(totals.engagedMs / totals.pageviews) : 0,
    series: series.map((p) => p.pageviews),
    sources: sources.slice(0, 3).map(({ value, visits }) => ({ value, visits })),
  }
})
