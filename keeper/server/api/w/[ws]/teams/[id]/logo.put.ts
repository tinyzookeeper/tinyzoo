// Upload a team's logo (an owner, an admin or its lead): a multipart form with `file`, at most
// 512 KB. Without one, the team shows its sites' logo (logos.ts).
export default defineEventHandler(async (event) => {
  const { m } = await requireWorkspace(event)
  const team = await teamOf(m, getRouterParam(event, 'id') ?? '')
  if (!isManager(m) && !m.leadTeamIds.includes(team.id)) throw createError({ statusCode: 403, statusMessage: 'Only an owner, an admin or the team’s lead can change it' })
  await setOwnLogo('team', team.id, await readLogoUpload(event))
  return { ok: true }
})
