import { eq } from '@my-cms/core'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const rowFilter = authorize(e, 'delete', user)
  const id = getRouterParam(event, 'id')!

  const deleted = await db.delete(e.table).where(both(eq(e.table.id, id), rowFilter)).returning()
  if (!deleted.length) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  return { ok: true }
})
