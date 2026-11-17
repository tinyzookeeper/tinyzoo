import { eq, placeAmong, sortSiblings, type TreeNode } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/:entity/_move { id, parent, index } — put a page of a tree under another
// page (or at the top: parent null) at a place among its new siblings (index 0 =
// first; past the end = last). One call for dragging and for the "Move…" dialog.
//
// Refused with a 422 naming the loop when the page would end up under itself, a 422
// when the tree would get deeper than allowed, a 409 when the address is taken. The
// page and everything below it get their new addresses at once; redirects from the old
// ones are written in the same transaction (defineRedirects), and the change report
// lists every address that moved.
//
// Positions are sparse (1024 apart), so a page put between two others gets a number
// between theirs and only that page is written: a move never touches the siblings, which
// may be other people's pages. Only when two neighbours have no number between them are
// all the siblings renumbered, and then as a bookkeeping change of the order alone: their
// version, author and saved versions stay as they were (an editor with such a page open
// is not told it changed).
const body = z.object({ id: z.string().uuid(), parent: z.string().uuid().nullable(), index: z.number().int().min(0).max(100_000).optional() })

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  if (!e.tree || e.singleton) throw createError({ statusCode: 404, statusMessage: 'This collection is not a tree' })
  const rowFilter = authorize(e, 'update', user)
  const { id, parent, index } = parseOr422(body, await readBody(event))
  const p = treeProps(e)
  // Where a page sits and its position are fields: moving writes both.
  assertFieldsEditable(e, user, [e.tree.parent, e.tree.order])

  const [current] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  assertPublishAllowed(e, user, {}, current)
  const seenBefore = await changeSnapshot(e, id)

  const result = await db.transaction(async (tx: any) => {
    // Everything the request does not say (the address part) comes from the tree as it is under the lock.
    let before: TreeNode | undefined
    const w = await beginTreeWrite(tx, reg, e, (nodes) => {
      before = nodes.find((n) => n.id === id)
      if (!before) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
      return { id, parentId: parent, slug: before.slug, title: before.title }
    }, user)
    const was = before!
    const wasLive = await liveAmong(tx, e, subtreeIds(w.nodes, id))
    const parentChanged = (was.parentId ?? null) !== parent
    // The new siblings in order; the page goes in at `index` (its old number stays if it fits there).
    const siblings = sortSiblings(w.nodes.filter((n) => n.parentId === parent && n.id !== id))
    const place = placeAmong(siblings, id, index, was.position ?? 0)
    let touched: any = null
    if (parentChanged || place.position !== (was.position ?? 0)) {
      ;[touched] = await tx.update(e.table)
        .set({ [p.parent]: parent, [p.order]: place.position, updatedAt: nextVersion(e.table.updatedAt), updatedBy: actorId(user) })
        .where(both(both(eq(e.table.id, id), rowFilter), notLiveCond(e, user))).returning()
      if (!touched) throw createError({ statusCode: 403, statusMessage: 'You may not move this entry' })
    }
    // No room between two neighbours: the order of the siblings is written down again, nothing else about them.
    const positions = new Map(w.nodes.map((n) => [n.id, n.position ?? 0]))
    let renumbered = 0
    for (const [sid, position] of place.renumbered) {
      if (sid === id || positions.get(sid) === position) continue
      await tx.update(e.table).set({ [p.order]: position }).where(eq(e.table.id, sid))
      renumbered++
    }
    const effect = await treeEffect(tx, reg, e, w.nodes, w.next, id, wasLive, actorId(user))
    return { touched, effect, parentChanged, renumbered }
  }).catch((err: unknown) => rethrowDbError(err, e, 'write'))

  if (result.touched) {
    await reportChange(event, {
      type: 'entry.updated', entity: e, id, before: seenBefore, after: result.touched, moved: result.effect.moved,
      // A new position is not an edit worth a revision; a new parent is.
      noRevision: !result.parentChanged,
    })
  }
  await reportTreeRedirects(event, reg, result.effect.redirects)
  if (result.touched) {
    await audit(event, 'entry.move', { entity: e.name, recordId: id, meta: { parent, moved: result.effect.moved.length, redirects: result.effect.redirects.length, renumbered: result.renumbered } })
  }
  return { ok: true, moved: result.effect.moved, redirects: result.effect.redirects.length }
})
