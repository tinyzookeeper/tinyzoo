/**
 * tinyzoo's animals in a brand's colours (src/theme.ts, `brandMoments`).
 *
 * Every animal (app/assets/brand/characters/{muted,bright}/*.svg) is drawn in exactly two colours:
 * its body and a near-white face (#F9F7F3, #F9F7F4 or #F9F8F4). A brand admin draws the same SVG
 * inline with those two fills replaced by classes that cms-admin.css colours from
 * `--cms-animal-body` and `--cms-animal-face` (written with the brand accent), so the server
 * renders the animal in the brand's shade and it follows light and dark mode. Nothing else in the
 * drawing changes. The SVGs are tinyzoo's own package files, never anything from a site or a request.
 */

/** The near-white faces the animal files use. @internal */
export const CMS_ANIMAL_FACES = ['#F9F7F3', '#F9F7F4', '#F9F8F4'] as const

/** The class that takes the body's colour, and the face's. @internal */
export const CMS_ANIMAL_CLASSES = { body: 'cms-animal__body', face: 'cms-animal__face' } as const

/** An animal ready to draw inline: the root's `viewBox` and what goes inside `<svg>`. @internal */
export interface CmsAnimalDrawing {
  viewBox: string
  inner: string
  /** The body colour the file was drawn in (the colourful family's). */
  body: string
}

/** Every `fill="#rrggbb"` in a drawing, upper-cased, in order. @internal */
export function animalFills(svg: string): string[] {
  return [...svg.matchAll(/\bfill="(#[0-9a-f]{6})"/gi)].map((m) => m[1]!.toUpperCase())
}

/**
 * The drawing with its two fills turned into classes, or `null` when the file does not follow the
 * rule (not exactly one body colour and one face colour, other colour sources, anything active).
 * @internal
 */
export function recolourAnimal(svg: string): CmsAnimalDrawing | null {
  const root = /^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(svg)
  if (!root) return null
  const viewBox = /\bviewBox="([\d.\s-]+)"/.exec(root[1]!)?.[1]
  if (!viewBox) return null
  const inner = root[2]!
  // Only paths and circles with a fill: no styles, strokes, gradients, links, scripts or events.
  if (/<(?!\/?(?:path|circle)\b)[a-z]/i.test(inner) || /\b(?:style|stroke|class|href|on\w+|opacity|fill-opacity)\s*=/i.test(inner) || /\b(?:url|var)\(/i.test(inner)) return null
  const colours = [...new Set(animalFills(inner))]
  const faces = colours.filter((c) => (CMS_ANIMAL_FACES as readonly string[]).includes(c))
  const bodies = colours.filter((c) => !faces.includes(c))
  if (faces.length !== 1 || bodies.length !== 1) return null
  const body = bodies[0]!
  return {
    viewBox,
    body,
    inner: inner.replace(/\bfill="(#[0-9a-f]{6})"/gi, (_, c: string) => `class="${c.toUpperCase() === body ? CMS_ANIMAL_CLASSES.body : CMS_ANIMAL_CLASSES.face}"`),
  }
}
