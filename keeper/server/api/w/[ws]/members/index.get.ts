import type { Member } from '#keeper/types/keeper'

// The people of the workspace, with their roles and teams: for owners and admins, and for team
// leads (who choose who is on their team).
export default defineEventHandler(async (event): Promise<Member[]> => {
  const { m } = await requireWorkspace(event)
  if (!isManager(m) && !m.leadTeamIds.length) throw createError({ statusCode: 403, statusMessage: 'Only an owner, an admin or a team lead can see this' })
  return listMembers(m.workspaceId)
})
