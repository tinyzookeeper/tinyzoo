import { and, eq, isNull } from 'drizzle-orm'

// Revoke a token: your own, or any as an owner. It stops working at once.
export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'No such token' })
  const db = useDb()
  const [row] = await db.select({ createdBy: schema.tokens.createdBy }).from(schema.tokens)
    .where(and(eq(schema.tokens.id, id), eq(schema.tokens.workspaceId, me.workspaceId), isNull(schema.tokens.revokedAt)))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such token' })
  if (me.role !== 'owner' && row.createdBy !== me.userId) throw createError({ statusCode: 403, statusMessage: 'Only its maker or an owner can revoke it' })
  await db.update(schema.tokens).set({ revokedAt: new Date() }).where(eq(schema.tokens.id, id))
  return { ok: true }
})
