// The visitor's language (from the address: /en/… is English) and the site-wide
// content every page needs: settings and menus. Fetched once, shared by all pages.
export function useSiteLocale() {
  const route = useRoute()
  return computed(() => (route.path === '/en' || route.path.startsWith('/en/') ? 'en' : 'cs'))
}

export async function useSite() {
  const locale = useSiteLocale()
  const [{ data: settings }, { data: nav }] = await Promise.all([
    useFetch<{ item: any }>('/api/content/_global/siteSettings', { query: { locale }, key: 'site-settings' }),
    useFetch<{ item: any }>('/api/content/_global/navigation', { query: { locale }, key: 'site-nav' }),
  ])
  return { locale, settings: computed(() => settings.value?.item ?? null), nav: computed(() => nav.value?.item ?? null) }
}

// The site's languages, as in `locales` of cms.config.ts (add a language in both places).
// `home` is the address of the home page in that language.
export const SITE_LANGUAGES = [
  { code: 'cs', label: 'Čeština', home: '/', news: '/aktuality', search: '/hledat' },
  { code: 'en', label: 'English', home: '/en', news: '/en/news', search: '/en/search' },
] as const

/** An address from the content API as the website writes it: the home page (address `home`) is `/`, or `/en`. */
export function siteHref(path: string): string {
  return path.replace(/^((?:\/[a-z]{2})?)\/home$/, '$1') || '/'
}

/**
 * The page the visitor is on: a page from blocks (/o-nas, /en/about), the news list or one
 * news item, read from the content API. The page, and the language switcher in the layout,
 * ask for it with the same key, so it is fetched once.
 */
export async function useSitePage() {
  const route = useRoute()
  const locale = useSiteLocale()
  // Only the addresses [...slug].vue and index.vue draw; /hledat and the error page have nothing to read.
  const reads = computed(() => route.name === 'slug' || route.name === 'index')
  const parts = computed(() => {
    const all = ([] as string[]).concat(route.params.slug ?? []).filter(Boolean)
    return locale.value === 'en' ? all.slice(1) : all
  })
  const newsBase = computed(() => (locale.value === 'en' ? 'news' : 'aktuality'))
  const kind = computed<'page' | 'news' | 'article'>(() => (parts.value[0] === newsBase.value ? (parts.value[1] ? 'article' : 'news') : 'page'))
  const url = computed(() => kind.value === 'news'
    ? '/api/content/news'
    : kind.value === 'article' ? `/api/content/news/${parts.value[1]}` : `/api/content/page/${encodeURIComponent(parts.value.join('/') || 'home')}`)
  // A draft is previewed with ?preview, which has to survive every redirect on the way.
  const query = computed(() => ({
    locale: locale.value,
    ...('preview' in route.query ? { preview: '' } : {}),
    ...(kind.value === 'news' ? { sort: 'publishedAt', limit: 20 } : {}),
  }))
  const { data, error } = await useAsyncData<any>(
    () => `site:${route.fullPath}`,
    // (the address is built from the visitor's: not one of the typed internal routes)
    () => (reads.value ? ($fetch as (url: string, opts: { query: Record<string, unknown> }) => Promise<any>)(url.value, { query: query.value }) : Promise.resolve(null)),
  )
  return { parts, kind, data, error, reads, item: computed(() => (kind.value === 'news' ? null : data.value?.item ?? null)) }
}

/**
 * The language switcher: for each language, the same page in it (an address the content API
 * gives as the item's `paths`), else that language's home page.
 */
export async function useLanguageSwitch() {
  const route = useRoute()
  const locale = useSiteLocale()
  const { kind, item, reads } = await useSitePage()
  return computed(() => SITE_LANGUAGES.map((l) => {
    let href: string = l.home
    if (reads.value && kind.value === 'news') href = l.news
    else if (reads.value && item.value?.paths?.[l.code]) href = siteHref(item.value.paths[l.code])
    else if (route.name === 'hledat') href = l.search + (route.query.q ? `?q=${encodeURIComponent(String(route.query.q))}` : '')
    return { ...l, href, current: l.code === locale.value }
  }))
}
