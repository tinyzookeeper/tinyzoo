import { ilike, inArray, or } from 'tinyzoo'

// Relation-picker typeahead: GET /api/cms/:entity/options?q=&selected=id,id
export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  // Only entries this person may read (row rules included) — titles must not leak.
  const rowFilter = authorize(e, 'read', user)

  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const selected = String(query.selected ?? '').split(',').filter(Boolean)

  const esc = q.replace(/[\\%_]/g, (c) => '\\' + c)
  const found: any[] = q
    ? await db.select().from(e.table).where(both(ilike(e.table[e.titleField], '%' + esc + '%'), rowFilter)).limit(20)
    : await db.select().from(e.table).where(rowFilter).limit(20)

  // always union in already-selected rows so saved chips show labels, not uuids
  const have = new Set(found.map((r) => r.id))
  const missing = selected.filter((id) => !have.has(id))
  if (missing.length) {
    const extra: any[] = await db.select().from(e.table).where(both(inArray(e.table.id, missing.filter((id) => /^[0-9a-f-]{36}$/i.test(id))), rowFilter))
    found.push(...extra)
  }
  return found.map((r) => ({ id: r.id, label: r[e.titleField] }))
})
