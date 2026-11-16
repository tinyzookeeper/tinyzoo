import { eq, type TreeNode } from 'tinyzoo'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  if (e.singleton) throw createError({ statusCode: 404, statusMessage: 'Use PUT /api/cms/_singleton/:name' })
  const rowFilter = authorize(e, 'update', user)
  const id = getIdParam(event)
  // ?locale=<translation>: write that language's translation only.
  const locale = requestedLocale(event, reg)
  if (isTranslationLocale(reg, locale)) return { row: await writeTranslation(event, e, id, locale, user, rowFilter) }
  const body = await readBody(event)

  // The row as it is now: for media cleanup, the publish rule, the audit entry and the check of its blocks.
  const [old] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!old) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  // Saving over someone else's newer version needs the editor's say-so (409 otherwise): said
  // before the body is judged, so an editor that is behind is told so, not that its blocks are.
  const base = baseVersion(event)
  await assertCurrentVersion(e, old, base)
  // Checked against what is stored: a block that is behind, or of a type that is gone, stays only if it is stored already.
  const data = parseOr422(writeSchema(e, 'update', old), body)
  const { values, m2m } = splitPayload(e, data)

  // Capture OLD media references for any media FK or rich-text field being changed,
  // so we can GC the blobs that get replaced/cleared/removed after the write commits.
  const changedMediaCols = Object.entries(e.fields)
    .filter(([k, f]) => (f as any).type === 'media' && `${k}Id` in values)
    .map(([k]) => `${k}Id`)
  const changedRichCols = Object.entries(e.fields)
    .filter(([k, f]) => JSON_MEDIA_TYPES.has((f as any).type) && k in values)
    .map(([k]) => k)
  const oldMedia: Record<string, string | null> = {}
  for (const c of changedMediaCols) oldMedia[c] = old[c] ?? null
  const oldEmbedded: string[] = changedRichCols.flatMap((k) => jsonMediaIds(e.fields[k], old[k]))
  assertPublishAllowed(e, user, values, old)
  await assertNoRedirectLoop(e, values, old)
  stampPublishDate(e, values, old)
  // What visitors could see before this save (for the change report / webhooks).
  const seenBefore = await changeSnapshot(e, id)
  // A page tree: a new parent or address part changes the address of the page and every page below it.
  const treeKeys = e.tree ? treeProps(e) : null
  const treeTouched = !!treeKeys && (treeKeys.parent in values || treeKeys.slug in values)

  const { row, effect } = await db.transaction(async (tx: any) => {
    let writeTree: Awaited<ReturnType<typeof beginTreeWrite>> | null = null
    let wasLive = new Set<string>()
    if (treeTouched && treeKeys) {
      // What the request does not set (the other of parent and address part) is read under the lock,
      // from the tree as it is now: a rename or move that landed since `old` was read must count.
      let before: TreeNode | undefined
      writeTree = await beginTreeWrite(tx, reg, e, (nodes) => {
        before = nodes.find((n) => n.id === id)
        if (!before) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
        return {
          id,
          parentId: treeKeys.parent in values ? values[treeKeys.parent] ?? null : before.parentId,
          slug: treeKeys.slug in values ? String(values[treeKeys.slug]) : before.slug,
          title: treeKeys.title in values ? String(values[treeKeys.title] ?? '') : before.title,
        }
      }, user)
      wasLive = await liveAmong(tx, e, subtreeIds(writeTree.nodes, id))
      // Under a new parent a page goes last among its new siblings.
      if (treeKeys.parent in values && (values[treeKeys.parent] ?? null) !== (before!.parentId ?? null) && !(e.tree!.order in values)) {
        values[e.tree!.order] = nextPosition(writeTree.nodes, values[treeKeys.parent] ?? null)
      }
    }
    // Every save is a new version, relation-only ones included.
    values.updatedAt = nextVersion(e.table.updatedAt)
    values.updatedBy = actorId(user)
    // For people who may not publish, the row must still not be live at write time
    // (an editor may have published it since we read it), and it must still be the
    // version the editor saw (someone may have saved since we read it).
    const sameVersion = base ? eq(e.table.updatedAt, base) : undefined
    const [current] = await tx.update(e.table).set(values).where(both(both(both(eq(e.table.id, id), rowFilter), notLiveCond(e, user)), sameVersion)).returning()
    if (!current && base) {
      const [now] = await tx.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
      await assertCurrentVersion(e, now, base)
    }
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
    await writeM2M(tx, reg, e, id, m2m, true)
    // The page and everything below it may have new addresses: redirects from the old ones, in the same transaction.
    const effect = writeTree ? await treeEffect(tx, reg, e, writeTree.nodes, writeTree.next, id, wasLive, actorId(user)) : null
    // A redirect away from an address this entry is live at now would loop: gone, in the same transaction.
    await dropRedirectsFromLiveAddresses(tx, reg, e, id)
    return { row: current, effect }
  }).catch((err: unknown) => rethrowDbError(err, e, 'write'))

  // GC each replaced/cleared media blob after commit (skip if unchanged or reused).
  if (changedMediaCols.length || changedRichCols.length) {
    const storage = useCmsStorage()
    for (const c of changedMediaCols) {
      if (oldMedia[c] && oldMedia[c] !== row[c]) await gcMediaIfOrphan(db, reg, storage, oldMedia[c], gcScope(user))
    }
    // Images dropped from rich text on this edit → GC if now orphaned.
    if (oldEmbedded.length) {
      const stillEmbedded = new Set(changedRichCols.flatMap((k) => jsonMediaIds(e.fields[k], row[k])))
      for (const mid of new Set(oldEmbedded)) {
        if (!stillEmbedded.has(mid)) await gcMediaIfOrphan(db, reg, storage, mid, gcScope(user))
      }
    }
  }

  await noteCollabSave(event, { entity: e, id, locale: null }, row.updatedAt)
  const action = publishAction(e, old, row)
  await audit(event, action ?? 'entry.update', { entity: e.name, recordId: id, ...(effect?.moved.length ? { meta: { moved: effect.moved.length, redirects: effect.redirects.length } } : {}) })
  await reportChange(event, {
    type: action === 'entry.publish' ? 'entry.published' : action === 'entry.unpublish' ? 'entry.unpublished' : 'entry.updated',
    entity: e, id, before: seenBefore, after: row, moved: effect?.moved,
  })
  if (effect) await reportTreeRedirects(event, reg, effect.redirects)
  // Old addresses that now lead to the new ones (a changed address part or a move): told, so the editor knows.
  return { row, ...(effect?.redirects.length ? { redirects: effect.redirects.length } : {}) }
})
