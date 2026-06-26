// GET /api/cms/_media/raw/** — serve a blob from the LocalDriver. Public on
// purpose: media behave like CDN assets (the frontend renders them in <img>).
// Cloud drivers (S3/R2) hand out their own URLs and never hit this route.
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  if (!key) throw createError({ statusCode: 400, statusMessage: 'Missing key' })

  const obj = await useCmsStorage().get(key)
  if (!obj) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  setResponseHeader(event, 'Content-Type', obj.contentType)
  // Defense in depth against a hostile blob that slipped the upload allowlist:
  // never sniff a different type, and neutralize any inline script execution.
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Content-Security-Policy', "default-src 'none'; sandbox")
  setResponseHeader(event, 'Content-Disposition', 'inline')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return obj.body
})
