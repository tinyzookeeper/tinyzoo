import type { LocalizedText } from './i18n'

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
 * slice E the emails and the PNG versions of the logos).
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

/** The accent in one colour scheme: its shades, the solid colour of a main button, and the text on it. @internal */
export interface CmsAccentScheme {
  ramp: CmsColorRamp
  /** `--ui-primary`: main buttons, the active menu item, focus rings, links. A hex. */
  primary: string
  /** The text on `primary` (`--ui-text-inverted` on solid buttons). A hex. */
  onPrimary: string
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
    /** A built-in accent: the admin stylesheet draws it (`data-cms-accent`). */
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

/** tinyzoo's charcoal and cream (docs/brand/brand-guide.md): the `mono` accent. */
const CHARCOAL = '#2E3035'
const CREAM = '#F9F5EF'
const INK = '#131313'

const MONO_RAMP: CmsColorRamp = {
  50: '#FAFAFA', 100: '#F5F5F5', 200: '#E5E5E5', 300: '#D4D4D4', 400: '#A3A3A3', 500: '#737373',
  600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0A0A0A',
}

/**
 * Resolves `cms.admin` into the theme. Pure: no I/O, the same input gives the same output,
 * so the server can memoise it and the website's design-system page can run it in the browser.
 *
 * CONTRACT STUB (0.7): every accent resolves to `mono` until slice C lands the colour maths.
 *
 * @internal
 */
export function resolveAdminTheme(input: CmsAdminThemeInput = {}): CmsAdminTheme {
  const mono = {
    light: { ramp: MONO_RAMP, primary: CHARCOAL, onPrimary: '#FFFFFF' },
    dark: { ramp: MONO_RAMP, primary: CREAM, onPrimary: INK },
  }
  const logo = input.logo ?? {}
  const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const full = clean(logo.full)
  const mark = clean(logo.mark)
  const fullDark = clean(logo.fullDark)
  const markDark = clean(logo.markDark)
  return {
    version: 1,
    name: input.name ?? 'tinyzoo',
    accent: { kind: 'preset', preset: 'mono', ...mono },
    logo: {
      full,
      mark,
      fullDark: fullDark ?? full,
      markDark: markDark ?? mark,
      fullDarkPlate: !fullDark && !!full,
      markDarkPlate: !markDark && !!mark,
    },
    signature: input.signature !== false,
    notes: [],
  }
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
