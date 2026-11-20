import { eq } from 'drizzle-orm'
import type { InviteOutcome } from '#keeper/types/keeper'

// Send an invitation again (owner or admin): a new link, valid for 7 more days. The old link stops working.
export default defineEventHandler(async (event): Promise<InviteOutcome> => {
  const me = await requireManager(event)
  const inv = await invitationOf(me, getRouterParam(event, 'id') ?? '')
  const { token, hash, expiresAt } = newInviteToken()
  const db = useDb()
  await db.update(schema.workspaceInvitations).set({ tokenHash: hash, expiresAt, invitedBy: me.userId, updatedAt: new Date() })
    .where(eq(schema.workspaceInvitations.id, inv.id))
  const [inviter] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, me.userId))
  return deliverInvitation(event, { email: inv.email, role: inv.role, token, expiresAt, workspaceId: me.workspaceId, inviterName: inviter?.name || null })
})
