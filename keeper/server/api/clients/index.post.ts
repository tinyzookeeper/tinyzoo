import type { Client } from '#keeper/types/keeper'

// Add a client (owner or admin).
export default defineEventHandler(async (event): Promise<Client> => {
  const me = await requireManager(event)
  const data = await readInput(event, clientInput)
  const [row] = await useDb().insert(schema.clients)
    .values({ workspaceId: me.workspaceId, name: data.name, alertEmails: data.alertEmails ?? [] })
    .returning().catch(nameTaken)
  setResponseStatus(event, 201)
  return { id: row!.id, name: row!.name, alertEmails: row!.alertEmails, sites: 0 }
})
