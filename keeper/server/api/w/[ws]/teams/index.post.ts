// A new team (owner or admin). Whoever makes it leads it.
export default defineEventHandler(async (event) => {
  const { access, m } = await requireWorkspace(event, { manager: true })
  const { name } = await readInput(event, teamInput)
  const db = useDb()
  const team = await db.transaction(async (tx) => {
    const slug = await uniqueTeamSlug(tx, m.workspaceId, name)
    const [row] = await tx.insert(schema.teams).values({ workspaceId: m.workspaceId, name, slug }).returning().catch(teamNameTaken)
    await tx.insert(schema.teamMembers).values({ teamId: row!.id, userId: access.userId, role: 'lead' })
    return row!
  })
  setResponseStatus(event, 201)
  return { id: team.id, slug: team.slug, name: team.name }
})
