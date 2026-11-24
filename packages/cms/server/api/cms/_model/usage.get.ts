// GET /api/cms/_model/usage?type=x_course&field=price — where a custom type (or one of its
// fields) is shown or linked to now: what removing it would meet. Administrators only; 404 when
// the feature is off for the site.
export default defineEventHandler(async (event) => {
  requireCustomTypes()
  requireCmsAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const q = getQuery(event)
  const type = typeof q.type === 'string' ? q.type : ''
  const field = typeof q.field === 'string' && q.field ? q.field : null
  if (!type) throw createError({ statusCode: 422, statusMessage: 'Name the type: ?type=…' })
  return { places: await cmsModelUsage(type, field) }
})
