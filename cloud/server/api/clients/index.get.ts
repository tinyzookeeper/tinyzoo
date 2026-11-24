import type { ConnectedSiteView } from '#shared/api'

// The websites I run myself and connected to my account.
export default defineEventHandler(async (event): Promise<{ clients: ConnectedSiteView[]; max: number }> => {
  const me = await requireUser(event)
  return { clients: await connectedSites(me.id), max: MAX_CONNECTED_SITES }
})
