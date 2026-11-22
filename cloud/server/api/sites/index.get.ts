import { and, desc, eq, ne } from 'drizzle-orm'
import type { SiteView } from '#shared/api'

// My websites, the newest first.
export default defineEventHandler(async (event): Promise<{ sites: SiteView[]; max: number }> => {
  const me = await requireUser(event)
  const rows = await useDb().select().from(schema.sites).where(and(eq(schema.sites.ownerId, me.id), ne(schema.sites.status, 'removed'))).orderBy(desc(schema.sites.createdAt))
  return { sites: rows.map(toSiteView), max: maxSitesPerUser() }
})
