import type { Invitation } from '#keeper/types/keeper'

// The workspace's open invitations (owner or admin).
export default defineEventHandler(async (event): Promise<Invitation[]> => {
  const { m } = await requireWorkspace(event, { manager: true })
  return listInvitations(m.workspaceId)
})
