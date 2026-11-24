// GET /api/cms/_model/usage?type=x_course&field=price — where a custom type (or one of its
// fields) is shown or linked to now: what removing it would meet. Administrators only; 404 when
// the feature is off for the site. With `field`: { places } (the blocks that show it or order by it).
// Without: { places, fields } (the blocks that show the type and the content that links to it, and
// for each field a block uses, the number of entries with such a block).
export default defineEventHandler(async (event) => {
  // Signed in first (401), as every admin route; then the route exists only with the feature on (404), and is for administrators (403).
  requireCmsUser(event)
  requireCustomTypes()
  requireCmsAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const q = getQuery(event)
  const type = typeof q.type === 'string' ? q.type : ''
  const field = typeof q.field === 'string' && q.field ? q.field : null
  if (!type) throw createError({ statusCode: 422, statusMessage: 'Name the type: ?type=…' })
  return await cmsModelUsage(type, field)
})
