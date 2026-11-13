import { eq } from '@my-cms/core'

// DELETE /api/cms/_users/:id — remove someone's access entirely (also withdraws a
// pending invitation). Not yourself, and never the last active administrator.
// What they wrote stays; it just no longer points at an account.
export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsAdmin(event)
  const id = getIdParam(event)
  const { db, reg } = useCms()
  const [target] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, id))
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  if (id === me.id) throw createError({ statusCode: 409, statusMessage: 'You cannot remove yourself' })
  if (target.role === 'admin' && target.status === 'active') await assertAnotherActiveAdmin(db, reg, id)

  await db.delete(reg.cmsUsers).where(eq(reg.cmsUsers.id, id))
  await audit(event, 'user.delete', { recordId: id, meta: { email: target.email } })
  return { ok: true }
})
