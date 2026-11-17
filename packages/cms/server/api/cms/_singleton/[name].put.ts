import { eq, sql } from 'tinyzoo'

// PUT /api/cms/_singleton/:name — upsert the single row of a global. Validates the
// full payload, inserts on first save or updates the existing row, and GCs any media
// blob replaced/cleared by this write.
export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'name'))
  if (!e.singleton) throw createError({ statusCode: 404, statusMessage: `Not a global: ${e.name}` })
  const rowFilter = authorize(e, 'update', user)

  // ?locale=<translation>: translate the (existing) settings row.
  const locale = requestedLocale(event, reg)
  if (isTranslationLocale(reg, locale)) {
    const [existing] = await db.select({ id: e.table.id }).from(e.table).orderBy(e.table.createdAt).limit(1)
    if (!existing) throw createError({ statusCode: 409, statusMessage: 'Save the default language first' })
    return { row: await writeTranslation(event, e, existing.id, locale, user, rowFilter) }
  }

  // The row as it is now: blocks that are behind or of a type that is gone are only kept when stored already.
  const [prior] = await db.select().from(e.table).orderBy(e.table.createdAt).limit(1)
  const body = await readBody(event)
  assertFieldsEditable(e, user, bodyKeys(body))
  // A save replaces the whole global (omitted fields take their default), so a field this person
  // may not edit is left out of the check and the write: it keeps what it holds. (The very first
  // save has nothing to keep: there the defaults apply, and a required field with none is refused.)
  const data = parseOr422(writeSchema(e, 'create', prior, prior ? uneditableFields(e, user) : undefined), body)
  await assertMediaAccepted(db, reg, e, data)
  const { values, m2m } = splitPayload(e, data)
  const base = baseVersion(event)
  const seenBefore = prior ? await changeSnapshot(e, prior.id) : null

  const mediaCols = Object.entries(e.fields)
    .filter(([, f]) => (f as any).type === 'media')
    .map(([k]) => `${k}Id`)
  const oldMedia: Record<string, string | null> = {}
  // Media referenced inside rich text / blocks before this write (cleanup below).
  const jsonCols = Object.entries(e.fields).filter(([, f]) => JSON_MEDIA_TYPES.has((f as any).type)).map(([k]) => k)
  let oldEmbedded: string[] = []

  const row = await db.transaction(async (tx: any) => {
    // One save of this global at a time (also the very first one, when there is no
    // row to lock yet): a concurrent save waits, then sees this one's version.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'cms-global:' + e.name}))`)
    const [existing] = await tx.select().from(e.table).orderBy(e.table.createdAt).limit(1).for('update')
    await assertCurrentVersion(e, existing, base)
    for (const c of mediaCols) oldMedia[c] = existing?.[c] ?? null
    if (existing) oldEmbedded = jsonCols.flatMap((k) => jsonMediaIds(e.fields[k], existing[k]))

    let current: any
    values.updatedBy = actorId(user)
    if (existing) {
      values.updatedAt = nextVersion(e.table.updatedAt)
      ;[current] = await tx.update(e.table).set(values).where(both(eq(e.table.id, existing.id), rowFilter)).returning()
      if (!current) throw createError({ statusCode: 403, statusMessage: 'Not permitted' })
    } else {
      values.createdBy = actorId(user)
      ;[current] = await tx.insert(e.table).values(values).returning()
    }
    await writeM2M(tx, reg, e, current.id, m2m, true)
    return current
  }).catch((err: unknown) => rethrowDbError(err, e, 'write'))

  // GC each replaced/cleared media blob after commit — fields, and anything dropped
  // from rich text or blocks.
  const storage = useCmsStorage()
  for (const c of mediaCols) {
    if (oldMedia[c] && oldMedia[c] !== row[c]) await gcMediaIfOrphan(db, reg, storage, oldMedia[c], gcScope(user))
  }
  if (oldEmbedded.length) {
    const still = new Set(jsonCols.flatMap((k) => jsonMediaIds(e.fields[k], row[k])))
    for (const mid of new Set(oldEmbedded)) if (!still.has(mid)) await gcMediaIfOrphan(db, reg, storage, mid, gcScope(user))
  }

  await audit(event, 'settings.update', { entity: e.name, recordId: row.id })
  await noteCollabSave(event, { entity: e, id: row.id, locale: null }, row.updatedAt)
  await reportChange(event, { type: 'global.updated', entity: e, id: row.id, before: seenBefore, after: row })
  await hydrateRowForForm(db, reg, e, row)
  return { row: stripUnreadable(e, user, row) }
})
