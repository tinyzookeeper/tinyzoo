// GET /api/cms/:entity/:id/revisions/:rev — one snapshot's values (to compare or
// restore in the editor). Anyone who may read the entry may see it.
import { and, eq } from '@my-cms/core'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const id = getIdParam(event)
  const rev = getIdParam(event, 'rev')
  const [row] = await db.select({ id: e.table.id }).from(e.table).where(both(eq(e.table.id, id), authorize(e, 'read', user)))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const r = reg.cmsRevisions
  const [found] = await db.select().from(r).where(and(eq(r.id, rev), eq(r.entity, e.name), eq(r.recordId, id)))
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return { revision: found }
})
