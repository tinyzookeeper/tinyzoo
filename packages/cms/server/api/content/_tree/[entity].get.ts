import { childrenMap, indexTree, sortSiblings, titleIn } from 'tinyzoo'

// GET /api/content/_tree/:entity?locale= — the published page tree for building
// navigation: { items: [{ id, title, path, children: [...] }] }, top level first, each
// level in the order editors arranged it. Only live pages (a page under a draft is
// left out with everything below it); every page is listed in the language asked for,
// with the default language's title and address where it is not translated.
export default defineEventHandler(async (event) => {
  assertContentAuth(event)
  const { db, reg } = useCms()
  const e = getPublicEntity(reg, getRouterParam(event, 'entity'))
  if (!e.tree || e.singleton) throw createError({ statusCode: 404, statusMessage: `${e.name} is not a page tree` })
  const locale = requestedLocale(event, reg)
  const def = reg.locales?.default ?? null

  const nodes = await loadTreeNodes(db, reg, e)
  const index = indexTree(nodes)
  const where = publishedCond(e)
  const liveRows: any[] = await db.select({ id: e.table.id }).from(e.table).where(where)
  const live = new Set<string>(liveRows.map((r) => r.id))
  const children = childrenMap(nodes.filter((n) => live.has(n.id)))
  interface Node { id: string; title: string; path: string | null; children: Node[] }
  const build = (parent: string | null, seen: Set<string>): Node[] => sortSiblings(children.get(parent) ?? []).filter((n) => !seen.has(n.id)).map((n) => ({
    id: n.id,
    title: titleIn(n, locale, def),
    path: treePathIn(reg, e, index, n.id, locale),
    children: build(n.id, new Set([...seen, n.id])),
  }))
  setContentCache(event)
  return { items: build(null, new Set()) }
})
