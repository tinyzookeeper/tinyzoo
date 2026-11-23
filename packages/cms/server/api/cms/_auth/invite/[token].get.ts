import { eq } from 'tinyzoo'

// GET /api/cms/_auth/invite/:token — what the accept page shows: who is invited and
// by whom, and whether signing in with the tinyzoo account accepts it too. 410 when the link is no longer valid.
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
  // A role the site defined carries its own name, in the admin's languages.
  return {
    email: found.user.email, name: found.user.name, role: found.user.role, ...(roleOf(found.user)?.label ? { roleLabel: roleOf(found.user)!.label } : {}), inviter,
    // The invitation can also be accepted by signing in with the tinyzoo account of this address.
    ...(cmsAccount() ? { account: { enabled: true } } : {}),
  }
})
