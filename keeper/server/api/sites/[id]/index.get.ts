export default defineEventHandler(async (event) => {
  const me = await requireAccess(event)
  return siteDetail(await siteOf(event, me.workspaceId))
})
