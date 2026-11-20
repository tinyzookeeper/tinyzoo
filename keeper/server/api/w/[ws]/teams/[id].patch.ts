import { and, eq, inArray, ne } from 'drizzle-orm'
import { z } from 'zod'

// Change a team: its name (the address stays) and who is on it, by an owner, an admin or its
// lead; `isDefault: true` makes it the workspace's default team (owner or admin).
const input = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  isDefault: z.literal(true).optional(),
  people: z.array(z.object({ userId: z.string().uuid(), role: z.enum(['lead', 'member']) })).max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const { m } = await requireWorkspace(event)
  const team = await teamOf(m, getRouterParam(event, 'id') ?? '')
  if (!isManager(m) && !m.leadTeamIds.includes(team.id)) throw createError({ statusCode: 403, statusMessage: 'Only an owner, an admin or the team’s lead can change it' })
  const data = await readInput(event, input)
  if (data.isDefault && !isManager(m)) throw createError({ statusCode: 403, statusMessage: 'Only an owner or admin chooses the default team' })
  await useDb().transaction(async (tx) => {
    if (data.name !== undefined) await tx.update(schema.teams).set({ name: data.name }).where(eq(schema.teams.id, team.id)).catch(teamNameTaken)
    if (data.isDefault) {
      await tx.update(schema.teams).set({ isDefault: false }).where(and(eq(schema.teams.workspaceId, m.workspaceId), ne(schema.teams.id, team.id)))
      await tx.update(schema.teams).set({ isDefault: true }).where(eq(schema.teams.id, team.id))
    }
    if (data.people) {
      const ids = [...new Set(data.people.map((p) => p.userId))]
      if (ids.length) {
        const inWs = await tx.select({ userId: schema.workspaceMembers.userId }).from(schema.workspaceMembers)
          .where(and(eq(schema.workspaceMembers.workspaceId, m.workspaceId), inArray(schema.workspaceMembers.userId, ids)))
        if (inWs.length !== ids.length) throw createError({ statusCode: 422, statusMessage: 'people: everyone on a team must be in the workspace' })
      }
      await tx.delete(schema.teamMembers).where(eq(schema.teamMembers.teamId, team.id))
      if (data.people.length) await tx.insert(schema.teamMembers).values(data.people.map((p) => ({ teamId: team.id, userId: p.userId, role: p.role }))).onConflictDoNothing()
    }
  })
  return { ok: true }
})
