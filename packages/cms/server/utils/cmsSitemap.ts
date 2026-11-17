import { and, indexTree, inArray, sitePath, sql } from 'tinyzoo'
import type { CmsEntity, CmsRegistry, CmsSitemapEntry } from 'tinyzoo'
import { scrubError } from './cmsScrub'

/**
 * Sitemap entries for every public collection with `content.path` (e.g.
 * '/blog/:slug'): published items only, one entry per language the item exists in,
 * each listing its language alternates (for hreflang).
 */
export type SitemapEntry = CmsSitemapEntry

const MEMO_MS = 60_000
let memo: { at: number; entries: SitemapEntry[] } | null = null

/** Forget the memo (a content change touched an address), and @nuxtjs/sitemap's cached sitemaps on this instance. */
export function invalidateSitemap(): void {
  memo = null
  // The module caches with Nitro's cached functions under `sitemap:sitemap:…` (base and group "sitemap").
  const storage = useStorage()
  storage.getKeys(SITEMAP_CACHE_PREFIX)
    .then((keys) => Promise.all(keys.map((k) => storage.removeItem(k))))
    .catch((err) => console.error('[cms] could not clear the cached sitemap', scrubError(err)))
}
const SITEMAP_CACHE_PREFIX = 'sitemap:sitemap'


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
    // Publishing per language: a language is in the sitemap, and among the alternates, only while it is live (the default language gates the others, so an entry that is not live in it is not here at all).
    const perLanguage = perLocalePublishing(e) && !!reg.locales
    const languages = reg.locales?.locales ?? []
    if (perLanguage) languages.forEach((l, i) => { cols[`live${i}`] = sql<boolean>`coalesce(${publishedCond(e, l) ?? sql`true`}, false)` })
    const liveIn = (row: any, locale: string | null) => !perLanguage || !locale || row[`live${languages.indexOf(locale)}`] === true
    const rows: any[] = await db.select(cols).from(e.table).where(publishedCond(e)).limit(50_000)
    if (!rows.length) continue
    const translations = await translationsByParent(db, reg, e, rows.map((r) => r.id), keys)
    // A page tree: addresses are the chain of ancestors' address parts (live pages only: publishedCond checks the ancestors).
    const treeIndex = e.tree ? indexTree(await loadTreeNodes(db, reg, e)) : null
    for (const row of rows) {
      const versions: { locale: string | null; loc: string; lastmod: Date }[] = []
      if (treeIndex) {
        const lastmods = new Map<string | null, Date>([[reg.locales?.default ?? null, row.updatedAt]])
        for (const tr of translations.get(row.id) ?? []) lastmods.set(tr.locale, tr.updatedAt > row.updatedAt ? tr.updatedAt : row.updatedAt)
        for (const v of treeVersions(reg, e, treeIndex, row.id)) versions.push({ locale: v.locale, loc: v.loc, lastmod: lastmods.get(v.locale) ?? row.updatedAt })
      }
      else {
        const defaultLoc = liveIn(row, reg.locales?.default ?? null) ? sitePath(reg.locales, e.content.path, reg.locales?.default ?? null, row) : null
        if (defaultLoc) versions.push({ locale: reg.locales?.default ?? null, loc: defaultLoc, lastmod: row.updatedAt })
        for (const tr of translations.get(row.id) ?? []) {
          if (!liveIn(row, tr.locale)) continue
          // Untranslated fields (e.g. the slug) fall back to the default language.
          const merged = { ...row }
          for (const k of keys) if (tr[k] !== null && tr[k] !== undefined && tr[k] !== '') merged[k] = tr[k]
          const loc = sitePath(reg.locales, e.content.path, tr.locale, merged)
          if (loc) versions.push({ locale: tr.locale, loc, lastmod: tr.updatedAt > row.updatedAt ? tr.updatedAt : row.updatedAt })
        }
      }
      const alternates = reg.locales ? versions.map((v) => ({ locale: v.locale!, loc: v.loc })) : []
      for (const v of versions) out.push({ loc: v.loc, locale: v.locale, lastmod: new Date(v.lastmod).toISOString(), alternates })
    }
  }
  out.push(...fixedPathEntries(reg))
  // A site adds addresses of its own (the news list, pages that come from data): they are
  // kept with the rest for the minute the sitemap is memoised.
  try {
    await useNitroApp().hooks.callHook('cms:sitemap', out)
  }
  catch (err) {
    console.error('[cms] cms:sitemap hook failed', scrubError(err))
  }
  const checked = cleanSitemap(out)
  memo = { at: Date.now(), entries: checked }
  return checked
}

/** `cms.sitemap.paths`: fixed addresses; an object lists one page in several languages (hreflang alternates). */
function fixedPathEntries(reg: CmsRegistry): SitemapEntry[] {
  const configured: (string | Record<string, string>)[] = (useRuntimeConfig().cms as any)?.sitemap?.paths ?? []
  const out: SitemapEntry[] = []
  for (const p of configured) {
    if (typeof p === 'string') {
      out.push({ loc: p, locale: null, lastmod: null, alternates: [] })
      continue
    }
    const versions = Object.entries(p).filter(([l]) => !reg.locales || reg.locales.locales.includes(l))
    const alternates = versions.map(([locale, loc]) => ({ locale, loc }))
    for (const [locale, loc] of versions) out.push({ loc, locale, lastmod: null, alternates })
  }
  return out
}

/** Entries from the hook are trusted no further than needed: an address on this site, once. */
function cleanSitemap(entries: SitemapEntry[]): SitemapEntry[] {
  const seen = new Set<string>()
  const out: SitemapEntry[] = []
  for (const x of entries) {
    if (!x || typeof x.loc !== 'string' || !/^\/(?!\/)[^\s?#]*$/.test(x.loc) || seen.has(x.loc)) continue
    seen.add(x.loc)
    out.push({ loc: x.loc, locale: x.locale ?? null, lastmod: x.lastmod ? new Date(x.lastmod).toISOString() : null, alternates: Array.isArray(x.alternates) ? x.alternates : [] })
  }
  return out
}

/**
 * THE function that says where an entry is on the website: its current address in every
 * language it exists in ({ cs: '/o-nas/tym', en: '/en/about/team' }), from the
 * default-language row and its translations. A page tree gives the nested address (its
 * ancestors' address parts, each language's own, falling back to the default). For a
 * site without languages the one address is under the key ''. Used by the item
 * `paths` of the content API, so a website can link to the same item in another language
 * (a language switcher, hreflang links), and by links that follow their target.
 * Entries that are not at an address are left out.
 */
export async function localePaths(db: any, reg: CmsRegistry, e: CmsEntity, ids: string[], opts: { drafts?: boolean } = {}): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>()
  if (!e.content?.path || !ids.length) return out
  if (e.tree) {
    const index = indexTree(await loadTreeNodes(db, reg, e))
    for (const id of ids) {
      const paths: Record<string, string> = {}
      for (const v of treeVersions(reg, e, index, id)) paths[v.locale ?? ''] = v.loc
      if (index.has(id)) out.set(id, paths)
    }
    return out
  }
  const keys = pathKeys(e.content.path).filter((k) => e.table[k])
  const cols: Record<string, any> = { id: e.table.id }
  for (const k of keys) cols[k] = e.table[k]
  const rows: any[] = await db.select(cols).from(e.table).where(inArray(e.table.id, ids))
  if (!reg.locales) {
    for (const row of rows) {
      const base = sitePath(null, e.content.path, null, row)
      out.set(row.id, base ? { '': base } : {})
    }
    return out
  }
  const translations = await translationsByParent(db, reg, e, ids, keys, opts)
  for (const row of rows) {
    const paths: Record<string, string> = {}
    const base = sitePath(reg.locales, e.content.path, reg.locales.default, row)
    if (base) paths[reg.locales.default] = base
    for (const tr of translations.get(row.id) ?? []) {
      const merged = { ...row }
      for (const k of keys) if (tr[k] !== null && tr[k] !== undefined && tr[k] !== '') merged[k] = tr[k]
      const loc = sitePath(reg.locales, e.content.path, tr.locale, merged)
      if (loc) paths[tr.locale] = loc
    }
    out.set(row.id, paths)
  }
  return out
}

/** The translation rows visitors see (an editor's preview, `drafts`, also the ones being worked on), by entry. */
async function translationsByParent(db: any, reg: CmsRegistry, e: CmsEntity, ids: string[], keys: string[], opts: { drafts?: boolean } = {}): Promise<Map<string, any[]>> {
  const out = new Map<string, any[]>()
  if (!e.localesTable || !ids.length || !reg.locales) return out
  const t = e.localesTable
  const cols: Record<string, any> = { parentId: t.parentId, locale: t.locale, updatedAt: t.updatedAt }
  for (const k of keys) if (e.localized.includes(k)) cols[k] = t[k]
  // Only languages the site still has (a removed language must not reappear).
  const others = reg.locales.locales.filter((l) => l !== reg.locales!.default)
  if (!others.length) return out
  const rows: any[] = await db.select(cols).from(t).where(and(inArray(t.parentId, ids), inArray(t.locale, others), opts.drafts ? undefined : shownTranslationCond(e, t)))
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
