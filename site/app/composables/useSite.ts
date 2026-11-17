import { LANGS, SITE_TEXT, langOfPath, localePath, type Lang, type SiteText } from '~/lib/site-i18n'

/** The language of the current address, its texts, and addresses in it. */
export function useLang() {
  const route = useRoute()
  const lang = computed<Lang>(() => langOfPath(route.path))
  const t = (key: keyof SiteText) => SITE_TEXT[lang.value][key]
  const to = (path: string) => localePath(path, lang.value)
  return { lang, t, to }
}

/**
 * Where the current page lives in each language, for the language switcher and the
 * hreflang links. Pages set it; a language missing here falls back (see below).
 *
 * The layout renders before the page, so a page must also set this in its route
 * middleware, or the server renders the switcher with fallbacks and the browser, which
 * hydrates with the final value, finds different links.
 */
export function useAlternates() {
  return useState<Partial<Record<Lang, string>>>('site-alternates', () => ({}))
}

/**
 * Where the switcher goes for a language the current page has no address in: that
 * language's news list ('news', for a news item) or its home page ('home', for any other
 * item), and the menu says so. null: not an item (search, 404), no hint.
 */
export function useAlternatesFallback() {
  return useState<'home' | 'news' | null>('site-alternates-fallback', () => null)
}
export const SITE_LANGS = LANGS

// Site-wide content every page needs: settings and menus, in the page's language.
export async function useSite() {
  const { lang } = useLang()
  const query = computed(() => ({ locale: lang.value }))
  const [{ data: settings }, { data: nav }] = await Promise.all([
    useFetch<{ item: any }>('/api/content/_global/siteSettings', { query, key: computed(() => `site-settings:${lang.value}`) }),
    useFetch<{ item: any }>('/api/content/_global/navigation', { query, key: computed(() => `site-nav:${lang.value}`) }),
  ])
  return { settings: computed(() => settings.value?.item ?? null), nav: computed(() => nav.value?.item ?? null) }
}

/** One brand animal: its picture and body colour (for tinted panels). */
const COLORS: Record<string, string> = {
  bunny: '#FE9B76', bird: '#FEBD3B', fox: '#FD6D61', frog: '#73C573', octopus: '#66CCC6', elephant: '#67B1F9',
  owl: '#C87D88', whale: '#76A5C6', turtle: '#899866', hedgehog: '#BF7762', koala: '#879680', penguin: '#63808E',
}
const ORDER = Object.keys(COLORS)
export function useAnimal(name: string | null | undefined, fallbackIndex = 0) {
  const key = name && COLORS[name] ? name : ORDER[fallbackIndex % 6]!
  return { name: key, src: `/animals/${key}.svg`, color: COLORS[key]! }
}
