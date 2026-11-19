import { and, eq, ne, sql } from 'drizzle-orm'
import type { Member } from '#keeper/types/keeper'

// Change a person's role or the clients they see (owner or admin). Not your own: nobody
// locks themselves out. A changed role signs them out, so their next sign-in shows it.
export default defineEventHandler(async (event): Promise<Member> => {
  const me = await requireManager(event)
  const userId = getRouterParam(event, 'userId') ?? ''
  if (userId === me.userId) throw createError({ statusCode: 422, statusMessage: 'Ask someone else to change your own access' })
  const data = await readInput(event, accessInput)
  const db = useDb()
  await db.transaction(async (tx) => {
    const [target] = await tx.select({ role: schema.memberships.role }).from(schema.memberships)
      .where(and(eq(schema.memberships.workspaceId, me.workspaceId), eq(schema.memberships.userId, userId)))
      .for('update')
    if (!target) throw createError({ statusCode: 404, statusMessage: 'Not in the team' })
    assertMayAssign(me, target.role, data.role)
    if (target.role === 'owner' && data.role !== 'owner') {
      const [others] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.memberships)
        .where(and(eq(schema.memberships.workspaceId, me.workspaceId), eq(schema.memberships.role, 'owner'), ne(schema.memberships.userId, userId)))
      if (!others?.n) throw createError({ statusCode: 422, statusMessage: 'The team needs at least one owner' })
    }
    await setMemberClients(tx, me.workspaceId, userId, data)
    if (target.role !== data.role) {
      await tx.update(schema.users).set({ sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, userId))
    }
  })
  return (await listTeam(me)).find((m) => m.id === userId)!
})
