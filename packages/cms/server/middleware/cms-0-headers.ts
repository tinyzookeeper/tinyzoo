// Request ids and security headers.
//
// Every request gets an id (the incoming X-Request-Id when it is sane — Pushbase's
// ingress or the client may set one — or a new one), echoed in the response and
// carried in the server's error logs, so a user's "it failed" maps to one log line.
//
// The admin and its API also get headers that stop them from being framed
// (clickjacking), sniffed or leaking their URLs (invite and reset links carry
// tokens) in the Referer. A full script CSP is left to the host app: Nuxt's inline
// hydration scripts need nonces, which belong in the app's security setup.
// Uploaded files are served with their own stricter policy (_media/raw).
//
// One exception, only with the editor in the preview on (NUXT_CMS_BUILDER=on, since 2f): an editor page
// asked as the sheet beside a page's preview (`?embed=builder`) may be framed by the admin itself, never
// by another site (SAMEORIGIN, `frame-ancestors 'self'`).
const ID_RE = /^[\w.-]{8,64}$/

export default defineEventHandler((event) => {
  const incoming = getRequestHeader(event, 'x-request-id')
  const id = incoming && ID_RE.test(incoming) ? incoming : crypto.randomUUID()
  event.context.requestId = id
  setResponseHeader(event, 'X-Request-Id', id)

  // The router matches /ADMIN too, and the app may live under a base URL.
  const base = String(useRuntimeConfig().app?.baseURL || '/').replace(/\/+$/, '').toLowerCase()
  let path = (event.path || '').split('?')[0]!.toLowerCase()
  if (base && path.startsWith(base)) path = path.slice(base.length) || '/'
  const admin = path === '/admin' || path.startsWith('/admin/')
  const api = path.startsWith('/api/cms/') && !path.startsWith('/api/cms/_media/raw/')
  if (!admin && !api) return
  const sheet = admin && cmsBuilderSwitch() && getQuery(event).embed === 'builder'
  setResponseHeaders(event, {
    'X-Frame-Options': sheet ? 'SAMEORIGIN' : 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  })
  if (admin) setResponseHeader(event, 'Content-Security-Policy', `frame-ancestors ${sheet ? "'self'" : "'none'"}; base-uri 'self'; object-src 'none'; form-action 'self'`)
  // Signed-in data must never sit in a shared cache.
  if (api) setResponseHeader(event, 'Cache-Control', 'no-store')
})
