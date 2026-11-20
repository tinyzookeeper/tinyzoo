import { z } from 'zod'
import type { NewAccessToken } from '#keeper/types/keeper'

// Make a token. Its value is answered once and never again (only its hash is kept). It acts as
// me in all my workspaces; where I am a guest it only reads, whatever its scope.
const input = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(80),
  scope: z.enum(['read', 'write']),
})

export default defineEventHandler(async (event): Promise<NewAccessToken> => {
  const me = await requireMember(event)
  const data = await readInput(event, input)
  if (data.scope === 'write' && me.memberships.every((m) => m.role === 'guest')) {
    throw createError({ statusCode: 403, statusMessage: 'You are a guest everywhere: a token of yours can only read.' })
  }
  const { token, hash, prefix } = generateToken()
  const [row] = await useDb().insert(schema.tokens).values({ createdBy: me.userId, name: data.name, scope: data.scope, hash, prefix }).returning()
  setResponseStatus(event, 201)
  setResponseHeader(event, 'cache-control', 'no-store')
  return { token: toAccessToken(row!), value: token }
})
