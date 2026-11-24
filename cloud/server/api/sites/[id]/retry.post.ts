// Try again: go on from the step that failed.
export default defineEventHandler(async (event) => {
  const { me, site } = await requireOwnSite(event)
  if (site.status !== 'failed') return { site: toSiteView(site) }
  if (tooManyAttempts(`retry:${me.id}`, 20, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  return { site: toSiteView(await retrySite(site)) }
})
