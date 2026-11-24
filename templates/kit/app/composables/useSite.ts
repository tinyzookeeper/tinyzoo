// The site-wide content every page needs (settings, menus, the look), the page the visitor
// is on, and a collection's entries. Each is fetched once per page, on the server, and shared
// by all components.
//
// The template brings its own part: `looks.ts` beside its cms.config.ts, the generated client
// (app/lib/cms-content.ts) and, in app/utils/site.ts, `DEFAULT_LANGUAGE`, `wordsOf` and
// `ENTRY_PAGES`. (`#site` is the template's folder: `~` and `~~` are the kit's own here.)
import type { Navigation, Page, SiteSettings } from '#site/app/lib/cms-content'
import { looks } from '#site/looks'

/** The website's own words in its language (the template's `wordsOf`). */
export function useSiteWords() {
  return computed(() => wordsOf(DEFAULT_LANGUAGE))
}

export async function useSite() {
  // In the admin's preview (?preview) the settings and menus come with the editor's unsaved
  // values laid over them, so a look or a colour can be tried before it is saved.
  const query = 'preview' in useRoute().query ? { preview: '' } : undefined
  const [{ data: settings }, { data: nav }] = await Promise.all([
    useFetch<{ item: SiteSettings | null }>('/api/content/_global/siteSettings', { key: 'site-settings', query }),
    useFetch<{ item: Navigation | null }>('/api/content/_global/navigation', { key: 'site-nav', query }),
  ])
  const item = computed(() => settings.value?.item ?? null)
  return {
    settings: item,
    nav: computed(() => nav.value?.item ?? null),
    /** The look and colours the site shows (looks.ts): the first look until the settings say otherwise. */
    look: computed(() => looks.resolve(item.value?.look, item.value?.colors)),
    /** The site's name: what the settings hold, else a neutral word. */
    name: computed(() => item.value?.siteName || wordsOf(DEFAULT_LANGUAGE).defaultName),
  }
}

/** The id of the site's look, for a block that hands itself to the look's own component. */
export async function useLookId(): Promise<ComputedRef<typeof looks.ids[number]>> {
  const { look } = await useSite()
  return computed(() => look.value.look.id)
}

/** A menu as the website links it: a link to a page leads to the page's address, the home page is `/`. */
export function menuLinks<T extends { url: string | null }>(links: T[] | null | undefined): Array<T & { url: string }> {
  return (links ?? []).filter((l) => l.url).map((l) => ({ ...l, url: siteHref(l.url) }))
}

/** A collection's published entries, fetched once and shared (`key` names the cache). */
export async function useSiteList<T>(key: string, entity: string, query: Record<string, string | number> = {}) {
  const { data } = await useFetch<{ items: T[] }>(`/api/content/${entity}`, { key, query: { limit: 100, ...query } })
  return computed(() => data.value?.items ?? [])
}

/**
 * The page the visitor is on: a page built from blocks (`/`, `/cenik`; the home page has the
 * address `home`), or an entry of a collection the template gives an address of its own
 * (`ENTRY_PAGES`: `/album/anna-a-vojta`). The page and the layout ask with the same key, so
 * it is fetched once.
 */
export async function useSitePage() {
  const route = useRoute()
  const parts = computed(() => ([] as string[]).concat(route.params.slug ?? []).filter(Boolean))
  const entryPage = computed(() => (parts.value.length === 2 ? ENTRY_PAGES.find((e) => e.prefix === parts.value[0]) ?? null : null))
  const kind = computed<string>(() => entryPage.value?.kind ?? 'page')
  const url = computed(() => (entryPage.value
    ? `/api/content/${entryPage.value.entity}/${encodeURIComponent(parts.value[1]!)}`
    : `/api/content/page/${encodeURIComponent(parts.value.join('/') || 'home')}`))
  // A draft is previewed with ?preview, which has to survive every redirect on the way.
  const query = computed(() => ('preview' in route.query ? { preview: '' } : {}))
  const { data, error } = await useAsyncData<any>(
    () => `site:${route.fullPath}`,
    () => ($fetch as (url: string, opts: { query: Record<string, unknown> }) => Promise<any>)(url.value, { query: query.value }),
  )
  return {
    kind, data, error,
    /** How the template describes this kind of entry; null on a page built from blocks. */
    entryPage,
    page: computed<Page | null>(() => (entryPage.value ? null : data.value?.item ?? null)),
    /** The entry the address leads to; null on a page built from blocks. */
    entry: computed<any | null>(() => (entryPage.value ? data.value?.item ?? null : null)),
    /** Whether what is shown is a draft an editor previews. */
    isDraft: computed(() => !!data.value?.preview && data.value?.item?.status !== 'published'),
  }
}
