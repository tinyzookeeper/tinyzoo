import { eq, inArray, sql } from 'tinyzoo'
// Address helpers live apart, without Nitro auto-imports: the CLI (links:convert) uses them too.
import { loadTreeNodes, treeOptions, treePathIn, treeProps, treeVersions } from './cmsTreeAddress'
import {
  applyChange, checkTreeChange, childrenMap, chainOf, descendantsOf, existsIn, indexTree, movedPaths, slugChain, titleIn, treeAddress,
  type CmsEntity, type CmsRegistry, type MovedPath, type TreeChange, type TreeIndex, type TreeNode, type TreeProblem,
} from 'tinyzoo'

/**
 * The page tree on the server (`definePages({ tree: true })`; the rules themselves are
 * pure and live in src/tree.ts). A tree is small (pages, not posts), so it is read whole,
 * in two queries, whenever an address or a check needs it: nothing is cached, so a move
 * is seen by the very next request on every replica.
 *
 * Addresses go through ONE function, `localePaths` (cmsSitemap.ts), which the sitemap, the
 * change reports, the website's search and the link picker all use; it asks `treeVersions`
 * here for entities that are trees.
 */

const LOCK_NAMESPACE = 72_011_050

/**
 * The entry's trail from the top of the tree down to itself, in a language: title and
 * address of each. Without `includeDrafts` only live ancestors are listed (`live` holds
 * the ids that are live, ancestors included).
 */
export function treeBreadcrumbs(reg: CmsRegistry, e: CmsEntity, index: TreeIndex, id: string, locale: string | null, live?: Set<string>): { title: string; path: string }[] {
  const def = reg.locales?.default ?? null
  const out: { title: string; path: string }[] = []
  for (const n of chainOf(index, id)) {
    if (live && !live.has(n.id)) continue
    const path = treePathIn(reg, e, index, n.id, locale)
    if (path) out.push({ title: titleIn(n, locale, def), path })
  }
  return out
}

/**
 * The entry whose chain of address parts ('o-nas/tym') matches `chain` in `locale`, in this
 * order: pages translated into that language, by their translated parts; any page, by the
 * parts it has in that language (the default ones where it is not translated: the address
 * the tree and `paths` give for it); any page by its default-language parts (served in the
 * language asked for, its untranslated texts falling back as for any other collection).
 */
export function findByChain(reg: CmsRegistry, index: TreeIndex, chain: string, locale: string | null): TreeNode | null {
  const def = reg.locales?.default ?? null
  const want = chain.split('/').filter(Boolean).join('/')
  if (!want) return null
  const l = locale && locale !== def && reg.locales?.locales.includes(locale) ? locale : null
  const tries: { lang: string | null; onlyTranslated: boolean }[] = [...(l ? [{ lang: l, onlyTranslated: true }, { lang: l, onlyTranslated: false }] : []), { lang: def, onlyTranslated: false }]
  for (const { lang, onlyTranslated } of tries) {
    for (const n of index.values()) {
      if (onlyTranslated && !existsIn(n, lang, def)) continue
      if (slugChain(index, n.id, lang, def).join('/') === want) return n
    }
  }
  return null
}

/**
 * Lock the tree for the rest of the transaction, so two writes that look at the tree
 * and then change it (a move, a new page under the same parent) cannot both pass.
 */
export async function lockTree(tx: any, e: CmsEntity): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_NAMESPACE}, hashtext(${e.name}))`)
}

/** The refusal for a problem found by `checkTreeChange`: 422 on the parent, 409 for a taken address. */
export function treeError(p: TreeProblem) {
  const taken = p.code === 'tree_address_taken'
  return createError({
    statusCode: taken ? 409 : 422,
    statusMessage: taken ? 'Value already in use' : 'Validation failed',
    data: [{
      path: [taken ? 'slug' : 'parent'],
      // 'unique' is what the admin's duplicate action waits for to try the next "-copy".
      code: taken ? 'unique' : p.code,
      message: p.message,
      ...(p.code === 'tree_cycle' ? { loop: p.loop } : {}),
      ...(p.code === 'tree_depth' ? { depth: p.depth, maxDepth: p.maxDepth } : {}),
      ...(taken ? { address: p.path, locale: p.locale, otherId: p.otherId, otherTitle: p.otherTitle } : {}),
    }],
  })
}

/** The tree as it stands, checked against a change (throws the matching 409/422). */
export function assertTreeChange(nodes: TreeNode[], reg: CmsRegistry, e: CmsEntity, change: TreeChange): void {
  const problem = checkTreeChange(nodes, change, treeOptions(reg, e))
  if (problem) throw treeError(problem)
}

/** Position after the last sibling under a parent (for a new page). */
export function nextPosition(nodes: TreeNode[], parentId: string | null): number {
  const sib = nodes.filter((n) => n.parentId === parentId)
  return sib.length ? Math.max(...sib.map((n) => n.position ?? 0)) + 1 : 0
}

/** What a tree write did to addresses and to what visitors can see: for redirects and the change report. */
export interface TreeEffect {
  /** Addresses that changed: the entry and everything below it, in every language. */
  moved: MovedPath[]
  /** Redirects written (created or pointed at a new address). */
  redirects: { id: string; from: string; to: string }[]
}

/**
 * Leave redirects for addresses that moved while they were live (the entry and every
 * descendant, in every language): old → new, 301, through `defineRedirects`. A site
 * without redirects gets none (the change report still lists what moved).
 *
 * Redirects that already pointed at an old address are pointed at the new one (no
 * chains), and a redirect from an address something now lives at is removed.
 * Runs in the transaction of the write, so a move and its redirects land together.
 */
export async function writeTreeRedirects(tx: any, reg: CmsRegistry, moved: MovedPath[], wasLive: Set<string>, isLive: Set<string>, actor: string | null): Promise<TreeEffect['redirects']> {
  const re = redirectEntity(reg)
  const due = moved.filter((m) => wasLive.has(m.id) && isLive.has(m.id))
  if (!re || !due.length) return []
  const table = re.table
  // Something lives at the new addresses now: a redirect away from one would hide it.
  await tx.delete(table).where(inArray(table.from, due.map((m) => m.to)))
  const out: TreeEffect['redirects'] = []
  for (const m of due) {
    // Redirects that led to the old address lead to the new one (a chain would cost visitors a hop each).
    await tx.update(table).set({ to: m.to, updatedAt: sql`now()`, updatedBy: actor }).where(eq(table.to, m.from))
    const [row] = await tx.insert(table).values({ from: m.from, to: m.to, permanent: true, createdBy: actor, updatedBy: actor })
      .onConflictDoUpdate({ target: table.from, set: { to: m.to, permanent: true, updatedAt: sql`now()`, updatedBy: actor } })
      .returning({ id: table.id })
    out.push({ id: row.id, from: m.from, to: m.to })
  }
  invalidateRedirects()
  return out
}

/** Tell the website and the other replicas about redirects written by `writeTreeRedirects`. */
export async function reportTreeRedirects(event: any, reg: CmsRegistry, redirects: TreeEffect['redirects']): Promise<void> {
  const re = redirectEntity(reg)
  if (!re) return
  for (const r of redirects) await reportChange(event, { type: 'entry.created', entity: re, id: r.id, noRevision: true })
}

/**
 * Everything a write to an entry of a tree needs, in one place: lock the tree, load
 * it, refuse what is wrong (a loop, too deep, an address taken), and — after the caller
 * wrote the change — list what moved. Pass the proposed change; call `after()` once the
 * row is saved, in the same transaction.
 */
export async function beginTreeWrite(tx: any, reg: CmsRegistry, e: CmsEntity, change: TreeChange | ((nodes: TreeNode[]) => TreeChange)) {
  await lockTree(tx, e)
  const nodes = await loadTreeNodes(tx, reg, e)
  const c = typeof change === 'function' ? change(nodes) : change
  assertTreeChange(nodes, reg, e, c)
  const next = applyChange(nodes, c)
  return { nodes, next, change: c }
}

/** Ids of an entry and everything below it, in a given state of the tree. */
export function subtreeIds(nodes: TreeNode[], id: string): string[] {
  const index = indexTree(nodes)
  return [id, ...descendantsOf(index, id, childrenMap(nodes)).map((n) => n.id)]
}

/** Which of these entries are live (published, every ancestor too, scheduling included). */
export async function liveAmong(db: any, e: CmsEntity, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const rows: any[] = await db.select({ id: e.table.id }).from(e.table).where(both(inArray(e.table.id, ids), publishedCond(e)))
  return new Set(rows.map((r) => r.id))
}

/** What the effect of a write on the tree is: addresses moved and who was live before and after. */
export async function treeEffect(tx: any, reg: CmsRegistry, e: CmsEntity, before: TreeNode[], after: TreeNode[], id: string, wasLive: Set<string>, actor: string | null): Promise<TreeEffect> {
  const ids = subtreeIds(after, id)
  const moved = movedPaths(before, after, ids, treeOptions(reg, e))
  if (!moved.length) return { moved, redirects: [] }
  const isLive = await liveAmong(tx, e, ids)
  const redirects = await writeTreeRedirects(tx, reg, moved, wasLive, isLive, actor)
  // The report only lists addresses a visitor could have reached or can reach now.
  return { moved: moved.filter((m) => wasLive.has(m.id) || isLive.has(m.id)), redirects }
}

/**
 * Items of a page tree carry `path` (their address in the language served, ancestors'
 * address parts included) and `breadcrumbs` (title and address from the top of the
 * tree down to the page itself). Mirrored by content-shape.
 * Visitors only get live pages and so only live ancestors; with `drafts` (an editor's
 * preview) the trail is the real one, drafts included.
 */
export async function attachTreeInfo(db: any, reg: CmsRegistry, e: CmsEntity, rows: any[], items: any[], locale: string | null): Promise<void> {
  if (!e.tree || !rows.length) return
  const index = indexTree(await loadTreeNodes(db, reg, e))
  rows.forEach((row, i) => {
    items[i].path = treePathIn(reg, e, index, row.id, locale)
    items[i].breadcrumbs = treeBreadcrumbs(reg, e, index, row.id, locale)
  })
}

/** Refuse to delete an entry that has pages under it (409, listing a few of them). No cascade: nothing below disappears by accident. */
export async function assertNoChildren(db: any, e: CmsEntity, id: string): Promise<void> {
  const p = treeProps(e)
  const kids: any[] = await db.select({ id: e.table.id, title: e.table[p.title] }).from(e.table).where(eq(e.table[p.parent], id)).limit(6)
  if (!kids.length) return
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(e.table).where(eq(e.table[p.parent], id))
  throw createError({
    statusCode: 409, statusMessage: 'This page has pages under it; move or delete them first',
    data: { code: 'has_children', count, children: kids.slice(0, 5).map((k) => ({ id: k.id, title: k.title == null ? '' : String(k.title) })) },
  })
}
