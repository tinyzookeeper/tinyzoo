import { eq } from 'drizzle-orm'

// Check the site now (uptime and status), and answer with the fresh detail.
export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  const site = await siteOf(event, me.workspaceId)
  await checkSite(site.id, { forceStatus: true })
  if (!site.certCheckedAt) await checkCertificate(site)
  const [fresh] = await useDb().select().from(schema.sites).where(eq(schema.sites.id, site.id))
  return siteDetail(fresh!)
})
