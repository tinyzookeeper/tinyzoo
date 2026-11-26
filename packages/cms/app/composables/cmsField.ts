import { cmsFieldAttrs } from '../../shared/builder'
import { cmsBuilderOn } from '../builder/state'

/**
 * Marks an element as showing one field of its block, for the editor in the preview (experimental,
 * `NUXT_CMS_BUILDER=on`): bind what it returns on the element, in the template. While an editor works on
 * the page in the admin's preview it gives `data-cms-field` (and `data-cms-item`); on the live site, on
 * the server and in a preview without the switch it gives nothing, so the page's HTML stays as it was.
 *
 * The block is the nearest block around the element (`<CmsBlocks>` marks it). A field of an item of the
 * block's own list (`f.list()`), which the component draws itself, is named with the item's id.
 *
 *   <h2 v-bind="cmsField('heading')">{{ block.heading }}</h2>
 *   <h3 v-for="card in block.cards" :key="card.id" v-bind="cmsField('title', card.id)">{{ card.title }}</h3>
 *
 * A plain text (`f.text()`, one line or several) is then typed right in the page; a click on a rich
 * text, a picture or a link brings that field into view in the admin's panel.
 */
export function cmsField(field: string, item?: string | null): Record<string, string> {
  return cmsBuilderOn.value ? cmsFieldAttrs(field, item) : {}
}
