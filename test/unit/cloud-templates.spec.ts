import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cs } from '../../cloud/app/i18n/cs'
import { en } from '../../cloud/app/i18n/en'
import { STEP_IDS } from '../../cloud/shared/steps'
import { FIELD_IDS, FIELDS, fieldsOf, templateById, TEMPLATES, visibleTemplates } from '../../cloud/shared/templates'
import { repoRoot } from '../setup/database'

// The templates a hosted website can start from: one that exists, twenty that are planned.
const PLANNED = [
  'individual', 'photographer', 'wedding', 'realty', 'restaurant', 'sports-club', 'trades', 'studio', 'development', 'accommodation',
  'office', 'salon', 'event', 'medical', 'car-service', 'construction', 'shop', 'association', 'blog', 'software',
]
const both = (pair: Record<string, string>, what: string) => {
  expect(Object.keys(pair).sort(), what).toEqual(['cs', 'en'])
  for (const [lang, text] of Object.entries(pair)) expect(text.trim().length, `${what} (${lang})`).toBeGreaterThan(0)
}

describe('the template registry', () => {
  it('holds twenty-one templates: basic, and the twenty planned ones', () => {
    expect(TEMPLATES).toHaveLength(21)
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual(['basic', ...PLANNED].sort())
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(21)
  })

  it('has exactly one template a site can be made from today', () => {
    const ready = TEMPLATES.filter((t) => t.ready)
    expect(ready.map((t) => t.id)).toEqual(['basic'])
    for (const t of TEMPLATES.filter((t) => !t.ready)) {
      expect(t.sourceDir, t.id).toBeNull()
      expect(t.seed, t.id).toBe(false)
    }
  })

  it('points a ready template at a real source folder with its seed', () => {
    for (const t of TEMPLATES.filter((t) => t.ready)) {
      expect(t.sourceDir, t.id).toBeTruthy()
      const dir = join(repoRoot, t.sourceDir!)
      expect(existsSync(join(dir, 'package.json')), `${dir}/package.json`).toBe(true)
      expect(existsSync(join(dir, 'nuxt.config.ts')), `${dir}/nuxt.config.ts`).toBe(true)
      if (t.seed) expect(existsSync(join(dir, 'seed', 'index.ts')), `${dir}/seed/index.ts`).toBe(true)
      if (t.preview) expect(existsSync(join(repoRoot, 'cloud', 'public', t.preview)), t.preview).toBe(true)
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
    expect(visibleTemplates(false).map((t) => t.id)).toEqual(['basic'])
    expect(visibleTemplates(true)).toHaveLength(21)
    expect(fieldsOf(visibleTemplates(false))).toEqual(['general'])
  })

  it('finds a template by its id', () => {
    expect(templateById('basic')?.ready).toBe(true)
    expect(templateById('restaurant')?.ready).toBe(false)
    expect(templateById('nope')).toBeNull()
    expect(templateById(null)).toBeNull()
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
    for (const t of TEMPLATES) for (const text of [...Object.values(t.name), ...Object.values(t.description)]) expect(banned.test(text), text).toBe(false)
  })
})
