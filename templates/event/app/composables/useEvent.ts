// What the Event's blocks draw from: the facts of the event (Site settings), what follows from
// the date, and the collections. (The site-wide content, the page and `useSiteList` are the
// template kit's.)
import type { FeePeriod, NewsItem, Partner, ProgramItem, Question, Result, Track, VenuePoint } from '../lib/cms-content'

/** The routes, in the editors' order. */
export const useTracks = () => useSiteList<Track>('site-tracks', 'track')
/** The periods of the entry fee, in the editors' order. */
export const useFeePeriods = () => useSiteList<FeePeriod>('site-fee-periods', 'feePeriod')
/** The programme of the day, in the editors' order. */
export const useProgramme = () => useSiteList<ProgramItem>('site-programme', 'programItem')
/** Every result, with its route. */
export const useResults = () => useSiteList<Result>('site-results', 'result')
/** The news, newest first. */
export const useNews = () => useSiteList<NewsItem>('site-news', 'newsItem', { sort: 'date', dir: 'desc' })
/** The partners, in the editors' order. */
export const usePartners = () => useSiteList<Partner>('site-partners', 'partner')
/** The questions, in the editors' order. */
export const useQuestions = () => useSiteList<Question>('site-questions', 'question')
/** The numbered points of the plan, in the editors' order. */
export const useVenuePoints = () => useSiteList<VenuePoint>('site-venue-points', 'venuePoint')

/**
 * The visitor's clock, in milliseconds: null on the server and in the browser's first drawing
 * (so both draw the same), the real time from then on. `tick` makes it run every second (the
 * countdown). In development `?now=2027-06-01T12:00` sets the clock to that moment, to try the
 * pages after the start; a built site ignores it. Call it before the first `await` of a component.
 */
export function useClock(tick = false): Ref<number | null> {
  const now = useState<number | null>('event-now', () => null)
  const route = useRoute()
  onMounted(() => {
    const asked = import.meta.dev && typeof route.query.now === 'string' ? Date.parse(route.query.now) : Number.NaN
    const set = () => { now.value = Number.isNaN(asked) ? Date.now() : asked }
    set()
    if (tick && Number.isNaN(asked)) {
      const timer = setInterval(set, 1000)
      onBeforeUnmount(() => clearInterval(timer))
    }
  })
  return now
}

/** How long after the start the event counts as over: the results and photographs replace the countdown. */
const EVENT_LENGTH = 12 * 3_600_000

/** The event as the looks write it: its name, its day and place, and where the clock puts it (before, registration closed, over). */
export async function useEvent(options: { tick?: boolean } = {}) {
  const now = useClock(options.tick)
  const { settings, name } = await useSite()
  const words = useSiteWords()
  const start = computed(() => (settings.value?.date ? Date.parse(settings.value.date) : null))
  const day = computed(() => dateParts(settings.value?.date))
  const phase = computed<'before' | 'closed' | 'over'>(() => {
    if (now.value == null) return 'before'
    if (start.value != null && now.value >= start.value + EVENT_LENGTH) return 'over'
    const closes = settings.value?.registrationCloses ? Date.parse(settings.value.registrationCloses) : null
    return closes != null && now.value >= closes ? 'closed' : 'before'
  })
  /** The countdown's figures: days as they are, the rest with two digits. Before the clock runs: zeros. */
  const countdown = computed(() => {
    if (now.value == null || start.value == null) return { d: '000', h: '00', m: '00', s: '00' }
    const s = Math.max(0, Math.floor((start.value - now.value) / 1000))
    const pad = (n: number) => String(n).padStart(2, '0')
    return { d: String(Math.floor(s / 86400)), h: pad(Math.floor((s % 86400) / 3600)), m: pad(Math.floor((s % 3600) / 60)), s: pad(s % 60) }
  })
  return {
    settings, name, words, now, phase, countdown,
    /** The day of the start taken apart ("sobota", "22", "května", "2027", "10.00"); null until it is set. */
    day,
    /** "14 / 2027" */
    edition: computed(() => (settings.value?.edition && day.value ? `${settings.value.edition} / ${day.value.year}` : '')),
    /** The header's and the opening's button; null once registration is closed or the event is over. */
    cta: computed(() => (phase.value === 'before' && settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
    /** Where a route's sign-up link leads: its own address, else the site's. Null once registration is closed. */
    registerUrl: (track: Pick<Track, 'registerUrl'>): string | null => {
      const url = track.registerUrl || settings.value?.ctaUrl
      return phase.value === 'before' && url ? siteHref(url) : null
    },
  }
}

/** The fee table: the periods, the routes and the period that holds today. */
export async function useFees() {
  const now = useClock()
  const [periods, tracks] = await Promise.all([useFeePeriods(), useTracks()])
  const current = computed(() => currentPeriod(periods.value, now.value))
  return {
    periods, tracks, current,
    /** The cheapest price of the current period (a children's race does not count), for "from 250 Kč"; null when none holds. */
    cheapest: computed(() => {
      const prices = tracks.value.filter((t) => !t.forChildren).map((t) => priceIn(t, current.value)).filter((p): p is number => p != null)
      return prices.length ? Math.min(...prices) : null
    }),
    /** The last day of the current period ("28. 2."), when it has one. */
    until: computed(() => shortDay(periods.value[current.value]?.validUntil)),
  }
}
