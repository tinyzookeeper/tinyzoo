export default defineEventHandler(async (event) => {
  const me = await requireAccess(event)
  const site = await siteOf(event, me)
  writableSite(me, site)
  await removeSite(site)
  return { ok: true }
})
