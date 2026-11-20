import type { Invitation } from '#keeper/types/keeper'

// The team's open invitations (owner or admin).
export default defineEventHandler(async (event): Promise<Invitation[]> => listInvitations((await requireManager(event)).workspaceId))
