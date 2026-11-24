// What the Medical blocks draw from: the opening hours and the other collections, and the
// facts of the practice (Site settings). (The site-wide content, the page and `useSiteList` are
// the template kit's.)
import type { Insurer, Notice, OpeningHour, Service, TeamMember } from '~/lib/cms-content'

/** The rows of the opening hours. */
export const useOpeningHours = () => useSiteList<OpeningHour>('site-hours', 'openingHour')
/** The notices, valid or not (`validNotices` picks what is on today). */
export const useNotices = () => useSiteList<Notice>('site-notices', 'notice')
/** The services, covered by insurance or not, in the editors' order. */
export const useServices = () => useSiteList<Service>('site-services', 'service')
/** The doctors and nurses, in the editors' order. */
export const useTeam = () => useSiteList<TeamMember>('site-team', 'teamMember')
/** The insurers, in the editors' order. */
export const useInsurers = () => useSiteList<Insurer>('site-insurers', 'insurer')

/** The week's hours as the looks draw them, and what they say about the moment `useClock` gives (nothing on the server). */
export function useWeek(hours: MaybeRefOrGetter<OpeningHour[]>) {
  const now = useClock()
  const words = useSiteWords()
  const week = computed(() => weekOf(toValue(hours)))
  const today = computed(() => (now.value ? todayOf(week.value, now.value) : null))
  const days = computed(() => openAndClosed(week.value))
  /** "7:00–13:00" for a day (`short`: "7–13"). */
  const span = (day: DayKey, short = false) => spanTextOf(week.value[day], words.value.and, short)
  return { week, now, today, days, span, words }
}

/** The practice as the looks write it: its name, address and phone. */
export async function useMedical() {
  const { settings, name } = await useSite()
  const words = useSiteWords()
  const address = computed(() => [settings.value?.street, settings.value?.town, settings.value?.floor].filter(Boolean).join(', '))
  return {
    settings, name, words, address,
    /** "tel:123456701", or null until the settings hold a phone. */
    phoneHref: computed(() => (settings.value?.phone ? telHref(settings.value.phone) : null)),
    smsHref: computed(() => (settings.value?.smsPhone ? `sms:${telHref(settings.value.smsPhone).slice(4)}` : null)),
  }
}

/** The notices valid today, and the one shown large. The server shows those of its own day; the browser takes over after it has drawn the same. */
export async function useValidNotices() {
  // (everything that needs the component is set up before the first wait)
  const now = useClock()
  const serverDay = useState<string>('medical-day', () => momentFromDate(new Date()).iso)
  const all = await useNotices()
  const valid = computed(() => validNotices(all.value, now.value?.iso ?? serverDay.value))
  return { valid, split: computed(() => splitNotices(valid.value)) }
}
