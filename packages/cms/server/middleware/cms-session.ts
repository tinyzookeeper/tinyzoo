import { eq } from '@my-cms/core'

// Built-in auth: turn the sealed session cookie into `event.context.cmsUser` for API
// requests. The account is re-read from the database every time, so a changed role,
// a disabled account or a password change (session version bump) takes effect on
// the very next request — a still-valid cookie is not enough.
export default defineEventHandler(async (event) => {
  if (cmsAuthMode() !== 'builtin') return
  if (!(event.path || '').startsWith('/api/')) return
  if (event.context.cmsUser) return

  const session: any = await getUserSession(event)
  const id = session?.user?.id
  if (!id) return

  const { db, reg } = useCms()
  const [u] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, id))
  if (!u || u.status !== 'active' || u.sessionVersion !== session?.cms?.sv) {
    await clearUserSession(event)
    return
  }
  event.context.cmsUser = { id: u.id, email: u.email, name: u.name || u.email, role: u.role, locale: u.locale }
})
