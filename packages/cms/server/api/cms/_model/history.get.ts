// GET /api/cms/_model/history — the newest 50 versions of the site's own content types: who
// changed them, when, and the operations (not the documents). Administrators only; 404 when the
// feature is off for the site.
export default defineEventHandler(async (event) => {
  // Signed in first (401), as every admin route; then the route exists only with the feature on (404), and is for administrators (403).
  requireCmsUser(event)
  requireCustomTypes()
  requireCmsAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return cmsModelHistory(50)
})
