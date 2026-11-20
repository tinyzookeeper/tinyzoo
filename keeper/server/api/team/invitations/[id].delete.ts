import { eq } from 'drizzle-orm'

// Take an invitation back (owner or admin): its link stops working.
export default defineEventHandler(async (event) => {
  const me = await requireManager(event)
  const inv = await invitationOf(me, getRouterParam(event, 'id') ?? '')
  await useDb().delete(schema.workspaceInvitations).where(eq(schema.workspaceInvitations.id, inv.id))
  return { ok: true }
})
