import type { TrafficReport } from '#keeper/types/traffic'

// GET /api/sites/:id/traffic?days=30|90 — the site's visits: a point a day, the totals against
// the period before, and the top pages, sources, countries and devices. Same visibility as the site.
export default defineEventHandler(async (event): Promise<TrafficReport> => {
  const me = await requireAccess(event)
  const site = await siteOf(event, me)
  const days = getQuery(event).days === '90' ? 90 : 30
  return trafficReport(site, days)
})
