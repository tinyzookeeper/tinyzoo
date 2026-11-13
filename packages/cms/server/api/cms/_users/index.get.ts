import { and, asc, desc, eq, gt, isNull } from '@my-cms/core'

// GET /api/cms/_users — everyone with access to the admin, for the Team page.
// Invited people carry when their invitation expires. Administrators only.
export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  requireCmsAdmin(event)
  const { db, reg } = useCms()
  const u = reg.cmsUsers
  const users = await db.select({
    id: u.id, email: u.email, name: u.name, role: u.role, status: u.status,
    lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
  }).from(u).orderBy(asc(u.status), asc(u.name), asc(u.email))

  const t = reg.cmsTokens
  const invites = await db.select({ userId: t.userId, expiresAt: t.expiresAt, createdAt: t.createdAt }).from(t)
    .where(and(eq(t.kind, 'invite'), isNull(t.usedAt), gt(t.expiresAt, new Date())))
    .orderBy(desc(t.createdAt))
  const inviteOf = new Map<string, any>()
  for (const i of invites) if (!inviteOf.has(i.userId)) inviteOf.set(i.userId, i)

  return {
    users: users.map((x: any) => ({
      ...x,
      invite: x.status === 'invited' ? (inviteOf.get(x.id) ? { sentAt: inviteOf.get(x.id).createdAt, expiresAt: inviteOf.get(x.id).expiresAt } : { expired: true }) : null,
    })),
  }
})
