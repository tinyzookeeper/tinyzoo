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

/**
 * The entry's own "is live" condition, against `t` (its table, or an alias of it). For a language
 * of an entity that publishes per language, the default language gates: the translation is live
 * only while the entry itself is live (status, schedule and the site's own `content.published`
 * rule) AND the language's own state is live too. A translation that follows has no state of its
 * own, so it is live exactly when the entry is; one with a date of its own goes live at the later
 * of the two dates (both schedules must have come).
 */
export function ownPublishedCond(e: CmsEntity, t: any = e.table, locale?: string | null): any {
  const entry = entryLiveCond(e, t)
  if (!locale || !perLocalePublishing(e)) return entry
  return and(entry, entryLiveCond(e, localeView(e, t, locale)))
}

/** The rule that decides "live" for one view of an entry (the entry itself, or a language's `localeView`). */
function entryLiveCond(e: CmsEntity, view: any): any {
  const p = e.publish
  const status = p ? eq(view[propOf(p.field, e.fields[p.field]!)], p.publishedValue) : undefined
  const base: any = e.content?.published ? e.content.published(view) : status
  return and(base, scheduleCond(e, view))
}

/**
 * The entry as one language sees its state: a table whose status and publish date columns
 * are SQL for the state in effect in `locale`. A translation with a state of its own
 * (`published` is set) that has been on the website answers with that, its date included; a
 * translation without one, one being worked on (never on the website: see
 * `shownTranslationCond`), or no translation at all, follows the entry. So the same rule that decides what is live
 * (`content.published` of the site, the schedule) runs unchanged against this view. For the
 * default language there is never a translation row, so the view is the entry itself.
 * This is the language's own state only: that the default language gates it (a translation is
 * live only while the entry is) is `ownPublishedCond`'s doing, which asks both.
 */
export function localeView(e: CmsEntity, t: any, locale: string): any {
  const p = e.publish!
  const lt = e.localesTable
  const statusKey = propOf(p.field, e.fields[p.field]!)
  const dateKey = p.dateField ? propOf(p.dateField, e.fields[p.dateField]!) : undefined
  // A state of its own counts only once the language has been on the website: before that (a translation
  // being worked on) visitors see what they saw without it, the default language through fallback.
  const mine = sql`${lt.parentId} = ${t.id} and ${lt.locale} = ${locale} and ${lt.published} is not null and ${lt.firstLiveAt} <= now()`
  const status = sql`coalesce((select case when ${lt.published} then ${p.publishedValue} else ${p.draftValue} end from ${lt} where ${mine}), (${t[statusKey]})::text)`
  const date = dateKey
    ? sql`(case when exists (select 1 from ${lt} where ${mine}) then (select ${lt.publishedAt} from ${lt} where ${mine}) else ${t[dateKey]} end)`
    : undefined
  return new Proxy(t, {
    get: (target, prop, receiver) => (prop === statusKey ? status : prop === dateKey ? date : Reflect.get(target, prop, receiver)),
  })
}

/**
 * Publishing per language: the translation rows visitors see, as a condition on the translation
 * table (undefined for an entity that publishes as one: every row is seen). A row is seen while it
 * follows the default language (`published` null) or once the language has been on the website in
 * its own right (`first_live_at` passed; a scheduled language's is its date). A row with a state of
 * its own that never was is a translation **being worked on**: visitors do not see its text, its
 * address or its state; they get what they got without it (the default language, through fallback).
 * An editor's preview sees it. Everything that reads translation text for visitors adds this.
 */
export function shownTranslationCond(e: CmsEntity, lt: any = e.localesTable): any {
  if (!perLocalePublishing(e)) return undefined
  // Never null (a null first_live_at would make `not (…)` of it null too).
  return sql`coalesce(${or(isNull(lt.published), lte(lt.firstLiveAt, sql`now()`))}, false)`
}

/**
 * Publishing per language: is this translation row (as read) one being worked on — a draft of its
 * own that was never on the website (see `shownTranslationCond`)? `now` is the time to judge by.
 * (A language scheduled for the first time is not seen by visitors before its date either, but it is
 * published: not this.)
 */
export function isBeingTranslated(tr: Record<string, any> | null | undefined, now: number = Date.now()): boolean {
  if (!tr || tr.published !== false) return false
  return !tr.firstLiveAt || new Date(tr.firstLiveAt).getTime() > now
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
