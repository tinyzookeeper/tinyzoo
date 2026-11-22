// Remove a team's own logo (an owner, an admin or its lead): it shows its sites' logo again.
export default defineEventHandler(async (event) => {
  const { m } = await requireWorkspace(event)
  const team = await teamOf(m, getRouterParam(event, 'id') ?? '')
  if (!isManager(m) && !m.leadTeamIds.includes(team.id)) throw createError({ statusCode: 403, statusMessage: 'Only an owner, an admin or the team’s lead can change it' })
  await setOwnLogo('team', team.id, null)
  return { ok: true }
})
