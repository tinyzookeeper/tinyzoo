// What the Association's blocks draw from: the facts (Site settings), the collections, and
// today. (The site-wide content, the page and `useSiteList` are the template kit's.)
import type { Document, Event as CalendarEvent, News, Person, Project, Supporter } from '~/lib/cms-content'

/** The projects, in the editors' order. */
export const useProjects = () => useSiteList<Project>('site-projects', 'project')
/** Every published event, past and coming (what is which depends on the day: `useCalendar`). */
export const useEvents = () => useSiteList<CalendarEvent>('site-events', 'event')
/** The news, the newest first. */
export const useNews = () => useSiteList<News>('site-news', 'news', { sort: 'date', dir: 'desc' })
/** The documents, in the editors' order. */
export const useDocuments = () => useSiteList<Document>('site-documents', 'document')
/** The committee, in the editors' order. */
export const usePeople = () => useSiteList<Person>('site-people', 'person')
/** The supporters, in the editors' order. */
export const useSupporters = () => useSiteList<Supporter>('site-supporters', 'supporter')

/**
 * Today, as a day in the site's time zone (`2026-11-23`). The server writes it into the page and
 * the browser starts from the same day, so what depends on it (the nearest event, the season, the
 * current month) is the same in the server's answer and the browser's first drawing; once the
 * page is shown the browser reads its own clock. In development `?now=2026-11-23` fixes the day.
 */
export function useToday() {
  const route = useRoute()
  const forced = import.meta.dev && typeof route.query.now === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.now) ? route.query.now : null
  const today = useState<string>('association-today', () => forced ?? todayKey())
  onMounted(() => { if (!forced) today.value = todayKey() })
  return today
}

/** The association as the looks write it: the facts of the settings, and the day (with its month and season). */
export async function useAssociation() {
  // (set up before the first wait: after one, a composable no longer finds the page it belongs to)
  const today = useToday()
  const words = useSiteWords()
  const { settings, name } = await useSite()
  const month = computed(() => Number(today.value.slice(5, 7)))
  return {
    settings, name, words, today, month,
    /** The season it is now. */
    season: computed(() => seasonOfMonth(month.value)),
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
  }
}

/** The events split by the day: what is coming (the nearest first) and what is past (the newest first). */
export function useCalendar(events: MaybeRefOrGetter<CalendarEvent[]>) {
  const today = useToday()
  const split = computed(() => splitEvents(toValue(events), today.value))
  return {
    today,
    coming: computed(() => split.value.coming),
    past: computed(() => split.value.past),
    /** The nearest coming event, which the opening and the calendar show large. */
    nearest: computed(() => split.value.coming[0] ?? null),
  }
}

/** The topic a visitor chose by pressing "Přihlásit se" on an event: the contact form starts from it. */
export const useTopic = () => useState<string>('association-topic', () => '')

/** The person who takes the calls of new volunteers: the first one marked so. */
export const volunteerOf = (people: Person[]): Person | null => people.find((p) => p.volunteers) ?? null
