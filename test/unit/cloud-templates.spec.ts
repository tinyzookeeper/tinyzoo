import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cs } from '../../cloud/app/i18n/cs'
import { en } from '../../cloud/app/i18n/en'
import { STEP_IDS } from '../../cloud/shared/steps'
import { FIELD_IDS, FIELDS, fieldsOf, hasLookChoice, lookOf, measuredLooks, pictureLooks, pictureOf, templateById, TEMPLATES, visibleTemplates, wordmarkOf } from '../../cloud/shared/templates'
import { looks as photographerLooks } from '../../templates/photographer/looks'
import { repoRoot } from '../setup/database'

// The templates a hosted website can start from: two that exist, nineteen that are planned
// (designed and approved, not built).
const READY = ['basic', 'photographer']
const PLANNED = [
  'individual', 'wedding', 'realty', 'restaurant', 'sports-club', 'trades', 'studio', 'development', 'accommodation',
  'office', 'salon', 'event', 'medical', 'car-service', 'construction', 'shop', 'association', 'blog', 'software',
]
const both = (pair: Record<string, string>, what: string) => {
  expect(Object.keys(pair).sort(), what).toEqual(['cs', 'en'])
  for (const [lang, text] of Object.entries(pair)) expect(text.trim().length, `${what} (${lang})`).toBeGreaterThan(0)
}

describe('the template registry', () => {
  it('holds twenty-one templates: the two ready ones and the nineteen planned', () => {
    expect(TEMPLATES).toHaveLength(21)
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual([...READY, ...PLANNED].sort())
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(21)
  })

  it('has exactly two templates a site can be made from today', () => {
    const ready = TEMPLATES.filter((t) => t.ready)
    expect(ready.map((t) => t.id)).toEqual(READY)
    for (const t of TEMPLATES.filter((t) => !t.ready)) {
      expect(t.sourceDir, t.id).toBeNull()
      expect(t.seed, t.id).toBe(false)
      // A planned template is shown as it was designed: at least one approved look, none with colours to write yet.
      expect(t.looks.length, t.id).toBeGreaterThanOrEqual(1)
      for (const look of t.looks) expect(look.colors, `${t.id}/${look.id}`).toBeUndefined()
    }
  })

  it('points a ready template at a real source folder with its seed', () => {
    for (const t of TEMPLATES.filter((t) => t.ready)) {
      expect(t.sourceDir, t.id).toBeTruthy()
      const dir = join(repoRoot, t.sourceDir!)
      expect(existsSync(join(dir, 'package.json')), `${dir}/package.json`).toBe(true)
      expect(existsSync(join(dir, 'nuxt.config.ts')), `${dir}/nuxt.config.ts`).toBe(true)
      if (t.seed) expect(existsSync(join(dir, 'seed', 'index.ts')), `${dir}/seed/index.ts`).toBe(true)
    }
  })

  it('writes every text in both languages', () => {
    for (const id of FIELD_IDS) both(FIELDS[id], `field ${id}`)
    for (const t of TEMPLATES) {
      both(t.name, `${t.id} name`)
      both(t.description, `${t.id} description`)
      expect(t.features.length, `${t.id} features`).toBeGreaterThanOrEqual(3)
      t.features.forEach((f, i) => both(f, `${t.id} feature ${i + 1}`))
      // One sentence, ending as one.
      for (const text of Object.values(t.description)) expect(/[.!?]$/.test(text), `${t.id}: ${text}`).toBe(true)
    }
  })

  it('gives every template a field of the filter and an animal that exists', () => {
    const animals = new Set(readdirSync(join(repoRoot, 'cloud/app/assets/brand/animals')).map((f) => f.replace(/\.svg$/, '')))
    for (const t of TEMPLATES) {
      expect(FIELD_IDS, t.id).toContain(t.field)
      expect(animals.has(t.animal), `${t.id}: ${t.animal}`).toBe(true)
    }
    // No two templates share an animal: each is recognisable in the gallery.
    expect(new Set(TEMPLATES.map((t) => t.animal)).size).toBe(TEMPLATES.length)
    // Every field of the filter has something in it.
    expect(fieldsOf(TEMPLATES)).toEqual([...FIELD_IDS])
  })

  it('keeps addresses and ids apart: an id is a plain lower-case word', () => {
    for (const t of TEMPLATES) expect(t.id).toMatch(/^[a-z]+(-[a-z]+)*$/)
  })

  it('shows a customer only what is ready, and the planned ones only when asked', () => {
    expect(visibleTemplates(false).map((t) => t.id)).toEqual(READY)
    expect(visibleTemplates(true)).toHaveLength(21)
    expect(fieldsOf(visibleTemplates(false))).toEqual(['general', 'personal'])
  })

  it('finds a template by its id', () => {
    expect(templateById('basic')?.ready).toBe(true)
    expect(templateById('restaurant')?.ready).toBe(false)
    expect(templateById('nope')).toBeNull()
    expect(templateById(null)).toBeNull()
  })
})

describe('the looks of a template', () => {
  it('are written in both languages, each with a picture that exists', () => {
    for (const t of TEMPLATES) {
      expect(new Set(t.looks.map((l) => l.id)).size, `${t.id}: look ids`).toBe(t.looks.length)
      for (const look of t.looks) {
        expect(look.id, `${t.id} look`).toMatch(/^[a-z]+(-[a-z]+)*$/)
        both(look.name, `${t.id}/${look.id} name`)
        both(look.description, `${t.id}/${look.id} description`)
        for (const text of Object.values(look.description)) expect(/[.!?]$/.test(text), `${t.id}/${look.id}: ${text}`).toBe(true)
      }
    }
  })

  it('are the looks the pictures were made for, in the same order and under the same names', () => {
    // scripts/template-pictures.mjs writes cloud/shared/template-pictures.json: for a planned
    // template the designs that are alive (with their names from notes.md), for a ready one
    // the looks it took from real sites.
    for (const t of TEMPLATES) {
      const found = measuredLooks(t.id)
      expect(found.map((l) => l.id), t.id).toEqual(pictureLooks(t).map((l) => l.id))
      if (!t.ready) expect(found.map((l) => l.name), t.id).toEqual(t.looks.map((l) => l.name.cs))
    }
    expect(TEMPLATES.reduce((n, t) => n + t.looks.length, 0)).toBe(52)
  })

  it('have their pictures: a card and a small one each, and for a ready template the first screen without a name and a tall one', () => {
    const file = (address: string) => join(repoRoot, 'cloud', 'public', address)
    for (const t of TEMPLATES) {
      for (const look of pictureLooks(t)) {
        for (const kind of t.ready ? ['card', 'thumb', 'top', 'tall'] as const : ['card', 'thumb'] as const) {
          expect(existsSync(file(pictureOf(t.id, look.id, kind))), pictureOf(t.id, look.id, kind)).toBe(true)
        }
      }
    }
    expect(pictureOf('basic', null, 'card')).toBe('/templates/basic/basic-card.webp')
    expect(pictureOf('photographer', 'negativ', 'tall')).toBe('/templates/photographer/negativ-tall.webp')
  })

  it('know where a ready template writes the site\'s name, with the typeface\'s files', () => {
    const file = (address: string) => join(repoRoot, 'cloud', 'public', address)
    for (const t of TEMPLATES.filter((t) => t.ready)) {
      for (const look of pictureLooks(t)) {
        const w = wordmarkOf(t.id, look.id)!
        expect(w, `${t.id}/${look.id}`).toBeTruthy()
        expect(w.size, `${t.id}/${look.id}`).toBeGreaterThan(8)
        expect(w.x).toBeGreaterThanOrEqual(0)
        expect(w.x).toBeLessThan(1440)
        expect(w.y).toBeLessThan(200)
        expect(w.fonts.length, `${t.id}/${look.id} fonts`).toBeGreaterThan(0)
        for (const font of w.fonts) expect(existsSync(file(font.src)), font.src).toBe(true)
      }
    }
    // A template with one unnamed design is found without a look; a planned one has no measure.
    expect(wordmarkOf('basic', null)?.family).toBe('Inter')
    expect(wordmarkOf('photographer', 'atelier')?.anchor).toBe('center')
    expect(wordmarkOf('restaurant', 'salon')).toBeNull()
    expect(wordmarkOf(null, null)).toBeNull()
  })

  it('are the ones the template itself lists, in its order, with its default colours', () => {
    // templates/photographer/looks.ts is what the site reads; the cloud writes these ids into its settings.
    const photographer = templateById('photographer')!
    expect(photographer.looks.map((l) => l.id)).toEqual([...photographerLooks.ids])
    for (const look of photographer.looks) {
      const own = photographerLooks.all.find((l) => l.id === look.id)!
      expect(look.colors, look.id).toBe(own.presets[0].id as string)
      expect(look.name, look.id).toEqual(own.name)
    }
  })

  it('offer a choice only when there is more than one', () => {
    expect(hasLookChoice(templateById('photographer'))).toBe(true)
    expect(hasLookChoice(templateById('basic'))).toBe(false)
    expect(hasLookChoice(null)).toBe(false)
  })

  it('fall back to the template\'s first look, and to none for a template without looks', () => {
    const photographer = templateById('photographer')
    expect(lookOf(photographer, 'negativ')?.id).toBe('negativ')
    expect(lookOf(photographer, 'nope')?.id).toBe('atelier')
    expect(lookOf(photographer, null)?.id).toBe('atelier')
    expect(lookOf(templateById('basic'), 'atelier')).toBeNull()
    expect(lookOf(null, 'atelier')).toBeNull()
  })

  it('resolve on the site as they were chosen: colours of another look give way to the look\'s own', () => {
    expect(photographerLooks.resolve('negativ', 'salvej').preset.id).toBe('salvej')
    expect(photographerLooks.resolve('negativ', 'bronz').preset.id).toBe('mosaz')
    expect(photographerLooks.resolve('nope', null).look.id).toBe('atelier')
    expect(photographerLooks.resolve('zapisnik', 'jedle').style).toBe('--brand:#34604e;--brand-ink:#ffffff;--paper:#f6f6f3;--tint:#e2e9e3;--ink:#19211d')
    // Every preset of a look sets the same variables: switching colours never leaves one behind.
    for (const look of photographerLooks.all) {
      const keys = (vars: object) => Object.keys(vars).sort().join()
      for (const preset of look.presets) expect(keys(preset.vars), `${look.id}/${preset.id}`).toBe(keys(look.presets[0].vars))
    }
    expect(new Set(photographerLooks.presetIds).size).toBe(photographerLooks.presetIds.length)
  })
})

describe('the pages\' texts', () => {
  it('exist in Czech and English under the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(cs).sort())
    for (const [key, text] of [...Object.entries(cs), ...Object.entries(en)]) expect(text.trim().length, key).toBeGreaterThan(0)
  })

  it('use the same placeholders in both languages', () => {
    const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join()
    for (const key of Object.keys(cs) as (keyof typeof cs)[]) expect(holes(en[key]), key).toBe(holes(cs[key]))
  })

  it('have words for every step, and for every reason a step can fail with', () => {
    for (const id of STEP_IDS) {
      expect(cs, id).toHaveProperty([`build.step.${id}`])
      expect(cs, id).toHaveProperty([`build.doing.${id}`])
    }
    // Every `new HostingError('code', …)` and `new StepError('code', …)` in the server has its sentence.
    const sources = ['server/hosting/local.ts', 'server/hosting/pushbase.ts', 'server/utils/provision.ts'].map((f) => readFileSync(join(repoRoot, 'cloud', f), 'utf8')).join('\n')
    const codes = new Set([...sources.matchAll(/new (?:HostingError|StepError)\('([a-z_]+)'/g)].map((m) => m[1]!))
    expect(codes.size).toBeGreaterThan(5)
    // Removal on Pushbase is not a step of making a site: it has no sentence on the "being made" screen.
    codes.delete('remove_unsupported')
    for (const code of codes) expect(cs, code).toHaveProperty([`fail.${code}`])
  })

  it('never mention how the product was built, compare it with others, or promise', () => {
    const banned = /\b(AI|umělá inteligence|umělou inteligencí|artificial intelligence|AI agents?|slibujeme|zvažujeme|brzy|coming soon|we promise|wordpress|wix|webnode)\b/
    for (const [key, text] of [...Object.entries(cs), ...Object.entries(en)]) expect(banned.test(text), `${key}: ${text}`).toBe(false)
    for (const t of TEMPLATES) {
      const texts = [t.name, t.description, ...t.features, ...t.looks.flatMap((l) => [l.name, l.description])].flatMap((pair) => Object.values(pair))
      for (const text of texts) expect(banned.test(text), text).toBe(false)
    }
  })
})
