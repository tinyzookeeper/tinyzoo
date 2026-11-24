// What the Restaurant's blocks draw from: the collections, the clock, and the facts from
// Site settings (the address, the phone, the opening hours and whether the doors are open).
// (The site-wide content, the page and `useSiteList` are the template kit's.)
import type { DailyMenu, Dish, Event, MenuCategory, Supplier } from '~/lib/cms-content'
import type { OpenWords } from '../../texts/cs'
import type { MenuSection } from '../utils/site'

/** The parts of the menu, in the editors' order. */
export const useMenuCategories = () => useSiteList<MenuCategory>('site-menu-categories', 'menuCategory')
/** Every dish, in the editors' order (hidden ones included: the menu leaves them out). */
export const useDishes = () => useSiteList<Dish>('site-dishes', 'dish')
/** The lunch menus, the newest day first. */
export const useDailyMenus = () => useSiteList<DailyMenu>('site-daily-menus', 'dailyMenu', { sort: 'date', dir: 'desc' })
/** The events, the newest day first. */
export const useEvents = () => useSiteList<Event>('site-events', 'event', { sort: 'dateFrom', dir: 'desc' })
/** Where the ingredients come from, in the editors' order. */
export const useSuppliers = () => useSiteList<Supplier>('site-suppliers', 'supplier')

/**
 * The moment the page is drawn for, in milliseconds. It starts as the server's moment and goes
 * to the visitor's after the page is mounted, then follows the minutes, so what depends on the
 * time of day (open now, today's lunch) is the same in the server's answer and the browser's
 * first drawing, and right a moment later.
 */
export function useNow() {
  const now = useState<number>('site-now', () => Date.now())
  const ticking = useState<boolean>('site-now-ticking', () => false)
  onMounted(() => {
    now.value = Date.now()
    if (ticking.value) return
    ticking.value = true
    setInterval(() => { now.value = Date.now() }, 30_000)
  })
  return now
}

/** The restaurant as the looks write it: the name, the address, the phone, the hours and whether it is open. */
export async function useRestaurant() {
  // (the clock and the words first: after the first wait Nuxt no longer knows which component asks)
  const now = useNow()
  const words = useSiteWords()
  const { settings, name } = await useSite()
  const week = computed(() => weekHours(settings.value?.openingHours))
  const state = computed(() => openState(week.value, now.value))
  const phone = computed(() => phoneText(settings.value))
  return {
    settings, name, words, now, week, state, phone,
    /** The weekday of today, 0 for Monday. */
    today: computed(() => clockOf(now.value).weekday),
    /** "Kmínová 58, Jičín" */
    address: computed(() => shortAddress(settings.value)),
    /** The address of a call to the restaurant. */
    tel: computed(() => (phone.value ? telHref(phone.value) : '')),
    /** What the look says about being open now, in its own words; '' when no hours are set. */
    openText(w: OpenWords): string {
      const s = state.value
      if (!s) return ''
      if (s.open) return w.until(s.time)
      return s.when === 'today' ? w.today(s.time) : s.when === 'tomorrow' ? w.tomorrow(s.time) : w.later(words.value.onDay[s.day]!, s.time)
    },
  }
}

/**
 * One section of the menu shown at a time (Plate and Receipt): the section the owner marked to
 * open first until the visitor picks another.
 */
export function useMenuTabs(sections: MaybeRefOrGetter<MenuSection[]>) {
  const chosen = ref<string | null>(null)
  const active = computed(() => {
    const list = toValue(sections)
    return list.find((s) => s.category.id === chosen.value)?.category.id ?? (list.find((s) => s.category.opensFirst) ?? list[0])?.category.id ?? null
  })
  return { active, pick: (id: string) => { chosen.value = id } }
}
