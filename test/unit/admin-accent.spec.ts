import { describe, expect, it } from 'vitest'
import { adminAccentCss, adminAccentName, brandAccent, brandRamp, CMS_ACCENT_PRESETS, contrastRatio, gamutMap, oklchToRgb, parseHex, resolveAdminTheme, rgbToOklch, type CmsAdminTheme } from '../../packages/cms/src/theme'

// `cms.admin.accent` as a hex: the colour maths of src/theme.ts (parsing, OKLCH, the shades)
// and the contrast guard, over a few hundred colours spread over hue, lightness and chroma.
// test/unit/admin-contrast.spec.ts checks the same against the real stylesheet.

const WHITE = '#FFFFFF'
const INK = '#131313'
const CREAM = '#F9F5EF'
const LIGHT = { white: WHITE, cream: CREAM, hoverGrey: '#F5F5F5', sunken: '#FBFAF9' }
const DARK = { page: '#18191C', sunken: '#1B1C1F', cards: '#1E1F23', raised: '#26282C', charcoal: '#2E3035' }

const hexOf = (rgb: number[]) => `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
const lchOf = (hex: string) => rgbToOklch(rgbOf(hex))
/** `hex` at `alpha` over `bg`, as the browser blends it (not rounded). */
const tint = (hex: string, alpha: number, bg: string) => rgbOf(hex).map((c, i) => c * alpha + rgbOf(bg)[i]! * (1 - alpha)) as [number, number, number]
const brand = (accent: string) => {
  const theme = resolveAdminTheme({ accent })
  if (theme.accent.kind !== 'brand') throw new Error(`${accent} did not resolve to a brand accent`)
  return { ...theme.accent, notes: theme.notes }
}

/** A deterministic spread: an OKLCH grid (12 hues × 9 lightnesses × 5 chromas, brought into sRGB) and an sRGB cube. */
function sampleColours(): string[] {
  const out = new Set<string>()
  for (let h = 0; h < 360; h += 30) {
    for (const L of [0.08, 0.2, 0.32, 0.45, 0.55, 0.65, 0.75, 0.86, 0.95]) {
      for (const C of [0, 0.03, 0.08, 0.15, 0.3]) out.add(hexOf(oklchToRgb(gamutMap([L, C, h]))))
    }
  }
  for (const r of [0, 85, 170, 255]) for (const g of [0, 85, 170, 255]) for (const b of [0, 85, 170, 255]) out.add(hexOf([r / 255, g / 255, b / 255]))
  for (const hex of ['#000000', '#FFFFFF', '#808080', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF', '#FFD500', '#A8E6CF', '#FCE4EC', '#B4532A', '#3B82F6', '#2E3035', '#F9F5EF', '#131313', '#777777', '#767676']) out.add(hex)
  return [...out]
}
const COLOURS = sampleColours()

describe('reading the accent', () => {
  it('reads #rgb and #rrggbb in any case, with spaces around', () => {
    expect(parseHex('#b53')).toBe('#BB5533')
    expect(parseHex('  #B4532a ')).toBe('#B4532A')
    expect(parseHex('#FFF')).toBe('#FFFFFF')
    for (const bad of ['#abcd', '#12345', 'b4532a', '#ggg', 'rgb(1, 2, 3)', '#B4532A80', '', 42, null, undefined]) expect(parseHex(bad), String(bad)).toBeNull()
  })

  it('a hex gives a brand accent, normalised', () => {
    const theme = resolveAdminTheme({ accent: ' #b4532a' })
    expect(theme.accent).toMatchObject({ kind: 'brand', hex: '#B4532A' })
  })

  it('a built-in name gives the preset, in any case; nothing gives mono; neither has notes', () => {
    for (const p of CMS_ACCENT_PRESETS) expect(resolveAdminTheme({ accent: p }).accent).toMatchObject({ kind: 'preset', preset: p })
    expect(resolveAdminTheme({ accent: ' Indigo ' }).accent).toMatchObject({ kind: 'preset', preset: 'indigo' })
    for (const empty of [undefined, '', '   ']) {
      const theme = resolveAdminTheme({ accent: empty })
      expect(theme.accent).toMatchObject({ kind: 'preset', preset: 'mono' })
      expect(theme.notes).toEqual([])
    }
  })

  it('anything else falls back to mono with a note saying what it could not read', () => {
    for (const bad of ['red', '#12345', 'rgb(180, 83, 42)', '#B4532A80', 42]) {
      const theme = resolveAdminTheme({ accent: bad as any })
      expect(theme.accent).toMatchObject({ kind: 'preset', preset: 'mono' })
      expect(theme.notes).toHaveLength(1)
      expect(theme.notes[0]).toMatchObject({ kind: 'accent' })
      expect(theme.notes[0]!.message).toContain('could not read')
      expect(theme.notes[0]!.message).toContain(String(bad))
    }
  })
})

describe('the built-in accents', () => {
  it('are hexes, with the accent as text the same colour as the button (as cms-admin.css draws them)', () => {
    for (const p of CMS_ACCENT_PRESETS) {
      const { accent } = resolveAdminTheme({ accent: p })
      for (const scheme of [accent.light, accent.dark]) {
        expect(Object.keys(scheme.ramp)).toEqual(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'])
        for (const v of [...Object.values(scheme.ramp), scheme.primary, scheme.onPrimary, scheme.text]) expect(v).toMatch(/^#[0-9A-F]{6}$/)
        expect(scheme.text).toBe(scheme.primary)
      }
    }
    expect(resolveAdminTheme().accent).toMatchObject({ light: { primary: '#2E3035', onPrimary: WHITE }, dark: { primary: CREAM, onPrimary: INK } })
  })
})

describe('colour maths', () => {
  it('OKLCH round-trips sRGB', () => {
    for (const hex of COLOURS) expect(hexOf(oklchToRgb(lchOf(hex)))).toBe(hex)
  })

  it('known values: white, black, a Tailwind shade', () => {
    expect(lchOf('#FFFFFF')[0]).toBeCloseTo(1, 3)
    expect(lchOf('#000000')).toEqual([0, 0, 0])
    // Tailwind's indigo-600 is oklch(51.1% 0.262 276.966) = #4F39F6.
    const [L, C, h] = lchOf('#4F39F6')
    expect(L).toBeCloseTo(0.511, 2)
    expect(C).toBeCloseTo(0.262, 2)
    expect(h).toBeCloseTo(277, 0)
  })

  it('gamut mapping lowers chroma only, until the colour fits sRGB', () => {
    const [L, C, h] = gamutMap([0.7, 0.4, 145])
    expect([L, h]).toEqual([0.7, 145])
    expect(C).toBeLessThan(0.4)
    expect(oklchToRgb([L, C, h]).every((c) => c >= -1e-3 && c <= 1 + 1e-3)).toBe(true)
  })

  it('WCAG contrast: the known pairs', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1)
  })
})

describe('the shades of a brand colour', () => {
  for (const hex of ['#B4532A', '#FFD500', '#3B82F6', '#A8E6CF', '#808080', '#000000', '#FFFFFF']) {
    it(`${hex}: eleven shades, light to dark, the colour itself at its own step, the hue kept`, () => {
      const ramp = brandRamp(hex)
      const values = Object.values(ramp)
      expect(values).toHaveLength(11)
      expect(values).toContain(hex)
      const L = values.map((v) => lchOf(v)[0])
      expect(L).toEqual([...L].sort((a, b) => b - a))
      const [, C0, h0] = lchOf(hex)
      if (C0 > 0.05) {
        for (const v of values) {
          const [, C, h] = lchOf(v)
          if (C > 0.03) expect(Math.abs(((h - h0 + 540) % 360) - 180), `${v} keeps the hue of ${hex}`).toBeLessThan(6)
        }
      }
    })
  }
})

describe(`the contrast guard over ${COLOURS.length} colours`, () => {
  const results = COLOURS.map((hex) => brand(hex))

  it('light: the text on a button is white or ink and reads at 4.5:1; the button shows on the page', () => {
    for (const r of results) {
      const { primary, onPrimary } = r.light
      expect([WHITE, INK], r.hex).toContain(onPrimary)
      expect(contrastRatio(onPrimary, primary), `${r.hex}: ${onPrimary} on ${primary}`).toBeGreaterThanOrEqual(4.5)
      // ink or white, whichever reads better
      const other = onPrimary === WHITE ? INK : WHITE
      expect(contrastRatio(onPrimary, primary)).toBeGreaterThanOrEqual(contrastRatio(other, primary))
      expect(Math.min(contrastRatio(primary, WHITE), contrastRatio(primary, CREAM)), `${r.hex}: ${primary} shows on white and cream`).toBeGreaterThanOrEqual(1.25)
    }
  })

  it('light: links and accent text read at 4.5:1 on white, cream, the hover grey and their own tint; rings at 3:1', () => {
    for (const r of results) {
      const { text } = r.light
      for (const [name, bg] of Object.entries(LIGHT)) expect(contrastRatio(text, bg), `${r.hex}: ${text} on ${name}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(text, tint(text, 0.1, WHITE)), `${r.hex}: ${text} on its tint`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(text, WHITE)).toBeGreaterThanOrEqual(3)
      // A checked box or the selected day: white (the light theme's inverted text) on the text shade.
      expect(contrastRatio(WHITE, text)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('dark: a lighter version that reads at 4.5:1 on the page, cards and charcoal, with ink on it', () => {
    for (const r of results) {
      const { primary, onPrimary, text } = r.dark
      expect(text, r.hex).toBe(primary)
      expect(onPrimary, r.hex).toBe(INK)
      expect(contrastRatio(onPrimary, primary), `${r.hex}: ${onPrimary} on ${primary}`).toBeGreaterThanOrEqual(4.5)
      for (const [name, bg] of Object.entries(DARK)) expect(contrastRatio(text, bg), `${r.hex}: ${text} on ${name}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(text, tint(text, 0.1, DARK.page)), `${r.hex}: ${text} on its tint`).toBeGreaterThanOrEqual(4.5)
      expect(lchOf(primary)[0], `${r.hex}: the dark version is not darker than the light one`).toBeGreaterThanOrEqual(Math.min(lchOf(r.light.text)[0], 0.71) - 1e-9)
    }
  })

  it('moves only the lightness: the hue stays (where there is hue to keep)', () => {
    for (const r of results) {
      const [, C0, h0] = lchOf(r.hex)
      if (C0 < 0.06) continue
      for (const v of [r.light.primary, r.light.text, r.dark.primary]) {
        const [, C, h] = lchOf(v)
        if (C < 0.04) continue
        expect(Math.abs(((h - h0 + 540) % 360) - 180), `${r.hex} → ${v}`).toBeLessThan(8)
      }
    }
  })

  it('keeps a colour that passes, and changes nothing more when a result is fed back in', () => {
    for (const r of results) {
      expect(brand(r.light.primary).light.primary, `${r.hex}: button ${r.light.primary}`).toBe(r.light.primary)
      expect(brand(r.light.text).light.text, `${r.hex}: text ${r.light.text}`).toBe(r.light.text)
      const again = brand(r.light.text)
      expect(again.light.primary, `${r.hex}: a passing text shade is a passing button too`).toBe(r.light.text)
      expect(again.notes, `${r.hex}: ${r.light.text} needs no note`).toEqual([])
    }
  })

  it('writes a note exactly when the light colours changed', () => {
    for (const r of results) {
      const changed = r.light.primary !== r.hex || r.light.text !== r.hex
      expect(r.notes.length, `${r.hex}: ${JSON.stringify(r.notes)}`).toBe(changed ? 1 : 0)
      if (changed) expect(r.notes[0]!.message.startsWith(`accent ${r.hex}: `)).toBe(true)
    }
  })

  it('is quick enough to run in the browser on every keystroke', () => {
    const t0 = performance.now()
    for (const hex of COLOURS.slice(0, 100)) brandAccent(hex)
    expect((performance.now() - t0) / 100).toBeLessThan(20)
  })
})

describe('the guard on particular colours', () => {
  it('a yellow keeps its buttons with ink text; links take a darker yellow; the note says so', () => {
    const r = brand('#FFD500')
    expect(r.light).toMatchObject({ primary: '#FFD500', onPrimary: INK })
    expect(r.light.text).not.toBe('#FFD500')
    expect(r.dark.primary).toBe('#FFD500')
    expect(r.notes[0]!.message).toMatch(/^accent #FFD500: links and other accent text would be 1\.\d:1 on .+; they use #[0-9A-F]{6} \(4\.\d:1\); buttons keep #FFD500 with ink text \(\d+\.\d:1\)\.$/)
  })

  it('a dark, readable brand colour is used as it is, with white text, and no note', () => {
    for (const hex of ['#000000', '#0000FF', '#2E3035', '#7A2E0E', '#1D4ED8']) {
      const r = brand(hex)
      expect(r.light, hex).toMatchObject({ primary: hex, text: hex, onPrimary: WHITE })
      expect(r.notes, hex).toEqual([])
    }
  })

  it('white and near-white get a button that shows, and grey text', () => {
    for (const hex of ['#FFFFFF', '#FCE4EC', '#F9F5EF']) {
      const r = brand(hex)
      expect(r.light.primary, hex).not.toBe(hex)
      expect(r.light.onPrimary).toBe(INK)
      expect(r.notes[0]!.message).toContain('buttons would not show on the page')
    }
  })

  it('pure red, green and blue', () => {
    expect(brand('#FF0000').light).toMatchObject({ primary: '#FF0000', onPrimary: INK })
    expect(brand('#00FF00').light).toMatchObject({ primary: '#00FF00', onPrimary: INK })
    expect(brand('#0000FF').light).toMatchObject({ primary: '#0000FF', onPrimary: WHITE, text: '#0000FF' })
    expect(lchOf(brand('#0000FF').dark.primary)[0]).toBeGreaterThan(lchOf('#0000FF')[0])
  })

  it('a mid grey', () => {
    const r = brand('#808080')
    expect(r.light.onPrimary).toBe(INK)
    expect(lchOf(r.light.text)[1]).toBeLessThan(0.01)
  })
})

describe('the CSS the admin writes for a brand colour', () => {
  const theme = (accent: string) => resolveAdminTheme({ accent }) as CmsAdminTheme

  it('nothing for a built-in accent; data-cms-accent is its name', () => {
    for (const p of CMS_ACCENT_PRESETS) {
      expect(adminAccentCss(theme(p))).toBe('')
      expect(adminAccentName(theme(p))).toBe(p)
    }
  })

  it('a brand: the shades, --ui-primary as the text shade, and the button fill, for light and dark', () => {
    const t = theme('#FFD500')
    expect(adminAccentName(t)).toBe('brand')
    const css = adminAccentCss(t)
    const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1], vars: Object.fromEntries(m[2]!.split(';').map((d) => d.split(':'))) }))
    expect(blocks.map((b) => b.sel)).toEqual([`html[data-cms-admin][data-cms-accent='brand']`, `html[data-cms-admin][data-cms-accent='brand'].dark`])
    const [light, dark] = blocks
    if (t.accent.kind !== 'brand') throw new Error('brand')
    expect(light!.vars).toMatchObject({ '--ui-primary': t.accent.light.text, '--cms-accent-fill': '#FFD500', '--cms-accent-on-fill': INK, '--ui-color-primary-50': t.accent.light.ramp['50'] })
    expect(dark!.vars).toMatchObject({ '--ui-primary': t.accent.dark.text, '--cms-accent-fill': t.accent.dark.primary, '--cms-accent-on-fill': INK })
    expect(Object.keys(light!.vars).filter((k) => k.startsWith('--ui-color-primary-'))).toHaveLength(11)
  })

  it('writes only hexes, whatever the theme object holds (it may come over the network)', () => {
    const t = theme('#B4532A')
    if (t.accent.kind !== 'brand') throw new Error('brand')
    const bad = { ...t, accent: { ...t.accent, light: { ...t.accent.light, text: 'red;}body{display:none', ramp: { ...t.accent.light.ramp, 50: 'url(x)' } } } } as CmsAdminTheme
    const css = adminAccentCss(bad)
    expect(css).not.toContain('display')
    expect(css).not.toContain('url(')
    expect(css).toContain(`--ui-primary:${t.accent.light.primary}`)
  })
})
