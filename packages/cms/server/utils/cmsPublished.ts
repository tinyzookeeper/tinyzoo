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
 * Page tree: every ancestor is live too. The whole chain up to the top is walked (a
 * recursive query, so a page that sits deeper than `tree.maxDepth` allows today — the
 * limit was lowered after it was made — is judged by all of its ancestors, not only by the
 * nearest ones). Stops at a top-level page; a page without a parent pays nothing.
 */
export function ancestorsLiveCond(e: CmsEntity): any {
  if (!e.tree) return undefined
  const parentProp = `${e.tree.parent}Id`
  const base = snake(e.name)
  const first: any = alias(e.table, `${base}_up`)
  const step: any = alias(e.table, `${base}_upn`)
  const live = (t: any) => sql`coalesce(${ownPublishedCond(e, t) ?? sql`true`}, false)`
  // `union` (not `union all`) drops a row it has seen, so a loop in stored data ends the walk.
  return or(isNull(e.table[parentProp]), sql`not exists (
    with recursive up(id, parent_id, live) as (
      select ${first.id}, ${first[parentProp]}, ${live(first)} from ${e.table} ${first} where ${first.id} = ${e.table[parentProp]}
      union
      select ${step.id}, ${step[parentProp]}, ${live(step)} from ${e.table} ${step} join up on ${step.id} = up.parent_id
    ) select 1 from up where not up.live
  )`)
}
