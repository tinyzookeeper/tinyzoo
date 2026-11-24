// Take a domain off a website. Was it the website's address, the website is at its service address again.
export default defineEventHandler(async (event) => {
  const { site } = await requireOwnSite(event)
  await removeDomain(site, getRouterParam(event, 'domain') ?? '')
  return { ok: true }
})
