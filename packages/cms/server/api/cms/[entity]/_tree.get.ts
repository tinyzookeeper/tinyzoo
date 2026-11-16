import { chainOf, indexTree, propOf, sql } from 'tinyzoo'

// GET /api/cms/:entity/_tree — every entry of a page tree for the admin's tree list and
// the move dialog: where it sits (parentId, position), its status, whether it is on
// the website (published, and so is everything above it) and its address in each
// language. Drafts included; only entries this person may read.
export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  if (!e.tree || e.singleton) throw createError({ statusCode: 404, statusMessage: 'This collection is not a tree' })
  const rowFilter = authorize(e, 'read', user)
  const p = treeProps(e)
  const pub = e.publish
  const liveCond = publishedCond(e)

  const cols: Record<string, any> = {
    id: e.table.id, parentId: e.table[p.parent], title: e.table[p.title], slug: e.table[p.slug], position: e.table[p.order],
    updatedAt: e.table.updatedAt, onSite: liveCond ? sql<boolean>`${liveCond}` : sql<boolean>`true`,
  }
  if (pub) {
    cols.status = e.table[propOf(pub.field, e.fields[pub.field]!)]
    if (pub.dateField) cols.publishAt = e.table[propOf(pub.dateField, e.fields[pub.dateField]!)]
  }
  const rows: any[] = await db.select(cols).from(e.table).where(rowFilter)
  const nodes = await loadTreeNodes(db, reg, e)
  const index = indexTree(nodes)
  // An address is made of the address parts of every page above: where one of them is a page this
  // person may not read, its part (and so the address) is not told.
  const readable = rowFilter ? new Set(rows.map((r) => r.id)) : null
  const seesChain = (id: string) => !readable || chainOf(index, id).every((n) => readable.has(n.id))
  const avail = reg.locales && e.localized.length ? await availableLocales(db, reg, e, rows.map((r) => r.id)) : null
  return {
    maxDepth: e.tree.maxDepth,
    rows: rows.map((r) => {
      const paths: Record<string, string> = {}
      if (seesChain(r.id)) for (const v of treeVersions(reg, e, index, r.id)) paths[v.locale ?? ''] = v.loc
      return { ...r, onSite: !!r.onSite, paths, locales: avail?.get(r.id) ?? null }
    }),
  }
})
