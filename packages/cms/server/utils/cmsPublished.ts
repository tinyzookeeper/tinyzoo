import { alias, and, eq, isNull, lte, or, propOf, snake, sql } from 'tinyzoo'
import type { CmsEntity } from 'tinyzoo'

// What is live, as a Drizzle condition. With explicit imports only (no Nitro auto-imports):
// `tinyzoo links:convert` uses it too, outside Nitro. (Drizzle's `and` leaves out a condition
// that is undefined, so "no condition" needs no special case.)

/**
 * The "is live" Drizzle condition for an entity (undefined = everything is public):
 * `content.published` — or, without one, the publish workflow's status — and, for
 * scheduled entries, a publish date that has come. In a page tree every ancestor must
 * be live too: a page under a draft is not on the website. Everything that decides what
 * visitors see goes through here: the content API, populated references, the sitemap,
 * webhooks.
 */
export function publishedCond(e: CmsEntity): any {
  return and(ownPublishedCond(e), ancestorsLiveCond(e))
}

/** The entry's own "is live" condition, against `t` (its table, or an alias of it). */
export function ownPublishedCond(e: CmsEntity, t: any = e.table): any {
  const p = e.publish
  const status = p ? eq(t[propOf(p.field, e.fields[p.field]!)], p.publishedValue) : undefined
  const base: any = e.content?.published ? e.content.published(t) : status
  return and(base, scheduleCond(e, t))
}

/** "Its publish date has come" (or it has none), for entities whose publishing is scheduled. */
export function scheduleCond(e: CmsEntity, t: any = e.table): any {
  const p = e.publish
  if (!p?.dateField || p.schedule === false) return undefined
  const col = t[propOf(p.dateField, e.fields[p.dateField]!)]
  return or(isNull(col), lte(col, sql`now()`))
}

/**
 * Page tree: every ancestor is live too. One nested `exists` per level the tree may have
 * (`tree.maxDepth - 1`), each stopping at a top-level page, so a query pays for the
 * depth a page actually has. (Lowering `maxDepth` later does not move pages that are
 * already deeper; such a page is judged by its nearest ancestors only.)
 */
export function ancestorsLiveCond(e: CmsEntity): any {
  if (!e.tree) return undefined
  const parentProp = `${e.tree.parent}Id`
  const level = (t: any, depth: number): any => {
    if (depth <= 0) return undefined
    const a: any = alias(e.table, `${snake(e.name)}_up${depth}`)
    const inner = and(eq(a.id, t[parentProp]), ownPublishedCond(e, a), level(a, depth - 1))
    return or(isNull(t[parentProp]), sql`exists (select 1 from ${e.table} ${a} where ${inner})`)
  }
  return level(e.table, e.tree.maxDepth - 1)
}
