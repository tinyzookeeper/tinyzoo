import { isPkceChallenge, redirectAllowed, redirectWith, returnPath } from '#shared/account'

// GET /oauth/authorize: a website sends a person's browser here to learn who they are
// (docs/multi-tenant-plan.md, 2.15). Authorization code with PKCE (S256), nothing else.
//
//  - An unknown or revoked client, or a `redirect_uri` that is not exactly the client's address
//    followed by the callback path, gets an error page. The browser is never sent anywhere.
//  - Once the client and the address are known to be right, every other answer goes back to the
//    website: `code` and `state` for a signed-in person (at once, with no question: the clients
//    are the person's own websites), `error=login_required` when `prompt=none` and nobody is
//    signed in, `error=invalid_request` for a request without a state or a PKCE challenge.
//  - Nobody signed in and no `prompt=none`: the sign-in page, which comes back to this same address.

const one = (value: unknown): string => (typeof value === 'string' ? value : '')

/** An error page in the app's own look (app/error.vue puts the code into words, in both languages). */
const page = (statusCode: number, code: string, message: string) => createError({ statusCode, statusMessage: message, data: { code } })

export default defineEventHandler(async (event) => {
  await migrationsReady()
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'referrer-policy', 'no-referrer')
  const query = getQuery(event)
  const redirectUri = one(query.redirect_uri)

  const client = await findClient(one(query.client_id))
  if (!client || client.revokedAt || !client.url) throw page(400, 'oauth.client', 'Unknown website')
  if (!redirectAllowed(client.url, redirectUri)) throw page(400, 'oauth.redirect', 'Wrong return address')

  const back = (params: Record<string, string | undefined>) => sendRedirect(event, redirectWith(redirectUri, params), 302)
  const state = one(query.state)
  if (!state || state.length > 512) return back({ error: 'invalid_request', error_description: 'state is required' })
  if (one(query.response_type) !== 'code') return back({ error: 'unsupported_response_type', state })
  const codeChallenge = one(query.code_challenge)
  if (one(query.code_challenge_method) !== 'S256' || !isPkceChallenge(codeChallenge)) {
    return back({ error: 'invalid_request', error_description: 'code_challenge with code_challenge_method=S256 is required', state })
  }

  const me = await currentUser(event)
  if (!me) {
    if (one(query.prompt) === 'none') return back({ error: 'login_required', state })
    // The sign-in page comes back to this very address (a path of this app, checked again there).
    const here = returnPath(event.path)
    return sendRedirect(event, here ? `/login?next=${encodeURIComponent(here)}` : '/login', 302)
  }

  if (tooManyAttempts(`oauth:authorize:${me.id}`, 120)) throw page(429, 'oauth.busy', 'Too many sign-ins')
  const code = await issueCode({ clientId: client.id, userId: me.id, redirectUri, codeChallenge })
  return back({ code, state })
})
