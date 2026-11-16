// GET /api/openapi — interactive API reference (Scalar) for the content API.
// Loads the spec from /api/openapi.json.
//
// Off in production unless `cms.content.docs: true` (env NUXT_CMS_CONTENT_DOCS=true): the
// page is public on the admin's own origin, shows the content model, and loads a script
// from a CDN — a site should choose that, not get it by default. Always on in development.
// When the content API is token-gated we 404 it as well: a browser can't send the
// x-api-key header, so the UI cannot work — and we avoid advertising the docs at all.
// (/api/openapi.json is separate: it stays, see its own comment.)
//
// The script is one exact version of Scalar's standalone build, checked by its hash
// (Subresource Integrity): if the CDN's file were ever replaced, the browser refuses it.
// To move to another version: fetch the file, `openssl dgst -sha384 -binary … | openssl base64 -A`.
const SCALAR_VERSION = '1.76.0'
const SCALAR = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}/dist/browser/standalone.js`
const SCALAR_INTEGRITY = 'sha384-oH1C0RwqcwbVXkC+r8A+4qRoyEUQdtxAzOwumkxZtQBBcsy61FOoPt7B50OVJYYQ'

export default defineEventHandler((event) => {
  const token = (useRuntimeConfig().cms as any)?.content?.token
  if (token || !contentDocsEnabled()) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  setContentCache(event)
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  // Constrain what this page may load: scripts only from this origin and that one file
  // (no inline script), styles from self + the CDN (Scalar injects <style> tags), fonts
  // from Scalar's font host. `connect-src 'self'` deliberately blocks Scalar's
  // api.scalar.com registry telemetry; the spec loads same-origin.
  setResponseHeader(
    event,
    'content-security-policy',
    "default-src 'self'; script-src 'self' " + SCALAR + "; "
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
    <script id="api-reference" type="application/json" data-url="/api/openapi.json"></script>
    <script src="${SCALAR}" integrity="${SCALAR_INTEGRITY}" crossorigin="anonymous"></script>
  </body>
</html>`
})
