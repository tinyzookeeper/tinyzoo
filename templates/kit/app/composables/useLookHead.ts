import type { ResolvedLook } from '../../looks'

/**
 * Put a site's look on the page: `<html data-look="atelier" data-colors="bronz" style="--brand:…">`.
 * The look's CSS is written under `html[data-look="…"]`, the preset's variables come inline, so
 * the server's first answer is already in the right look and colours. Call it in the website's
 * layout only: the admin lives outside it and keeps its own look.
 */
export function useLookHead(resolved: MaybeRefOrGetter<ResolvedLook>): void {
  useHead({
    htmlAttrs: {
      'data-look': () => toValue(resolved).look.id,
      'data-colors': () => toValue(resolved).preset.id,
      'style': () => toValue(resolved).style,
    },
  })
}
