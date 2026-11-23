// The site-wide content every page needs (settings, menus, the look) and the collections the
// blocks draw from. Each is fetched once per page, on the server, and shared by all components.
import type { Album, Category, Navigation, Pack, Page, SiteSettings, Testimonial } from '~/lib/cms-content'
import { looks, type LookId } from '~~/looks'

export function useSiteWords() {
  return computed(() => wordsOf(DEFAULT_LANGUAGE))
}

export async function useSite() {
  const [{ data: settings }, { data: nav }] = await Promise.all([
    useFetch<{ item: SiteSettings | null }>('/api/content/_global/siteSettings', { key: 'site-settings' }),
    useFetch<{ item: Navigation | null }>('/api/content/_global/navigation', { key: 'site-nav' }),
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
export async function useLookId(): Promise<ComputedRef<LookId>> {
  const { look } = await useSite()
  return computed(() => look.value.look.id)
}

/** A menu as the website links it: a link to a page leads to the page's address, the home page is `/`. */
export function menuLinks<T extends { url: string | null }>(links: T[] | null | undefined): Array<T & { url: string }> {
  return (links ?? []).filter((l) => l.url).map((l) => ({ ...l, url: siteHref(l.url) }))
}

/** A collection's published items, fetched once and shared (`key` names the cache). */
async function useList<T>(key: string, entity: string, query: Record<string, string | number> = {}) {
  const { data } = await useFetch<{ items: T[] }>(`/api/content/${entity}`, { key, query: { limit: 100, ...query } })
  return computed(() => data.value?.items ?? [])
}

/** Every published album, newest first, with its category and photographs. */
export const useAlbums = () => useList<Album>('site-albums', 'album', { sort: 'date', dir: 'desc' })
/** The categories, in the editors' order. */
export const useCategories = () => useList<Category>('site-categories', 'category')
/** The packages of the price list, in the editors' order. */
export const usePacks = () => useList<Pack>('site-packs', 'pack')
/** What clients said, in the editors' order. */
export const useTestimonials = () => useList<Testimonial>('site-testimonials', 'testimonial')

/**
 * The page the visitor is on. Three kinds of address:
 *   /, /cenik           a page built from blocks (the home page has the address `home`)
 *   /galerie/svatby     a category: the albums filed under it
 *   /album/anna-a-vojta one album
 * The page and the layout ask with the same key, so it is fetched once.
 */
export async function useSitePage() {
  const route = useRoute()
  const parts = computed(() => ([] as string[]).concat(route.params.slug ?? []).filter(Boolean))
  const kind = computed<'page' | 'category' | 'album'>(() => {
    if (parts.value.length === 2 && `/${parts.value[0]}` === GALLERY_PATH) return 'category'
    if (parts.value.length === 2 && parts.value[0] === 'album') return 'album'
    return 'page'
  })
  const url = computed(() => {
    if (kind.value === 'category') return `/api/content/category/${encodeURIComponent(parts.value[1]!)}`
    if (kind.value === 'album') return `/api/content/album/${encodeURIComponent(parts.value[1]!)}`
    return `/api/content/page/${encodeURIComponent(parts.value.join('/') || 'home')}`
  })
  // A draft is previewed with ?preview, which has to survive every redirect on the way.
  const query = computed(() => ('preview' in route.query ? { preview: '' } : {}))
  const { data, error } = await useAsyncData<any>(
    () => `site:${route.fullPath}`,
    () => ($fetch as (url: string, opts: { query: Record<string, unknown> }) => Promise<any>)(url.value, { query: query.value }),
  )
  return {
    kind, data, error,
    page: computed<Page | null>(() => (kind.value === 'page' ? data.value?.item ?? null : null)),
    category: computed<Category | null>(() => (kind.value === 'category' ? data.value?.item ?? null : null)),
    album: computed<Album | null>(() => (kind.value === 'album' ? data.value?.item ?? null : null)),
    /** Whether what is shown is a draft an editor previews. */
    isDraft: computed(() => !!data.value?.preview && data.value?.item?.status !== 'published'),
  }
}

/** The photographs the page's openings show large in this look: the gallery leaves them out, so no picture shows twice on one page. */
export async function useOpeningPhotoIds(): Promise<ComputedRef<Set<string>>> {
  const { page } = await useSitePage()
  const look = await useLookId()
  return computed(() => {
    const ids = new Set<string>()
    for (const block of page.value?.sections ?? []) {
      const id = block.type === 'hero' ? openingPhoto(block, look.value)?.id : null
      if (id) ids.add(id)
    }
    return ids
  })
}
