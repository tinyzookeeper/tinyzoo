import { eq } from 'drizzle-orm'

// Rename a client or change who hears about its sites (owner or admin).
export default defineEventHandler(async (event) => {
  const me = await requireManager(event)
  const client = await clientOf(event, me.workspaceId)
  const data = await readInput(event, clientInput.partial())
  await useDb().update(schema.clients).set({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.alertEmails !== undefined ? { alertEmails: data.alertEmails } : {}),
  }).where(eq(schema.clients.id, client.id)).catch(nameTaken)
  return { ok: true }
})
