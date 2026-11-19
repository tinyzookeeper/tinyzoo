// Check the site now (uptime and status), and answer with the fresh detail.
export default defineEventHandler(async (event) => {
  const me = await requireAccess(event, 'write')
  return checkNow(await siteOf(event, me))
})
