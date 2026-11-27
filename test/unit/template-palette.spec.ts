import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { colourDistance, contrast, hexToOklch, oklchToHex, ownPalette, plainHex, type PaletteRule, type Vars } from '../../templates/kit/palette'
import { presetStyle } from '../../templates/kit/looks'
import { lookTemplates, ownLine, scanLook, writeOwn, type LookInput } from '../../templates/kit/look-pairs'

// An own main colour on every look of every template (templates/kit/palette.ts): the maths,
// the promise that nothing readable becomes unreadable, and the palettes that live sites depend on.

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const templatesDir = join(repoRoot, 'templates')
const TEMPLATES = lookTemplates(templatesDir)

interface Entry { template: string; look: any; looks: any; rule: PaletteRule }
interface PresetEntry extends Entry { preset: any }

const ENTRIES: Entry[] = []
for (const template of TEMPLATES) {
  const looks = (await import(/* @vite-ignore */ join(templatesDir, template, 'looks.ts'))).looks
  for (const look of looks.all) ENTRIES.push({ template, look, looks, rule: looks.paletteRule(look.id)! })
}
const PRESETS: PresetEntry[] = ENTRIES.flatMap((e) => e.look.presets.map((preset: any) => ({ ...e, preset })))

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const HUES = Array.from({ length: 12 }, (_, i) => i * 30)
const HARD_COLOURS: string[] = [
  ...HUES.flatMap((h) => [oklchToHex([0.45, 0.14, rad(h)]), oklchToHex([0.8, 0.14, rad(h)]), oklchToHex([0.6, 0.04, rad(h)])]),
  '#000000', '#ffffff', '#808080', '#ff0000', '#ffff00', '#00ff00', '#0000ff',
]
// Ordinary company colours: dark and middle tones of every hue, two light ones, a grey, black.
const COMPANY_COLOURS = ['#1d4ed8', '#0f766e', '#2e7d32', '#b91c1c', '#c2185b', '#7c3aed', '#9a3412', '#0369a1', '#4d7c0f', '#be123c', '#1e3a8a', '#374151', '#111111', '#d97706', '#f59e0b', '#ffd600']

describe('the templates under test', () => {
  it('are 52 looks with 156 colour presets, each with rules for an own colour', () => {
    expect(ENTRIES).toHaveLength(52)
    expect(PRESETS).toHaveLength(156)
    expect(HARD_COLOURS).toHaveLength(43)
    for (const e of ENTRIES) {
      expect(e.rule, `${e.template}/${e.look.id} has no rule`).not.toBeNull()
      expect(e.look.own, `${e.template}/${e.look.id} has no own`).toBeTruthy()
    }
  })
})

describe('the colour sums', () => {
  it('give the same colour back from hex to OKLCH to hex', () => {
    for (const hex of ['#7a5a3a', '#ffffff', '#000000', '#ff0000', '#1d4ed8', '#808080', '#f59e0b']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex)
    }
  })

  it('know a few colours', () => {
    const [L, C, h] = hexToOklch('#ff0000')
    expect(L).toBeCloseTo(0.628, 3)
    expect(C).toBeCloseTo(0.2577, 3)
    expect(deg(h)).toBeCloseTo(29.23, 1)
    const [white, whiteC] = hexToOklch('#ffffff')
    expect(white).toBeCloseTo(1, 3)
    expect(whiteC).toBeCloseTo(0, 3)
  })

  it('measure contrast the way WCAG does', () => {
    expect(contrast('#000000', '#ffffff')).toBe(21)
    expect(contrast('#1d4ed8', '#1d4ed8')).toBe(1)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
    expect(colourDistance('#1d4ed8', '#1d4ed8')).toBe(0)
    expect(colourDistance('#000000', '#ffffff')).toBeGreaterThan(90)
  })

  it('bring a colour no screen can show to one it can, keeping lightness and hue', () => {
    for (const h of [0, 40, 100, 150, 200, 260, 300, 340]) {
      const hex = oklchToHex([0.7, 0.4, rad(h)])
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
      const [L, C, hue] = hexToOklch(hex)
      expect(Math.abs(L - 0.7)).toBeLessThan(0.01)
      expect(C).toBeLessThan(0.4)
      const gap = Math.abs(deg(hue) - h)
      expect(Math.min(gap, 360 - gap)).toBeLessThan(2)
    }
  })

  it('read a plain colour, and nothing else', () => {
    expect(plainHex('#ABC')).toBe('#aabbcc')
    expect(plainHex(' #1D4ED8 ')).toBe('#1d4ed8')
    expect(plainHex('red')).toBeNull()
    expect(plainHex('#12')).toBeNull()
    expect(plainHex('#11223344')).toBeNull()
    expect(plainHex(null)).toBeNull()
    expect(plainHex('')).toBeNull()
  })
})

describe('a preset with its own main colour', () => {
  it('is the preset, in all 156', () => {
    for (const { template, look, looks, preset, rule } of PRESETS) {
      const name = `${template}/${look.id}/${preset.id}`
      const main = preset.vars[rule.main]
      expect(ownPalette(preset.vars, rule, main), name).toEqual(preset.vars)
      const resolved = looks.resolve(look.id, preset.id, { color: main })
      const lower = plainHex(main)!
      expect(resolved.style, name).toBe(presetStyle(preset))
      expect(resolved.own, name).toEqual({ given: lower, shown: lower })
    }
  })
})

describe('no colour of the owner\'s', () => {
  it('changes nothing, in all 156', () => {
    const none: any[] = [undefined, null, {}, { color: null }, { color: '' }, { color: 'red' }, { color: '#12' }]
    for (const { template, look, looks, preset } of PRESETS) {
      for (const own of none) {
        const resolved = looks.resolve(look.id, preset.id, own)
        const name = `${template}/${look.id}/${preset.id} ${JSON.stringify(own)}`
        expect(resolved.style, name).toBe(presetStyle(preset))
        expect(resolved.own, name).toBeNull()
      }
    }
  })
})

describe('what was readable', () => {
  // The mark of a pair: body text (4.5), large text and buttons (3), or none.
  const mark = (c: number) => (c >= 4.5 ? 4.5 : c >= 3 ? 3 : 0)

  it('stays readable with every colour, in all 156 presets', () => {
    const failures: string[] = []
    let palettes = 0
    for (const { template, look, preset, rule } of PRESETS) {
      const was = preset.vars as Vars
      for (const colour of HARD_COLOURS) {
        const now = ownPalette(was, rule, colour)
        palettes++
        const check = (label: string, a0: string | null, b0: string | null, a1: string | null, b1: string | null) => {
          if (!a0 || !b0 || !a1 || !b1) return
          const need = mark(contrast(a0, b0))
          if (!need) return
          const got = contrast(a1, b1)
          if (got < need - 0.01) failures.push(`${template}/${look.id}/${preset.id} ${colour} ${label} ${got.toFixed(2)}<${need}`)
        }
        // (a) the main colour against what the look puts together with it
        for (const x of rule.against) check(`${rule.main}~${x}`, plainHex(was[rule.main]), plainHex(was[x]), plainHex(now[rule.main]), plainHex(now[x]))
        for (const hex of rule.fixed) check(`${rule.main}~${hex}`, plainHex(was[rule.main]), hex, plainHex(now[rule.main]), hex)
        // (b) every other pair of variables
        const names = (Object.keys(was) as `--${string}`[]).filter((n) => n !== rule.main)
        for (let i = 0; i < names.length; i++) {
          for (let j = i + 1; j < names.length; j++) {
            check(`${names[i]}~${names[j]}`, plainHex(was[names[i]!]), plainHex(was[names[j]!]), plainHex(now[names[i]!]), plainHex(now[names[j]!]))
          }
        }
      }
    }
    expect(palettes).toBe(6708)
    expect(failures).toEqual([])
  })
})

describe('the owner\'s main colour', () => {
  it('keeps their hue, and takes no more colour than they gave', () => {
    const failures: string[] = []
    for (const { template, look, looks, preset, rule } of PRESETS) {
      for (const colour of [...HARD_COLOURS, ...COMPANY_COLOURS]) {
        const own = looks.resolve(look.id, preset.id, { color: colour }).own as { given: string; shown: string }
        const name = `${template}/${look.id}/${preset.id} ${colour}`
        const [, givenC, givenH] = hexToOklch(own.given)
        const [, shownC, shownH] = hexToOklch(own.shown)
        if (own.shown !== own.given && givenC >= 0.02 && shownC >= 0.02) {
          const gap = Math.abs(deg(givenH) - deg(shownH))
          const turned = Math.min(gap, 360 - gap)
          if (turned >= 3) failures.push(`${name} hue turned ${turned.toFixed(1)}° (${own.given} shown as ${own.shown})`)
        }
        const most = rule.maxChroma !== undefined ? Math.min(givenC, rule.maxChroma) : givenC
        if (shownC > most + 0.005) failures.push(`${name} chroma ${shownC.toFixed(3)} > ${most.toFixed(3)} (${own.given} shown as ${own.shown})`)
      }
    }
    expect(failures).toEqual([])
  })
})

describe('which colours follow the main one', () => {
  it('is held as a file', async () => {
    const out: Record<string, { main: string; follows: string[] }> = {}
    for (const { template, look, rule } of ENTRIES) out[`${template}/${look.id}`] = { main: rule.main, follows: [...rule.follows] }
    const sortedOut = Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    // A change of a preset, or of the rules, that changes this list must be seen.
    await expect(JSON.stringify(sortedOut, null, 2) + '\n').toMatchFileSnapshot('./__snapshots__/template-palette/follows.json')
  })
})

describe('the palettes of every preset', () => {
  it('for four colours are held as a file', async () => {
    const out: Record<string, string> = {}
    for (const { template, look, looks, preset } of PRESETS) {
      for (const color of ['#1d4ed8', '#2e7d32', '#f59e0b', '#111111']) out[`${template}/${look.id}/${preset.id} ${color}`] = looks.resolve(look.id, preset.id, { color }).style
    }
    // Sites store the owner's colour, not the palette: a change of these values changes the colours of
    // live sites, so it must be made on purpose (update the file with `vitest -u` only after looking at the diff).
    await expect(JSON.stringify(out, null, 1) + '\n').toMatchFileSnapshot('./__snapshots__/template-palette/palettes.json')
  })
})

describe('looks.ts says what the code says', () => {
  // When this fails, run `node templates/kit/scripts/look-pairs.mjs --write` after looking at what changed.
  for (const { template, look } of ENTRIES) {
    it(`for ${template}/${look.id}`, () => {
      const { against, fixed } = scanLook(templatesDir, template, look)
      expect({ against, fixed }).toEqual({ against: [...look.own.against].sort(), fixed: [...(look.own.fixed ?? [])].sort() })
    })
  }
})

describe('the look-pairs scan on a made-up template', () => {
  const root = mkdtempSync(join(tmpdir(), 'tz-pairs-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  const look: LookInput = {
    id: 'x',
    presets: [{ vars: { '--brand': '#224466', '--brand-ink': '#ffffff', '--paper': '#fafafa', '--ink': '#111111', '--tint': '#eeeeee' } }],
  }
  const THEME = '@theme { --color-brand: var(--brand); --color-brand-ink: var(--brand-ink); --color-paper: var(--paper); --color-ink: var(--ink); --color-tint: var(--tint); --color-lamp: var(--brand); }'
  let count = 0

  /** A fresh template folder `t` with the given stylesheet and components; returns what the scan finds. */
  function scan(css: string, components: Record<string, string> = {}) {
    const dir = join(root, `case-${++count}`)
    const put = (path: string, text: string) => {
      mkdirSync(dirname(join(dir, 't', path)), { recursive: true })
      writeFileSync(join(dir, 't', path), text)
    }
    put('app/assets/css/main.css', THEME)
    put('app/assets/css/x.css', css)
    for (const [name, text] of Object.entries(components)) put(`app/components/x/${name}.vue`, text)
    return scanLook(dir, 't', look)
  }
  const vue = (html: string, script = '') => `${script ? `<script setup>\n${script}\n</script>\n` : ''}<template>\n${html}\n</template>\n`

  it('reads a stylesheet: a background and its text make a pair, a gradient and a colour-mix do not', () => {
    const found = scan(`html[data-look="x"] { --line: #dddddd; --soft: color-mix(in srgb, var(--ink) 50%, var(--paper)); body { color: var(--ink); background: var(--paper); } .btn { background: var(--brand); color: var(--brand-ink); } .tlink { color: var(--ink); background: linear-gradient(var(--brand), var(--brand)) 0 100% / 100% 1px no-repeat; } .card { background: var(--brand); color: var(--soft); } }`)
    expect(found.against).toEqual(['--brand-ink'])
    expect(found.fixed).toEqual([])
    expect(found.derived).toEqual(['--soft'])
    expect(Object.keys(found.sources)).toEqual(['--brand-ink', '--soft'])
  })

  it('finds the text on the main colour in a rule', () => {
    const found = scan('html[data-look="x"] { .btn { background: var(--brand); color: var(--brand-ink); } }')
    expect(found.against).toEqual(['--brand-ink'])
    expect(found.sources['--brand-ink']?.[0]).toContain('.btn')
  })

  it('takes a gradient for no background', () => {
    const found = scan('html[data-look="x"] { .tlink { color: var(--ink); background: linear-gradient(var(--brand), var(--brand)) 0 100% / 100% 1px no-repeat; } }')
    expect(found.against).toEqual([])
    expect(found.sources).toEqual({})
  })

  it('reports a derived variable, and does not check it', () => {
    const found = scan('html[data-look="x"] { --soft: color-mix(in srgb, var(--ink) 50%, var(--paper)); .card { background: var(--brand); color: var(--soft); } }')
    expect(found.derived).toEqual(['--soft'])
    expect(found.against).toEqual([])
  })

  it('pairs a variant with what it replaces', () => {
    const found = scan('html[data-look="x"] {}', { A: vue('<a class="bg-paper text-ink hover:bg-brand hover:text-brand-ink">x</a>') })
    expect(found.against).toEqual(['--brand-ink'])
  })

  it('does so when the classes come from a script constant', () => {
    const found = scan('html[data-look="x"] {}', { A: vue('<a :class="cls">x</a>', "const cls = 'bg-paper text-ink hover:bg-brand hover:text-brand-ink'") })
    expect(found.against).toEqual(['--brand-ink'])
  })

  it('takes a white text on the main colour for a fixed colour', () => {
    const found = scan('html[data-look="x"] {}', { A: vue('<span class="bg-brand text-white">x</span>') })
    expect(found.fixed).toEqual(['#ffffff'])
    expect(found.against).toEqual([])
  })

  it('counts the theme\'s names: a colour that is the brand is the brand', () => {
    const found = scan('html[data-look="x"] {}', { A: vue('<span class="bg-lamp text-tint">x</span>') })
    expect(found.against).toEqual(['--tint'])
  })

  it('joins a :class literal to the static class', () => {
    const found = scan('html[data-look="x"] {}', { A: vue(`<p class="bg-brand" :class="on ? 'text-tint' : ''">x</p>`) })
    expect(found.against).toEqual(['--tint'])
  })

  it('puts the page\'s background against the main colour only when that is used as a text', () => {
    const css = 'html[data-look="x"] { body { background: var(--paper); color: var(--ink); } }'
    const asText = scan(css, { A: vue('<span class="text-brand">x</span>') })
    expect(asText.mainAsText).toBe(true)
    expect(asText.page).toBe('--paper')
    expect(asText.against).toEqual(['--paper'])
    const notAsText = scan(css, { A: vue('<span class="bg-brand">x</span>') })
    expect(notAsText.mainAsText).toBe(false)
    // Not the page's background. But a fill in the main colour that sets no text colour of its
    // own shows the text it inherits: the page's own text colour.
    expect(notAsText.against).toEqual(['--ink'])
    expect(notAsText.sources['--ink']?.[0]).toMatch(/the page's text on --brand/)
    // A fill that names its text does not get the page's.
    expect(scan(css, { A: vue('<span class="bg-brand text-brand-ink">x</span>') }).against).toEqual(['--brand-ink'])
  })

  it('counts a background nearly as light as the page as one of its surfaces, and a dark one not', () => {
    // A text in the main colour inside a tinted section: the section's background is set on an
    // element around it, so no single rule shows the pair. --tint is as light as the page; --ink
    // (a dark footer) is not, and has its own texts.
    const css = 'html[data-look="x"] { body { background: var(--paper); color: var(--ink); } .band { background: var(--tint); } .foot { background: var(--ink); color: var(--paper); } }'
    const found = scan(css, { A: vue('<section class="band"><a class="text-brand">x</a></section>') })
    expect(found.against).toEqual(['--paper', '--tint'])
    expect(found.sources['--tint']?.[0]).toMatch(/a surface like the page/)
    // Without a text in the main colour no surface counts.
    expect(scan(css, { A: vue('<section class="band">x</section>') }).against).toEqual([])
  })

  it('puts every text without a background of its own on a main colour that is the page itself', () => {
    const calm: LookInput = { id: 'x', own: { main: '--paper', calm: true }, presets: look.presets }
    const dir = join(root, `case-${++count}`)
    mkdirSync(join(dir, 't/app/assets/css'), { recursive: true })
    mkdirSync(join(dir, 't/app/components/x'), { recursive: true })
    writeFileSync(join(dir, 't/app/assets/css/main.css'), THEME)
    writeFileSync(join(dir, 't/app/assets/css/x.css'), 'html[data-look="x"] { body { background: var(--paper); color: var(--ink); } .note { color: var(--tint); } .chip { background: var(--brand); color: var(--brand-ink); } }')
    writeFileSync(join(dir, 't/app/components/x/A.vue'), vue('<span class="text-brand">x</span>'))
    const found = scanLook(dir, 't', calm)
    // --ink is on the page in body, --tint and --brand have no background of their own; --brand-ink is on --brand.
    expect(found.against).toEqual(['--brand', '--ink', '--tint'])
  })
})

describe('the own line of looks.ts', () => {
  it('writes its keys in order, leaving out an empty fixed', () => {
    expect(ownLine({ main: '--accent', calm: true, follows: ['--tint'], against: ['--ink', '--paper'], fixed: ['#ffffff'] }))
      .toBe("own: { main: '--accent', calm: true, follows: ['--tint'], against: ['--ink', '--paper'], fixed: ['#ffffff'] },")
    expect(ownLine({ against: [], fixed: [] })).toBe('own: { against: [] },')
    expect(ownLine({ main: '--accent', against: ['--ink'] })).toBe("own: { main: '--accent', against: ['--ink'] },")
  })

  const source = [
    'export const looks = defineLooks([',
    '  {',
    "    id: 'x',",
    "    name: { cs: 'X', en: 'X' },",
    "    presets: [{ id: 'y', name: { cs: 'Y', en: 'Y' }, vars: {} }],",
    '  },',
    '  {',
    "    id: 'y',",
    "    name: { cs: 'Y', en: 'Y' },",
    '    own: { against: [] },',
    "    presets: [{ id: 'x', name: { cs: 'X', en: 'X' }, vars: {} }],",
    '  },',
    '])',
    '',
  ].join('\n')

  it('goes after the name line, with the name\'s indentation', () => {
    const lines = writeOwn(source, 'x', "own: { against: ['--ink'] },").split('\n')
    expect(lines.slice(2, 5)).toEqual(["    id: 'x',", "    name: { cs: 'X', en: 'X' },", "    own: { against: ['--ink'] },"])
    expect(lines).toHaveLength(source.split('\n').length + 1)
  })

  it('replaces an own line that is there', () => {
    const out = writeOwn(source, 'y', "own: { against: ['--ink'] },")
    expect(out.split('\n')).toHaveLength(source.split('\n').length)
    expect(out).toContain("    own: { against: ['--ink'] },\n")
    expect(out).not.toContain('own: { against: [] }')
  })

  it('finds the look by its own id line, not by a preset with the same id', () => {
    const out = writeOwn(source, 'y', 'own: { against: [] },')
    expect(out.indexOf("id: 'y',")).toBeLessThan(out.indexOf('own:'))
    expect(writeOwn(source, 'x', 'own: { against: [] },').split('\n')[4]).toBe('    own: { against: [] },')
  })

  it('throws on a look it cannot find', () => {
    expect(() => writeOwn(source, 'nope', 'own: { against: [] },')).toThrow(/nope/)
  })
})
