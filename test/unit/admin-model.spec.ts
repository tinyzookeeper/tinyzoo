import { describe, expect, it } from 'vitest'
import { applyModelOps, emptyModelDoc, MODEL_PURGE_AFTER_MS, MODEL_PURGE_EMPTY_AFTER_MS, type ModelDoc, type ModelOp } from '../../packages/cms/src/model-doc'
import en from '../../packages/cms/app/i18n/en'
import {
  CMS_MODEL_ICONS, CMS_MODEL_KINDS, cmsModelCanRequire, cmsModelFields, cmsModelHiddenFields, cmsModelHiddenTypes, cmsModelKindIcon, cmsModelKindOf,
  cmsModelNewType, cmsModelNoteText, cmsModelNotesText, cmsModelProblem, cmsModelPurgeAt, cmsModelStarterLabel, cmsModelTakenPrefixes,
  cmsModelTakenTypeNames, cmsModelVisibleTypes, cmsSheetUi,
} from '../../packages/cms/app/utils/cmsModel'

// A fake translator: the key and the parameters, so a test sees which sentence was chosen.
const t = (key: string, params?: Record<string, any>) => (params ? `${key} ${JSON.stringify(params)}` : key)
const ctxOf = (doc: ModelDoc, design: { name: string }[] = [], locale = 'cs') => ({ doc, design, locale })
const state = (extra: Record<string, any> = {}) => ({ plural: 'Kurzy', singular: 'Kurz', icon: 'i-lucide-graduation-cap', pages: true, prefix: '', drafts: true, starters: [] as any[], ...extra })
const limits = { types: 12, fields: 30, options: 30 }
const apply = (doc: ModelDoc, ops: ModelOp[]) => applyModelOps(doc, ops, { design: [], limits, now: new Date(), counts: { entries: {} } }).doc
const refusal = (code: string, extra: Record<string, any> = {}, status = 422) => ({ statusCode: status, data: { statusCode: status, data: { code, message: 'English words', ...extra } } })

describe('sheet and icons', () => {
  it('is a full sheet on a phone and keeps the width on a larger screen', () => {
    expect(cmsSheetUi().content.startsWith('sm:max-w-xl ')).toBe(true)
    expect(cmsSheetUi('sm:max-w-2xl').content).toContain('max-sm:h-dvh')
    expect(cmsSheetUi().content).toContain('max-sm:translate-x-0')
  })

  it('offers about two dozen different lucide icons', () => {
    expect(CMS_MODEL_ICONS.length).toBe(24)
    expect(new Set(CMS_MODEL_ICONS).size).toBe(24)
    for (const icon of CMS_MODEL_ICONS) expect(icon).toMatch(/^i-lucide-[a-z-]+$/)
  })

  it('has a name for every icon in the catalogue', () => {
    for (const icon of CMS_MODEL_ICONS) {
      const key = icon.replace(/^i-lucide-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      expect((en.model.icons as Record<string, string>)[key], icon).toBeTruthy()
    }
  })
})

describe('kinds of field', () => {
  it('has the twelve tiles, each with its texts', () => {
    expect(CMS_MODEL_KINDS.map((k) => k.id)).toEqual(['text', 'longtext', 'richtext', 'number', 'boolean', 'datetime', 'select', 'media', 'file', 'gallery', 'color', 'relation'])
    for (const k of CMS_MODEL_KINDS) {
      const text = (en.model.kinds as Record<string, { name: string; hint: string }>)[k.id]
      expect(text?.name, k.id).toBeTruthy()
      expect(text?.hint, k.id).toBeTruthy()
    }
  })

  it('tells the kind of a field, a long text apart from a short one', () => {
    expect(cmsModelKindOf({ type: 'text' })).toBe('text')
    expect(cmsModelKindOf({ type: 'text', long: true })).toBe('longtext')
    expect(cmsModelKindOf({ type: 'select' })).toBe('select')
    expect(cmsModelKindOf({ type: 'relation' })).toBe('relation')
    expect(cmsModelKindIcon('media')).toBe('i-lucide-image')
  })

  it('never requires a picture, a file, a gallery, a switch or a link', () => {
    for (const id of ['media', 'file', 'gallery', 'boolean', 'relation'] as const) expect(cmsModelCanRequire(id), id).toBe(false)
    for (const id of ['text', 'longtext', 'richtext', 'number', 'datetime', 'select', 'color'] as const) expect(cmsModelCanRequire(id), id).toBe(true)
  })
})

describe('reading the document', () => {
  const doc = apply(emptyModelDoc(), [
    { op: 'type.add', name: 'x_a', label: { cs: 'A' } },
    { op: 'type.add', name: 'x_b', label: { cs: 'B' } },
    { op: 'field.add', type: 'x_a', field: { type: 'text', key: 'one', label: { cs: 'Jedna' } } },
    { op: 'field.add', type: 'x_a', field: { type: 'text', key: 'two', label: { cs: 'Dvě' } } },
    { op: 'field.remove', type: 'x_a', key: 'two' },
    { op: 'type.remove', type: 'x_b' },
  ])

  it('splits visible and hidden types, and fields', () => {
    expect(cmsModelVisibleTypes(doc).map((x) => x.name)).toEqual(['x_a'])
    expect(cmsModelHiddenTypes(doc).map((x) => x.name)).toEqual(['x_b'])
    const a = doc.types[0]!
    expect(cmsModelFields(a).map((f) => f.key)).toEqual(['title', 'one'])
    expect(cmsModelHiddenFields(a).map((f) => f.key)).toEqual(['two'])
  })
})

describe('when a hidden thing is deleted', () => {
  const at = '2026-11-01T10:00:00.000Z'
  it('adds the long wait, or the short one for something that held nothing', () => {
    expect(cmsModelPurgeAt({ removedAt: at })?.getTime()).toBe(Date.parse(at) + MODEL_PURGE_AFTER_MS)
    expect(cmsModelPurgeAt({ removedAt: at, removedEmpty: false })?.getTime()).toBe(Date.parse(at) + MODEL_PURGE_AFTER_MS)
    expect(cmsModelPurgeAt({ removedAt: at, removedEmpty: true })?.getTime()).toBe(Date.parse(at) + MODEL_PURGE_EMPTY_AFTER_MS)
  })
  it('says nothing for what is not hidden or has a broken date', () => {
    expect(cmsModelPurgeAt({})).toBeNull()
    expect(cmsModelPurgeAt({ removedAt: null })).toBeNull()
    expect(cmsModelPurgeAt({ removedAt: 'soon' })).toBeNull()
  })
})

describe('names that are taken', () => {
  const doc = apply(emptyModelDoc(), [
    { op: 'type.add', name: 'x_kurzy', label: { cs: 'Kurzy' }, page: { prefix: 'kurzy' } },
    { op: 'field.add', type: 'x_kurzy', field: { type: 'select', key: 'level', label: { cs: 'Úroveň' }, options: [{ label: { cs: 'Základní' } }] } },
    { op: 'type.add', name: 'x_old', label: { cs: 'Staré' }, page: { prefix: 'stare' } },
    { op: 'type.remove', type: 'x_old' },
  ])

  it('lists the types, hidden too, the design, and the database type of each choice', () => {
    const names = cmsModelTakenTypeNames(doc, [{ name: 'article' }])
    expect(names).toEqual(expect.arrayContaining(['x_kurzy', 'x_old', 'article', 'x_kurzy_level']))
  })

  it('lists the page prefixes, hidden types too', () => {
    expect(cmsModelTakenPrefixes(doc).sort()).toEqual(['kurzy', 'stare'])
  })
})

describe('the operations of a new type', () => {
  const empty = emptyModelDoc()

  it('makes a type with pages and drafts in the admin language, and the document accepts it', () => {
    const { name, ops } = cmsModelNewType(state(), ctxOf(empty))
    expect(name).toBe('x_kurzy')
    expect(ops).toEqual([{ op: 'type.add', name: 'x_kurzy', label: { cs: 'Kurzy' }, labelSingular: { cs: 'Kurz' }, icon: 'i-lucide-graduation-cap', page: { prefix: 'kurzy' }, publish: true }])
    expect(apply(empty, ops).types[0]!.page?.prefix).toBe('kurzy')
  })

  it('takes a label with accents and a typed address', () => {
    const { name, ops } = cmsModelNewType(state({ plural: 'Školení a kurzy', prefix: 'skoleni' }), ctxOf(empty))
    expect(name).toBe('x_skoleni_a_kurzy')
    expect(ops[0]).toMatchObject({ label: { cs: 'Školení a kurzy' }, page: { prefix: 'skoleni' } })
  })

  it('leaves out the page, the singular and the icon when they are not given', () => {
    const { ops } = cmsModelNewType(state({ pages: false, singular: '  ', icon: null, drafts: false }), ctxOf(empty, [], 'en'))
    expect(ops).toEqual([{ op: 'type.add', name: 'x_kurzy', label: { en: 'Kurzy' }, page: null, publish: false }])
  })

  it('numbers a name and an address that are taken', () => {
    const doc = apply(empty, [{ op: 'type.add', name: 'x_kurzy', label: { cs: 'Kurzy' }, page: { prefix: 'kurzy' } }])
    const { name, ops } = cmsModelNewType(state(), ctxOf(doc, [{ name: 'x_kurzy2' }]))
    expect(name).toBe('x_kurzy3')
    expect(ops[0]).toMatchObject({ page: { prefix: 'kurzy-2' } })
  })

  it('does not take the name of a choice list', () => {
    const doc = apply(empty, [
      { op: 'type.add', name: 'x_a', label: { cs: 'A' } },
      { op: 'field.add', type: 'x_a', field: { type: 'select', key: 'b', label: { cs: 'B' }, options: [{ label: { cs: 'jedna' } }] } },
    ])
    expect(cmsModelNewType(state({ plural: 'A b' }), ctxOf(doc)).name).toBe('x_a_b2')
  })

  it('adds the starters as fields in all three languages and points the page at them', () => {
    const { name, ops } = cmsModelNewType(state({ starters: ['date', 'picture', 'summary', 'text'] }), ctxOf(empty))
    expect(ops.map((o) => o.op)).toEqual(['type.add', 'field.add', 'field.add', 'field.add', 'field.add', 'type.update'])
    const fields = ops.filter((o): o is Extract<ModelOp, { op: 'field.add' }> => o.op === 'field.add')
    expect(fields.map((o) => [o.field.key, o.field.type])).toEqual([['obrazek', 'media'], ['kratkyPopis', 'text'], ['text', 'richtext'], ['datum', 'datetime']])
    expect(fields[1]!.field).toMatchObject({ long: true })
    expect(fields[0]!.field.label).toEqual({ cs: 'Obrázek', en: 'Picture', de: 'Bild' })
    expect(ops.at(-1)).toEqual({ op: 'type.update', type: name, page: { image: 'obrazek', summary: 'kratkyPopis' } })
    const made = apply(empty, ops).types[0]!
    expect(made.fields.map((f) => f.key)).toEqual(['title', 'obrazek', 'kratkyPopis', 'text', 'datum'])
    expect(made.page).toMatchObject({ image: 'obrazek', summary: 'kratkyPopis' })
  })

  it('names the keys after the language of the admin', () => {
    const { ops } = cmsModelNewType(state({ starters: ['picture'] }), ctxOf(empty, [], 'en'))
    expect(ops[1]).toMatchObject({ field: { key: 'picture' } })
  })

  it('updates the page only with what was ticked, and not at all without pages', () => {
    expect(cmsModelNewType(state({ starters: ['picture'] }), ctxOf(empty)).ops.at(-1)).toEqual({ op: 'type.update', type: 'x_kurzy', page: { image: 'obrazek' } })
    expect(cmsModelNewType(state({ starters: ['summary'] }), ctxOf(empty)).ops.at(-1)).toEqual({ op: 'type.update', type: 'x_kurzy', page: { summary: 'kratkyPopis' } })
    expect(cmsModelNewType(state({ starters: ['text', 'date'] }), ctxOf(empty)).ops.map((o) => o.op)).not.toContain('type.update')
    expect(cmsModelNewType(state({ pages: false, starters: ['picture', 'summary'] }), ctxOf(empty)).ops.map((o) => o.op)).toEqual(['type.add', 'field.add', 'field.add'])
  })

  it('keeps a starter key off the title', () => {
    const { ops } = cmsModelNewType(state({ starters: ['text'] }), { ...ctxOf(empty), starterLabel: () => ({ cs: 'Title' }) })
    expect(ops[1]).toMatchObject({ field: { key: 'title2' } })
  })

  it('has the starter labels in the three catalogues', () => {
    expect(cmsModelStarterLabel('summary')).toEqual({ cs: 'Krátký popis', en: 'Short description', de: 'Kurzbeschreibung' })
  })
})

describe('a refusal in words', () => {
  const newType = cmsModelNewType(state({ starters: ['picture'] }), ctxOf(emptyModelDoc())).ops
  const fieldOps: ModelOp[] = [{ op: 'field.add', type: 'x_a', field: { type: 'text', key: 'one', label: { cs: 'Jedna' } } }]

  it('names the form field a refusal is about', () => {
    const at = (code: string, ops: ModelOp[] = fieldOps, extra: Record<string, any> = {}) => cmsModelProblem(refusal(code, { op: 0, ...extra }), t, ops).at
    expect(at('invalid-label')).toBe('label')
    expect(at('limit-label')).toBe('label')
    expect(at('limit-help')).toBe('help')
    expect(at('invalid-prefix', newType)).toBe('prefix')
    expect(at('prefix-taken', newType)).toBe('prefix')
    expect(at('limit-options')).toBe('options')
    expect(at('invalid-option')).toBe('options')
    expect(at('last-option')).toBe('options')
    expect(at('needs-optional')).toBe('required')
    expect(at('has-missing-values')).toBe('required')
    expect(at('unknown-target')).toBe('to')
    expect(at('target-hidden')).toBe('to')
    expect(at('invalid-icon', newType)).toBe('icon')
  })

  it('says a taken name is about the label of a new type and the key of a field', () => {
    for (const code of ['invalid-name', 'reserved-key', 'name-taken', 'name-clash']) {
      expect(cmsModelProblem(refusal(code, { op: 0 }), t, newType).at, code).toBe('label')
      expect(cmsModelProblem(refusal(code, { op: 0 }), t, fieldOps).at, code).toBe('key')
    }
  })

  it('leaves the rest to the dialog', () => {
    for (const code of ['limit-types', 'limit-fields', 'title-field', 'system-field', 'order-manual', 'not-allowed', 'points-at-type']) {
      const p = cmsModelProblem(refusal(code, { op: 0 }), t, fieldOps)
      expect(p.at, code).toBeNull()
      expect(p.kind).toBe('refused')
      expect(p.text).toMatch(/^model\.errors\./)
    }
  })

  it('never shows the server’s English words', () => {
    const p = cmsModelProblem(refusal('name-taken', { op: 0 }), t, fieldOps)
    expect(p.text).toBe('model.errors.nameTaken')
    expect(p.text).not.toContain('English')
  })

  it('counts the entries that block a required field', () => {
    expect(cmsModelProblem(refusal('has-missing-values', { op: 0, details: { missing: 4 } }), t)).toMatchObject({ missing: 4, text: 'model.errors.hasMissingValues {"count":4}' })
    expect(cmsModelProblem(refusal('has-missing-values', { op: 0, details: { missing: null } }), t)).toMatchObject({ text: 'model.errors.hasMissingValuesSome' })
  })

  it('gives the limit with a long label', () => {
    expect(cmsModelProblem(refusal('limit-label', { op: 0 }), t).text).toBe('model.errors.limitLabel {"max":80}')
  })

  it('hands over the fields that point at a type', () => {
    const fields = [{ type: 'x_b', key: 'course' }]
    expect(cmsModelProblem(refusal('points-at-type', { op: 0, details: { fields } }), t).fields).toEqual(fields)
  })

  it('reads a stale version, a busy site and a place in use', () => {
    expect(cmsModelProblem(refusal('stale-version', { version: 7 }, 409), t)).toMatchObject({ kind: 'stale', text: 'model.errors.staleVersion', at: null })
    expect(cmsModelProblem({ statusCode: 503, data: { data: { code: 'busy' } } }, t)).toMatchObject({ kind: 'busy', text: 'model.errors.busy' })
    const places = [{ entity: 'page', id: '1', title: 'Home', field: 'body', block: null, locale: null, admin: '/admin/page/1' }]
    expect(cmsModelProblem(refusal('in-use', { places }, 409), t)).toMatchObject({ kind: 'in-use', places })
  })

  it('reads an answer without the outer layer too', () => {
    expect(cmsModelProblem({ statusCode: 422, data: { code: 'prefix-taken', op: 0 } }, t, newType)).toMatchObject({ code: 'prefix-taken', at: 'prefix' })
  })

  it('falls back to the general request errors without a known code', () => {
    expect(cmsModelProblem({ statusCode: 403 }, t)).toMatchObject({ kind: 'other', text: 'errors.forbidden' })
    expect(cmsModelProblem({}, t)).toMatchObject({ kind: 'other', text: 'errors.offline' })
    expect(cmsModelProblem(refusal('something-new'), t)).toMatchObject({ kind: 'other', text: 'errors.invalid' })
  })

  it('has a text in the catalogue for every code it can answer', () => {
    const errors = en.model.errors as Record<string, unknown>
    const codes = [
      'limit-types', 'limit-fields', 'limit-options', 'limit-label', 'limit-help', 'limit-size', 'invalid-label', 'invalid-name', 'reserved-key', 'name-taken', 'name-clash',
      'invalid-prefix', 'prefix-taken', 'needs-optional', 'has-missing-values', 'invalid-option', 'last-option', 'unknown-target', 'target-hidden', 'title-field', 'system-field',
      'order-manual', 'points-at-type', 'in-use', 'stale-version', 'busy', 'not-allowed', 'invalid-icon', 'unknown-type', 'type-hidden', 'unknown-field', 'already-removed',
      'not-removed', 'invalid-op', 'not-changeable', 'design-type', 'no-page', 'invalid-doc', 'invalid-request', 'internal-only', 'not-due',
    ]
    for (const code of codes) {
      const text = cmsModelProblem(refusal(code, { op: 0 }, code === 'stale-version' || code === 'in-use' ? 409 : 422), (key, params) => {
        const path = key.replace(/^model\.errors\./, '')
        expect(errors[path], `${code}: ${key}`).toBeTruthy()
        return params ? `${key} ${JSON.stringify(params)}` : key
      })
      expect(text.kind, code).not.toBe('other')
    }
  })
})

describe('what a change made safe', () => {
  it('says each kind of note in words', () => {
    for (const code of ['list-column-cleared', 'order-cleared', 'page-image-cleared', 'page-summary-cleared', 'default-cleared', 'restored-optional']) {
      expect(cmsModelNoteText({ code }, t), code).toMatch(/^model\.notes\./)
    }
    expect(cmsModelNoteText({ code: 'unknown' }, t)).toBe('')
  })

  it('joins the notes of a change, each sentence once', () => {
    expect(cmsModelNotesText([{ code: 'order-cleared' }, { code: 'order-cleared' }, { code: 'nope' }, { code: 'default-cleared' }], t)).toBe('model.notes.orderCleared model.notes.defaultCleared')
  })
})
