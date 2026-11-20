import { redirectHostLabel } from '#keeper/oauth'

// What the consent page shows: who asks (a claim), where the answer goes (a fact), how much it
// asked for. For the person signed in; never cross-origin.
export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  const row = await loadPendingRequest(getRouterParam(event, 'id') ?? '')
  if (!row) throw createError({ statusCode: 410, statusMessage: 'This request is no longer open' })
  // A connection acts as me in every workspace I am in.
  const names = me.memberships.map((m) => m.name)
  return { client: row.clientName, clientUri: row.clientUri, redirectHost: redirectHostLabel(row.redirectUri), scope: row.scope, workspaces: names, canWrite: me.memberships.some((m) => m.role !== 'guest') }
})
