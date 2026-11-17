// What an address of the content page ([...slug].vue) is asking for, and where the same item
// lives in the other languages. Shared by the page and by its middleware (the language
// switcher in the layout needs the addresses before the page has drawn anything).
import { DEFAULT_LANG, LANGS, NEWS_SEGMENT, SEARCH_SEGMENT, langOfPath, localePath, type Lang } from './site-i18n'

export type ContentKind = 'page' | 'updates' | 'update'

export function contentRoute(path: string, slug: string | string[] | undefined) {
  const lang = langOfPath(path)
  const segments = ([] as string[]).concat(slug ?? []).filter(Boolean)
  // Without the language prefix: /en/news/x → ['news', 'x'].
  const parts = lang !== DEFAULT_LANG ? segments.slice(1) : segments
  const kind: ContentKind = parts[0] === NEWS_SEGMENT[lang] ? (parts[1] ? 'update' : 'updates') : 'page'
  const url = kind === 'updates'
    ? '/api/content/news'
    : kind === 'update' ? `/api/content/news/${parts[1]}` : `/api/content/page/${parts.length ? parts.join('/') : 'home'}`
  return { lang, parts, kind, url }
}

/** The home page of each language is at /, /en, /de (its content address is /home). */
export const homeOf = (p: string) => p.replace(/\/home$/, '') || '/'

/** An item's own addresses per language (`paths` of the content API); only languages it is live in are there. */
export function itemAlternates(paths: Record<string, string> | null | undefined): Partial<Record<Lang, string>> {
  const out: Partial<Record<Lang, string>> = {}
  for (const l of LANGS) if (paths?.[l]) out[l] = homeOf(paths[l]!)
  return out
}

/** The changelog lives at a fixed address in each language. */
export function newsListAlternates(): Partial<Record<Lang, string>> {
  return Object.fromEntries(LANGS.map((l) => [l, localePath(`/${NEWS_SEGMENT[l]}`, l)]))
}

/** The search page, with the query, in each language. */
export const searchAlternates = (q: string): Record<Lang, string> =>
  Object.fromEntries(LANGS.map((l) => [l, localePath(`/${SEARCH_SEGMENT[l]}`, l) + (q ? `?q=${encodeURIComponent(q)}` : '')])) as Record<Lang, string>
