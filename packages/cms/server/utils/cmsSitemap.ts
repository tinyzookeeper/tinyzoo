import { and, inArray, sitePath } from '@my-cms/core'
import type { CmsEntity, CmsRegistry } from '@my-cms/core'

/**
 * Sitemap entries for every public collection with `content.path` (e.g.
 * '/blog/:slug'): published items only, one entry per language the item exists in,
 * each listing its language alternates (for hreflang).
 */
export interface SitemapEntry { loc: string; locale: string | null; lastmod: string; alternates: { locale: string; loc: string }[] }

const MEMO_MS = 60_000
let memo: { at: number; entries: SitemapEntry[] } | null = null

/** Forget the memo (a content change touched an address). */
export function invalidateSitemap(): void {
  memo = null
}


/**
 * All sitemap entries. Reads only what the addresses need (id, updatedAt and the
 * template's columns — never page bodies), only configured languages, and keeps the
 * result for a minute per instance, so a burst of uncached requests stays cheap.
 */
export async function sitemapEntries(db: any, reg: CmsRegistry): Promise<SitemapEntry[]> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.entries
  const out: SitemapEntry[] = []
  for (const e of reg.entities) {
    if (!e.content?.public || e.singleton || !e.content.path) continue
    const keys = pathKeys(e.content.path).filter((k) => e.table[k])
    const cols: Record<string, any> = { id: e.table.id, updatedAt: e.table.updatedAt }
    for (const k of keys) cols[k] = e.table[k]
    const rows: any[] = await db.select(cols).from(e.table).where(publishedCond(e)).limit(50_000)
    if (!rows.length) continue
    const translations = await translationsByParent(db, reg, e, rows.map((r) => r.id), keys)
    for (const row of rows) {
      const versions: { locale: string | null; loc: string; lastmod: Date }[] = []
      const defaultLoc = sitePath(reg.locales, e.content.path, reg.locales?.default ?? null, row)
      if (defaultLoc) versions.push({ locale: reg.locales?.default ?? null, loc: defaultLoc, lastmod: row.updatedAt })
      for (const tr of translations.get(row.id) ?? []) {
        // Untranslated fields (e.g. the slug) fall back to the default language.
        const merged = { ...row }
        for (const k of keys) if (tr[k] !== null && tr[k] !== undefined && tr[k] !== '') merged[k] = tr[k]
        const loc = sitePath(reg.locales, e.content.path, tr.locale, merged)
        if (loc) versions.push({ locale: tr.locale, loc, lastmod: tr.updatedAt > row.updatedAt ? tr.updatedAt : row.updatedAt })
      }
      const alternates = reg.locales ? versions.map((v) => ({ locale: v.locale!, loc: v.loc })) : []
      for (const v of versions) out.push({ loc: v.loc, locale: v.locale, lastmod: new Date(v.lastmod).toISOString(), alternates })
    }
  }
  memo = { at: Date.now(), entries: out }
  return out
}

async function translationsByParent(db: any, reg: CmsRegistry, e: CmsEntity, ids: string[], keys: string[]): Promise<Map<string, any[]>> {
  const out = new Map<string, any[]>()
  if (!e.localesTable || !ids.length || !reg.locales) return out
  const t = e.localesTable
  const cols: Record<string, any> = { parentId: t.parentId, locale: t.locale, updatedAt: t.updatedAt }
  for (const k of keys) if (e.localized.includes(k)) cols[k] = t[k]
  // Only languages the site still has (a removed language must not reappear).
  const others = reg.locales.locales.filter((l) => l !== reg.locales!.default)
  if (!others.length) return out
  const rows: any[] = await db.select(cols).from(t).where(and(inArray(t.parentId, ids), inArray(t.locale, others)))
  for (const r of rows) out.set(r.parentId, [...(out.get(r.parentId) ?? []), r])
  return out
}

/**
 * The website's absolute base URL for the sitemap: cms.publicUrl. Only in
 * development may it come from the request (never in production, where a forged
 * Host would end up in a publicly cached document).
 */
export function siteBase(event: any): string | null {
  const configured = String((useRuntimeConfig().cms as any)?.publicUrl || '').replace(/\/+$/, '')
  if (configured) return configured
  if (import.meta.dev || process.env.NODE_ENV !== 'production') return getRequestURL(event).origin
  return null
}
