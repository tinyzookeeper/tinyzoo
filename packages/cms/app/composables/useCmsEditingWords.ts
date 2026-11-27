import { computed, type ComputedRef } from 'vue'
import { cmsBuilderOn, cmsBuilderWords } from '../builder/state'

/** The words of a card's placeholders in the admin's language (see `useCmsEditingWords()`). */
export interface CmsEditingWords {
  chooseField: string
  fieldMissing: (name: string) => string
  fieldUnfit: (name: string) => string
  emptyCard: string
  sampleCard: string
}

const off: CmsEditingWords = { chooseField: '', fieldMissing: () => '', fieldUnfit: () => '', emptyCard: '', sampleCard: '' }

/**
 * The words of a card's placeholders in the admin's language, while an editor works on the page in
 * the admin's preview with the editor in the preview on (experimental, `NUXT_CMS_BUILDER=on`):
 * "Vyberte pole" in a Czech admin. Every string is empty, and both functions return an empty string,
 * on the live site, on the server, in a preview without the switch, and for a word the admin did not send.
 *
 * Use it for placeholders that only an editor sees (useCmsEditing()):
 *
 *   const words = useCmsEditingWords()
 *   // <p v-if="editing && !field">{{ words.fieldMissing('Cena') }}</p>   -> "Pole Cena chybí"
 */
export function useCmsEditingWords(): ComputedRef<CmsEditingWords> {
  return computed(() => {
    if (!cmsBuilderOn.value) return off
    const w = cmsBuilderWords.value.texts
    const named = (text: string) => (name: string) => text.replace('{name}', () => name)
    return { chooseField: w.chooseField, fieldMissing: named(w.fieldMissing), fieldUnfit: named(w.fieldUnfit), emptyCard: w.emptyCard, sampleCard: w.sampleCard }
  })
}
