// GET /api/cms/_media/raw/** — serve a blob from the LocalDriver. Public on
// purpose: media behave like CDN assets (the frontend renders them in <img>).
// Cloud drivers (S3/R2) hand out their own URLs and never hit this route.
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  if (!key) throw createError({ statusCode: 400, statusMessage: 'Missing key' })

  const obj = await useCmsStorage().get(key)
  if (!obj) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  setResponseHeader(event, 'Content-Type', obj.contentType)
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return obj.body
})
