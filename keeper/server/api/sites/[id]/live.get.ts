import type { SiteLive } from '#keeper/types/traffic'

// GET /api/sites/:id/live — the site's today, read from the site (kept 20 s): visitors right
// now, today so far by hour, today's top lists, yesterday up to the same time. Same visibility as the site.
export default defineEventHandler(async (event): Promise<SiteLive> => {
  const me = await requireAccess(event)
  const site = await siteOf(event, me)
  setResponseHeader(event, 'cache-control', 'no-store')
  return siteLive(site)
})
