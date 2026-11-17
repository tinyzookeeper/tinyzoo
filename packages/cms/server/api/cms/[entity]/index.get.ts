import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, not, or, propOf, sql } from 'tinyzoo'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const rowFilter = authorize(e, 'read', user)

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const dir = query.dir === 'asc' ? asc : desc
  // A field this person may not read cannot order the list either (the order would tell them what it holds).
  const hidden = unreadableFields(e, user)
  const sortKey = String(query.sort ?? 'createdAt')
  const sortField = [...hidden].find((k) => sortKey === k || sortKey === `${k}Id`)
  const sortCol = (sortField ? undefined : (e.table[sortKey] ?? e.table[`${sortKey}Id`])) ?? e.table.createdAt

  // Search, filters and status tabs: the same conditions the CSV export uses.
  const conds = listConditions(e, reg, query, rowFilter, hidden, user)
  const where = conds.length ? and(...conds) : undefined

  // Ties (and empty values, last) in a fixed order, so pages never repeat or skip rows.
  // Text in the content's language order ("Č" after "C"); else the admin's language.
  const orderCol = await collated(db, sortCol, reg.locales?.default ?? getCookie(event, 'cms_admin_locale'))
  const rows: any[] = await db.select().from(e.table).where(where)
    .orderBy(sql`${orderCol} ${dir === asc ? sql`asc` : sql`desc`} nulls last`, desc(e.table.createdAt), asc(e.table.id))
    .limit(limit).offset((page - 1) * limit)
  const [counted] = await db.select({ count: sql<number>`count(*)::int` }).from(e.table).where(where)
  const count = counted?.count ?? 0
  // Blocks and lists in the shape the code knows (the list shows counts and excerpts of them).
  for (const r of rows) upgradeStoredJson(e, r, { admin: true })

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
    // Judged by the translated fields this person may read (one hidden from them never says it is translated).
    const avail = await availableLocales(db, reg, e, rows.map((r) => r.id), { fields: e.localized.filter((k) => !hidden.has(k)) })
    for (const r of rows) r.__locales = avail.get(r.id) ?? [reg.locales.default]
    // Publishing per language: where a translation's state differs from the entry's, the list says so.
    if (e.publish?.perLocale) {
      const states = await translationStates(db, reg, e, rows)
      for (const r of rows) r.__states = states.get(r.id) ?? {}
    }
  }
  return { rows: stripUnreadableRows(e, user, rows), total: count, page, limit }
})

