import { and, eq, gte, inArray, isNotNull, isNull, lte, ne, not, or, propOf, sql } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'

/** Trigram word similarity a longer search word needs to count as a typo of a word in the text. */
const TYPO_SIMILARITY = 0.35

/**
 * What an admin list shows, as SQL conditions: the user's row rule, the search box
 * (accents ignored), `filter.<field>` filters and the status tab. Shared by the list
 * and its CSV export, so the file holds exactly what the editor sees.
 */
export function listConditions(e: CmsEntity, reg: CmsRegistry, query: Record<string, any>, rowFilter: any, hidden?: ReadonlySet<string>): any[] {
  const conds: any[] = []
  if (rowFilter) conds.push(rowFilter)
  const search = String(query.q ?? '').trim()
  if (search) {
    // Never by a field this person may not read: a match would tell them what it holds.
    const searchable = (e.admin?.list?.searchable ?? []).filter((k) => !hidden?.has(k))
    const fields = searchable.length ? searchable : [e.titleField]
    // Every word must be found (in any order, in any of the fields). Accents and case do
    // not matter ("zimni" finds "Zimní", "pribram" finds "Příbram"), and a longer word
    // may have a typo ("clenek" finds "článek"): trigram word similarity, as the admin's search.
    const words = foldAccents(search).split(/\s+/).filter(Boolean).slice(0, 8)
    for (const word of words) {
      const like = '%' + word.replace(/[\\%_]/g, (c) => '\\' + c) + '%' // LIKE wildcards are literal
      const letters = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
      conds.push(or(...fields.flatMap((fn) => {
        const col = foldedColumn(e.table[fn])
        return letters.length >= 4
          ? [sql`${col} like ${like}`, sql`word_similarity(${letters}, ${col}) >= ${TYPO_SIMILARITY}`]
          : [sql`${col} like ${like}`]
      })))
    }
  }
  conds.push(...listFilters(e, reg, query, hidden))
  // Status tabs: ?status=published | scheduled | draft (entities with a publish workflow).
  const p = e.publish
  if (p && ['published', 'scheduled', 'draft'].includes(String(query.status))) {
    const col = e.table[propOf(p.field, e.fields[p.field]!)]
    const live = scheduleCond(e)
    if (query.status === 'draft') conds.push(or(isNull(col), ne(col, p.publishedValue)))
    else if (query.status === 'published') conds.push(both(eq(col, p.publishedValue), live))
    else conds.push(live ? and(eq(col, p.publishedValue), not(live)) : sql`false`)
  }
  return conds
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The list's filters: `filter.<field>=<value>` by field type — a choice (several
 * comma-separated), yes/no, a related entry (to-one or many), has an image or not,
 * and a date range (`filter.<field>.from` / `.to`, ISO dates). Unknown or invalid
 * filters are ignored; values are bound parameters.
 */
export function listFilters(e: any, reg: any, query: Record<string, any>, hidden?: ReadonlySet<string>): any[] {
  const out: any[] = []
  for (const [param, raw] of Object.entries(query)) {
    if (!param.startsWith('filter.')) continue
    const [key = '', part] = param.slice('filter.'.length).split('.')
    const fld = key && Object.hasOwn(e.fields, key) && !hidden?.has(key) ? e.fields[key] : null
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
