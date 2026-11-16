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
  // Byte ranges: Safari will not play a video without them, and every browser seeks
  // and resumes with them. One range only (bytes=a-b, a-, -n); others get the whole file.
  setResponseHeader(event, 'Accept-Ranges', 'bytes')
  const size = obj.body.length
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(getRequestHeader(event, 'range') ?? '').trim())
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
    let end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (!range[1]) end = size - 1
    if (start >= size || start > end) {
      setResponseHeader(event, 'Content-Range', `bytes */${size}`)
      throw createError({ statusCode: 416, statusMessage: 'Range not satisfiable' })
    }
    start = Math.max(0, start)
    setResponseStatus(event, 206)
    setResponseHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`)
    setResponseHeader(event, 'Content-Length', end - start + 1)
    return obj.body.subarray(start, end + 1)
  }
  return obj.body
})
