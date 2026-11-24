// What the Blog's blocks draw from: the collections and the facts of the site. (The site-wide
// content, the page and `useSiteList` are the template kit's.)
import type { Article, Author, Section, Series } from '~/lib/cms-content'

/** Every published article, newest first, with its author, section and series (and its photograph). One request for the whole page. */
export const useArticles = () => useSiteList<Article>('site-articles', 'article', { sort: 'publishedAt', dir: 'desc' })
/** The sections, in the editors' order. */
export const useSections = () => useSiteList<Section>('site-sections', 'section')
/** The authors, in the editors' order. */
export const useAuthors = () => useSiteList<Author>('site-authors', 'author')
/** The series, in the editors' order. */
export const useSeriesList = () => useSiteList<Series>('site-series', 'series')

/** The magazine as the looks write it: its name, the facts of the publisher, the words. */
export async function useBlog() {
  const { settings, name, nav } = await useSite()
  const words = useSiteWords()
  return {
    settings, name, nav, words,
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
    /** The phone menu's second button. */
    about: computed(() => (settings.value?.aboutLabel && settings.value.aboutUrl ? { label: settings.value.aboutLabel, url: siteHref(settings.value.aboutUrl) } : null)),
  }
}

/**
 * The menu as the header writes it: the links, each with the number it stands for where that is
 * known (a section's articles, the series), for the phone menu.
 */
export async function useMenu() {
  // All asked for before the first wait: after one, Nuxt no longer knows which request this is.
  const [{ nav }, articles, sections, series] = await Promise.all([useSite(), useArticles(), useSections(), useSeriesList()])
  return computed(() => menuLinks(nav.value?.main).map((l) => {
    const section = sections.value.find((s) => l.url === `/rubrika/${s.slug}`)
    const count = section ? inSection(articles.value, section).length : l.url.endsWith('#serial') ? series.value.length : null
    return { ...l, count, italic: l.url.endsWith('#serial') }
  }))
}

/** "Right now", for what depends on the visitor's clock: null on the server and until the page is drawn, so both drawings agree. */
export function useToday() {
  const today = ref<ReturnType<typeof dateParts>>(null)
  onMounted(() => { today.value = dateParts(new Date().toISOString()) })
  return today
}

/** The heading of a block: the first block of a page carries its main heading, unless the front page's name does. */
export async function useHeadingTag(first: MaybeRefOrGetter<boolean | undefined>) {
  const { page } = await useSitePage()
  return computed(() => (toValue(first) && page.value?.sections[0]?.type !== 'front' ? 'h1' : 'h2'))
}

/** Whether the page opens with the front page block (the header then lies over, or leaves the name to it). */
export async function useFrontFirst() {
  const { page } = await useSitePage()
  return computed(() => page.value?.sections[0]?.type === 'front')
}

/** Čtvrthodinka's "How much time do you have?": the shelf the reader chose, which the articles outside it step back from. */
export function useShelf() {
  const chosen = useState<ShelfKey | null>('blog-shelf', () => null)
  return {
    chosen,
    toggle: (key: ShelfKey) => { chosen.value = chosen.value === key ? null : key },
    /** Whether an article of this many minutes is outside the shelf chosen. */
    dim: (minutes: number) => {
      const shelf = SHELVES.find((s) => s.key === chosen.value)
      return !!shelf && (minutes < shelf.from || minutes > shelf.to)
    },
  }
}

/** What the search box asks: the words, the articles found (asked of the site's own search, on the server too), and the form that asks again. */
export async function useSearch() {
  const route = useRoute()
  const term = computed(() => String(route.query.q ?? '').trim())
  const q = ref(term.value)
  watch(term, (t) => { q.value = t })
  const { data, pending } = await useFetch<{ items: Array<{ id: string; title: string; excerpt: string | null; path: string }>; total: number }>('/api/content/_search', {
    key: 'site-search', query: computed(() => ({ q: term.value, entity: 'article', limit: 30 })), watch: [term],
  })
  return {
    q, term, pending,
    /** Fewer than two letters are not searched for. */
    asked: computed(() => term.value.length >= 2),
    items: computed(() => data.value?.items ?? []),
    total: computed(() => data.value?.total ?? 0),
    submit: () => navigateTo({ path: '/hledat', query: q.value.trim() ? { q: q.value.trim() } : {} }),
  }
}

/** The header's search box: takes the visitor to the results page. */
export function useSearchBox() {
  const q = ref('')
  return { q, submit: () => navigateTo({ path: '/hledat', query: q.value.trim() ? { q: q.value.trim() } : {} }) }
}
