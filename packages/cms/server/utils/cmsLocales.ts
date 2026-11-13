import { and, eq, inArray } from 'tinyzoo'
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
 * The language a request asks for (`?locale=`): null when content is single-language,
 * the default when not given, 400 for a language the site does not have.
 */
export function requestedLocale(event: any, reg: CmsRegistry): string | null {
  if (!reg.locales) return null
  const raw = getQuery(event).locale
  if (raw === undefined || raw === '') return reg.locales.default
  const locale = String(raw)
  if (!reg.locales.locales.includes(locale)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown language "${locale.slice(0, 20)}" (available: ${reg.locales.locales.join(', ')})` })
  }
  return locale
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === ''
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === 'object' && v !== null && (v as any).type === 'doc'
    // An empty editor saves one empty paragraph: still nothing written.
    && !((v as any).content ?? []).some((n: any) => n?.type !== 'paragraph' || n.content?.length))

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
    if (!tr) continue
    for (const key of e.localized) if (!isEmpty(tr[key])) row[key] = tr[key]
  }
}

/** For each id, the languages it is available in: the default plus every translation. */
export async function availableLocales(db: any, reg: CmsRegistry, e: CmsEntity, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (!reg.locales) return out
  for (const id of ids) out.set(id, [reg.locales.default])
  if (!e.localesTable || !ids.length) return out
  const t = e.localesTable
  const rows: any[] = await db.select({ parentId: t.parentId, locale: t.locale }).from(t).where(inArray(t.parentId, ids))
  for (const r of rows) {
    if (!reg.locales.locales.includes(r.locale)) continue
    out.get(r.parentId)?.push(r.locale)
  }
  // Keep the configured order.
  for (const [id, list] of out) out.set(id, reg.locales.locales.filter((l) => list.includes(l)))
  return out
}
