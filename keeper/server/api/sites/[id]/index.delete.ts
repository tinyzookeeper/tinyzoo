import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  const site = await siteOf(event, me.workspaceId)
  await useDb().delete(schema.sites).where(eq(schema.sites.id, site.id))
  return { ok: true }
})
