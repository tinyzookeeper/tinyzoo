import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, ne, not, or, propOf, sql } from '@my-cms/core'

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
    const esc = search.replace(/[\\%_]/g, (c) => '\\' + c) // LIKE wildcards are literal
    conds.push(or(...fields.map((fn) => ilike(e.table[fn], '%' + esc + '%'))))
  }
  conds.push(...listFilters(e, reg, query))
  // Status tabs: ?status=published | scheduled | draft (entities with a publish workflow).
  const p = e.publish
  if (p && ['published', 'scheduled', 'draft'].includes(String(query.status))) {
    const col = e.table[propOf(p.field, e.fields[p.field]!)]
    const live = scheduleCond(e)
    if (query.status === 'draft') conds.push(or(isNull(col), ne(col, p.publishedValue)))
    else if (query.status === 'published') conds.push(both(eq(col, p.publishedValue), live))
    else conds.push(live ? and(eq(col, p.publishedValue), not(live)) : sql`false`)
  }
  const where = conds.length ? and(...conds) : undefined

  // Ties (and empty values, last) in a fixed order, so pages never repeat or skip rows.
  const rows: any[] = await db.select().from(e.table).where(where)
    .orderBy(sql`${sortCol} ${dir === asc ? sql`asc` : sql`desc`} nulls last`, desc(e.table.createdAt), asc(e.table.id))
    .limit(limit).offset((page - 1) * limit)
  const [counted] = await db.select({ count: sql<number>`count(*)::int` }).from(e.table).where(where)
  const count = counted?.count ?? 0

  // populate to-one relation labels
  for (const [key, fld] of Object.entries(e.fields)) {
    if (fld.relation?.kind !== 'many-to-one') continue
    const target = reg.byName.get(fld.relation.to().name)!
    const ids = [...new Set(rows.map((r) => r[`${key}Id`]).filter(Boolean))]
    if (!ids.length) continue
    // Only titles this person may read (the related collection's own rules).
    const access = accessWhere(target, 'read', user)
    if (!access.allowed) continue
    const targets: any[] = await db.select().from(target.table).where(both(inArray(target.table.id, ids), access.where))
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

  // Which languages each row is available in (for the list's language column).
  if (reg.locales && e.localized.length) {
    const avail = await availableLocales(db, reg, e, rows.map((r) => r.id))
    for (const r of rows) r.__locales = avail.get(r.id) ?? [reg.locales.default]
  }
  return { rows, total: count, page, limit }
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The list's filters: `filter.<field>=<value>` by field type — a choice (several
 * comma-separated), yes/no, a related entry (to-one or many), has an image or not,
 * and a date range (`filter.<field>.from` / `.to`, ISO dates). Unknown or invalid
 * filters are ignored; values are bound parameters.
 */
function listFilters(e: any, reg: any, query: Record<string, any>): any[] {
  const out: any[] = []
  for (const [param, raw] of Object.entries(query)) {
    if (!param.startsWith('filter.')) continue
    const [key = '', part] = param.slice('filter.'.length).split('.')
    const fld = key && Object.hasOwn(e.fields, key) ? e.fields[key] : null
    if (!fld) continue
    const value = String(Array.isArray(raw) ? raw[0] : raw ?? '').slice(0, 500)
    if (!value) continue
    if (fld.type === 'select') {
      const allowed = new Set<string>(fld.meta?.options ?? fld.options ?? [])
      const picked = value.split(',').filter((v) => !allowed.size || allowed.has(v))
      if (picked.length) out.push(inArray(e.table[propOf(key, fld)], picked))
    }
    else if (fld.type === 'boolean') {
      if (value === 'true' || value === 'false') out.push(eq(e.table[propOf(key, fld)], value === 'true'))
    }
    else if (fld.type === 'media') {
      const col = e.table[`${key}Id`]
      if (value === 'yes') out.push(isNotNull(col))
      else if (value === 'no') out.push(isNull(col))
    }
    else if (fld.relation?.kind === 'many-to-one') {
      if (UUID.test(value)) out.push(eq(e.table[`${key}Id`], value))
    }
    else if (fld.relation?.kind === 'many-to-many') {
      const j = reg.junctionByOwnerField.get(`${e.name}.${key}`)
      if (j && UUID.test(value)) {
        out.push(sql`exists (select 1 from ${j.table} where ${j.table[j.ownerCol]} = ${e.table.id} and ${j.table[j.targetCol]} = ${value})`)
      }
    }
    else if (fld.type === 'datetime' && (part === 'from' || part === 'to')) {
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) continue
      const col = e.table[propOf(key, fld)]
      out.push(part === 'from' ? gte(col, d) : lte(col, d))
    }
  }
  return out
}
