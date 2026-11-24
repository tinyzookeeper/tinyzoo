import { and, desc, eq, ne } from 'drizzle-orm'
import type { SitesView } from '#shared/api'

// My websites: the ones I made here (the newest first), the ones I run myself and connected,
// and the ones of other people I signed in to through my account.
export default defineEventHandler(async (event): Promise<SitesView> => {
  const me = await requireUser(event)
  const rows = await useDb().select().from(schema.sites).where(and(eq(schema.sites.ownerId, me.id), ne(schema.sites.status, 'removed'))).orderBy(desc(schema.sites.createdAt))
  return { sites: rows.map(toSiteView), max: maxSitesPerUser(), connected: await connectedSites(me.id), member: await memberSites(me.id) }
})
