// GET /api/health/status — a summary of the site for a tool that watches many sites
// (CmsStatus: versions, health, how much it is used; never content or personal data).
// Off (404) until cms.status.token (NUXT_CMS_STATUS_TOKEN) is set; then the request
// carries that token as `x-api-key` or `Authorization: Bearer`.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const token = cmsStatusToken()
  if (!token) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  // A watcher asks about once a minute; anything much busier is guessing or a loop.
  if (!(await rateLimit(`status:${clientIp(event)}`, 30, 60_000))) throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  const header = getHeader(event, 'authorization') || ''
  const provided = getHeader(event, 'x-api-key') || header.replace(/^Bearer\s+/i, '')
  if (!provided || !constantTimeEqual(provided, token)) throw createError({ statusCode: 401, statusMessage: 'Invalid status token' })
  return collectCmsStatus()
})
