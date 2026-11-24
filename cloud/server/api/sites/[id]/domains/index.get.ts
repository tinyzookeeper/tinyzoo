import type { DomainsView } from '#shared/domains'

// The domains of one of my websites: the ones in use, the ones still waiting for their DNS, and what a waiting one must be given there.
export default defineEventHandler(async (event): Promise<DomainsView> => {
  const { site } = await requireOwnSite(event)
  return domainsView(site)
})
