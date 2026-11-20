import { eq } from 'drizzle-orm'

// Take an invitation back (owner or admin): its link stops working.
export default defineEventHandler(async (event) => {
  const { m } = await requireWorkspace(event, { manager: true })
  const inv = await invitationOf(m, getRouterParam(event, 'id') ?? '')
  await useDb().delete(schema.workspaceInvitations).where(eq(schema.workspaceInvitations.id, inv.id))
  return { ok: true }
})
