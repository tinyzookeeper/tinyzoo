import { and, desc, eq, indexTree, inArray, linkRef, sitePath, sql } from 'tinyzoo'

// GET /api/cms/_links?q=&locale= — what an editor can link to: entries of every
// collection that has an address on the website (`content.path`), by title, with
// that address in the language being edited. Feeds the link picker (rich text,
// menus, link fields), so editors pick a page instead of typing its address.
// Only what the signed-in user may read; drafts are included and marked, because
// a menu is often prepared before the page goes live. Only collections a link can
// follow (public, with an address) are offered. Each item carries `ref`, what a link
// stores (`cms:<entity>/<id>`): the link then follows the entry when its address changes.
const PER_COLLECTION = 8
const TOTAL = 24

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const query = getQuery(event)
  const search = String(query.q ?? '').trim().slice(0, 100)
  const wanted = typeof query.locale === 'string' ? query.locale : null
  const locale = reg.locales ? (wanted && reg.locales.locales.includes(wanted) ? wanted : reg.locales.default) : null
  const isDefault = !reg.locales || locale === reg.locales.default

  type Link = { entity: string; id: string; ref: string; title: string; path: string; published: boolean }
  const out: Link[] = []
  for (const e of reg.entities) {
    if (out.length >= TOTAL) break
    if (!isLinkable(e)) continue
    const { allowed, where } = accessWhere(e, 'read', user)
    if (!allowed) continue
    const keys = pathKeys(e.content!.path).filter((k: string) => e.table[k])
    const titleCol = e.table[e.titleField]
    const liveCond = publishedCond(e)
    const cols: Record<string, any> = { id: e.table.id, title: titleCol, live: liveCond ? sql<boolean>`${liveCond}` : sql<boolean>`true` }
    for (const k of keys) cols[k] = e.table[k]
    const conds: any[] = []
    if (where) conds.push(where)
    if (search) {
      const esc = foldAccents(search).replace(/[\\%_]/g, (c) => '\\' + c)
      conds.push(sql`${foldedColumn(titleCol)} like ${'%' + esc + '%'}`)
    }
    const rows: any[] = await db.select(cols).from(e.table).where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(e.table.updatedAt)).limit(PER_COLLECTION)
    if (!rows.length) continue

    // A translated address (or title) comes from the translation; untranslated parts
    // fall back to the default language, as on the website.
    const tr = new Map<string, any>()
    if (!isDefault && e.localesTable) {
      const t = e.localesTable
      const tcols: Record<string, any> = { parentId: t.parentId }
      for (const k of [...keys, e.titleField]) if (e.localized.includes(k) && t[k]) tcols[k] = t[k]
      const trs: any[] = await db.select(tcols).from(t).where(and(inArray(t.parentId, rows.map((r) => r.id)), eq(t.locale, locale!)))
      for (const r of trs) tr.set(r.parentId, r)
    }
    // A page tree: the address runs through the ancestors.
    const treeIndex = e.tree ? indexTree(await loadTreeNodes(db, reg, e)) : null
    for (const row of rows) {
      const merged = { ...row }
      const t = tr.get(row.id)
      if (t) for (const [k, v] of Object.entries(t)) if (k !== 'parentId' && v !== null && v !== undefined && v !== '') merged[k] = v
      const path = treeIndex ? treePathIn(reg, e, treeIndex, row.id, locale) : sitePath(reg.locales, e.content!.path, locale, merged)
      if (!path) continue
      out.push({ entity: e.name, id: row.id, ref: linkRef(e.name, row.id), title: String(merged[e.titleField] ?? ''), path, published: !!row.live })
    }
  }
  return { locale, items: out.slice(0, TOTAL) }
})
