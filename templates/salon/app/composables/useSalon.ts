// What the Salon's blocks draw from: the facts of the salon (Site settings) and the
// collections. (The site-wide content, the page and `useSiteList` are the template kit's.)
import type { Person, Result, Review, Service, ServiceGroup } from '../lib/cms-content'
import type { SiteForm } from '#imports'

/** The groups of the price list, in the editors' order. */
export const useServiceGroups = () => useSiteList<ServiceGroup>('site-service-groups', 'serviceGroup')
/** Every service, in the editors' order. */
export const useServices = () => useSiteList<Service>('site-services', 'service')
/** The team, in the editors' order. */
export const useTeam = () => useSiteList<Person>('site-team', 'person')
/** The photographs of finished work, in the editors' order. */
export const useResults = () => useSiteList<Result>('site-results', 'result')
/** What customers said, in the editors' order. */
export const useReviews = () => useSiteList<Review>('site-reviews', 'review')

/** The price list: the groups, each with its services. */
export async function usePriceList() {
  // Both asked for before the first wait: after one, Nuxt no longer knows which request this is.
  const [groups, services] = await Promise.all([useServiceGroups(), useServices()])
  return computed(() => groupServices(groups.value, services.value))
}

/** The salon as the looks write it: its name, how to reach it, and the opening hours. */
export async function useSalon() {
  const { settings, name } = await useSite()
  const words = useSiteWords()
  const days = computed(() => hoursOf(settings.value, words.value))
  return {
    settings, name, words, days,
    /** The street and its number: ["Šípková", "59"]. */
    street: computed(() => addressParts(settings.value?.address)),
    /** "506 01 Jičín" → "Jičín". */
    townName: computed(() => (settings.value?.town ?? '').replace(/^[\d\s]+/, '').trim()),
    /** The phone number as it is read, and as it is dialled. */
    phone: computed(() => (settings.value?.phone ? { text: phoneText(settings.value.phone), href: telHref(settings.value.phone) } : null)),
    /** The days the week is open, from the first to the last, when they are one run: [0, 5] for Monday to Saturday. */
    range: computed<[number, number] | null>(() => {
      const open = days.value.filter((d) => d.from != null)
      if (!open.length) return null
      const first = open[0]!.index
      const last = open[open.length - 1]!.index
      return open.length === last - first + 1 ? [first, last] : null
    }),
  }
}

/**
 * Today as the browser knows it: 0 for Monday, and -1 until the page is mounted, so the server's
 * answer and the browser's first drawing are the same (nothing is marked as today).
 */
export function useToday() {
  const today = ref(-1)
  onMounted(() => { today.value = weekdayIndex(new Date()) })
  return today
}

/** What the salon's hours say about today: null until the page is mounted, then today's day (null when closed) and the next open day. */
export function useOpenNow(days: Ref<OpenDay[]>, today: Ref<number>) {
  return computed(() => {
    if (today.value < 0) return null
    const day = days.value[today.value]!
    return { day: day.from != null ? day : null, next: nextOpen(days.value, today.value) }
  })
}

/** What the visitor chose by clicking a price, a team member or a photograph: the booking form takes it. */
export function useBookingChoice() {
  return { service: useState('booking-service', () => ''), person: useState('booking-person', () => '') }
}

/** Whether the phone's bottom bar shows: after the opening has been scrolled past. */
export function useScrolled(after = 480) {
  const scrolled = ref(false)
  const onScroll = () => { scrolled.value = window.scrollY >= after }
  onMounted(() => { onScroll(); window.addEventListener('scroll', onScroll, { passive: true }) })
  onBeforeUnmount(() => { if (import.meta.client) window.removeEventListener('scroll', onScroll) })
  return scrolled
}

/**
 * The booking form's choices, the same in every look: the service and the person (what a click
 * elsewhere on the page chose comes in), and the day, which only exists once the page is mounted
 * (it depends on the date) and follows the person's working days.
 */
export function useBooking(form: SiteForm, groups: MaybeRefOrGetter<ServiceGroupWithItems[]>, team: MaybeRefOrGetter<Person[]>, days: MaybeRefOrGetter<OpenDay[]>) {
  const words = useSiteWords()
  const choice = useBookingChoice()
  const anyone = computed(() => words.value.anyone)
  // The empty choices read as the words, so a request in the admin says "anyone" and not nothing.
  if (!form.values.service) form.values.service = words.value.undecided
  if (!form.values.person) form.values.person = anyone.value
  // (the days exist only once the page is mounted: before that the server's answer and the
  // browser's first drawing both have none)
  const dayList = ref<string[]>([])
  const mounted = ref(false)
  const refresh = () => {
    if (!mounted.value) return
    const chosen = toValue(team).find((p) => p.name === form.values.person)
    dayList.value = bookableDays(toValue(days), chosen ? workDays(chosen) : null, words.value.dayNames)
    if (!dayList.value.includes(form.values.day)) form.values.day = dayList.value[0] ?? ''
  }
  watch(() => choice.service.value, (v) => { if (v) form.values.service = v })
  watch(() => choice.person.value, (v) => { if (v) form.values.person = v })
  watch(() => form.values.person, refresh)
  onMounted(() => {
    mounted.value = true
    // (a click made before the form was there is still waiting)
    if (choice.service.value) form.values.service = choice.service.value
    if (choice.person.value) form.values.person = choice.person.value
    refresh()
  })
  return {
    days: dayList,
    people: computed(() => [anyone.value, ...toValue(team).map((p) => p.name)]),
    /** The services with their group, as a select's options say them. */
    optionLabel: (s: Service, narrow = false) => `${s.name} · ${s.minutes} min · ${s.priceFrom ? `${words.value.from} ` : ''}${kc(s.price, narrow)}`,
    undecided: words.value.undecided,
    choose: choice,
  }
}
