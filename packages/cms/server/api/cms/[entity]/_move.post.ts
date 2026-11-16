import { eq, sortSiblings } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/:entity/_move { id, parent, index } — put a page of a tree under another
// page (or at the top: parent null) at a place among its new siblings (index 0 =
// first; past the end = last). One call for dragging and for the "Move…" dialog.
//
// Refused with a 422 naming the loop when the page would end up under itself, a 422
// when the tree would get deeper than allowed, a 409 when the address is taken. The
// page and everything below it get their new addresses at once; redirects from the old
// ones are written in the same transaction (defineRedirects), and the change report
// lists every address that moved. Siblings whose position changed count as changed
// (version, webhooks), like in a manual order.
const body = z.object({ id: z.string().uuid(), parent: z.string().uuid().nullable(), index: z.number().int().min(0).max(100_000).optional() })

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  if (!e.tree || e.singleton) throw createError({ statusCode: 404, statusMessage: 'This collection is not a tree' })
  const rowFilter = authorize(e, 'update', user)
  const { id, parent, index } = parseOr422(body, await readBody(event))
  const p = treeProps(e)

  const [current] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  assertPublishAllowed(e, user, {}, current)
  const seenBefore = await changeSnapshot(e, id)

  const result = await db.transaction(async (tx: any) => {
    const w = await beginTreeWrite(tx, reg, e, { id, parentId: parent, slug: String(current[p.slug] ?? ''), title: String(current[p.title] ?? '') })
    const wasLive = await liveAmong(tx, e, subtreeIds(w.nodes, id))
    // The new siblings in order, the page put in at `index`; positions renumbered 0…n-1.
    const siblings = sortSiblings(w.nodes.filter((n) => n.parentId === parent && n.id !== id)).map((n) => n.id)
    siblings.splice(Math.min(index ?? siblings.length, siblings.length), 0, id)
    const positions = new Map(w.nodes.map((n) => [n.id, n.position ?? 0]))
    const parentChanged = (current[p.parent] ?? null) !== parent
    const touched: any[] = []
    for (const [i, sid] of siblings.entries()) {
      if (sid !== id && positions.get(sid) === i) continue
      if (sid === id && !parentChanged && positions.get(sid) === i) continue
      const [row] = await tx.update(e.table)
        .set({ ...(sid === id ? { [p.parent]: parent } : {}), [p.order]: i, updatedAt: nextVersion(e.table.updatedAt), updatedBy: actorId(user) })
        .where(both(both(eq(e.table.id, sid), sid === id ? rowFilter : undefined), notLiveCond(e, user))).returning()
      if (!row) throw createError({ statusCode: 403, statusMessage: 'You may not move some of these entries' })
      touched.push(row)
    }
    const effect = await treeEffect(tx, reg, e, w.nodes, w.next, id, wasLive, actorId(user))
    return { touched, effect, parentChanged }
  }).catch((err: unknown) => rethrowDbError(err, e, 'write'))

  for (const row of result.touched) {
    const mine = row.id === id
    await reportChange(event, {
      type: 'entry.updated', entity: e, id: row.id, before: mine ? seenBefore : undefined, after: row,
      moved: mine ? result.effect.moved : undefined,
      // A new position is not an edit worth a revision; a new parent is.
      noRevision: !(mine && result.parentChanged),
    })
  }
  await reportTreeRedirects(event, reg, result.effect.redirects)
  if (result.touched.length) {
    await audit(event, 'entry.move', { entity: e.name, recordId: id, meta: { parent, moved: result.effect.moved.length, redirects: result.effect.redirects.length, siblings: result.touched.length - 1 } })
  }
  return { ok: true, moved: result.effect.moved, redirects: result.effect.redirects.length }
})
