import { and, eq, isNull } from 'tinyzoo'

// DELETE /api/cms/_auth/tokens/:id — revoke one of your access tokens. It stops working at once.
export default defineEventHandler(async (event) => {
  const user = requireTokenOwner(event)
  const id = getIdParam(event)
  const { db, reg } = useCms()
  const t = reg.cmsAccessTokens
  const [row] = await db.update(t).set({ revokedAt: new Date() })
    .where(and(eq(t.id, id), eq(t.userId, user.id), isNull(t.revokedAt))).returning({ id: t.id, name: t.name })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  await audit(event, 'token.revoke', { recordId: row.id, meta: { name: row.name } })
  return { ok: true }
})
