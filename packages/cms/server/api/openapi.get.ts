// GET /api/openapi — interactive API reference (Scalar) for the content API.
// Loads the spec from /api/openapi.json.
//
// When the content API is token-gated we 404 this route: a browser can't send the
// x-api-key header, so the UI cannot work — and we avoid advertising the docs at all.
const SCALAR = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1'

export default defineEventHandler((event) => {
  const token = (useRuntimeConfig().cms as any)?.content?.token
  if (token) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  setContentCache(event)
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  // Constrain what this page may load — scripts/styles only from self + the pinned
  // CDN, fonts from Scalar's font host. `connect-src 'self'` deliberately blocks
  // Scalar's api.scalar.com registry telemetry; the spec loads same-origin.
  setResponseHeader(
    event,
    'content-security-policy',
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    + "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    + "font-src https://cdn.jsdelivr.net https://fonts.scalar.com data:; "
    + "img-src 'self' data: https:; connect-src 'self'",
  )
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content API reference</title>
  </head>
  <body>
    <script id="api-reference" data-url="/api/openapi.json"></script>
    <script src="${SCALAR}"></script>
  </body>
</html>`
})
