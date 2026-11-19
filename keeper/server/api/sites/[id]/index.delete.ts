export default defineEventHandler(async (event) => {
  const me = await requireAccess(event, 'write')
  await removeSite(await siteOf(event, me))
  return { ok: true }
})
