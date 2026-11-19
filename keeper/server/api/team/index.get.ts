import { eq } from 'drizzle-orm'
import type { Member } from '#shared/types/keeper'

export default defineEventHandler(async (event): Promise<Member[]> => {
  const me = await requireMember(event)
  const rows = await useDb().select({
    id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.memberships.role, lastLoginAt: schema.users.lastLoginAt,
  }).from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.workspaceId, me.workspaceId))
    .orderBy(schema.memberships.createdAt)
  return rows.map((r) => ({ ...r, lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null }))
})
