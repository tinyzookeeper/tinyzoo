import type { LocalesDef } from './locales'
import { sitePath, type PathTemplate } from './paths'

/**
 * Pure logic of a page tree (`definePages({ tree: true })`): who is whose parent, how
 * deep, what a page's address is in each language, and what a change would break.
 * No database here: the server loads the nodes and asks these functions.
 */

/** The deepest a tree may be configured to go (a page at the top is depth 1). */
export const TREE_MAX_DEPTH_LIMIT = 10
/** Depth limit when `definePages({ tree: true })` says nothing else. */
export const TREE_DEFAULT_MAX_DEPTH = 4

/** What the tree needs of an entity (from `defineEntity({ tree })`). */
export interface TreeConfig {
  /** The field pointing at the parent entry (a many-to-one relation to the entity itself). */
  parent: string
  /** The whole-number field holding the position among siblings. */
  order: string
  /** How many levels the tree may have; a page at the top is level 1. */
  maxDepth: number
}

/** One entry as the tree sees it. */
export interface TreeNode {
  id: string
  parentId: string | null
  /** Its address part in the default language. */
  slug: string
  /** Address parts of its translations (`{ en: 'about' }`); an empty one falls back to the default. */
  slugs?: Record<string, string | null | undefined>
  title?: string
  titles?: Record<string, string | null | undefined>
  /** Languages (besides the default) it has a translation in: it has an address there. */
  locales?: string[]
  position?: number
}

export type TreeIndex = Map<string, TreeNode>

/** Does the node have an address in this language? The default language always; others when translated. */
export function existsIn(node: TreeNode, locale: string | null, defaultLocale: string | null): boolean {
  return !locale || locale === defaultLocale || !!node.locales?.includes(locale)
}

export function indexTree(nodes: TreeNode[]): TreeIndex {
  return new Map(nodes.map((n) => [n.id, n]))
}

/** The address part of a node in a language: its translation, else the default one. */
export function slugIn(node: TreeNode, locale: string | null, defaultLocale: string | null): string {
  if (locale && locale !== defaultLocale) {
    const t = node.slugs?.[locale]
    if (typeof t === 'string' && t !== '') return t
  }
  return node.slug
}

/** The title of a node in a language, falling back to the default. */
export function titleIn(node: TreeNode, locale: string | null, defaultLocale: string | null): string {
  if (locale && locale !== defaultLocale) {
    const t = node.titles?.[locale]
    if (typeof t === 'string' && t !== '') return t
  }
  return node.title ?? ''
}

/**
 * The nodes from the top of the tree down to `id` (the node itself last). Stops at an
 * unknown parent or a loop (a stored loop cannot be made through the API).
 */
export function chainOf(index: TreeIndex, id: string): TreeNode[] {
  const out: TreeNode[] = []
  const seen = new Set<string>()
  let cur = index.get(id)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    out.unshift(cur)
    cur = cur.parentId ? index.get(cur.parentId) : undefined
  }
  return out
}

/** Level of a node: 1 for a top-level page. */
export function depthOf(index: TreeIndex, id: string): number {
  return chainOf(index, id).length
}

export function childrenMap(nodes: Iterable<TreeNode>): Map<string | null, TreeNode[]> {
  const out = new Map<string | null, TreeNode[]>()
  for (const n of nodes) {
    const list = out.get(n.parentId) ?? []
    list.push(n)
    out.set(n.parentId, list)
  }
  return out
}

/** Siblings in their order (position, then title, then id so the order never wobbles). */
export function sortSiblings(list: TreeNode[]): TreeNode[] {
  return [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || (a.title ?? '').localeCompare(b.title ?? '') || (a.id < b.id ? -1 : 1))
}

/** Everything below a node (not the node), parents before children, siblings in order. */
export function descendantsOf(index: TreeIndex, id: string, children = childrenMap(index.values())): TreeNode[] {
  const out: TreeNode[] = []
  const seen = new Set<string>([id])
  const walk = (parent: string) => {
    for (const c of sortSiblings(children.get(parent) ?? [])) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c)
      walk(c.id)
    }
  }
  walk(id)
  return out
}

/** Levels below a node: 0 for a page without children. */
export function heightOf(index: TreeIndex, id: string, children = childrenMap(index.values())): number {
  const walk = (cur: string, seen: Set<string>): number => {
    let h = 0
    for (const c of children.get(cur) ?? []) {
      if (seen.has(c.id)) continue
      h = Math.max(h, 1 + walk(c.id, new Set([...seen, c.id])))
    }
    return h
  }
  return walk(id, new Set([id]))
}

/** One node's chain of address parts in a language: ['o-nas', 'tym']. */
export function slugChain(index: TreeIndex, id: string, locale: string | null, defaultLocale: string | null): string[] {
  return chainOf(index, id).map((n) => slugIn(n, locale, defaultLocale))
}

/**
 * The address of a node in a language, prefix included ('/en/about/team'), or null
 * when the collection has no page in that language. The ancestors' address parts are
 * joined with '/', each escaped for a URL.
 */
export function treeAddress(
  locales: LocalesDef | null, template: PathTemplate | undefined | null, key: string,
  index: TreeIndex, id: string, locale: string | null,
): string | null {
  const node = index.get(id)
  if (!node) return null
  const parts = slugChain(index, id, locale, locales?.default ?? null)
  return sitePath(locales, template, locale, { [key]: parts })
}

/** What is wrong with a proposed change of a tree; the server turns it into a 422 or 409. */
export type TreeProblem =
  | { code: 'tree_cycle'; message: string; loop: string[] }
  | { code: 'tree_depth'; message: string; depth: number; maxDepth: number }
  | { code: 'tree_parent_missing'; message: string }
  | { code: 'tree_address_taken'; message: string; locale: string | null; path: string; otherId: string; otherTitle: string }

export interface TreeChange {
  /** The entry being created (its id is already chosen) or changed. */
  id: string
  /** The entry's parent after the change (null: top level). */
  parentId: string | null
  /** The entry's default-language address part after the change. */
  slug: string
  /** A translation's address part after the change (`{ en: 'about' }`, null/'' = falls back). */
  slugs?: Record<string, string | null | undefined>
  title?: string
  /** Languages the entry has a translation in after the change (default: as stored, plus those in `slugs`). */
  locales?: string[]
}

/** The tree as it would be after a change (the node added or replaced). */
export function applyChange(nodes: TreeNode[], change: TreeChange): TreeNode[] {
  const existing = nodes.find((n) => n.id === change.id)
  const next: TreeNode = {
    ...(existing ?? { id: change.id }),
    id: change.id,
    parentId: change.parentId,
    slug: change.slug,
    slugs: { ...(existing?.slugs ?? {}), ...(change.slugs ?? {}) },
    title: change.title ?? existing?.title,
    locales: change.locales ?? [...new Set([...(existing?.locales ?? []), ...Object.keys(change.slugs ?? {})])],
  }
  return [...nodes.filter((n) => n.id !== change.id), next]
}

export interface TreeCheckOptions {
  maxDepth: number
  locales: LocalesDef | null
  /** The collection's address template, to compare complete addresses. */
  template: PathTemplate | undefined | null
  key: string
}

/**
 * Check a change against the tree as it stands: it must not make an entry its own
 * ancestor, must not go deeper than `maxDepth` (counting the subtree it carries), and
 * the addresses of the entry and everything below it must stay unique per language.
 * Addresses that were already shared before (older data) do not block an unrelated edit:
 * only the entry and what is below it are compared, and only against others.
 */
export function checkTreeChange(nodes: TreeNode[], change: TreeChange, opts: TreeCheckOptions): TreeProblem | null {
  const titleOf = (n: TreeNode | undefined) => n?.title || '…'
  const after = indexTree(applyChange(nodes, change))

  if (change.parentId) {
    if (!after.has(change.parentId)) return { code: 'tree_parent_missing', message: 'The page above does not exist' }
    // A loop: walking up from the new parent meets the entry itself.
    const up: TreeNode[] = []
    const seen = new Set<string>()
    for (let cur = after.get(change.parentId); cur && !seen.has(cur.id); cur = cur.parentId ? after.get(cur.parentId) : undefined) {
      up.push(cur)
      seen.add(cur.id)
      if (cur.id === change.id) {
        // Read downwards: entry → … → new parent → entry.
        const chain = [...up.map((n) => titleOf(n)).reverse(), titleOf(after.get(change.id))]
        return { code: 'tree_cycle', message: `This would make a loop: ${chain.join(' → ')}`, loop: chain }
      }
    }
  }

  const children = childrenMap(after.values())
  const depth = depthOf(after, change.id) + heightOf(after, change.id, children)
  if (depth > opts.maxDepth) {
    return { code: 'tree_depth', message: `Pages can be nested ${opts.maxDepth} levels deep at most (this would make ${depth})`, depth, maxDepth: opts.maxDepth }
  }

  // Addresses of the entry and its descendants, against everyone else's, per language
  // (only entries that exist in that language have an address there).
  const affected = new Set([change.id, ...descendantsOf(after, change.id, children).map((n) => n.id)])
  const def = opts.locales?.default ?? null
  for (const locale of opts.locales ? opts.locales.locales : [null]) {
    const taken = new Map<string, string>()
    const address = (id: string) => treeAddress(opts.locales, opts.template, opts.key, after, id, locale)
    for (const n of after.values()) {
      if (affected.has(n.id) || !existsIn(n, locale, def)) continue
      const path = address(n.id)
      if (path !== null && !taken.has(path)) taken.set(path, n.id)
    }
    for (const id of affected) {
      if (!existsIn(after.get(id)!, locale, def)) continue
      const path = address(id)
      if (path === null) continue
      const other = taken.get(path)
      if (other) {
        return {
          code: 'tree_address_taken', locale, path, otherId: other, otherTitle: titleOf(after.get(other)),
          message: `The address ${path} is already used by “${titleOf(after.get(other))}”`,
        }
      }
      taken.set(path, id) // two of the affected entries on one address
    }
  }
  return null
}

/** An address that changed with a write: where it was and where it is now. */
export interface MovedPath { id: string; locale: string | null; from: string; to: string }

/**
 * The entries (`ids`) whose address differs between two states of the tree, in every
 * language: a page that is not translated is still reachable at the address it falls back
 * to (the tree and the item's `path` give it), so that moves too. An entry that is new has
 * nothing to move from; one that lost its translation moves to the address it now falls
 * back to; one that got its first translation does not move (its default-language address
 * still finds it).
 */
export function movedPaths(
  before: TreeNode[], after: TreeNode[], ids: string[],
  opts: { locales: LocalesDef | null; template: PathTemplate | undefined | null; key: string },
): MovedPath[] {
  const a = indexTree(before)
  const b = indexTree(after)
  const def = opts.locales?.default ?? null
  const out: MovedPath[] = []
  for (const id of ids) {
    const was = a.get(id)
    const now = b.get(id)
    if (!was || !now) continue
    for (const locale of opts.locales ? opts.locales.locales : [null]) {
      // A first translation is not a move: the default-language address it replaced still finds the page.
      if (!existsIn(was, locale, def) && existsIn(now, locale, def)) continue
      const from = treeAddress(opts.locales, opts.template, opts.key, a, id, locale)
      const to = treeAddress(opts.locales, opts.template, opts.key, b, id, locale)
      if (from && to && from !== to) out.push({ id, locale, from, to })
    }
  }
  return out
}
