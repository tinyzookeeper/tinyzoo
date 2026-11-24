import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import {
  checkDesigns, componentName, guardCode, handlerRoute, pascalId, rewriteComponents, scanDesign,
  type DesignScan,
} from '../../templates/kit/design-build'
import { mergeFonts, ownFonts, unionWeights, type DesignFonts } from '../../templates/kit/fonts'
import photographerFonts from '../../templates/photographer/fonts'
import weddingFonts from '../../templates/wedding/fonts'
import restaurantFonts from '../../templates/restaurant/fonts'
// @ts-expect-error plain .mjs without types
import { designCss, fontAdvice, parseMainCss } from '../../templates/app/scripts/theme-diff.mjs'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

// magic-string is a dependency of the kit, not of the repo root.
const MagicString = createRequire(new URL('../../templates/kit/package.json', import.meta.url))('magic-string') as new (code: string) => Parameters<typeof rewriteComponents>[0]

// How the one app reads a template's folder as a design (templates/kit/design-build.ts, fonts.ts)
// and writes a design's own stylesheet (templates/app/scripts/theme-diff.mjs). No Nuxt, no database.

const folder = (id: string) => fileURLToPath(new URL(`../../templates/${id}`, import.meta.url))

describe('names of designs and components', () => {
  it('turns a design id into Pascal case', () => {
    expect(pascalId('sports-club')).toBe('SportsClub')
    expect(pascalId('photographer')).toBe('Photographer')
    expect(pascalId('car-service')).toBe('CarService')
  })

  it('names a component as Nuxt would, prefixed by its look', () => {
    expect(componentName('atelier/Hero.vue')).toBe('AtelierHero')
    expect(componentName('sports-club/Hero.vue')).toBe('SportsClubHero')
    expect(componentName('atelier/index.vue')).toBe('Atelier')
  })

  it('does not prefix a name twice, and leaves global and root components bare', () => {
    expect(componentName('atelier/AtelierHero.vue')).toBe('AtelierHero')
    expect(componentName('global/BlockHero.vue')).toBe('BlockHero')
    expect(componentName('LookEntry.vue')).toBe('LookEntry')
  })
})

describe('server handler routes', () => {
  it('reads the address and method the way Nitro does', () => {
    expect(handlerRoute('gift/[id]/reserve.post.ts', 'api')).toEqual({ route: '/api/gift/:id/reserve', method: 'post' })
    expect(handlerRoute('index.get.ts', 'api')).toEqual({ route: '/api', method: 'get' })
    expect(handlerRoute('robots.txt.get.ts', 'routes')).toEqual({ route: '/robots.txt', method: 'get' })
  })

  it('turns a catch-all into a wildcard with no method', () => {
    expect(handlerRoute('[...slug].ts', 'routes')).toEqual({ route: '/**:slug', method: undefined })
  })
})

describe('reading a real template folder', () => {
  const photographer = scanDesign('photographer', folder('photographer'))
  const wedding = scanDesign('wedding', folder('wedding'))

  it('finds the looks, blocks and parts of the photographer template', () => {
    expect(photographer.looks).toEqual(['atelier', 'negativ', 'zapisnik'])
    expect(photographer.components.filter((c) => c.kind === 'block')).toHaveLength(10)
    expect(photographer.components.filter((c) => c.kind === 'part')).toHaveLength(45)
    expect(photographer.components.filter((c) => c.kind === 'root').map((c) => c.name)).toContain('LookEntry')
  })

  it('has a stylesheet for each look, no handlers, nothing unsupported', () => {
    for (const look of photographer.looks) expect(photographer.css[look]).toMatch(new RegExp(`${look}\\.css$`))
    expect(photographer.handlers).toEqual([])
    expect(photographer.unsupported).toEqual([])
  })

  it('knows the look and part of every part, and names blocks with Block', () => {
    for (const c of photographer.components.filter((c) => c.kind === 'part')) {
      expect(c.look).toBeTruthy()
      expect(c.part).toBeTruthy()
    }
    for (const c of photographer.components.filter((c) => c.kind === 'block')) expect(c.name.startsWith('Block')).toBe(true)
  })

  it('finds the wedding gift handler', () => {
    expect(wedding.handlers).toHaveLength(1)
    expect(wedding.handlers[0]).toMatchObject({ route: '/api/gift/:id/reserve', method: 'post' })
  })

  it('finds no errors when photographer and wedding are built together', () => {
    expect(checkDesigns([photographer, wedding]).errors).toEqual([])
  })
})

describe('checking designs before they are built together', () => {
  const design = (over: Partial<DesignScan> & { id: string }): DesignScan => ({
    root: `/x/${over.id}`,
    components: [],
    looks: ['one'],
    css: { one: '/x/one.css' },
    handlers: [],
    unsupported: [],
    ...over,
  })
  const part = (look: string, name: string) => ({ name: look + name, file: `/x/${look}/${name}.vue`, kind: 'part' as const, look, part: name })

  it('stops when a look is in two designs', () => {
    const { errors } = checkDesigns([design({ id: 'a' }), design({ id: 'b' })])
    expect(errors.join('\n')).toContain('the look "one" is in two designs')
  })

  it('stops when a look has no stylesheet', () => {
    const { errors } = checkDesigns([design({ id: 'a', css: {} })])
    expect(errors.join('\n')).toContain('no stylesheet')
  })

  it('stops when two designs answer the same method and route', () => {
    const handlers = [{ file: '/x/h.ts', route: '/api/gift', method: 'post' }]
    const { errors } = checkDesigns([
      design({ id: 'a', handlers }),
      design({ id: 'b', looks: ['two'], css: { two: '/x/two.css' }, handlers }),
    ])
    expect(errors.join('\n')).toContain('two designs answer post /api/gift')
  })

  it('stops on an id with capitals or a leading digit', () => {
    expect(checkDesigns([design({ id: 'Sports' })]).errors).toHaveLength(1)
    expect(checkDesigns([design({ id: '1club' })]).errors).toHaveLength(1)
  })

  it('only warns when one look lacks a part another look has', () => {
    const { errors, warnings } = checkDesigns([design({
      id: 'a',
      looks: ['one', 'two'],
      css: { one: '/x/1.css', two: '/x/2.css' },
      components: [part('one', 'Hero'), part('one', 'Footer'), part('two', 'Hero')],
    })])
    expect(errors).toEqual([])
    expect(warnings.join('\n')).toContain('the look "two" has no Footer.vue')
  })

  it('stops on a server folder the one app does not carry', () => {
    const { errors } = checkDesigns([design({ id: 'a', unsupported: ['server/plugins'] })])
    expect(errors.join('\n')).toContain('server/plugins')
  })
})

describe('turning a design\'s own components into imports', () => {
  const own = new Map([['AtelierWordmark', '/x/atelier/Wordmark.vue']])

  it('imports an own component and leaves Nuxt\'s alone', () => {
    const code = 'const _component_AtelierWordmark = _resolveComponent("AtelierWordmark")\nconst _component_LookPart = _resolveComponent("LookPart")'
    const s = new MagicString(code)
    expect(rewriteComponents(s, code, own, 'a.vue')).toBe(true)
    const out = s.toString()
    expect(out.startsWith('import __tz_component_0 from "/x/atelier/Wordmark.vue";')).toBe(true)
    expect(out).toContain('_component_AtelierWordmark = __tz_component_0')
    expect(out).toContain('_resolveComponent("LookPart")')
    expect(out).not.toContain('_resolveComponent("AtelierWordmark")')
  })

  it('imports a component used twice only once', () => {
    const code = 'const a = _resolveComponent("AtelierWordmark")\nconst b = _resolveComponent("AtelierWordmark")'
    const s = new MagicString(code)
    rewriteComponents(s, code, own, 'a.vue')
    expect(s.toString().match(/^import /gm)).toHaveLength(1)
    expect(s.toString().match(/= __tz_component_0/g)).toHaveLength(2)
  })

  it('also rewrites a call with a second argument', () => {
    const code = 'const a = resolveComponent("AtelierWordmark", true)'
    const s = new MagicString(code)
    expect(rewriteComponents(s, code, own, 'a.vue')).toBe(true)
    expect(s.toString()).toContain('a = __tz_component_0')
  })

  it('changes nothing when the code uses none of them', () => {
    const code = 'const a = _resolveComponent("LookPart")'
    const s = new MagicString(code)
    expect(rewriteComponents(s, code, own, 'a.vue')).toBe(false)
    expect(s.toString()).toBe(code)
  })

  it('refuses a lazy name of an own component', () => {
    for (const name of ['LazyAtelierWordmark', 'LazyIdleAtelierWordmark']) {
      const code = `const a = _resolveComponent("${name}")`
      expect(() => rewriteComponents(new MagicString(code), code, own, 'a.vue')).toThrow(/lazily/)
    }
  })
})

describe('the guard in front of a design\'s handler', () => {
  const code = guardCode('wedding', '/abs/reserve.post.ts')

  it('imports from #imports and the handler, and checks the site\'s design', () => {
    expect(code).toContain("from '#imports'")
    expect(code).toContain('import handler from "/abs/reserve.post.ts"')
    expect(code).toContain('event.context.siteDesign !== "wedding"')
  })

  it('has no template literal (a "/" inside one breaks Nitro\'s auto-imports)', () => {
    expect(code).not.toContain('`')
  })
})

describe('merging typefaces', () => {
  it('takes the union of weights, or one range over all', () => {
    expect(unionWeights([400, 500], [400, 500, 700])).toEqual([400, 500, 700])
    expect(unionWeights(['300 500'], ['300 500'])).toEqual(['300 500'])
    expect(unionWeights([400], ['400 900'])).toEqual(['400 900'])
    expect(unionWeights([700, 400], [500])).toEqual([400, 500, 700])
  })

  const merged = mergeFonts([photographerFonts, weddingFonts, restaurantFonts] as DesignFonts[])
  const family = (name: string) => merged.families.find((f) => f.name === name)!

  it('makes no family global and preloads nothing', () => {
    expect(merged.families.every((f) => f.global === false)).toBe(true)
    expect(merged.defaults.preload).toBe(false)
  })

  it('lists each family once, with the weights of every design that uses it', () => {
    const names = merged.families.map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
    expect(family('Hanken Grotesk').weights).toEqual([400, 500, 700])
    expect(family('Newsreader').weights).toEqual(['300 500'])
    expect(family('Newsreader').styles).toEqual(['normal', 'italic'])
  })

  it('keeps the variable axes of every design', () => {
    const axes = merged.google!.experimental.variableAxis
    expect(axes.Archivo!.wdth).toEqual([['62', '125']])
    expect(axes.Newsreader!.opsz).toEqual([['6', '72']])
    expect(axes['Bodoni Moda']!.opsz).toEqual([['6', '96']])
    expect(axes.Anybody!.wdth).toEqual([['50', '150']])
  })

  it('spans the smallest to the largest value when designs differ on an axis', () => {
    const f = (range: [string, string]): DesignFonts => ({
      families: [{ name: 'Archivo', provider: 'google', weights: [400] }],
      variableAxis: { Archivo: { wdth: [range] } },
    })
    const out = mergeFonts([f(['62', '100']), f(['75', '125'])])
    expect(out.google!.experimental.variableAxis.Archivo!.wdth).toEqual([['62', '125']])
  })

  // A family that names no styles is fetched in @nuxt/fonts' default ones; asking for only the
  // normal style would fetch other files and draw the letters differently.
  it('names no styles for a family no design names styles for, and adds the default ones where one design names none', () => {
    const jost = (styles?: ('normal' | 'italic')[]): DesignFonts => ({ families: [{ name: 'Jost', provider: 'google', weights: [400, 500], ...(styles ? { styles } : {}) }] })
    expect(mergeFonts([jost(), jost()]).families[0]).not.toHaveProperty('styles')
    expect(mergeFonts([jost(['normal']), jost()]).families[0]!.styles).toEqual(['normal', 'italic'])
    expect(mergeFonts([jost(['normal']), jost(['normal'])]).families[0]!.styles).toEqual(['normal'])
  })

  it('declares a design\'s own families global, with its axes', () => {
    const own = ownFonts(photographerFonts as DesignFonts)
    expect(own.families.every((f) => f.global === true)).toBe(true)
    expect(own.google!.experimental.variableAxis).toEqual(photographerFonts.variableAxis)
  })
})

describe('a design\'s own stylesheet', () => {
  const parsed = parseMainCss(readFileSync(`${folder('restaurant')}/app/assets/css/main.css`, 'utf8'))

  it('reads the theme tokens and the rules of a main.css apart', () => {
    expect(parsed.theme).toContainEqual(['--color-night', 'var(--bg)'])
    expect(parsed.rules).toContain('html[data-look]')
    expect(parsed.rules).not.toContain('@theme')
  })

  it('scopes every rule to the design, not to any look', () => {
    const css: string = designCss('restaurant', [], parsed.rules)
    expect(css).not.toContain('html[data-look]')
    expect(css).toContain('html[data-design="restaurant"] { scroll-behavior: smooth; }')
    // Each rule's selector (text before a "{" that is not inside a comment) starts with the design.
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').split('{').slice(0, -1).map((chunk) => chunk.split(/[};]/).pop()!.trim()).filter((s) => s && !s.startsWith('@'))
    expect(selectors.length).toBeGreaterThan(0)
    for (const s of selectors) expect(s).toMatch(/^html\[data-design="restaurant"\]/)
  })

  it('writes a theme layer only when a token differs', () => {
    expect(designCss('restaurant', [], parsed.rules)).not.toContain('@layer theme')
    const css: string = designCss('restaurant', [['--color-night', '#111']], parsed.rules)
    expect(css).toContain('@layer theme')
    expect(css).toContain('--color-night: #111;')
  })

  it('leaves typeface tokens to the looks (the main stylesheet would carry their @font-face rules)', () => {
    const css: string = designCss('blog', [['--font-display', '"Spectral", serif'], ['--color-rule', 'red']], '')
    expect(css).toContain('--color-rule: red;')
    expect(css).not.toContain('--font-display')
    expect(designCss('blog', [['--font-display', '"Spectral", serif']], '')).not.toContain('@layer theme')
  })
})

describe('looks that read their template\'s default typeface', () => {
  // A template folder of two looks: `a` sets --font-display, `b` does not.
  const root = mkdtempSync(join(tmpdir(), 'tz-font-advice-'))
  const write = (file: string, text: string) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text) }
  write('app/assets/css/main.css', '@theme { --font-display: "Spectral", serif; }')
  write('app/assets/css/a.css', 'html[data-look="a"] { --font-display: "Besley", serif; }')
  write('app/assets/css/b.css', 'html[data-look="b"] { --font-sans: "Rubik", sans-serif; }')
  write('app/components/a/Hero.vue', '<template><h1 class="font-display" /></template>')
  write('app/components/b/Hero.vue', '<template><h1 class="font-sans" /></template>')
  const differing: [string, string][] = [['--font-display', '"Spectral", serif']]
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('finds none when no look reads the token without setting it', () => {
    expect(fontAdvice(root, differing)).toEqual([])
  })

  it('finds a look whose blocks read it (the blocks are drawn in every look)', () => {
    write('app/components/global/BlockText.vue', '<template><h2 class="font-display" /></template>')
    expect(fontAdvice(root, differing)).toEqual([{ look: 'b', token: '--font-display', value: '"Spectral", serif' }])
    rmSync(join(root, 'app/components/global'), { recursive: true })
  })

  it('finds a look whose stylesheet reads it, and none for a token that does not differ', () => {
    write('app/assets/css/b.css', 'html[data-look="b"] h1 { font-family: var(--font-display); }')
    expect(fontAdvice(root, differing).map((a) => a.look)).toEqual(['b'])
    expect(fontAdvice(root, [['--color-rule', 'red']])).toEqual([])
  })
})
