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

// What Nuxt UI itself defines (its :root / .dark) and the admin does not override.
const nuxtUiLight: Record<string, string> = { '--ui-text-inverted': '#fff', '--ui-bg': '#fff', '--ui-bg-elevated': 'var(--ui-color-neutral-100)', '--ui-bg-accented': 'var(--ui-color-neutral-200)' }
const nuxtUiDark: Record<string, string> = { '--ui-text-inverted': 'var(--ui-color-neutral-900)', '--ui-bg': 'var(--ui-color-neutral-900)' }
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
  const light = declared('html[data-cms-admin]')
  return { ...palette, ...(dark ? nuxtUiDark : nuxtUiLight), ...light, ...(dark ? declared('html[data-cms-admin].dark') : {}) }
}
/** The tokens with a built-in accent drawn (data-cms-accent='…'), as the stylesheet's cascade gives them. */
function presetTokens(preset: string, dark: boolean) {
  const vars = tokens(dark)
  if (preset === 'mono') return vars
  Object.assign(vars, declared(`html[data-cms-admin][data-cms-accent='${preset}']`))
  if (dark) Object.assign(vars, declared(`html[data-cms-admin].dark[data-cms-accent]:not([data-cms-accent='mono'], [data-cms-accent='brand'])`))
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
    // never a translucent ring
    expect(css.match(/outline[^;{}]*var\(--cms-accent-ring\)[^;]*/g)?.every((d) => !d.includes('%') && !d.includes('/'))).toBe(true)
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
  })
})
