import { eq } from '@my-cms/core'

// GET /api/cms/_auth/invite/:token — what the accept page shows: who is invited and
// by whom. 410 when the link is no longer valid.
export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const { db, reg } = useCms()
  const found = await findToken(db, reg, getRouterParam(event, 'token') ?? '', 'invite')
  if (!found || found.user.status !== 'invited') {
    throw createError({ statusCode: 410, statusMessage: 'This invitation has expired or was already used' })
  }
  let inviter: string | null = null
  if (found.token.createdBy) {
    const [by] = await db.select({ name: reg.cmsUsers.name, email: reg.cmsUsers.email }).from(reg.cmsUsers).where(eq(reg.cmsUsers.id, found.token.createdBy))
    inviter = by ? (by.name || by.email) : null
  }
  return { email: found.user.email, name: found.user.name, role: found.user.role, inviter }
})
