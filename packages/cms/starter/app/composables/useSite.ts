// The visitor's language (from the address: /en/… is English, the default language has no
// prefix) and the site-wide content every page needs: settings and menus. Fetched once,
// shared by all pages. The languages and the words the website draws itself: app/utils/site.ts.
export function useSiteLocale() {
  const route = useRoute()
  return computed(() => languageOf(route.path))
}

/** The words of the visitor's language: headings, buttons, the labels of landmarks. */
export function useSiteWords() {
  const locale = useSiteLocale()
  return computed(() => wordsOf(locale.value))
}

export async function useSite() {
  const locale = useSiteLocale()
  const [{ data: settings }, { data: nav }] = await Promise.all([
    useFetch<{ item: any }>('/api/content/_global/siteSettings', { query: { locale }, key: 'site-settings' }),
    useFetch<{ item: any }>('/api/content/_global/navigation', { query: { locale }, key: 'site-nav' }),
  ])
  return { locale, settings: computed(() => settings.value?.item ?? null), nav: computed(() => nav.value?.item ?? null) }
}

/**
 * The page the visitor is on: a page from blocks (/o-nas, /en/about), the news list or one
 * news item, read from the content API. The page, and the language switcher in the layout,
 * ask for it with the same key, so it is fetched once.
 */
export async function useSitePage() {
  const route = useRoute()
  const locale = useSiteLocale()
  // Only the addresses [...slug].vue and index.vue draw; the search page and the error page have nothing to read.
  const reads = computed(() => route.name === 'slug' || route.name === 'index')
  const parts = computed(() => {
    const all = ([] as string[]).concat(route.params.slug ?? []).filter(Boolean)
    return locale.value === DEFAULT_LANGUAGE ? all : all.slice(1)
  })
  const kind = computed<'page' | 'news' | 'article'>(() => {
    // #if news
    if (parts.value[0] === wordsOf(locale.value).newsPath) return parts.value[1] ? 'article' : 'news'
    // #endif
    return 'page'
  })
  const url = computed(() => {
    // #if news
    if (kind.value === 'news') return '/api/content/news'
    if (kind.value === 'article') return `/api/content/news/${parts.value[1]}`
    // #endif
    return `/api/content/page/${encodeURIComponent(parts.value.join('/') || 'home')}`
  })
  // A draft is previewed with ?preview, which has to survive every redirect on the way.
  const query = computed(() => ({
    locale: locale.value,
    ...('preview' in route.query ? { preview: '' } : {}),
    // #if news
    ...(kind.value === 'news' ? { sort: 'publishedAt', limit: 20 } : {}),
    // #endif
  }))
  const { data, error } = await useAsyncData<any>(
    () => `site:${route.fullPath}`,
    // (the address is built from the visitor's: not one of the typed internal routes)
    () => (reads.value ? ($fetch as (url: string, opts: { query: Record<string, unknown> }) => Promise<any>)(url.value, { query: query.value }) : Promise.resolve(null)),
  )
  return { parts, kind, data, error, reads, item: computed(() => data.value?.item ?? null) }
}

/**
 * The language switcher: for each language, the same page in it (an address the content API
 * gives as the item's `paths`), else that language's home page.
 */
export async function useLanguageSwitch() {
  const route = useRoute()
  const locale = useSiteLocale()
  const { item, reads, kind } = await useSitePage()
  const hrefIn = (code: string): string => {
    // #if news
    if (reads.value && kind.value === 'news') return newsPathOf(code)
    // #endif
    if (reads.value && item.value?.paths?.[code]) return siteHref(item.value.paths[code])
    // #if search
    if (route.name === 'search') return searchPathOf(code) + (route.query.q ? `?q=${encodeURIComponent(String(route.query.q))}` : '')
    // #endif
    return inLanguage(code, '/')
  }
  return computed(() => LANGUAGES.map((code) => ({ code, label: languageName(code), href: hrefIn(code), current: code === locale.value })))
}
