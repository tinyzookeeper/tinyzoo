import { alias, and, eq, inArray, isNull, lte, or, propOf, snake, sql } from 'tinyzoo'
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
 *
 * `locale`: the language the visitor asks for. It matters only for an entity with
 * `publish.perLocale`, where a translation may have a state of its own (see `localeView`);
 * every other entity is live in all languages or in none, as ever. Without a language, or
 * for the default language, it is the entry's own state.
 */
export function publishedCond(e: CmsEntity, locale?: string | null): any {
  return and(ownPublishedCond(e, e.table, locale), ancestorsLiveCond(e))
}

/** Does this entity publish each language on its own (`publish.perLocale`)? */
export function perLocalePublishing(e: CmsEntity): boolean {
  return !!e.publish?.perLocale && !!e.localesTable
}

/** The entry's own "is live" condition, against `t` (its table, or an alias of it). */
export function ownPublishedCond(e: CmsEntity, t: any = e.table, locale?: string | null): any {
  const p = e.publish
  const view = locale && perLocalePublishing(e) ? localeView(e, t, locale) : t
  const status = p ? eq(view[propOf(p.field, e.fields[p.field]!)], p.publishedValue) : undefined
  const base: any = e.content?.published ? e.content.published(view) : status
  return and(base, scheduleCond(e, view))
}

/**
 * The entry as one language sees its state: a table whose status and publish date columns
 * are SQL for the state in effect in `locale`. A translation with a state of its own
 * (`published` is set) answers with that, its date included; a translation without one, or
 * no translation at all, follows the entry. So the same rule that decides what is live
 * (`content.published` of the site, the schedule) runs unchanged against this view. For the
 * default language there is never a translation row, so the view is the entry itself.
 */
export function localeView(e: CmsEntity, t: any, locale: string): any {
  const p = e.publish!
  const lt = e.localesTable
  const statusKey = propOf(p.field, e.fields[p.field]!)
  const dateKey = p.dateField ? propOf(p.dateField, e.fields[p.dateField]!) : undefined
  const mine = sql`${lt.parentId} = ${t.id} and ${lt.locale} = ${locale}`
  const status = sql`coalesce((select case when ${lt.published} then ${p.publishedValue} else ${p.draftValue} end from ${lt} where ${mine} and ${lt.published} is not null), (${t[statusKey]})::text)`
  const date = dateKey
    ? sql`(case when exists (select 1 from ${lt} where ${mine} and ${lt.published} is not null) then (select ${lt.publishedAt} from ${lt} where ${mine}) else ${t[dateKey]} end)`
    : undefined
  return new Proxy(t, {
    get: (target, prop, receiver) => (prop === statusKey ? status : prop === dateKey ? date : Reflect.get(target, prop, receiver)),
  })
}

/**
 * Live in at least one of `locales` (for an entity that publishes per language), else the
 * ordinary condition: what the sitemap, links and the like select before they look at each
 * language.
 */
export function liveInAnyCond(e: CmsEntity, locales: readonly string[]): any {
  const own = publishedCond(e)
  if (!perLocalePublishing(e) || !own) return own
  const others = locales.map((l) => publishedCond(e, l)).filter(Boolean)
  return others.length === locales.length ? or(own, ...others) : undefined
}

/**
 * For each id, the languages it is live in, among `locales` (all of them for an entity that
 * publishes as one). One query, a column per language.
 */
export async function liveLanguages(db: any, e: CmsEntity, ids: string[], locales: readonly string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>()
  if (!ids.length || !locales.length) return out
  const cols: Record<string, any> = { id: e.table.id }
  locales.forEach((l, i) => { cols[`l${i}`] = sql<boolean>`coalesce(${publishedCond(e, l) ?? sql`true`}, false)` })
  const rows: any[] = await db.select(cols).from(e.table).where(inArray(e.table.id, ids))
  for (const r of rows) out.set(r.id, new Set(locales.filter((_, i) => r[`l${i}`] === true)))
  return out
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
