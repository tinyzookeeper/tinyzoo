import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto'
import { and, eq, inArray, isNull } from 'tinyzoo'
import type { CmsRegistry } from 'tinyzoo'

/**
 * Sign-in with the tinyzoo account (experimental): the site is a client of the account
 * service (the issuer), next to its own password sign-in. The contract between the two is
 * section 2.15 of docs/multi-tenant-plan.md.
 *
 * The site asks the issuer who the person is (authorization code with PKCE), finds ITS OWN
 * user for them and opens its own session. Roles stay on the site. Nothing here exists
 * unless `cms.auth.account` has an issuer, a client id and a client secret, and the
 * built-in sign-in is used; in multi-tenant mode each site has its own three.
 *
 * The link between an account and a user of this site is two rows of `cms_state`:
 *   account:<sha256 hex of issuer + "\n" + sub>  →  { userId, issuer, sub, linkedAt }
 *   account-of:<userId>                          →  { issuer, sub }
 * The key is the row's primary key, so an account links to one user and a user to one account.
 */
export interface CmsAccountSettings {
  /** The account service's address, without a trailing slash. */
  issuer: string
  clientId: string
  clientSecret: string
}

const TRAILING_SLASHES = /\/+$/
/** The admin's languages: an invited person starts in their account's language when it is one of them. */
const ACCOUNT_LOCALES = ['cs', 'en', 'de']
const HTTP_ADDRESS = /^https?:\/\/[^\s/]+/i
const warnedIssuer = cmsSiteScoped(() => ({ done: false }))

/** The site's account settings, or null when sign-in with the account is off (the usual case). */
export function cmsAccount(): CmsAccountSettings | null {
  if (cmsAuthMode() !== 'builtin') return null
  const a = cmsSettings().auth?.account
  if (!a) return null
  const issuer = String(a.issuer ?? '').trim().replace(TRAILING_SLASHES, '')
  const clientId = String(a.clientId ?? '').trim()
  const clientSecret = String(a.clientSecret ?? '')
  if (!issuer || !clientId || !clientSecret) return null
  if (!HTTP_ADDRESS.test(issuer)) {
    const warned = warnedIssuer()
    if (!warned.done) console.error('[cms] cms.auth.account.issuer (NUXT_CMS_AUTH_ACCOUNT_ISSUER) must be an http(s) address; sign-in with the account stays off')
    warned.done = true
    return null
  }
  return { issuer, clientId, clientSecret }
}

/** The settings, or 404: without them the routes do not exist. */
export function requireCmsAccountSettings(): CmsAccountSettings {
  const account = cmsAccount()
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return account
}

// ── addresses ──────────────────────────────────────────────────────────────────

export const ACCOUNT_CALLBACK_PATH = '/api/cms/_auth/account/callback'

/**
 * Where the issuer sends the browser back: the site's public address (`cms.publicUrl`, in
 * multi-tenant mode the site's own) in its normal form (accountSiteAddress, cmsAccountAddress.ts)
 * + the callback path. Never the
 * request's Host header. Outside production the request's origin is accepted, as for links
 * in e-mails (adminLink).
 */
export function accountCallbackAddress(event: any): string {
  const configured = accountSiteAddress(String(cmsSettings().publicUrl || ''))
  if (configured) return configured + ACCOUNT_CALLBACK_PATH
  if (!cmsIsMultiTenant() && (import.meta.dev || process.env.NODE_ENV !== 'production' || process.env.CMS_ALLOW_REQUEST_ORIGIN === '1')) {
    return getRequestURL(event).origin + ACCOUNT_CALLBACK_PATH
  }
  throw createError({ statusCode: 500, statusMessage: 'cms.publicUrl (NUXT_CMS_PUBLIC_URL) must be set to sign in with the account' })
}

const CONTROL_OR_SPACE = /[\u0000- \u007f\\]/

/**
 * Where to go after signing in: a path of this site, or `/admin`. A path starts with exactly
 * one `/`; no backslash (browsers read `/\host` as `//host`), no white space or control
 * character, and it must still be this site's when a browser resolves it.
 */
export function accountNextPath(value: unknown): string {
  const next = typeof value === 'string' ? value : ''
  if (!next || next.length > 2000 || next[0] !== '/' || next[1] === '/' || CONTROL_OR_SPACE.test(next)) return '/admin'
  try {
    const base = 'http://site.invalid'
    const url = new URL(next, base)
    if (url.origin !== base) return '/admin'
    // As a browser will read it (`/a/../..//host` has become `//host`, which names another site).
    const path = url.pathname + url.search + url.hash
    return path[0] === '/' && path[1] !== '/' ? path : '/admin'
  }
  catch {
    return '/admin'
  }
}

/**
 * The sign-in page with what happened:
 *   `no-access`    the account has no user on this site (or a disabled one)
 *   `unverified`   the account's e-mail is not confirmed yet, so the site cannot tell whose it is
 *   `unavailable`  the account service is down, slow, or did not confirm the code
 *   `expired`      the sign-in took over ten minutes, or its address was used twice
 *   `busy`         too many sign-ins from this address (the rate limit)
 *   `signin`       nothing special: the account service does not know the browser
 */
export type CmsAccountResult = 'no-access' | 'unverified' | 'unavailable' | 'expired' | 'busy' | 'signin'

export function accountLoginPage(result: CmsAccountResult, next?: string): string {
  // After a password sign-in the person still lands where they were going (the page reads `redirect`).
  const redirect = next && next !== '/admin' && next.startsWith('/admin') ? '&redirect=' + encodeURIComponent(next) : ''
  return '/admin/login?account=' + result + redirect
}

// ── the flow cookie ────────────────────────────────────────────────────────────

/** The state and the PKCE verifier of one sign-in under way: sealed, httpOnly, for ten minutes, sent to these routes only. */
export const ACCOUNT_FLOW_COOKIE = 'cms-account-flow'
export const ACCOUNT_FLOW_PATH = '/api/cms/_auth/account'
export const ACCOUNT_FLOW_SECONDS = 10 * 60

export interface CmsAccountFlow {
  state: string
  verifier: string
  next: string
  /** The site the flow was started on: it finishes there and nowhere else. */
  site: string
  expiresAt: number
}

/**
 * The key the flow cookie is sealed with: from the app secret and, in multi-tenant mode,
 * the site's own secret, so a cookie sealed on one site cannot even be opened on another.
 */
function flowKey(): Buffer {
  const root = String((useRuntimeConfig() as any).appSecret ?? '')
  const site = cmsIsMultiTenant() ? useCmsSite().secret : ''
  if ((root + site).length < 32) throw createError({ statusCode: 500, statusMessage: 'NUXT_APP_SECRET must be set (at least 32 characters) to sign in with the account' })
  return Buffer.from(hkdfSync('sha256', root + '\n' + site, 'tinyzoo', 'tinyzoo:account-flow', 32))
}

export function sealAccountFlow(flow: CmsAccountFlow): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', flowKey(), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(flow), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}

/** The flow a cookie holds, if this site sealed it and it has not run out. Null otherwise. */
export function openAccountFlow(sealed: unknown): CmsAccountFlow | null {
  if (typeof sealed !== 'string' || sealed.length < 40 || sealed.length > 6000) return null
  try {
    const raw = Buffer.from(sealed, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', flowKey(), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const flow = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as CmsAccountFlow
    if (typeof flow?.state !== 'string' || typeof flow.verifier !== 'string' || typeof flow.next !== 'string') return null
    if (flow.site !== useCmsSite().id) return null
    if (typeof flow.expiresAt !== 'number' || flow.expiresAt < Date.now()) return null
    return flow
  }
  catch {
    return null
  }
}

export const newAccountSecret = () => randomBytes(32).toString('base64url')
export const pkceChallenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url')

/**
 * States that were already brought back once, until they would have run out anyway: a
 * callback address used a second time stops here (the issuer's code works once as well).
 * This process's memory: with several instances the issuer's one-time code is what holds.
 */
const usedStates = cmsSiteScoped(() => new Map<string, number>())

/** True the first time a state comes back, false every time after. */
export function claimAccountState(state: string, expiresAt: number): boolean {
  const used = usedStates()
  const now = Date.now()
  if ((used.get(state) ?? 0) > now) return false
  if (used.size > 2000) for (const [key, until] of used) if (until <= now) used.delete(key)
  if (used.size > 5000) used.clear()
  used.set(state, expiresAt)
  return true
}

// ── talking to the issuer ──────────────────────────────────────────────────────

/** How long the issuer may take to answer (the tests shorten it). */
const issuerTimeoutMs = () => cmsTimerMs('CMS_TEST_ACCOUNT_TIMEOUT_MS', 5000)
const MAX_ANSWER = 200_000

/**
 * POST JSON to an endpoint of the issuer and read its JSON answer. Null when it is down,
 * slow, answers anything but 200, or answers something that is not a JSON object: the
 * caller decides what that means, and it never becomes an error page.
 */
async function askIssuer(account: CmsAccountSettings, path: string, body: unknown, opts: { basic?: boolean } = {}): Promise<Record<string, any> | null> {
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' }
    if (opts.basic) headers.authorization = 'Basic ' + Buffer.from(account.clientId + ':' + account.clientSecret, 'utf8').toString('base64')
    const res = await fetch(account.issuer + path, {
      method: 'POST', headers, body: JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(issuerTimeoutMs()),
    })
    if (res.status !== 200) {
      await res.body?.cancel().catch(() => {})
      return null
    }
    const text = await res.text()
    if (text.length > MAX_ANSWER) return null
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  }
  catch {
    return null
  }
}

/**
 * Is the account service there? Asked before a browser is sent to it (`start`): a browser
 * sent to a service that is down shows its own error page and the person is stuck there,
 * while the site can say so on its sign-in page and offer the password. Any answer of the
 * issuer's discovery address counts (2.15: `GET /.well-known/tinyzoo-account`); no answer
 * within three seconds, or a failure of its server, does not.
 */
export async function accountIssuerAnswers(account: CmsAccountSettings): Promise<boolean> {
  try {
    const res = await fetch(account.issuer + '/.well-known/tinyzoo-account', {
      headers: { accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(Math.min(issuerTimeoutMs(), 3000)),
    })
    await res.body?.cancel().catch(() => {})
    return res.status < 500
  }
  catch {
    return false
  }
}

/** Who the issuer says the person is. */
export interface CmsAccountIdentity {
  sub: string
  /** Lower case, trimmed; '' when the issuer sent none. */
  email: string
  emailVerified: boolean
  name: string
  locale: string | null
}

/** Exchange the code for the person (`POST /oauth/token`). Null when the issuer does not confirm them. */
export async function exchangeAccountCode(account: CmsAccountSettings, input: { code: string; verifier: string; redirectUri: string }): Promise<CmsAccountIdentity | null> {
  const answer = await askIssuer(account, '/oauth/token', {
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: account.clientId,
    client_secret: account.clientSecret,
    code_verifier: input.verifier,
  })
  const user = answer?.user
  if (!user || typeof user !== 'object') return null
  const sub = typeof user.sub === 'string' ? user.sub : typeof user.sub === 'number' ? String(user.sub) : ''
  if (!sub || sub.length > 200) return null
  const email = typeof user.email === 'string' && user.email.length <= 320 ? normalizeEmail(user.email) : ''
  return {
    sub,
    email,
    // Only a plain `true` counts: "true", 1 or a missing field never link an account by its e-mail.
    emailVerified: user.email_verified === true && !!email,
    name: typeof user.name === 'string' ? user.name.trim().slice(0, 120) : '',
    locale: typeof user.locale === 'string' ? user.locale.slice(0, 10) : null,
  }
}

/** How long a response waits for the issuer to take a membership report before it goes on without it. */
const REPORT_WAIT_MS = 2000

/**
 * Tell the issuer which role the person has on this site, or that the site no longer lets
 * them in (`POST /oauth/membership`). Never an error: the issuer only shows it in the
 * switcher and in the person's list of websites. The work goes on after the response
 * (`event.waitUntil`); the promise that comes back is done when the issuer has answered, or
 * after two seconds, whichever is first: the callback waits for it, so that the list the
 * admin asks for right after a sign-in already carries this website with the role.
 */
export function reportAccountMembership(event: any, account: CmsAccountSettings, member: { sub: string; role: string; active: boolean }): Promise<void> {
  const work = askIssuer(account, '/oauth/membership', member, { basic: true }).then((answer) => {
    if (!answer) console.warn('[cms] the account service did not take the membership report')
  }).catch(() => {})
  if (typeof event?.waitUntil === 'function') event.waitUntil(work)
  let timer: ReturnType<typeof setTimeout> | undefined
  const soon = new Promise<void>((resolve) => { timer = setTimeout(resolve, REPORT_WAIT_MS) })
  return Promise.race([work, soon]).finally(() => clearTimeout(timer))
}

/** When the user is linked to an account of this site's issuer: tell the issuer their role and whether they may still sign in. */
export async function reportAccountMembershipOf(event: any, user: { id: string; role: string; status: string }): Promise<void> {
  const account = cmsAccount()
  if (!account) return
  try {
    const { db, reg } = useCms()
    const link = await accountLinkOf(db, reg, user.id)
    if (link && link.issuer === account.issuer) {
      // Their own list of websites (the switcher) carries the role: asked anew the next time.
      forgetAccountSites(user.id)
      void reportAccountMembership(event, account, { sub: link.sub, role: user.role, active: user.status === 'active' })
    }
  }
  catch (err) {
    console.error('[cms] could not report the membership to the account service', safeErrorMessage(err))
  }
}

// ── the link ───────────────────────────────────────────────────────────────────

export const accountLinkKey = (issuer: string, sub: string) => 'account:' + createHash('sha256').update(issuer + '\n' + sub).digest('hex')
export const accountOfKey = (userId: string) => 'account-of:' + userId

/** The account a user of this site is linked to, or null. */
export async function accountLinkOf(db: any, reg: CmsRegistry, userId: string): Promise<{ issuer: string; sub: string } | null> {
  const [row] = await db.select().from(reg.cmsState).where(eq(reg.cmsState.key, accountOfKey(userId)))
  const value = row?.value as { issuer?: unknown; sub?: unknown } | undefined
  return typeof value?.issuer === 'string' && typeof value.sub === 'string' ? { issuer: value.issuer, sub: value.sub } : null
}

/** Remove a user's link (both rows). Returns what it was, so the issuer can be told. */
export async function removeAccountLink(db: any, reg: CmsRegistry, userId: string): Promise<{ issuer: string; sub: string } | null> {
  const link = await accountLinkOf(db, reg, userId)
  const keys = [accountOfKey(userId), ...(link ? [accountLinkKey(link.issuer, link.sub)] : [])]
  await db.delete(reg.cmsState).where(inArray(reg.cmsState.key, keys))
  forgetAccountSites(userId)
  return link
}

class Refused extends Error {
  constructor(readonly reason: string) { super(reason) }
}

export type CmsAccountMatch =
  | { ok: true; user: any; linked: boolean; accepted: boolean }
  /** `reason` is for the audit log; the browser only learns "no access". */
  | { ok: false; reason: string; user?: any }

/**
 * The user of THIS site an account belongs to (2.15):
 *  1. the user linked to this issuer + sub;
 *  2. else, when the issuer says the e-mail is verified, the user with that e-mail: an
 *     active one is linked; an invited one is accepted (it becomes active with the account's
 *     name, without a password, and the invitation's link is used up) and linked. The proof
 *     is the verified e-mail, not the link: an invitation whose link ran out (7 days) is
 *     accepted all the same, as long as it was not taken back (the user is still `invited`;
 *     taking an invitation back removes the user);
 *  3. else nobody.
 * A disabled user is refused. A user already linked to ANOTHER account of the same issuer
 * is refused too: a link never moves by itself. A link left from another issuer (the site
 * was connected to another account service since) is replaced.
 */
export async function matchAccountUser(account: CmsAccountSettings, who: CmsAccountIdentity): Promise<CmsAccountMatch> {
  const { db, reg } = useCms()
  const u = reg.cmsUsers
  const s = reg.cmsState
  const key = accountLinkKey(account.issuer, who.sub)

  const [linkRow] = await db.select().from(s).where(eq(s.key, key))
  const linkedTo = (linkRow?.value as { userId?: unknown } | undefined)?.userId
  const linkedId = typeof linkedTo === 'string' ? linkedTo : null
  if (linkedId) {
    const [user] = await db.select().from(u).where(eq(u.id, linkedId))
    if (user) return user.status === 'active' ? { ok: true, user, linked: false, accepted: false } : { ok: false, reason: user.status === 'disabled' ? 'disabled' : 'not-active', user }
    // The user is gone and its link stayed behind (removed outside the admin): the link goes, the e-mail decides.
    await db.delete(s).where(inArray(s.key, [key, accountOfKey(linkedId)]))
  }

  if (!who.emailVerified || !who.email) return { ok: false, reason: who.email ? 'email-not-verified' : 'no-email' }
  const [found] = await db.select().from(u).where(eq(u.email, who.email))
  if (!found) return { ok: false, reason: 'no-user' }
  // The public demo account is everybody's: nobody's account takes it.
  if (isDemoAccount(found.email)) return { ok: false, reason: 'demo-account' }
  if (found.status === 'disabled') return { ok: false, reason: 'disabled', user: found }
  if (found.status !== 'active' && found.status !== 'invited') return { ok: false, reason: 'not-active', user: found }

  try {
    const user = await db.transaction(async (tx: any) => {
      const existing = await accountLinkOf(tx, reg, found.id)
      if (existing) {
        if (existing.issuer === account.issuer && existing.sub !== who.sub) throw new Refused('linked-to-another-account')
        // A link to another issuer, or half of this very link: cleared, then made anew below.
        await tx.delete(s).where(inArray(s.key, [accountOfKey(found.id), accountLinkKey(existing.issuer, existing.sub)]))
      }
      let user = found
      if (found.status === 'invited') {
        // As POST /api/cms/_auth/accept does, with the account's verified e-mail in place of the
        // link and the password. The link is used up, whether it still worked or had run out;
        // of two requests one turns the user from invited to active (the update below), the
        // other finds nobody invited.
        const t = reg.cmsTokens
        await tx.update(t).set({ usedAt: new Date() }).where(and(eq(t.userId, found.id), eq(t.kind, 'invite'), isNull(t.usedAt)))
        const theirs = (who.locale ?? '').toLowerCase().split('-')[0]!
        const locale = !found.locale && ACCOUNT_LOCALES.includes(theirs) ? theirs : found.locale
        const [accepted] = await tx.update(u)
          .set({ name: who.name || found.name, locale, status: 'active', updatedAt: new Date(), lastLoginAt: new Date() })
          .where(and(eq(u.id, found.id), eq(u.status, 'invited'))).returning()
        if (!accepted) throw new Refused('invitation-taken')
        user = accepted
      }
      const linkedAt = new Date().toISOString()
      const made = await tx.insert(s).values([
        { key, value: { userId: found.id, issuer: account.issuer, sub: who.sub, linkedAt } },
        { key: accountOfKey(found.id), value: { issuer: account.issuer, sub: who.sub } },
      ]).onConflictDoNothing().returning({ key: s.key })
      // Somebody else got one of the two rows in the meantime: nothing is linked.
      if (made.length !== 2) throw new Refused('linked-to-another-account')
      return user
    })
    forgetAccountSites(found.id)
    return { ok: true, user, linked: true, accepted: found.status === 'invited' }
  }
  catch (err) {
    if (err instanceof Refused) return { ok: false, reason: err.reason, user: found }
    throw err
  }
}

// ── the person's websites (the switcher) ───────────────────────────────────────

export interface CmsAccountSite {
  id: string
  name: string
  /** The website's address (an origin, or an origin with a path), without a trailing slash. */
  url: string
  /** The role the person has there, as that website last told the issuer; '' when it has not said yet (the issuer sends null). */
  role: string
  current: boolean
}

export interface CmsAccountSites {
  /** Is the signed-in person's user linked to an account of this site's issuer? */
  linked: boolean
  sites: CmsAccountSite[]
  /** Where "All my websites" leads (the issuer's page), or null. */
  account: string | null
}

const SITES_TTL_MS = 60_000
/** After the issuer did not answer: ask again this soon, not on every page. */
const SITES_RETRY_MS = 15_000
const MAX_SITES = 100
const sitesCache = cmsSiteScoped(() => new Map<string, { until: number; value: Promise<CmsAccountSites> }>())

/** Forget the cached list of a user (their link changed). */
export function forgetAccountSites(userId: string): void {
  sitesCache.peek()?.delete(userId)
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

function httpAddress(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2000) return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    return (url.origin + url.pathname).replace(TRAILING_SLASHES, '') + url.search
  }
  catch {
    return ''
  }
}

/**
 * The websites of the signed-in person, from the issuer (`POST /oauth/sites`), kept per
 * person for a minute in this site's memory. An issuer that does not answer gives an empty
 * list (kept for a few seconds), never an error: the switcher just stays the site's name.
 */
export function accountSitesOf(account: CmsAccountSettings, userId: string): Promise<CmsAccountSites> {
  const cache = sitesCache()
  const now = Date.now()
  const kept = cache.get(userId)
  if (kept && kept.until > now) return kept.value
  if (cache.size > 2000) for (const [key, entry] of cache) if (entry.until <= now) cache.delete(key)
  const entry = { until: now + SITES_TTL_MS, value: loadAccountSites(account, userId) }
  cache.set(userId, entry)
  // An answer that did not come is asked for again soon; a failure of ours is not kept at all.
  entry.value.then((result) => { if (result.linked && !result.account) entry.until = Date.now() + SITES_RETRY_MS }, () => { if (cache.get(userId) === entry) cache.delete(userId) })
  return entry.value
}

async function loadAccountSites(account: CmsAccountSettings, userId: string): Promise<CmsAccountSites> {
  const { db, reg } = useCms()
  const link = await accountLinkOf(db, reg, userId)
  if (!link || link.issuer !== account.issuer) return { linked: false, sites: [], account: null }
  const answer = await askIssuer(account, '/oauth/sites', { sub: link.sub }, { basic: true })
  if (!answer || !Array.isArray(answer.sites)) return { linked: true, sites: [], account: null }
  const sites: CmsAccountSite[] = []
  for (const raw of answer.sites.slice(0, MAX_SITES)) {
    const url = httpAddress(raw?.url)
    const name = text(raw?.name, 120)
    if (!url || !name) continue
    sites.push({ id: text(String(raw?.id ?? ''), 120), name, url, role: text(raw?.role, 120), current: raw?.current === true })
  }
  return { linked: true, sites, account: httpAddress(answer.account) || account.issuer + '/sites' }
}
