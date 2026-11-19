import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { accentTextContrast, adminAccentCss, brandAccent, brandMoments, CMS_ACCENT_PRESETS, contrastRatio, gamutMap, MOMENT_VARS, oklchToRgb, relativeLuminance, resolveAdminTheme, rgbToOklch, type CmsMomentScheme } from '../../packages/cms/src/theme'
import { animalFills, CMS_ANIMAL_CLASSES, CMS_ANIMAL_FACES, recolourAnimal } from '../../packages/cms/src/themeAnimals'

// The whole look follows a brand colour (src/theme.ts, brandMoments; src/themeAnimals.ts): the
// moments become a tint of the brand (light) and charcoal toward it (dark), the animals one muted
// shade of it. Mono and the four colour presets keep cream and the colourful family.
// test/unit/admin-contrast.spec.ts checks the same tokens against the stylesheet's text roles.

const WHITE = '#FFFFFF'
const INK = '#131313'
const CREAM = '#F9F5EF'
const CHARCOAL = '#2E3035'
const HOVER_GREY = '#F5F5F5'
const hexOf = (rgb: number[]) => `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
const grey = (L: number) => hexOf(oklchToRgb([L, 0, 0]))
/** The stylesheet's text roles (cms-admin.css): light dimmed 54 %, muted 50 %, toned neutral-600, text 30 %, ink; dark as written. */
const LIGHT_TEXT = { dimmed: grey(0.54), muted: grey(0.5), toned: grey(0.439), text: grey(0.3), highlighted: INK }
const DARK_TEXT = { dimmed: '#A09D97', muted: '#B2AEA7', toned: '#C2BEB7', text: '#D8D4CD', highlighted: CREAM }
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
const lchOf = (hex: string) => rgbToOklch(rgbOf(hex))
const hueGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

/** A deterministic spread of brand colours: an OKLCH grid (12 hues × 9 lightnesses × 5 chromas), the sRGB cube in 4 steps, named cases. */
const COLOURS = (() => {
  const out = new Set<string>()
  for (let h = 0; h < 360; h += 30) {
    for (const L of [0.08, 0.2, 0.32, 0.45, 0.55, 0.65, 0.75, 0.86, 0.95]) {
      for (const C of [0, 0.03, 0.08, 0.15, 0.3]) out.add(hexOf(oklchToRgb(gamutMap([L, C, h]))))
    }
  }
  for (const r of [0, 85, 170, 255]) for (const g of [0, 85, 170, 255]) for (const b of [0, 85, 170, 255]) out.add(hexOf([r / 255, g / 255, b / 255]))
  for (const hex of ['#B4532A', '#2563EB', '#15803D', '#FFD500', '#6B7280', '#F9F5EF', '#2E3035', '#FCE4EC', '#A8E6CF', '#DB2777']) out.add(hex)
  return [...out]
})()
const RESULTS = COLOURS.map((hex) => ({ hex, accent: brandAccent(hex), moments: brandMoments(hex) }))

describe('brand moments: every text on them reads (light and dark, over the grid)', () => {
  it(`light: the stylesheet's text roles, the moment's quiet text and the accent's text shade at 4.5:1 (${COLOURS.length} colours)`, () => {
    for (const { hex, accent, moments } of RESULTS) {
      const m = moments.light
      for (const surface of [m.bg, m.navActive, m.authBg]) {
        for (const [role, colour] of Object.entries(LIGHT_TEXT)) expect(contrastRatio(colour, surface), `${hex}: ${role} on ${surface}`).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(accent.light.text, surface), `${hex}: accent ${accent.light.text} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrastRatio(m.text, m.bg), `${hex}: quiet text ${m.text} on ${m.bg}`).toBeGreaterThanOrEqual(4.5)
      // The initials and the confirm dialog's icon: ink on the stronger tint.
      expect(contrastRatio(INK, m.strong), `${hex}: ink on ${m.strong}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('dark: the text roles, the quiet text, cream on the stronger tint and the dark accent at 4.5:1', () => {
    for (const { hex, accent, moments } of RESULTS) {
      const m = moments.dark
      for (const surface of [m.bg, m.navActive, m.authBg]) {
        for (const [role, colour] of Object.entries(DARK_TEXT)) expect(contrastRatio(colour, surface), `${hex}: ${role} on ${surface}`).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(accent.dark.text, surface), `${hex}: accent ${accent.dark.text} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrastRatio(m.text, m.bg), `${hex}: quiet text ${m.text} on ${m.bg}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(CREAM, m.strong), `${hex}: cream on ${m.strong}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('light moments are never darker than the hover grey, dark ones never lighter than charcoal', () => {
    for (const { hex, moments } of RESULTS) {
      expect(relativeLuminance(moments.light.bg), `${hex}: ${moments.light.bg}`).toBeGreaterThanOrEqual(relativeLuminance(HOVER_GREY))
      expect(relativeLuminance(moments.dark.bg), `${hex}: ${moments.dark.bg}`).toBeLessThanOrEqual(relativeLuminance(CHARCOAL))
    }
  })

  it('the current page, the sign-in background and the moments are one surface per scheme', () => {
    for (const { moments } of RESULTS) {
      for (const m of [moments.light, moments.dark]) expect([m.navActive, m.authBg]).toEqual([m.bg, m.bg])
    }
  })

  it('the moments do not move the accent: the guard\'s worst surface is never the brand\'s own moment', () => {
    for (const { hex, accent, moments } of RESULTS) {
      expect(accentTextContrast(accent.light.text, 'light', moments.light.bg).ratio, hex).toBe(accentTextContrast(accent.light.text, 'light').ratio)
      expect(accentTextContrast(accent.dark.text, 'dark', moments.dark.bg).ratio, hex).toBe(accentTextContrast(accent.dark.text, 'dark').ratio)
    }
  })
})

describe('the focus ring and the accent\'s tints over the grid (cms-admin.css draws them for a brand as for mono)', () => {
  /** `fg` at `alpha` over `bg`, blended as the guard blends it (not rounded to 8 bits; see the roadmap's R2 open points). */
  const over = (fg: string, alpha: number, bg: string) => rgbOf(fg).map((c, i) => c * alpha + rgbOf(bg)[i]! * (1 - alpha)) as [number, number, number]
  // A menu item's highlight: Nuxt UI's bg-elevated/50 over the menu (light: neutral-100 on white; dark: #26282C on the page).
  const HIGHLIGHT = { light: hexOf(over(HOVER_GREY, 0.5, WHITE)), dark: hexOf(over('#26282C', 0.5, '#18191C')) }

  it(`the ring (the accent as text) reads at 3:1 on a menu item's highlight and on the brand's own moments (${COLOURS.length} colours)`, () => {
    for (const { hex, accent, moments } of RESULTS) {
      for (const scheme of ['light', 'dark'] as const) {
        const ring = accent[scheme].text
        for (const surface of [HIGHLIGHT[scheme], moments[scheme].bg, moments[scheme].strong]) {
          expect(contrastRatio(ring, surface), `${hex} ${scheme}: ring ${ring} on ${surface}`).toBeGreaterThanOrEqual(3)
        }
      }
    }
  })

  it('a brand keeps Nuxt UI\'s tints (its <style> sets none), and its text reads on the strongest, 20 %', () => {
    for (const { hex, accent } of RESULTS) {
      expect(adminAccentCss(resolveAdminTheme({ accent: hex }))).not.toContain('--cms-accent-tint')
      expect(contrastRatio(accent.light.text, over(accent.light.text, 0.2, WHITE)), `${hex} light`).toBeGreaterThanOrEqual(4.5)
      for (const page of ['#18191C', '#1E1F23']) expect(contrastRatio(accent.dark.text, over(accent.dark.text, 0.2, page)), `${hex} dark on ${page}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('brand moments: calm paper with a hint of the brand', () => {
  it('keep the brand\'s hue, at little chroma (light at most cream\'s 0.009, dark at most 0.008)', () => {
    for (const { hex, moments } of RESULTS) {
      const [, Cb, hb] = lchOf(hex)
      const [, Cl, hl] = lchOf(moments.light.bg)
      const [, Cd, hd] = lchOf(moments.dark.bg)
      // Rounding to a hex adds a little chroma of its own.
      expect(Cl, `${hex}: light ${moments.light.bg}`).toBeLessThanOrEqual(0.0095 + 0.002)
      expect(Cd, `${hex}: dark ${moments.dark.bg}`).toBeLessThanOrEqual(0.0085 + 0.002)
      if (Cb >= 0.12) {
        expect(hueGap(hl, hb), `${hex}: light hue`).toBeLessThan(25)
        expect(hueGap(hd, hb), `${hex}: dark hue`).toBeLessThan(35)
      }
    }
  })

  it('lightness close to cream\'s and charcoal\'s', () => {
    for (const { hex, moments } of RESULTS) {
      expect(Math.abs(lchOf(moments.light.bg)[0] - lchOf(CREAM)[0]), hex).toBeLessThan(0.012)
      expect(Math.abs(lchOf(moments.dark.bg)[0] - lchOf(CHARCOAL)[0]), hex).toBeLessThan(0.012)
    }
  })

  it('a near-grey brand gives near-grey moments (chroma under 0.006, cream is 0.009) and a grey animal', () => {
    for (const hex of ['#6B7280', '#777777', '#000000', '#FFFFFF', '#808080', '#71717A', '#57534E']) {
      const m = brandMoments(hex)
      for (const v of [m.light.bg, m.light.strong, m.light.line, m.dark.bg, m.dark.strong, m.dark.line, m.light.animalFace]) expect(lchOf(v)[1], `${hex}: ${v}`).toBeLessThan(0.006)
      expect(lchOf(m.light.animalBody)[1], `${hex}: animal`).toBeLessThan(0.02)
    }
  })

  it('the animals: one muted shade of the brand (the family\'s lightness, chroma at most 0.09), lighter in dark mode, a near-white face', () => {
    for (const { hex, moments } of RESULTS) {
      const [, Cb, hb] = lchOf(hex)
      const [Ll, Cl, hl] = lchOf(moments.light.animalBody)
      const [Ld] = lchOf(moments.dark.animalBody)
      expect(Ll, `${hex}: ${moments.light.animalBody}`).toBeGreaterThan(0.64)
      expect(Ll, `${hex}: ${moments.light.animalBody}`).toBeLessThan(0.75)
      expect(Ld, `${hex}: dark is lighter`).toBeGreaterThan(Ll)
      expect(Cl, hex).toBeLessThanOrEqual(0.092)
      if (Cb >= 0.08) expect(hueGap(hl, hb), `${hex}: animal hue`).toBeLessThan(10)
      for (const face of [moments.light.animalFace, moments.dark.animalFace]) {
        expect(lchOf(face)[0], `${hex}: face ${face}`).toBeGreaterThan(0.97)
        expect(lchOf(face)[1], `${hex}: face ${face}`).toBeLessThan(0.008)
      }
    }
  })

  it('is pure and stable: the same colour gives the same moments, and resolving twice changes nothing', () => {
    for (const hex of COLOURS.slice(0, 80)) {
      expect(brandMoments(hex)).toEqual(brandMoments(hex))
      const a = resolveAdminTheme({ accent: hex })
      expect(resolveAdminTheme({ accent: hex })).toEqual(a)
      if (a.accent.kind !== 'brand') throw new Error(hex)
      // The guard's own results resolve to themselves, moments and all.
      const again = brandAccent(a.accent.light.text)
      expect(again.light.text, hex).toBe(a.accent.light.text)
    }
  })

  it('is quick: under 1 ms a colour', () => {
    const t = performance.now()
    for (const hex of COLOURS) brandMoments(hex)
    expect((performance.now() - t) / COLOURS.length).toBeLessThan(1)
  })
})

describe('the moments in the admin', () => {
  const sel = `html[data-cms-admin][data-cms-accent='brand']`
  const block = (css: string, dark: boolean) => {
    const start = css.indexOf(dark ? `${sel}.dark{` : `${sel}{`)
    return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  }

  it('a brand colour writes every moment token and the animal colours, light and dark, in its <style>', () => {
    const theme = resolveAdminTheme({ accent: '#B4532A' })
    if (theme.accent.kind !== 'brand') throw new Error('brand')
    const css = adminAccentCss(theme)
    for (const dark of [false, true]) {
      const scheme: CmsMomentScheme = dark ? theme.accent.moments.dark : theme.accent.moments.light
      const vars = block(css, dark)
      for (const [name, key] of MOMENT_VARS) expect(vars, `${dark ? 'dark' : 'light'} ${name}`).toContain(`${name}:${scheme[key]}`)
    }
    expect(MOMENT_VARS.map(([n]) => n)).toEqual(['--cms-moment-bg', '--cms-moment-strong', '--cms-moment-line', '--cms-moment-text', '--cms-nav-active', '--cms-auth-bg', '--cms-animal-body', '--cms-animal-face'])
  })

  it('writes only hexes: a tampered theme loses the bad value, not the rest', () => {
    const theme = resolveAdminTheme({ accent: '#2563EB' }) as any
    theme.accent.moments.light.bg = 'red;}body{display:none'
    const css = adminAccentCss(theme)
    expect(css).not.toContain('display:none')
    expect(css).toContain('--cms-moment-strong:')
  })

  it('mono, the four colour presets and the unbranded admin: no moment overrides, cream and the colourful family stay', () => {
    for (const accent of [undefined, ...CMS_ACCENT_PRESETS, 'nonsense']) {
      const theme = resolveAdminTheme(accent === undefined ? {} : { accent })
      expect(theme.accent.kind, String(accent)).toBe('preset')
      expect('moments' in theme.accent, String(accent)).toBe(false)
      expect(adminAccentCss(theme), String(accent)).toBe('')
    }
  })

  it('the stylesheet colours an inline animal from the two variables, and still draws cream and charcoal by default', () => {
    const css = readFileSync(join(import.meta.dirname, '../../packages/cms/app/assets/css/cms-admin.css'), 'utf8')
    expect(css).toContain(`html[data-cms-admin] .${CMS_ANIMAL_CLASSES.body} { fill: var(--cms-animal-body); }`)
    expect(css).toContain(`html[data-cms-admin] .${CMS_ANIMAL_CLASSES.face} { fill: var(--cms-animal-face); }`)
    expect(css).toMatch(/--cms-moment-bg: var\(--tz-cream\);/)
    expect(css).toMatch(/--cms-moment-bg: var\(--tz-charcoal\);/)
  })
})

describe('cms.admin.animals', () => {
  it('defaults to true; false hides them for any accent', () => {
    expect(resolveAdminTheme().animals).toBe(true)
    expect(resolveAdminTheme({ animals: true }).animals).toBe(true)
    for (const accent of ['mono', 'emerald', '#B4532A']) expect(resolveAdminTheme({ accent, animals: false }).animals, accent).toBe(false)
  })

  it('the layer\'s app.config has it on by default', () => {
    const config = readFileSync(join(import.meta.dirname, '../../packages/cms/app/app.config.ts'), 'utf8')
    expect(config).toMatch(/animals: true as boolean,/)
  })

  it('every animal in the admin goes through CmsAnimal behind the switch (no stray <img> of an animal)', () => {
    const app = join(import.meta.dirname, '../../packages/cms/app')
    const files = ['components/CmsEmptyState.vue', 'components/CmsMoment.vue', 'components/CmsPublishReview.vue', 'layouts/cms-auth.vue', 'pages/admin/index.vue', 'pages/admin/setup.vue']
    for (const f of files) {
      const src = readFileSync(join(app, f), 'utf8')
      expect(src, f).toContain('useCmsAnimals()')
      expect(src, f).toMatch(/<CmsAnimal\b/)
      expect(src, f).not.toMatch(/<img[^>]*(animal|owl|bird|character|cmsCharacters)/i)
    }
  })
})

describe('the animals in a brand\'s colours', () => {
  const dir = join(import.meta.dirname, '../../packages/cms/app/assets/brand/characters')
  const files = ['muted', 'bright'].flatMap((set) => readdirSync(join(dir, set)).filter((f) => f.endsWith('.svg')).map((f) => ({ set, name: f, svg: readFileSync(join(dir, set, f), 'utf8') })))

  it('the family is all there: 26 muted, 6 bright', () => {
    expect(files.filter((f) => f.set === 'muted')).toHaveLength(26)
    expect(files.filter((f) => f.set === 'bright')).toHaveLength(6)
  })

  it('every animal is drawn in exactly two colours: one body and one near-white face (a new animal that breaks this fails here)', () => {
    for (const { set, name, svg } of files) {
      const colours = [...new Set(animalFills(svg))]
      expect(colours, `${set}/${name}`).toHaveLength(2)
      expect(colours.filter((c) => (CMS_ANIMAL_FACES as readonly string[]).includes(c)), `${set}/${name}: one face`).toHaveLength(1)
      // Nothing else gives colour: no strokes, styles, gradients or other fills.
      expect(svg, `${set}/${name}`).not.toMatch(/stroke|style|gradient|fill-opacity|opacity|fill="(?!#)/i)
      expect(recolourAnimal(svg), `${set}/${name}`).not.toBeNull()
    }
  })

  it('replaces the two fills and nothing else', () => {
    for (const { set, name, svg } of files) {
      const drawing = recolourAnimal(svg)!
      const face = [...new Set(animalFills(svg))].find((c) => c !== drawing.body)!
      expect(svg, `${set}/${name}: the viewBox`).toContain(`viewBox="${drawing.viewBox}"`)
      expect(drawing.inner, `${set}/${name}`).not.toMatch(/#[0-9a-f]{6}/i)
      const fills = animalFills(svg).length
      expect(drawing.inner.split(`class="${CMS_ANIMAL_CLASSES.body}"`).length - 1 + drawing.inner.split(`class="${CMS_ANIMAL_CLASSES.face}"`).length - 1, `${set}/${name}`).toBe(fills)
      // Put the colours back: the original drawing, byte for byte.
      const back = drawing.inner.replaceAll(`class="${CMS_ANIMAL_CLASSES.body}"`, `fill="${drawing.body}"`).replaceAll(`class="${CMS_ANIMAL_CLASSES.face}"`, `fill="${face}"`)
      const original = /<svg\b[^>]*>([\s\S]*)<\/svg>/.exec(svg)![1]!
      expect(back.toUpperCase(), `${set}/${name}`).toBe(original.toUpperCase())
    }
  })

  it('refuses a drawing that does not follow the rule', () => {
    const ok = '<svg viewBox="0 0 10 10"><path fill="#C87D88" d="M0 0h10v10z"/><circle fill="#F9F7F4" cx="5" cy="5" r="2"/></svg>'
    expect(recolourAnimal(ok)).not.toBeNull()
    expect(recolourAnimal(ok.replace('</svg>', '<circle fill="#123456" cx="1" cy="1" r="1"/></svg>')), 'a third colour').toBeNull()
    expect(recolourAnimal(ok.replace('#F9F7F4', '#EEEEEE')), 'no face').toBeNull()
    expect(recolourAnimal(ok.replace('</svg>', '<script>alert(1)</script></svg>')), 'a script').toBeNull()
    expect(recolourAnimal(ok.replace('<path ', '<path onload="x()" ')), 'an event').toBeNull()
    expect(recolourAnimal(ok.replace('<path ', '<path style="fill:red" ')), 'a style').toBeNull()
    expect(recolourAnimal(ok.replace(' viewBox="0 0 10 10"', '')), 'no viewBox').toBeNull()
    expect(recolourAnimal('<div>no</div>')).toBeNull()
  })
})

describe('the logo tile in dark mode follows the brand', () => {
  it('is the light moment paper in both schemes for a brand colour, and not written for presets', () => {
    const theme = resolveAdminTheme({ accent: '#2563EB' })
    const paper = theme.accent.kind === 'brand' ? theme.accent.moments!.light.bg : ''
    const css = adminAccentCss(theme)
    expect(css.match(/--cms-logo-plate:(#[0-9A-F]{6})/gi)).toEqual([`--cms-logo-plate:${paper}`, `--cms-logo-plate:${paper}`])
    for (const p of CMS_ACCENT_PRESETS) expect(adminAccentCss(resolveAdminTheme({ accent: p }))).not.toContain('--cms-logo-plate')
  })
})
