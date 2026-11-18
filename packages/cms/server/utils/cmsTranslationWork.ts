import { and, eq, isNull, ne, not, or, propOf, sql } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'
// Explicit imports (no Nitro auto-imports): the unit tests build these conditions outside Nitro.
import { perLocalePublishing, publishedCond, shownTranslationCond } from './cmsPublished'

/**
 * Where the translation of an entry into one language stands, as SQL: what the list's language
 * filter asks ("English: Not translated") and what the home page's "Needs translating" lists.
 *
 *  - `missing`: nothing translated yet (publishing per language: and no draft of its own either).
 *  - `translating`: a draft of its own that was never on the website (being translated).
 *  - `draft`: not on the website in this language: a draft of its own that was there before (taken
 *    off), or a translation that follows the default language while that one is a draft.
 *  - `published`: translated and on the website in this language now.
 *  - `translated`: translated, whatever its state (for entities without a publish workflow).
 *  - `todo`: needs translating: live or scheduled in the default language, and here `missing`,
 *    `translating` or a `draft` of its own. (Who may do it is the caller's business: `todo` in
 *    the list and on the home page is narrowed to what the person may update.)
 *
 * The first four never overlap. A language that is scheduled, or waits for the default language,
 * is in none of them.
 */
export const LANGUAGE_FILTERS = ['todo', 'missing', 'translating', 'draft', 'published', 'translated'] as const
export type LanguageFilter = (typeof LANGUAGE_FILTERS)[number]

/** The query parameter of a language filter: `filter.lang:en=missing` (a field key never holds a colon). */
export const LANGUAGE_FILTER_PREFIX = 'filter.lang:'

/** What a rich text holds once something is written: a node that is not an empty paragraph. */
const DOC_FILLED = '$.content[*] ? (!exists(@.type) || @.type != "paragraph" || exists(@.content[*]))'

/**
 * "This JSON value holds something", as `isEmpty` (cmsLocales.ts) decides it: a non-empty string,
 * a number or a yes/no, a list with items, a rich text with a node that is not an empty paragraph,
 * an object (a group) with any such value. `depth` bounds how deep a group is looked into.
 */
export function jsonFilledSql(x: any, depth = 3, alias = 'v'): any {
  const kv = sql.raw(`${alias}${depth}`)
  const inGroup = depth > 0
    ? sql`exists (select 1 from jsonb_each(${x}) as ${kv}(k, v) where ${jsonFilledSql(sql`${kv}.v`, depth - 1, alias)})`
    : sql`${x} <> '{}'::jsonb`
  return sql`(case jsonb_typeof(${x})
    when 'string' then (${x} #>> '{}') <> ''
    when 'number' then true
    when 'boolean' then true
    when 'array' then jsonb_array_length(${x}) > 0
    when 'object' then (case when ${x} ->> 'type' = 'doc' then jsonb_path_exists(${x}, ${DOC_FILLED}::jsonpath) else ${inGroup} end)
    else false end)`
}

/** "This translated column holds something" (text and addresses are text columns; the rest is JSON). */
export function columnFilledSql(e: CmsEntity, key: string, col: any): any {
  const type = e.fields[key]?.type
  return type === 'text' || type === 'slug' ? sql`coalesce(${col}, '') <> ''` : sql`coalesce(${jsonFilledSql(col)}, false)`
}

/**
 * The language's translation row of the entry, with `extra` (a condition on that row). `lt` is the
 * translation table: its columns are written out by name, so the condition reads the row, not the
 * entry it belongs to.
 */
function rowIn(e: CmsEntity, locale: string, extra: any = sql`true`): any {
  const lt = e.localesTable
  return sql`exists (select 1 from ${lt} where ${lt.parentId} = ${e.table.id} and ${lt.locale} = ${locale} and ${extra})`
}

/**
 * "Translated into `locale`": the translation holds text in one of `keys` (the translated fields
 * this person may read: a field hidden from them must not tell them whether it is translated).
 * Without per-language publishing a translation row is there only with text, so having one is
 * enough while every translated field is readable (what the list's language column says).
 */
export function translatedCond(e: CmsEntity, locale: string, keys: readonly string[] = e.localized): any {
  const lt = e.localesTable
  if (!lt || !keys.length) return sql`false`
  if (!perLocalePublishing(e) && keys.length === e.localized.length) return rowIn(e, locale)
  return rowIn(e, locale, or(...keys.map((k) => columnFilledSql(e, k, lt[k]))))
}

/** The entry's own status (the default language) is a draft. */
function entryDraft(e: CmsEntity): any {
  const p = e.publish!
  const col = e.table[propOf(p.field, e.fields[p.field]!)]
  return or(isNull(col), ne(col, p.publishedValue))
}

/** The entry is live or scheduled in the default language (its status says published; the date may be ahead). */
export function entryPublishedOrScheduled(e: CmsEntity): any {
  const p = e.publish
  if (!p) return undefined
  return eq(e.table[propOf(p.field, e.fields[p.field]!)], p.publishedValue)
}

/** The parts every state is made of, for one entity and language. */
function parts(e: CmsEntity, locale: string, keys: readonly string[]) {
  const lt = e.localesTable
  const per = perLocalePublishing(e)
  const translated = translatedCond(e, locale, keys)
  const ownDraft = per ? rowIn(e, locale, sql`${lt.published} = false`) : sql`false`
  // Never on the website (no date it went live, or one still ahead): being translated (shownTranslationCond).
  const neverLive = sql`(${lt.firstLiveAt} is null or ${lt.firstLiveAt} > now())`
  const translating = per ? rowIn(e, locale, sql`${lt.published} = false and ${neverLive}`) : sql`false`
  const ownDraftBefore = per ? rowIn(e, locale, sql`${lt.published} = false and ${lt.firstLiveAt} <= now()`) : sql`false`
  const ownState = per ? rowIn(e, locale, sql`${lt.published} is not null`) : sql`false`
  const missing = per ? and(not(translated), not(ownDraft)) : not(translated)
  return { per, translated, ownDraft, translating, ownDraftBefore, ownState, missing }
}

/**
 * One language state of an entry as a condition (see LANGUAGE_FILTERS). `keys`: the translated
 * fields that count (those the person may read). `todo` here is about the content only: the caller
 * narrows it to what the person may update.
 */
export function languageStateCond(e: CmsEntity, locale: string, state: LanguageFilter, keys: readonly string[] = e.localized): any {
  if (!e.localesTable || !e.localized.length) return sql`false`
  const x = parts(e, locale, keys)
  switch (state) {
    case 'missing': return x.missing
    case 'translating': return x.translating
    case 'translated': return x.translated
    case 'draft':
      if (!e.publish) return sql`false`
      // Taken off on its own, or translated and following a default language that is a draft.
      return x.per ? or(x.ownDraftBefore, and(x.translated, not(x.ownState), entryDraft(e))) : and(x.translated, entryDraft(e))
    case 'published':
      // Its text is what visitors read: not one being translated, nor one whose first date is still ahead.
      return and(x.translated, x.per ? rowIn(e, locale, shownTranslationCond(e)) : undefined, publishedCond(e, locale) ?? sql`true`)
    case 'todo':
      return and(entryPublishedOrScheduled(e), x.per ? or(x.missing, x.ownDraft) : x.missing)
  }
}

/**
 * What a language needing translation is waiting for, as one word (an SQL `case`): `translating`,
 * `draft` (one of its own, taken off the website) or `missing`. Meant for rows that are `todo`.
 */
export function workStateSql(e: CmsEntity, locale: string): any {
  const x = parts(e, locale, e.localized)
  return sql<string>`(case when ${x.translating} then 'translating' when ${x.ownDraft} then 'draft' else 'missing' end)`
}

/**
 * The language filters a list request asks for: `filter.lang:<code>=<state>[,<state>…]`, for each
 * translation language of the site (never the default one: its state is the status tabs'). Unknown
 * languages, states and entities without translations are ignored, like other unknown filters.
 */
export function parseLanguageFilters(e: CmsEntity, reg: Pick<CmsRegistry, 'locales'>, query: Record<string, any>): { locale: string; states: LanguageFilter[] }[] {
  const locales = reg.locales
  if (!locales || !e.localized?.length || !e.localesTable) return []
  const out: { locale: string; states: LanguageFilter[] }[] = []
  for (const [param, raw] of Object.entries(query)) {
    if (!param.startsWith(LANGUAGE_FILTER_PREFIX)) continue
    const locale = param.slice(LANGUAGE_FILTER_PREFIX.length)
    if (locale === locales.default || !locales.locales.includes(locale)) continue
    const value = String(Array.isArray(raw) ? raw[0] : raw ?? '').slice(0, 200)
    const states = [...new Set(value.split(','))].filter((s): s is LanguageFilter => (LANGUAGE_FILTERS as readonly string[]).includes(s))
    if (states.length) out.push({ locale, states })
  }
  return out
}
