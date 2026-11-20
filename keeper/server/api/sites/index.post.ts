// Add a site to a team (`teamId`), or to the default team of `workspace`.
export default defineEventHandler(async (event) => {
  const me = await requireAccess(event)
  const data = await readInput(event, siteInput)
  const id = await createSite(event, me, data)
  setResponseStatus(event, 201)
  return { id }
})
