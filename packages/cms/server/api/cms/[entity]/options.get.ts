import { chainOf, depthOf, heightOf, ilike, indexTree, inArray, notInArray, titleIn } from 'tinyzoo'

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

  // A page tree's parent picker: not the page itself nor anything below it (that would be a loop),
  // and not a page with no room left under it (the page and what it carries would be nested too deep).
  // `exclude` is the page being edited; `placing=1` a new one.
  let excluded: string[] = []
  const exclude = String(query.exclude ?? '')
  const placing = /^[0-9a-f-]{36}$/i.test(exclude) || query.placing === '1'
  if (e.tree && placing) {
    const nodes = await loadTreeNodes(db, reg, e)
    const index = indexTree(nodes)
    const own = /^[0-9a-f-]{36}$/i.test(exclude) ? exclude : null
    excluded = own ? subtreeIds(nodes, own) : []
    const carried = own && index.has(own) ? heightOf(index, own) : 0
    for (const n of nodes) if (depthOf(index, n.id) + 1 + carried > e.tree.maxDepth) excluded.push(n.id)
  }
  const notExcluded = excluded.length ? notInArray(e.table.id, excluded) : undefined

  const esc = q.replace(/[\\%_]/g, (c) => '\\' + c)
  const found: any[] = q
    ? await db.select().from(e.table).where(both(both(ilike(e.table[e.titleField], '%' + esc + '%'), rowFilter), notExcluded)).limit(20)
    : await db.select().from(e.table).where(both(rowFilter, notExcluded)).limit(20)

  // always union in already-selected rows so saved chips show labels, not uuids
  const have = new Set(found.map((r) => r.id))
  const missing = selected.filter((id) => !have.has(id))
  if (missing.length) {
    const extra: any[] = await db.select().from(e.table).where(both(inArray(e.table.id, missing.filter((id) => /^[0-9a-f-]{36}$/i.test(id))), rowFilter))
    found.push(...extra)
  }
  // A page tree: a page is named by its trail ("About us / Team"), so two pages called alike can be told apart.
  // A page above it that this person may not read is "…", not its title.
  if (e.tree) {
    const index = indexTree(await loadTreeNodes(db, reg, e))
    const readable = await readableTreeIds(db, e, user)
    const def = reg.locales?.default ?? null
    return found.map((r) => ({
      id: r.id,
      label: chainOf(index, r.id).map((n) => (n.id === r.id ? titleIn(n, null, def) || r[e.titleField] : readable && !readable.has(n.id) ? '…' : titleIn(n, null, def) || '…')).join(' / ') || r[e.titleField],
    }))
  }
  return found.map((r) => ({ id: r.id, label: r[e.titleField] }))
})
