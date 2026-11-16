import { eq } from 'tinyzoo'


export interface CmsUser {
  id: string
  email?: string
  name?: string
  /** 'admin' | 'editor' | 'author' with built-in auth; anything with external auth. */
  role: string
  locale?: string | null
}

/**
 * Current user on `event.context.cmsUser`. With built-in auth the CMS's own
 * middleware (server/middleware/cms-session.ts) sets it from the session after
 * checking the account in the database; with `cms.auth.mode: 'external'` the host does.
 */
/** The name of the session cookie (nuxt-auth-utils: `nuxt-session`, or `runtimeConfig.session.name`). */
export function sessionCookieName(): string {
  return String((useRuntimeConfig().session as any)?.name || 'nuxt-session')
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

export function requireCmsUser(event: any): CmsUser {
  const user = getCmsSession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  return user
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The account a sealed session belongs to, if it may still be used: it exists, is
 * active, and the session was issued for its current session version (a password
 * change or "sign out everywhere" bumps it). Null otherwise.
 */
export async function activeAccountOf(session: any): Promise<any | null> {
  const id = session?.cms?.uid
  if (typeof id !== 'string' || !UUID.test(id)) return null
  const { db, reg } = useCms()
  const [u] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, id))
  if (!u || u.status !== 'active' || u.sessionVersion !== session?.cms?.sv) return null
  return u
}

/**
 * Admit a WebSocket upgrade for the admin (realtime, shared editing): it must come
 * from this site's own pages and carry a valid built-in session for an active
 * account. Puts the account on `request.context` (cmsUser, cmsSessionVersion), which
 * the socket's peer then carries. Throws a Response to refuse.
 */
export async function admitAdminSocket(request: any): Promise<void> {
  if (cmsAuthMode() !== 'builtin') throw new Response('Needs the built-in sign-in', { status: 404 })
  if (!sameOrigin(request)) throw new Response('Forbidden', { status: 403 })
  const session: any = hasSessionCookie(request) ? await getUserSession(request).catch(() => null) : null
  const u = await activeAccountOf(session)
  if (!u) throw new Response('Unauthorized', { status: 401 })
  request.context.cmsUser = { id: u.id, email: u.email, name: u.name || u.email, role: u.role, locale: u.locale }
  request.context.cmsSessionVersion = u.sessionVersion
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
