// GET /api/mcp/oauth/authorize — the start of a sign-in. Renders nothing: it checks the request,
// writes it down and sends the browser to the admin's connect page (behind the admin's sign-in),
// carrying only the request's id.
//
// The order of the checks matters: until the redirect is known to be one this client
// registered, there is nowhere safe to send an error, so those two problems are a page here.
// Everything after them goes back to the client as ?error=.
export default defineEventHandler(async (event) => {
  assertCmsOAuth()
  if (!(await rateLimit(`oauth-authorize:${clientIp(event)}`, 60, 10 * 60_000))) return problemPage(event, 'Too many sign-in attempts', 'Wait a few minutes, then connect again from the program.')
  const query = getQuery(event)
  const str = (key: string): string | null => {
    const v = query[key]
    const one = Array.isArray(v) ? v[0] : v
    return typeof one === 'string' && one.length ? one : null
  }
  const clientId = str('client_id')
  const client = clientId ? await loadOAuthClient(clientId) : null
  if (!client) return problemPage(event, 'This program is not registered', 'The site does not know the program asking for access. Connecting again from the program usually fixes it. Nothing was shared.')
  const redirectUri = str('redirect_uri') ?? (client.redirectUris.length === 1 ? client.redirectUris[0]! : null)
  if (!redirectUri || !oauthRedirectRegistered(client.redirectUris, redirectUri)) {
    return problemPage(event, 'This return address is not registered', 'The program asked to have the answer sent to an address it did not register. Nothing was shared.')
  }

  const state = str('state')
  const fail = (error: string, description: string) => sendRedirect(event, oauthRedirectWith(redirectUri, { error, error_description: description, state }), 302)
  if ((str('response_type') ?? 'code') !== 'code') return fail('unsupported_response_type', 'Only the authorization code flow is supported')
  const challenge = str('code_challenge')
  if (!challenge) return fail('invalid_request', 'code_challenge is required (PKCE, S256)')
  if ((str('code_challenge_method') ?? 'plain') !== 'S256') return fail('invalid_request', 'Only the S256 code challenge method is supported')
  const resource = str('resource')
  if (!oauthResourceMatches(resource, cmsMcpResourceUrl(event))) return fail('invalid_target', 'This server does not issue tokens for that resource')

  const id = await createOAuthRequest({ clientId: client.id, redirectUri, state, codeChallenge: challenge, scope: oauthRequestedScope(str('scope')), resource })
  const base = String(useRuntimeConfig().app?.baseURL || '/').replace(/\/+$/, '')
  return sendRedirect(event, `${base}${CMS_OAUTH_CONSENT_PATH}?request=${encodeURIComponent(id)}`, 302)
})

/** A plain page for the two problems that leave no safe address to answer to. */
function problemPage(event: any, title: string, detail: string) {
  setResponseStatus(event, 400)
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:2rem;font:15px/1.6 ui-sans-serif,system-ui,sans-serif;background:#F9F5EF;color:#131313}
@media (prefers-color-scheme:dark){body{background:#18191C;color:#F9F5EF}}main{max-width:30rem}h1{font-size:1.25rem;margin:0 0 .75rem}p{margin:0 0 1rem;opacity:.8}</style>
</head><body><main><h1>${esc(title)}</h1><p>${esc(detail)}</p><p>You can close this window.</p></main></body></html>`
}
