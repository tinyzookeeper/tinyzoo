// What the Development's blocks draw from: the collections, the facts of the project (Site
// settings) and the one behaviour the price list, the drawings of the building and the
// enquiry form share. (The site-wide content, the page and `useSiteList` are the template kit's.)
import type { Flat, Floor, Milestone, Place, Reference, Standard } from '../lib/cms-content'

/** Every flat, by number. */
export async function useFlats() {
  const list = await useSiteList<Flat>('site-flats', 'flat')
  return computed(() => sortFlats(list.value))
}
/** The floors' notes and height marks. */
export const useFloors = () => useSiteList<Floor>('site-floors', 'floor')
/** What is in the price, in the editors' order. */
export const useStandards = () => useSiteList<Standard>('site-standards', 'standard')
/** What is nearby, in the editors' order. */
export const usePlaces = () => useSiteList<Place>('site-places', 'place')
/** The stages of construction, in the editors' order. */
export const useMilestones = () => useSiteList<Milestone>('site-milestones', 'milestone')
/** The buildings the developer has finished, in the editors' order. */
export const useReferences = () => useSiteList<Reference>('site-references', 'reference')

/** The page's sections, for a block that needs to know what else the page shows. */
export async function usePageSections() {
  const { page } = await useSitePage()
  return computed(() => page.value?.sections ?? [])
}

/**
 * The state the price list and the drawings of the building share: the filter of the list, the
 * flat a visitor picked in a drawing, and the flat they want to ask about. It lives in the page
 * (`useState`), so a click in the elevation, the squares or the floor plan finds the same flat in
 * the list, and "I'm interested" fills in the enquiry form.
 */
export function useFlatBrowser() {
  const filter = useState('development-filter', () => ({ layout: 'all', state: 'all' }))
  const picked = useState<string | null>('development-picked', () => null)
  const asked = useState<string>('development-asked', () => '')
  /** The flat whose row the pointer is over: its bay in the elevation lights up. */
  const hovered = useState<string | null>('development-hovered', () => null)
  const matches = (flat: Pick<Flat, 'layout' | 'state'>) => (filter.value.layout === 'all' || flat.layout === filter.value.layout) && (filter.value.state === 'all' || flat.state === filter.value.state)
  const reset = () => { filter.value = { layout: 'all', state: 'all' } }
  /** Show a flat in the price list: the filter is cleared, the flat's row is lit and scrolled to. */
  async function jump(slug: string) {
    reset()
    picked.value = slug
    await nextTick()
    // (the list is drawn twice, as a table and as cards; only one of them is on the screen)
    const row = [document.getElementById(`byt-${slug}`), document.getElementById(`m-byt-${slug}`)].find((el) => el && el.offsetParent)
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  return { filter, picked, asked, hovered, matches, reset, jump }
}
