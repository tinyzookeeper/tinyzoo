import { eq } from '@my-cms/core'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const rowFilter = authorize(e, 'update', user)
  const id = getRouterParam(event, 'id')!
  const data = parseOr422(e.updateSchema, await readBody(event))
  const { values, m2m } = splitPayload(e, data)

  // Capture the OLD media FK values for any media field being changed, so we can
  // GC the replaced/cleared blob after the write commits.
  const changedMediaCols = Object.entries(e.fields)
    .filter(([k, f]) => (f as any).type === 'media' && `${k}Id` in values)
    .map(([k]) => `${k}Id`)
  const oldMedia: Record<string, string | null> = {}
  if (changedMediaCols.length) {
    const [old] = await db.select().from(e.table).where(eq(e.table.id, id))
    for (const c of changedMediaCols) oldMedia[c] = old?.[c] ?? null
  }

  const row = await db.transaction(async (tx: any) => {
    let current: any
    if (Object.keys(values).length) {
      values.updatedAt = new Date()
      ;[current] = await tx.update(e.table).set(values).where(both(eq(e.table.id, id), rowFilter)).returning()
    } else {
      ;[current] = await tx.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
    }
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
    await writeM2M(tx, reg, e, id, m2m, true)
    return current
  })

  // GC each replaced/cleared media blob after commit (skip if unchanged or reused).
  if (changedMediaCols.length) {
    const storage = useCmsStorage()
    for (const c of changedMediaCols) {
      if (oldMedia[c] && oldMedia[c] !== row[c]) await gcMediaIfOrphan(db, reg, storage, oldMedia[c])
    }
  }

  return { row }
})
