// "Check again": look at a waiting domain's DNS once more.
export default defineEventHandler(async (event) => {
  const { me, site } = await requireOwnSite(event)
  if (tooManyAttempts(`domain-check:${me.id}`, 120, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  return { domain: await recheckDomain(site, getRouterParam(event, 'domain') ?? '') }
})
