// The documentation the build rendered from docs/ (modules/docs), read from Nitro's
// server assets: bundled into .output in production (kept in memory once read), read
// from disk in development so a changed page shows on the next request.
import { DOCS_LANGS, type DocsLang, type DocsNav, type DocsPage, type DocsSearchSection, type DocsSection } from '#shared/docs'

const cache = new Map<string, unknown>()

async function asset<T>(key: string): Promise<T | null> {
  if (!import.meta.dev && cache.has(key)) return cache.get(key) as T
  const raw = await useStorage('assets:site-docs').getItem(key)
  const value = (typeof raw === 'string' ? JSON.parse(raw) : raw ?? null) as T | null
  if (!import.meta.dev) cache.set(key, value)
  return value
}

export function docsLang(value: unknown): DocsLang {
  return (DOCS_LANGS as readonly string[]).includes(String(value)) ? (value as DocsLang) : 'cs'
}

export const docsNav = (lang: DocsLang) => asset<DocsNav>(`${lang}:nav.json`)
export const docsSearchIndex = (lang: DocsLang) => asset<DocsSearchSection[]>(`${lang}:search.json`)
export function docsPage(lang: DocsLang, section: DocsSection, slug: string) {
  // Slugs are lowercase letters, digits and dashes: nothing else can name a file.
  if (slug && !/^[a-z0-9-]+$/.test(slug)) return Promise.resolve(null)
  return asset<DocsPage>(`${lang}:pages:${section}:${slug || '_index'}.json`)
}
