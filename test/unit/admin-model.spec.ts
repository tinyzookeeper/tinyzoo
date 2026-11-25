import { describe, expect, it } from 'vitest'
import { applyModelOps, emptyModelDoc, MODEL_PURGE_EMPTY_AFTER_MS, type ModelDoc, type ModelOp } from '../../packages/cms/src/model-doc'
import en from '../../packages/cms/app/i18n/en'
import {
  CMS_MODEL_ICONS, CMS_MODEL_KINDS, cmsModelCanRequire, cmsModelFields, cmsModelHiddenFields, cmsModelHiddenTypes, cmsModelKindIcon, cmsModelKindOf,
  cmsModelNewType, cmsModelNoteText, cmsModelNotesText, cmsModelProblem, cmsModelPurgeAt, cmsModelStarterLabel, cmsModelTakenPrefixes,
  cmsModelTakenTypeNames, cmsModelVisibleTypes, cmsSheetUi,
  cmsModelAddOptionRow, cmsModelBlankForm, cmsModelColumnChoices, cmsModelDayText, cmsModelDesignKind, cmsModelFieldAddOp, cmsModelFieldCheck, cmsModelFieldParts,
  cmsModelFieldRefs, cmsModelFieldUpdateOp, cmsModelFormOf, cmsModelMoveKey, cmsModelMoveKeyTo, cmsModelNewFieldKey, cmsModelOrderFields, cmsModelOrderOp,
  cmsModelParseNumber, cmsModelPointingAt, cmsModelPreset, cmsModelPurgeFromNow, cmsModelRemovedLine, cmsModelRemoveOp, cmsModelRemoveOptionRow,
  cmsModelRestoreOptionRow, cmsModelSameKeys, cmsModelSettingsCheck, cmsModelSettingsFormOf, cmsModelSettingsOp, cmsModelUsageCount,
  cmsModelDeleteNeedsName, cmsModelFieldsAtLimit, cmsModelFieldsUsed, cmsModelNameMatches, cmsModelPurgeBlockers, cmsModelPurgeOp, cmsModelSecondsLeft, cmsModelTypesAtLimit,
  cmsModelCodeRefusalText, cmsModelCodeRow, cmsModelListText, cmsModelMisfitList, cmsModelMisfitName,
  type CmsModelCodeBreak, type CmsModelCodeRegistration,
} from '../../packages/cms/app/utils/cmsModel'
import cs from '../../packages/cms/app/i18n/cs'
import de from '../../packages/cms/app/i18n/de'

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
    { op: 'type.add', name: 'custom_a', label: { cs: 'A' } },
    { op: 'type.add', name: 'custom_b', label: { cs: 'B' } },
    { op: 'field.add', type: 'custom_a', field: { type: 'text', key: 'one', label: { cs: 'Jedna' } } },
    { op: 'field.add', type: 'custom_a', field: { type: 'text', key: 'two', label: { cs: 'Dvě' } } },
    { op: 'field.remove', type: 'custom_a', key: 'two' },
    { op: 'type.remove', type: 'custom_b' },
  ])

  it('splits visible and hidden types, and fields', () => {
    expect(cmsModelVisibleTypes(doc).map((x) => x.name)).toEqual(['custom_a'])
    expect(cmsModelHiddenTypes(doc).map((x) => x.name)).toEqual(['custom_b'])
    const a = doc.types[0]!
    expect(cmsModelFields(a).map((f) => f.key)).toEqual(['title', 'one'])
    expect(cmsModelHiddenFields(a).map((f) => f.key)).toEqual(['two'])
  })
})

describe('when a hidden thing is deleted', () => {
  const at = '2026-11-01T10:00:00.000Z'
  it('adds the hour for something that held nothing, and says nothing for the rest', () => {
    expect(cmsModelPurgeAt({ removedAt: at })).toBeNull()
    expect(cmsModelPurgeAt({ removedAt: at, removedEmpty: false })).toBeNull()
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
    { op: 'type.add', name: 'custom_kurzy', label: { cs: 'Kurzy' }, page: { prefix: 'kurzy' } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'select', key: 'level', label: { cs: 'Úroveň' }, options: [{ label: { cs: 'Základní' } }] } },
    { op: 'type.add', name: 'custom_old', label: { cs: 'Staré' }, page: { prefix: 'stare' } },
    { op: 'type.remove', type: 'custom_old' },
  ])

  it('lists the types, hidden too, the design, and the database type of each choice', () => {
    const names = cmsModelTakenTypeNames(doc, [{ name: 'article' }])
    expect(names).toEqual(expect.arrayContaining(['custom_kurzy', 'custom_old', 'article', 'custom_kurzy_level']))
  })

  it('lists the page prefixes, hidden types too', () => {
    expect(cmsModelTakenPrefixes(doc).sort()).toEqual(['kurzy', 'stare'])
  })
})

describe('the operations of a new type', () => {
  const empty = emptyModelDoc()

  it('makes a type with pages and drafts in the admin language, and the document accepts it', () => {
    const { name, ops } = cmsModelNewType(state(), ctxOf(empty))
    expect(name).toBe('custom_kurzy')
    expect(ops).toEqual([{ op: 'type.add', name: 'custom_kurzy', label: { cs: 'Kurzy' }, labelSingular: { cs: 'Kurz' }, icon: 'i-lucide-graduation-cap', page: { prefix: 'kurzy' }, publish: true }])
    expect(apply(empty, ops).types[0]!.page?.prefix).toBe('kurzy')
  })

  it('takes a label with accents and a typed address', () => {
    const { name, ops } = cmsModelNewType(state({ plural: 'Školení a kurzy', prefix: 'skoleni' }), ctxOf(empty))
    expect(name).toBe('custom_skoleni_a_kurzy')
    expect(ops[0]).toMatchObject({ label: { cs: 'Školení a kurzy' }, page: { prefix: 'skoleni' } })
  })

  it('leaves out the page, the singular and the icon when they are not given', () => {
    const { ops } = cmsModelNewType(state({ pages: false, singular: '  ', icon: null, drafts: false }), ctxOf(empty, [], 'en'))
    expect(ops).toEqual([{ op: 'type.add', name: 'custom_kurzy', label: { en: 'Kurzy' }, page: null, publish: false }])
  })

  it('numbers a name and an address that are taken', () => {
    const doc = apply(empty, [{ op: 'type.add', name: 'custom_kurzy', label: { cs: 'Kurzy' }, page: { prefix: 'kurzy' } }])
    const { name, ops } = cmsModelNewType(state(), ctxOf(doc, [{ name: 'custom_kurzy2' }]))
    expect(name).toBe('custom_kurzy3')
    expect(ops[0]).toMatchObject({ page: { prefix: 'kurzy-2' } })
  })

  it('does not take the name of a choice list', () => {
    const doc = apply(empty, [
      { op: 'type.add', name: 'custom_a', label: { cs: 'A' } },
      { op: 'field.add', type: 'custom_a', field: { type: 'select', key: 'b', label: { cs: 'B' }, options: [{ label: { cs: 'jedna' } }] } },
    ])
    expect(cmsModelNewType(state({ plural: 'A b' }), ctxOf(doc)).name).toBe('custom_a_b2')
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
    expect(cmsModelNewType(state({ starters: ['picture'] }), ctxOf(empty)).ops.at(-1)).toEqual({ op: 'type.update', type: 'custom_kurzy', page: { image: 'obrazek' } })
    expect(cmsModelNewType(state({ starters: ['summary'] }), ctxOf(empty)).ops.at(-1)).toEqual({ op: 'type.update', type: 'custom_kurzy', page: { summary: 'kratkyPopis' } })
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
  const fieldOps: ModelOp[] = [{ op: 'field.add', type: 'custom_a', field: { type: 'text', key: 'one', label: { cs: 'Jedna' } } }]

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
    const fields = [{ type: 'custom_b', key: 'course' }]
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
      'not-removed', 'invalid-op', 'not-changeable', 'design-type', 'no-page', 'invalid-doc', 'invalid-request', 'not-due',
      'limit-removed-types', 'limit-removed-fields', 'too-soon',
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

// ── part 2: one type, its fields, settings and removing ──

const read = (label: any) => (label ? (Object.values(label)[0] as string) : '')
const withEntries = (doc: ModelDoc, entries: Record<string, number>, ops: ModelOp[]) =>
  applyModelOps(doc, ops, { design: [], limits, now: new Date(), counts: { entries, values: {}, missing: {} } }).doc
const base = () => apply(emptyModelDoc(), [{ op: 'type.add', name: 'custom_kurzy', label: { cs: 'Kurzy' }, page: { prefix: 'kurzy' }, publish: true }])
const formOf = (kind: Parameters<typeof cmsModelBlankForm>[0], extra: Record<string, any> = {}) => ({ ...cmsModelBlankForm(kind), label: 'Cena', ...extra })
const addField = (doc: ModelDoc, form: ReturnType<typeof formOf>, entries = 0) => {
  const op = cmsModelFieldAddOp('custom_kurzy', form, 'cs')
  return withEntries(doc, { custom_kurzy: entries }, [op]).types[0]!.fields.at(-1)!
}

describe('dates of a removed thing', () => {
  const fmt = (v: Date | string | number, o: Intl.DateTimeFormatOptions) => `${new Date(v).toISOString().slice(0, 16)} ${JSON.stringify(o)}`
  const now = new Date('2026-11-25T10:00:00Z')

  it('leaves the year out of a day in this year only', () => {
    expect(cmsModelDayText(new Date('2026-12-03T10:00:00Z'), { formatDateWith: fmt, now })).toContain('{"day":"numeric","month":"long"}')
    expect(cmsModelDayText(new Date('2027-01-03T10:00:00Z'), { formatDateWith: fmt, now })).toContain('"year":"numeric"')
  })

  it('says when the server deletes what was removed empty, and that the content of the rest is kept', () => {
    const ctx = { t, formatDateWith: fmt, now }
    // Removed empty: the time it is deleted at, always with the hour, a day or more away or not.
    expect(cmsModelRemovedLine({ removedAt: '2026-11-25T09:30:00Z', removedEmpty: true }, ctx)).toMatch(/^model\.deletedOnAt \{"date":.*"time":/)
    expect(cmsModelRemovedLine({ removedAt: '2026-11-20T09:30:00Z', removedEmpty: true }, ctx)).toMatch(/^model\.deletedOnAt/)
    // Removed with content (or not known to be empty): the day it was removed.
    expect(cmsModelRemovedLine({ removedAt: '2026-11-20T09:30:00Z' }, ctx)).toMatch(/^model\.removedOn \{"date":/)
    expect(cmsModelRemovedLine({ removedAt: '2026-11-20T09:30:00Z', removedEmpty: false }, ctx)).toMatch(/^model\.removedOn/)
    // Not removed, or a date that cannot be read: nothing.
    expect(cmsModelRemovedLine({}, ctx)).toBe('')
    expect(cmsModelRemovedLine({ removedAt: 'soon' }, ctx)).toBe('')
  })

  it('counts an hour from now for what is removed while it holds nothing', () => {
    expect(cmsModelPurgeFromNow(now).getTime() - now.getTime()).toBe(MODEL_PURGE_EMPTY_AFTER_MS)
  })
})

describe('deleting for good', () => {
  it('builds the operation for a type and for a field', () => {
    expect(cmsModelPurgeOp('custom_kurzy')).toEqual({ op: 'purge', types: ['custom_kurzy'] })
    expect(cmsModelPurgeOp('custom_kurzy', 'price')).toEqual({ op: 'purge', fields: [{ type: 'custom_kurzy', key: 'price' }] })
    expect(cmsModelPurgeOp('custom_kurzy', null)).toEqual({ op: 'purge', types: ['custom_kurzy'] })
  })

  it('compares the typed name with the label: case, spaces and the way an accent is typed do not matter', () => {
    expect(cmsModelNameMatches('Kurzy', 'Kurzy')).toBe(true)
    expect(cmsModelNameMatches('kurzy ', 'Kurzy')).toBe(true)
    expect(cmsModelNameMatches('  KURZY', 'Kurzy')).toBe(true)
    expect(cmsModelNameMatches('Nové  kurzy', 'Nové kurzy')).toBe(true)
    // "é" typed as e + combining accent
    expect(cmsModelNameMatches('Nove\u0301 kurzy', 'Nov\u00e9 kurzy')).toBe(true)
    expect(cmsModelNameMatches('Kurz', 'Kurzy')).toBe(false)
    expect(cmsModelNameMatches('Kur', 'Kurzy')).toBe(false)
    expect(cmsModelNameMatches('Nove kurzy', 'Nové kurzy')).toBe(false)
    expect(cmsModelNameMatches('', 'Kurzy')).toBe(false)
    expect(cmsModelNameMatches('   ', '')).toBe(false)
  })

  it('asks for the name when it holds something or that is not known, and not when it holds nothing', () => {
    expect(cmsModelDeleteNeedsName(0)).toBe(false)
    expect(cmsModelDeleteNeedsName(12)).toBe(true)
    expect(cmsModelDeleteNeedsName(null)).toBe(true)
    expect(cmsModelDeleteNeedsName(undefined)).toBe(true)
  })

  it('finds the fields that stop a type from being deleted: removed or not, of other types only', () => {
    const doc = apply(base(), [
      { op: 'type.add', name: 'custom_akce', label: { cs: 'Akce' } },
      { op: 'field.add', type: 'custom_akce', field: { type: 'relation', key: 'course', label: { cs: 'Kurz' }, to: 'custom_kurzy' } },
      { op: 'field.add', type: 'custom_kurzy', field: { type: 'relation', key: 'self', label: { cs: 'Související' }, to: 'custom_kurzy' } },
    ])
    expect(cmsModelPurgeBlockers(doc, 'custom_kurzy')).toEqual([{ type: 'custom_akce', key: 'course' }])
    const removed = apply(doc, [{ op: 'field.remove', type: 'custom_akce', key: 'course' }])
    expect(cmsModelPurgeBlockers(removed, 'custom_kurzy')).toEqual([{ type: 'custom_akce', key: 'course' }])
    expect(cmsModelPurgeBlockers(doc, 'custom_akce')).toEqual([])
  })

  it('says whole seconds, rounded up, and at least one', () => {
    expect(cmsModelSecondsLeft(1)).toBe(1)
    expect(cmsModelSecondsLeft(1000)).toBe(1)
    expect(cmsModelSecondsLeft(1001)).toBe(2)
    expect(cmsModelSecondsLeft(59_400)).toBe(60)
    expect(cmsModelSecondsLeft(0)).toBe(1)
    expect(cmsModelSecondsLeft(undefined)).toBe(1)
  })

  it('says a purge that came too soon, with the seconds left', () => {
    const p = cmsModelProblem(refusal('too-soon', { op: 0, details: { msLeft: 12_300 } }), t)
    expect(p).toMatchObject({ kind: 'refused', code: 'too-soon', secondsLeft: 13, text: 'model.errors.tooSoon {"count":13}' })
  })

  it('says the limits of removed things with the number the server names', () => {
    expect(cmsModelProblem(refusal('limit-removed-types', { op: 0, details: { limit: 12 } }), t).text).toBe('model.errors.limitRemovedTypes {"limit":12}')
    expect(cmsModelProblem(refusal('limit-removed-fields', { op: 0, details: { limit: 30 } }), t).text).toBe('model.errors.limitRemovedFields {"limit":30}')
  })

  it('leaves out the codes that only the server’s own sweep makes', () => {
    expect(cmsModelProblem(refusal('internal-only', { op: 0 }), t).kind).toBe('other')
  })

  it('has every sentence of the dialog in the catalogue, with its number', () => {
    const d = en.model.delete as Record<string, any>
    expect(d.typeEntries.other).toContain('{count}')
    expect(d.fieldValues.one).toContain('{count}')
    expect(en.model.errors.tooSoon.other).toContain('{count}')
    expect(en.model.errors.limitRemovedTypes).toContain('{limit}')
    expect(en.model.errors.limitRemovedFields).toContain('{limit}')
  })
})

describe('what counts toward the limits', () => {
  const doc = apply(base(), [
    { op: 'type.add', name: 'custom_akce', label: { cs: 'Akce' } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'text', key: 'a', label: { cs: 'A' } } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'text', key: 'b', label: { cs: 'B' } } },
    { op: 'field.remove', type: 'custom_kurzy', key: 'b' },
    { op: 'type.remove', type: 'custom_akce' },
  ])

  it('counts the visible fields only', () => {
    const type = doc.types.find((x) => x.name === 'custom_kurzy')!
    // title + a (b is removed)
    expect(cmsModelFieldsUsed(type)).toBe(2)
    expect(cmsModelFieldsAtLimit(type, 2)).toBe(true)
    expect(cmsModelFieldsAtLimit(type, 3)).toBe(false)
  })

  it('counts the visible types only', () => {
    expect(cmsModelTypesAtLimit(doc, 1)).toBe(true)
    expect(cmsModelTypesAtLimit(doc, 2)).toBe(false)
  })
})

describe('arranging the fields', () => {
  it('moves a key a step and keeps the list at either end', () => {
    expect(cmsModelMoveKey(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(cmsModelMoveKey(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    expect(cmsModelMoveKey(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(cmsModelMoveKey(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })

  it('moves a key to the place it is dragged to', () => {
    expect(cmsModelMoveKeyTo(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(cmsModelMoveKeyTo(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(cmsModelMoveKeyTo(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
    expect(cmsModelMoveKeyTo(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
    expect(cmsModelSameKeys(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(cmsModelSameKeys(['a', 'b'], ['b', 'a'])).toBe(false)
  })

  it('makes an order the server accepts', () => {
    let doc = apply(base(), [
      { op: 'field.add', type: 'custom_kurzy', field: { type: 'text', key: 'one', label: { cs: 'Jedna' } } },
      { op: 'field.add', type: 'custom_kurzy', field: { type: 'text', key: 'two', label: { cs: 'Dvě' } } },
    ])
    const keys = cmsModelMoveKey(cmsModelFields(doc.types[0]!).map((f) => f.key), 2, -1)
    doc = apply(doc, [cmsModelOrderOp('custom_kurzy', keys)])
    expect(cmsModelFields(doc.types[0]!).map((f) => f.key)).toEqual(['title', 'two', 'one'])
  })
})

describe('what a field row says', () => {
  const doc = withEntries(base(), { custom_kurzy: 0, custom_ucitele: 0 }, [
    { op: 'type.add', name: 'custom_ucitele', label: { cs: 'Učitelé' } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'select', key: 'level', label: { cs: 'Úroveň' }, required: true, options: [{ label: { cs: 'A' } }, { label: { cs: 'B' } }, { label: { cs: 'C' } }] } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'relation', key: 'teacher', label: { cs: 'Učitel' }, to: 'custom_ucitele' } },
    { op: 'field.update', type: 'custom_kurzy', key: 'level', removeOptions: ['c'] },
  ])
  const [title, level, teacher] = doc.types[0]!.fields as [any, any, any]
  const ctx = { t, isTitle: false, targetName: (to: string) => `«${to}»` }

  it('tells the kind, then what matters about it', () => {
    expect(cmsModelFieldParts(level, ctx)).toEqual(['model.kinds.select.name', 'model.field.requiredShort', 'model.field.choicesCount {"count":2}'])
    expect(cmsModelFieldParts(teacher, ctx)).toEqual(['model.kinds.relation.name', 'model.field.linksTo {"name":"«custom_ucitele»"}'])
    expect(cmsModelFieldParts(teacher, { ...ctx, places: 2 }).at(-1)).toBe('model.field.shownOn {"count":2}')
    expect(cmsModelFieldParts(teacher, { ...ctx, places: 0 })).toHaveLength(2)
  })

  it('says only that the title names every entry', () => {
    expect(cmsModelFieldParts(title, { ...ctx, isTitle: true })).toEqual(['model.kinds.text.name', 'model.field.namesEvery'])
  })

  it('counts a place once however often it shows the field', () => {
    expect(cmsModelUsageCount([{ id: 'a' }, { id: 'a' }, { id: 'b' }])).toBe(2)
    expect(cmsModelUsageCount(null)).toBe(0)
  })

  it('maps the design’s kinds to the tiles’ words and a few more', () => {
    expect(cmsModelDesignKind('text')).toEqual({ icon: 'i-lucide-type', key: 'model.kinds.text.name' })
    expect(cmsModelDesignKind('slug').key).toBe('model.designKinds.slug')
    expect(cmsModelDesignKind('blocks').key).toBe('model.designKinds.blocks')
    expect(cmsModelDesignKind('json').key).toBe('model.designKinds.misc')
    for (const kind of ['slug', 'blocks', 'list', 'group', 'misc']) expect((en.model.designKinds as Record<string, string>)[kind], kind).toBeTruthy()
  })
})

describe('the operation that adds a field', () => {
  it('adds each of the twelve kinds, as the server takes it', () => {
    let doc = base()
    const target = 'custom_kurzy'
    doc = apply(doc, [{ op: 'type.add', name: 'custom_ucitele', label: { cs: 'Učitelé' } }])
    for (const k of CMS_MODEL_KINDS) {
      const form = formOf(k.id, { key: `f${k.id}`, to: 'custom_ucitele', options: cmsModelAddOptionRow([], 'Jedna') })
      const op = cmsModelFieldAddOp(target, form, 'cs')
      doc = apply(doc, [op])
      const field = doc.types[0]!.fields.at(-1)!
      expect(field.type, k.id).toBe(k.type)
      expect(cmsModelKindOf(field), k.id).toBe(k.id)
    }
  })

  it('writes the label and the help in the admin’s language', () => {
    const op = cmsModelFieldAddOp('custom_kurzy', formOf('text', { help: ' Za celý kurz ' }), 'cs') as any
    expect(op.field.label).toEqual({ cs: 'Cena' })
    expect(op.field.help).toEqual({ cs: 'Za celý kurz' })
    expect((cmsModelFieldAddOp('custom_kurzy', formOf('text'), 'de') as any).field.label).toEqual({ de: 'Cena' })
    expect((cmsModelFieldAddOp('custom_kurzy', formOf('text'), 'cs') as any).field.help).toBeUndefined()
  })

  it('makes a long text and the formats of a short one', () => {
    expect(addField(base(), formOf('longtext'))).toMatchObject({ type: 'text', long: true })
    expect(addField(base(), formOf('text', { format: 'email' }))).toMatchObject({ type: 'text', format: 'email' })
    expect(addField(base(), formOf('text'))).not.toHaveProperty('format')
  })

  it('asks for what a number needs', () => {
    expect(addField(base(), formOf('number', { decimal: true, min: '0', max: '1000,5' }))).toMatchObject({ type: 'number', decimal: true, min: 0, max: 1000.5 })
    expect(addField(base(), formOf('number'))).not.toHaveProperty('decimal')
  })

  it('only requires what may be required, and never a field of entries that exist', () => {
    expect(addField(base(), formOf('text', { required: true }))).toMatchObject({ required: true })
    expect(addField(base(), formOf('media', { required: true }))).not.toHaveProperty('required')
    expect(addField(base(), formOf('boolean', { required: true, on: true }))).toMatchObject({ default: true })
    expect(() => addField(base(), formOf('text', { required: true }), 3)).toThrow()
  })

  it('makes a choice with its options and the one preselected', () => {
    let options = cmsModelAddOptionRow([], 'Začátečník')
    options = cmsModelAddOptionRow(options, 'Pokročilý')
    options = cmsModelAddOptionRow(options, 'Začátečník')
    const field = addField(base(), formOf('select', { options, preset: options[1]!.value })) as any
    expect(field.options.map((o: any) => o.label.cs)).toEqual(['Začátečník', 'Pokročilý', 'Začátečník'])
    expect(new Set(field.options.map((o: any) => o.value)).size).toBe(3)
    expect(field.default).toBe(field.options[1].value)
  })

  it('gives a key from the label that is free among the type’s fields', () => {
    const type = base().types[0]!
    expect(cmsModelNewFieldKey('Cena kurzu', type)).toBe('cenaKurzu')
    expect(cmsModelNewFieldKey('Title', type)).toBe('title2')
  })
})

describe('the choices of a field in the form', () => {
  const rows = cmsModelAddOptionRow(cmsModelAddOptionRow([], 'Jedna'), 'Dvě')

  it('adds nothing for an empty text and trims the rest', () => {
    expect(cmsModelAddOptionRow(rows, '   ')).toEqual(rows)
    expect(cmsModelAddOptionRow([], '  Tři ')[0]).toMatchObject({ label: 'Tři', isNew: true })
  })

  it('drops a choice made in the form and marks one that exists', () => {
    expect(cmsModelRemoveOptionRow(rows, rows[0]!.value).map((r) => r.label)).toEqual(['Dvě'])
    const existing = rows.map((r) => ({ ...r, isNew: false }))
    const marked = cmsModelRemoveOptionRow(existing, existing[0]!.value)
    expect(marked[0]).toMatchObject({ removed: true })
    expect(cmsModelRestoreOptionRow(marked, marked[0]!.value)[0]).toMatchObject({ removed: false })
  })

  it('does not preselect a choice that is not offered', () => {
    const existing = rows.map((r) => ({ ...r, isNew: false }))
    expect(cmsModelPreset({ options: existing, preset: existing[0]!.value })).toBe(existing[0]!.value)
    expect(cmsModelPreset({ options: cmsModelRemoveOptionRow(existing, existing[0]!.value), preset: existing[0]!.value })).toBe('')
  })
})

describe('checking the form of a field', () => {
  it('asks for a label, an option, a target and a sensible range', () => {
    expect(cmsModelFieldCheck(formOf('text', { label: ' ' }), t).label).toBe('model.validation.labelRequired')
    expect(cmsModelFieldCheck(formOf('select'), t).options).toBe('model.validation.optionsRequired')
    expect(cmsModelFieldCheck(formOf('select', { options: [{ ...cmsModelAddOptionRow([], 'A')[0]!, label: ' ' }] }), t).options).toBe('model.validation.optionEmpty')
    expect(cmsModelFieldCheck(formOf('relation'), t).to).toBe('model.validation.targetRequired')
    expect(cmsModelFieldCheck(formOf('number', { min: '5', max: '2' }), t).range).toBe('model.validation.rangeOrder')
    expect(cmsModelFieldCheck(formOf('number', { min: 'abc' }), t).range).toBe('model.validation.numberInvalid')
    expect(cmsModelFieldCheck(formOf('number', { min: '1', max: '2' }), t)).toEqual({})
    expect(cmsModelFieldCheck(formOf('media'), t)).toEqual({})
  })

  it('reads typed numbers', () => {
    expect(cmsModelParseNumber('')).toBeNull()
    expect(cmsModelParseNumber(' 2,5 ')).toBe(2.5)
    expect(cmsModelParseNumber('x')).toBeUndefined()
  })
})

describe('the operation that changes a field', () => {
  const doc = apply(base(), [
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'text', key: 'note', label: { cs: 'Poznámka' }, help: { cs: 'Stará' } } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'number', key: 'price', label: { cs: 'Cena' }, min: 0 } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'select', key: 'level', label: { cs: 'Úroveň' }, options: [{ label: { cs: 'A' } }, { label: { cs: 'B' } }, { label: { cs: 'C' } }], default: 'a' } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'media', key: 'photo', label: { cs: 'Fotka' } } },
    { op: 'field.update', type: 'custom_kurzy', key: 'level', removeOptions: ['c'] },
  ])
  const fieldOf = (key: string) => doc.types[0]!.fields.find((f) => f.key === key)!
  const update = (key: string, change: (form: any) => void) => {
    const field = fieldOf(key)
    const form = cmsModelFormOf(field, read)
    change(form)
    return cmsModelFieldUpdateOp('custom_kurzy', field, form, 'cs', read)
  }
  const run = (op: ModelOp | null) => withEntries(doc, { custom_kurzy: 0 }, op ? [op] : []).types[0]!

  it('sends nothing when nothing changed', () => {
    for (const key of ['note', 'price', 'level', 'photo', 'title']) expect(update(key, () => {}), key).toBeNull()
  })

  it('sends the label and help as the admin’s language, an empty help as null', () => {
    expect(update('note', (f) => { f.label = ' Nový název ' })).toEqual({ op: 'field.update', type: 'custom_kurzy', key: 'note', label: { cs: 'Nový název' } })
    expect(update('note', (f) => { f.help = '' })).toMatchObject({ help: null })
    expect(update('note', (f) => { f.help = 'Jiná' })).toMatchObject({ help: { cs: 'Jiná' } })
  })

  it('sends only what the kind lets change', () => {
    expect(update('photo', (f) => { f.label = 'Obrázek' })).toEqual({ op: 'field.update', type: 'custom_kurzy', key: 'photo', label: { cs: 'Obrázek' } })
    expect(update('photo', (f) => { f.required = true })).toBeNull()
    expect(update('price', (f) => { f.decimal = true })).toBeNull()
    expect(update('price', (f) => { f.max = '99' })).toMatchObject({ max: 99 })
    expect(update('price', (f) => { f.min = '' })).toMatchObject({ min: null })
    expect(update('note', (f) => { f.format = 'url' })).toMatchObject({ format: 'url' })
    expect(update('note', (f) => { f.required = true })).toMatchObject({ required: true })
  })

  it('changes the choices: new ones, new texts, removed and restored ones, the preselected one', () => {
    const op = update('level', (f) => {
      f.options = cmsModelAddOptionRow(f.options, 'D')
      f.options[0].label = 'A+'
      f.options = cmsModelRemoveOptionRow(f.options, 'b')
      f.options = cmsModelRestoreOptionRow(f.options, 'c')
      f.preset = ''
    }) as any
    expect(op.addOptions).toEqual([{ value: 'd', label: { cs: 'D' } }])
    expect(op.optionLabels).toEqual({ a: { cs: 'A+' } })
    expect(op.removeOptions).toEqual(['b'])
    expect(op.restoreOptions).toEqual(['c'])
    expect(op.default).toBeNull()
    const out = run(op).fields.find((f) => f.key === 'level') as any
    expect(out.options.map((o: any) => [o.value, o.removed === true])).toEqual([['a', false], ['b', true], ['c', false], ['d', false]])
    expect(out.options[0].label).toEqual({ cs: 'A+' })
  })

  it('does not send the preselected choice again when it is as it was', () => {
    expect(update('level', (f) => { f.options = cmsModelAddOptionRow(f.options, 'D') })).not.toHaveProperty('default')
  })

  it('never sends a choice that was added and removed in the same form', () => {
    expect(update('level', (f) => { f.options = cmsModelRemoveOptionRow(cmsModelAddOptionRow(f.options, 'D'), 'd') })).toBeNull()
  })

  it('clears the preselected choice when its choice is taken away', () => {
    const op = update('level', (f) => { f.options = cmsModelRemoveOptionRow(f.options, 'a') }) as any
    expect(op.removeOptions).toEqual(['a'])
    expect(op.default).toBeNull()
    expect(run(op).fields.find((f) => f.key === 'level')).toMatchObject({ default: null })
  })
})

describe('the settings of a type', () => {
  const doc = apply(base(), [
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'media', key: 'photo', label: { cs: 'Fotka' } } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'text', key: 'note', label: { cs: 'Poznámka' } } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'number', key: 'price', label: { cs: 'Cena' } } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'richtext', key: 'body', label: { cs: 'Text' } } },
  ])
  const type = () => doc.types[0]!
  const change = (edit: (form: any) => void) => {
    const form = cmsModelSettingsFormOf(type(), read)
    edit(form)
    return cmsModelSettingsOp(type(), form, 'cs', read)
  }
  const run = (op: ModelOp | null) => apply(doc, op ? [op] : []).types[0]!

  it('sends nothing when nothing changed', () => {
    expect(change(() => {})).toBeNull()
  })

  it('renames and changes the icon, an empty singular label clearing it', () => {
    const op = change((f) => { f.plural = ' Lekce '; f.singular = 'Lekce'; f.icon = 'i-lucide-music' }) as any
    expect(op).toMatchObject({ label: { cs: 'Lekce' }, labelSingular: { cs: 'Lekce' }, icon: 'i-lucide-music' })
    expect(run(op)).toMatchObject({ label: { cs: 'Lekce' }, icon: 'i-lucide-music' })
    const typed = apply(doc, [{ op: 'type.update', type: 'custom_kurzy', labelSingular: { cs: 'Kurz' } }])
    const form = cmsModelSettingsFormOf(typed.types[0]!, read)
    form.singular = ''
    expect(cmsModelSettingsOp(typed.types[0]!, form, 'cs', read)).toEqual({ op: 'type.update', type: 'custom_kurzy', labelSingular: null })
  })

  it('offers the fields, then the address and the status, as columns', () => {
    expect(cmsModelColumnChoices(type()).map((c) => c.key)).toEqual(['title', 'photo', 'note', 'price', 'body', 'slug', 'status'])
  })

  it('sends the chosen columns in the order of the fields, or null for the website’s own', () => {
    const op = change((f) => { f.ownColumns = true; f.columns = ['status', 'price', 'title'] }) as any
    expect(op.listColumns).toEqual(['title', 'price', 'status'])
    const own = apply(doc, [op])
    const form = cmsModelSettingsFormOf(own.types[0]!, read)
    expect(form).toMatchObject({ ownColumns: true, columns: ['title', 'price', 'status'] })
    form.ownColumns = false
    expect(cmsModelSettingsOp(own.types[0]!, form, 'cs', read)).toEqual({ op: 'type.update', type: 'custom_kurzy', listColumns: null })
  })

  it('orders by a field the website can sort by, newest first, or by hand', () => {
    expect(cmsModelOrderFields(type()).map((f) => f.key)).toEqual(['title', 'note', 'price'])
    expect(run(change((f) => { f.order = 'field'; f.orderBy = 'price'; f.orderDir = 'desc' }))).toMatchObject({ order: { by: 'price', dir: 'desc' } })
    expect(change((f) => { f.order = 'manual' })).toMatchObject({ order: 'manual' })
    const sorted = apply(doc, [{ op: 'type.update', type: 'custom_kurzy', order: { by: 'price', dir: 'asc' } }]).types[0]!
    const form = cmsModelSettingsFormOf(sorted, read)
    expect(form).toMatchObject({ order: 'field', orderBy: 'price', orderDir: 'asc' })
    form.order = 'newest'
    expect(cmsModelSettingsOp(sorted, form, 'cs', read)).toEqual({ op: 'type.update', type: 'custom_kurzy', order: null })
  })

  it('never sends an order for a type that is arranged by hand', () => {
    const manual = apply(doc, [{ op: 'type.update', type: 'custom_kurzy', order: 'manual' }]).types[0]!
    const form = cmsModelSettingsFormOf(manual, read)
    expect(form.order).toBe('manual')
    form.order = 'newest'
    expect(cmsModelSettingsOp(manual, form, 'cs', read)).toBeNull()
  })

  it('sets and clears the picture and text a shared page uses', () => {
    const op = change((f) => { f.image = 'photo'; f.summary = 'note' }) as any
    expect(op.page).toEqual({ image: 'photo', summary: 'note' })
    expect(run(op).page).toMatchObject({ image: 'photo', summary: 'note' })
    const set = apply(doc, [op]).types[0]!
    const form = cmsModelSettingsFormOf(set, read)
    form.image = ''
    expect(cmsModelSettingsOp(set, form, 'cs', read)).toEqual({ op: 'type.update', type: 'custom_kurzy', page: { image: null } })
  })

  it('has no page settings for a type without pages', () => {
    const plain = apply(emptyModelDoc(), [{ op: 'type.add', name: 'custom_a', label: { cs: 'A' } }]).types[0]!
    const form = cmsModelSettingsFormOf(plain, read)
    form.image = 'x'
    expect(cmsModelSettingsOp(plain, form, 'cs', read)).toBeNull()
  })

  it('asks for a name, 1 to 10 columns, and a field to order by', () => {
    const form = cmsModelSettingsFormOf(type(), read)
    expect(cmsModelSettingsCheck({ ...form, plural: ' ' }, t).plural).toBe('model.validation.severalRequired')
    expect(cmsModelSettingsCheck({ ...form, ownColumns: true, columns: [] }, t).columns).toBe('model.validation.columnsRange')
    expect(cmsModelSettingsCheck({ ...form, ownColumns: true, columns: Array.from({ length: 11 }, (_, i) => `c${i}`) }, t).columns).toBe('model.validation.columnsRange')
    expect(cmsModelSettingsCheck({ ...form, ownColumns: false, columns: [] }, t)).toEqual({})
    expect(cmsModelSettingsCheck({ ...form, order: 'field', orderBy: '' }, t).orderBy).toBe('model.validation.orderByRequired')
  })
})

describe('removing', () => {
  const doc = apply(base(), [
    { op: 'type.add', name: 'custom_akce', label: { cs: 'Akce' } },
    { op: 'field.add', type: 'custom_akce', field: { type: 'relation', key: 'course', label: { cs: 'Kurz' }, to: 'custom_kurzy' } },
    { op: 'field.add', type: 'custom_kurzy', field: { type: 'relation', key: 'self', label: { cs: 'Související' }, to: 'custom_kurzy' } },
  ])

  it('finds the fields of other types that link to a type', () => {
    expect(cmsModelPointingAt(doc, 'custom_kurzy')).toEqual([{ type: 'custom_akce', key: 'course' }])
    expect(cmsModelPointingAt(doc, 'custom_akce')).toEqual([])
    const hidden = apply(doc, [{ op: 'field.remove', type: 'custom_akce', key: 'course' }])
    expect(cmsModelPointingAt(hidden, 'custom_kurzy')).toEqual([])
  })

  it('names those fields in the admin’s words', () => {
    expect(cmsModelFieldRefs(doc, [{ type: 'custom_akce', key: 'course' }, { type: 'custom_none', key: 'gone' }], read)).toEqual([
      { type: 'custom_akce', key: 'course', typeLabel: 'Akce', fieldLabel: 'Kurz' },
      { type: 'custom_none', key: 'gone', typeLabel: 'custom_none', fieldLabel: 'gone' },
    ])
  })

  it('hides a type or a field, and the server takes it back with a restore', () => {
    const hiddenField = apply(doc, [cmsModelRemoveOp('custom_kurzy', 'self')])
    expect(cmsModelHiddenFields(hiddenField.types[0]!).map((f) => f.key)).toEqual(['self'])
    const hiddenType = apply(doc, [cmsModelRemoveOp('custom_akce')])
    expect(cmsModelHiddenTypes(hiddenType).map((x) => x.name)).toEqual(['custom_akce'])
    expect(() => apply(doc, [cmsModelRemoveOp('custom_kurzy')])).toThrow()
  })
})

describe('the texts of part 2', () => {
  it('has the words the dialogs and the page use', () => {
    const text = en.model as any
    for (const key of ['type.addField', 'type.openEntries', 'type.websiteMakes', 'field.chooseKind', 'field.requiredSwitch', 'field.questionOptions', 'settings.questionColumns', 'settings.order.newest', 'remove.confirm', 'remove.goneNow', 'delete.confirm', 'delete.media', 'delete.noUndo', 'deleteForGood', 'removedOn', 'validation.labelRequired']) {
      expect(key.split('.').reduce((node, part) => node?.[part], text), key).toBeTruthy()
    }
    expect(en.model.remove.confirm).toBe('Remove')
  })
})

describe('code that reads the types', () => {
  // A translator over a real catalogue: the key's text with its parameters, plurals by the language's rules.
  const realT = (catalogue: any, locale: string) => (key: string, params: Record<string, any> = {}) => {
    let node = key.split('.').reduce((n, part) => n?.[part], catalogue)
    if (node && typeof node === 'object') node = node[new Intl.PluralRules(locale).select(Number(params.count))] ?? node.other
    if (typeof node !== 'string') throw new Error(`no text: ${key}`)
    return node.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''))
  }
  const now = new Date('2026-11-25T12:00:00Z')
  const doc: ModelDoc = {
    format: 1,
    types: [
      {
        name: 'custom_course', label: { en: 'Courses', cs: 'Kurzy' },
        fields: [
          { key: 'title', type: 'text', label: { en: 'Title' }, required: true },
          { key: 'perex', type: 'text', long: true, label: { en: 'Short description', cs: 'Perex' } },
          { key: 'teacher', type: 'text', label: { en: 'Teacher', cs: 'Lektor' }, required: true },
          { key: 'starts', type: 'datetime', label: { en: 'Starts', cs: 'Začátek' } },
          { key: 'old', type: 'text', label: { en: 'Old note' }, removedAt: '2026-11-20T10:00:00.000Z' },
        ],
      },
      { name: 'custom_branch', label: { en: 'Branches', cs: 'Pobočky' }, fields: [{ key: 'title', type: 'text', label: { en: 'Title' }, required: true }], removedAt: '2026-11-21T10:00:00.000Z' },
    ],
  } as any
  const ctxIn = (locale: 'en' | 'cs' | 'de') => {
    const catalogue = { en, cs, de }[locale]
    return {
      t: realT(catalogue, locale) as any,
      formatDateWith: (v: Date | string | number, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' }).format(new Date(v)),
      now,
      doc,
      read: (label: any) => (label && typeof label === 'object' ? label[locale] ?? '' : ''),
      locale,
    }
  }
  // English dates are as the admin shows them ("November 25"); Czech lists hold a no-break space after "a".
  const reg = (name: string, breaks: CmsModelCodeBreak['breaks'], registeredAt = '2026-11-25T10:00:00.000Z'): CmsModelCodeBreak => ({ name, registeredAt, updatedAt: registeredAt, source: 'token', breaks })

  it('names a type and a field by their labels in the admin\'s language, removed ones too, and the key only when no label is known', () => {
    const ctx = ctxIn('en')
    expect(cmsModelMisfitName({ type: 'custom_course', field: 'perex' }, ctx)).toBe('Courses › Short description')
    expect(cmsModelMisfitName({ type: 'custom_course' }, ctx)).toBe('Courses')
    expect(cmsModelMisfitName({ type: 'custom_course', field: 'old' }, ctx)).toBe('Courses › Old note')
    expect(cmsModelMisfitName({ type: 'custom_branch' }, ctx)).toBe('Branches')
    // A filter of a date is about its field.
    expect(cmsModelMisfitName({ type: 'custom_course', field: 'starts.from' }, ctx)).toBe('Courses › Starts')
    // Gone from the document altogether: the name without its prefix, the key.
    expect(cmsModelMisfitName({ type: 'custom_event', field: 'venue' }, ctx)).toBe('event › venue')
    expect(cmsModelMisfitName({ type: 'custom_course', field: 'perex' }, ctxIn('cs'))).toBe('Kurzy › Perex')
    // No Czech label: the key, never another language's label.
    expect(cmsModelMisfitName({ type: 'custom_course', field: 'title' }, ctxIn('cs'))).toBe('Kurzy › title')
  })

  it('says the sentence of the design for one field one registration reads', () => {
    const ops: ModelOp[] = [{ op: 'field.remove', type: 'custom_course', key: 'perex' }]
    const text = cmsModelCodeRefusalText([reg('app', [{ type: 'custom_course', field: 'perex', why: 'field-removed', message: 'The field perex of custom_course is gone or removed' }])], ctxIn('en'), ops)
    expect(text).toBe('The website’s code reads this field. It is registered as “app” since November 25. Its developer has to update the code first.')
    expect(text).not.toContain('perex')
    expect(text).not.toContain('field-removed')
  })

  it('says it in Czech and German, with the date in that language', () => {
    const ops: ModelOp[] = [{ op: 'field.remove', type: 'custom_course', key: 'perex' }]
    const one = [reg('app', [{ type: 'custom_course', field: 'perex', why: 'field-removed' }])]
    expect(cmsModelCodeRefusalText(one, ctxIn('cs'), ops)).toBe('Toto pole čte kód webu. Na webu je zapsaný pod názvem „app“ od 25. listopadu. Nejdřív ho musí upravit jeho vývojář.')
    expect(cmsModelCodeRefusalText(one, ctxIn('de'), ops)).toBe('Der Code der Website liest dieses Feld. Er ist seit dem 25. November unter dem Namen „app“ eingetragen. Zuerst muss sein Entwickler den Code anpassen.')
  })

  it('adapts to a type, to a required field made optional, and to several registrations', () => {
    const ctx = ctxIn('en')
    const typeText = cmsModelCodeRefusalText([reg('web', [{ type: 'custom_course', why: 'type-removed' }])], ctx, [{ op: 'type.remove', type: 'custom_course' }])
    expect(typeText.startsWith('The website’s code reads this type. It is registered as “web” since November 25.')).toBe(true)
    const loose = cmsModelCodeRefusalText([reg('web', [{ type: 'custom_course', field: 'teacher', why: 'may-be-empty' }])], ctx, [{ op: 'field.update', type: 'custom_course', key: 'teacher', required: false }])
    expect(loose.startsWith('The website’s code counts on this field always being filled in.')).toBe(true)
    const two = cmsModelCodeRefusalText([
      reg('app', [{ type: 'custom_course', field: 'perex', why: 'field-removed' }]),
      reg('web', [{ type: 'custom_course', field: 'perex', why: 'field-removed' }], '2025-03-02T10:00:00.000Z'),
    ], ctx, [{ op: 'field.remove', type: 'custom_course', key: 'perex' }])
    expect(two).toBe('The website’s code reads this field. It is registered as “app” since November 25 and “web” since March 2, 2025. Its developer has to update the code first.')
  })

  it('names what is read when the change was about something else, or about several things', () => {
    const ctx = ctxIn('en')
    const breaks = [{ type: 'custom_course', field: 'perex', why: 'field-removed' }, { type: 'custom_course', field: 'teacher', why: 'may-be-empty' }]
    const text = cmsModelCodeRefusalText([reg('web', breaks)], ctx, [{ op: 'field.remove', type: 'custom_course', key: 'perex' }, { op: 'field.update', type: 'custom_course', key: 'teacher', required: false }])
    expect(text.startsWith('The website’s code reads “Courses › Short description” and “Courses › Teacher” always filled in.')).toBe(true)
  })

  it('says the short sentence when the refusal names nothing it can say more of', () => {
    expect(cmsModelCodeRefusalText([], ctxIn('en'))).toBe(en.model.code.refusal.short)
    expect(cmsModelCodeRefusalText([reg('web', [])], ctxIn('en'))).toBe(en.model.code.refusal.short)
  })

  it('reads the refusal of the server as its own kind, with its registrations', () => {
    const regs = [reg('app', [{ type: 'custom_course', field: 'perex', why: 'field-removed' }])]
    const p = cmsModelProblem(refusal('breaks-code', { registrations: regs }, 409), t, [])
    expect(p.kind).toBe('breaks-code')
    expect(p.at).toBeNull()
    expect(p.registrations).toEqual(regs)
    expect(p.text).toBe('model.code.refusal.short')
    expect(cmsModelProblem(refusal('breaks-code', {}, 409), t, []).registrations).toEqual([])
  })

  it('lists at most four things, each once, then how many more', () => {
    const ctx = ctxIn('en')
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => ({ type: 'custom_course', field: k, why: 'field-removed' }))
    expect(cmsModelMisfitList(many, ctx)).toBe('“Courses › a”, “Courses › b”, “Courses › c”, “Courses › d”, and 2 more')
    expect(cmsModelMisfitList([...many.slice(0, 2), many[0]!], ctx)).toBe('“Courses › a” and “Courses › b”')
    expect(cmsModelListText(['A', 'B', 'C'], 'cs').replace(/\u00a0/g, ' ')).toBe('A, B a C')
  })

  describe('a row of the list', () => {
    const row = (extra: Partial<CmsModelCodeRegistration> = {}): CmsModelCodeRegistration => ({
      name: 'web', registeredAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-25T10:00:00.000Z', source: 'token', by: { id: 'u1', name: 'Ada Admin' }, version: 4, types: 2, breaks: [], ...extra,
    })

    it('says who registered the file in force, when, and how many types it reads', () => {
      expect(cmsModelCodeRow(row(), ctxIn('en'))).toEqual({ meta: 'Ada Admin · registered November 25 · reads 2 types', lacks: '', unreadable: false })
      expect(cmsModelCodeRow(row({ source: 'app', by: null, types: 1 }), ctxIn('en')).meta).toBe('The website itself · registered November 25 · reads 1 type')
      expect(cmsModelCodeRow(row({ by: null }), ctxIn('en')).meta).toBe('Registered November 25 · reads 2 types')
      expect(cmsModelCodeRow(row({ types: 5 }), ctxIn('cs')).meta).toBe('Ada Admin · zapsáno 25. listopadu · čte 5 typů')
      expect(cmsModelCodeRow(row({ source: 'app', by: null }), ctxIn('de')).meta).toBe('Die Website selbst · eingetragen am 25. November · liest 2 Typen')
    })

    it('says in one line what the code expects and the site no longer has, by labels', () => {
      const lacking = row({ breaks: [{ type: 'custom_course', field: 'perex', why: 'field-removed', message: 'The field perex of custom_course is gone or removed' }, { type: 'custom_branch', why: 'type-removed' }] })
      expect(cmsModelCodeRow(lacking, ctxIn('en')).lacks).toBe('It expects something the site no longer has: “Courses › Short description” and “Branches”.')
      expect(cmsModelCodeRow(lacking, ctxIn('cs')).lacks.replace(/\u00a0/g, ' ')).toBe('Počítá s něčím, co web už nemá: „Kurzy › Perex“ a „Pobočky“.')
    })

    it('says so when the stored file cannot be read here', () => {
      const r = cmsModelCodeRow(row({ types: null, breaks: null }), ctxIn('en'))
      expect(r).toEqual({ meta: 'Ada Admin · registered November 25', lacks: '', unreadable: true })
    })
  })

  it('has every text in the three languages', () => {
    for (const key of ['title', 'hint', 'seeAll', 'removeTitle', 'removeBody', 'refusal.field', 'refusal.type', 'refusal.fieldFilled', 'refusal.named', 'refusal.registeredOne', 'refusal.registeredMany', 'refusal.developer']) {
      for (const catalogue of [en, cs, de]) expect(key.split('.').reduce((node: any, part) => node?.[part], (catalogue as any).model.code), key).toBeTruthy()
    }
    expect(en.model.code.title).toBe('Code that reads these types')
    expect(cs.model.code.title).toBe('Kód, který tyto typy čte')
    expect(de.model.code.title).toBe('Code, der diese Typen liest')
    expect(en.account.tokens.model).toBe('Content types')
  })
})
