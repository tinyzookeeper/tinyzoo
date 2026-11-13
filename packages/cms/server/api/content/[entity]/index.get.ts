import { and, asc, desc, eq, ilike, sql } from '@my-cms/core'

// GET /api/content/:entity — public, read-only list of PUBLISHED items.
// Resolves relations/media, hides private fields, paginates, and is cacheable.
const RESERVED = new Set(['page', 'limit', 'sort', 'dir', 'q', 'locale'])

export default defineEventHandler(async (event) => {
  assertContentAuth(event)
  const { db, reg } = useCms()
  const e = getPublicEntity(reg, getRouterParam(event, 'entity'))
  if (e.singleton) throw createError({ statusCode: 404, statusMessage: 'Use /api/content/_global/:name' })
  const locale = requestedLocale(event, reg)

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset = Math.min((page - 1) * limit, 10_000) // bound deep-offset scans
  const search = String(query.q ?? '').trim().slice(0, 100)
  // A collection arranged by hand comes in that order unless asked otherwise.
  const orderField = e.admin?.list?.orderField
  const dir = query.dir === 'asc' || (!query.dir && !query.sort && orderField) ? asc : desc

  const hidden = new Set(e.content?.hidden ?? [])
  // Sort allowlist: createdAt/updatedAt + non-hidden scalar fields only — never
  // arbitrary keys (proto/Drizzle methods) and never a hidden-column ordering oracle.
  const sortable = new Set<string>(['createdAt', 'updatedAt'])
  for (const [k, fld] of Object.entries(e.fields)) {
    if (!hidden.has(k) && !fld.relation && fld.type !== 'media' && fld.type !== 'richtext' && fld.type !== 'blocks') sortable.add(k)
  }
  const sortKey = sortable.has(String(query.sort)) ? String(query.sort) : (orderField && sortable.has(orderField) ? orderField : 'createdAt')
  const sortCol = e.table[sortKey]

  const conds: any[] = []
  const published = publishedCond(e)
  if (published) conds.push(published)
  if (search) {
    const esc = search.replace(/[\\%_]/g, (c) => `\\${c}`) // neutralize LIKE wildcards
    conds.push(localizedMatch(reg, e, e.titleField, locale, (col) => ilike(col, `%${esc}%`)))
  }

  // Filters by known, NON-HIDDEN fields only — values are bound parameters (injection-safe).
  for (const [k, v] of Object.entries(query)) {
    if (RESERVED.has(k) || hidden.has(k)) continue
    const fld = e.fields[k]
    if (!fld) continue
    if (fld.relation?.kind === 'many-to-one') conds.push(eq(e.table[`${k}Id`], String(v)))
    else if (!fld.relation && ['text', 'slug', 'select'].includes(fld.type)) conds.push(localizedMatch(reg, e, k, locale, (col) => eq(col, String(v))))
  }
  const where = conds.length ? and(...conds) : undefined

  const rows: any[] = await db.select().from(e.table).where(where)
    .orderBy(dir(sortCol)).limit(limit).offset(offset)
  const [counted] = await db.select({ count: sql<number>`count(*)::int` }).from(e.table).where(where)
  const count = counted?.count ?? 0

  await overlayTranslations(db, reg, e, rows, locale)
  await populateItems(db, reg, e, rows, e.content?.populate, locale)
  const items = rows.map((r) => projectItem(e, r))
  await attachLocaleInfo(db, reg, e, rows, items, locale)
  setContentCache(event)
  return { items, total: count, page, limit }
})
