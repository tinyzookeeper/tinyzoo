// GET /api/cms/_model/attention — the blocks on the site's pages whose binding names a content
// type or a field the site does not have (or has hidden): { places: [{ …place, missing }] }, where
// `missing` is { type } or { fields }. One walk of the pages, at most 50 places. Administrators
// only; 404 when the feature is off for the site.
export default defineEventHandler(async (event) => {
  // Signed in first (401), as every admin route; then the route exists only with the feature on (404), and is for administrators (403).
  requireCmsUser(event)
  requireCustomTypes()
  requireCmsAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return { places: await cmsModelAttention(50) }
})
