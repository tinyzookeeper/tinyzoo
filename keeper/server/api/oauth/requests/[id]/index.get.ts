import { eq } from 'drizzle-orm'
import { redirectHostLabel } from '#keeper/oauth'

// What the consent page shows: who asks (a claim), where the answer goes (a fact), how much it
// asked for. For the person signed in; never cross-origin.
export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  const row = await loadPendingRequest(getRouterParam(event, 'id') ?? '')
  if (!row) throw createError({ statusCode: 410, statusMessage: 'This request is no longer open' })
  const [ws] = await useDb().select({ name: schema.workspaces.name }).from(schema.workspaces).where(eq(schema.workspaces.id, me.workspaceId))
  return { client: row.clientName, clientUri: row.clientUri, redirectHost: redirectHostLabel(row.redirectUri), scope: row.scope, workspace: ws?.name ?? '' }
})
