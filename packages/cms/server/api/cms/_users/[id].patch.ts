import { CMS_ROLES, eq, sql } from '@my-cms/core'
import { z } from 'zod'

// PATCH /api/cms/_users/:id — change someone's role, or disable / re-enable them.
// You cannot change your own role or disable yourself, and the last active
// administrator always stays. Disabling signs the person out everywhere at once.
const body = z.object({
  role: z.enum(CMS_ROLES).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsAdmin(event)
  const id = getIdParam(event)
  const data = parseOr422(body, await readBody(event))
  const { db, reg } = useCms()
  const [target] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, id))
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  if (id === me.id) throw createError({ statusCode: 409, statusMessage: 'You cannot change your own role or access' })
  if (data.status === 'active' && target.status === 'invited') {
    throw createError({ statusCode: 409, statusMessage: 'This person has not accepted the invitation yet' })
  }

  const losesAdmin = target.role === 'admin' && target.status === 'active'
    && ((data.role && data.role !== 'admin') || data.status === 'disabled')
  if (losesAdmin) await assertAnotherActiveAdmin(db, reg, id)

  const set: Record<string, unknown> = { ...data, updatedAt: new Date() }
  if (data.status === 'disabled' || (data.role && data.role !== target.role)) {
    set.sessionVersion = sql`${reg.cmsUsers.sessionVersion} + 1`
  }
  const [updated] = await db.update(reg.cmsUsers).set(set).where(eq(reg.cmsUsers.id, id)).returning()
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  if (data.role && data.role !== target.role) await audit(event, 'user.role', { recordId: id, meta: { from: target.role, to: data.role } })
  if (data.status && data.status !== target.status) await audit(event, data.status === 'disabled' ? 'user.disable' : 'user.enable', { recordId: id })
  return { user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, status: updated.status } }
})
