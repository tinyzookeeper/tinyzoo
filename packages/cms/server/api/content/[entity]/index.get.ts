import { and, asc, desc, eq, gte, ilike, lt, sql } from '@my-cms/core'

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

  const hidden = new Set(e.content?.hidden ?? [])
  // Sort allowlist: createdAt/updatedAt + non-hidden scalar fields only — never
  // arbitrary keys (proto/Drizzle methods) and never a hidden-column ordering oracle.
  const sortable = new Set<string>(['createdAt', 'updatedAt'])
  for (const [k, fld] of Object.entries(e.fields)) {
    if (!hidden.has(k) && !fld.relation && fld.type !== 'media' && fld.type !== 'richtext' && fld.type !== 'blocks' && fld.type !== 'gallery') sortable.add(k)
  }
  const sortKey = sortable.has(String(query.sort)) ? String(query.sort) : (orderField && sortable.has(orderField) ? orderField : 'createdAt')
  const dir = query.dir === 'asc' || (!query.dir && !query.sort && sortKey === orderField) ? asc : desc
  const sortCol = e.table[sortKey]

  const conds: any[] = []
  const published = publishedCond(e)
  if (published) conds.push(published)
  if (search) {
    const esc = search.replace(/[\\%_]/g, (c) => `\\${c}`) // neutralize LIKE wildcards
    conds.push(localizedMatch(reg, e, e.titleField, locale, (col) => ilike(col, `%${esc}%`)))
  }

  // Filters by known, NON-HIDDEN fields only — values are bound parameters (injection-safe).
  for (const [param, raw] of Object.entries(query)) {
    const parts = param.split('.')
    if (parts.length > 2) continue
    const [k = '', bound] = parts
    if (RESERVED.has(k) || hidden.has(k) || !Object.hasOwn(e.fields, k)) continue
    const fld = e.fields[k]!
    const v = Array.isArray(raw) ? raw[0] : raw
    if (bound !== undefined) {
      // Date ranges: `startsAt.from=2026-07-01`, `startsAt.to=2026-07-31` (a bare date
      // as `to` includes that whole day).
      if (fld.type !== 'datetime' || (bound !== 'from' && bound !== 'to')) continue
      const when = dateBound(String(v ?? ''), bound)
      if (!when) throw createError({ statusCode: 400, statusMessage: `Invalid date for ${param}` })
      conds.push(bound === 'from' ? gte(e.table[k], when) : lt(e.table[k], when))
      continue
    }
    if (fld.type === 'boolean') {
      if (v === 'true' || v === 'false') conds.push(eq(e.table[k], v === 'true'))
      continue
    }
    if (fld.relation?.kind === 'many-to-one') conds.push(eq(e.table[`${k}Id`], String(v)))
    else if (!fld.relation && ['text', 'slug', 'select'].includes(fld.type)) conds.push(localizedMatch(reg, e, k, locale, (col) => eq(col, String(v))))
  }
  const where = conds.length ? and(...conds) : undefined

  const rows: any[] = await db.select().from(e.table).where(where)
    // Ties (and empty values, last) in a fixed order, so pages never repeat or skip items.
    .orderBy(sql`${sortCol} ${dir === asc ? sql`asc` : sql`desc`} nulls last`, desc(e.table.createdAt), asc(e.table.id))
    .limit(limit).offset(offset)
  const [counted] = await db.select({ count: sql<number>`count(*)::int` }).from(e.table).where(where)
  const count = counted?.count ?? 0

  await overlayTranslations(db, reg, e, rows, locale)
  await populateItems(db, reg, e, rows, e.content?.populate, locale)
  const items = rows.map((r) => projectItem(e, r))
  await attachLocaleInfo(db, reg, e, rows, items, locale)
  setContentCache(event)
  return { items, total: count, page, limit }
})

/**
 * A date-range bound: an ISO date (`2026-07-31`, a whole day in UTC) or date-time
 * (`2026-07-31T18:00`, `…Z` or `…+02:00`; without an offset it is read as UTC, never
 * in the server's own zone). `to` is inclusive: a bare date covers that whole day.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/
function dateBound(value: string, bound: 'from' | 'to'): Date | null {
  const dateOnly = ISO_DATE.test(value)
  const m = dateOnly ? null : ISO_DATETIME.exec(value)
  if (!dateOnly && !m) return null
  const d = new Date(dateOnly ? `${value}T00:00:00Z` : m![1] ? value : `${value}Z`)
  if (Number.isNaN(d.getTime())) return null
  const out = bound === 'to' ? new Date(d.getTime() + (dateOnly ? 86_400_000 : 1)) : d
  return Number.isNaN(out.getTime()) ? null : out
}
