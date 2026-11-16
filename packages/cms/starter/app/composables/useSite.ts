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
