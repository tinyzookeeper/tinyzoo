import { eq } from 'tinyzoo'

// GET /api/cms/_auth/account/callback?code&state — the account service sent the browser
// back (experimental; docs/multi-tenant-plan.md 2.15). Checks the state against the flow
// cookie (which is dropped either way), exchanges the code, finds the person's user ON THIS
// SITE (matchAccountUser), opens the site's normal session and goes to `next`.
//
// Everything that can go wrong ends on the sign-in page, never on an error page:
//   ?account=expired      no flow cookie, a wrong or used state, or it took over ten minutes
//   ?account=signin       the account service said `login_required` (or another error): the
//                         page shows its form and the button and starts nothing by itself
//   ?account=unavailable  the account service is down, slow, or did not confirm the code
//   ?account=no-access    the account has no user here (or a disabled one)
const WINDOW = 15 * 60_000

export default defineEventHandler(async (event) => {
  const account = requireCmsAccountSettings()
  const ip = clientIp(event)
  if (!(await rateLimit('account:callback:ip:' + ip, 60, WINDOW))) throw tooManyRequests(event, 'Too many sign-in attempts; wait a few minutes and try again', WINDOW)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const query = getQuery(event)
  const one = (value: unknown) => (typeof value === 'string' ? value : '')

  const flow = openAccountFlow(getCookie(event, ACCOUNT_FLOW_COOKIE))
  deleteCookie(event, ACCOUNT_FLOW_COOKIE, { path: ACCOUNT_FLOW_PATH })
  const state = one(query.state)
  if (!flow || !state || !constantTimeEqual(state, flow.state) || !claimAccountState(flow.state, flow.expiresAt)) {
    return sendRedirect(event, accountLoginPage('expired'), 302)
  }
  const next = accountNextPath(flow.next)

  // `login_required` (a silent start, and the account service does not know the browser) or any other refusal.
  if (one(query.error)) return sendRedirect(event, accountLoginPage('signin', next), 302)
  const code = one(query.code)
  if (!code || code.length > 2000) return sendRedirect(event, accountLoginPage('unavailable', next), 302)

  let redirectUri: string
  try {
    redirectUri = accountCallbackAddress(event)
  }
  catch (err) {
    console.error('[cms] sign-in with the account cannot finish:', safeErrorMessage(err))
    return sendRedirect(event, accountLoginPage('unavailable', next), 302)
  }
  const who = await exchangeAccountCode(account, { code, verifier: flow.verifier, redirectUri })
  if (!who) {
    console.warn('[cms] the account service did not confirm a sign-in (down, slow, or it refused the code)')
    return sendRedirect(event, accountLoginPage('unavailable', next), 302)
  }

  const match = await matchAccountUser(account, who)
  if (!match.ok) {
    await audit(event, 'auth.login_failed', { userId: match.user?.id ?? null, meta: { via: 'account', reason: match.reason, ...(who.email ? { email: who.email } : {}), ip } })
    // The exchange made the person a member at the issuer: say that this site does not let them in.
    reportAccountMembership(event, account, { sub: who.sub, role: match.user?.role ?? '', active: false })
    return sendRedirect(event, accountLoginPage('no-access'), 302)
  }

  const { db, reg } = useCms()
  const [updated] = await db.update(reg.cmsUsers).set({ lastLoginAt: new Date() }).where(eq(reg.cmsUsers.id, match.user.id)).returning()
  const user = updated ?? match.user

  await startCmsSession(event, user)
  if (match.linked) await audit(event, 'auth.account_link', { userId: user.id, meta: { issuer: account.issuer } })
  if (match.accepted) await audit(event, 'auth.invite_accept', { userId: user.id, meta: { via: 'account' } })
  await audit(event, 'auth.login', { userId: user.id, meta: { via: 'account' } })
  reportAccountMembership(event, account, { sub: who.sub, role: user.role, active: true })
  return sendRedirect(event, next, 302)
})
