import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Member } from '#keeper/types/keeper'

// Change someone's role or teams (owner or admin). Not your own: nobody locks themselves out.
const input = z.object({
  role: z.enum(['owner', 'admin', 'member', 'guest']).optional(),
  teamIds: z.array(z.string().uuid()).max(500).optional(),
})

export default defineEventHandler(async (event): Promise<Member> => {
  const { access, m } = await requireWorkspace(event, { manager: true })
  const userId = getRouterParam(event, 'userId') ?? ''
  const data = await readInput(event, input)
  if (userId === access.userId && data.role !== undefined) throw createError({ statusCode: 422, statusMessage: 'Ask someone else to change your own role' })
  await useDb().transaction(async (tx) => {
    const [target] = await tx.select({ role: schema.workspaceMembers.role }).from(schema.workspaceMembers)
      .where(and(eq(schema.workspaceMembers.workspaceId, m.workspaceId), eq(schema.workspaceMembers.userId, userId)))
      .for('update')
    if (!target) throw createError({ statusCode: 404, statusMessage: 'Not in this workspace' })
    if (data.role !== undefined && data.role !== target.role) {
      assertMayAssign(m, target.role, data.role)
      if (target.role === 'owner') {
        const [others] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.workspaceMembers)
          .where(and(eq(schema.workspaceMembers.workspaceId, m.workspaceId), eq(schema.workspaceMembers.role, 'owner'), ne(schema.workspaceMembers.userId, userId)))
        if (!others?.n) throw createError({ statusCode: 422, statusMessage: 'The workspace needs at least one owner' })
      }
      await tx.update(schema.workspaceMembers).set({ role: data.role })
        .where(and(eq(schema.workspaceMembers.workspaceId, m.workspaceId), eq(schema.workspaceMembers.userId, userId)))
    }
    else if (target.role === 'owner') assertMayAssign(m, 'owner', 'owner')
    if (data.teamIds !== undefined) await setMemberTeams(tx, m.workspaceId, userId, data.teamIds)
  })
  return (await listMembers(m.workspaceId)).find((x) => x.id === userId)!
})
