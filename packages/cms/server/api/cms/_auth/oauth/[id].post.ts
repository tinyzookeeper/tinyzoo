import { z } from 'zod'

// POST /api/cms/_auth/oauth/:id — approve (with the rights chosen, held to the role) or decline;
// answers where to send the browser: back to the program.
const input = z.object({
  approve: z.boolean(),
  name: z.string().trim().min(1).max(80).optional(),
  rights: tokenRightsSchema.optional(),
})

export default defineEventHandler(async (event) => {
  const user = requireTokenOwner(event)
  const data = parseOr422(input, await readBody(event))
  const id = getRouterParam(event, 'id') ?? ''
  try {
    if (!data.approve) return { redirectTo: await denyOAuthRequest(id) }
    const pending = await loadOAuthRequest(id)
    const rights = data.rights ?? { write: false, publish: false, delete: false, media: false, entities: null }
    return { redirectTo: await approveOAuthRequest({ requestId: id, user, name: data.name ?? pending?.clientName ?? 'An MCP client', rights }) }
  }
  catch (err) {
    if (isCmsOAuthFailure(err)) throw createError({ statusCode: err.oauth.status, statusMessage: err.oauth.description })
    throw err
  }
})
