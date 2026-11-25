// A site's own main colour: one colour the owner chooses, and the palette that comes of it.
//
// A look's colour presets are the designer's palettes: each sets the same few CSS variables
// (looks.ts). An owner who wants their own colour gives one, the *main colour*, and starts from
// one of those presets. The rest is worked out here:
//
//   1. The main colour keeps the owner's hue and saturation. Its lightness is the owner's too,
//      unless a colour the look puts together with it (the text on a button, the page under a
//      link) would stop being readable: then it is the nearest lightness that keeps them readable.
//   2. A colour that *follows* the main colour turns its hue by as much as the main colour
//      turned, and keeps its own lightness. Which colours follow is read from the look's own
//      presets (`learnPalette`): a tinted background follows the brand in most looks, a second
//      accent does not.
//   3. Every other colour stays as the preset has it.
//
// So the light and dark of a look stay the designer's, and the colour is the owner's.
//
// The same colour and the same preset always give the same palette: sites store the colour,
// not the palette. A change of these rules changes the colours of live sites, so the unit spec
// (test/unit/template-palette.spec.ts) holds the palettes of every preset for a set of colours.
//
// This file has no imports: looks.ts, the website and the unit specs all load it.

export type Vars = Record<`--${string}`, string>

/** What a look says about an own colour (`own` in looks.ts). Everything may be left out. */
export interface OwnColours {
  /** The variable that is the main colour. Left out: `--brand`, else `--accent`. */
  main?: `--${string}`
  /** The variables that follow the main colour. Left out: read from the look's presets (`learnPalette`). */
  follows?: readonly `--${string}`[]
  /**
   * The preset variables the look puts together with the main colour: written on it, or under
   * text in it. Written by templates/kit/scripts/look-pairs.mjs from the look's own code.
   */
  against?: readonly `--${string}`[]
  /** The same for colours of the look's stylesheet that are in no preset (a white page): `#rrggbb`. */
  fixed?: readonly string[]
  /**
   * More of the same, written by hand: pairs the script cannot see in the code (a text inside a
   * section whose background is set on an element around it), found on the real pages by
   * templates/app/scripts/own-contrast.mjs. Preset variables or `#rrggbb`.
   */
  also?: readonly string[]
  /** The main colour is the whole page: it takes no more saturation than the look's presets have. */
  calm?: boolean
}

/** A look's rules for an own colour, ready to use. */
export interface PaletteRule {
  main: `--${string}`
  follows: readonly `--${string}`[]
  against: readonly `--${string}`[]
  fixed: readonly string[]
  /** The most chroma the main colour may have (a look whose main colour is the whole page). */
  maxChroma?: number
}

// ── colour maths: sRGB, OKLab and OKLCH (Björn Ottosson), WCAG contrast ────────────────────────

const HEX6 = /^#[0-9a-f]{6}$/i
const HEX3 = /^#[0-9a-f]{3}$/i

/** `#abc` or `#aabbcc` as `#aabbcc`, lower case; null for anything else (a colour with alpha is not a plain colour). */
export function plainHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (HEX6.test(v)) return v
  if (HEX3.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return null
}

type Triple = [number, number, number]

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function hexToRgb(hex: string): Triple {
  return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255]
}

function rgbToLab([r, g, b]: Triple): Triple {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** Linear sRGB of an OKLab colour; outside 0…1 when the colour cannot be shown. */
function labToLinear([L, a, b]: Triple): Triple {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** A colour as lightness (0…1), chroma (0…about 0.4) and hue (radians). */
export function hexToOklch(hex: string): Triple {
  const [L, a, b] = rgbToLab(hexToRgb(hex))
  return [L, Math.hypot(a, b), Math.atan2(b, a)]
}

const shown = (rgb: Triple) => rgb.every((c) => c >= -0.0001 && c <= 1.0001)
const linearOf = (L: number, C: number, h: number) => labToLinear([L, C * Math.cos(h), C * Math.sin(h)])

/**
 * The colour of a lightness, chroma and hue. A colour no screen can show keeps its lightness
 * and hue and loses chroma until it can be shown.
 */
export function oklchToHex([L, C, h]: Triple): string {
  const light = Math.min(1, Math.max(0, L))
  let rgb = linearOf(light, C, h)
  if (!shown(rgb)) {
    let low = 0
    let high = C
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2
      if (shown(linearOf(light, mid, h))) low = mid
      else high = mid
    }
    rgb = linearOf(light, low, h)
  }
  return `#${rgb.map((c) => Math.round(toGamma(Math.min(1, Math.max(0, c))) * 255).toString(16).padStart(2, '0')).join('')}`
}

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/** The contrast of two colours as WCAG counts it: 1 (the same) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** How far apart two colours are to the eye (OKLab × 100): about 2 is just visible. */
export function colourDistance(a: string, b: string): number {
  const x = rgbToLab(hexToRgb(a))
  const y = rgbToLab(hexToRgb(b))
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

// ── the rules ─────────────────────────────────────────────────────────────────────────────────

// Under this chroma a colour is a grey: its hue says nothing.
const GREY = 0.02
// What must stay readable: a pair that had the contrast of body text (4.5) keeps it, a pair
// that had the contrast of large text and of things like buttons (3) keeps that.
const TEXT = 4.5
const LARGE = 3
// A colour follows the main colour when turning explains the presets this much better than staying.
const CLEAR = 0.5

/** The variable a look's presets use for the main colour when the look names none. */
export function mainVariable(vars: Vars): `--${string}` | null {
  return '--brand' in vars ? '--brand' : '--accent' in vars ? '--accent' : null
}

// How a preset's colour would look had it turned with the main colour from one preset to
// another; the lightness and chroma are the other preset's, so only the hue is asked about.
function hueGuess(from: string, to: string, turn: number): { kept: string; turned: string } {
  const [, , h] = hexToOklch(from)
  const [L, C] = hexToOklch(to)
  return { kept: oklchToHex([L, C, h]), turned: oklchToHex([L, C, h + turn]) }
}

/**
 * Whether a colour follows the main colour, as the look's own presets say: from one preset to
 * another, "its hue turned as the main colour's did" comes at least twice as near to the
 * designer's colour as "its hue stayed". A colour that is the same in every preset, a grey, or
 * one the presets are unclear about, stays.
 */
function followsMain(presets: readonly { vars: Vars }[], main: `--${string}`, name: `--${string}`): boolean {
  let kept = 0
  let turned = 0
  for (const a of presets) {
    for (const b of presets) {
      if (a === b) continue
      const ma = plainHex(a.vars[main]), mb = plainHex(b.vars[main]), va = plainHex(a.vars[name]), vb = plainHex(b.vars[name])
      if (!ma || !mb || !va || !vb) continue
      const [, ca, ha] = hexToOklch(ma)
      const [, cb, hb] = hexToOklch(mb)
      if (ca < GREY || cb < GREY) continue
      const guess = hueGuess(va, vb, hb - ha)
      kept += colourDistance(guess.kept, vb)
      turned += colourDistance(guess.turned, vb)
    }
  }
  return turned < kept * CLEAR
}

/**
 * A look's rules for an own colour: what the look says (`own`), and what its presets teach
 * about the rest. Null when the look has no main colour (no `own.main`, no `--brand`, no
 * `--accent`): such a look takes no own colour.
 */
export function learnPalette(presets: readonly { vars: Vars }[], own: OwnColours = {}): PaletteRule | null {
  const first = presets[0]?.vars ?? {}
  const main = own.main ?? mainVariable(first)
  if (!main || !(main in first)) return null
  const names = (Object.keys(first) as `--${string}`[]).filter((name) => name !== main)
  const rule: PaletteRule = {
    main,
    follows: own.follows ? own.follows.filter((name) => names.includes(name)) : names.filter((name) => followsMain(presets, main, name)),
    against: [...new Set([...(own.against ?? []), ...(own.also ?? []).filter((x): x is `--${string}` => x.startsWith('--'))])].filter((name) => names.includes(name)),
    fixed: [...new Set([...(own.fixed ?? []), ...(own.also ?? []).filter((x) => x.startsWith('#'))].map(plainHex).filter((c): c is string => !!c))],
  }
  if (own.calm) {
    rule.maxChroma = Math.max(...presets.map((p) => plainHex(p.vars[main])).filter((c): c is string => !!c).map((c) => hexToOklch(c)[1]))
  }
  return rule
}

type Need = { other: string; need: number }

/** The mark a pair keeps: what it had, as body text (4.5), as large text and buttons (3), or none. */
function need(had: number): number {
  return had >= TEXT ? TEXT : had >= LARGE ? LARGE : 0
}

/** What a colour must stay readable against: each of `others` it was readable against in the preset. */
function needsOf(vars: Vars, now: Vars, name: `--${string}`, others: readonly `--${string}`[]): Need[] {
  const was = plainHex(vars[name])
  const needs: Need[] = []
  if (!was) return needs
  for (const other of others) {
    if (other === name) continue
    const before = plainHex(vars[other])
    const after = plainHex(now[other])
    if (!before || !after) continue
    const mark = need(contrast(was, before))
    if (mark) needs.push({ other: after, need: mark })
  }
  return needs
}

/** How well a colour meets its needs: 1 or more when every pair is readable. */
function readable(color: string, needs: readonly Need[]): number {
  let worst = Infinity
  for (const { other, need } of needs) worst = Math.min(worst, contrast(color, other) / need)
  return worst
}

/**
 * The colour itself when it meets its needs; else the same hue and chroma at the nearest
 * lightness that does, a step at a time in both directions. When no lightness does (a colour
 * between two texts), the one that comes closest.
 */
function nearestReadable(color: string, needs: readonly Need[]): string {
  let best = color
  let score = readable(color, needs)
  if (score >= 1) return color
  const [L, C, h] = hexToOklch(color)
  const STEP = 0.004
  for (let i = 1; i <= 250; i++) {
    for (const light of [L - i * STEP, L + i * STEP]) {
      if (light < 0 || light > 1) continue
      const candidate = oklchToHex([light, C, h])
      const now = readable(candidate, needs)
      if (now > score) {
        best = candidate
        score = now
        if (now >= 1) return best
      }
    }
  }
  return best
}

/**
 * A preset with the owner's main colour: the variables of the preset, with the main colour and
 * the colours that follow it changed. Anything that is not a plain colour (`#rrggbb`), in the
 * preset or as the owner's colour, is left as the preset has it.
 */
export function ownPalette(vars: Vars, rule: PaletteRule, color: string | null | undefined): Vars {
  const given = plainHex(color)
  const was = plainHex(vars[rule.main])
  if (!given || !was) return vars
  // The preset's own main colour is the preset.
  if (given === was) return vars
  let [ownL, ownC, ownH] = hexToOklch(given)
  if (rule.maxChroma !== undefined && ownC > rule.maxChroma) ownC = rule.maxChroma
  const own = oklchToHex([ownL, ownC, ownH])
  ;[ownL, ownC, ownH] = hexToOklch(own)
  const [, wasC, wasH] = hexToOklch(was)
  // A grey has no hue to turn to (or from): then nothing turns, and a grey main colour takes
  // the colour out of what follows it.
  const turn = ownC >= GREY && wasC >= GREY ? ownH - wasH : 0
  const fade = wasC >= GREY ? Math.min(1, ownC / wasC) : 1

  const rest = (Object.keys(vars) as `--${string}`[]).filter((name) => name !== rule.main)
  const out: Vars = { ...vars }
  if (turn !== 0 || fade !== 1) {
    for (const name of rule.follows) {
      const value = plainHex(vars[name])
      if (!value || name === rule.main) continue
      const [L, C, h] = hexToOklch(value)
      // Against everything it was readable against (the main colour aside: that one adapts below).
      out[name] = nearestReadable(oklchToHex([L, C * fade, h + turn]), needsOf(vars, out, name, rest))
    }
  }
  // The main colour, against what the look puts together with it.
  const needs = needsOf(vars, out, rule.main, rule.against)
  for (const other of rule.fixed) {
    const mark = need(contrast(was, other))
    if (mark) needs.push({ other, need: mark })
  }
  out[rule.main] = nearestReadable(own, needs)
  return out
}
