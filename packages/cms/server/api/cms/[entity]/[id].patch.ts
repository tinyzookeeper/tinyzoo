import { eq } from '@my-cms/core'

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
  const data = parseOr422(e.updateSchema, await readBody(event))
  const { values, m2m } = splitPayload(e, data)

  // Capture OLD media references for any media FK or rich-text field being changed,
  // so we can GC the blobs that get replaced/cleared/removed after the write commits.
  const changedMediaCols = Object.entries(e.fields)
    .filter(([k, f]) => (f as any).type === 'media' && `${k}Id` in values)
    .map(([k]) => `${k}Id`)
  const changedRichCols = Object.entries(e.fields)
    .filter(([k, f]) => ((f as any).type === 'richtext' || (f as any).type === 'blocks') && k in values)
    .map(([k]) => k)
  const oldMedia: Record<string, string | null> = {}
  let oldEmbedded: string[] = []
  // The row as it is now: for media cleanup, the publish rule and the audit entry.
  const [old] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!old) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  for (const c of changedMediaCols) oldMedia[c] = old[c] ?? null
  oldEmbedded = changedRichCols.flatMap((k) => jsonMediaIds(e.fields[k], old[k]))
  assertPublishAllowed(e, user, values, old)
  // Saving over someone else's newer version needs the editor's say-so (409 otherwise).
  const base = baseVersion(event)
  await assertCurrentVersion(e, old, base)
  // What visitors could see before this save (for the change report / webhooks).
  const seenBefore = await changeSnapshot(e, id)

  const row = await db.transaction(async (tx: any) => {
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
    return current
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
  await audit(event, action ?? 'entry.update', { entity: e.name, recordId: id })
  await reportChange(event, {
    type: action === 'entry.publish' ? 'entry.published' : action === 'entry.unpublish' ? 'entry.unpublished' : 'entry.updated',
    entity: e, id, before: seenBefore, after: row,
  })
  return { row }
})
