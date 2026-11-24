// One convention for the few texts where a part stands out: an editor writes it between
// asterisks ("Napište mi *o termín.*"). A look decides what that means: italics in one,
// a link in a sentence, nothing at all in another.

export interface EmphasisPart { text: string; marked: boolean }

/** "Svatby a rodiny *ve východních Čechách.*" → [{ text: 'Svatby a rodiny ', marked: false }, { text: 've východních Čechách.', marked: true }] */
export function emphasisParts(text: string | null | undefined): EmphasisPart[] {
  const parts: EmphasisPart[] = []
  const source = text ?? ''
  const pattern = /\*([^*]+)\*/g
  let at = 0
  for (let m = pattern.exec(source); m; m = pattern.exec(source)) {
    if (m.index > at) parts.push({ text: source.slice(at, m.index), marked: false })
    parts.push({ text: m[1]!, marked: true })
    at = m.index + m[0].length
  }
  if (at < source.length) parts.push({ text: source.slice(at), marked: false })
  return parts
}

/** The text without the asterisks. */
export const plainEmphasis = (text: string | null | undefined): string => emphasisParts(text).map((p) => p.text).join('')

/**
 * Czech typography, the part a typesetter does by hand: a one-letter word (a, i, k, o, s, u, v,
 * z) and the short prepositions (od, do, ve, ze, ke, za) stay with the word after them, and a
 * number stays with what it counts ("19 900 Kč", "50 km", "30 %", "13 × 18 cm"). Returns the text
 * with non-breaking spaces in those places, so a line never ends in one of them.
 */
export function tidyText(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/(^|[\s(„])([AaIiKkOoSsUuVvZz]|[Oo]d|[Dd]o|[Vv]e|[Zz]e|[Kk]e|[Zz]a)[ \t]+(?=\S)/g, '$1$2\u00A0')
    // (twice: in "a v lese" the second word starts where the first match ended)
    .replace(/(\u00A0)([AaIiKkOoSsUuVvZz])[ \t]+(?=\S)/g, '$1$2\u00A0')
    .replace(/(\d)[ \t]+(?=\d|Kč|km\b|cm\b|mm\b|m\b|%|×|hod)/g, '$1\u00A0')
    .replace(/×[ \t]+(?=\d)/g, '×\u00A0')
}
