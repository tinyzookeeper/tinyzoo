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
