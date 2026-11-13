import { and, inArray } from '@my-cms/core'
import type { CmsEntity, CmsRegistry } from '@my-cms/core'

/**
 * Sitemap entries for every public collection with `content.path` (e.g.
 * '/blog/:slug'): published items only, one entry per language the item exists in,
 * each listing its language alternates (for hreflang).
 */
export interface SitemapEntry { loc: string; locale: string | null; lastmod: string; alternates: { locale: string; loc: string }[] }

function localePrefix(reg: CmsRegistry, locale: string | null): string {
  const l = reg.locales
  if (!l || !locale || l.prefix === 'none') return ''
  if (l.prefix === 'except-default' && locale === l.default) return ''
  return `/${locale}`
}

function fill(template: string, row: Record<string, any>): string | null {
  let ok = true
  const out = template.replace(/:(\w+)/g, (_m, key: string) => {
    const v = row[key]
    if (v === null || v === undefined || v === '') ok = false
    return encodeURIComponent(String(v ?? ''))
  })
  return ok ? out : null
}

export async function sitemapEntries(db: any, reg: CmsRegistry): Promise<SitemapEntry[]> {
  const out: SitemapEntry[] = []
  for (const e of reg.entities) {
    if (!e.content?.public || e.singleton || !e.content.path) continue
    const rows: any[] = await db.select().from(e.table).where(publishedCond(e)).limit(50_000)
    if (!rows.length) continue
    const translations = await translationsByParent(db, e, rows.map((r) => r.id))
    for (const row of rows) {
      const versions: { locale: string | null; loc: string; lastmod: Date }[] = []
      const defaultLoc = fill(e.content.path, row)
      if (defaultLoc) versions.push({ locale: reg.locales?.default ?? null, loc: localePrefix(reg, reg.locales?.default ?? null) + defaultLoc, lastmod: row.updatedAt })
      for (const tr of translations.get(row.id) ?? []) {
        // Untranslated fields (e.g. the slug) fall back to the default language.
        const merged = { ...row }
        for (const k of e.localized) if (tr[k] !== null && tr[k] !== undefined && tr[k] !== '') merged[k] = tr[k]
        const loc = fill(e.content.path, merged)
        if (loc) versions.push({ locale: tr.locale, loc: localePrefix(reg, tr.locale) + loc, lastmod: tr.updatedAt > row.updatedAt ? tr.updatedAt : row.updatedAt })
      }
      const alternates = reg.locales ? versions.map((v) => ({ locale: v.locale!, loc: v.loc })) : []
      for (const v of versions) out.push({ loc: v.loc, locale: v.locale, lastmod: new Date(v.lastmod).toISOString(), alternates })
    }
  }
  return out
}

async function translationsByParent(db: any, e: CmsEntity, ids: string[]): Promise<Map<string, any[]>> {
  const out = new Map<string, any[]>()
  if (!e.localesTable || !ids.length) return out
  const t = e.localesTable
  const rows: any[] = await db.select().from(t).where(and(inArray(t.parentId, ids)))
  for (const r of rows) out.set(r.parentId, [...(out.get(r.parentId) ?? []), r])
  return out
}
