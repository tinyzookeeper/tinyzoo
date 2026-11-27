import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { cmsBuilderOn, cmsBuilderWords } from '../builder/state'

/**
 * The name of a block type in the admin's language, while an editor works on the page in the admin's
 * preview with the editor in the preview on (experimental, `NUXT_CMS_BUILDER=on`): "Nadpis" for a
 * `heading` in a Czech admin. An empty string on the live site, on the server, in a preview without
 * the switch, and for a type the page's blocks do not have.
 *
 * Use it for the words of a placeholder that only an editor sees (useCmsEditing()), in the admin's
 * language rather than the site's:
 *
 *   const label = useCmsEditingLabel('heading')
 *   // <h2 v-if="!block.text && editing" class="ghost">{{ label }}</h2>
 */
export function useCmsEditingLabel(type: MaybeRefOrGetter<string>): ComputedRef<string> {
  return computed(() => (cmsBuilderOn.value ? cmsBuilderWords.value.names[toValue(type)] ?? '' : ''))
}
