import { and, eq, sql } from 'drizzle-orm'

// Remove a person from the team (owner). Their sessions end; the owner cannot remove themselves.
export default defineEventHandler(async (event) => {
  const me = await requireOwner(event)
  const userId = getRouterParam(event, 'userId') ?? ''
  if (userId === me.userId) throw createError({ statusCode: 422, statusMessage: 'You cannot remove yourself' })
  const db = useDb()
  const removed = await db.delete(schema.memberships)
    .where(and(eq(schema.memberships.workspaceId, me.workspaceId), eq(schema.memberships.userId, userId))).returning()
  if (!removed.length) throw createError({ statusCode: 404, statusMessage: 'Not in the team' })
  await db.update(schema.users).set({ sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, userId))
  return { ok: true }
})
