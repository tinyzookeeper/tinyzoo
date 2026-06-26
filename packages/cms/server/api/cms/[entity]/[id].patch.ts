import { eq } from '@my-cms/core'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const rowFilter = authorize(e, 'update', user)
  const id = getRouterParam(event, 'id')!
  const data = parseOr422(e.updateSchema, await readBody(event))
  const { values, m2m } = splitPayload(e, data)

  const row = await db.transaction(async (tx: any) => {
    let current: any
    if (Object.keys(values).length) {
      values.updatedAt = new Date()
      ;[current] = await tx.update(e.table).set(values).where(both(eq(e.table.id, id), rowFilter)).returning()
    } else {
      ;[current] = await tx.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
    }
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
    await writeM2M(tx, reg, e, id, m2m, true)
    return current
  })
  return { row }
})
