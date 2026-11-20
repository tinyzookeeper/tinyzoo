import { and, eq, inArray } from 'drizzle-orm'

// Remove someone from the workspace (owner or admin; only an owner removes an owner). They leave
// its teams too. Nobody removes themselves.
export default defineEventHandler(async (event) => {
  const { access, m } = await requireWorkspace(event, { manager: true })
  const userId = getRouterParam(event, 'userId') ?? ''
  if (userId === access.userId) throw createError({ statusCode: 422, statusMessage: 'You cannot remove yourself' })
  const db = useDb()
  await db.transaction(async (tx) => {
    const [target] = await tx.select({ role: schema.workspaceMembers.role }).from(schema.workspaceMembers)
      .where(and(eq(schema.workspaceMembers.workspaceId, m.workspaceId), eq(schema.workspaceMembers.userId, userId)))
    if (!target) throw createError({ statusCode: 404, statusMessage: 'Not in this workspace' })
    if (target.role === 'owner' && m.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only an owner can remove an owner' })
    await tx.delete(schema.workspaceMembers).where(and(eq(schema.workspaceMembers.workspaceId, m.workspaceId), eq(schema.workspaceMembers.userId, userId)))
    const teams = tx.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.workspaceId, m.workspaceId))
    await tx.delete(schema.teamMembers).where(and(eq(schema.teamMembers.userId, userId), inArray(schema.teamMembers.teamId, teams)))
  })
  return { ok: true }
})
