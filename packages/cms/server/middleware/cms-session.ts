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
  if (!(event.path || '').startsWith('/api/')) return
  if (event.context.cmsUser) return

  const session: any = await getUserSession(event)
  const u = await activeAccountOf(session)
  if (!u) {
    if (session?.cms) await clearUserSession(event)
    return
  }
  event.context.cmsUser = { id: u.id, email: u.email, name: u.name || u.email, role: u.role, locale: u.locale }
  // The version this request was authorised with; writes that re-sign the session
  // must not upgrade a session past a concurrent password change (see me.patch).
  event.context.cmsSessionVersion = u.sessionVersion
})
