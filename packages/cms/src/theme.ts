import type { LocalizedText } from './i18n'
import { resolveAdminLogo } from './themeLogo'

/**
 * The admin's theme: the client's name, brand colour and logos, resolved into one
 * serialisable object.
 *
 * Input: `cms.admin` in the site's `app.config.ts` (`name`, `accent`, `logo`, `signature`).
 * Output: `CmsAdminTheme`, plain JSON. The server resolves it at runtime
 * (`server/utils/cmsAdminTheme.ts`), the admin gets it from `GET /api/cms/_theme`, and the
 * emails read it on the server. Nothing about the theme is baked in at build time.
 *
 * Why runtime and JSON: a hosted tinyzoo could later fill the same input from stored
 * settings (per site) and hand out the same object, with no change to the config API or
 * to the admin. Only `cmsAdminTheme()` on the server would read somewhere else.
 *
 * 0.7 contract (slice C fills in the colour maths, slice L the logos in the admin,
 * slice E the emails and the PNG versions of the logos). The colour maths (OKLCH ramps, the
 * contrast guard) is below `resolveAdminTheme`; docs/ui-foundation.md explains it.
 */

/** The built-in accents (`cms.admin.accent`). `mono` is tinyzoo's charcoal, the default. @internal */
export const CMS_ACCENT_PRESETS: readonly CmsAccentPreset[] = ['mono', 'indigo', 'blue', 'violet', 'emerald']
export type CmsAccentPreset = 'mono' | 'indigo' | 'blue' | 'violet' | 'emerald'

/** `cms.admin.accent`: a built-in accent, or the client's brand colour as a hex (`#B4532A`, `#b53`). */
export type CmsAccent = CmsAccentPreset | `#${string}`

/**
 * `cms.admin.logo`: the client's logo set. Each value is an address the browser can load:
 * a path under the site's `public/` (`/brand/logo.svg`) or an absolute `https://` URL.
 * SVG or PNG (WebP and JPEG work too, without transparency for JPEG).
 */
export interface CmsAdminLogo {
  /** The full logo (wordmark): the sign-in page, the open sidebar, the emails. Wide, transparent background. */
  full?: string
  /** The square mark: the folded sidebar, the phone's top bar, the tab icon and the phone's home-screen icon. */
  mark?: string
  /** The full logo for dark mode. Without it, dark mode shows `full` (see `CmsAdminTheme.logo`). */
  fullDark?: string
  /** The mark for dark mode. */
  markDark?: string
}

/** The admin settings the theme is resolved from (the theme-related part of `cms.admin`). @internal */
export interface CmsAdminThemeInput {
  name?: LocalizedText
  accent?: CmsAccent | string
  logo?: CmsAdminLogo
  /** tinyzoo's quiet signature under the sidebar and on the sign-in page. Default `true`. */
  signature?: boolean
}

/** The shades of one colour, 50 (lightest) to 950 (darkest), as CSS colours. @internal */
export type CmsColorRamp = Record<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950', string>

/**
 * The accent in one colour scheme: its shades, the solid colour of a main button, the text on it,
 * and the accent as text. All hexes (`#rrggbb`).
 * @internal
 */
export interface CmsAccentScheme {
  ramp: CmsColorRamp
  /** The solid fill of a main button (and of a solid badge). For a brand colour: the brand itself whenever its text can be read on it. */
  primary: string
  /** The text on `primary`: white or ink (#131313), whichever reads better. */
  onPrimary: string
  /**
   * The fill of a solid button under the pointer or pressed: one step from `primary`, away from
   * its text (darker under white text, lighter under ink), so `onPrimary` still reads at 4.5:1.
   */
  primaryHover: string
  /**
   * The accent where it is drawn on the page rather than filled: links, the active menu item,
   * focus rings, checked boxes and switches, selected borders. The admin's `--ui-primary`.
   * The same as `primary` unless that is too light to read on white (a yellow brand: the
   * buttons stay yellow with ink text, the links are a darker shade of the same yellow).
   */
  text: string
}

/** Something the contrast guard or the logo checks changed or found: shown to the developer in development. @internal */
export interface CmsThemeNote {
  /** `accent`: the colour was adjusted or could not be read; `logo`: a logo is missing, too small or not square. */
  kind: 'accent' | 'logo'
  /** One sentence in English, for the server log and the browser console in development. */
  message: string
}

/**
 * The resolved theme. Plain JSON: the same object goes to the browser, to the emails and,
 * one day, to and from stored settings.
 *
 * @internal The shape may grow; the config that produces it (`cms.admin`) is the public API.
 */
export interface CmsAdminTheme {
  /** Bumped when the shape changes incompatibly (stored or cached themes can tell). */
  version: 1
  name: LocalizedText
  accent:
    /** A built-in accent: the admin stylesheet draws it (`data-cms-accent`). `light`/`dark` hold the hexes it draws, for the emails. */
    | { kind: 'preset'; preset: CmsAccentPreset; light: CmsAccentScheme; dark: CmsAccentScheme }
    /** A brand colour: the admin sets the variables itself (`data-cms-accent="brand"`). `hex` is what the site gave, normalised to `#rrggbb`. */
    | { kind: 'brand'; hex: string; light: CmsAccentScheme; dark: CmsAccentScheme }
  /** Logo addresses, `null` when not given. `fullDark`/`markDark` fall back to the light ones; `dark*Plate` says the light one is shown in dark mode on a light tile. */
  logo: {
    full: string | null
    mark: string | null
    fullDark: string | null
    markDark: string | null
    fullDarkPlate: boolean
    markDarkPlate: boolean
  }
  signature: boolean
  /** What the contrast guard and the logo checks changed or found. Empty in a clean config. Not sent to the browser in production. */
  notes: CmsThemeNote[]
}

/** tinyzoo's charcoal, cream and ink (docs/brand/brand-guide.md). */
const CHARCOAL = '#2E3035'
const CREAM = '#F9F5EF'
const INK = '#131313'
const WHITE = '#FFFFFF'

/**
 * Resolves `cms.admin` into the theme. Pure: no I/O, the same input gives the same output,
 * so the server can memoise it and the website's design-system page can run it in the browser.
 *
 * @internal
 */
export function resolveAdminTheme(input: CmsAdminThemeInput = {}): CmsAdminTheme {
  // The logos and their address checks: src/themeLogo.ts. Logo notes first, then the accent's.
  const { logo, notes: logoNotes } = resolveAdminLogo(input.logo)
  const notes: CmsThemeNote[] = [...logoNotes]
  return {
    version: 1,
    name: input.name ?? 'tinyzoo',
    accent: resolveAccent(input.accent, notes),
    logo,
    signature: input.signature !== false,
    notes,
  }
}

// ── The accent ────────────────────────────────────────────────────────────────────────────
//
// A built-in name gives the shades cms-admin.css draws for it (as hexes, for the emails; the
// admin's stylesheet draws them itself). A hex gives a brand accent: a ramp of shades around
// it, a light scheme and a dark one, each checked by the contrast guard (below).

type Shade = keyof CmsColorRamp
const SHADES: Shade[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
type Lch = [number, number, number]

/** The built-in accents as cms-admin.css draws them (OKLCH, the same numbers). `primary`: the shade of `--ui-primary` in light mode. */
const PRESET_RAMPS: Record<Exclude<CmsAccentPreset, 'mono'>, { primary: Shade; ramp: Lch[] }> = {
  indigo: { primary: '600', ramp: [[96.2, 0.018, 272], [93, 0.034, 272], [87, 0.065, 274], [78.5, 0.115, 274], [67.3, 0.182, 276], [58.5, 0.233, 277], [51.1, 0.262, 277], [45.7, 0.24, 277], [39.8, 0.195, 277], [35.9, 0.144, 278], [25.7, 0.09, 281]] },
  blue: { primary: '600', ramp: [[97, 0.014, 254], [93.2, 0.032, 255], [88.2, 0.059, 254], [80.9, 0.105, 251], [70.7, 0.165, 254], [62.3, 0.214, 259], [54.6, 0.245, 262], [48.8, 0.243, 264], [42.4, 0.199, 265], [37.9, 0.146, 265], [28.2, 0.091, 267]] },
  violet: { primary: '600', ramp: [[96.9, 0.016, 293], [94.3, 0.029, 295], [89.4, 0.057, 293], [81.1, 0.111, 294], [70.2, 0.183, 294], [60.6, 0.25, 293], [54.1, 0.281, 293], [49.1, 0.27, 293], [43.2, 0.232, 293], [38, 0.189, 294], [28.3, 0.141, 291]] },
  emerald: { primary: '700', ramp: [[97.9, 0.021, 166], [95, 0.052, 163], [90.5, 0.093, 164], [84.5, 0.143, 165], [76.5, 0.177, 163], [69.6, 0.17, 162], [59.6, 0.145, 163], [50.8, 0.118, 165], [43.2, 0.095, 166], [37.8, 0.077, 168], [26.2, 0.051, 173]] },
}
/** mono: the admin's greys. Light: the true grey ramp; dark: the ramp warmed toward charcoal and cream. */
const MONO_LIGHT: Lch[] = [[98.5, 0, 0], [96.7, 0, 0], [92.2, 0, 0], [87, 0, 0], [70.8, 0, 0], [55.6, 0, 0], [43.9, 0, 0], [37.1, 0, 0], [26.9, 0, 0], [20.5, 0, 0], [14.5, 0, 0]]
const MONO_DARK = ['#F9F5EF', '#EEEAE4', '#D8D4CD', '#C2BEB7', '#A09D97', '#77756F', '#4A4C52', '#3A3C42', '#2E3035', '#1E1F23', '#18191C']

const rampOf = (hexes: string[]): CmsColorRamp => Object.fromEntries(SHADES.map((s, i) => [s, hexes[i]!])) as CmsColorRamp
const lchRamp = (lch: Lch[]) => rampOf(lch.map(([L, C, h]) => toHex(oklchToRgb([L / 100, C, h]))))

function presetAccent(preset: CmsAccentPreset): Extract<CmsAdminTheme['accent'], { kind: 'preset' }> {
  if (preset === 'mono') {
    return {
      kind: 'preset', preset,
      // Hover: a darker charcoal under white text; cream has no lighter step, so the next darker one.
      light: { ramp: lchRamp(MONO_LIGHT), primary: CHARCOAL, onPrimary: WHITE, primaryHover: MONO_DARK[9]!, text: CHARCOAL },
      dark: { ramp: rampOf(MONO_DARK), primary: CREAM, onPrimary: INK, primaryHover: MONO_DARK[1]!, text: CREAM },
    }
  }
  const def = PRESET_RAMPS[preset]
  const ramp = lchRamp(def.ramp)
  // Light: the 600 shade (emerald: 700) with white text, the next darker shade under the pointer.
  // Dark: the 400 shade with ink text (white was 1.9–3.1:1 there), the 300 shade under the pointer.
  const next = SHADES[SHADES.indexOf(def.primary) + 1]!
  return {
    kind: 'preset', preset,
    light: { ramp, primary: ramp[def.primary], onPrimary: WHITE, primaryHover: ramp[next], text: ramp[def.primary] },
    dark: { ramp, primary: ramp['400'], onPrimary: INK, primaryHover: ramp['300'], text: ramp['400'] },
  }
}

/** `#rgb` / `#rrggbb` in any case, with spaces around: the colour as `#RRGGBB`, or null. @internal */
export function parseHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!m) return null
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!
  return `#${h.toUpperCase()}`
}

function resolveAccent(raw: unknown, notes: CmsThemeNote[]): CmsAdminTheme['accent'] {
  if (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim())) return presetAccent('mono')
  const name = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if ((CMS_ACCENT_PRESETS as readonly string[]).includes(name)) return presetAccent(name as CmsAccentPreset)
  const hex = parseHex(raw)
  if (!hex) {
    notes.push({ kind: 'accent', message: `could not read the accent ${JSON.stringify(typeof raw === 'string' ? raw : String(raw))}: use a built-in name (${CMS_ACCENT_PRESETS.join(', ')}) or a hex colour like #B4532A. The admin uses mono.` })
    return presetAccent('mono')
  }
  const brand = brandAccent(hex)
  if (brand.note) notes.push({ kind: 'accent', message: brand.note })
  return { kind: 'brand', hex, light: brand.light, dark: brand.dark }
}

// ── The contrast guard ──────────────────────────────────────────────────────────────────────
//
// WCAG 2 contrast ratios, checked on the hexes the admin actually draws (after rounding):
//  - text on a solid button (white or ink, whichever is higher): 4.5:1, at rest and under the
//    pointer (the hover fill is a shade of its own, `primaryHover`, not the fill at 75 %);
//  - the accent as text (links, the active menu item, ghost and soft buttons) on every light surface
//    it lands on: white, cream (the moments, the sign-in page, the current page in the sidebar), the
//    hover grey, and its own tint up to 20 % over white (Nuxt UI's soft buttons and their hover, the
//    search's matched letters, the calendar's "today" under the pointer): 4.5:1;
//  - focus rings and the other accent-coloured lines: 3:1 against the page (implied by the text bar;
//    the admin draws its rings in the text shade, never in the fill, at full strength);
//  - a button has to show as a button: its fill differs from white and cream by 1.25:1 at least
//    (not a WCAG number: it only stops a white or near-white brand from drawing invisible buttons).
// Dark mode does the same on its page (#18191C), cards (#1E1F23), the raised charcoal (#2E3035) and
// its own tint over the page and over cards, with a lighter version of the colour (around the 400
// shade). A colour that fails moves to the nearest one that passes by changing its OKLCH lightness
// only, keeping its hue and as much chroma as fits in sRGB.
//
// Not checked, because accent text does not sit there in the admin: the stronger cream
// (--cms-moment-strong), the pressed grey (neutral-200), a tint over cream or charcoal. A site's own
// component that puts accent text on those is not covered.

/** Surfaces the accent is read on, light mode: the page and cards, cream, the hover grey (neutral-100). */
const LIGHT_SURFACES = { white: WHITE, cream: CREAM, hoverGrey: '#F5F5F5' } as const
/** Dark mode: the page, cards, the raised charcoal (the current page, the moments). */
const DARK_SURFACES = { page: '#18191C', cards: '#1E1F23', charcoal: CHARCOAL } as const
/** How the notes name each surface. */
const SURFACE_NAMES: Record<CmsAccentSurface, string> = { white: 'white', cream: 'cream', hoverGrey: 'the hover grey', page: 'the page', cards: 'cards', charcoal: 'charcoal', tint: 'its own tint' }
/** The strongest tint of the accent that accent text sits on (Nuxt UI: 10 % soft, 15 % its hover, 20 % the calendar's hover). */
const TINT = 0.2
/** The text bar (WCAG AA, normal text), the bar for lines and rings, and the "a button shows" bar. @internal */
export const CMS_CONTRAST = { text: 4.5, ring: 3, fill: 1.25 } as const

/** A surface the guard checks accent text on. `tint`: the accent's own tint (up to 20 %). @internal */
export type CmsAccentSurface = keyof typeof LIGHT_SURFACES | keyof typeof DARK_SURFACES | 'tint'

/** The worst ratio of `hex` as text on these surfaces and on its own tint over the first `tintOver` of them. */
function worstOn(hex: string, surfaces: Record<string, string>, tintOver: number): { ratio: number; surface: CmsAccentSurface } {
  const entries = Object.entries(surfaces)
  let worst = { ratio: Infinity, surface: 'tint' as CmsAccentSurface }
  for (const [surface, bg] of entries) {
    const r = contrastRatio(hex, bg)
    if (r < worst.ratio) worst = { ratio: r, surface: surface as CmsAccentSurface }
  }
  for (const [, bg] of entries.slice(0, tintOver)) {
    const r = contrastRatio(hex, mix(hex, TINT, bg))
    if (r < worst.ratio) worst = { ratio: r, surface: 'tint' }
  }
  return worst
}
const worstLight = (hex: string) => worstOn(hex, LIGHT_SURFACES, 1)
const worstDark = (hex: string) => worstOn(hex, DARK_SURFACES, 2)

/**
 * How `hex` reads as accent text where the guard checks it: the worst ratio and the surface it is
 * on. The design-system page shows this number, the same one the notes use. @internal
 */
export function accentTextContrast(hex: string, scheme: 'light' | 'dark' = 'light'): { ratio: number; surface: CmsAccentSurface } {
  return scheme === 'dark' ? worstDark(hex) : worstLight(hex)
}

/** The text on a fill: white or ink, whichever reads better. */
function onFill(hex: string): { on: string; ratio: number } {
  const w = contrastRatio(WHITE, hex)
  const k = contrastRatio(INK, hex)
  return w >= k ? { on: WHITE, ratio: w } : { on: INK, ratio: k }
}
const fillShows = (hex: string) => Math.min(contrastRatio(hex, WHITE), contrastRatio(hex, CREAM)) >= CMS_CONTRAST.fill
const fillPasses = (hex: string) => onFill(hex).ratio >= CMS_CONTRAST.text && fillShows(hex)
const textPassesLight = (hex: string) => worstLight(hex).ratio >= CMS_CONTRAST.text
const textPassesDark = (hex: string) => worstDark(hex).ratio >= CMS_CONTRAST.text && onFill(hex).ratio >= CMS_CONTRAST.text

/**
 * The fill of a solid button under the pointer: one step (about one shade, 0.06 OKLCH lightness)
 * away from its text, darker under white and lighter under ink, so the text reads better rather
 * than worse. A fill with no room that way (cream, a pale yellow that would vanish) takes the
 * nearest step the other way that still reads at 4.5:1 and still shows. The same input always
 * gives the same output, so it follows the guard's fill. @internal
 */
export function accentFillHover(fill: string, on: string, shows: (hex: string) => boolean = fillShows): string {
  const [L, C, h] = rgbToOklch(hexToRgb(fill))
  const away = on === WHITE ? -1 : 1
  for (const dir of [away, -away]) {
    for (const d of [0.06, 0.045, 0.03, 0.015]) {
      const l = L + dir * d
      if (l <= 0 || l >= 1) continue
      const candidate = toHex(oklchToRgb(gamutMap([l, C, h])))
      if (candidate !== fill && contrastRatio(on, candidate) >= CMS_CONTRAST.text && shows(candidate)) return candidate
    }
  }
  return fill
}

/**
 * The nearest colour to `hex` (by OKLCH lightness only) that passes. `direction`: -1 darker,
 * +1 lighter, 0 both ways (the closer one wins). `hex` itself when it passes, so a colour the
 * guard produced comes back unchanged.
 */
function nearestPassing(hex: string, passes: (hex: string) => boolean, direction: -1 | 0 | 1): string {
  if (passes(hex)) return hex
  const [L, C, h] = rgbToOklch(hexToRgb(hex))
  const step = 0.002
  for (let d = step; d <= 1 + step; d += step) {
    for (const dir of direction === 0 ? [-1, 1] : [direction]) {
      const l = L + dir * d
      if (l < 0 || l > 1) continue
      const candidate = toHex(oklchToRgb(gamutMap([l, C, h])))
      if (passes(candidate)) return candidate
    }
  }
  return direction === 1 ? WHITE : '#000000'
}

const LIGHTNESS: Record<Shade, number> = { 50: 0.97, 100: 0.935, 200: 0.885, 300: 0.81, 400: 0.71, 500: 0.625, 600: 0.55, 700: 0.49, 800: 0.425, 900: 0.38, 950: 0.28 }
/** How much of the colour's chroma each shade keeps, relative to the 600 (from the built-in ramps). */
const CHROMA: Record<Shade, number> = { 50: 0.07, 100: 0.14, 200: 0.26, 300: 0.45, 400: 0.7, 500: 0.9, 600: 1, 700: 0.93, 800: 0.76, 900: 0.57, 950: 0.37 }

/**
 * The shades 50…950 of a brand colour: the lightness of each shade as in the built-in ramps, the
 * hue kept, the chroma tapering toward both ends. The shade nearest to the colour's own lightness
 * is the colour itself. @internal
 */
export function brandRamp(hex: string): CmsColorRamp {
  const [L, C, h] = rgbToOklch(hexToRgb(hex))
  const anchor = SHADES.reduce((best, s) => (Math.abs(LIGHTNESS[s] - L) < Math.abs(LIGHTNESS[best] - L) ? s : best), '500' as Shade)
  return rampOf(SHADES.map((s) => (s === anchor ? hex : toHex(oklchToRgb(gamutMap([LIGHTNESS[s], C * Math.min(CHROMA[s] / CHROMA[anchor], 1.5), h]))))))
}

const fmt = (r: number) => (Math.floor(r * 10) / 10).toFixed(1)

/** The brand accent: both schemes, each passing the guard, and a note for the developer when the light one changed. @internal */
export function brandAccent(hex: string): { light: CmsAccentScheme; dark: CmsAccentScheme; note: string | null } {
  const ramp = brandRamp(hex)
  const parts: string[] = []

  // Light: the button keeps the brand when its text can be read on it; the text shade is the brand,
  // or the nearest darker shade of it that reads on every light surface.
  const fill = nearestPassing(hex, fillPasses, 0)
  const text = nearestPassing(hex, textPassesLight, -1)
  const fillOn = onFill(fill)
  const onName = (on: string) => (on === WHITE ? 'white' : 'ink')
  if (fill !== hex) {
    const before = onFill(hex)
    parts.push(fillShows(hex)
      ? `buttons would have ${fmt(before.ratio)}:1 with ${onName(before.on)} text; they use ${fill} with ${onName(fillOn.on)} text (${fmt(fillOn.ratio)}:1)`
      : `buttons would not show on the page (${fmt(Math.min(contrastRatio(hex, WHITE), contrastRatio(hex, CREAM)))}:1 against white and cream); they use ${fill} with ${onName(fillOn.on)} text (${fmt(fillOn.ratio)}:1)`)
  }
  if (text !== hex) {
    const before = worstLight(hex)
    parts.push(`links and other accent text would be ${fmt(before.ratio)}:1 on ${SURFACE_NAMES[before.surface]}; they use ${text} (${fmt(worstLight(text).ratio)}:1)`)
    if (fill === hex) parts.push(`buttons keep ${hex} with ${onName(fillOn.on)} text (${fmt(fillOn.ratio)}:1)`)
  }

  // Dark: a lighter version (the 400 shade, or the colour itself when it is lighter still), raised
  // until it reads on the dark surfaces. One colour for the button and the text; the text on the
  // button is ink (on a colour this light, ink always reads better than white).
  const lighter = rgbToOklch(hexToRgb(hex))[0] >= rgbToOklch(hexToRgb(ramp['400']))[0] ? hex : ramp['400']
  const dark = nearestPassing(lighter, textPassesDark, 1)
  const darkOn = onFill(dark).on

  return {
    light: { ramp, primary: fill, onPrimary: fillOn.on, primaryHover: accentFillHover(fill, fillOn.on), text },
    dark: { ramp, primary: dark, onPrimary: darkOn, primaryHover: accentFillHover(dark, darkOn, () => true), text: dark },
    note: parts.length ? `accent ${hex}: ${parts.join('; ')}.` : null,
  }
}

/**
 * The CSS that draws a brand accent in the admin, scoped to html[data-cms-admin][data-cms-accent="brand"]:
 * the shades, `--ui-primary` (the accent as text), the focus ring (`--cms-accent-ring`: the text
 * shade in light mode, the dark colour in dark mode, never the fill), and the fill of solid buttons
 * at rest and under the pointer with its text (`--cms-accent-fill`, `--cms-accent-fill-hover`,
 * `--cms-accent-on-fill`, read by cms-admin.css). Empty for a built-in accent (the stylesheet draws
 * those). Only hexes are written, so it is safe to put in a <style>. @internal
 */
export function adminAccentCss(theme: Pick<CmsAdminTheme, 'accent'>): string {
  const accent = theme.accent
  if (accent.kind !== 'brand') return ''
  const ok = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null)
  const block = (s: CmsAccentScheme) => {
    const vars: string[] = []
    for (const shade of SHADES) { const v = ok(s.ramp?.[shade]); if (v) vars.push(`--ui-color-primary-${shade}:${v}`) }
    const text = ok(s.text) ?? ok(s.primary)
    const fill = ok(s.primary)
    const on = ok(s.onPrimary)
    const hover = ok(s.primaryHover) ?? fill
    if (text) vars.push(`--ui-primary:${text}`, `--cms-accent-ring:${text}`)
    if (fill) vars.push(`--cms-accent-fill:${fill}`)
    if (hover) vars.push(`--cms-accent-fill-hover:${hover}`)
    if (on) vars.push(`--cms-accent-on-fill:${on}`)
    return vars.join(';')
  }
  const sel = `html[data-cms-admin][data-cms-accent='brand']`
  return `${sel}{${block(accent.light)}}${sel}.dark{${block(accent.dark)}}`
}

/** What the admin puts in `data-cms-accent`: the built-in accent's name, or `brand`. @internal */
export const adminAccentName = (theme: Pick<CmsAdminTheme, 'accent'>): string => (theme.accent.kind === 'brand' ? 'brand' : theme.accent.preset)

// ── Colour maths: sRGB, OKLab/OKLCH (Björn Ottosson), WCAG 2 contrast ────────────────────────

type Rgb = [number, number, number]

/** `#RRGGBB` → [r, g, b] in 0…1. */
function hexToRgb(hex: string): Rgb {
  const h = parseHex(hex) ?? '#000000'
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb
}
/** [r, g, b] in 0…1 (clamped) → `#RRGGBB`. */
function toHex(rgb: Rgb): string {
  return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.sign(c) * Math.abs(c) ** (1 / 2.4) - 0.055)

function linearToOklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
function oklabToLinear([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}
/** sRGB (0…1) → OKLCH [L 0…1, C, h in degrees]. Greys get hue 0. @internal */
export function rgbToOklch(rgb: Rgb): Lch {
  const [L, a, b] = linearToOklab(rgb.map(toLinear) as Rgb)
  const C = Math.hypot(a, b)
  const h = C < 1e-6 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  return [L, C < 1e-6 ? 0 : C, h]
}
/** OKLCH → sRGB (0…1), not clamped: out-of-gamut colours have channels outside 0…1. @internal */
export function oklchToRgb([L, C, h]: Lch): Rgb {
  const rad = (h * Math.PI) / 180
  return oklabToLinear([L, C * Math.cos(rad), C * Math.sin(rad)]).map(fromLinear) as Rgb
}
const inGamut = (rgb: Rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4)
/** Brings an OKLCH colour into sRGB by lowering its chroma (lightness and hue kept). @internal */
export function gamutMap([L, C, h]: Lch): Lch {
  if (L <= 0) return [0, 0, h]
  if (L >= 1) return [1, 0, h]
  if (inGamut(oklchToRgb([L, C, h]))) return [L, C, h]
  let lo = 0
  let hi = C
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklchToRgb([L, mid, h]))) lo = mid
    else hi = mid
  }
  return [L, lo, h]
}
/** Mixes `fg` at `alpha` over `bg` (as the browser paints a translucent colour), not rounded. */
function mix(fg: string, alpha: number, bg: string): Rgb {
  const a = hexToRgb(fg)
  const b = hexToRgb(bg)
  return a.map((c, i) => c * alpha + b[i]! * (1 - alpha)) as Rgb
}
/** WCAG 2 relative luminance of a hex (or of sRGB channels in 0…1). @internal */
export function relativeLuminance(colour: string | Rgb): number {
  const [r, g, b] = (typeof colour === 'string' ? hexToRgb(colour) : colour).map(toLinear)
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
/** WCAG 2 contrast ratio of two colours (1…21). @internal */
export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const x = relativeLuminance(a)
  const y = relativeLuminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/**
 * The PNG versions of the logos that tinyzoo makes on the server (`GET /api/cms/_brand/<file>`),
 * for places that cannot use SVG: the emails (Gmail and Outlook do not show SVG), the
 * phone's home-screen icon and the PNG tab icon. Slice E serves them.
 *
 * `full-email.png`: the full logo, 2× for a 160 px wide slot, on transparent.
 * `mark-32.png`, `mark-180.png` (apple-touch-icon, on white), `mark-192.png`, `mark-512.png` (web manifest).
 */
/** @internal */
export const CMS_BRAND_FILES = ['full-email.png', 'mark-32.png', 'mark-180.png', 'mark-192.png', 'mark-512.png'] as const
/** @internal */
export type CmsBrandFile = (typeof CMS_BRAND_FILES)[number]

/** The address of one PNG version of the logo, relative to the site (`/api/cms/_brand/mark-180.png?v=…`). `v` changes when the theme does, so caches can keep it long. @internal */
export function brandFileUrl(file: CmsBrandFile, theme: CmsAdminTheme): string {
  const source = file.startsWith('full') ? theme.logo.full : theme.logo.mark
  return `/api/cms/_brand/${file}?v=${themeHash(source ?? '')}`
}

/** A short, stable hash of a string (FNV-1a), for cache-busting addresses. @internal */
export function themeHash(text: string): string {
  let h = 0x811C9DC5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
  return h.toString(36)
}
