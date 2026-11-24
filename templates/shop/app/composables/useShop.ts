// What the Shop's blocks draw from: the facts of the shop (Site settings), the collections, the
// opening hours as they stand at the visitor's clock, and the enquiry the product buttons fill in.
// (The site-wide content, the page and `useSiteList` are the template kit's.)
import type { News, Person, Product, Range, Service } from '~/lib/cms-content'
import type { SiteForm } from '#imports'

/** The departments, in the editors' order. */
export const useRanges = () => useSiteList<Range>('site-ranges', 'range')
/** The services, in the editors' order. */
export const useServices = () => useSiteList<Service>('site-services', 'service')
/** The people behind the counter, in the editors' order. */
export const usePeople = () => useSiteList<Person>('site-people', 'person')
/** The news, newest first. `count` 0 is all of it. */
export const useNews = () => useSiteList<News>('site-news', 'news', { sort: 'date', dir: 'desc' })

/**
 * The products in the window, in the editors' order. A product past its "show until" day is
 * left out; "today" is the server's, sent to the browser with the page, so both draw the same.
 */
export async function useProducts() {
  // (the state first: after the wait, Nuxt no longer knows which component is asking)
  const today = useState('shop-today', () => new Date().toISOString())
  const all = await useSiteList<Product>('site-products', 'product')
  return computed(() => all.value.filter((p) => !p.showUntil || p.showUntil >= today.value))
}

/** The shop as the looks write it: its name, address, contacts, hours (a week) and the words. */
export async function useShop() {
  const { settings, name } = await useSite()
  const words = useSiteWords()
  const week = computed(() => weekOf(settings.value?.hours))
  return {
    settings, name, words, week,
    /** "Cínová 58, Chrudim" */
    place: computed(() => [settings.value?.address, settings.value?.town].filter(Boolean).join(', ')),
    /** "Cínová 58, 537 01 Chrudim" */
    fullPlace: computed(() => [settings.value?.address, [settings.value?.postalCode, settings.value?.town].filter(Boolean).join(' ')].filter(Boolean).join(', ')),
    /** "Po–Pá 7:30–17:00", "So 8:00–11:30" */
    lines: computed(() => weekLines(week.value, words.value.daysShort)),
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
  }
}

let ticking = false
/**
 * What the hours say about now, from the visitor's clock. It is null until the page is drawn in
 * the browser (the server cannot know the visitor's clock and the first drawing must match the
 * server's), then it follows the clock by the minute. In development `?cas=2026-11-22T12:00`
 * shows any moment; a built site does not read it.
 */
export function useOpening(week: MaybeRefOrGetter<Week>) {
  const now = useState<number | null>('shop-now', () => null)
  const route = useRoute()
  const read = (): number => {
    const fixed = import.meta.dev ? Date.parse(String(route.query.cas ?? '')) : Number.NaN
    return Number.isNaN(fixed) ? Date.now() : fixed
  }
  onMounted(() => {
    now.value = read()
    if (!ticking) {
      ticking = true
      setInterval(() => { now.value = read() }, 30_000)
    }
  })
  return computed(() => (now.value === null ? null : openingAt(toValue(week), new Date(now.value))))
}

/**
 * The enquiry a product's buttons fill in. "Ask" and "Put aside" write the message and tick the
 * box in the form's block (which may be further down the page, or on another one); `nonce` tells
 * the form that something new came.
 */
export function useEnquiryDraft() {
  const draft = useState('shop-enquiry', () => ({ message: '', hold: false, nonce: 0 }))
  const words = useSiteWords()
  return {
    draft,
    /** A product's button: "Máte skladem: X?" (or, with `hold`, "Prosím o odložení: X." and the box ticked). */
    fill(product: string, hold = false) {
      draft.value = { message: hold ? words.value.holdMessage(product) : words.value.askMessage(product), hold, nonce: draft.value.nonce + 1 }
    },
  }
}

/** The enquiry form takes what a product's button wrote (also when it arrives from another page). */
export function useEnquiryFill(form: SiteForm) {
  const { draft } = useEnquiryDraft()
  const apply = () => {
    if (!draft.value.nonce) return
    form.values.message = draft.value.message
    form.values.hold = draft.value.hold
  }
  watch(() => draft.value.nonce, apply)
  onMounted(apply)
}
