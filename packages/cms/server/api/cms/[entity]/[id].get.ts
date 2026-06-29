import { eq } from '@my-cms/core'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const rowFilter = authorize(e, 'read', user)
  const id = getRouterParam(event, 'id')!

  const [row] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  await hydrateRowForForm(db, reg, e, row)
  return { row }
})
