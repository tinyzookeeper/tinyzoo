import { eq } from '@my-cms/core'

// PUT /api/cms/_singleton/:name — upsert the single row of a global. Validates the
// full payload, inserts on first save or updates the existing row, and GCs any media
// blob replaced/cleared by this write.
export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'name'))
  if (!e.singleton) throw createError({ statusCode: 404, statusMessage: `Not a global: ${e.name}` })
  const rowFilter = authorize(e, 'update', user)

  const data = parseOr422(e.insertSchema, await readBody(event))
  const { values, m2m } = splitPayload(e, data)

  const mediaCols = Object.entries(e.fields)
    .filter(([, f]) => (f as any).type === 'media')
    .map(([k]) => `${k}Id`)
  const oldMedia: Record<string, string | null> = {}
  // Media referenced inside rich text / blocks before this write (cleanup below).
  const jsonCols = Object.entries(e.fields).filter(([, f]) => (f as any).type === 'richtext' || (f as any).type === 'blocks').map(([k]) => k)
  let oldEmbedded: string[] = []

  const row = await db.transaction(async (tx: any) => {
    const [existing] = await tx.select().from(e.table).orderBy(e.table.createdAt).limit(1)
    for (const c of mediaCols) oldMedia[c] = existing?.[c] ?? null
    if (existing) oldEmbedded = jsonCols.flatMap((k) => jsonMediaIds(e.fields[k], existing[k]))

    let current: any
    values.updatedBy = actorId(user)
    if (existing) {
      values.updatedAt = new Date()
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
  await hydrateRowForForm(db, reg, e, row)
  return { row }
})
