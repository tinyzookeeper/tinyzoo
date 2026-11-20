import { eq, sql } from 'drizzle-orm'

// Delete a team (owner or admin): not the default one, and not while it has sites.
export default defineEventHandler(async (event) => {
  const { m } = await requireWorkspace(event, { manager: true })
  const team = await teamOf(m, getRouterParam(event, 'id') ?? '')
  if (team.isDefault) throw createError({ statusCode: 422, statusMessage: 'The default team stays: make another team the default first' })
  const db = useDb()
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.sites).where(eq(schema.sites.teamId, team.id))
  if (row?.n) throw createError({ statusCode: 409, statusMessage: `${team.name} still has sites: move them to another team first` })
  await db.delete(schema.teams).where(eq(schema.teams.id, team.id))
  return { ok: true }
})
