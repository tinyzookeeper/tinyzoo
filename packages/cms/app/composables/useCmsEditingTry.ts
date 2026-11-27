import { computed, type ComputedRef } from 'vue'
import { cmsBuilderOn, cmsBuilderTry, type CmsEditingTry } from '../builder/state'

export type { CmsEditingTry }

/**
 * The field an editor tries on a block of a card (experimental, `NUXT_CMS_BUILDER=on`): while the admin's
 * panel points at a field a card's block could show, this is `{ section, block, key, value }`: block `block`
 * of the section `section` is to be drawn with `key` = `value` in every card at once. `null` on the live
 * site, on the server, in a preview without the switch, and when nothing is tried.
 *
 * A site's own card that draws a design itself applies it to the block before reading it:
 *
 *   const tried = useCmsEditingTry()
 *   // const shown = (b) => tried.value?.section === section.id && tried.value.block === b.id
 *   //   ? { ...b, [tried.value.key]: tried.value.value } : b
 */
export function useCmsEditingTry(): ComputedRef<CmsEditingTry | null> {
  return computed(() => (cmsBuilderOn.value ? cmsBuilderTry.value : null))
}
