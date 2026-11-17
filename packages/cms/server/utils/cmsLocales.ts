import { and, eq, inArray, propOf } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'

/**
 * Content translations. Each entry's own row holds the default language; the
 * `<entity>_locales` table holds one row per (entry, language) with the fields marked
 * `.localized()`. Reading in a language overlays its non-empty values on the entry —
 * anything untranslated falls back to the default language.
 */

/** Is `locale` a translation (a configured language other than the default)? */
export function isTranslationLocale(reg: CmsRegistry, locale: string | null | undefined): locale is string {
  return !!reg.locales && !!locale && locale !== reg.locales.default && reg.locales.locales.includes(locale)
}

/**
 * The configured language closest to what a caller wrote: an exact one first, then the
 * same ignoring case ("EN"), then the same language without its region ("en-US" → "en",
 * or "pt-BR" → "pt"); undefined when the site has no such language.
 */
export function closestLocale(configured: readonly string[], asked: string): string | undefined {
  const wanted = asked.trim().replace(/_/g, '-').toLowerCase()
  if (!wanted) return undefined
  return configured.find((l) => l === asked)
    ?? configured.find((l) => l.toLowerCase() === wanted)
    ?? configured.find((l) => l.toLowerCase() === wanted.split('-')[0])
    ?? configured.find((l) => l.toLowerCase().split('-')[0] === wanted.split('-')[0])
}

/**
 * The language a request asks for (`?locale=`): null when content is single-language,
 * the default when not given, the closest configured language for "en-US" or "EN" (a
 * browser's language works as it is), 400 for a language the site does not have.
 */
export function requestedLocale(event: any, reg: CmsRegistry): string | null {
  if (!reg.locales) return null
  const raw = getQuery(event).locale
  if (raw === undefined || raw === '') return reg.locales.default
  const locale = String(raw)
  const found = closestLocale(reg.locales.locales, locale)
  if (!found) {
    throw createError({ statusCode: 400, statusMessage: `Unknown language "${locale.slice(0, 20)}" (available: ${reg.locales.locales.join(', ')})` })
  }
  return found
}

const isEmpty = (v: unknown): boolean => v === null || v === undefined || v === ''
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === 'object' && v !== null && (v as any).type === 'doc'
    // An empty editor saves one empty paragraph: still nothing written.
    && !((v as any).content ?? []).some((n: any) => n?.type !== 'paragraph' || n.content?.length))
  // A group with nothing filled in (an object whose values are all empty): untranslated.
  || (typeof v === 'object' && v !== null && !Array.isArray(v) && (v as any).type !== 'doc' && Object.values(v).every((x) => typeof x !== 'boolean' && isEmpty(x)))

/**
 * Does a translation row hold any text? With per-language publishing a row can hold only a
 * state (a language published or hidden without text of its own): it is not a translation.
 */
export function hasTranslatedText(e: CmsEntity, tr: Record<string, any>): boolean {
  return e.localized.some((k) => !isEmpty(tr[k]))
}

/** The translation rows of `ids` in `locale`, by parent id. */
export async function translationRows(db: any, e: CmsEntity, ids: string[], locale: string): Promise<Map<string, any>> {
  const out = new Map<string, any>()
  if (!e.localesTable || !ids.length) return out
  const t = e.localesTable
  const rows: any[] = await db.select().from(t).where(and(inArray(t.parentId, ids), eq(t.locale, locale)))
  for (const r of rows) out.set(r.parentId, r)
  return out
}

/** Overlay `locale`'s non-empty translated values on `rows` (in place): per-field fallback. */
export async function overlayTranslations(db: any, reg: CmsRegistry, e: CmsEntity, rows: any[], locale: string | null): Promise<void> {
  if (!isTranslationLocale(reg, locale) || !e.localized?.length || !rows.length) return
  const byParent = await translationRows(db, e, rows.map((r) => r.id), locale)
  for (const row of rows) {
    const tr = byParent.get(row.id)
    if (tr) {
      mergeTranslation(e, row, tr)
      applyTranslationState(e, row, tr)
    }
  }
}

/**
 * Per-language publishing: a translation with a state of its own shows it on the item
 * (`status`, and the publish date), so what is served in that language says what it is in
 * that language. A translation that follows the default language leaves the entry's own.
 */
export function applyTranslationState(e: CmsEntity, row: Record<string, any>, tr: Record<string, any>): void {
  const p = e.publish
  if (!p?.perLocale || tr.published === null || tr.published === undefined) return
  row[propOf(p.field, e.fields[p.field]!)] = tr.published ? p.publishedValue : p.draftValue
  if (p.dateField) row[propOf(p.dateField, e.fields[p.dateField]!)] = tr.publishedAt ?? null
}

/** Put a translation row's non-empty values on `row` (in place): per-field fallback. */
export function mergeTranslation(e: CmsEntity, row: Record<string, any>, tr: Record<string, any>): Record<string, any> {
  for (const key of e.localized) if (!isEmpty(tr[key])) row[key] = tr[key]
  return row
}

/**
 * For each id, the languages it is available in: the default plus every translation. With
 * per-language publishing a translation row may hold only a state (a language switched off
 * or on without any text of its own), which is not a translation — unless `withStateRows`
 * (the website: a language published on its own is there, in the text of the default).
 */
export async function availableLocales(db: any, reg: CmsRegistry, e: CmsEntity, ids: string[], opts: { withStateRows?: boolean } = {}): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (!reg.locales) return out
  for (const id of ids) out.set(id, [reg.locales.default])
  if (!e.localesTable || !ids.length) return out
  const t = e.localesTable
  const stateRows = !!e.publish?.perLocale
  const cols: Record<string, any> = { parentId: t.parentId, locale: t.locale }
  if (stateRows) for (const k of e.localized) cols[k] = t[k]
  const rows: any[] = await db.select(cols).from(t).where(inArray(t.parentId, ids))
  for (const r of rows) {
    if (!reg.locales.locales.includes(r.locale)) continue
    if (stateRows && !opts.withStateRows && !hasTranslatedText(e, r)) continue
    out.get(r.parentId)?.push(r.locale)
  }
  // Keep the configured order.
  for (const [id, list] of out) out.set(id, reg.locales.locales.filter((l) => list.includes(l)))
  return out
}

/** One language of an entry as the admin shows it: live, waiting for its date, or a draft. */
export interface LanguageState {
  state: 'published' | 'scheduled' | 'draft'
  /** Set by someone for this language; false: it follows the default language (the default language itself is always its own). */
  own: boolean
  /** The publish date in effect (the entry's while it follows the default language). */
  date: string | null
}

/**
 * The state of every language of each row (the default one is the entry's own), for
 * entities that publish per language: a translation's own where one was set, else what the
 * entry's row says. `rows` are the entries as stored (status and date columns included).
 */
export async function translationStates(db: any, reg: CmsRegistry, e: CmsEntity, rows: Record<string, any>[]): Promise<Map<string, Record<string, LanguageState>>> {
  const out = new Map<string, Record<string, LanguageState>>()
  const p = e.publish
  const t = e.localesTable
  if (!p?.perLocale || !t || !reg.locales || !rows.length) return out
  const others = reg.locales.locales.filter((l) => l !== reg.locales!.default)
  const own = new Map<string, any>()
  const trs: any[] = await db.select({ parentId: t.parentId, locale: t.locale, published: t.published, publishedAt: t.publishedAt }).from(t)
    .where(and(inArray(t.parentId, rows.map((r) => r.id)), inArray(t.locale, others)))
  for (const tr of trs) if (tr.published !== null) own.set(tr.parentId + '#' + tr.locale, tr)
  const statusKey = propOf(p.field, e.fields[p.field]!)
  const dateKey = p.dateField ? propOf(p.dateField, e.fields[p.dateField]!) : null
  const scheduled = !!dateKey && p.schedule !== false
  const now = Date.now()
  const stateOf = (published: boolean, date: Date | null): LanguageState['state'] =>
    !published ? 'draft' : scheduled && date && new Date(date).getTime() > now ? 'scheduled' : 'published'
  for (const row of rows) {
    const entryDate: Date | null = dateKey ? row[dateKey] : null
    const states: Record<string, LanguageState> = {
      [reg.locales.default]: { state: stateOf(row[statusKey] === p.publishedValue, entryDate), own: true, date: entryDate ? new Date(entryDate).toISOString() : null },
    }
    for (const l of others) {
      const mine = own.get(row.id + '#' + l)
      const date: Date | null = mine ? mine.publishedAt : entryDate
      states[l] = {
        state: stateOf(mine ? mine.published === true : row[statusKey] === p.publishedValue, date),
        own: !!mine,
        date: date ? new Date(date).toISOString() : null,
      }
    }
    out.set(row.id, states)
  }
  return out
}
