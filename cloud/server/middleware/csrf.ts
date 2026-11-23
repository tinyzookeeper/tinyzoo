// Cross-site request forgery guard for the cookie-authenticated API, the same rule as
// tinyzoo's own admin (packages/cms/server/middleware/cms-csrf.ts): every state-changing
// /api/** request must
//  1. carry a JSON body (or none): a plain HTML form cannot send application/json, and
//  2. when the browser says where it comes from (Sec-Fetch-Site), come from the same origin
//     (or be typed by the user: 'none').
//
// It guards /api/** and nothing else. The account service's routes for websites (POST
// /oauth/token, /oauth/sites, /oauth/membership; server/routes/oauth) are outside it on
// purpose: they are called by a website's server, never with the cloud's cookie, and prove
// themselves with the client's secret (and, for a code, its PKCE verifier). They never read the
// session, so a cross-site request to them carries no authority this guard would have to protect.
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
  const path = (event.path || '').split('?')[0]!
  if (!path.startsWith('/api/') || SAFE.has(event.method)) return
  // nuxt-auth-utils' own session route (DELETE /api/_auth/session) is covered by the same rule.

  const site = getRequestHeader(event, 'sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') {
    throw createError({ statusCode: 403, statusMessage: 'Cross-site request refused' })
  }

  const type = (getRequestHeader(event, 'content-type') || '').split(';')[0]!.trim().toLowerCase()
  const hasBody = Number(getRequestHeader(event, 'content-length') || 0) > 0 || !!getRequestHeader(event, 'transfer-encoding')
  if (!hasBody && !type) return
  if (type === 'application/json') return
  throw createError({ statusCode: 415, statusMessage: 'Send JSON (application/json)' })
})
