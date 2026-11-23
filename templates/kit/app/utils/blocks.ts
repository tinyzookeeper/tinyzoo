// Types the looks' components share. (No imports: the unit specs load the templates' helpers
// outside Nuxt.) A template names its own blocks in app/utils/site.ts:
//
//   import type { Page } from '../lib/cms-content'
//   export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/**
 * An address that leads to an entry of a collection instead of a page built from blocks:
 * `/album/anna-a-vojta`. A template lists its own in `ENTRY_PAGES` (app/utils/site.ts).
 */
export interface EntryPage {
  /** What the address leads to: `album`. */
  kind: string
  /** The first part of the address: `/album/<slug>` → `album`. */
  prefix: string
  /** The collection asked for the entry: `/api/content/<entity>/<slug>`. */
  entity: string
  /** The look's part that draws it: `components/<look>/<part>.vue`, given the entry as `entry`. */
  part: string
  /** The entry's name, for the page's title, when the collection has no SEO fields of its own. */
  titleField?: string
  /** The field that describes the entry to search engines. */
  descriptionField?: string
  /** The field with the picture shown when the page is shared. */
  imageField?: string
}
