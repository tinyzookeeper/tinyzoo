import { ilike, inArray, or } from '@my-cms/core'

// Relation-picker typeahead: GET /api/cms/:entity/options?q=&selected=id,id
export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  authorize(e, 'read', user)

  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const selected = String(query.selected ?? '').split(',').filter(Boolean)

  const found: any[] = q
    ? await db.select().from(e.table).where(ilike(e.table[e.titleField], `%${q}%`)).limit(20)
    : await db.select().from(e.table).limit(20)

  // always union in already-selected rows so saved chips show labels, not uuids
  const have = new Set(found.map((r) => r.id))
  const missing = selected.filter((id) => !have.has(id))
  if (missing.length) {
    const extra: any[] = await db.select().from(e.table).where(inArray(e.table.id, missing))
    found.push(...extra)
  }
  return found.map((r) => ({ id: r.id, label: r[e.titleField] }))
})
