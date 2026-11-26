import { computed, type ComputedRef } from 'vue'
import { cmsBuilderOn } from '../builder/state'

/**
 * Whether an editor is working on this page right now: the page is drawn in the admin's preview
 * and the editor in the preview is on there (experimental, `NUXT_CMS_BUILDER=on`). `false` on the
 * live site, on the server, and in a preview without the switch; it turns `true` after the page
 * has loaded, once the admin says so.
 *
 * Use it to make something visible that a visitor never sees, so that it can be selected and
 * filled in: an empty block drawn as a quiet placeholder of its kind, an empty list as a box.
 *
 *   const editing = useCmsEditing()
 *   const items = computed(() => editing.value ? block.items : block.items.filter(filled))
 *   // <div v-if="!items.length && editing" class="placeholder" />
 */
export function useCmsEditing(): ComputedRef<boolean> {
  return computed(() => cmsBuilderOn.value)
}
