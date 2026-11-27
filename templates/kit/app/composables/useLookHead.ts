import type { ResolvedLook } from '../../looks'

/**
 * Put a site's look on the page: `<html data-design="photographer" data-look="atelier"
 * data-colors="bronz" style="--brand:…">`, with `data-own="#986500"` when the owner's own
 * colour is shown (as it is shown). The look's CSS is written under `html[data-look="…"]`,
 * the preset's variables come inline, so the server's first answer is
 * already in the right look and colours. Call it in the website's layout only: the admin lives
 * outside it and keeps its own look.
 *
 * In the one app each look's stylesheet is a file of its own, linked here: a visitor loads only
 * the look the site shows (a template's own build has every look in its main stylesheet).
 */
export function useLookHead(resolved: MaybeRefOrGetter<ResolvedLook>): void {
  const design = useDesign()
  useHead({
    htmlAttrs: {
      'data-design': design.id,
      'data-look': () => toValue(resolved).look.id,
      'data-colors': () => toValue(resolved).preset.id,
      'style': () => toValue(resolved).style,
      // Left out by unhead when there is no own colour.
      'data-own': () => toValue(resolved).own?.shown,
    },
    link: () => {
      const href = design.css[toValue(resolved).look.id]
      // After the main stylesheet, which sets the order of the cascade layers (base, theme,
      // components, utilities); a look's own layers must not come first.
      return href ? [{ key: 'tz-look', rel: 'stylesheet', href, tagPriority: 'low' as const }] : []
    },
  })
}
