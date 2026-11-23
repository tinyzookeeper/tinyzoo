// The collections the Photographer's blocks draw from. (The site-wide content, the page the
// visitor is on and `useSiteList` are the template kit's: templates/kit/app/composables/useSite.ts.)
import type { Album, Category, Pack, Testimonial } from '~/lib/cms-content'

/** Every published album, newest first, with its category and photographs. */
export const useAlbums = () => useSiteList<Album>('site-albums', 'album', { sort: 'date', dir: 'desc' })
/** The categories, in the editors' order. */
export const useCategories = () => useSiteList<Category>('site-categories', 'category')
/** The packages of the price list, in the editors' order. */
export const usePacks = () => useSiteList<Pack>('site-packs', 'pack')
/** What clients said, in the editors' order. */
export const useTestimonials = () => useSiteList<Testimonial>('site-testimonials', 'testimonial')

/** The photographs the page's openings show large in this look: the gallery leaves them out, so no picture shows twice on one page. */
export async function useOpeningPhotoIds(): Promise<ComputedRef<Set<string>>> {
  // Both asked for before the first wait: after one, Nuxt no longer knows which request this is.
  const [{ page }, look] = await Promise.all([useSitePage(), useLookId()])
  return computed(() => {
    const ids = new Set<string>()
    for (const block of page.value?.sections ?? []) {
      const id = block.type === 'hero' ? openingPhoto(block, look.value)?.id : null
      if (id) ids.add(id)
    }
    return ids
  })
}
