import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adminAccentCss, CMS_ACCENT_PRESETS, resolveAdminTheme, type CmsAccentScheme } from '../../packages/cms/src/theme'

// The admin's colour tokens (cms-admin.css) against the surfaces they are read on:
// text is AA (4.5:1) in both themes — on white, on cream (the sign-in, the current page
// in the sidebar, hints) and on the raised grey. "Dimmed" text (placeholders, "Optional",
// counts) is text someone reads, so it is held to the same bar.

const css = readFileSync(join(import.meta.dirname, '../../packages/cms/app/assets/css/cms-admin.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The custom properties declared by rules whose selector is exactly `selector`, later rules winning. */
function declared(selector: string, source = css): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of source.matchAll(/(?<=^|\})\s*([^{}@]+?)\s*\{([^{}]*)\}/g)) {
    if (m[1]!.trim() !== selector) continue
    for (const d of m[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) out[d[1]!] = d[2]!.trim()
  }
  return out
}

/** The light block: also matched under .dark, so a site's `:root.dark` cannot outrank it (cms-admin.css, top). */
const LIGHT = 'html[data-cms-admin], html[data-cms-admin].dark'
const DARK = 'html[data-cms-admin].dark'
// Every role Nuxt UI defines on :root / .dark (@nuxt/ui dist/runtime/index.css). The admin declares
// each one itself: one left to Nuxt UI is one the site's own stylesheet can set for the admin.
const NUXT_UI_COLOUR_ROLES = [
  '--ui-text-dimmed', '--ui-text-muted', '--ui-text-toned', '--ui-text', '--ui-text-highlighted', '--ui-text-inverted',
  '--ui-bg', '--ui-bg-muted', '--ui-bg-elevated', '--ui-bg-accented', '--ui-bg-inverted',
  '--ui-border', '--ui-border-muted', '--ui-border-accented', '--ui-border-inverted',
]
const NUXT_UI_SIZES = ['--ui-radius', '--ui-header-height', '--ui-container']
// Tailwind's palette (what Nuxt UI's colour shades are made of).
const palette: Record<string, string> = {
  '--ui-color-success-400': 'oklch(79.2% 0.209 151.711)', '--ui-color-success-700': 'oklch(52.7% 0.154 150.069)', '--ui-color-success-800': 'oklch(44.8% 0.119 151.328)',
  '--ui-color-warning-400': 'oklch(85.2% 0.199 91.936)', '--ui-color-warning-700': 'oklch(55.4% 0.135 66.442)', '--ui-color-warning-800': 'oklch(47.6% 0.114 61.907)',
  '--ui-color-info-400': 'oklch(70.7% 0.165 254.624)', '--ui-color-info-700': 'oklch(48.8% 0.243 264.376)',
  '--ui-color-secondary-400': 'oklch(70.7% 0.165 254.624)', '--ui-color-secondary-700': 'oklch(48.8% 0.243 264.376)',
  '--ui-color-error-400': 'oklch(70.4% 0.191 22.216)', '--ui-color-error-700': 'oklch(50.5% 0.213 27.518)',
  // Nuxt UI sets the status roles to these shades unless the admin picks another one.
  '--ui-success': 'var(--ui-color-success-400)', '--ui-warning': 'var(--ui-color-warning-400)', '--ui-info': 'var(--ui-color-info-400)', '--ui-secondary': 'var(--ui-color-secondary-400)',
}

type RGB = [number, number, number]
function tokens(dark: boolean) {
  const light = { ...declared(LIGHT), ...declared('html[data-cms-admin]') }
  return { ...palette, ...light, ...(dark ? declared(DARK) : {}) }
}
/** The tokens with a built-in accent drawn (data-cms-accent='…'), as the stylesheet's cascade gives them, with the <style> the admin writes for a colour preset (its moments). */
function presetTokens(preset: string, dark: boolean) {
  const vars = tokens(dark)
  if (preset === 'mono') return vars
  const sel = `html[data-cms-admin][data-cms-accent='${preset}']`
  const style = adminAccentCss(resolveAdminTheme({ accent: preset }))
  Object.assign(vars, declared(sel), declared(sel, style))
  if (dark) Object.assign(vars, declared(`html[data-cms-admin].dark[data-cms-accent]:not([data-cms-accent='mono'], [data-cms-accent='brand'])`), declared(`html[data-cms-admin].dark[data-cms-accent='${preset}']`), declared(`${sel}.dark`, style))
  return vars
}
/** The tokens with a brand colour drawn: the <style> the admin writes (adminAccentCss) over the stylesheet. */
function brandTokens(accent: string, dark: boolean) {
  const style = adminAccentCss(resolveAdminTheme({ accent }))
  const sel = `html[data-cms-admin][data-cms-accent='brand']`
  return { ...tokens(dark), ...declared(sel, style), ...(dark ? declared(`${sel}.dark`, style) : {}) }
}
function resolve(name: string, vars: Record<string, string>, depth = 0): RGB {
  const raw = vars[name]
  if (raw === undefined) throw new Error(`token ${name} is not declared`)
  return parse(raw, vars, depth)
}
function parse(value: string, vars: Record<string, string>, depth = 0): RGB {
  if (depth > 10) throw new Error('token loop')
  const v = value.trim()
  const ref = /^var\((--[\w-]+)\)$/.exec(v)
  if (ref) return resolve(ref[1]!, vars, depth + 1)
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((c) => c + c).join('') : hex[1]!
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
  }
  const ok = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(v)
  if (ok) return oklch(Number(ok[1]) / 100, Number(ok[2]), Number(ok[3]))
  throw new Error(`cannot read colour "${value}"`)
}
function oklch(L: number, C: number, h: number): RGB {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return lin.map((x) => { const c = Math.min(1, Math.max(0, x)); return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) }) as RGB
}
const channel = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
export const contrast = (a: RGB, b: RGB) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const over = (fg: RGB, alpha: number, bg: RGB): RGB => fg.map((c, i) => c * alpha + bg[i]! * (1 - alpha)) as RGB

// The site's stylesheet loads in the admin too. A site with `:root, :root.dark { --ui-bg: #FFF8F3 }` turned
// the admin's page that cream while --ui-bg was left to Nuxt UI, and the cream welcome card vanished on it.
describe('the host site cannot re-theme the admin', () => {
  it('the light block declares every role and size Nuxt UI has', () => {
    const light = declared(LIGHT)
    for (const role of [...NUXT_UI_COLOUR_ROLES, ...NUXT_UI_SIZES]) expect(light, role).toHaveProperty(role)
  })
  it('the dark block declares every colour role Nuxt UI has', () => {
    const dark = declared(DARK)
    for (const role of NUXT_UI_COLOUR_ROLES) expect(dark, role).toHaveProperty(role)
  })
  it('the page behind the admin is its own, on <html> and <body>', () => {
    expect(css).toMatch(/html\[data-cms-admin\]\s*\{\s*background-color:\s*var\(--cms-page-bg\);?\s*\}/)
    expect(declared(LIGHT)['--ui-bg']).toBe('var(--cms-page-bg)')
  })
})

for (const dark of [false, true]) {
  describe(`admin colour tokens — ${dark ? 'dark' : 'light'}`, () => {
    const vars = tokens(dark)
    const at = (name: string) => resolve(name, vars)
    // Where text sits: the page, cards, a preview's backdrop, the moments (cream / charcoal),
    // the hover/raised grey. (Dark's raised grey is lighter than the page; the current page
    // in the sidebar is charcoal = --cms-moment-bg.)
    const surfaces = ['--ui-bg', '--cms-page-bg', '--cms-surface', '--cms-sunken', '--cms-moment-bg', '--cms-nav-active', '--ui-bg-elevated']
    const textRoles = ['--ui-text-dimmed', '--ui-text-muted', '--ui-text-toned', '--ui-text', '--ui-text-highlighted']

    for (const role of textRoles) {
      it(`${role} is AA on every surface`, () => {
        for (const surface of surfaces) {
          const ratio = contrast(at(role), at(surface))
          expect(ratio, `${role} on ${surface}`).toBeGreaterThanOrEqual(4.5)
        }
      })
    }

    it('the quiet text inside a moment is AA on it', () => {
      expect(contrast(at('--cms-moment-text'), at('--cms-moment-bg'))).toBeGreaterThanOrEqual(4.5)
    })

    it('"dimmed" stays the quietest text role (a hierarchy, not an accident)', () => {
      const surface = at('--ui-bg')
      const order = textRoles.map((r) => contrast(at(r), surface))
      expect(order).toEqual([...order].sort((a, b) => a - b))
    })

    for (const status of ['--ui-error', '--ui-success', '--ui-warning', '--ui-info']) {
      it(`${status} reads as text, on its own soft tint and under a solid button`, () => {
        const colour = at(status)
        for (const surface of ['--ui-bg', '--cms-surface', '--cms-sunken']) {
          expect(contrast(colour, at(surface)), `${status} on ${surface}`).toBeGreaterThanOrEqual(4.5)
          // "bg-<status>/10": the tint as the alert and badges paint it.
          expect(contrast(colour, over(colour, 0.1, at(surface))), `${status} on its tint over ${surface}`).toBeGreaterThanOrEqual(4.5)
        }
        // A solid button: the text colour of the theme on the status colour.
        expect(contrast(at('--ui-text-inverted'), colour), `inverted text on ${status}`).toBeGreaterThanOrEqual(4.5)
      })
    }

    it('the primary button: inverted text on the primary colour', () => {
      expect(contrast(at('--ui-text-inverted'), at('--ui-primary'))).toBeGreaterThanOrEqual(4.5)
    })
  })
}

// The built-in accents: src/theme.ts carries the hexes cms-admin.css draws for them (the emails use
// them), so the two must agree. Drawn here from the stylesheet itself, rounded to 8 bits.
describe('the built-in accents in src/theme.ts are what cms-admin.css draws', () => {
  const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const
  const near = (a: RGB, hex: string) => {
    const b = parse(hex, {})
    return a.every((c, i) => Math.abs(Math.round(Math.min(255, Math.max(0, c))) - b[i]!) <= 1)
  }
  for (const preset of CMS_ACCENT_PRESETS) {
    for (const dark of [false, true]) {
      it(`${preset}, ${dark ? 'dark' : 'light'}`, () => {
        const vars = presetTokens(preset, dark)
        const theme = resolveAdminTheme({ accent: preset }).accent
        const scheme: CmsAccentScheme = dark ? theme.dark : theme.light
        for (const s of shades) expect(near(resolve(`--ui-color-primary-${s}`, vars), scheme.ramp[s]), `${preset} ${s}: ${scheme.ramp[s]}`).toBe(true)
        expect(near(resolve('--ui-primary', vars), scheme.primary), `--ui-primary ${scheme.primary}`).toBe(true)
        expect(near(resolve('--ui-primary', vars), scheme.text)).toBe(true)
        expect(near(resolve('--ui-text-inverted', vars), scheme.onPrimary), `--ui-text-inverted ${scheme.onPrimary}`).toBe(true)
        expect(near(resolve('--cms-accent-fill-hover', vars), scheme.primaryHover), `--cms-accent-fill-hover ${scheme.primaryHover}`).toBe(true)
      })
    }
  }
})

// A colour preset tints its moments (adminAccentCss): the accent as text (the current page in the sidebar) and
// every text role still read on them, light and dark.
describe('the colour presets on their own moments', () => {
  for (const preset of CMS_ACCENT_PRESETS.filter((p) => p !== 'mono')) {
    for (const dark of [false, true]) {
      it(`${preset}, ${dark ? 'dark' : 'light'}`, () => {
        const vars = presetTokens(preset, dark)
        const at = (name: string) => resolve(name, vars)
        expect(vars['--cms-moment-bg'], 'the moment is the preset\'s own').toMatch(/^#[0-9A-F]{6}$/)
        for (const surface of ['--cms-moment-bg', '--cms-nav-active', '--cms-auth-bg']) {
          // Light: 4.5:1. Dark: no worse than on charcoal, where it sat before (indigo's 400 is 4.24:1 there, a known gap).
          const floor = dark ? Math.min(4.5, contrast(at('--ui-primary'), parse('#2E3035', {}))) : 4.5
          expect(contrast(at('--ui-primary'), at(surface)), `accent text on ${surface}`).toBeGreaterThanOrEqual(floor)
          for (const role of ['--ui-text-dimmed', '--ui-text-muted', '--ui-text', '--ui-text-highlighted']) expect(contrast(at(role), at(surface)), `${role} on ${surface}`).toBeGreaterThanOrEqual(4.5)
        }
        expect(contrast(at('--cms-moment-text'), at('--cms-moment-bg')), 'quiet text in a moment').toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

// Where a focus ring can sit: every surface of the admin, the stronger cream and the pressed grey included.
const RING_SURFACES = ['--ui-bg', '--cms-page-bg', '--cms-surface', '--cms-sunken', '--cms-moment-bg', '--cms-moment-strong', '--cms-nav-active', '--cms-auth-bg', '--ui-bg-elevated', '--ui-bg-accented']

describe('the built-in accents: buttons under the pointer and focus rings', () => {
  for (const preset of CMS_ACCENT_PRESETS) {
    for (const dark of [false, true]) {
      it(`${preset}, ${dark ? 'dark' : 'light'}`, () => {
        const vars = presetTokens(preset, dark)
        const at = (name: string) => resolve(name, vars)
        // A solid button: its text at rest and on the hover fill (Nuxt UI's fill at 75 % took white under 4.5:1).
        expect(contrast(at('--ui-text-inverted'), at('--ui-primary')), 'at rest').toBeGreaterThanOrEqual(4.5)
        expect(contrast(at('--ui-text-inverted'), at('--cms-accent-fill-hover')), 'under the pointer').toBeGreaterThanOrEqual(4.5)
        // The ring: full strength, 3:1 on everything it can sit on.
        for (const surface of RING_SURFACES) expect(contrast(at('--cms-accent-ring'), at(surface)), `ring on ${surface}`).toBeGreaterThanOrEqual(3)
      })
    }
  }

  it('dark mode: the colour presets carry ink on their buttons, not white (6:1 or more)', () => {
    const rule = declared(`html[data-cms-admin].dark[data-cms-accent]:not([data-cms-accent='mono'], [data-cms-accent='brand'])`)
    expect(rule['--ui-text-inverted']).toBeUndefined()
    for (const preset of CMS_ACCENT_PRESETS.filter((p) => p !== 'mono')) {
      const vars = presetTokens(preset, true)
      expect(resolve('--ui-text-inverted', vars)).toEqual(parse('#131313', {}))
      expect(contrast(resolve('--ui-text-inverted', vars), resolve('--ui-primary', vars)), preset).toBeGreaterThanOrEqual(5.9)
    }
  })
})

// A brand colour (cms.admin.accent: '#…'): the variables the admin writes, read against the
// stylesheet's real surfaces. The guard in src/theme.ts has its own list of surfaces; this catches
// a surface that changes here without the guard hearing of it. admin-accent.spec.ts covers many more colours.
describe('a brand colour on the admin\'s real surfaces', () => {
  const brands = ['#B4532A', '#FFD500', '#3B82F6', '#A8E6CF', '#FFFFFF', '#000000', '#808080', '#FF0000', '#00FF00', '#0000FF', '#FCE4EC', '#7A2E0E', '#6D28D9', '#0E7490']
  for (const dark of [false, true]) {
    for (const accent of brands) {
      it(`${accent}, ${dark ? 'dark' : 'light'}`, () => {
        const vars = brandTokens(accent, dark)
        const at = (name: string) => resolve(name, vars)
        // The accent as text (links, the active menu item, soft and ghost buttons) on every surface.
        for (const surface of ['--ui-bg', '--cms-page-bg', '--cms-surface', '--cms-sunken', '--cms-moment-bg', '--cms-nav-active', '--ui-bg-elevated', '--cms-auth-bg']) {
          expect(contrast(at('--ui-primary'), at(surface)), `--ui-primary on ${surface}`).toBeGreaterThanOrEqual(4.5)
        }
        expect(contrast(at('--ui-primary'), over(at('--ui-primary'), 0.1, at('--ui-bg'))), 'on its own tint').toBeGreaterThanOrEqual(4.5)
        // A checked box, a selected day: the theme's inverted text on the accent.
        expect(contrast(at('--ui-text-inverted'), at('--ui-primary')), '--ui-text-inverted on --ui-primary').toBeGreaterThanOrEqual(4.5)
        // A solid button: its own fill and text (cms-admin.css points them at these for [data-cms-accent='brand']).
        expect(contrast(at('--cms-accent-on-fill'), at('--cms-accent-fill')), 'button text').toBeGreaterThanOrEqual(4.5)
        // Focus rings and selected borders against everything they can sit on.
        for (const surface of RING_SURFACES) expect(contrast(at('--cms-accent-ring'), at(surface)), `ring on ${surface}`).toBeGreaterThanOrEqual(3)
        expect(at('--cms-accent-ring'), 'the ring is the text shade, not the fill').toEqual(at('--ui-primary'))
        // A solid button under the pointer: its own fill, its text still readable.
        expect(contrast(at('--cms-accent-on-fill'), at('--cms-accent-fill-hover')), 'button text under the pointer').toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('the brand\'s moments (its tint, its charcoal): every text role, the quiet text and the initials read on them', () => {
    const textRoles = ['--ui-text-dimmed', '--ui-text-muted', '--ui-text-toned', '--ui-text', '--ui-text-highlighted']
    for (const accent of [...brands, '#2563EB', '#15803D', '#6B7280', '#DB2777']) {
      for (const dark of [false, true]) {
        const vars = brandTokens(accent, dark)
        const at = (name: string) => resolve(name, vars)
        // The brand's <style> really sets them: not cream or charcoal.
        expect(vars['--cms-moment-bg'], `${accent} moment`).toMatch(/^#[0-9A-F]{6}$/)
        for (const surface of ['--cms-moment-bg', '--cms-nav-active', '--cms-auth-bg']) {
          for (const role of textRoles) expect(contrast(at(role), at(surface)), `${accent} ${dark ? 'dark' : 'light'}: ${role} on ${surface}`).toBeGreaterThanOrEqual(4.5)
        }
        expect(contrast(at('--cms-moment-text'), at('--cms-moment-bg')), `${accent}: quiet text in a moment`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(at('--ui-text-highlighted'), at('--cms-moment-strong')), `${accent}: initials on the stronger tint`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('the reviews\' colours: #B4532A, #777777, #FFD500 and the mid tones keep 4.5:1 under the pointer and 3:1 rings', () => {
    for (const accent of ['#B4532A', '#777777', '#FFD500', '#6366F1', '#3B82F6', '#10B981']) {
      for (const dark of [false, true]) {
        const vars = brandTokens(accent, dark)
        const at = (name: string) => resolve(name, vars)
        expect(contrast(at('--cms-accent-on-fill'), at('--cms-accent-fill-hover')), `${accent} hover`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(at('--cms-accent-ring'), at('--cms-page-bg')), `${accent} ring`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('the stylesheet points solid buttons at the brand fill, and leaves the built-in accents to themselves', () => {
    expect(declared(`html[data-cms-admin][data-cms-accent='brand'] [data-slot='base'][class~='bg-primary']`)).toEqual({
      '--ui-primary': 'var(--cms-accent-fill)',
      '--ui-text-inverted': 'var(--cms-accent-on-fill)',
    })
  })
})

// The accent's soft tints (cms-admin.css, "Soft tints"): accent text on its own tint, as Nuxt UI paints it
// on soft and subtle buttons (10 %, 15 % under the pointer), the search's matched letters (15 %) and the
// calendar's hovered day (20 %). Nuxt UI's numbers put the built-in blue, violet and emerald (and indigo in
// dark mode) at 3.9-4.2:1; those presets draw the tints lighter. The surfaces are the guard's: white in light
// mode, the page and cards in dark mode.
describe('accent text on the accent\'s own tints', () => {
  const TINTS = ['--cms-accent-tint', '--cms-accent-tint-hover', '--cms-accent-tint-strong'] as const
  const NUXT_UI = [10, 15, 20]
  const percent = (vars: Record<string, string>, name: string) => {
    const m = /^([\d.]+)%$/.exec(vars[name] ?? '')
    if (!m) throw new Error(`${name} is not a percentage: ${vars[name]}`)
    return Number(m[1])
  }
  const tintSurfaces = (dark: boolean) => (dark ? ['--cms-page-bg', '--cms-surface'] : ['--ui-bg', '--cms-surface'])
  const brands = ['#B4532A', '#FFD500', '#3B82F6', '#6366F1', '#10B981', '#8B5CF6', '#A8E6CF', '#000000', '#808080', '#FF0000', '#0E7490', '#6D28D9']
  const cases = [
    ...CMS_ACCENT_PRESETS.flatMap((p) => [false, true].map((dark) => ({ name: p, dark, vars: presetTokens(p, dark) }))),
    ...brands.flatMap((b) => [false, true].map((dark) => ({ name: b, dark, vars: brandTokens(b, dark) }))),
  ]

  for (const { name, dark, vars } of cases) {
    it(`${name}, ${dark ? 'dark' : 'light'}: 4.5:1 on every tint, never stronger than Nuxt UI's, the hover still shows`, () => {
      const text = resolve('--ui-primary', vars)
      const [rest, hover, strong] = TINTS.map((t) => percent(vars, t))
      for (const [i, tint] of [rest!, hover!, strong!].entries()) {
        expect(tint, `${TINTS[i]} ${tint}%`).toBeLessThanOrEqual(NUXT_UI[i]!)
        for (const surface of tintSurfaces(dark)) {
          const ratio = contrast(text, over(text, tint / 100, resolve(surface, vars)))
          expect(ratio, `${name}: text on ${TINTS[i]} (${tint}%) over ${surface}`).toBeGreaterThanOrEqual(4.5)
        }
      }
      expect(hover! - rest!, 'the hover is 3 points or more above the rest').toBeGreaterThanOrEqual(3)
      expect(strong!, 'the calendar\'s hover is no lighter than a button\'s').toBeGreaterThanOrEqual(hover!)
    })
  }

  it('the presets that fell short draw them lighter; mono, indigo (light), emerald (dark) and a brand keep Nuxt UI\'s', () => {
    const drawn = (vars: Record<string, string>) => TINTS.map((t) => percent(vars, t))
    // Measured with Nuxt UI's 20 %: blue 3.90, emerald 4.02, violet 4.24 (light); indigo 3.89, blue 4.44, violet 4.20 (dark).
    expect(drawn(presetTokens('blue', false))).toEqual([6.5, 9.5, 9.5])
    expect(drawn(presetTokens('emerald', false))).toEqual([8.5, 11.5, 11.5])
    expect(drawn(presetTokens('violet', false))).toEqual([10, 15, 16])
    expect(drawn(presetTokens('indigo', true))).toEqual([7.5, 10.5, 10.5])
    expect(drawn(presetTokens('blue', true))).toEqual([10, 15, 18.5])
    expect(drawn(presetTokens('violet', true))).toEqual([10, 15, 15.5])
    for (const vars of [presetTokens('mono', false), presetTokens('mono', true), presetTokens('indigo', false), presetTokens('emerald', true), brandTokens('#3B82F6', false), brandTokens('#3B82F6', true)]) {
      expect(drawn(vars)).toEqual(NUXT_UI)
    }
    // Nuxt UI's 20 % really falls short for them (else the lighter tints would be for nothing).
    for (const [preset, dark] of [['blue', false], ['emerald', false], ['violet', false], ['indigo', true]] as const) {
      const vars = presetTokens(preset, dark)
      const text = resolve('--ui-primary', vars)
      expect(contrast(text, over(text, 0.2, resolve(dark ? '--cms-page-bg' : '--ui-bg', vars))), preset).toBeLessThan(4.5)
    }
    // A brand colour's <style> leaves the tints to the stylesheet: the guard checks its text on 20 %.
    expect(adminAccentCss(resolveAdminTheme({ accent: '#3B82F6' }))).not.toContain('--cms-accent-tint')
  })
})

// The rules that replace Nuxt UI's hover fill and its 25 % focus outline. They match Nuxt UI's own class
// names, so a Nuxt UI upgrade that renames them would quietly bring the old states back: the last test
// reads Nuxt UI's theme and fails first.
describe('accent states in the stylesheet', () => {
  /** The declarations of the first rule whose selector list contains `selector`. */
  const body = (selector: string) => {
    const i = css.indexOf(selector)
    if (i < 0) throw new Error(`no rule for ${selector}`)
    const open = css.indexOf('{', i)
    return css.slice(open + 1, css.indexOf('}', open)).replace(/\s+/g, ' ').trim()
  }

  it('focus rings: full strength in --cms-accent-ring, 2 px, off the control (fields and menu links hug theirs)', () => {
    expect(body(`html[data-cms-admin] [class~='focus-visible:outline-3']:focus-visible`)).toBe('outline: 2px solid var(--cms-accent-ring); outline-offset: 2px;')
    expect(body(`html[data-cms-admin] [class~='has-focus-visible:outline-3']:has(:focus-visible)`)).toBe('outline: 2px solid var(--cms-accent-ring); outline-offset: 0;')
    expect(body(`[class~='focus-visible:before:outline-3']:focus-visible::before`)).toBe('outline: 2px solid var(--cms-accent-ring); outline-offset: 0;')
    expect(body(`[class*='has-focus-visible:ring-']:has(:focus-visible)`)).toBe('outline-width: 1px;')
    expect(body('.cms-peek__resize:focus-visible::after')).toBe('background: var(--cms-accent-ring);')
    // the browser's own ring (plain links) in the accent: its colour only, so an element without a ring stays without
    expect(body('html[data-cms-admin] :focus-visible {')).toBe('outline-color: var(--cms-accent-ring);')
    // never a translucent ring
    expect(css.match(/outline[^;{}]*var\(--cms-accent-ring\)[^;]*/g)?.every((d) => !d.includes('%') && !d.includes('/'))).toBe(true)
  })

  it('keyboard focus that showed no ring: menu items, the title and summary, a rich-text field, the address title', () => {
    // Menu items: the ring on their highlight, 2 px inside it; a marked option (select menu, search) only after a key.
    expect(body(`html[data-cms-admin][data-cms-keys] [class~='before:inset-px']:is([role='menuitem'], [role='menuitemcheckbox'], [role='menuitemradio'], [role='option']):focus-visible::before`)).toBe('outline: 2px solid var(--cms-accent-ring); outline-offset: -2px;')
    expect(body(`html[data-cms-admin][data-cms-keys] [class~='before:inset-px'][data-highlighted]:not([data-disabled])::before`)).toBe('outline: 2px solid var(--cms-accent-ring); outline-offset: -2px;')
    // No item ring under the pointer: every rule that rings a highlighted or focused item asks for data-cms-keys
    // (after Escape, Chromium keeps :focus-visible on the item the mouse focuses next).
    for (const m of css.matchAll(/([^{}]*(?:\[data-highlighted\]|\[role='menuitem'\])[^{}]*)\{([^{}]*)\}/g)) {
      if (m[2]!.includes('outline')) {
        for (const selector of m[1]!.split(/,\s*(?=html)/)) expect(selector, 'a menu item is ringed only after a key').toContain('[data-cms-keys]')
      }
    }
    expect(body(`html[data-cms-admin] :is(.cms-title-input, .cms-lead-input):focus-visible`)).toBe('outline: 2px solid var(--cms-accent-ring); outline-offset: 0.375rem; border-radius: 0.25rem;')
    expect(body(`html[data-cms-admin] .cms-title-input--address:focus-visible`)).toBe('box-shadow: inset 0 0 0 1px var(--cms-accent-ring); outline-width: 1px; outline-offset: 0; border-radius: var(--ui-radius);')
    expect(body(`html[data-cms-admin] .cms-rte:has(.ProseMirror:focus-visible)`)).toBe('border-color: var(--cms-accent-ring); outline: 1px solid var(--cms-accent-ring); outline-offset: 0;')
    expect(body(`html[data-cms-admin] .cms-write-body .cms-rte:has(.ProseMirror:focus-visible)`)).toBe('outline-width: 2px; outline-offset: 0.375rem; border-radius: 0.25rem;')
    // A control in a dialog keeps room for its ring when the focus scrolls it to the edge of the screen.
    expect(body(`html[data-cms-admin] [role='dialog'] :is(button, a[href], input, textarea, select, [tabindex])`)).toBe('scroll-margin-block: 0.5rem;')
    // The pale 20 % halo the address title had is gone.
    expect(css).not.toMatch(/cms-title-input--address:focus\s*\{/)
  })

  it('the ring reads at 3:1 on a menu item\'s highlight (bg-elevated/50 over the menu), every accent', () => {
    const cases = [
      ...CMS_ACCENT_PRESETS.flatMap((p) => [false, true].map((dark) => ({ name: p, dark, vars: presetTokens(p, dark) }))),
      ...['#B4532A', '#FFD500', '#3B82F6', '#A8E6CF', '#FFFFFF', '#000000'].flatMap((b) => [false, true].map((dark) => ({ name: b, dark, vars: brandTokens(b, dark) }))),
    ]
    for (const { name, dark, vars } of cases) {
      const at = (n: string) => resolve(n, vars)
      const highlight = over(at('--ui-bg-elevated'), 0.5, at('--ui-bg'))
      expect(contrast(at('--cms-accent-ring'), highlight), `${name} ${dark ? 'dark' : 'light'}: ring on the highlight`).toBeGreaterThanOrEqual(3)
      // Nuxt UI's highlight alone barely shows (this is why the ring is there).
      expect(contrast(highlight, at('--ui-bg'))).toBeLessThan(1.2)
    }
  })

  it('the soft tints: Nuxt UI\'s tint classes drawn with the accent\'s own --cms-accent-tint*, the hover not when disabled', () => {
    const mix = (v: string) => `background-color: color-mix(in oklab, var(--ui-primary) var(${v}), transparent);`
    expect(body(`html[data-cms-admin] [class~='bg-primary/10'][class~='hover:bg-primary/15']`)).toBe(mix('--cms-accent-tint'))
    expect(body(`[class~='hover:bg-primary/15']:not(:disabled, [aria-disabled='true']):hover`)).toBe(mix('--cms-accent-tint-hover'))
    expect(body(`[class~='active:bg-primary/15']:not(:disabled, [aria-disabled='true']):active`)).toBe(mix('--cms-accent-tint-hover'))
    expect(body(`[class~='[&>mark]:bg-primary/15'] > mark`)).toBe(mix('--cms-accent-tint-hover'))
    expect(body(`[class~='hover:not-data-selected:bg-primary/20']:not([data-selected]):hover`)).toBe(mix('--cms-accent-tint-strong'))
    // A selected day keeps Nuxt UI's own fill when the keyboard is on it.
    expect(body(`[class~='data-highlighted:bg-primary/20'][data-highlighted]:not([data-selected])`)).toBe(mix('--cms-accent-tint-strong'))
    // The defaults are Nuxt UI's.
    expect(declared('html[data-cms-admin]')).toMatchObject({ '--cms-accent-tint': '10%', '--cms-accent-tint-hover': '15%', '--cms-accent-tint-strong': '20%' })
  })

  it('a solid button under the pointer and pressed: the accent\'s hover fill, not when disabled', () => {
    expect(body(`[class~='hover:bg-primary/75']:not(:disabled, [aria-disabled='true']):hover`)).toBe('background-color: var(--cms-accent-fill-hover);')
    expect(body(`[class~='active:bg-primary/75']:not(:disabled, [aria-disabled='true']):active`)).toBe('background-color: var(--cms-accent-fill-hover);')
  })

  it('Nuxt UI still draws its solid buttons and focus outlines with the classes those rules match', () => {
    const ui = realpathSync(join(import.meta.dirname, '../../packages/cms/node_modules/@nuxt/ui'))
    const dir = join(ui, 'dist/shared')
    const theme = readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => readFileSync(join(dir, f), 'utf8')).find((t) => t.includes('const button = '))
    expect(theme, 'Nuxt UI\'s theme file').toBeDefined()
    expect(theme).toContain('hover:bg-${color}/75 active:bg-${color}/75')
    expect(theme).toContain('outline-${color}/25 focus-visible:outline-3')
    expect(theme).toContain('focus-visible:before:outline-3')
    expect(theme).toContain('has-focus-visible:outline-3')
    // the soft tints
    expect(theme).toContain('bg-${color}/10 hover:bg-${color}/15 active:bg-${color}/15')
    expect(theme).toContain('[&>mark]:bg-primary/15')
    expect(theme).toContain('data-highlighted:bg-${color}/20 hover:not-data-selected:bg-${color}/20')
    // menu items: a pill drawn by ::before, highlighted as the keyboard or the pointer reaches the item
    expect(theme).toContain('outline-none before:absolute before:z-[-1] before:inset-px before:rounded-md')
    expect(theme).toContain('data-highlighted:not-data-disabled:before:bg-elevated/50')
  })
})
