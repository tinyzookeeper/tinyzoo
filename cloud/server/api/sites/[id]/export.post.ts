// Move this website: make its archive. The website answers reads only while it is copied
// (under a minute for a small one), then it is served as before. It runs in the background;
// the website's page shows the steps.
export default defineEventHandler(async (event) => {
  const { me, site } = await requireOwnSite(event)
  if (tooManyAttempts(`export:${me.id}`, 12, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  return { site: toSiteView(await startExport(site)) }
})
