// Built-in auth: turn the sealed session cookie into `event.context.cmsUser` for API
// requests. The account is re-read from the database every time, so a changed role,
// a disabled account or a password change (session version bump) takes effect on
// the very next request — a still-valid cookie is not enough.
//
// The CMS identity lives under its own key (session.cms.uid), so a host app that
// also signs people in with nuxt-auth-utils (site members, OAuth ids…) never trips
// over it: a session without a CMS identity is simply not a CMS user.

export default defineEventHandler(async (event) => {
  if (cmsAuthMode() !== 'builtin') return
  const path = event.path || ''
  const page = path === '/admin' || path.startsWith('/admin/') || path.startsWith('/admin?')
  if (!path.startsWith('/api/') && !page) return
  if (event.context.cmsUser) return

  // A tool of the MCP server (/api/mcp) calling an admin route inside this process, with a
  // personal access token (cmsAccessTokens.ts). Such a request never opens a session, and a
  // header that is not this process's own makes it anonymous.
  const mcp = getRequestHeader(event, MCP_INTERNAL_HEADER)
  if (mcp) {
    const user = mcpRouteAllowed(path) ? await mcpInternalUser(mcp) : null
    if (user) event.context.cmsUser = user
    return
  }

  // No session cookie: nobody to look up. Reading the session anyway would create one and
  // put a cookie on the response of every anonymous visitor (public content, pages, media).
  if (!hasSessionCookie(event)) {
    // nuxt-auth-utils' own route, which the website's server rendering calls on every page:
    // an anonymous answer without opening a session either.
    if (path.split('?')[0] === '/api/_auth/session' && event.method === 'GET') return {}
    return
  }

  const session: any = await getUserSession(event)
  // An admin page with no CMS identity in the cookie: nothing to check.
  if (page && !session?.cms) return
  const u = await activeAccountOf(session)
  if (!u) {
    // The cookie no longer opens the admin (role or password changed, account
    // disabled): drop it on this very response — for an admin page too, so the
    // browser lands on sign-in instead of bouncing between sign-in and the admin.
    if (session?.cms) await clearUserSession(event)
    return
  }
  event.context.cmsUser = { id: u.id, email: u.email, name: u.name || u.email, role: u.role, locale: u.locale }
  // The version this request was authorised with; writes that re-sign the session
  // must not upgrade a session past a concurrent password change (see me.patch).
  event.context.cmsSessionVersion = u.sessionVersion
  // When this browser signed in: a session written again keeps it (continueCmsSession).
  event.context.cmsSignedInAt = session.cms.iat
})
