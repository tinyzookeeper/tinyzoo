import { eq } from '@my-cms/core'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  if (e.singleton) throw createError({ statusCode: 404, statusMessage: 'Globals are not deletable' })
  const rowFilter = authorize(e, 'delete', user)
  const id = getIdParam(event)

  const deleted: any[] = await (db as any).delete(e.table).where(both(eq(e.table.id, id), rowFilter)).returning()
    .catch((err: unknown) => rethrowDbError(err, e, 'delete'))
  if (!deleted.length) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })

  // GC media the deleted row owned, once nothing else references it.
  const storage = useCmsStorage()
  for (const mediaId of mediaIdsOf(reg, e, deleted[0])) {
    await gcMediaIfOrphan(db, reg, storage, mediaId)
  }
  return { ok: true }
})
