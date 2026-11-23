// What the Wedding's blocks draw from: the facts of the day (Site settings) and the
// collections. (The site-wide content, the page and `useSiteList` are the template kit's.)
import type { Contact, Gift, Lodging, ProgramItem, Question } from '~/lib/cms-content'

/** The programme of the day, in the editors' order. */
export const useProgramme = () => useSiteList<ProgramItem>('site-programme', 'programItem')
/** Where guests can stay, in the editors' order. */
export const useLodgings = () => useSiteList<Lodging>('site-lodgings', 'lodging')
/** The gift list, in the editors' order. */
export const useGifts = () => useSiteList<Gift>('site-gifts', 'gift')
/** The practical questions, in the editors' order. */
export const useQuestions = () => useSiteList<Question>('site-questions', 'question')
/** Who to call on the day, in the editors' order. */
export const useContacts = () => useSiteList<Contact>('site-contacts', 'contact')

/** The wedding as the looks write it: the couple, the day, the place, the day to reply by. */
export async function useWedding() {
  const { settings, name } = await useSite()
  const words = useSiteWords()
  const couple = computed(() => coupleOf(name.value))
  const day = computed(() => dateParts(settings.value?.date))
  const deadline = computed(() => dateParts(settings.value?.rsvpDeadline))
  return {
    settings, name, words, couple,
    /** "Anežka a Šimon": both names with the language's "and", or the name as it is. */
    names: computed(() => (couple.value.second ? `${couple.value.first} ${words.value.and} ${couple.value.second}` : couple.value.first)),
    /** The day of the ceremony taken apart ("sobota", "19. června 2027", "12.30"); null until it is set. */
    day,
    /** The day to reply by ("30. dubna 2027"); null until it is set. */
    deadline,
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
  }
}

/** The page's sections, for a block that needs to know what else the page shows (the gallery). */
export async function usePageSections() {
  const { page } = await useSitePage()
  return computed(() => page.value?.sections ?? [])
}

/**
 * Reserving a gift: the button asks the site, the gift then says "reserved" for everyone.
 * Nobody learns who did it.
 */
export function useGiftReserve(gifts: MaybeRefOrGetter<Gift[]>) {
  const done = reactive(new Set<string>())
  const busy = ref<string | null>(null)
  const failed = ref<string | null>(null)
  return {
    busy, failed,
    isReserved: (gift: Gift) => gift.reserved || done.has(gift.id),
    async reserve(gift: Gift) {
      if (busy.value) return
      busy.value = gift.id
      failed.value = null
      try {
        await $fetch(`/api/gift/${gift.id}/reserve`, { method: 'POST' })
        done.add(gift.id)
      }
      catch {
        failed.value = gift.id
      }
      finally {
        busy.value = null
      }
    },
    /** The contribution anyone can add to (the first one marked so), shown larger than the rest. */
    open: computed(() => toValue(gifts).find((g) => g.open) ?? null),
    /** The gifts a guest can reserve. */
    list: computed(() => toValue(gifts).filter((g) => !g.open)),
  }
}
