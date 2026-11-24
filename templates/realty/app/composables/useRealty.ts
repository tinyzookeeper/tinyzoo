// What the Realty's blocks draw from: the collections, the facts of the office (Site settings),
// the filter over the listings and the search that sets it. (The site-wide content, the page and
// `useSiteList` are the template kit's.)
import type { Agent, Area, Listing, Sale } from '../lib/cms-content'

/** The published listings in the agency's order. */
export const useListings = () => useSiteList<Listing>('site-listings', 'listing')
/** The agents, in the editors' order. */
export const useAgents = () => useSiteList<Agent>('site-agents', 'agent')
/** What was sold, in the editors' order. */
export const useSales = () => useSiteList<Sale>('site-sales', 'sale')
/** The places the agency works in, in the editors' order. */
export const useAreas = () => useSiteList<Area>('site-areas', 'area')

/** The office as the looks write it: the name, the address and phone from Site settings. */
export async function useOffice() {
  const { settings, name } = await useSite()
  const words = useSiteWords()
  return {
    settings, name, words,
    town: computed(() => settings.value?.town ?? ''),
    /** "Medvědí 14, 397 01 Písek" */
    address: computed(() => [settings.value?.street, [settings.value?.postcode, settings.value?.town].filter(Boolean).join(' ')].filter(Boolean).join(', ')),
    /** "Medvědí 14, Písek": without the postcode */
    addressShort: computed(() => [settings.value?.street, settings.value?.town].filter(Boolean).join(', ')),
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
  }
}

/**
 * The offer in numbers: the listings, how many the agency says it has (Site settings can say
 * more than the website holds), and how many are new this week.
 */
export async function useOffer() {
  // (both asked for before the first wait: after one, Nuxt no longer knows which request this is)
  const [listings, { settings }] = await Promise.all([useListings(), useSite()])
  return {
    listings,
    total: computed(() => Math.max(settings.value?.offerTotal ?? 0, listings.value.length)),
    /** The listings marked new, the newest first. */
    fresh: computed(() => listings.value.filter((l) => l.state === 'new').sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''))),
    /** The listing the detail section and the opening show. */
    featured: computed(() => featuredListing(listings.value)),
  }
}

/**
 * The filter over the listings, shared by every block of the page: the chips set it, the
 * search sets it, an address can open the page with it set. Kept in the page's state so the
 * server draws what the address asks for.
 */
export function useListingFilter() {
  const route = useRoute()
  const filter = useState<ListingFilter>('realty-filter', () => filterFromQuery(route.query))
  // A page reached by a link that asks for a filter shows it; one without a question starts open.
  const here = `${route.path}?${JSON.stringify(route.query)}`
  const key = useState<string>('realty-filter-key', () => here)
  if (key.value !== here) {
    key.value = here
    filter.value = filterFromQuery(route.query)
  }
  return { filter, set: (f: ListingFilter) => { filter.value = { ...f } }, reset: () => { filter.value = { ...NO_FILTER } } }
}

/**
 * The search of the opening: its choices are made of the listings (the kinds, the towns and
 * the prices that exist), and "search" sets the page's filter and goes to the listings.
 */
export function useListingSearch(listings: MaybeRefOrGetter<Listing[]>, anchor: MaybeRefOrGetter<string | undefined>) {
  const { filter, set } = useListingFilter()
  const all = computed(() => toValue(listings))
  const KINDS: Listing['kind'][] = ['flat', 'house', 'cottage', 'plot', 'commercial']
  const kinds = computed(() => KINDS.filter((k) => all.value.some((l) => l.kind === k)))
  const towns = computed(() => {
    const seen = new Map<string, string>()
    for (const l of all.value) if (l.town && !seen.has(l.town)) seen.set(l.town, l.townIn || l.town)
    return [...seen].map(([value, labelIn]) => ({ value, labelIn }))
  })
  const deals = computed(() => (['sale', 'rent'] as const).filter((d) => all.value.some((l) => l.deal === d)))
  const draft = reactive<{ deal: Deal; kind: Listing['kind'] | ''; town: string; max: number }>({ deal: 'sale', kind: '', town: 'all', max: 0 })
  watchEffect(() => {
    if (deals.value.length && !deals.value.includes(draft.deal)) draft.deal = deals.value[0]!
    if (kinds.value.length && !kinds.value.includes(draft.kind as Listing['kind'])) draft.kind = kinds.value[0]!
  })
  const steps = computed(() => maxSteps(all.value.filter((l) => l.deal === draft.deal).map((l) => l.price ?? 0), draft.deal))
  watch(() => draft.deal, () => { draft.max = 0 })
  function submit() {
    set({ deal: draft.deal, kind: draft.kind || 'all', town: draft.town, max: draft.max })
    const id = toValue(anchor)
    if (import.meta.client && id) document.getElementById(id)?.scrollIntoView()
  }
  return { draft, kinds, towns, deals, steps, submit, filter }
}
