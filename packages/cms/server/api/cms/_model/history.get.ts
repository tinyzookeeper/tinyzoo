// GET /api/cms/_model/history — the newest 50 versions of the site's own content types: who
// changed them, when, and the operations (not the documents). Administrators only; 404 when the
// feature is off for the site.
export default defineEventHandler(async (event) => {
  requireCustomTypes()
  requireCmsAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return cmsModelHistory(50)
})
