import { and, eq, isNull } from 'drizzle-orm'

// Revoke one of my tokens or connections. It stops working at once.
export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'No such token' })
  const [row] = await useDb().update(schema.tokens).set({ revokedAt: new Date() })
    .where(and(eq(schema.tokens.id, id), eq(schema.tokens.createdBy, me.userId), isNull(schema.tokens.revokedAt)))
    .returning({ id: schema.tokens.id })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such token' })
  return { ok: true }
})
