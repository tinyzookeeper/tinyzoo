import { eq } from '@my-cms/core'


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
