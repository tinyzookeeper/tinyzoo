import type { ClientList } from '#keeper/types/keeper'

export default defineEventHandler(async (event): Promise<ClientList> => {
  const me = await requireAccess(event)
  return { clients: await listClients(me), canCreate: seesAllClients(me) && canChangeSites(me) }
})
