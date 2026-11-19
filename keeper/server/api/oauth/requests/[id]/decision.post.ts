import { z } from 'zod'

// Approve or decline a request; answers where to send the browser (back to the program).
const input = z.object({
  approve: z.boolean(),
  name: z.string().trim().min(1).max(80).optional(),
  scope: z.enum(['read', 'write']).optional(),
})

export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  const data = await readInput(event, input)
  const id = getRouterParam(event, 'id') ?? ''
  try {
    if (!data.approve) return { redirectTo: await denyRequest(id) }
    const pending = await loadPendingRequest(id)
    const redirectTo = await approveRequest({ requestId: id, member: me, name: data.name ?? pending?.clientName ?? 'An MCP client', scope: canChangeSites(me) ? (data.scope ?? 'read') : 'read' })
    return { redirectTo }
  }
  catch (err) {
    if (isOAuthFailure(err)) throw createError({ statusCode: err.oauth.status, statusMessage: err.oauth.description })
    throw err
  }
})
