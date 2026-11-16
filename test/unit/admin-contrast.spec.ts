import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The admin's colour tokens (cms-admin.css) against the surfaces they are read on:
// text is AA (4.5:1) in both themes — on white, on cream (the sign-in, the current page
// in the sidebar, hints) and on the raised grey. "Dimmed" text (placeholders, "Optional",
// counts) is text someone reads, so it is held to the same bar.

const css = readFileSync(join(import.meta.dirname, '../../packages/cms/app/assets/css/cms-admin.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The custom properties declared by rules whose selector is exactly `selector`, later rules winning. */
function declared(selector: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of css.matchAll(/(?<=^|\})\s*([^{}@]+?)\s*\{([^{}]*)\}/g)) {
    if (m[1]!.trim() !== selector) continue
    for (const d of m[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) out[d[1]!] = d[2]!.trim()
  }
  return out
}

// What Nuxt UI itself defines (its :root / .dark) and the admin does not override.
const nuxtUiLight: Record<string, string> = { '--ui-text-inverted': '#fff', '--ui-bg': '#fff', '--ui-bg-elevated': 'var(--ui-color-neutral-100)' }
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
