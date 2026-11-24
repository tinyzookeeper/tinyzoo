// What the Accommodation's blocks draw from: the collections, the prices put together from
// rooms and seasons, and the enquiry a guest has begun. (The site-wide content, the page and
// `useSiteList` are the template kit's.)
import type { SiteForm } from '#imports'
import type { Feature, Review, Room, RoomPrice, Season, Trip } from '../lib/cms-content'
import type { RoomRow } from '../utils/site'

/** The rooms, in the editors' order. */
export const useRooms = () => useSiteList<Room>('site-rooms', 'room')
/** The seasons of the year, in the editors' order. */
export const useSeasons = () => useSiteList<Season>('site-seasons', 'season')
/** What each room costs in each season. */
export const useRoomPrices = () => useSiteList<RoomPrice>('site-room-prices', 'roomPrice')
/** What the house offers, in the editors' order. */
export const useFeatures = () => useSiteList<Feature>('site-features', 'feature')
/** The tips for trips, in the editors' order. */
export const useTrips = () => useSiteList<Trip>('site-trips', 'trip')
/** What guests wrote, in the editors' order. */
export const useReviews = () => useSiteList<Review>('site-reviews', 'review')

/** Rooms by seasons: the price table, the "from" prices and the prices of one room. */
export async function usePricing() {
  const [rooms, seasons, prices] = await Promise.all([useRooms(), useSeasons(), useRoomPrices()])
  const priceOf = (roomId: string, seasonId: string): number | null => prices.value.find((p) => p.room.id === roomId && p.season.id === seasonId)?.amount ?? null
  const amounts = (roomId: string) => prices.value.filter((p) => p.room.id === roomId).map((p) => p.amount)
  return {
    rooms, seasons,
    priceOf,
    /** The cheapest night of a room, in any season. */
    fromPrice: (roomId: string): number | null => { const a = amounts(roomId); return a.length ? Math.min(...a) : null },
    /** The cheapest night of any room in one season. */
    seasonFrom: (seasonId: string): number | null => { const a = prices.value.filter((p) => p.season.id === seasonId).map((p) => p.amount); return a.length ? Math.min(...a) : null },
    /** The cheapest night of the whole house. */
    cheapest: computed(() => (prices.value.length ? Math.min(...prices.value.map((p) => p.amount)) : null)),
    /** A room's prices by season, in the seasons' order. */
    pricesOf: (roomId: string) => seasons.value.map((season) => ({ season, amount: priceOf(roomId, season.id) })).filter((x): x is { season: Season; amount: number } => x.amount != null),
  }
}

/** The enquiry a guest has begun: the short form of the opening and the "Enquire" links of the rooms fill it in. Shared by the page and the room pages while the visitor stays on the site. */
export const useStayDraft = () => useState('stay-draft', () => ({ arrival: '', departure: '', adults: '2', room: '' }))

/** The facts of the stay as the looks write them: the settings, the words and the phone's link. */
export async function useStay() {
  const { settings, name } = await useSite()
  const words = useSiteWords()
  return {
    settings, name, words,
    tel: computed(() => (settings.value?.phone ? telHref(settings.value.phone) : '')),
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
  }
}

/**
 * The quick form of the opening and every "enquire" link lead to the enquiry form: on the page
 * that holds it the visitor is scrolled there, on another page taken to it.
 */
export function useGoToEnquiry() {
  const anchor = anchorOf('enquiry')
  return async () => {
    const target = import.meta.client ? document.getElementById(anchor ?? '') : null
    if (target) {
      target.scrollIntoView()
      document.getElementById('form-enquiry-name')?.focus({ preventScroll: true })
    }
    else await navigateTo(`/#${anchor}`)
  }
}

/** The rooms with their prices, for the cards and the table. */
export function roomRows(pricing: Awaited<ReturnType<typeof usePricing>>): RoomRow[] {
  return pricing.rooms.value.map((room) => ({
    room,
    from: pricing.fromPrice(room.id),
    prices: pricing.pricesOf(room.id),
    amounts: pricing.seasons.value.map((season) => pricing.priceOf(room.id, season.id)),
  }))
}

/**
 * What the enquiry form needs besides its fields: the choice of rooms (the guesthouse's own,
 * and the extra choices the block lists), and the draft a guest has begun elsewhere on the
 * site laid into the form. The draft is laid in after the page is drawn, so the server's
 * answer and the browser's first drawing agree.
 */
export function useEnquiryFields(form: SiteForm, rooms: MaybeRefOrGetter<Room[]>, block: MaybeRefOrGetter<{ moreRooms: Array<{ name: string }> }>) {
  const words = useSiteWords()
  const draft = useStayDraft()
  if (form.values.room === undefined) form.values.room = ''
  const choices = computed(() => [
    ...toValue(rooms).map((room) => ({ value: roomTitle(words.value, room), name: room.name, label: `${roomTitle(words.value, room)} · ${words.value.beds(room.beds)}` })),
    ...toValue(block).moreRooms.map((m) => ({ value: m.name, name: m.name, label: m.name })),
  ])
  const lay = () => {
    const d = draft.value
    if (d.arrival) form.values.arrival = d.arrival
    if (d.departure) form.values.departure = d.departure
    if (d.adults) form.values.adults = d.adults
    if (d.room) form.values.room = d.room
  }
  onMounted(lay)
  watch(draft, lay, { deep: true })
  return { choices }
}
