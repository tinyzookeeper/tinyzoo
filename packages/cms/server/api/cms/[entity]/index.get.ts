import { and, asc, desc, ilike, inArray, or, sql } from '@my-cms/core'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const rowFilter = authorize(e, 'read', user)

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const search = String(query.q ?? '').trim()
  const dir = query.dir === 'asc' ? asc : desc
  const sortKey = String(query.sort ?? 'createdAt')
  const sortCol = e.table[sortKey] ?? e.table[`${sortKey}Id`] ?? e.table.createdAt

  const conds: any[] = []
  if (rowFilter) conds.push(rowFilter)
  if (search) {
    const fields = e.admin?.list?.searchable?.length ? e.admin.list.searchable : [e.titleField]
    conds.push(or(...fields.map((fn) => ilike(e.table[fn], `%${search}%`))))
  }
  const where = conds.length ? and(...conds) : undefined

  const rows: any[] = await db.select().from(e.table).where(where)
    .orderBy(dir(sortCol)).limit(limit).offset((page - 1) * limit)
  const [counted] = await db.select({ count: sql<number>`count(*)::int` }).from(e.table).where(where)
  const count = counted?.count ?? 0

  // populate to-one relation labels
  for (const [key, fld] of Object.entries(e.fields)) {
    if (fld.relation?.kind !== 'many-to-one') continue
    const target = reg.byName.get(fld.relation.to().name)!
    const ids = [...new Set(rows.map((r) => r[`${key}Id`]).filter(Boolean))]
    if (!ids.length) continue
    const targets: any[] = await db.select().from(target.table).where(inArray(target.table.id, ids))
    const labels = new Map(targets.map((t) => [t.id, t[target.titleField]]))
    for (const r of rows) r[`${key}__label`] = labels.get(r[`${key}Id`]) ?? null
  }

  // populate media thumbnails for any media column shown in the list
  for (const [key, fld] of Object.entries(e.fields)) {
    if (fld.type !== 'media') continue
    const ids = [...new Set(rows.map((r) => r[`${key}Id`]).filter(Boolean))]
    if (!ids.length) continue
    const items: any[] = await db.select().from(reg.cmsMedia).where(inArray(reg.cmsMedia.id, ids))
    const byId = new Map(items.map((m) => [m.id, m]))
    for (const r of rows) r[`${key}__media`] = byId.get(r[`${key}Id`]) ?? null
  }

  return { rows, total: count, page, limit }
})
