// GET /api/cms/_auth/account/start?next=<path>&silent=1 — begin signing in with the
// tinyzoo account (experimental; docs/multi-tenant-plan.md 2.15). Makes a state and a PKCE
// verifier, keeps them in a sealed cookie of their own for ten minutes, and sends the
// browser to the account service. `silent=1` (the switcher): the account service must not
// show its sign-in form (`prompt=none`), and someone already signed in here goes straight on.
// 404 unless the site has the account's three settings.
const WINDOW = 15 * 60_000

export default defineEventHandler(async (event) => {
  const account = requireCmsAccountSettings()
  if (!(await rateLimit('account:start:ip:' + clientIp(event), 60, WINDOW))) throw tooManyRequests(event, 'Too many sign-in attempts; wait a few minutes and try again', WINDOW)
  const query = getQuery(event)
  const next = accountNextPath(query.next)
  const silent = query.silent === '1'
  setResponseHeader(event, 'Cache-Control', 'no-store')

  // The switcher of another website brought someone who is signed in here already: nothing to ask.
  if (silent && event.context.cmsUser) return sendRedirect(event, next, 302)

  let redirectUri: string
  let sealed: string
  const state = newAccountSecret()
  const verifier = newAccountSecret()
  try {
    redirectUri = accountCallbackAddress(event)
    sealed = sealAccountFlow({ state, verifier, next, site: useCmsSite().id, expiresAt: Date.now() + ACCOUNT_FLOW_SECONDS * 1000 })
  }
  catch (err) {
    // No public address or no app secret: a setting of the deploy, said in the log, not a 500 page.
    console.error('[cms] sign-in with the account cannot start:', safeErrorMessage(err))
    return sendRedirect(event, accountLoginPage('unavailable', next), 302)
  }
  setCookie(event, ACCOUNT_FLOW_COOKIE, sealed, {
    httpOnly: true, sameSite: 'lax', path: ACCOUNT_FLOW_PATH, maxAge: ACCOUNT_FLOW_SECONDS, secure: redirectUri.startsWith('https:'),
  })

  const to = new URL(account.issuer + '/oauth/authorize')
  to.searchParams.set('response_type', 'code')
  to.searchParams.set('client_id', account.clientId)
  to.searchParams.set('redirect_uri', redirectUri)
  to.searchParams.set('state', state)
  to.searchParams.set('code_challenge', pkceChallenge(verifier))
  to.searchParams.set('code_challenge_method', 'S256')
  if (silent) to.searchParams.set('prompt', 'none')
  return sendRedirect(event, to.toString(), 302)
})
