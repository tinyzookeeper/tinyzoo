// Coarse Content-Length ceiling for CMS API routes — a defense-in-depth bound
// enforced before any handler buffers the body. The media upload route gets the
// configured media cap; every other JSON route gets a small cap. This cannot stop
// a chunked request that omits Content-Length (a streaming parser would — see the
// in-handler check in _media/index.post.ts), but it cheaply blocks the common case.
const JSON_MAX = 4 * 1024 * 1024 // 4MB

export default defineEventHandler((event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/cms/')) return

  const len = Number(getHeader(event, 'content-length') || 0)
  if (!len) return

  const isUpload = event.method === 'POST' && path.startsWith('/api/cms/_media')
  const max = isUpload ? maxUploadBytes() + 1024 * 1024 : JSON_MAX
  if (len > max) {
    throw createError({ statusCode: 413, statusMessage: 'Request body too large' })
  }
})
