// The typefaces of a design's looks (templates/<id>/fonts.ts), and every design's in one
// @nuxt/fonts setting for the one app (templates/app/nuxt.config.ts).
//
// In a template's own build the families are `global`: their @font-face rules go into every
// page. The one app carries many designs' families, so there they are not global: @nuxt/fonts
// writes a family's @font-face rules into the stylesheet that names it (in `font-family` or a
// `--font-*` variable), which is the look's own file. A visitor loads only the faces of the
// look the site shows.

export interface FontFamily {
  name: string
  provider: 'google'
  /** Static weights (`[400, 700]`) or one range of a variable face (`['300 500']`). */
  weights: (number | string)[]
  styles?: ('normal' | 'italic')[]
}

export interface DesignFonts {
  families: FontFamily[]
  /** Axes beyond weight, asked of Google: `{ Archivo: { wdth: [['62', '125']] } }`. */
  variableAxis?: Record<string, Record<string, [string, string][]>>
}

const rangeOf = (w: number | string): [number, number] => {
  const [from, to = from] = String(w).trim().split(/\s+/).map(Number)
  return [from!, to!]
}

/** Every weight two settings of one family ask for: the sorted union of static weights, or one range over all when either is a range. */
export function unionWeights(a: (number | string)[], b: (number | string)[]): (number | string)[] {
  const all = [...a, ...b]
  if (all.some((w) => /\s/.test(String(w).trim()))) {
    const ranges = all.map(rangeOf)
    return [`${Math.min(...ranges.map((r) => r[0]))} ${Math.max(...ranges.map((r) => r[1]))}`]
  }
  return [...new Set(all.map(Number))].sort((x, y) => x - y)
}

const union = <T>(a: T[], b: T[]): T[] => [...new Set([...a, ...b])]

// What @nuxt/fonts asks for when a family names no styles (fontless's own default). A family
// that names none in every design keeps naming none, so it is fetched exactly as before.
const DEFAULT_STYLES: ('normal' | 'italic')[] = ['normal', 'italic']

function unionStyles(a: FontFamily, b: FontFamily): Pick<FontFamily, 'styles'> {
  if (!a.styles && !b.styles) return {}
  return { styles: union(a.styles ?? DEFAULT_STYLES, b.styles ?? DEFAULT_STYLES) }
}

/** One family's axes from several designs: each axis from the smallest to the largest value any of them asks for. */
function unionAxes(a: Record<string, [string, string][]>, b: Record<string, [string, string][]>): Record<string, [string, string][]> {
  const out: Record<string, [string, string][]> = { ...a }
  for (const [axis, ranges] of Object.entries(b)) {
    const all = [...(out[axis] ?? []), ...ranges].flat().map(Number)
    out[axis] = [[String(Math.min(...all)), String(Math.max(...all))]]
  }
  return out
}

/**
 * Every design's typefaces in one @nuxt/fonts setting. A family in several designs gets every
 * weight, style and axis any of them asks for (@nuxt/fonts has one setting per family name).
 * None is global and none is preloaded.
 */
export function mergeFonts(all: DesignFonts[]) {
  const byName = new Map<string, FontFamily>()
  const axes: Record<string, Record<string, [string, string][]>> = {}
  for (const d of all) {
    for (const f of d.families) {
      const had = byName.get(f.name)
      byName.set(f.name, had
        ? { ...had, weights: unionWeights(had.weights, f.weights), ...unionStyles(had, f) }
        : { ...f })
    }
    for (const [family, a] of Object.entries(d.variableAxis ?? {})) axes[family] = unionAxes(axes[family] ?? {}, a)
  }
  return {
    families: [...byName.values()].map((f) => ({ ...f, global: false })),
    ...(Object.keys(axes).length ? { google: { experimental: { variableAxis: axes } } } : {}),
    defaults: { preload: false },
  }
}

/** A design's families as its own build declares them: global, so their faces are in every page as before. */
export function ownFonts(d: DesignFonts) {
  return {
    families: d.families.map((f) => ({ ...f, global: true })),
    ...(d.variableAxis ? { google: { experimental: { variableAxis: d.variableAxis } } } : {}),
  }
}
