import { eq, inArray, propOf } from '@my-cms/core'
import { z } from 'zod'

// POST /api/cms/:entity/_order { ids: [...] } — store a manual order (collections
// with `admin.list.orderField`): the entries get positions 0, 1, 2… in the order
// given, all or none, under the same rules as editing each of them. Only entries
// whose position changed count as changed (version, history, webhooks).
const body = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) })

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const key = e.admin?.list?.orderField
  if (!key || e.singleton) throw createError({ statusCode: 404, statusMessage: 'This collection has no manual order' })
  const rowFilter = authorize(e, 'update', user)
  const { ids } = parseOr422(body, await readBody(event))
  if (new Set(ids).size !== ids.length) throw createError({ statusCode: 422, statusMessage: 'Each entry may appear once' })
  const col = e.table[propOf(key, e.fields[key]!)]

  const before = new Map<string, any>()
  for (const id of ids) before.set(id, await changeSnapshot(e, id))
  const moved: any[] = await db.transaction(async (tx: any) => {
    const current: any[] = await tx.select({ id: e.table.id, pos: col }).from(e.table).where(inArray(e.table.id, ids)).for('update')
    if (current.length !== ids.length) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
    const posOf = new Map(current.map((r) => [r.id, r.pos]))
    const out: any[] = []
    for (const [i, id] of ids.entries()) {
      if (posOf.get(id) === i) continue
      const [row] = await tx.update(e.table)
        .set({ [propOf(key, e.fields[key]!)]: i, updatedAt: nextVersion(e.table.updatedAt), updatedBy: actorId(user) })
        .where(both(both(eq(e.table.id, id), rowFilter), notLiveCond(e, user))).returning()
      if (!row) throw createError({ statusCode: 403, statusMessage: 'You may not move some of these entries' })
      out.push(row)
    }
    return out
  }).catch((err: unknown) => rethrowDbError(err, e, 'write'))

  for (const row of moved) {
    await reportChange(event, { type: 'entry.updated', entity: e, id: row.id, before: before.get(row.id), after: row })
  }
  if (moved.length) await audit(event, 'entry.reorder', { entity: e.name, meta: { moved: moved.length } })
  return { moved: moved.length }
})
