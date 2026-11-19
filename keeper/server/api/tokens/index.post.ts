import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { NewAccessToken } from '#keeper/types/keeper'

// Make a token. Its value is answered once and never again (only its hash is kept).
const input = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(80),
  scope: z.enum(['read', 'write']),
})

export default defineEventHandler(async (event): Promise<NewAccessToken> => {
  const me = await requireMember(event)
  const data = await readInput(event, input)
  const { token, hash, prefix } = generateToken()
  const [row] = await useDb().insert(schema.tokens).values({
    workspaceId: me.workspaceId, createdBy: me.userId, name: data.name, scope: data.scope, hash, prefix,
  }).returning()
  const [user] = await useDb().select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, me.userId))
  setResponseStatus(event, 201)
  setResponseHeader(event, 'cache-control', 'no-store')
  return {
    token: toAccessToken({ ...row!, userId: me.userId, userName: user?.name ?? null, userEmail: user?.email ?? null }, me),
    value: token,
  }
})
