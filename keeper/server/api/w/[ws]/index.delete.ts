import { eq, sql } from 'drizzle-orm'

// Delete an empty workspace (owner only): its teams, people and invitations go with it. One
// that still has sites is refused: move its teams or remove the sites first.
export default defineEventHandler(async (event) => {
  const { m } = await requireWorkspace(event)
  if (m.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only an owner can delete a workspace' })
  const db = useDb()
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.sites).where(eq(schema.sites.workspaceId, m.workspaceId))
  if (row?.n) {
    const what = row.n === 1 ? 'a site' : String(row.n) + ' sites'
    throw createError({ statusCode: 409, statusMessage: `${m.name} still has ${what}: move its teams to another workspace or remove the sites first` })
  }
  await db.delete(schema.workspaces).where(eq(schema.workspaces.id, m.workspaceId))
  return { ok: true }
})
