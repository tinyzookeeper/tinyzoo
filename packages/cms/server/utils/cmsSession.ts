import { eq } from 'tinyzoo'


export interface CmsUser {
  id: string
  email?: string
  name?: string
  /** 'admin' | 'editor' | 'author' with built-in auth; anything with external auth. */
  role: string
  locale?: string | null
  /** Set when the request was made with a personal access token (the MCP server): what the token may do. */
  token?: CmsTokenGrant
}

/**
 * Current user on `event.context.cmsUser`. With built-in auth the CMS's own
 * middleware (server/middleware/cms-session.ts) sets it from the session after
 * checking the account in the database; with `cms.auth.mode: 'external'` the host does.
 */
/**
 * The name of the session cookie: nuxt-auth-utils' `nuxt-auth-session`, or
 * `runtimeConfig.session.name` (NUXT_SESSION_NAME). nuxt-auth-utils refuses
 * `nuxt-session` (the cookie of Nuxt's own `useSession()`) and uses its default instead.
 */
export function sessionCookieName(): string {
  const name = String((useRuntimeConfig().session as any)?.name || 'nuxt-auth-session')
  return name === 'nuxt-session' ? 'nuxt-auth-session' : name
}

/**
 * Does the request carry a session cookie at all? Reading a session when it does not
 * *creates* one and sets its cookie on the response — so every anonymous visitor got a
 * cookie (and a CDN refused to cache the page). Only look at the session when there is
 * one to look at.
 */
export function hasSessionCookie(event: any): boolean {
  const name = sessionCookieName()
  const header = event?.node?.req?.headers?.cookie ?? event?.headers?.get?.('cookie')
  return typeof header === 'string' && header.split(';').some((c) => c.trim().startsWith(name + '='))
}

export function getCmsSession(event: any): CmsUser | null {
  return (event.context?.cmsUser as CmsUser) ?? null
}

/** Signed in (any account that may still be used), whatever its role: for the account's own pages and signing out. */
export function requireCmsAccount(event: any): CmsUser {
  const user = getCmsSession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  return user
}

/**
 * Signed in, with a role this site knows. An account whose role was removed from the config
 * signs in but may do nothing: 403 `role-removed`, which the admin answers with "your role no
 * longer exists, ask an administrator". The account's own pages (password, email, language)
 * use `requireCmsAccount` and keep working.
 */
export function requireCmsUser(event: any): CmsUser {
  const user = requireCmsAccount(event)
  if (!roleOf(user)) throw roleRemoved(user)
  return user
}

export function roleRemoved(user: CmsUser) {
  return createError({
    statusCode: 403,
    statusMessage: 'Your role no longer exists; ask an administrator to give you another',
    data: { code: 'role-removed', role: String(user.role) },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Was the session signed in less than `runtimeConfig.session.maxAge` ago (NUXT_SESSION_MAX_AGE,
 * seconds; 14 days by default)? From `cms.iat`, the time of the sign-in that a session written
 * again keeps (cmsAuth.ts, startCmsSession). A session without it was not made by this version:
 * not in time. Without a maxAge only that is checked.
 */
export function signedInRecently(session: any, now = Date.now()): boolean {
  const iat = session?.cms?.iat
  if (typeof iat !== 'number' || !Number.isFinite(iat) || iat > now + 60_000) return false
  const maxAge = Number((useRuntimeConfig().session as any)?.maxAge)
  return !(maxAge > 0) || now - iat < maxAge * 1000
}

/**
 * The account a sealed session belongs to, if it may still be used: signed in less than
 * `maxAge` ago (signedInRecently), and the account exists, is active, and the session was
 * issued for its current session version (a password change or "sign out everywhere"
 * bumps it). Null otherwise.
 */
export async function activeAccountOf(session: any): Promise<any | null> {
  // Multi-tenant mode: a session opens the site it was made on and no other, even when the
  // other site's database holds the same account id (sites copied from one template do).
  if (cmsIsMultiTenant() && session?.cms?.site !== useSite().id) return null
  return activeAccount(session?.cms?.uid, session?.cms?.sv, session?.cms?.iat)
}

/**
 * The account, if the session it was admitted with was signed in at `iat` less than
 * `maxAge` ago, and the account is active and still at session version `sv`: for a socket
 * admitted earlier with a session (activeAccountOf), checked again while it stays open, so
 * an open socket ends with its session too instead of outliving the 14 days.
 */
export async function activeAccount(id: unknown, sv: unknown, iat: unknown): Promise<any | null> {
  if (!signedInRecently({ cms: { iat } })) return null
  if (typeof id !== 'string' || !UUID.test(id)) return null
  const { db, reg } = useCms()
  const [u] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, id))
  if (!u || u.status !== 'active' || u.sessionVersion !== sv) return null
  return u
}

/**
 * Admit a WebSocket upgrade for the admin (realtime, shared editing): it must come
 * from this site's own pages and carry a valid built-in session for an active
 * account. Puts the account on `request.context` (cmsUser, cmsSessionVersion and
 * cmsSignedInAt, the session's sign-in time), which the socket's peer then carries.
 * Throws a Response to refuse.
 */
export async function admitAdminSocket(request: any): Promise<void> {
  if (cmsAuthMode() !== 'builtin') throw new Response('Needs the built-in sign-in', { status: 404 })
  if (!sameOrigin(request)) throw new Response('Forbidden', { status: 403 })
  // Only read: in a WebSocket handler nuxt-auth-utils cannot write the session (there is no
  // response to carry the cookie), so a stale cookie is refused here, not cleared.
  const session: any = hasSessionCookie(request) ? await getUserSession(request).catch(() => null) : null
  const u = await activeAccountOf(session)
  if (!u) throw new Response('Unauthorized', { status: 401 })
  request.context.cmsUser = { id: u.id, email: u.email, name: u.name || u.email, role: u.role, locale: u.locale }
  // The sockets carry content: a role the site does not know has none of it.
  if (!roleOf(request.context.cmsUser)) throw new Response('Forbidden', { status: 403 })
  request.context.cmsSessionVersion = u.sessionVersion
  request.context.cmsSignedInAt = session.cms.iat
}

/**
 * Browsers always send Origin on a WebSocket handshake, and cookies go with it even
 * from other sites, so the origin must be this host (as the browser addressed it,
 * or the configured public address).
 */
function sameOrigin(request: any): boolean {
  const origin = request.headers?.get?.('origin')
  if (!origin) return false
  let host: string
  try {
    host = new URL(origin).host
  }
  catch {
    return false
  }
  // Multi-tenant mode: the origin must be one of this site's own hosts (the directory's), nothing a header says.
  if (cmsIsMultiTenant()) return useSite().hosts.includes(cmsNormalHost(host))
  const allowed = new Set<string>()
  for (const h of [request.headers.get('host'), request.headers.get('x-forwarded-host')]) if (h) allowed.add(String(h).split(',')[0]!.trim())
  const pub = (useRuntimeConfig().cms as any)?.publicUrl
  if (pub) {
    try {
      allowed.add(new URL(pub).host)
    }
    catch { /* not a URL */ }
  }
  return allowed.has(host)
}
