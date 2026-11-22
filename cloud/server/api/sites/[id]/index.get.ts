import type { SiteRuntime, SiteView } from '#shared/api'
import { HostingError, useHosting } from '../../../hosting'

// One of my websites as it is now: its steps while it is being made, then its addresses and
// whether I have already chosen my password for its admin.
export default defineEventHandler(async (event): Promise<{ site: SiteView; runtime: SiteRuntime | null }> => {
  const found = await requireOwnSite(event)
  const site = await noteAcceptance(found.site)
  let runtime: SiteRuntime | null = null
  if (site.status === 'ready' && getQuery(event).runtime === '1') {
    try {
      const d = await useHosting(site.driver).describe(hostedSite(site))
      runtime = { running: d.running, memoryBytes: d.memoryBytes ?? null }
    }
    catch (err) {
      if (!(err instanceof HostingError)) console.error('[cloud] describe failed', site.slug, (err as Error)?.message)
    }
  }
  return { site: toSiteView(site), runtime }
})
