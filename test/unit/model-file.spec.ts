import { describe, expect, it } from 'vitest'
import { defineEntity, f } from '../../packages/cms/src/index'
import {
  MODEL_FILE_NAME,
  customModelConfig,
  describeModelOps,
  diffModelFile,
  modelFileDoc,
  modelFileOf,
  parseModelFile,
  writeModelFile,
  type ModelFile,
  type ModelFileField,
  type ModelFileType,
} from '../../packages/cms/src/model-file'
import {
  DEFAULT_MODEL_LIMITS,
  ModelProblem,
  applyModelOps,
  emptyModelDoc,
  parseModelDoc,
  type ModelContext,
  type ModelDoc,
  type ModelOp,
} from '../../packages/cms/src/model-doc'

const NOW = new Date('2026-11-25T12:00:00.000Z')
const zero = new Proxy({}, { get: () => 0 }) as Record<string, number>

const ctx = (): ModelContext => ({
  design: [{ name: 'category', singleton: false, pathPrefix: 'kategorie' }],
  limits: { ...DEFAULT_MODEL_LIMITS },
  now: NOW,
  counts: { entries: zero, values: zero, missing: zero },
})

const L = (cs: string) => ({ cs })

const TITLE: ModelFileField = { key: 'title', type: 'text', label: { cs: 'Název' }, required: true }
const text = (key: string, extra: Record<string, unknown> = {}): ModelFileField => ({ key, type: 'text', label: L(key), ...extra }) as ModelFileField
const media = (key: string): ModelFileField => ({ key, type: 'media', label: L(key) })
const number = (key: string, extra: Record<string, unknown> = {}): ModelFileField => ({ key, type: 'number', label: L(key), ...extra }) as ModelFileField
const datetime = (key: string, extra: Record<string, unknown> = {}): ModelFileField => ({ key, type: 'datetime', label: L(key), ...extra }) as ModelFileField
const bool = (key: string, extra: Record<string, unknown> = {}): ModelFileField => ({ key, type: 'boolean', label: L(key), ...extra }) as ModelFileField
const relation = (key: string, to: string): ModelFileField => ({ key, type: 'relation', label: L(key), to })
const select = (key: string, values: (string | [string, boolean])[], extra: Record<string, unknown> = {}): ModelFileField =>
  ({
    key,
    type: 'select',
    label: L(key),
    options: values.map((v) => {
      const [value, removed] = Array.isArray(v) ? v : [v, false]
      return { value, label: L(value), ...(removed ? { removed: true } : {}) }
    }),
    ...extra,
  }) as ModelFileField
const type = (name: string, fields: ModelFileField[] = [TITLE], extra: Record<string, unknown> = {}): ModelFileType =>
  ({ name, label: L(name), titleField: 'title', fields, ...extra }) as ModelFileType
const file = (...types: ModelFileType[]): ModelFile => ({ format: 1, version: 1, types })

const sortedTypes = (f: ModelFile): ModelFile => ({ ...f, types: [...f.types].sort((a, b) => a.name.localeCompare(b.name)) })

/** The operations that lead from `base` to `next`, applied to the base, give `next`. */
function roundTrip(base: ModelFile, next: ModelFile, label = ''): ModelOp[] {
  const { ops, problems } = diffModelFile(base, next)
  expect(problems, label).toEqual([])
  const out = applyModelOps(modelFileDoc(base), ops, ctx()).doc
  const got = modelFileOf(out, { version: next.version, site: next.site })
  expect(writeModelFile(sortedTypes(got)), label).toBe(writeModelFile(sortedTypes(next)))
  return ops
}

const kinds = (ops: ModelOp[]) => ops.map((o) => o.op)

function refusal(fn: () => unknown): ModelProblem {
  try {
    fn()
  } catch (e) {
    if (e instanceof ModelProblem) return e
    throw e
  }
  throw new Error('expected a refusal, nothing was thrown')
}

/** The same value with the keys of every object in the opposite order. */
function scramble<T>(v: T): T {
  if (Array.isArray(v)) return v.map(scramble) as T
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, scramble(x)])) as T
  }
  return v
}

/** A document with most kinds of field, made by the operations (so it is a real one). */
function richDoc(): ModelDoc {
  return applyModelOps(emptyModelDoc(), [
    {
      op: 'type.add',
      name: 'custom_course',
      label: { cs: 'Kurzy', en: 'Courses' },
      labelSingular: { cs: 'Kurz', en: 'Course' },
      description: L('Naše kurzy'),
      icon: 'i-lucide-graduation-cap',
      page: { prefix: 'kurzy' },
      publish: true,
      titleLabel: { cs: 'Název', en: 'Title' },
    },
    { op: 'field.add', type: 'custom_course', field: { type: 'text', key: 'perex', label: L('Perex'), long: true, help: L('Krátký popis') } },
    { op: 'field.add', type: 'custom_course', field: { type: 'text', key: 'mail', label: L('E-mail'), format: 'email', max: 120 } },
    { op: 'field.add', type: 'custom_course', field: { type: 'richtext', key: 'body', label: L('Text') } },
    { op: 'field.add', type: 'custom_course', field: { type: 'number', key: 'price', label: L('Cena'), min: 0, decimal: true } },
    { op: 'field.add', type: 'custom_course', field: { type: 'boolean', key: 'open', label: L('Otevřeno'), default: true } },
    { op: 'field.add', type: 'custom_course', field: { type: 'datetime', key: 'startsAt', label: L('Začátek'), allDay: true } },
    {
      op: 'field.add',
      type: 'custom_course',
      field: { type: 'select', key: 'level', label: L('Úroveň'), default: 'beginner', options: [{ value: 'beginner', label: L('Začátečník') }, { value: 'advanced', label: L('Pokročilý') }, { value: 'old', label: L('Starý') }] },
    },
    { op: 'field.add', type: 'custom_course', field: { type: 'media', key: 'cover', label: L('Obrázek') } },
    { op: 'field.add', type: 'custom_course', field: { type: 'file', key: 'pdf', label: L('PDF') } },
    { op: 'field.add', type: 'custom_course', field: { type: 'gallery', key: 'photos', label: L('Fotky') } },
    { op: 'field.add', type: 'custom_course', field: { type: 'color', key: 'tint', label: L('Barva') } },
    { op: 'field.add', type: 'custom_course', field: { type: 'relation', key: 'category', label: L('Kategorie'), to: 'category' } },
    { op: 'field.update', type: 'custom_course', key: 'level', removeOptions: ['old'] },
    { op: 'type.update', type: 'custom_course', listColumns: ['title', 'price'], order: { by: 'startsAt', dir: 'asc' }, page: { image: 'cover', summary: 'perex' } },
  ], ctx()).doc
}

const richFile = (): ModelFile => modelFileOf(richDoc(), { version: 7, site: 'https://kurzy.example' })

describe('the model file', () => {
  it('has a name', () => {
    expect(MODEL_FILE_NAME).toBe('cms.model.json')
  })

  it('is written, read back, and written again to the same bytes', () => {
    const file = richFile()
    const text = writeModelFile(file)
    const back = parseModelFile(JSON.parse(text))
    expect(back).toEqual(file)
    expect(writeModelFile(back)).toBe(text)
  })

  it('has two spaces and a newline at the end', () => {
    const text = writeModelFile(richFile())
    expect(text.endsWith('}\n')).toBe(true)
    expect(text.endsWith('\n\n')).toBe(false)
    expect(text).toContain('\n  "format": 1,\n')
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`)
  })

  it('writes the keys of the file, a type, a field and a choice in one order', () => {
    const parsed = JSON.parse(writeModelFile(richFile()))
    expect(Object.keys(parsed)).toEqual(['format', 'site', 'version', 'types'])
    const t = parsed.types[0]
    expect(Object.keys(t)).toEqual(['name', 'label', 'labelSingular', 'description', 'icon', 'titleField', 'page', 'publish', 'order', 'listColumns', 'fields'])
    expect(Object.keys(t.page)).toEqual(['prefix', 'image', 'summary'])
    expect(Object.keys(t.order)).toEqual(['by', 'dir'])
    const byKey = (k: string) => t.fields.find((x: { key: string }) => x.key === k)
    expect(Object.keys(byKey('perex'))).toEqual(['key', 'type', 'label', 'help', 'long'])
    expect(Object.keys(byKey('mail'))).toEqual(['key', 'type', 'label', 'format', 'max'])
    expect(Object.keys(byKey('price'))).toEqual(['key', 'type', 'label', 'decimal', 'min'])
    expect(Object.keys(byKey('level'))).toEqual(['key', 'type', 'label', 'default', 'options'])
    expect(Object.keys(byKey('level').options[2])).toEqual(['value', 'label', 'removed'])
  })

  it('gives the same bytes for a document with its keys in a scrambled order', () => {
    const tidy = richFile()
    expect(writeModelFile(scramble(tidy))).toBe(writeModelFile(tidy))
    expect(writeModelFile(parseModelFile(scramble(JSON.parse(writeModelFile(tidy)))))).toBe(writeModelFile(tidy))
  })

  it('sorts the languages of every label', () => {
    const t = type('custom_a', [{ ...TITLE, label: { en: 'Title', cs: 'Název' }, help: { de: 'h', cs: 'c' } }], { label: { en: 'A', de: 'A', cs: 'A' } })
    const parsed = JSON.parse(writeModelFile(file(t)))
    expect(Object.keys(parsed.types[0].label)).toEqual(['cs', 'de', 'en'])
    expect(Object.keys(parsed.types[0].fields[0].label)).toEqual(['cs', 'en'])
    expect(Object.keys(parsed.types[0].fields[0].help)).toEqual(['cs', 'de'])
  })

  it('leaves out null, undefined, false, an empty list of columns and the defaults that say nothing', () => {
    const messy = file(
      type('custom_a', [
        TITLE,
        { key: 'a', type: 'text', label: L('a'), help: null, required: false, long: false, format: null, max: null } as ModelFileField,
        { key: 'n', type: 'number', label: L('n'), required: false, decimal: false, min: null, max: null } as ModelFileField,
        { key: 'b', type: 'boolean', label: L('b'), default: false } as ModelFileField,
        { key: 'd', type: 'datetime', label: L('d'), allDay: false } as ModelFileField,
        { key: 's', type: 'select', label: L('s'), default: null, options: [{ value: 'x', label: L('x'), removed: false }] } as ModelFileField,
      ], { labelSingular: null, description: null, icon: null, page: null, publish: false, order: null, listColumns: [] }),
    )
    expect(JSON.parse(writeModelFile(messy))).toEqual({
      format: 1,
      version: 1,
      types: [{
        name: 'custom_a',
        label: { cs: 'custom_a' },
        titleField: 'title',
        fields: [
          { key: 'title', type: 'text', label: { cs: 'Název' }, required: true },
          { key: 'a', type: 'text', label: { cs: 'a' } },
          { key: 'n', type: 'number', label: { cs: 'n' } },
          { key: 'b', type: 'boolean', label: { cs: 'b' } },
          { key: 'd', type: 'datetime', label: { cs: 'd' } },
          { key: 's', type: 'select', label: { cs: 's' }, options: [{ value: 'x', label: { cs: 'x' } }] },
        ],
      }],
    })
  })

  it('keeps a number that is 0', () => {
    const t = type('custom_a', [TITLE, number('n', { min: 0, max: 0 })])
    const field = JSON.parse(writeModelFile(file(t))).types[0].fields[1]
    expect(field).toMatchObject({ min: 0, max: 0 })
  })

  it('keeps true values: a switch that is on, a required field, a page without a picture', () => {
    const t = type('custom_a', [TITLE, bool('b', { default: true })], { page: { prefix: 'a', image: null }, publish: true })
    const parsed = JSON.parse(writeModelFile(file(t)))
    expect(parsed.types[0].fields[1].default).toBe(true)
    expect(parsed.types[0].fields[0].required).toBe(true)
    expect(parsed.types[0].page).toEqual({ prefix: 'a' })
    expect(parsed.types[0].publish).toBe(true)
  })

  it('leaves out the site when it is not given', () => {
    const doc = richDoc()
    const bare = modelFileOf(doc, { version: 3 })
    expect('site' in bare).toBe(false)
    expect(Object.keys(JSON.parse(writeModelFile(bare)))).toEqual(['format', 'version', 'types'])
    expect(Object.keys(JSON.parse(writeModelFile({ ...bare, site: '' })))).toEqual(['format', 'version', 'types'])
    expect(parseModelFile(JSON.parse(writeModelFile(bare)))).toEqual(bare)
  })

  it('is the same for two documents that differ only in removed things', () => {
    const doc = richDoc()
    const plain = writeModelFile(modelFileOf(doc, { version: 2 }))
    const more = applyModelOps(doc, [
      { op: 'type.add', name: 'custom_gone', label: L('Pryč') },
      { op: 'field.remove', type: 'custom_course', key: 'tint' },
      { op: 'type.remove', type: 'custom_gone' },
    ], ctx()).doc
    expect(more.types.find((t) => t.name === 'custom_gone')?.removedEmpty).toBe(true)
    const fewer = applyModelOps(doc, [{ op: 'field.remove', type: 'custom_course', key: 'tint' }], ctx()).doc
    expect(writeModelFile(modelFileOf(more, { version: 2 }))).toBe(writeModelFile(modelFileOf(fewer, { version: 2 })))
    expect(writeModelFile(modelFileOf(more, { version: 2 }))).not.toBe(plain)
    // The same, but the hidden things held content, so `removedEmpty` is false.
    const held = applyModelOps(doc, [{ op: 'field.remove', type: 'custom_course', key: 'tint' }], { ...ctx(), counts: { values: { 'custom_course.tint': 5 } } }).doc
    expect(held.types[0]?.fields.find((x) => x.key === 'tint')?.removedEmpty).toBe(false)
    expect(writeModelFile(modelFileOf(held, { version: 2 }))).toBe(writeModelFile(modelFileOf(fewer, { version: 2 })))
    expect(writeModelFile(modelFileOf(more, { version: 2 }))).not.toContain('removedAt')
    expect(writeModelFile(modelFileOf(more, { version: 2 }))).not.toContain('removedEmpty')
    expect(writeModelFile(modelFileOf(more, { version: 2 }))).not.toContain('custom_gone')
  })

  it('keeps a removed choice, marked removed', () => {
    const parsed = JSON.parse(writeModelFile(richFile()))
    const level = parsed.types[0].fields.find((x: { key: string }) => x.key === 'level')
    expect(level.options).toEqual([
      { value: 'beginner', label: { cs: 'Začátečník' } },
      { value: 'advanced', label: { cs: 'Pokročilý' } },
      { value: 'old', label: { cs: 'Starý' }, removed: true },
    ])
  })

  it('stands for a document that passes parseModelDoc, and back', () => {
    const file = richFile()
    const doc = modelFileDoc(file)
    expect(() => parseModelDoc(JSON.parse(JSON.stringify(doc)))).not.toThrow()
    expect(modelFileOf(doc, { version: file.version, site: file.site })).toEqual(file)
    expect(doc.format).toBe(1)
    expect(doc.types[0]?.removedAt).toBeUndefined()
  })

  it('does not share its data with the document it stands for', () => {
    const file = richFile()
    const doc = modelFileDoc(file)
    doc.types[0]!.label.cs = 'Změněno'
    expect(file.types[0]!.label.cs).toBe('Kurzy')
  })
})

describe('parseModelFile', () => {
  const good = (): any => JSON.parse(writeModelFile(richFile()))
  const refuses = (value: unknown, ...inMessage: string[]): ModelProblem => {
    const p = refusal(() => parseModelFile(value))
    expect(p.code).toBe('invalid-file')
    for (const part of inMessage) expect(p.message).toContain(part)
    return p
  }

  it('reads a good file', () => {
    expect(() => parseModelFile(good())).not.toThrow()
    expect(parseModelFile({ format: 1, version: 0, types: [] })).toEqual({ format: 1, version: 0, types: [] })
  })

  it('refuses what is not an object', () => {
    refuses(null)
    refuses([])
    refuses('x')
  })

  it('refuses an unknown key of the file', () => {
    refuses({ ...good(), extra: 1 }, 'extra')
  })

  it('refuses an unknown key of a type', () => {
    const v = good()
    v.types[0].extra = 1
    refuses(v, 'types[0]')
  })

  it('refuses an unknown key of a field', () => {
    const v = good()
    v.types[0].fields[2].extra = 1
    refuses(v, 'fields[2]')
  })

  it('refuses removedAt on a type, with the place', () => {
    const v = good()
    v.types[0].removedAt = null
    refuses(v, 'types[0].removedAt')
  })

  it('refuses removedAt on a field, with the place', () => {
    const v = good()
    v.types[0].fields[3].removedAt = '2026-01-01T00:00:00.000Z'
    refuses(v, 'types[0].fields[3].removedAt')
  })

  it('refuses removedEmpty on a type and on a field', () => {
    const a = good()
    a.types[0].removedEmpty = true
    refuses(a, 'types[0].removedEmpty')
    const b = good()
    b.types[0].fields[1].removedEmpty = false
    refuses(b, 'types[0].fields[1].removedEmpty')
  })

  it('refuses a wrong format', () => {
    refuses({ ...good(), format: 0 }, 'format')
    refuses({ ...good(), format: '1' }, 'format')
    const { format: _format, ...none } = good()
    refuses(none, 'format')
  })

  it('refuses a newer format, and says so', () => {
    refuses({ ...good(), format: 2 }, 'newer')
  })

  it('refuses a version that is not a whole number, 0 or more', () => {
    for (const version of [-1, 1.5, '3', null, Number.NaN, undefined]) refuses({ ...good(), version }, 'version')
    expect(parseModelFile({ ...good(), version: 0 }).version).toBe(0)
  })

  it('refuses a site that is not text', () => {
    refuses({ ...good(), site: 5 }, 'site')
    refuses({ ...good(), site: '' }, 'site')
  })

  it('refuses types that are not a list', () => {
    refuses({ ...good(), types: {} }, 'types')
    const { types: _types, ...none } = good()
    refuses(none, 'types')
  })

  it('refuses a file over 256 KB', () => {
    const v = good()
    v.types[0].description = { cs: 'x'.repeat(300 * 1024) }
    refuses(v, '256 KB')
  })

  it('refuses a rule of the document, with its message and the code of the file', () => {
    const twice = good()
    twice.types[0].fields.push({ ...twice.types[0].fields[1] })
    const p = refuses(twice)
    expect(p.message.length).toBeGreaterThan(10)
    const underlying = refusal(() => parseModelDoc({ format: 1, types: twice.types }))
    expect(p.message).toBe(underlying.message)
    expect(underlying.code).not.toBe('invalid-file')
    expect(p.op).toBe(-1)

    const notText = good()
    notText.types[0].titleField = 'price'
    const q = refuses(notText)
    expect(q.message).toBe(refusal(() => parseModelDoc({ format: 1, types: notText.types })).message)
  })

  it('writes what it read the one way', () => {
    const v = scramble(good())
    expect(writeModelFile(parseModelFile(v))).toBe(writeModelFile(richFile()))
  })
})

describe('diffModelFile: what a difference becomes', () => {
  const course = (fields: ModelFileField[] = [TITLE], extra: Record<string, unknown> = {}) => type('custom_course', fields, extra)

  it('is no operations for identical files', () => {
    const f = richFile()
    expect(roundTrip(f, structuredClone(f))).toEqual([])
    expect(roundTrip(file(), file())).toEqual([])
  })

  it('does not care about the version or the site', () => {
    const base = richFile()
    expect(diffModelFile(base, { ...base, version: 99, site: undefined } as ModelFile)).toEqual({ ops: [], problems: [] })
  })

  it('makes a type.add, its fields, a title update and a type.update for a new type', () => {
    const base = file()
    const next = file(
      course(
        [
          text('intro'),
          { ...TITLE, label: { cs: 'Název', en: 'Title' }, help: L('Jak se kurz jmenuje') },
          text('perex', { long: true }),
          media('cover'),
          datetime('startsAt'),
        ],
        {
          label: { cs: 'Kurzy', en: 'Courses' },
          labelSingular: { cs: 'Kurz', en: 'Course' },
          description: L('Naše kurzy'),
          icon: 'i-lucide-graduation-cap',
          page: { prefix: 'kurzy', image: 'cover', summary: 'perex' },
          publish: true,
          order: { by: 'startsAt', dir: 'asc' },
          listColumns: ['title', 'perex'],
        },
      ),
    )
    const ops = roundTrip(base, next)
    expect(kinds(ops)).toEqual(['type.add', 'field.add', 'field.add', 'field.add', 'field.add', 'field.update', 'type.update', 'field.order'])
    expect(ops[0]).toEqual({
      op: 'type.add',
      name: 'custom_course',
      label: { cs: 'Kurzy', en: 'Courses' },
      labelSingular: { cs: 'Kurz', en: 'Course' },
      description: L('Naše kurzy'),
      icon: 'i-lucide-graduation-cap',
      page: { prefix: 'kurzy' },
      publish: true,
      titleLabel: { cs: 'Název', en: 'Title' },
    })
    expect(ops[1]).toEqual({ op: 'field.add', type: 'custom_course', field: text('intro') })
    expect(ops[2]).toEqual({ op: 'field.add', type: 'custom_course', field: text('perex', { long: true }), after: 'title' })
    expect(ops[3]).toEqual({ op: 'field.add', type: 'custom_course', field: media('cover'), after: 'perex' })
    expect(ops[5]).toEqual({ op: 'field.update', type: 'custom_course', key: 'title', help: L('Jak se kurz jmenuje') })
    expect(ops[6]).toEqual({
      op: 'type.update',
      type: 'custom_course',
      listColumns: ['title', 'perex'],
      order: { by: 'startsAt', dir: 'asc' },
      page: { image: 'cover', summary: 'perex' },
    })
    expect(ops[7]).toEqual({ op: 'field.order', type: 'custom_course', keys: ['intro', 'title', 'perex', 'cover', 'startsAt'] })
  })

  it('needs no field.order for a new type whose fields come in the natural order', () => {
    const ops = roundTrip(file(), file(course([TITLE, text('perex'), media('cover')])))
    expect(kinds(ops)).toEqual(['type.add', 'field.add', 'field.add'])
  })

  it('makes a type of its own for a type with no pages and no publishing', () => {
    const ops = roundTrip(file(), file(course()))
    expect(ops).toEqual([{ op: 'type.add', name: 'custom_course', label: L('custom_course'), titleLabel: L('Název') }])
  })

  it('removes a type that is left out', () => {
    const ops = roundTrip(file(course(), type('custom_other')), file(type('custom_other')))
    expect(ops).toEqual([{ op: 'type.remove', type: 'custom_course' }])
  })

  it('removes two types that point at each other: a field first, then both types', () => {
    const a = type('custom_a', [TITLE, relation('toB', 'custom_b')])
    const b = type('custom_b', [TITLE, relation('toA', 'custom_a')])
    const ops = roundTrip(file(a, b), file())
    expect(kinds(ops)).toEqual(['field.remove', 'type.remove', 'type.remove'])
    expect(ops.filter((o) => o.op === 'type.remove').map((o: any) => o.type).sort()).toEqual(['custom_a', 'custom_b'])
  })

  it('removes a type that points at itself', () => {
    const a = type('custom_a', [TITLE, relation('parent', 'custom_a')])
    expect(roundTrip(file(a), file())).toEqual([{ op: 'type.remove', type: 'custom_a' }])
  })

  it('removes the types of a chain from the one nothing points at', () => {
    const a = type('custom_a', [TITLE, relation('b', 'custom_b')])
    const b = type('custom_b', [TITLE, relation('c', 'custom_c')])
    const c = type('custom_c')
    const ops = roundTrip(file(c, b, a), file())
    expect(ops).toEqual([
      { op: 'type.remove', type: 'custom_a' },
      { op: 'type.remove', type: 'custom_b' },
      { op: 'type.remove', type: 'custom_c' },
    ])
  })

  it('removes the relation field of a kept type to a removed type first', () => {
    const base = file(type('custom_a', [TITLE, relation('b', 'custom_b'), text('x')]), type('custom_b'))
    const next = file(type('custom_a', [TITLE, text('x')]))
    const ops = roundTrip(base, next)
    expect(ops).toEqual([
      { op: 'field.remove', type: 'custom_a', key: 'b' },
      { op: 'type.remove', type: 'custom_b' },
    ])
  })

  it('adds a field after the field before it', () => {
    const base = file(course([TITLE, text('b')]))
    const next = file(course([TITLE, text('a'), text('b'), text('c')]))
    const ops = roundTrip(base, next)
    expect(ops).toEqual([
      { op: 'field.add', type: 'custom_course', field: text('a'), after: 'title' },
      { op: 'field.add', type: 'custom_course', field: text('c'), after: 'b' },
    ])
  })

  it('adds a new first field, then puts the fields in order', () => {
    const base = file(course([TITLE, text('b')]))
    const next = file(course([text('a'), TITLE, text('b')]))
    const ops = roundTrip(base, next)
    expect(ops).toEqual([
      { op: 'field.add', type: 'custom_course', field: text('a') },
      { op: 'field.order', type: 'custom_course', keys: ['a', 'title', 'b'] },
    ])
  })

  it('adds a new select field with a removed choice: the field, then the choice removed', () => {
    const base = file(course())
    const next = file(course([TITLE, select('level', ['a', 'b', ['c', true]], { default: 'a' })]))
    const ops = roundTrip(base, next)
    expect(ops).toEqual([
      {
        op: 'field.add',
        type: 'custom_course',
        field: { key: 'level', type: 'select', label: L('level'), default: 'a', options: [{ value: 'a', label: L('a') }, { value: 'b', label: L('b') }, { value: 'c', label: L('c') }] },
        after: 'title',
      },
      { op: 'field.update', type: 'custom_course', key: 'level', removeOptions: ['c'] },
    ])
  })

  it('adds a new required field', () => {
    const ops = roundTrip(file(course()), file(course([TITLE, text('code', { required: true }), number('n', { required: true })])))
    expect(ops).toHaveLength(2)
    expect(ops[0]).toMatchObject({ op: 'field.add', field: { key: 'code', required: true } })
  })

  it('removes a field that is left out', () => {
    const ops = roundTrip(file(course([TITLE, text('a'), text('b')])), file(course([TITLE, text('b')])))
    expect(ops).toEqual([{ op: 'field.remove', type: 'custom_course', key: 'a' }])
  })

  it('lets the removal of a field clear the order, a column, the page picture and summary', () => {
    const base = file(
      course([TITLE, datetime('when'), text('perex'), media('cover'), text('keep')], {
        page: { prefix: 'kurzy', image: 'cover', summary: 'perex' },
        order: { by: 'when', dir: 'desc' },
        listColumns: ['title', 'when'],
      }),
    )
    const next = file(course([TITLE, text('keep')], { page: { prefix: 'kurzy' }, listColumns: ['title'] }))
    // The column list shrinks by itself ("when" goes): only the next file's list is different to what is left.
    expect(kinds(roundTrip(base, next))).toEqual(['field.remove', 'field.remove', 'field.remove'])
    const lone = file(course([TITLE, datetime('when')], { order: { by: 'when', dir: 'asc' }, listColumns: ['when'] }))
    const gone = file(course([TITLE]))
    expect(roundTrip(lone, gone)).toEqual([{ op: 'field.remove', type: 'custom_course', key: 'when' }])
  })

  it('sends a type.update after a removal only when the next file says something else', () => {
    const base = file(course([TITLE, datetime('when'), text('perex'), media('cover')], {
      page: { prefix: 'kurzy', image: 'cover', summary: 'perex' },
      order: { by: 'when', dir: 'desc' },
      listColumns: ['title', 'when', 'perex'],
    }))
    const next = file(course([TITLE, text('perex')], { page: { prefix: 'kurzy', summary: 'perex' }, order: { by: 'title', dir: 'asc' }, listColumns: ['title', 'perex'] }))
    const ops = roundTrip(base, next)
    expect(ops).toEqual([
      { op: 'field.remove', type: 'custom_course', key: 'when' },
      { op: 'field.remove', type: 'custom_course', key: 'cover' },
      { op: 'type.update', type: 'custom_course', order: { by: 'title', dir: 'asc' } },
    ])
  })

  it('changes the label, singular label, description and icon with a type.update', () => {
    const base = file(course([TITLE], { labelSingular: L('Kurz'), description: L('d'), icon: 'i-lucide-a' }))
    const next = file(course([TITLE], { label: { cs: 'Kurzy', en: 'Courses' }, labelSingular: L('Kurzík'), description: L('dd'), icon: 'i-lucide-b' }))
    expect(roundTrip(base, next)).toEqual([
      { op: 'type.update', type: 'custom_course', label: { cs: 'Kurzy', en: 'Courses' }, labelSingular: L('Kurzík'), description: L('dd'), icon: 'i-lucide-b' },
    ])
  })

  it('unsets the singular label, description and icon', () => {
    const base = file(course([TITLE], { labelSingular: L('Kurz'), description: L('d'), icon: 'i-lucide-a' }))
    const next = file(course([TITLE]))
    expect(roundTrip(base, next)).toEqual([{ op: 'type.update', type: 'custom_course', labelSingular: null, description: null, icon: null }])
  })

  it('sets and unsets the list columns', () => {
    const plain = file(course([TITLE, text('a')]))
    const cols = file(course([TITLE, text('a')], { listColumns: ['a', 'title'] }))
    expect(roundTrip(plain, cols)).toEqual([{ op: 'type.update', type: 'custom_course', listColumns: ['a', 'title'] }])
    expect(roundTrip(cols, plain)).toEqual([{ op: 'type.update', type: 'custom_course', listColumns: null }])
    const slug = file(course([TITLE], { page: { prefix: 'k' }, publish: true, listColumns: ['title', 'slug', 'status'] }))
    expect(roundTrip(file(course([TITLE], { page: { prefix: 'k' }, publish: true })), slug)).toHaveLength(1)
  })

  it('sets, changes and unsets the order, also to by hand', () => {
    const none = file(course([TITLE, number('n')]))
    const asc = file(course([TITLE, number('n')], { order: { by: 'n', dir: 'asc' } }))
    const desc = file(course([TITLE, number('n')], { order: { by: 'n', dir: 'desc' } }))
    const manual = file(course([TITLE, number('n')], { order: 'manual' }))
    expect(roundTrip(none, asc)).toEqual([{ op: 'type.update', type: 'custom_course', order: { by: 'n', dir: 'asc' } }])
    expect(roundTrip(asc, desc)).toEqual([{ op: 'type.update', type: 'custom_course', order: { by: 'n', dir: 'desc' } }])
    expect(roundTrip(desc, none)).toEqual([{ op: 'type.update', type: 'custom_course', order: null }])
    expect(roundTrip(none, manual)).toEqual([{ op: 'type.update', type: 'custom_course', order: 'manual' }])
  })

  it('refuses to take an order by hand back to no order or a field (the site refuses it too)', () => {
    const manual = file(course([TITLE, number('n')], { order: 'manual' }))
    for (const order of [undefined, { by: 'n', dir: 'asc' }]) {
      const next = file(course([TITLE, number('n')], order ? { order } : {}))
      const r = diffModelFile(manual, next)
      expect(r.ops).toEqual([])
      expect(r.problems).toHaveLength(1)
      expect(r.problems[0]).toMatchObject({ code: 'not-changeable', type: 'custom_course' })
    }
  })

  it('sets, changes and unsets the page picture and summary', () => {
    const page = (p: Record<string, unknown>) => file(course([TITLE, media('a'), media('b'), text('s'), text('t')], { page: { prefix: 'k', ...p } }))
    expect(roundTrip(page({}), page({ image: 'a', summary: 's' }))).toEqual([{ op: 'type.update', type: 'custom_course', page: { image: 'a', summary: 's' } }])
    expect(roundTrip(page({ image: 'a', summary: 's' }), page({ image: 'b', summary: 's' }))).toEqual([{ op: 'type.update', type: 'custom_course', page: { image: 'b' } }])
    expect(roundTrip(page({ image: 'a', summary: 's' }), page({ summary: 't' }))).toEqual([{ op: 'type.update', type: 'custom_course', page: { image: null, summary: 't' } }])
    expect(roundTrip(page({ image: 'a', summary: 's' }), page({}))).toEqual([{ op: 'type.update', type: 'custom_course', page: { image: null, summary: null } }])
  })

  it('changes the label and the help of a field, and takes the help away', () => {
    const base = file(course([TITLE, text('a', { help: L('h') })]))
    const next = file(course([TITLE, { ...text('a'), label: { cs: 'A', en: 'A' }, help: L('hh') }]))
    expect(roundTrip(base, next)).toEqual([{ op: 'field.update', type: 'custom_course', key: 'a', label: { cs: 'A', en: 'A' }, help: L('hh') }])
    expect(roundTrip(base, file(course([TITLE, text('a')])))).toEqual([{ op: 'field.update', type: 'custom_course', key: 'a', help: null }])
    expect(roundTrip(file(course([TITLE, text('a')])), base)).toEqual([{ op: 'field.update', type: 'custom_course', key: 'a', help: L('h') }])
  })

  const upd = (key: string, extra: Record<string, unknown>) => [{ op: 'field.update', type: 'custom_course', key, ...extra }]
  const both = (a: ModelFileField, b: ModelFileField, forward: Record<string, unknown>, back: Record<string, unknown>) => {
    const A = file(course([TITLE, a]))
    const B = file(course([TITLE, b]))
    expect(roundTrip(A, B)).toEqual(upd(a.key, forward))
    expect(roundTrip(B, A)).toEqual(upd(a.key, back))
  }

  it('sets and unsets required', () => {
    both(text('a'), text('a', { required: true }), { required: true }, { required: false })
    both(number('n'), number('n', { required: true }), { required: true }, { required: false })
    both(select('s', ['x']), select('s', ['x'], { required: true }), { required: true }, { required: false })
    both({ key: 'r', type: 'richtext', label: L('r') }, { key: 'r', type: 'richtext', label: L('r'), required: true }, { required: true }, { required: false })
    both({ key: 'c', type: 'color', label: L('c') }, { key: 'c', type: 'color', label: L('c'), required: true }, { required: true }, { required: false })
  })

  it('sets and unsets long, format and the longest text', () => {
    both(text('a'), text('a', { long: true }), { long: true }, { long: false })
    both(text('a'), text('a', { format: 'email' }), { format: 'email' }, { format: null })
    both(text('a', { format: 'url' }), text('a', { format: 'link' }), { format: 'link' }, { format: 'url' })
    both(text('a'), text('a', { max: 80 }), { max: 80 }, { max: null })
  })

  it('sets and unsets min and max of a number, also 0', () => {
    both(number('n'), number('n', { min: 0 }), { min: 0 }, { min: null })
    both(number('n'), number('n', { max: 10 }), { max: 10 }, { max: null })
    both(number('n', { min: 1, max: 5 }), number('n', { min: 2, max: 9 }), { min: 2, max: 9 }, { min: 1, max: 5 })
  })

  it('sets and unsets allDay', () => {
    both(datetime('d'), datetime('d', { allDay: true }), { allDay: true }, { allDay: false })
  })

  it('sets and unsets the default of a switch', () => {
    both(bool('b'), bool('b', { default: true }), { default: true }, { default: false })
  })

  it('sets, changes and unsets the default of a choice field', () => {
    both(select('s', ['x', 'y']), select('s', ['x', 'y'], { default: 'y' }), { default: 'y' }, { default: null })
    both(select('s', ['x', 'y'], { default: 'x' }), select('s', ['x', 'y'], { default: 'y' }), { default: 'y' }, { default: 'x' })
  })

  it('adds a choice, relabels a choice, marks one removed and un-marks it: one field.update', () => {
    const base = file(course([TITLE, select('s', ['x', 'y', ['z', true]])]))
    const next = file(course([TITLE, {
      ...select('s', ['x', 'y', 'z', 'w']),
      options: [
        { value: 'x', label: { cs: 'X!' } },
        { value: 'y', label: L('y'), removed: true },
        { value: 'z', label: L('z') },
        { value: 'w', label: L('w') },
      ],
    } as ModelFileField]))
    const ops = roundTrip(base, next)
    expect(ops).toEqual([{
      op: 'field.update',
      type: 'custom_course',
      key: 's',
      optionLabels: { x: { cs: 'X!' } },
      restoreOptions: ['z'],
      addOptions: [{ value: 'w', label: L('w') }],
      removeOptions: ['y'],
    }])
  })

  it('adds a choice that is removed at once', () => {
    const base = file(course([TITLE, select('s', ['x'])]))
    const next = file(course([TITLE, select('s', ['x', ['y', true]])]))
    expect(roundTrip(base, next)).toEqual([
      { op: 'field.update', type: 'custom_course', key: 's', addOptions: [{ value: 'y', label: L('y') }], removeOptions: ['y'] },
    ])
  })

  it('puts the fields in another order with field.order', () => {
    const base = file(course([TITLE, text('a'), text('b'), text('c')]))
    const next = file(course([text('c'), TITLE, text('a'), text('b')]))
    expect(roundTrip(base, next)).toEqual([{ op: 'field.order', type: 'custom_course', keys: ['c', 'title', 'a', 'b'] }])
  })

  it('puts the fields in order after a removal and an addition', () => {
    const base = file(course([TITLE, text('a'), text('b'), text('c')]))
    const next = file(course([text('d'), text('c'), TITLE, text('b')]))
    const ops = roundTrip(base, next)
    expect(kinds(ops)).toEqual(['field.remove', 'field.add', 'field.order'])
  })

  it('has no operations for the types in another order', () => {
    const a = type('custom_a')
    const b = type('custom_b')
    const c = type('custom_c')
    expect(diffModelFile(file(a, b, c), file(c, a, b))).toEqual({ ops: [], problems: [] })
  })

  it('reads a changed name as a removal and an addition', () => {
    const ops = roundTrip(file(type('custom_old', [TITLE, text('a')])), file(type('custom_new', [TITLE, text('a')])))
    expect(ops.map((o) => o.op)).toEqual(['type.remove', 'type.add', 'field.add'])
    expect(ops[0]).toEqual({ op: 'type.remove', type: 'custom_old' })
    expect(ops[1]).toMatchObject({ op: 'type.add', name: 'custom_new' })
  })

  it('reads a changed key as a removal and an addition', () => {
    const ops = roundTrip(file(course([TITLE, text('old')])), file(course([TITLE, text('fresh')])))
    expect(ops).toEqual([
      { op: 'field.remove', type: 'custom_course', key: 'old' },
      { op: 'field.add', type: 'custom_course', field: text('fresh'), after: 'title' },
    ])
  })

  it('takes a relation to a new type, and a new type pointing at a type of the design', () => {
    const base = file(type('custom_a'))
    const next = file(type('custom_a', [TITLE, relation('b', 'custom_b')]), type('custom_b', [TITLE, relation('cat', 'category')]))
    const ops = roundTrip(base, next)
    expect(ops[0]).toMatchObject({ op: 'type.add', name: 'custom_b' })
  })

  it('takes two new types that point at each other', () => {
    const next = file(type('custom_a', [TITLE, relation('b', 'custom_b')]), type('custom_b', [TITLE, relation('a', 'custom_a')]))
    roundTrip(file(), next)
  })

  it('takes a type that goes while another one comes, with a relation at the design', () => {
    const base = file(type('custom_a', [TITLE, relation('cat', 'category')]), type('custom_b'))
    const next = file(type('custom_b', [TITLE, relation('a', 'custom_c')]), type('custom_c', [TITLE, text('t')]))
    roundTrip(base, next)
  })

  it('takes a file with every kind of field from nothing, and back to nothing', () => {
    const rich = richFile()
    const ops = roundTrip(file(), rich)
    expect(ops[0]).toMatchObject({ op: 'type.add' })
    expect(roundTrip(rich, { ...rich, types: [] })).toEqual([{ op: 'type.remove', type: 'custom_course' }])
  })
})

describe('diffModelFile: what is refused', () => {
  const course = (fields: ModelFileField[] = [TITLE], extra: Record<string, unknown> = {}) => type('custom_course', fields, extra)
  const refused = (base: ModelFile, next: ModelFile) => {
    const r = diffModelFile(base, next)
    expect(r.ops).toEqual([])
    return r.problems
  }
  const one = (base: ModelFile, next: ModelFile, type: string, field?: string) => {
    const problems = refused(base, next)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ code: 'not-changeable', type })
    if (field) expect(problems[0]!.field).toBe(field)
    else expect(problems[0]!.field).toBeUndefined()
    expect(problems[0]!.message.length).toBeGreaterThan(10)
    return problems[0]!
  }

  it('refuses a changed kind of field', () => {
    one(file(course([TITLE, text('a')])), file(course([TITLE, number('a')])), 'custom_course', 'a')
    one(file(course([TITLE, text('a')])), file(course([TITLE, { key: 'a', type: 'richtext', label: L('a') }])), 'custom_course', 'a')
  })

  it('refuses a changed decimal', () => {
    one(file(course([TITLE, number('n')])), file(course([TITLE, number('n', { decimal: true })])), 'custom_course', 'n')
    one(file(course([TITLE, number('n', { decimal: true })])), file(course([TITLE, number('n')])), 'custom_course', 'n')
  })

  it('refuses a changed relation target', () => {
    one(file(course([TITLE, relation('r', 'category')]), type('custom_b')), file(course([TITLE, relation('r', 'custom_b')]), type('custom_b')), 'custom_course', 'r')
  })

  it('refuses a changed page address, and pages on or off', () => {
    one(file(course([TITLE], { page: { prefix: 'a' } })), file(course([TITLE], { page: { prefix: 'b' } })), 'custom_course')
    one(file(course()), file(course([TITLE], { page: { prefix: 'a' } })), 'custom_course')
    one(file(course([TITLE], { page: { prefix: 'a' } })), file(course()), 'custom_course')
  })

  it('refuses publishing switched on or off', () => {
    one(file(course()), file(course([TITLE], { publish: true })), 'custom_course')
    one(file(course([TITLE], { publish: true })), file(course()), 'custom_course')
  })

  it('refuses a changed title field', () => {
    one(file(course([TITLE, text('name')])), file(course([TITLE, text('name')], { titleField: 'name' })), 'custom_course')
  })

  it('refuses a deleted choice and moved choices', () => {
    one(file(course([TITLE, select('s', ['a', 'b'])])), file(course([TITLE, select('s', ['a'])])), 'custom_course', 's')
    one(file(course([TITLE, select('s', ['a', 'b'])])), file(course([TITLE, select('s', ['b', 'a'])])), 'custom_course', 's')
    one(file(course([TITLE, select('s', ['a', 'b'])])), file(course([TITLE, select('s', ['c', 'a', 'b'])])), 'custom_course', 's')
  })

  it('takes a choice added at the end', () => {
    expect(diffModelFile(file(course([TITLE, select('s', ['a', 'b'])])), file(course([TITLE, select('s', ['a', 'b', 'c'])]))).problems).toEqual([])
  })

  it('refuses a new type whose title field is not title', () => {
    const next = file(course([text('name', { required: true })], { titleField: 'name' }))
    // The title field `name` is a text field; the new type would be made with `title`.
    const problems = refused(file(), next)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ code: 'not-changeable', type: 'custom_course' })
  })

  it('gives several problems when several things are refused', () => {
    const base = file(
      course([TITLE, text('a'), number('n')], { publish: true }),
      type('custom_other', [TITLE], { page: { prefix: 'o' } }),
    )
    const next = file(
      course([TITLE, number('a'), number('n', { decimal: true })], { publish: false }),
      type('custom_other', [TITLE], { page: { prefix: 'p' } }),
      type('custom_new', [text('name', { required: true })], { titleField: 'name' }),
    )
    const problems = refused(base, next)
    expect(problems.every((p) => p.code === 'not-changeable')).toBe(true)
    expect(problems.map((p) => `${p.type}.${p.field ?? ''}`).sort()).toEqual([
      'custom_course.',
      'custom_course.a',
      'custom_course.n',
      'custom_new.',
      'custom_other.',
    ])
  })

  it('refuses all of it, with no operations, even when something else could be sent', () => {
    const base = file(course([TITLE, text('a')]))
    const next = file(course([TITLE, number('a'), text('b')]))
    const r = diffModelFile(base, next)
    expect(r.ops).toEqual([])
    expect(r.problems).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------------------------
// Random pairs

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SEEDS = 320

/** Grows a document by random operations; each one that the site would refuse is skipped. */
class Grower {
  n = 0
  constructor(public rand: () => number, public doc: ModelDoc) {}
  int(n: number): number {
    return Math.floor(this.rand() * n)
  }
  chance(p: number): boolean {
    return this.rand() < p
  }
  pick<T>(xs: T[]): T | undefined {
    return xs.length ? xs[this.int(xs.length)] : undefined
  }
  label(word: string): Record<string, string> {
    const out: Record<string, string> = { cs: `${word}-cs` }
    if (this.chance(0.5)) out.en = `${word}-en`
    if (this.chance(0.2)) out.de = `${word}-de`
    return out
  }
  get visible() {
    return this.doc.types.filter((t) => !t.removedAt)
  }
  get hidden() {
    return this.doc.types.filter((t) => t.removedAt)
  }

  addType(): ModelOp {
    const id = ++this.n
    const op: ModelOp = { op: 'type.add', name: `custom_t${id}`, label: this.label(`T${id}`) }
    if (this.chance(0.5)) op.page = { prefix: `p${id}` }
    if (this.chance(0.5)) op.publish = true
    if (this.chance(0.3)) op.labelSingular = this.label(`S${id}`)
    if (this.chance(0.3)) op.description = this.label(`D${id}`)
    if (this.chance(0.3)) op.icon = 'i-lucide-star'
    if (this.chance(0.3)) op.titleLabel = this.label(`Title${id}`)
    if (this.chance(0.2)) op.order = this.chance(0.5) ? 'manual' : { by: 'title', dir: this.chance(0.5) ? 'asc' : 'desc' }
    return op
  }

  addField(): ModelOp | null {
    const t = this.pick(this.visible)
    if (!t) return null
    const id = ++this.n
    const key = `f${id}`
    const label = this.label(`F${id}`)
    const kind = this.pick(['text', 'richtext', 'number', 'boolean', 'datetime', 'select', 'media', 'file', 'gallery', 'color', 'relation'])
    let field: Record<string, unknown> = { type: kind, key, label }
    if (this.chance(0.3)) field.help = this.label(`H${id}`)
    const req = () => (this.chance(0.35) ? { required: true } : {})
    switch (kind) {
      case 'text':
        field = { ...field, ...req(), ...(this.chance(0.3) ? { long: true } : {}), ...(this.chance(0.3) ? { format: this.pick(['email', 'url', 'link']) } : {}), ...(this.chance(0.3) ? { max: 1 + this.int(500) } : {}) }
        break
      case 'richtext':
      case 'color':
        field = { ...field, ...req() }
        break
      case 'number': {
        const min = this.chance(0.4) ? this.int(5) : undefined
        field = { ...field, ...req(), ...(this.chance(0.4) ? { decimal: true } : {}), ...(min !== undefined ? { min } : {}), ...(this.chance(0.4) ? { max: (min ?? 0) + this.int(100) } : {}) }
        break
      }
      case 'boolean':
        if (this.chance(0.5)) field.default = this.chance(0.5)
        break
      case 'datetime':
        field = { ...field, ...req(), ...(this.chance(0.4) ? { allDay: true } : {}) }
        break
      case 'select': {
        const count = 1 + this.int(4)
        const options = Array.from({ length: count }, (_, i) => ({ value: `o${i + 1}`, label: this.label(`O${i + 1}`) }))
        field = { ...field, ...req(), options }
        if (this.chance(0.4)) field.default = this.pick(options)!.value
        break
      }
      case 'relation': {
        const to = this.pick([...this.visible.map((x) => x.name), 'category'])
        field.to = to
        break
      }
      default:
    }
    const after = this.chance(0.5) ? this.pick(t.fields.filter((x) => !x.removedAt).map((x) => x.key)) : undefined
    return { op: 'field.add', type: t.name, field: field as never, ...(after ? { after } : {}) }
  }

  updateField(): ModelOp | null {
    const t = this.pick(this.visible)
    const f = t && this.pick(t.fields.filter((x) => !x.removedAt))
    if (!t || !f) return null
    const id = ++this.n
    const op: Extract<ModelOp, { op: 'field.update' }> = { op: 'field.update', type: t.name, key: f.key }
    if (this.chance(0.4)) op.label = this.label(`L${id}`)
    if (this.chance(0.3)) op.help = this.chance(0.3) ? null : this.label(`H${id}`)
    switch (f.type) {
      case 'text':
        if (this.chance(0.4)) op.required = this.chance(0.5)
        if (this.chance(0.4)) op.long = this.chance(0.5)
        if (this.chance(0.4)) op.format = this.pick([null, 'email', 'url', 'link'] as const) ?? null
        if (this.chance(0.4)) op.max = this.chance(0.3) ? null : 1 + this.int(900)
        break
      case 'richtext':
      case 'color':
        if (this.chance(0.5)) op.required = this.chance(0.5)
        break
      case 'number':
        if (this.chance(0.4)) op.required = this.chance(0.5)
        if (this.chance(0.4)) op.min = this.chance(0.3) ? null : this.int(3)
        if (this.chance(0.4)) op.max = this.chance(0.3) ? null : 50 + this.int(50)
        break
      case 'boolean':
        if (this.chance(0.6)) op.default = this.chance(0.5)
        break
      case 'datetime':
        if (this.chance(0.4)) op.required = this.chance(0.5)
        if (this.chance(0.5)) op.allDay = this.chance(0.5)
        break
      case 'select': {
        if (this.chance(0.3)) op.required = this.chance(0.5)
        const removed = f.options.filter((o) => o.removed)
        const live = f.options.filter((o) => !o.removed)
        if (this.chance(0.4)) op.optionLabels = { [this.pick(f.options)!.value]: this.label(`OL${id}`) }
        if (this.chance(0.4)) op.addOptions = [{ value: `n${id}`, label: this.label(`N${id}`) }]
        if (this.chance(0.3) && live.length > 1) op.removeOptions = [this.pick(live)!.value]
        if (this.chance(0.3) && removed.length) op.restoreOptions = [this.pick(removed)!.value]
        if (this.chance(0.4)) op.default = this.chance(0.3) ? null : (this.pick(live)?.value ?? null)
        break
      }
      default:
    }
    return op
  }

  removeField(): ModelOp | null {
    const t = this.pick(this.visible)
    const f = t && this.pick(t.fields.filter((x) => !x.removedAt))
    return t && f ? { op: 'field.remove', type: t.name, key: f.key } : null
  }

  restoreField(): ModelOp | null {
    const t = this.pick(this.visible)
    const f = t && this.pick(t.fields.filter((x) => x.removedAt))
    return t && f ? { op: 'field.restore', type: t.name, key: f.key } : null
  }

  removeType(): ModelOp | null {
    const t = this.pick(this.visible)
    return t ? { op: 'type.remove', type: t.name } : null
  }

  restoreType(): ModelOp | null {
    const t = this.pick(this.hidden)
    return t ? { op: 'type.restore', type: t.name } : null
  }

  updateType(): ModelOp | null {
    const t = this.pick(this.visible)
    if (!t) return null
    const id = ++this.n
    const keys = t.fields.filter((x) => !x.removedAt).map((x) => x.key)
    const op: Extract<ModelOp, { op: 'type.update' }> = { op: 'type.update', type: t.name }
    if (this.chance(0.3)) op.label = this.label(`TL${id}`)
    if (this.chance(0.3)) op.labelSingular = this.chance(0.3) ? null : this.label(`SL${id}`)
    if (this.chance(0.3)) op.description = this.chance(0.3) ? null : this.label(`DL${id}`)
    if (this.chance(0.3)) op.icon = this.chance(0.3) ? null : 'i-lucide-heart'
    if (this.chance(0.5)) {
      const cols = [...keys].sort(() => this.rand() - 0.5).slice(0, 1 + this.int(4))
      if (t.page && this.chance(0.2)) cols.push('slug')
      op.listColumns = this.chance(0.2) ? null : cols
    }
    if (this.chance(0.5)) {
      const r = this.rand()
      op.order = r < 0.2 ? null : r < 0.35 ? 'manual' : { by: this.pick(keys) ?? 'title', dir: this.chance(0.5) ? 'asc' : 'desc' }
    }
    if (t.page && this.chance(0.5)) {
      op.page = {}
      if (this.chance(0.7)) op.page.image = this.chance(0.2) ? null : (this.pick(t.fields.filter((x) => !x.removedAt && x.type === 'media').map((x) => x.key)) ?? null)
      if (this.chance(0.7)) op.page.summary = this.chance(0.2) ? null : (this.pick(t.fields.filter((x) => !x.removedAt && x.type === 'text').map((x) => x.key)) ?? null)
    }
    return op
  }

  reorder(): ModelOp | null {
    const t = this.pick(this.visible)
    if (!t) return null
    const keys = t.fields.filter((x) => !x.removedAt).map((x) => x.key)
    return { op: 'field.order', type: t.name, keys: [...keys].sort(() => this.rand() - 0.5) }
  }

  step(): void {
    const r = this.rand()
    const op =
      r < 0.08 ? this.addType()
      : r < 0.3 ? this.addField()
      : r < 0.5 ? this.updateField()
      : r < 0.58 ? this.removeField()
      : r < 0.62 ? this.restoreField()
      : r < 0.67 ? this.removeType()
      : r < 0.71 ? this.restoreType()
      : r < 0.88 ? this.updateType()
      : this.reorder()
    if (!op) return
    try {
      this.doc = applyModelOps(this.doc, [op], ctx()).doc
    } catch (e) {
      if (!(e instanceof ModelProblem)) throw e
    }
  }

  run(steps: number): void {
    for (let i = 0; i < steps; i++) {
      // The first steps make a type, so there is something to change.
      if (this.visible.length < 2 && i < 6) {
        try {
          this.doc = applyModelOps(this.doc, [this.addType()], ctx()).doc
        } catch (e) {
          if (!(e instanceof ModelProblem)) throw e
        }
        continue
      }
      this.step()
    }
  }
}

describe('diffModelFile: random pairs', () => {
  it(`round-trips ${SEEDS} random pairs of files`, () => {
    let withOps = 0
    let totalOps = 0
    const seen = new Set<string>()
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = new Grower(mulberry32(seed), emptyModelDoc())
      g.run(10 + (seed % 25))
      const baseDoc = g.doc
      g.run(5 + (seed % 20))
      const nextDoc = g.doc
      const base = modelFileOf(baseDoc, { version: 3, site: 'https://x.example' })
      const next = modelFileOf(nextDoc, { version: 4, site: 'https://x.example' })
      const { ops, problems } = diffModelFile(base, next)
      expect(problems, `seed ${seed}`).toEqual([])
      let out: ModelDoc
      try {
        out = applyModelOps(modelFileDoc(base), ops, ctx()).doc
      } catch (e) {
        throw new Error(`seed ${seed}: the operations were refused: ${(e as Error).message}\n${JSON.stringify(ops)}`)
      }
      const got = modelFileOf(out, { version: 4, site: 'https://x.example' })
      expect(writeModelFile(sortedTypes(got)), `seed ${seed}`).toBe(writeModelFile(sortedTypes(next)))
      // The text of the file and the lines for the operations are there for every pair.
      expect(parseModelFile(JSON.parse(writeModelFile(next))), `seed ${seed}`).toEqual(next)
      expect(describeModelOps(ops), `seed ${seed}`).toHaveLength(ops.length)
      if (ops.length) withOps++
      totalOps += ops.length
      for (const op of ops) seen.add(op.op)
    }
    // The pairs are not all alike: most of them change something, and every kind of operation turns up.
    expect(withOps).toBeGreaterThan(SEEDS * 0.8)
    expect(totalOps).toBeGreaterThan(SEEDS * 3)
    for (const kind of ['type.add', 'type.remove', 'type.update', 'field.add', 'field.update', 'field.remove', 'field.order']) expect(seen.has(kind), kind).toBe(true)
  })

  it('has a file of the next document that parses, for every pair', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const g = new Grower(mulberry32(seed * 7919), emptyModelDoc())
      g.run(30)
      const file = modelFileOf(g.doc, { version: seed })
      expect(() => parseModelFile(JSON.parse(writeModelFile(file))), `seed ${seed * 7919}`).not.toThrow()
    }
  })
})

describe('describeModelOps', () => {
  it('says one thing per operation, in plain English', () => {
    const lines = describeModelOps([
      { op: 'type.add', name: 'custom_course', label: { cs: 'Kurzy', en: 'Courses' } },
      { op: 'type.add', name: 'custom_event', label: { cs: 'Akce', en: 'Events' }, page: { prefix: 'akce' }, publish: true },
      { op: 'field.remove', type: 'custom_course', key: 'price' },
      { op: 'type.remove', type: 'custom_old' },
    ])
    expect(lines).toEqual([
      'adds the type custom_course (Courses)',
      'adds the type custom_event (Events), with pages at /akce/, with drafts and publishing',
      'hides the field price of custom_course: it can be restored in the admin',
      'hides the type custom_old with its entries: it can be restored in the admin',
    ])
  })

  it('says what a field.add, a restore and an order are', () => {
    expect(
      describeModelOps([
        { op: 'field.add', type: 'custom_course', field: { type: 'text', key: 'perex', label: { cs: 'Perex', en: 'Teaser' }, required: true }, after: 'title' },
        { op: 'field.add', type: 'custom_course', field: { type: 'relation', key: 'cat', label: L('Kategorie'), to: 'category' } },
        { op: 'field.restore', type: 'custom_course', key: 'price' },
        { op: 'type.restore', type: 'custom_old' },
        { op: 'field.order', type: 'custom_course', keys: ['b', 'a'] },
      ]),
    ).toEqual([
      'adds the field perex (Teaser) to custom_course: text, required, after title',
      'adds the field cat (Kategorie) to custom_course: a relation to category',
      'restores the field price of custom_course',
      'restores the type custom_old',
      'puts the fields of custom_course in this order: b, a',
    ])
  })

  it('says what a type.update and a field.update change', () => {
    expect(
      describeModelOps([
        { op: 'type.update', type: 'custom_course', label: { cs: 'K', en: 'Courses' }, icon: null, listColumns: ['title', 'price'], order: { by: 'price', dir: 'desc' }, page: { image: 'cover', summary: null } },
        { op: 'field.update', type: 'custom_course', key: 'level', required: true, addOptions: [{ value: 'x', label: L('X') }], removeOptions: ['a', 'b'], restoreOptions: ['c'], optionLabels: { d: L('D') } },
        { op: 'field.update', type: 'custom_course', key: 'price', min: 0, max: null, help: null },
      ]),
    ).toEqual([
      'changes the type custom_course: sets the label to "Courses", removes the icon, shows the columns title and price in the list, orders entries by price, descending, sets the page picture to cover, removes the page summary',
      'changes the field level of custom_course: makes it required, relabels the choice d, adds the choice x, stops offering the choices a and b, offers the choice c again',
      'changes the field price of custom_course: removes the help text, sets the smallest number to 0, removes the largest value',
    ])
  })

  it('gives a non-empty line without "undefined" for every kind of operation', () => {
    const ops: ModelOp[] = [
      { op: 'type.add', label: L('Kurzy') },
      { op: 'type.add', label: L('Kurzy'), page: {}, publish: true },
      { op: 'type.update', type: 'custom_a' },
      { op: 'type.update', type: 'custom_a', labelSingular: null, description: L('x'), listColumns: null, order: 'manual' },
      { op: 'type.update', type: 'custom_a', order: null },
      { op: 'type.remove', type: 'custom_a' },
      { op: 'type.restore', type: 'custom_a' },
      { op: 'field.add', type: 'custom_a', field: { type: 'boolean', label: L('On') } },
      { op: 'field.add', type: 'custom_a', field: { type: 'select', label: L('S'), options: [{ label: L('A') }] } },
      { op: 'field.update', type: 'custom_a', key: 'k' },
      { op: 'field.update', type: 'custom_a', key: 'k', long: false, format: null, allDay: true, default: false, addOptions: [{ label: L('New') }] },
      { op: 'field.update', type: 'custom_a', key: 'k', default: 'x', required: false, help: L('h') },
      { op: 'field.remove', type: 'custom_a', key: 'k' },
      { op: 'field.restore', type: 'custom_a', key: 'k' },
      { op: 'field.order', type: 'custom_a', keys: ['a', 'b'] },
      { op: 'purge' },
      { op: 'purge', types: ['custom_a', 'custom_b'], fields: [{ type: 'custom_c', key: 'x' }] },
    ]
    const lines = describeModelOps(ops)
    expect(lines).toHaveLength(ops.length)
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(5)
      expect(line).not.toContain('undefined')
      expect(line).not.toContain('null')
      expect(line).not.toContain('[object')
    }
    for (const kind of ['type.add', 'type.update', 'type.remove', 'type.restore', 'field.add', 'field.update', 'field.remove', 'field.restore', 'field.order', 'purge']) {
      expect(ops.some((o) => o.op === kind), kind).toBe(true)
    }
  })

  it('has no lines for no operations', () => {
    expect(describeModelOps([])).toEqual([])
  })

  it('describes what a real difference does', () => {
    const lines = describeModelOps(roundTrip(file(type('custom_a', [TITLE, text('x')])), file(type('custom_a', [TITLE, text('y')]), type('custom_b'))))
    expect(lines).toEqual([
      'hides the field x of custom_a: it can be restored in the admin',
      'adds the type custom_b (custom_b)',
      'adds the field y (y) to custom_a: text, after title',
    ])
  })
})

describe('customModelConfig', () => {
  const category = defineEntity('category', { label: 'Categories', titleField: 'name', fields: { name: f.text({ required: true }) }, content: { public: true } })
  const design = { category }

  it('keeps the exports of the design and adds each visible custom type under custom:<name>', () => {
    const doc = applyModelOps(richDoc(), [
      { op: 'type.add', name: 'custom_extra', label: L('Extra') },
      { op: 'type.add', name: 'custom_gone', label: L('Pryč') },
      { op: 'type.remove', type: 'custom_gone' },
    ], ctx()).doc
    const { config, problems } = customModelConfig(design, doc)
    expect(problems).toEqual([])
    expect(config.category).toBe(category)
    expect(Object.keys(config).sort()).toEqual(['category', 'custom:custom_course', 'custom:custom_extra'])
    expect(config['custom:custom_gone']).toBeUndefined()
    expect(config['custom:custom_course']).toBeDefined()
    expect(config['custom:custom_course'].name).toBe('custom_course')
  })

  it('does not change the design it was given', () => {
    const before = { ...design }
    customModelConfig(design, richDoc())
    expect(design).toEqual(before)
    expect(Object.keys(design)).toEqual(['category'])
  })

  it('has just the design for a document with no types', () => {
    const { config, problems } = customModelConfig(design, emptyModelDoc())
    expect(config).toEqual({ category })
    expect(problems).toEqual([])
  })

  it('reports a relation to a collection that is not there, and still builds the type', () => {
    const doc = applyModelOps(emptyModelDoc(), [
      { op: 'type.add', name: 'custom_a', label: L('A') },
      { op: 'field.add', type: 'custom_a', field: { type: 'relation', key: 'cat', label: L('Kategorie'), to: 'category' } },
    ], ctx()).doc
    const none = customModelConfig({}, doc)
    expect(none.problems.length).toBeGreaterThan(0)
    expect(none.problems[0]).toMatchObject({ type: 'custom_a' })
    expect(none.problems.some((p) => p.field === 'cat' || p.message.includes('cat') || p.message.includes('category'))).toBe(true)
  })
})
