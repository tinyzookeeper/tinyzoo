// The site-wide content every page needs (settings, menus, the look), the page the visitor
// is on, and a collection's entries. Each is fetched once per page, on the server, and shared
// by all components.
//
// The template brings its own part: `looks.ts` beside its cms.config.ts, the generated client
// (app/lib/cms-content.ts) and, in app/utils/site.ts, `DEFAULT_LANGUAGE`, `wordsOf` and
// `ENTRY_PAGES`. At run time they come from the site's design (`useDesign()`); the types name
// the template's own files (`#site` is the template's folder: `~` and `~~` are the kit's own here).
import type { Navigation, Page, SiteSettings } from '#site/app/lib/cms-content'
import type { looks } from '#site/looks'
import type { CustomPage } from '../utils/customTypes'

type SiteWords = ReturnType<typeof wordsOf>

/** The website's own words in its language (the template's `wordsOf`). */
export function useSiteWords() {
  const { site } = useDesign()
  return computed(() => site.wordsOf(site.DEFAULT_LANGUAGE) as SiteWords)
}

/** The own main colour the owner gave in the settings, if any (the generated clients may not have the field yet). */
function ownColorOf(item: unknown): string | null {
  const value = (item as { ownColor?: unknown } | null)?.ownColor
  return typeof value === 'string' ? value : null
}

export async function useSite() {
  const design = useDesign()
  // Whether sites may take an own colour (TZ_OWN_LOOK): the server's answer, from the payload.
  const ownOn = useState<boolean>('tz:own-look', () => false)
  // In the admin's preview (?preview) the settings and menus come with the editor's unsaved
  // values laid over them, so a look or a colour can be tried before it is saved.
  const isPreview = 'preview' in useRoute().query
  const query = isPreview ? { preview: '' } : undefined
  const [{ data: settings }, { data: nav }] = await Promise.all([
    useFetch<{ item: SiteSettings | null }>('/api/content/_global/siteSettings', { key: 'site-settings', query }),
    useFetch<{ item: Navigation | null }>('/api/content/_global/navigation', { key: 'site-nav', query }),
  ])
  const item = computed(() => settings.value?.item ?? null)
  // The own colour is passed only when the setting is on; otherwise the preset alone decides.
  const look = computed(() => design.looks.resolve(item.value?.look, item.value?.colors, ownOn.value ? { color: ownColorOf(item.value) } : null) as ReturnType<typeof looks.resolve>)
  return {
    settings: item,
    nav: computed(() => nav.value?.item ?? null),
    /** The look and colours the site shows (looks.ts): the first look until the settings say otherwise. */
    look,
    /** The owner's colour and how it is shown, when it differs; only in the admin's preview, else null. */
    ownNote: computed(() => {
      const own = look.value.own
      return isPreview && own && own.given !== own.shown ? own : null
    }),
    /** The site's name: what the settings hold, else a neutral word. */
    name: computed(() => item.value?.siteName || (design.site.wordsOf(design.site.DEFAULT_LANGUAGE) as SiteWords).defaultName),
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
 * address `home`), an entry of a collection the template gives an address of its own
 * (`ENTRY_PAGES`: `/album/anna-a-vojta`), or an entry of one of the site's own types
 * (`/kurzy/python`: its page prefix, from app/plugins/design.ts; the design's own entry pages
 * come first). The page and the layout ask with the same key, so it is fetched once.
 */
export async function useSitePage() {
  const route = useRoute()
  const { site } = useDesign()
  const parts = computed(() => ([] as string[]).concat(route.params.slug ?? []).filter(Boolean))
  const entryPage = computed(() => (parts.value.length === 2 ? site.ENTRY_PAGES.find((e) => e.prefix === parts.value[0]) ?? null : null))
  const customPages = useState<CustomPage[]>('tz:custom-pages', () => [])
  const customPage = computed(() => customPageFor(parts.value, customPages.value, site.ENTRY_PAGES.map((e) => e.prefix)))
  const kind = computed<string>(() => entryPage.value?.kind ?? (customPage.value ? 'custom' : 'page'))
  const url = computed(() => (entryPage.value
    ? `/api/content/${entryPage.value.entity}/${encodeURIComponent(parts.value[1]!)}`
    : customPage.value
      ? `/api/content/${customPage.value.type}/${encodeURIComponent(parts.value[1]!)}`
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
    page: computed<Page | null>(() => (entryPage.value || customPage.value ? null : data.value?.item ?? null)),
    /** The entry the address leads to; null on a page built from blocks. */
    entry: computed<any | null>(() => (entryPage.value ? data.value?.item ?? null : null)),
    /** Which of the site's own types the address leads to; null elsewhere. */
    customPage,
    /** The entry of one of the site's own types the address leads to; null elsewhere. */
    customEntry: computed<Record<string, any> | null>(() => (customPage.value ? data.value?.item ?? null : null)),
    /** Whether what is shown is a draft an editor previews. */
    isDraft: computed(() => !!data.value?.preview && data.value?.item?.status !== 'published'),
    /** Whether the server answered as to an editor's preview (?preview and signed in): never for a visitor. */
    isPreview: computed(() => !!data.value?.preview),
  }
}
