// Cross-site request forgery guard for the cookie-authenticated admin API.
//
// SameSite=Lax cookies stop other *sites*, but not a page on a sibling subdomain or
// any page of the host app itself (the admin shares its origin), and h3 parses
// classic HTML form posts (urlencoded / multipart) into objects the handlers accept.
// So every state-changing /api/cms/** request must:
//  1. carry a JSON body (or none) — a plain HTML form cannot send application/json;
//     multipart is accepted only for the media upload endpoint, and
//  2. when the browser says where it comes from (Sec-Fetch-Site), come from the same
//     origin (or be typed by the user: 'none').
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
  const path = (event.path || '').split('?')[0]!
  if (!path.startsWith('/api/cms/') || SAFE.has(event.method)) return

  const site = getRequestHeader(event, 'sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') {
    throw createError({ statusCode: 403, statusMessage: 'Cross-site request refused' })
  }

  const type = (getRequestHeader(event, 'content-type') || '').split(';')[0]!.trim().toLowerCase()
  const hasBody = Number(getRequestHeader(event, 'content-length') || 0) > 0 || !!getRequestHeader(event, 'transfer-encoding')
  if (!hasBody && !type) return
  if (type === 'application/json') return
  if (type === 'multipart/form-data' && event.method === 'POST' && path === '/api/cms/_media') return
  throw createError({ statusCode: 415, statusMessage: 'Send JSON (application/json)' })
})
