// Check the site now (uptime and status), and answer with the fresh detail.
export default defineEventHandler(async (event) => {
  const me = await requireAccess(event)
  const site = await siteOf(event, me)
  writableSite(me, site)
  return checkNow(site)
})
