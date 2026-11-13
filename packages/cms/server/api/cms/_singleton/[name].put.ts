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

  const row = await db.transaction(async (tx: any) => {
    const [existing] = await tx.select().from(e.table).orderBy(e.table.createdAt).limit(1)
    for (const c of mediaCols) oldMedia[c] = existing?.[c] ?? null

    let current: any
    if (existing) {
      values.updatedAt = new Date()
      ;[current] = await tx.update(e.table).set(values).where(both(eq(e.table.id, existing.id), rowFilter)).returning()
      if (!current) throw createError({ statusCode: 403, statusMessage: 'Not permitted' })
    } else {
      ;[current] = await tx.insert(e.table).values(values).returning()
    }
    await writeM2M(tx, reg, e, current.id, m2m, true)
    return current
  }).catch((err: unknown) => rethrowDbError(err, e, 'write'))

  // GC each replaced/cleared media blob after commit.
  if (mediaCols.length) {
    const storage = useCmsStorage()
    for (const c of mediaCols) {
      if (oldMedia[c] && oldMedia[c] !== row[c]) await gcMediaIfOrphan(db, reg, storage, oldMedia[c])
    }
  }

  await hydrateRowForForm(db, reg, e, row)
  return { row }
})
