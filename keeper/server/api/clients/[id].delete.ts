import { eq } from 'drizzle-orm'

// Remove a client (owner or admin). Its sites stay, without a client; people limited to it lose sight of them.
export default defineEventHandler(async (event) => {
  const me = await requireManager(event)
  const client = await clientOf(event, me.workspaceId)
  await useDb().delete(schema.clients).where(eq(schema.clients.id, client.id))
  return { ok: true }
})
