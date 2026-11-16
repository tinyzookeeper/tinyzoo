import { existsIn, inArray, treeAddress } from 'tinyzoo'
import type { CmsEntity, CmsRegistry, TreeIndex, TreeNode } from 'tinyzoo'

// The page tree's addresses, with explicit imports only (no Nitro auto-imports), so the
// CLI (`tinyzoo links:convert`) can resolve links to pages in a tree too. The rest of
// the tree's server logic is in cmsTree.ts.

/** Property keys of a tree entity's columns. */
export function treeProps(e: CmsEntity) {
  const tree = e.tree!
  return { parent: `${tree.parent}Id`, order: tree.order, slug: e.content!.slug!, title: e.titleField }
}

/** Every entry of the tree as a node: parent, address parts and titles in every language, position. */
export async function loadTreeNodes(db: any, reg: CmsRegistry, e: CmsEntity): Promise<TreeNode[]> {
  const p = treeProps(e)
  const rows: any[] = await db.select({
    id: e.table.id, parentId: e.table[p.parent], slug: e.table[p.slug], title: e.table[p.title], position: e.table[p.order],
  }).from(e.table)
  const nodes = new Map<string, TreeNode>(rows.map((r) => [r.id, {
    id: r.id, parentId: r.parentId ?? null, slug: String(r.slug ?? ''), title: r.title == null ? '' : String(r.title),
    position: Number(r.position ?? 0), slugs: {}, titles: {}, locales: [],
  }]))
  const t = e.localesTable
  const others = reg.locales?.locales.filter((l) => l !== reg.locales!.default) ?? []
  if (t && others.length && nodes.size) {
    const cols: Record<string, any> = { parentId: t.parentId, locale: t.locale }
    if (e.localized.includes(p.slug)) cols.slug = t[p.slug]
    if (e.localized.includes(p.title)) cols.title = t[p.title]
    const trs: any[] = await db.select(cols).from(t).where(inArray(t.locale, others))
    for (const tr of trs) {
      const n = nodes.get(tr.parentId)
      if (!n) continue
      n.locales!.push(tr.locale)
      if ('slug' in tr) n.slugs![tr.locale] = tr.slug
      if ('title' in tr) n.titles![tr.locale] = tr.title
    }
  }
  return [...nodes.values()]
}

/** Settings the pure checks need, from the entity. */
export function treeOptions(reg: CmsRegistry, e: CmsEntity) {
  return { maxDepth: e.tree!.maxDepth, locales: reg.locales, template: e.content!.path, key: e.content!.slug! }
}

/** One entry's addresses: the default language and every language it is translated into. */
export function treeVersions(reg: CmsRegistry, e: CmsEntity, index: TreeIndex, id: string): { locale: string | null; loc: string }[] {
  const node = index.get(id)
  if (!node) return []
  const { locales, template, key } = treeOptions(reg, e)
  const out: { locale: string | null; loc: string }[] = []
  for (const locale of locales ? locales.locales : [null]) {
    if (!existsIn(node, locale, locales?.default ?? null)) continue
    const loc = treeAddress(locales, template, key, index, id, locale)
    if (loc) out.push({ locale, loc })
  }
  return out
}

/** The address of an entry in one language (its fallback parts included), or null. */
export function treePathIn(reg: CmsRegistry, e: CmsEntity, index: TreeIndex, id: string, locale: string | null): string | null {
  const { locales, template, key } = treeOptions(reg, e)
  return treeAddress(locales, template, key, index, id, locale && locales?.locales.includes(locale) ? locale : locales?.default ?? null)
}
