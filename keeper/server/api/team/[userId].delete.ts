import { and, eq, sql } from 'drizzle-orm'

// Remove a person from the team (owner or admin; only an owner removes an owner). Their sessions end; nobody removes themselves.
export default defineEventHandler(async (event) => {
  const me = await requireManager(event)
  const userId = getRouterParam(event, 'userId') ?? ''
  if (userId === me.userId) throw createError({ statusCode: 422, statusMessage: 'You cannot remove yourself' })
  const db = useDb()
  const [target] = await db.select({ role: schema.memberships.role }).from(schema.memberships)
    .where(and(eq(schema.memberships.workspaceId, me.workspaceId), eq(schema.memberships.userId, userId)))
  if (target?.role === 'owner' && me.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only an owner can remove an owner' })
  const removed = await db.delete(schema.memberships)
    .where(and(eq(schema.memberships.workspaceId, me.workspaceId), eq(schema.memberships.userId, userId))).returning()
  if (!removed.length) throw createError({ statusCode: 404, statusMessage: 'Not in the team' })
  await db.update(schema.users).set({ sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, userId))
  return { ok: true }
})
