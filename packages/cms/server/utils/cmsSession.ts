export interface CmsUser {
  id: string
  email?: string
  name?: string
  role: string
}

/** Current user, set by the host's session middleware on `event.context.cmsUser`. */
export function getCmsSession(event: any): CmsUser | null {
  return (event.context?.cmsUser as CmsUser) ?? null
}

export function requireCmsUser(event: any): CmsUser {
  const user = getCmsSession(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  return user
}
