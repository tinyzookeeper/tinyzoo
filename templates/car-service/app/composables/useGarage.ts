// What the Garage's blocks draw from: the collections, the moment (for "open today" and the
// seasonal offer) and the facts from Site settings. (The site-wide content, the page and
// `useSiteList` are the template kit's: templates/kit/app/composables/useSite.ts.)
import type { SiteForm } from '#imports'
import type { Extra, Review, SeasonalOffer, Service, ServiceGroup, TeamMember } from '~/lib/cms-content'

/** The groups of the price list, in the editors' order. */
export const useServiceGroups = () => useSiteList<ServiceGroup>('site-service-groups', 'serviceGroup')
/** Every line of the price list, in the editors' order, each with its group. */
export const useServices = () => useSiteList<Service>('site-services', 'service')
/** The seasonal offers (the block shows those valid today). */
export const useOffers = () => useSiteList<SeasonalOffer>('site-offers', 'seasonalOffer')
/** The people, in the editors' order. */
export const useTeam = () => useSiteList<TeamMember>('site-team', 'teamMember')
/** What customers said, in the editors' order. */
export const useReviews = () => useSiteList<Review>('site-reviews', 'review')
/** What comes with a repair, in the editors' order. */
export const useExtras = () => useSiteList<Extra>('site-extras', 'extra')

/**
 * The moment the website writes "today" from. The server's moment goes to the browser with the
 * page, so both draw the same first picture; once mounted, the visitor's own clock takes over.
 * In development `?now=2026-11-23T10:00` fixes it, to look at the site on a day and an hour of
 * your choice; a built site ignores it.
 */
export function useSiteNow() {
  const asked = import.meta.dev ? useRoute().query.now : undefined
  const fixed = typeof asked === 'string' && !Number.isNaN(new Date(asked).getTime()) ? new Date(asked).getTime() : null
  const now = useState<number>('site-now', () => fixed ?? Date.now())
  onMounted(() => { if (fixed == null) now.value = Date.now() })
  return now
}

/** The garage as the looks write it: contact, address, today's hours, the next free days, the rates. */
export async function useGarage() {
  // (the moment first: it needs the component that is being set up, which an `await` before it would lose)
  const now = useSiteNow()
  const { settings, name } = await useSite()
  const words = useSiteWords()
  const today = computed(() => openToday(settings.value?.hours, now.value))
  return {
    settings, name, words, now,
    /** The short name of the header: the owner's, else the name without "Autoservis". */
    shortName: computed(() => settings.value?.shortName || shortNameOf(name.value)),
    phone: computed(() => settings.value?.phone ?? ''),
    phoneUrl: computed(() => (settings.value?.phone ? phoneHref(settings.value.phone) : '')),
    phone2: computed(() => settings.value?.phone2 ?? ''),
    phone2Url: computed(() => (settings.value?.phone2 ? phoneHref(settings.value.phone2) : '')),
    /** "Vlečková 412, Jičín" */
    place: computed(() => [settings.value?.street, settings.value?.city].filter(Boolean).join(', ')),
    /** The week from Monday, a closed day being null. */
    week: computed(() => weekHours(settings.value?.hours)),
    /** Whether the garage is open today, and the hours of today. */
    today,
    /** "Dnes otevřeno do 17.00", "Dnes už zavřeno", "Dnes zavřeno". */
    openLine: computed(() => {
      const t = today.value
      return t.state === 'closed' ? words.value.closedToday : t.state === 'over' ? words.value.closedAlready : words.value.openUntil(t.hours!.to)
    }),
    /** "7.00–17.00", or "zavřeno". */
    todayHours: computed(() => (today.value.hours ? `${today.value.hours.from}–${today.value.hours.to}` : words.value.closed)),
    /** The next free days: "čtvrtek 26. 11." and "zítra, úterý". */
    freeService: computed(() => freeDayLine(settings.value?.nextService, now.value, words.value)),
    freeTyres: computed(() => freeDayLine(settings.value?.nextTyres, now.value, words.value)),
    /** The same, written to stand inside a sentence: "ve čtvrtek 26. 11.", "zítra". */
    serviceInSentence: computed(() => freeDayInSentence(settings.value?.nextService, now.value, words.value)),
    tyresInSentence: computed(() => freeDayInSentence(settings.value?.nextTyres, now.value, words.value)),
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
  }
}

/** The page's sections, for a block that needs to know what else the page shows. */
export async function usePageSections() {
  const { page } = await useSitePage()
  return computed(() => page.value?.sections ?? [])
}

/**
 * The price list's groups that are shown and the one a link or a warning light asks for: the
 * price list opens it and marks it for a moment. One state for the whole page.
 */
export function useGroupFocus() {
  return useState<{ slug: string; at: number } | null>('price-group-focus', () => null)
}

/**
 * What the booking form's looks share: the label and the example of every field (the block's
 * own wording over the form's), the days the form offers (the next free ones from Site settings),
 * and the text under the phone number split where the second number belongs.
 */
export function useBookingForm(form: SiteForm, block: MaybeRefOrGetter<BlockOf<'booking'>>, garage: { settings: Ref<{ nextService: string | null } | null>; words: Ref<Words> }) {
  const days = computed(() => bookingDays(garage.settings.value?.nextService, garage.words.value))
  // The first choice stands until the visitor picks another, as a select shows it.
  watch(days, (list) => { if (!list.includes(form.values.when)) form.values.when = list[0] }, { immediate: true })
  if (form.values.loaner === undefined) form.values.loaner = false
  const field = (key: string) => form.fields.value.find((f) => f.key === key)
  return {
    days,
    label: (key: string) => field(key)?.label ?? '',
    help: (key: string) => field(key)?.help ?? undefined,
    /** The question about the car, the note beside the plate, the example in the big field. */
    carLabel: computed(() => toValue(block).carLabel || field('car')?.label || ''),
    plateLabel: computed(() => toValue(block).plateLabel ?? ''),
    messageHint: computed(() => toValue(block).messageHint || field('message')?.help || undefined),
    loanerLabel: computed(() => toValue(block).loanerLabel || field('loaner')?.label || ''),
    submitLabel: computed(() => toValue(block).submitLabel || form.submitLabel.value),
    sentText: computed(() => toValue(block).sentText || form.successMessage.value),
    /** "Po–Čt 7.00–17.00. Mimo provozní dobu na mobil " and ", stačí SMS.": the text round the second number. */
    callParts: computed<[string, string | null]>(() => {
      const note = toValue(block).callNote ?? ''
      const at = note.indexOf('{phone}')
      return at === -1 ? [note, null] : [note.slice(0, at), note.slice(at + 7)]
    }),
  }
}
