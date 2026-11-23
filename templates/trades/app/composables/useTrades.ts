// What the Trades blocks draw from: the collections, and the facts from Site settings that
// every look writes (the phone, the hours). (The site-wide content, the page and `useSiteList`
// are the template kit's.)
import type { Job, Review, Service, Town } from '~/lib/cms-content'

/** The price list, in the editors' order. */
export const useServices = () => useSiteList<Service>('site-services', 'service')
/** Every job, in the editors' order. */
export const useJobs = () => useSiteList<Job>('site-jobs', 'job')
/** The reviews, in the editors' order. */
export const useReviews = () => useSiteList<Review>('site-reviews', 'review')
/** The towns the business covers, in the editors' order. */
export const useTowns = () => useSiteList<Town>('site-towns', 'town')

/** The business as the looks write it: the name, the phone, when the phone is answered. */
export async function useTrades() {
  // (what needs the Nuxt instance is asked for before the first wait)
  const year = useState('year', () => new Date().getFullYear())
  const words = useSiteWords()
  const { settings, name } = await useSite()
  return {
    settings, name, words,
    /** A name too long to share a row with the whole menu: the looks fold the menu sooner and set the name smaller. */
    long: computed(() => name.value.length > 20),
    /** The phone number as written, and as a link; null until it is set. */
    phone: computed(() => (settings.value?.phone ? { text: settings.value.phone, href: telHref(settings.value.phone) } : null)),
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
    /** The footer's address lines. */
    addressLines: computed(() => [settings.value?.legalName, ...(settings.value?.address ?? '').split('\n')].map((l) => (l ?? '').trim()).filter(Boolean)),
    /** The year for the © line, fixed on the server so the browser draws the same. */
    year,
  }
}

/** The page's sections, for a block that needs to know what else the page shows. */
export async function usePageSections() {
  const { page } = await useSitePage()
  return computed(() => page.value?.sections ?? [])
}
