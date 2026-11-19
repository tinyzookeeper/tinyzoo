export default defineEventHandler(async (event) => {
  const me = await requireAccess(event, 'write')
  const data = await readInput(event, siteInput)
  const id = await createSite(event, me.workspaceId, data)
  setResponseStatus(event, 201)
  return { id }
})
