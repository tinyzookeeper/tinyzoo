import type { WordmarkDef } from '#shared/templates'

// The typeface a look writes the site's name in, for the pictures that write a typed name over
// a look (LookShot.vue). The files are the look's own (cloud/public/templates/fonts/, copied
// from a real site by scripts/template-pictures.mjs); a browser fetches one only when a name
// is really drawn in it.

const added = new Set<string>()

/** The name the typeface goes by on these pages: its own, kept apart from the app's typefaces. */
export const wordmarkFamily = (wordmark: WordmarkDef): string => `tzw-${wordmark.family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

/** Make a look's typeface known to the page (in the browser; on the server the name is drawn in the fallback until it arrives). */
export function useWordmarkFont(wordmark: MaybeRefOrGetter<WordmarkDef | null | undefined>): void {
  if (!import.meta.client) return
  watch(() => toValue(wordmark), (w) => {
    if (!w || typeof FontFace === 'undefined') return
    for (const font of w.fonts) {
      if (added.has(font.src)) continue
      added.add(font.src)
      try {
        document.fonts.add(new FontFace(wordmarkFamily(w), `url("${font.src}") format("woff2")`, {
          weight: font.weight || '400', style: font.style || 'normal', ...(font.stretch ? { stretch: font.stretch } : {}), ...(font.range ? { unicodeRange: font.range } : {}), display: 'swap',
        }))
      }
      catch { /* a descriptor this browser does not take: the fallback typeface stays */ }
    }
  }, { immediate: true })
}
