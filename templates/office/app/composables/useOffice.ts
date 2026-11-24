// What the Office's blocks draw from: the collections, and the facts of the office (Site
// settings). (The site-wide content, the page and `useSiteList` are the template kit's.)
import type { Article, CaseStudy, Deadline, Person, Question, Service, ServiceGroup } from '../lib/cms-content'

/** The groups of the price list, in the editors' order. */
export const useServiceGroups = () => useSiteList<ServiceGroup>('site-service-groups', 'serviceGroup')
/** The services, in the editors' order. */
export const useServices = () => useSiteList<Service>('site-services', 'service')
/** The people, in the editors' order. */
export const usePeople = () => useSiteList<Person>('site-people', 'person')
/** The published case studies, in the editors' order. */
export const useCases = () => useSiteList<CaseStudy>('site-cases', 'caseStudy')
/** The published articles, newest first. */
export const useArticles = () => useSiteList<Article>('site-articles', 'article', { sort: 'date', dir: 'desc' })
/** The questions, in the editors' order. */
export const useQuestions = () => useSiteList<Question>('site-questions', 'question')
/** Every deadline, the nearest first (which ones are still ahead is worked out in the browser: see `useToday`). */
export const useDeadlines = () => useSiteList<Deadline>('site-deadlines', 'deadline', { sort: 'date', dir: 'asc' })

/**
 * Today, known only in the browser: what depends on the day (the ruler of deadlines) must not
 * differ between the server's answer and the browser's first drawing, so it is drawn empty
 * until the page is hydrated. In development `?now=2026-11-23` sets the day, to try a ruler at
 * another time of the year; a built site ignores it.
 */
export function useToday() {
  const now = ref<Date | null>(null)
  const route = useRoute()
  // After the whole page is hydrated, not merely after this component is mounted: a component that
  // waits for its data may mount while the rest of the page is still being matched to the server's
  // answer, and what it changes then would be a mismatch.
  onNuxtReady(() => {
    const fixed = import.meta.dev ? route.query.now : null
    now.value = typeof fixed === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fixed) ? new Date(`${fixed}T12:00:00Z`) : new Date()
  })
  return now
}

/** The office as the looks write it: the name's halves, the address, the phone, the header's button. */
export async function useOffice() {
  // (asked for before the first wait: after one, Nuxt no longer knows which component this is)
  const words = useSiteWords()
  // The year of the copyright line: decided once on the server, so the browser draws the same.
  const year = useState('office-year', () => new Date().getFullYear())
  const { settings, name } = await useSite()
  return {
    settings, name, words, year,
    /** "Tesař", "Vondrová"; the second is null when the name is not two names joined by "&". */
    partners: computed(() => partnersOf(name.value)),
    /** "Vrbová 28, 586 01 Jihlava" */
    address: computed(() => addressOf(settings.value)),
    /** "Vrbová 28, Jihlava" */
    shortAddress: computed(() => addressOf(settings.value, true)),
    /** The phone as a link and as text; null until the settings hold one. */
    phone: computed(() => (settings.value?.phone ? { href: telHref(settings.value.phone), text: phoneText(settings.value.phone) } : null)),
    /** The header's button: its text (the phone menu's may be longer) and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl
      ? { label: settings.value.ctaLabel, long: settings.value.ctaLongLabel || settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) }
      : null)),
  }
}
