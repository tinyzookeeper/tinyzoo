export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  return siteDetail(await siteOf(event, me.workspaceId))
})
