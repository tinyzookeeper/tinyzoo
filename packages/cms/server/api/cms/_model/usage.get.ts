// GET /api/cms/_model/usage?type=custom_course&field=price — where a custom type (or one of its
// fields) is shown or linked to now, and how much content it holds: what removing it would meet
// and what deleting it for good would take. Hidden (removed) types and fields work too.
// Administrators only; 404 when the feature is off for the site.
// With `field`: { places, values } (the blocks that show it or order by it; the number of entries
// that hold a value of it, or null when that cannot be counted, as for a translated field).
// Without: { places, fields, entries } (the blocks that show the type and the content that links
// to it, for each field a block uses the number of entries with such a block, and the number of
// entries of the type).
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
