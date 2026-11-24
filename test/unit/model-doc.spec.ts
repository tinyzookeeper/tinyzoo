import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MODEL_LIMITS,
  MODEL_PURGE_AFTER_MS,
  MODEL_PURGE_EMPTY_AFTER_MS,
  ModelProblem,
  applyModelOps,
  emptyModelDoc,
  modelFieldKey,
  modelPagePrefix,
  modelPurgeDue,
  modelTypeName,
  parseModelDoc,
  type ModelContext,
  type ModelDoc,
  type ModelOp,
} from '../../packages/cms/src/model-doc'

const NOW = new Date('2026-11-24T12:00:00.000Z')
const at = (ms: number): Date => new Date(NOW.getTime() + ms)
const DAY = 24 * 60 * 60 * 1000

const ctx = (over: Partial<ModelContext> = {}): ModelContext => ({
  design: [
    { name: 'category', singleton: false, pathPrefix: 'kategorie' },
    { name: 'settings', singleton: true, pathPrefix: null },
    { name: 'page', singleton: false, pathPrefix: null },
  ],
  limits: { ...DEFAULT_MODEL_LIMITS },
  now: NOW,
  ...over,
})

/** A context where the types are known to be empty, so required fields may be added. */
const empty = (extra: Partial<ModelContext> = {}): ModelContext =>
  ctx({ counts: { entries: { x_course: 0, x_teacher: 0 } }, ...extra })

const L = (cs: string) => ({ cs })

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v)
    Object.freeze(value)
  }
  return value
}

/** Catches the refusal of a change and returns it. */
function refusal(fn: () => unknown): ModelProblem {
  try {
    fn()
  } catch (e) {
    if (e instanceof ModelProblem) return e
    throw e
  }
  throw new Error('expected a refusal, nothing was thrown')
}

const apply = (doc: ModelDoc, ops: ModelOp[], c: ModelContext = ctx()) => applyModelOps(doc, ops, c)
const refuse = (doc: ModelDoc, ops: ModelOp[], code: string, op = ops.length - 1, c: ModelContext = ctx()): ModelProblem => {
  const p = refusal(() => apply(doc, ops, c))
  expect({ code: p.code, op: p.op }).toEqual({ code, op })
  return p
}

/** A type of courses with a page, publishing and one field of most kinds. */
function courses(): ModelDoc {
  return apply(emptyModelDoc(), [
    { op: 'type.add', name: 'x_course', label: { cs: 'Kurzy', en: 'Courses' }, page: {}, publish: true },
    { op: 'field.add', type: 'x_course', field: { type: 'text', key: 'perex', label: L('Perex'), long: true } },
    {
      op: 'field.add',
      type: 'x_course',
      field: {
        type: 'select',
        key: 'level',
        label: L('Úroveň'),
        required: true,
        default: 'beginner',
        options: [{ value: 'beginner', label: L('Začátečník') }, { value: 'advanced', label: L('Pokročilý') }],
      },
    },
    { op: 'field.add', type: 'x_course', field: { type: 'media', key: 'cover', label: L('Obrázek') } },
    { op: 'field.add', type: 'x_course', field: { type: 'datetime', key: 'startsAt', label: L('Začátek') } },
    { op: 'field.add', type: 'x_course', field: { type: 'number', key: 'price', label: L('Cena') } },
    { op: 'field.add', type: 'x_course', field: { type: 'relation', key: 'category', label: L('Kategorie'), to: 'category' } },
  ], empty()).doc
}

/** Courses and teachers; a teacher field points at a course. */
function twoTypes(): ModelDoc {
  return apply(courses(), [
    { op: 'type.add', name: 'x_teacher', label: L('Lektoři') },
    { op: 'field.add', type: 'x_teacher', field: { type: 'relation', key: 'course', label: L('Kurz'), to: 'x_course' } },
  ], empty()).doc
}

const course = (doc: ModelDoc) => doc.types.find((t) => t.name === 'x_course')!
const fieldOf = (doc: ModelDoc, type: string, key: string) => doc.types.find((t) => t.name === type)!.fields.find((f) => f.key === key)!

describe('parseModelDoc', () => {
  it('reads a good document and returns it unchanged', () => {
    const doc = courses()
    expect(parseModelDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
    expect(parseModelDoc(emptyModelDoc())).toEqual({ format: 1, types: [] })
  })

  it('refuses unknown keys, at any depth', () => {
    const doc = JSON.parse(JSON.stringify(courses()))
    expect(refusal(() => parseModelDoc({ ...doc, extra: 1 })).code).toBe('invalid-doc')
    doc.types[0].extra = 1
    expect(refusal(() => parseModelDoc(doc)).code).toBe('invalid-doc')
    delete doc.types[0].extra
    doc.types[0].fields[0].extra = 1
    const p = refusal(() => parseModelDoc(doc))
    expect(p.code).toBe('invalid-doc')
    expect(p.op).toBe(-1)
    expect(p.message).toContain('fields[0]')
  })

  it('refuses a newer format and names both numbers', () => {
    const p = refusal(() => parseModelDoc({ format: 2, types: [] }))
    expect(p.code).toBe('invalid-doc')
    expect(p.message).toContain('newer tinyzoo')
    expect(p.message).toContain('format 2')
    expect(p.message).toContain('format 1')
    expect(refusal(() => parseModelDoc({ format: 0, types: [] })).code).toBe('invalid-doc')
    expect(refusal(() => parseModelDoc(null)).code).toBe('invalid-doc')
  })

  it('refuses an unknown kind of field', () => {
    const doc = JSON.parse(JSON.stringify(courses()))
    doc.types[0].fields.push({ key: 'x', type: 'hologram', label: L('X') })
    const p = refusal(() => parseModelDoc(doc))
    expect(p.code).toBe('invalid-doc')
    expect(p.message).toContain('unknown kind of field')
  })

  it('refuses a bare string label and an empty label', () => {
    const doc = JSON.parse(JSON.stringify(courses()))
    doc.types[0].label = 'Kurzy'
    expect(refusal(() => parseModelDoc(doc)).message).toContain('types[0].label')
    doc.types[0].label = {}
    expect(refusal(() => parseModelDoc(doc)).message).toContain('at least one language')
    doc.types[0].label = { 'not a language': 'Kurzy' }
    expect(refusal(() => parseModelDoc(doc)).code).toBe('invalid-doc')
    doc.types[0].label = { cs: 'a'.repeat(81) }
    expect(refusal(() => parseModelDoc(doc)).code).toBe('invalid-doc')
  })

  it('accepts language keys like pt-BR', () => {
    const doc = JSON.parse(JSON.stringify(courses()))
    doc.types[0].label = { cs: 'Kurzy', 'pt-BR': 'Cursos' }
    expect(parseModelDoc(doc).types[0]!.label['pt-BR']).toBe('Cursos')
  })

  it('checks the rules between names and fields', () => {
    const bad = (change: (d: any) => void, text: string) => {
      const doc = JSON.parse(JSON.stringify(courses()))
      change(doc)
      const p = refusal(() => parseModelDoc(doc))
      expect(p.code).toBe('invalid-doc')
      expect(p.message).toContain(text)
    }
    bad((d) => { d.types[0].name = 'course' }, 'not a type name')
    bad((d) => { d.types.push(JSON.parse(JSON.stringify(d.types[0]))) }, 'two types')
    bad((d) => { d.types[0].fields[1].key = 'Perex' }, 'not a field key')
    bad((d) => { d.types[0].fields[1].key = 'title' }, 'two fields')
    bad((d) => { d.types[0].fields[1].key = 'slug' }, 'tinyzoo uses')
    bad((d) => { d.types[0].titleField = 'perex'; d.types[0].fields[1].removedAt = NOW.toISOString() }, 'titleField')
    bad((d) => { d.types[0].titleField = 'price' }, 'titleField')
    bad((d) => { d.types[0].fields[2].options = [] }, 'at least one choice')
    bad((d) => { d.types[0].fields[2].options.push({ value: 'beginner', label: L('X') }) }, 'twice')
    bad((d) => { d.types[0].fields[2].default = 'gone' }, 'not one of the choices')
  })

  it('refuses a document over the size limit', () => {
    const doc = JSON.parse(JSON.stringify(courses()))
    doc.types[0].description = { cs: 'a'.repeat(300) }
    for (let i = 0; i < 600; i++) {
      const t = JSON.parse(JSON.stringify(doc.types[0]))
      t.name = `x_t${i}`
      t.page = null
      doc.types.push(t)
    }
    const p = refusal(() => parseModelDoc(doc))
    expect(p.code).toBe('invalid-doc')
    expect(p.message).toContain('larger than')
  })
})

describe('names', () => {
  it('makes a type name from a Czech label', () => {
    expect(modelTypeName('Kurzy a školení')).toBe('x_kurzy_a_skoleni')
    expect(modelTypeName('Ceník')).toBe('x_cenik')
    expect(modelTypeName('  Žluťoučký kůň!  ')).toBe('x_zlutoucky_kun')
    expect(modelTypeName('2024 akce')).toBe('x_type')
    expect(modelTypeName('???')).toBe('x_type')
  })

  it('keeps a type name within 26 characters, with numbers too', () => {
    const long = modelTypeName('Velmi dlouhý název typu obsahu webu')
    expect(long.length).toBeLessThanOrEqual(26)
    expect(long.endsWith('_')).toBe(false)
    const second = modelTypeName('Velmi dlouhý název typu obsahu webu', [long])
    expect(second.length).toBeLessThanOrEqual(26)
    expect(second.endsWith('2')).toBe(true)
    expect(second).not.toBe(long)
  })

  it('adds numbers to a type name that is taken', () => {
    expect(modelTypeName('Kurzy', ['x_kurzy'])).toBe('x_kurzy2')
    expect(modelTypeName('Kurzy', ['x_kurzy', 'x_kurzy2'])).toBe('x_kurzy3')
  })

  it('never makes a name the database uses for its own tables', () => {
    expect(modelTypeName('Jedna to druhá')).toBe('x_jedna_druha')
    expect(modelTypeName('Locales')).not.toMatch(/_locales$/)
  })

  it('makes a field key in lower camel case', () => {
    expect(modelFieldKey('Datum zahájení')).toBe('datumZahajeni')
    expect(modelFieldKey('Úroveň kurzu')).toBe('uroven' + 'Kurzu')
    expect(modelFieldKey('Cena')).toBe('cena')
    expect(modelFieldKey('2 dny')).toBe('field')
    expect(modelFieldKey('')).toBe('field')
  })

  it('numbers a field key that is taken or reserved', () => {
    expect(modelFieldKey('Cena', ['cena'])).toBe('cena2')
    expect(modelFieldKey('Status')).toBe('status2')
    expect(modelFieldKey('Slug')).toBe('slug2')
    expect(modelFieldKey('Page')).toBe('page2')
    expect(modelFieldKey('Id')).toBe('id2')
  })

  it('keeps a generated column within 27 characters', () => {
    const key = modelFieldKey('Velmi dlouhý název pole který nikdy neskončí a neskončí')
    expect(key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()).length).toBeLessThanOrEqual(27)
    expect(key).toMatch(/^[a-z][a-zA-Z0-9]*$/)
  })

  it('makes a page prefix', () => {
    expect(modelPagePrefix('Kurzy a školení')).toBe('kurzy-a-skoleni')
    expect(modelPagePrefix('Kurzy', ['kurzy'])).toBe('kurzy-2')
    expect(modelPagePrefix('Admin')).toBe('admin-2')
    expect(modelPagePrefix('API')).toBe('api-2')
    expect(modelPagePrefix('!!!')).toBe('entries')
    expect(modelPagePrefix('x'.repeat(100)).length).toBe(40)
    expect(modelPagePrefix('x'.repeat(100), ['x'.repeat(40)]).length).toBeLessThanOrEqual(40)
  })

  it('refuses given names that are not valid', () => {
    const doc = emptyModelDoc()
    const add = (name: string) => [{ op: 'type.add', name, label: L('A') }] as ModelOp[]
    for (const name of ['course', 'x_', 'x_1a', 'X_course', 'x_course_', 'x_a__b', 'x_' + 'a'.repeat(25), 'x_course_locales', 'x_a_to_b']) {
      expect(refusal(() => apply(doc, add(name))).code, name).toBe('invalid-name')
    }
    const withPage = (prefix: string) => [{ op: 'type.add', label: L('A'), page: { prefix } }] as ModelOp[]
    for (const prefix of ['Kurzy', '-a', 'a--b', 'a_b', 'a'.repeat(41), 'admin', 'api', 'home']) {
      expect(refusal(() => apply(doc, withPage(prefix))).code, prefix).toBe('invalid-prefix')
    }
  })

  it('refuses a given field key that is reserved, invalid or too long', () => {
    const doc = courses()
    const add = (key: string, type: 'text' | 'relation' = 'text') =>
      [{ op: 'field.add', type: 'x_course', field: type === 'text' ? { type, key, label: L('A') } : { type, key, label: L('A'), to: 'category' } }] as ModelOp[]
    for (const key of ['id', 'createdAt', 'locale', 'path', 'preview', 'page', 'limit', 'sort', 'q', 'slug', 'status', 'position', '_hidden']) {
      expect(refusal(() => apply(doc, add(key))).code, key).toBe('reserved-key')
    }
    for (const key of ['Title', '1a', 'a_b', 'a-b', '']) {
      expect(refusal(() => apply(doc, add(key))).code, key).toBe('invalid-name')
    }
    // 30 characters is the longest column; a relation also has `_id`.
    const thirty = 'a'.repeat(30)
    expect(() => apply(doc, add(thirty))).not.toThrow()
    expect(refusal(() => apply(doc, add('a'.repeat(31)))).code).toBe('invalid-name')
    expect(refusal(() => apply(doc, add('a'.repeat(28), 'relation'))).code).toBe('invalid-name')
    expect(() => apply(doc, add('a'.repeat(27), 'relation'))).not.toThrow()
  })
})

describe('type.add', () => {
  it('adds a type with a title field and made-up names', () => {
    const { doc } = apply(emptyModelDoc(), [{ op: 'type.add', label: { cs: 'Kurzy a školení', en: 'Courses' }, page: {}, publish: true }])
    expect(doc.types).toEqual([{
      name: 'x_kurzy_a_skoleni',
      label: { cs: 'Kurzy a školení', en: 'Courses' },
      labelSingular: null,
      description: null,
      icon: null,
      titleField: 'title',
      page: { prefix: 'kurzy-a-skoleni', image: null, summary: null },
      publish: true,
      order: null,
      listColumns: null,
      removedAt: null,
      fields: [{ key: 'title', type: 'text', required: true, label: { cs: 'Název', en: 'Title', de: 'Titel' } }],
    }])
  })

  it('takes given names, a title label, icon and order', () => {
    const { doc } = apply(emptyModelDoc(), [{
      op: 'type.add',
      name: 'x_course',
      label: L('Kurzy'),
      labelSingular: L('Kurz'),
      description: L('Naše kurzy'),
      icon: 'i-lucide-graduation-cap',
      page: { prefix: 'nase-kurzy' },
      order: { by: 'title', dir: 'asc' },
      titleLabel: L('Jméno'),
    }])
    const t = doc.types[0]!
    expect(t.name).toBe('x_course')
    expect(t.page).toEqual({ prefix: 'nase-kurzy', image: null, summary: null })
    expect(t.publish).toBe(false)
    expect(t.order).toEqual({ by: 'title', dir: 'asc' })
    expect(t.fields[0]!.label).toEqual(L('Jméno'))
  })

  it('accepts manual order', () => {
    const { doc } = apply(emptyModelDoc(), [{ op: 'type.add', label: L('A'), order: 'manual' }])
    expect(doc.types[0]!.order).toBe('manual')
  })

  it('numbers names and prefixes that are taken, hidden types and the design included', () => {
    const first = apply(emptyModelDoc(), [{ op: 'type.add', label: L('Kurzy'), page: {} }]).doc
    const hidden = apply(first, [{ op: 'type.remove', type: 'x_kurzy' }]).doc
    const { doc } = apply(hidden, [
      { op: 'type.add', label: L('Kurzy'), page: {} },
      { op: 'type.add', label: L('Kategorie'), page: {} },
    ])
    expect(doc.types.map((t) => t.name)).toEqual(['x_kurzy', 'x_kurzy2', 'x_kategorie'])
    expect(doc.types.map((t) => t.page?.prefix)).toEqual(['kurzy', 'kurzy-2', 'kategorie-2'])
    const withDesignName = apply(emptyModelDoc(), [{ op: 'type.add', label: L('Page') }], ctx({ design: [{ name: 'x_page', singleton: false, pathPrefix: null }] }))
    expect(withDesignName.doc.types[0]!.name).toBe('x_page2')
  })

  it('refuses a name or prefix that is taken', () => {
    const doc = courses()
    refuse(doc, [{ op: 'type.add', name: 'x_course', label: L('A') }], 'name-taken')
    refuse(doc, [{ op: 'type.add', name: 'x_kurzy', label: L('A'), page: { prefix: 'kategorie' } }], 'prefix-taken')
    refuse(doc, [{ op: 'type.add', label: L('A'), page: { prefix: 'kurzy' } }], 'prefix-taken')
    const hidden = apply(doc, [{ op: 'type.remove', type: 'x_course' }]).doc
    refuse(hidden, [{ op: 'type.add', name: 'x_course', label: L('A') }], 'name-taken')
    refuse(hidden, [{ op: 'type.add', label: L('A'), page: { prefix: 'kurzy' } }], 'prefix-taken')
    refuse(doc, [{ op: 'type.add', name: 'x_cat', label: L('A') }, { op: 'type.add', name: 'x_cat', label: L('B') }], 'name-taken', 1)
    expect(() => apply(doc, [{ op: 'type.add', label: L('A'), name: 'x_a' }], ctx({ design: [{ name: 'x_a', singleton: false, pathPrefix: null }] }))).toThrow(expect.objectContaining({ code: 'name-taken' }))
  })

  it('refuses an order by a field the new type does not have', () => {
    refuse(emptyModelDoc(), [{ op: 'type.add', label: L('A'), order: { by: 'price', dir: 'asc' } }], 'unknown-field', 0)
  })

  it('refuses labels, icons and the limit of types', () => {
    const doc = emptyModelDoc()
    refuse(doc, [{ op: 'type.add', label: {} }], 'invalid-label', 0)
    refuse(doc, [{ op: 'type.add', label: { cs: '  ' } }], 'invalid-label', 0)
    refuse(doc, [{ op: 'type.add', label: { 'czech': 'A' } }], 'invalid-label', 0)
    refuse(doc, [{ op: 'type.add', label: { cs: 'a'.repeat(81) } }], 'limit-label', 0)
    expect(() => apply(doc, [{ op: 'type.add', label: { cs: 'a'.repeat(80) } }])).not.toThrow()
    refuse(doc, [{ op: 'type.add', label: L('A'), description: { cs: 'a'.repeat(301) } }], 'limit-help', 0)
    expect(() => apply(doc, [{ op: 'type.add', label: L('A'), description: { cs: 'a'.repeat(300) } }])).not.toThrow()
    for (const icon of ['lucide-book', 'i-', 'i-Book', 'i-' + 'a'.repeat(80)]) {
      refuse(doc, [{ op: 'type.add', label: L('A'), icon }], 'invalid-icon', 0)
    }
    const c = ctx({ limits: { types: 2, fields: 30, options: 30 } })
    refuse(doc, [{ op: 'type.add', label: L('A') }, { op: 'type.add', label: L('B') }, { op: 'type.add', label: L('C') }], 'limit-types', 2, c)
    // hidden types count
    const two = apply(doc, [{ op: 'type.add', label: L('A') }, { op: 'type.add', label: L('B') }, { op: 'type.remove', type: 'x_b' }], c).doc
    refuse(two, [{ op: 'type.add', label: L('C') }], 'limit-types', 0, c)
  })

  it('refuses a model over the size limit', () => {
    const ops: ModelOp[] = Array.from({ length: 700 }, (_, i) => ({ op: 'type.add', label: L(`T${i}`), description: { cs: 'a'.repeat(300) } }))
    const p = refusal(() => apply(emptyModelDoc(), ops, ctx({ limits: { types: 10000, fields: 30, options: 30 } })))
    expect(p.code).toBe('limit-size')
    expect(p.op).toBeGreaterThan(100)
  })

  it('refuses a type name and a choice type that would be equal (both ways)', () => {
    // x_course with a select `level` makes the choice type x_course_level.
    const doc = courses()
    refuse(doc, [{ op: 'type.add', name: 'x_course_level', label: L('A') }], 'name-clash', 0)
    // The other way round: the type exists, then a select `level` on x_course.
    const base = apply(emptyModelDoc(), [
      { op: 'type.add', name: 'x_course', label: L('A') },
      { op: 'type.add', name: 'x_course_level', label: L('B') },
    ]).doc
    refuse(base, [{ op: 'field.add', type: 'x_course', field: { type: 'select', key: 'level', label: L('Level'), options: [{ value: 'a', label: L('A') }] } }], 'name-clash', 0)
    // A generated key goes around the clash.
    const { doc: made } = apply(base, [{ op: 'field.add', type: 'x_course', field: { type: 'select', label: L('Level'), options: [{ value: 'a', label: L('A') }] } }])
    expect(fieldOf(made, 'x_course', 'level2')).toBeTruthy()
    // Hidden types and fields still hold their names.
    const hiddenSel = apply(doc, [{ op: 'field.remove', type: 'x_course', key: 'level' }]).doc
    refuse(hiddenSel, [{ op: 'type.add', name: 'x_course_level', label: L('A') }], 'name-clash', 0)
    // Two choice types that become equal: x_a_b + c, and x_a + bC.
    const two = apply(emptyModelDoc(), [
      { op: 'type.add', name: 'x_a_b', label: L('AB') },
      { op: 'type.add', name: 'x_a', label: L('A') },
      { op: 'field.add', type: 'x_a_b', field: { type: 'select', key: 'c', label: L('C'), options: [{ value: 'a', label: L('A') }] } },
    ]).doc
    refuse(two, [{ op: 'field.add', type: 'x_a', field: { type: 'select', key: 'bC', label: L('C'), options: [{ value: 'a', label: L('A') }] } }], 'name-clash', 0)
  })
})

describe('type.update', () => {
  it('changes labels, icon and description', () => {
    const { doc } = apply(courses(), [{
      op: 'type.update',
      type: 'x_course',
      label: { cs: 'Naše kurzy' },
      labelSingular: L('Kurz'),
      description: L('Popis'),
      icon: 'i-lucide-book',
    }])
    const t = course(doc)
    expect(t.label).toEqual({ cs: 'Naše kurzy' })
    expect(t.labelSingular).toEqual(L('Kurz'))
    expect(t.description).toEqual(L('Popis'))
    expect(t.icon).toBe('i-lucide-book')
    const cleared = apply(doc, [{ op: 'type.update', type: 'x_course', labelSingular: null, description: null, icon: null }]).doc
    expect(course(cleared).icon).toBeNull()
    expect(course(cleared).description).toBeNull()
  })

  it('sets list columns, the order and the page picture and summary', () => {
    const { doc } = apply(courses(), [{
      op: 'type.update',
      type: 'x_course',
      listColumns: ['title', 'startsAt', 'slug', 'status'],
      order: { by: 'startsAt', dir: 'desc' },
      page: { image: 'cover', summary: 'perex' },
    }])
    const t = course(doc)
    expect(t.listColumns).toEqual(['title', 'startsAt', 'slug', 'status'])
    expect(t.order).toEqual({ by: 'startsAt', dir: 'desc' })
    expect(t.page).toEqual({ prefix: 'kurzy', image: 'cover', summary: 'perex' })
    const back = apply(doc, [{ op: 'type.update', type: 'x_course', listColumns: null, order: null, page: { image: null } }]).doc
    expect(course(back).listColumns).toBeNull()
    expect(course(back).order).toBeNull()
    expect(course(back).page?.image).toBeNull()
    expect(course(back).page?.summary).toBe('perex')
  })

  it('lets the order change to manual', () => {
    const { doc } = apply(courses(), [{ op: 'type.update', type: 'x_course', order: 'manual' }])
    expect(course(doc).order).toBe('manual')
  })

  it('refuses a change from manual order', () => {
    const doc = apply(courses(), [{ op: 'type.update', type: 'x_course', order: 'manual' }]).doc
    refuse(doc, [{ op: 'type.update', type: 'x_course', order: { by: 'price', dir: 'asc' } }], 'order-manual', 0)
    refuse(doc, [{ op: 'type.update', type: 'x_course', order: null }], 'order-manual', 0)
    expect(() => apply(doc, [{ op: 'type.update', type: 'x_course', order: 'manual' }])).not.toThrow()
  })

  it('refuses the list columns that are not right', () => {
    const doc = courses()
    const columns = (listColumns: string[]) => [{ op: 'type.update', type: 'x_course', listColumns }] as ModelOp[]
    refuse(doc, columns(['nope']), 'unknown-field', 0)
    refuse(doc, columns([]), 'invalid-op', 0)
    refuse(doc, columns(['title', 'title']), 'invalid-op', 0)
    refuse(doc, columns(['title', 'perex', 'level', 'cover', 'startsAt', 'price', 'category', 'slug', 'status', 'title']), 'invalid-op', 0)
    const hidden = apply(doc, [{ op: 'field.remove', type: 'x_course', key: 'price' }]).doc
    refuse(hidden, columns(['price']), 'unknown-field', 0)
    const plain = apply(emptyModelDoc(), [{ op: 'type.add', name: 'x_plain', label: L('P') }]).doc
    refuse(plain, [{ op: 'type.update', type: 'x_plain', listColumns: ['slug'] }], 'unknown-field', 0)
    refuse(plain, [{ op: 'type.update', type: 'x_plain', listColumns: ['status'] }], 'unknown-field', 0)
  })

  it('refuses orders and page fields of the wrong kind', () => {
    const doc = courses()
    refuse(doc, [{ op: 'type.update', type: 'x_course', order: { by: 'nope', dir: 'asc' } }], 'unknown-field', 0)
    refuse(doc, [{ op: 'type.update', type: 'x_course', order: { by: 'cover', dir: 'asc' } }], 'invalid-op', 0)
    refuse(doc, [{ op: 'type.update', type: 'x_course', page: { image: 'perex' } }], 'invalid-op', 0)
    refuse(doc, [{ op: 'type.update', type: 'x_course', page: { image: 'nope' } }], 'unknown-field', 0)
    refuse(doc, [{ op: 'type.update', type: 'x_course', page: { summary: 'cover' } }], 'invalid-op', 0)
    refuse(doc, [{ op: 'type.update', type: 'x_course', page: { summary: 'nope' } }], 'unknown-field', 0)
  })

  it('refuses page fields on a type without a page', () => {
    const plain = apply(emptyModelDoc(), [{ op: 'type.add', name: 'x_plain', label: L('P') }]).doc
    refuse(plain, [{ op: 'type.update', type: 'x_plain', page: { image: null } }], 'no-page', 0)
  })

  it('refuses what cannot change in the first version', () => {
    const doc = courses()
    const update = (extra: Record<string, unknown>) => [{ op: 'type.update', type: 'x_course', ...extra }] as unknown as ModelOp[]
    refuse(doc, update({ name: 'x_other' }), 'not-changeable', 0)
    refuse(doc, update({ publish: false }), 'not-changeable', 0)
    refuse(doc, update({ titleField: 'perex' }), 'not-changeable', 0)
    refuse(doc, update({ page: { prefix: 'jine' } }), 'not-changeable', 0)
    refuse(doc, update({ page: null }), 'not-changeable', 0)
  })
})

describe('type.remove and type.restore', () => {
  it('hides a type and says whether it was empty', () => {
    const known = apply(courses(), [{ op: 'type.remove', type: 'x_course' }], ctx({ counts: { entries: { x_course: 0 } } })).doc
    expect(course(known).removedAt).toBe(NOW.toISOString())
    expect(course(known).removedEmpty).toBe(true)
    const unknown = apply(courses(), [{ op: 'type.remove', type: 'x_course' }]).doc
    expect(course(unknown).removedEmpty).toBe(false)
    const full = apply(courses(), [{ op: 'type.remove', type: 'x_course' }], ctx({ counts: { entries: { x_course: 3 } } })).doc
    expect(course(full).removedEmpty).toBe(false)
  })

  it('refuses while a visible field of another visible type points at it', () => {
    const p = refuse(twoTypes(), [{ op: 'type.remove', type: 'x_course' }], 'points-at-type', 0)
    expect(p.details).toEqual({ fields: [{ type: 'x_teacher', key: 'course' }] })
  })

  it('does not count a self-relation, a hidden field or a hidden type', () => {
    const self = apply(courses(), [{ op: 'field.add', type: 'x_course', field: { type: 'relation', key: 'next', label: L('Další'), to: 'x_course' } }]).doc
    expect(() => apply(self, [{ op: 'type.remove', type: 'x_course' }])).not.toThrow()
    const field = apply(twoTypes(), [{ op: 'field.remove', type: 'x_teacher', key: 'course' }, { op: 'type.remove', type: 'x_course' }]).doc
    expect(course(field).removedAt).toBeTruthy()
    const type = apply(twoTypes(), [{ op: 'type.remove', type: 'x_teacher' }, { op: 'type.remove', type: 'x_course' }]).doc
    expect(course(type).removedAt).toBeTruthy()
  })

  it('refuses to remove twice', () => {
    refuse(courses(), [{ op: 'type.remove', type: 'x_course' }, { op: 'type.remove', type: 'x_course' }], 'already-removed')
  })

  it('restores a type with its hidden fields still hidden', () => {
    const doc = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'price' }, { op: 'type.remove', type: 'x_course' }]).doc
    const restored = apply(doc, [{ op: 'type.restore', type: 'x_course' }]).doc
    expect(course(restored).removedAt).toBeNull()
    expect(course(restored).removedEmpty).toBeUndefined()
    expect(fieldOf(restored, 'x_course', 'price').removedAt).toBeTruthy()
  })

  it('refuses to restore what is not removed, or whose prefix or targets are gone', () => {
    refuse(courses(), [{ op: 'type.restore', type: 'x_course' }], 'not-removed', 0)
    const hidden = apply(courses(), [{ op: 'type.remove', type: 'x_course' }]).doc
    const taken = ctx({ design: [{ name: 'category', singleton: false, pathPrefix: 'kurzy' }] })
    refuse(hidden, [{ op: 'type.restore', type: 'x_course' }], 'prefix-taken', 0, taken)
    // a relation to a design collection that is gone
    const noCategory = ctx({ design: [] })
    refuse(hidden, [{ op: 'type.restore', type: 'x_course' }], 'unknown-target', 0, noCategory)
    // a relation to a hidden custom type
    const both = apply(twoTypes(), [{ op: 'type.remove', type: 'x_teacher' }, { op: 'type.remove', type: 'x_course' }]).doc
    refuse(both, [{ op: 'type.restore', type: 'x_teacher' }], 'target-hidden', 0)
    const ok = apply(both, [{ op: 'type.restore', type: 'x_course' }, { op: 'type.restore', type: 'x_teacher' }]).doc
    expect(ok.types.every((t) => !t.removedAt)).toBe(true)
  })

  it('does not let a hidden field with a gone target stop a restore', () => {
    const doc = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'category' }, { op: 'type.remove', type: 'x_course' }]).doc
    expect(() => apply(doc, [{ op: 'type.restore', type: 'x_course' }], ctx({ design: [] }))).not.toThrow()
  })
})

describe('what an operation may touch', () => {
  it('refuses a hidden type, an unknown type and a type of the design', () => {
    const hidden = apply(courses(), [{ op: 'type.remove', type: 'x_course' }]).doc
    const field = { type: 'text', key: 'a', label: L('A') } as const
    const ops: ModelOp[][] = [
      [{ op: 'type.update', type: 'x_course', icon: null }],
      [{ op: 'type.remove', type: 'x_course' }].slice(0, 0) as ModelOp[],
      [{ op: 'field.add', type: 'x_course', field }],
      [{ op: 'field.update', type: 'x_course', key: 'perex', long: false }],
      [{ op: 'field.remove', type: 'x_course', key: 'perex' }],
      [{ op: 'field.restore', type: 'x_course', key: 'perex' }],
      [{ op: 'field.order', type: 'x_course', keys: [] }],
    ]
    for (const list of ops.filter((l) => l.length)) refuse(hidden, list, 'type-hidden', 0)
    refuse(courses(), [{ op: 'type.update', type: 'x_nope', icon: null }], 'unknown-type', 0)
    refuse(courses(), [{ op: 'field.add', type: 'x_nope', field }], 'unknown-type', 0)
    refuse(courses(), [{ op: 'type.update', type: 'category', icon: null }], 'design-type', 0)
    refuse(courses(), [{ op: 'field.add', type: 'settings', field }], 'design-type', 0)
    refuse(courses(), [{ op: 'type.remove', type: 'page' }], 'design-type', 0)
  })

  it('refuses an unknown or hidden field', () => {
    const hidden = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'price' }]).doc
    refuse(courses(), [{ op: 'field.update', type: 'x_course', key: 'nope', label: L('A') }], 'unknown-field', 0)
    refuse(hidden, [{ op: 'field.update', type: 'x_course', key: 'price', label: L('A') }], 'unknown-field', 0)
    refuse(courses(), [{ op: 'field.remove', type: 'x_course', key: 'nope' }], 'unknown-field', 0)
    refuse(courses(), [{ op: 'field.restore', type: 'x_course', key: 'nope' }], 'unknown-field', 0)
    refuse(courses(), [{ op: 'field.add', type: 'x_course', after: 'nope', field: { type: 'text', label: L('A') } }], 'unknown-field', 0)
    refuse(hidden, [{ op: 'field.add', type: 'x_course', after: 'price', field: { type: 'text', label: L('A') } }], 'unknown-field', 0)
  })

  it('refuses an operation that is not the right shape', () => {
    const doc = courses()
    const bad = (raw: unknown) => refuse(doc, [raw as ModelOp], 'invalid-op', 0)
    bad({ op: 'type.sing', type: 'x_course' })
    bad({ op: 'type.remove' })
    bad({ op: 'type.remove', type: 'x_course', extra: 1 })
    bad('type.remove')
    bad(null)
    bad({ op: 'field.add', type: 'x_course', field: { type: 'hologram', label: L('A') } })
    bad({ op: 'field.add', type: 'x_course', field: { type: 'boolean', label: L('A'), required: true } })
    bad({ op: 'field.add', type: 'x_course', field: { type: 'gallery', label: L('A'), required: true } })
    bad({ op: 'field.add', type: 'x_course', field: { type: 'text', label: L('A'), removedAt: NOW.toISOString() } })
    bad({ op: 'field.add', type: 'x_course', field: { type: 'text', label: 'A' } })
    bad({ op: 'field.add', type: 'x_course', field: { type: 'boolean', label: L('A'), default: 'yes' } })
    bad({ op: 'field.add', type: 'x_course', field: { type: 'text', label: L('A'), max: 0 } })
    bad({ op: 'field.add', type: 'x_course', field: { type: 'text', label: L('A'), max: 100001 } })
    bad({ op: 'field.add', type: 'x_course', field: { type: 'text', label: L('A'), max: 1.5 } })
    bad({ op: 'field.add', type: 'x_course', field: { type: 'number', label: L('A'), min: 5, max: 1 } })
  })
})

describe('field.add', () => {
  const add = (field: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    [{ op: 'field.add', type: 'x_course', field, ...extra }] as unknown as ModelOp[]

  it('adds a field at the end with a key made from the label', () => {
    const { doc } = apply(courses(), add({ type: 'text', label: { cs: 'Datum zahájení', en: 'Start' }, help: L('Pomoc') }))
    const f = course(doc).fields.at(-1)!
    expect(f).toMatchObject({ key: 'datumZahajeni', type: 'text', help: L('Pomoc') })
  })

  it('puts the field after another one', () => {
    const { doc } = apply(courses(), add({ type: 'text', key: 'subtitle', label: L('Podtitul') }, { after: 'title' }))
    expect(course(doc).fields.map((f) => f.key).slice(0, 3)).toEqual(['title', 'subtitle', 'perex'])
  })

  it('adds every kind of field', () => {
    const kinds: Record<string, unknown>[] = [
      { type: 'text', label: L('A'), format: 'email', max: 100, required: true },
      { type: 'richtext', label: L('B') },
      { type: 'number', label: L('C'), decimal: true, min: 0, max: 10 },
      { type: 'boolean', label: L('D'), default: true },
      { type: 'datetime', label: L('E'), allDay: true },
      { type: 'select', label: L('F'), options: [{ label: L('Ano') }] },
      { type: 'media', label: L('G') },
      { type: 'file', label: L('H') },
      { type: 'gallery', label: L('I') },
      { type: 'color', label: L('J') },
      { type: 'relation', label: L('K'), to: 'x_course' },
    ]
    const doc = apply(courses(), kinds.map((field) => ({ op: 'field.add', type: 'x_course', field }) as unknown as ModelOp), ctx({ limits: { types: 12, fields: 40, options: 30 }, counts: { entries: { x_course: 0 } } })).doc
    expect(course(doc).fields.length).toBe(8 + 10)
    expect(parseModelDoc(doc)).toBeTruthy()
  })

  it('makes choices with values from their labels and checks them', () => {
    const { doc } = apply(courses(), add({
      type: 'select',
      key: 'kind',
      label: L('Druh'),
      options: [{ label: L('Dětský kurz') }, { label: L('Dětský kurz') }, { value: 'adult', label: L('Dospělí') }],
      default: 'detsky-kurz',
    }))
    const f = fieldOf(doc, 'x_course', 'kind')
    expect(f.type === 'select' && f.options.map((o) => o.value)).toEqual(['detsky-kurz', 'detsky-kurz-2', 'adult'])
    const select = (options: unknown[], extra: Record<string, unknown> = {}) => add({ type: 'select', key: 'kind', label: L('Druh'), options, ...extra })
    refuse(courses(), select([{ value: 'A', label: L('A') }]), 'invalid-option', 0)
    refuse(courses(), select([{ value: '-a', label: L('A') }]), 'invalid-option', 0)
    refuse(courses(), select([{ value: 'a'.repeat(41), label: L('A') }]), 'invalid-option', 0)
    refuse(courses(), select([{ value: 'a', label: L('A') }, { value: 'a', label: L('B') }]), 'invalid-option', 0)
    refuse(courses(), select([{ label: L('A') }], { default: 'zzz' }), 'invalid-option', 0)
    refuse(courses(), select([{ value: 'a', label: {} }]), 'invalid-label', 0)
  })

  it('refuses too few or too many choices', () => {
    const select = (n: number) => add({ type: 'select', key: 'kind', label: L('Druh'), options: Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: L(`V${i}`) })) })
    refuse(courses(), select(0), 'limit-options', 0)
    expect(() => apply(courses(), select(30))).not.toThrow()
    refuse(courses(), select(31), 'limit-options', 0)
  })

  it('refuses a field over the limit, hidden fields counted', () => {
    const c = ctx({ limits: { types: 12, fields: 7, options: 30 } })
    refuse(courses(), add({ type: 'text', label: L('Další') }), 'limit-fields', 0, c)
    const hidden = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'price' }]).doc
    refuse(hidden, add({ type: 'text', label: L('Další') }), 'limit-fields', 0, c)
    expect(() => apply(courses(), add({ type: 'text', label: L('Další') }), ctx({ limits: { types: 12, fields: 8, options: 30 } }))).not.toThrow()
  })

  it('refuses labels and help texts that are too long or empty', () => {
    refuse(courses(), add({ type: 'text', label: {} }), 'invalid-label', 0)
    refuse(courses(), add({ type: 'text', label: { cs: 'a'.repeat(81) } }), 'limit-label', 0)
    refuse(courses(), add({ type: 'text', label: L('A'), help: { cs: 'a'.repeat(301) } }), 'limit-help', 0)
  })

  it('refuses names that are taken, reserved or clash', () => {
    refuse(courses(), add({ type: 'text', key: 'perex', label: L('A') }), 'name-taken', 0)
    refuse(courses(), add({ type: 'text', key: 'title', label: L('A') }), 'name-taken', 0)
    const hidden = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'price' }]).doc
    refuse(hidden, add({ type: 'text', key: 'price', label: L('A') }), 'name-taken', 0)
    // columns: relation `topic` has `topic_id`, text `topicId` has `topic_id`
    const rel = apply(courses(), add({ type: 'relation', key: 'topic', label: L('A'), to: 'category' })).doc
    refuse(rel, add({ type: 'text', key: 'topicId', label: L('A') }), 'name-taken', 0)
    refuse(courses(), add({ type: 'text', key: 'slug', label: L('A') }), 'reserved-key', 0)
  })

  it('numbers a generated key that is taken or reserved', () => {
    const doc = apply(courses(), [
      { op: 'field.add', type: 'x_course', field: { type: 'text', label: L('Cena') } },
      { op: 'field.add', type: 'x_course', field: { type: 'text', label: L('Status') } },
      { op: 'field.add', type: 'x_course', field: { type: 'text', label: L('Perex') } },
    ]).doc
    expect(course(doc).fields.slice(-3).map((f) => f.key)).toEqual(['cena', 'status2', 'perex2'])
  })

  it('checks the target of a relation', () => {
    const relation = (to: string) => add({ type: 'relation', key: 'rel', label: L('A'), to })
    expect(() => apply(courses(), relation('category'))).not.toThrow()
    expect(() => apply(courses(), relation('x_course'))).not.toThrow()
    refuse(courses(), relation('settings'), 'unknown-target', 0)
    refuse(courses(), relation('nope'), 'unknown-target', 0)
    refuse(courses(), relation('x_nope'), 'unknown-target', 0)
    const hidden = apply(twoTypes(), [{ op: 'type.remove', type: 'x_teacher' }]).doc
    refuse(hidden, relation('x_teacher'), 'target-hidden', 0)
  })

  it('refuses a number with min above max', () => {
    refuse(courses(), add({ type: 'number', label: L('A'), min: 2, max: 1 }), 'invalid-op', 0)
    expect(() => apply(courses(), add({ type: 'number', label: L('A'), min: 1, max: 1 }))).not.toThrow()
  })

  it('refuses a required field while entries may exist, except a choice with a default', () => {
    const required = add({ type: 'text', key: 'subtitle', label: L('A'), required: true })
    refuse(courses(), required, 'needs-optional', 0)
    refuse(courses(), required, 'needs-optional', 0, ctx({ counts: { entries: { x_course: 4 } } }))
    expect(() => apply(courses(), required, empty())).not.toThrow()
    const withDefault = add({ type: 'select', key: 'kind', label: L('A'), required: true, default: 'a', options: [{ value: 'a', label: L('A') }] })
    expect(() => apply(courses(), withDefault)).not.toThrow()
    const noDefault = add({ type: 'select', key: 'kind', label: L('A'), required: true, options: [{ value: 'a', label: L('A') }] })
    refuse(courses(), noDefault, 'needs-optional', 0)
    // the second operation of a batch is the one named
    refuse(courses(), [...add({ type: 'text', label: L('A') }), ...required], 'needs-optional', 1)
  })
})

describe('field.update', () => {
  const update = (key: string, extra: Record<string, unknown>) => [{ op: 'field.update', type: 'x_course', key, ...extra }] as unknown as ModelOp[]

  it('changes the label and help, and clears the help', () => {
    const { doc } = apply(courses(), update('perex', { label: L('Úvod'), help: L('Pomoc') }))
    expect(fieldOf(doc, 'x_course', 'perex')).toMatchObject({ label: L('Úvod'), help: L('Pomoc') })
    const cleared = apply(doc, update('perex', { help: null })).doc
    expect(fieldOf(cleared, 'x_course', 'perex').help).toBeNull()
  })

  it('changes the settings of each kind', () => {
    const { doc } = apply(courses(), [
      ...update('perex', { long: false, format: 'email', max: 200 }),
      ...update('price', { min: 1, max: 9 }),
      ...update('startsAt', { allDay: true }),
    ])
    expect(fieldOf(doc, 'x_course', 'perex')).toMatchObject({ long: false, format: 'email', max: 200 })
    expect(fieldOf(doc, 'x_course', 'price')).toMatchObject({ min: 1, max: 9 })
    expect(fieldOf(doc, 'x_course', 'startsAt')).toMatchObject({ allDay: true })
    const flag = apply(courses(), [
      { op: 'field.add', type: 'x_course', field: { type: 'boolean', key: 'open', label: L('Otevřeno') } },
      ...update('open', { default: true }),
    ]).doc
    expect(fieldOf(flag, 'x_course', 'open')).toMatchObject({ default: true })
    const unset = apply(doc, [...update('perex', { max: null }), ...update('price', { min: null })]).doc
    expect(fieldOf(unset, 'x_course', 'perex')).toMatchObject({ max: null })
  })

  it('refuses settings that do not belong to the kind or are not right', () => {
    refuse(courses(), update('price', { long: true }), 'invalid-op', 0)
    refuse(courses(), update('perex', { min: 1 }), 'invalid-op', 0)
    refuse(courses(), update('cover', { allDay: true }), 'invalid-op', 0)
    refuse(courses(), update('level', { max: 3 }), 'invalid-op', 0)
    refuse(courses(), update('perex', { default: 'a' }), 'invalid-op', 0)
    refuse(courses(), update('perex', { max: 0 }), 'invalid-op', 0)
    refuse(courses(), update('price', { min: 10, max: 1 }), 'invalid-op', 0)
    refuse(courses(), update('price', { min: 10 }).concat(update('price', { max: 3 })), 'invalid-op', 1)
    refuse(courses(), update('perex', { required: 'yes' }), 'invalid-op', 0)
    const flag = apply(courses(), [{ op: 'field.add', type: 'x_course', field: { type: 'boolean', key: 'open', label: L('O') } }]).doc
    refuse(flag, update('open', { required: true }), 'invalid-op', 0)
    refuse(flag, update('open', { default: 'x' }), 'invalid-op', 0)
    refuse(courses(), update('level', { default: true }), 'invalid-op', 0)
    refuse(courses(), update('perex', { label: {} }), 'invalid-label', 0)
    refuse(courses(), update('perex', { label: { cs: 'a'.repeat(81) } }), 'limit-label', 0)
    refuse(courses(), update('perex', { help: { cs: 'a'.repeat(301) } }), 'limit-help', 0)
  })

  it('refuses what cannot change in the first version', () => {
    for (const extra of [{ to: 'category' }, { decimal: true }, { newKey: 'other' }, { kind: 'text' }, { fieldType: 'text' }]) {
      refuse(courses(), update('price', extra), 'not-changeable', 0)
    }
  })

  it('makes a required field optional at once, and the other way only without missing values', () => {
    const optional = apply(courses(), update('level', { required: false })).doc
    expect(fieldOf(optional, 'x_course', 'level')).toMatchObject({ required: false })
    const p = refuse(optional, update('level', { required: true }), 'has-missing-values', 0)
    expect(p.details).toEqual({ missing: null })
    const counted = ctx({ counts: { missing: { 'x_course.level': 4 } } })
    expect(refusal(() => apply(optional, update('level', { required: true }), counted)).details).toEqual({ missing: 4 })
    const none = ctx({ counts: { missing: { 'x_course.level': 0 } } })
    expect(fieldOf(apply(optional, update('level', { required: true }), none).doc, 'x_course', 'level')).toMatchObject({ required: true })
    // already required: a no-op needs no count
    expect(() => apply(courses(), update('level', { required: true }))).not.toThrow()
  })

  it('keeps the title field required', () => {
    refuse(courses(), update('title', { required: false }), 'title-field', 0)
    expect(() => apply(courses(), update('title', { label: L('Jméno') }))).not.toThrow()
  })

  it('adds, relabels, removes and restores choices', () => {
    const { doc } = apply(courses(), update('level', {
      addOptions: [{ label: L('Expert') }, { value: 'pro', label: L('Profesionál') }],
      optionLabels: { beginner: L('Nováček') },
    }))
    const f = fieldOf(doc, 'x_course', 'level')
    expect(f.type === 'select' && f.options.map((o) => o.value)).toEqual(['beginner', 'advanced', 'expert', 'pro'])
    expect(f.type === 'select' && f.options[0]!.label).toEqual(L('Nováček'))
    const removed = apply(doc, update('level', { removeOptions: ['advanced'] })).doc
    const r = fieldOf(removed, 'x_course', 'level')
    expect(r.type === 'select' && r.options[1]).toMatchObject({ value: 'advanced', removed: true })
    const restored = apply(removed, update('level', { restoreOptions: ['advanced'] })).doc
    const b = fieldOf(restored, 'x_course', 'level')
    expect(b.type === 'select' && b.options[1]).toEqual({ value: 'advanced', label: L('Pokročilý') })
  })

  it('sets and clears the default of a choice field', () => {
    const { doc } = apply(courses(), update('level', { default: 'advanced' }))
    expect(fieldOf(doc, 'x_course', 'level')).toMatchObject({ default: 'advanced' })
    expect(fieldOf(apply(doc, update('level', { default: null })).doc, 'x_course', 'level')).toMatchObject({ default: null })
    refuse(courses(), update('level', { default: 'zzz' }), 'invalid-option', 0)
    refuse(courses(), update('level', { removeOptions: ['advanced'] }).concat(update('level', { default: 'advanced' })), 'invalid-option', 1)
  })

  it('clears the default of a removed choice and says so', () => {
    const { doc, notes } = apply(courses(), update('level', { removeOptions: ['beginner'] }))
    expect(fieldOf(doc, 'x_course', 'level')).toMatchObject({ default: null })
    expect(notes).toEqual([expect.objectContaining({ code: 'default-cleared', op: 0, type: 'x_course', field: 'level' })])
    expect(notes[0]!.message).toContain('beginner')
    const other = apply(courses(), update('level', { removeOptions: ['advanced'] }))
    expect(other.notes).toEqual([])
  })

  it('refuses the last choice, and choices that are wrong or too many', () => {
    refuse(courses(), update('level', { removeOptions: ['beginner', 'advanced'] }), 'last-option', 0)
    refuse(courses(), update('level', { removeOptions: ['zzz'] }), 'invalid-option', 0)
    refuse(courses(), update('level', { removeOptions: ['advanced'] }).concat(update('level', { removeOptions: ['advanced'] })), 'invalid-option', 1)
    refuse(courses(), update('level', { restoreOptions: ['advanced'] }), 'invalid-option', 0)
    refuse(courses(), update('level', { optionLabels: { zzz: L('A') } }), 'invalid-option', 0)
    refuse(courses(), update('level', { addOptions: [{ value: 'beginner', label: L('A') }] }), 'invalid-option', 0)
    refuse(courses(), update('level', { addOptions: [{ value: 'Bad', label: L('A') }] }), 'invalid-option', 0)
    refuse(courses(), update('level', { optionLabels: { beginner: {} } }), 'invalid-label', 0)
    // 2 choices, limit 3: one more fits, two do not. Removed choices count.
    const c = ctx({ limits: { types: 12, fields: 30, options: 3 } })
    expect(() => apply(courses(), update('level', { addOptions: [{ label: L('C') }] }), c)).not.toThrow()
    refuse(courses(), update('level', { addOptions: [{ label: L('C') }, { label: L('D') }] }), 'limit-options', 0, c)
    const removed = apply(courses(), update('level', { addOptions: [{ label: L('C') }] }).concat(update('level', { removeOptions: ['advanced'] })), c).doc
    refuse(removed, update('level', { addOptions: [{ label: L('D') }] }), 'limit-options', 0, c)
  })
})

describe('field.remove', () => {
  const remove = (key: string) => [{ op: 'field.remove', type: 'x_course', key }] as ModelOp[]

  it('hides a field, and says whether it held values', () => {
    const { doc, notes } = apply(courses(), remove('price'))
    expect(fieldOf(doc, 'x_course', 'price')).toMatchObject({ removedAt: NOW.toISOString(), removedEmpty: false })
    expect(notes).toEqual([])
    const empty0 = apply(courses(), remove('price'), ctx({ counts: { values: { 'x_course.price': 0 } } })).doc
    expect(fieldOf(empty0, 'x_course', 'price')).toMatchObject({ removedEmpty: true })
    const full = apply(courses(), remove('price'), ctx({ counts: { values: { 'x_course.price': 5 } } })).doc
    expect(fieldOf(full, 'x_course', 'price')).toMatchObject({ removedEmpty: false })
  })

  it('refuses the title, the fields the mapper makes and a field that is gone already', () => {
    refuse(courses(), remove('title'), 'title-field', 0)
    for (const key of ['slug', 'status', 'position']) refuse(courses(), remove(key), 'system-field', 0)
    refuse(courses(), remove('price').concat(remove('price')), 'already-removed', 1)
  })

  it('clears the type\'s own uses of the field, one note each', () => {
    const configured = apply(courses(), [{
      op: 'type.update',
      type: 'x_course',
      listColumns: ['title', 'startsAt', 'level'],
      order: { by: 'startsAt', dir: 'asc' },
    }, {
      op: 'type.update',
      type: 'x_course',
      page: { image: 'cover', summary: 'perex' },
    }]).doc
    const dates = apply(configured, remove('startsAt'))
    expect(course(dates.doc).listColumns).toEqual(['title', 'level'])
    expect(course(dates.doc).order).toBeNull()
    expect(dates.notes.map((n) => n.code)).toEqual(['list-column-cleared', 'order-cleared'])
    for (const n of dates.notes) expect(n).toMatchObject({ op: 0, type: 'x_course', field: 'startsAt' })

    const cover = apply(configured, remove('cover'))
    expect(course(cover.doc).page?.image).toBeNull()
    expect(course(cover.doc).page?.summary).toBe('perex')
    expect(cover.notes.map((n) => n.code)).toEqual(['page-image-cleared'])

    const perex = apply(configured, remove('perex'))
    expect(course(perex.doc).page?.summary).toBeNull()
    expect(perex.notes.map((n) => n.code)).toEqual(['page-summary-cleared'])
  })

  it('turns an emptied list of columns into null and reports the batch index', () => {
    const doc = apply(courses(), [{ op: 'type.update', type: 'x_course', listColumns: ['price'] }]).doc
    const { doc: next, notes } = apply(doc, [...remove('perex'), ...remove('price')])
    expect(course(next).listColumns).toBeNull()
    expect(notes).toEqual([expect.objectContaining({ code: 'list-column-cleared', op: 1, field: 'price' })])
  })
})

describe('field.restore', () => {
  it('brings a field back', () => {
    const doc = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'price' }]).doc
    const { doc: back, notes } = apply(doc, [{ op: 'field.restore', type: 'x_course', key: 'price' }])
    expect(fieldOf(back, 'x_course', 'price').removedAt).toBeNull()
    expect(fieldOf(back, 'x_course', 'price').removedEmpty).toBeUndefined()
    expect(notes).toEqual([])
  })

  it('brings a required field back optional unless there are no missing values', () => {
    const hidden = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'level' }]).doc
    const restore: ModelOp[] = [{ op: 'field.restore', type: 'x_course', key: 'level' }]
    const { doc, notes } = apply(hidden, restore)
    expect(fieldOf(doc, 'x_course', 'level')).toMatchObject({ required: false })
    expect(notes).toEqual([expect.objectContaining({ code: 'restored-optional', op: 0, type: 'x_course', field: 'level' })])
    const counted = apply(hidden, restore, ctx({ counts: { missing: { 'x_course.level': 2 } } }))
    expect(fieldOf(counted.doc, 'x_course', 'level')).toMatchObject({ required: false })
    expect(counted.notes.length).toBe(1)
    const none = apply(hidden, restore, ctx({ counts: { missing: { 'x_course.level': 0 } } }))
    expect(fieldOf(none.doc, 'x_course', 'level')).toMatchObject({ required: true })
    expect(none.notes).toEqual([])
  })

  it('refuses a field that is not removed or whose target is gone', () => {
    refuse(courses(), [{ op: 'field.restore', type: 'x_course', key: 'price' }], 'not-removed', 0)
    const hidden = apply(twoTypes(), [{ op: 'field.remove', type: 'x_teacher', key: 'course' }, { op: 'type.remove', type: 'x_course' }]).doc
    refuse(hidden, [{ op: 'field.restore', type: 'x_teacher', key: 'course' }], 'target-hidden', 0)
    const gone = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'category' }]).doc
    refuse(gone, [{ op: 'field.restore', type: 'x_course', key: 'category' }], 'unknown-target', 0, ctx({ design: [] }))
    expect(() => apply(gone, [{ op: 'field.restore', type: 'x_course', key: 'category' }])).not.toThrow()
  })
})

describe('field.order', () => {
  it('puts the visible fields in the new order and leaves hidden ones in place', () => {
    const doc = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'level' }]).doc
    expect(course(doc).fields.map((f) => f.key)).toEqual(['title', 'perex', 'level', 'cover', 'startsAt', 'price', 'category'])
    const { doc: next } = apply(doc, [{ op: 'field.order', type: 'x_course', keys: ['category', 'price', 'startsAt', 'cover', 'perex', 'title'] }])
    expect(course(next).fields.map((f) => f.key)).toEqual(['category', 'price', 'level', 'startsAt', 'cover', 'perex', 'title'])
  })

  it('refuses keys that are not exactly the visible fields', () => {
    const doc = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'level' }]).doc
    const order = (keys: string[]) => [{ op: 'field.order', type: 'x_course', keys }] as ModelOp[]
    refuse(doc, order(['title']), 'invalid-op', 0)
    refuse(doc, order(['title', 'perex', 'level', 'cover', 'startsAt', 'price', 'category']), 'invalid-op', 0)
    refuse(doc, order(['title', 'title', 'cover', 'startsAt', 'price', 'category']), 'invalid-op', 0)
    refuse(doc, order(['title', 'perex', 'cover', 'startsAt', 'price', 'nope']), 'invalid-op', 0)
  })
})

describe('purge', () => {
  /** A course type with fields removed at `T0` and purged at some later time. */
  const T0 = new Date('2026-10-01T00:00:00.000Z')
  const removedAt = (doc: ModelDoc, ops: ModelOp[], extra: Partial<ModelContext> = {}) => apply(doc, ops, ctx({ now: T0, ...extra })).doc
  const purge = (doc: ModelDoc, op: ModelOp, ms: number, internal = true) =>
    apply(doc, [op], ctx({ now: new Date(T0.getTime() + ms), internal }))

  it('only runs for the server', () => {
    const doc = removedAt(courses(), [{ op: 'type.remove', type: 'x_course' }])
    refuse(doc, [{ op: 'purge', types: ['x_course'] }], 'internal-only', 0, ctx({ now: at(60 * DAY) }))
    refuse(doc, [{ op: 'purge', types: ['x_course'] }], 'internal-only', 0, ctx({ now: at(60 * DAY), internal: false }))
  })

  it('deletes a field 30 days after, not 29', () => {
    const doc = removedAt(courses(), [{ op: 'field.remove', type: 'x_course', key: 'price' }])
    const op: ModelOp = { op: 'purge', fields: [{ type: 'x_course', key: 'price' }] }
    const p = refusal(() => purge(doc, op, MODEL_PURGE_AFTER_MS - 1))
    expect({ code: p.code, op: p.op }).toEqual({ code: 'not-due', op: 0 })
    refusal(() => purge(doc, op, 29 * DAY))
    const { doc: next } = purge(doc, op, 30 * DAY)
    expect(next.types[0]!.fields.some((f) => f.key === 'price')).toBe(false)
  })

  it('deletes an empty one after an hour, not 59 minutes', () => {
    const doc = removedAt(courses(), [{ op: 'field.remove', type: 'x_course', key: 'price' }], { counts: { values: { 'x_course.price': 0 } } })
    const op: ModelOp = { op: 'purge', fields: [{ type: 'x_course', key: 'price' }] }
    expect(refusal(() => purge(doc, op, MODEL_PURGE_EMPTY_AFTER_MS - 1)).code).toBe('not-due')
    expect(refusal(() => purge(doc, op, 59 * 60 * 1000)).code).toBe('not-due')
    expect(course(purge(doc, op, 60 * 60 * 1000).doc).fields.some((f) => f.key === 'price')).toBe(false)
    // a field that held values waits the 30 days
    const full = removedAt(courses(), [{ op: 'field.remove', type: 'x_course', key: 'price' }], { counts: { values: { 'x_course.price': 3 } } })
    expect(refusal(() => purge(full, op, 2 * 60 * 60 * 1000)).code).toBe('not-due')
  })

  it('deletes a type with all its fields', () => {
    const doc = removedAt(courses(), [{ op: 'type.remove', type: 'x_course' }])
    expect(refusal(() => purge(doc, { op: 'purge', types: ['x_course'] }, 29 * DAY)).code).toBe('not-due')
    const { doc: next } = purge(doc, { op: 'purge', types: ['x_course'] }, 30 * DAY)
    expect(next.types).toEqual([])
    // a field of a purged type needs no check of its own
    const both = purge(doc, { op: 'purge', types: ['x_course'], fields: [{ type: 'x_course', key: 'price' }] }, 30 * DAY)
    expect(both.doc.types).toEqual([])
  })

  it('refuses things that are not removed, or are unknown', () => {
    refuse(courses(), [{ op: 'purge', types: ['x_course'] }], 'not-removed', 0, ctx({ internal: true }))
    refuse(courses(), [{ op: 'purge', fields: [{ type: 'x_course', key: 'price' }] }], 'not-removed', 0, ctx({ internal: true }))
    refuse(courses(), [{ op: 'purge', types: ['x_nope'] }], 'unknown-type', 0, ctx({ internal: true }))
    refuse(courses(), [{ op: 'purge', types: ['category'] }], 'design-type', 0, ctx({ internal: true }))
    refuse(courses(), [{ op: 'purge', fields: [{ type: 'x_course', key: 'nope' }] }], 'unknown-field', 0, ctx({ internal: true }))
  })

  it('refuses to delete a type while a field outside the purge points at it', () => {
    // x_teacher.course is hidden (twice as recently), x_course is hidden at T0.
    const stage = removedAt(
      apply(twoTypes(), [{ op: 'field.remove', type: 'x_teacher', key: 'course' }], ctx({ now: new Date(T0.getTime() + 25 * DAY) })).doc,
      [{ op: 'type.remove', type: 'x_course' }],
    )
    const p = refusal(() => purge(stage, { op: 'purge', types: ['x_course'] }, 31 * DAY))
    expect({ code: p.code, op: p.op }).toEqual({ code: 'points-at-type', op: 0 })
    expect(p.details).toEqual({ fields: [{ type: 'x_teacher', key: 'course' }] })
    // naming the field too works once it is due
    const done = purge(stage, { op: 'purge', types: ['x_course'], fields: [{ type: 'x_teacher', key: 'course' }] }, 56 * DAY)
    expect(done.doc.types.map((t) => t.name)).toEqual(['x_teacher'])
    expect(done.doc.types[0]!.fields.map((f) => f.key)).toEqual(['title'])
  })

  it('refuses when a visible field of a hidden type points at the purged type', () => {
    const hiddenTeacher = removedAt(twoTypes(), [{ op: 'type.remove', type: 'x_teacher' }])
    // x_course is visible: hide it too, which is allowed now that x_teacher is hidden
    const both = removedAt(hiddenTeacher, [{ op: 'type.remove', type: 'x_course' }])
    const late = ctx({ now: new Date(T0.getTime() + 31 * DAY), internal: true })
    // purging only x_course leaves x_teacher.course (visible, in a hidden type) pointing at it
    expect(refusal(() => apply(both, [{ op: 'purge', types: ['x_course'] }], late)).code).toBe('points-at-type')
    expect(() => apply(both, [{ op: 'purge', types: ['x_course', 'x_teacher'] }], late)).not.toThrow()
  })
})

describe('modelPurgeDue', () => {
  const T0 = new Date('2026-10-01T00:00:00.000Z')
  const day = (n: number) => new Date(T0.getTime() + n * DAY)

  it('lists what is due and what is not', () => {
    const doc = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'price' }], ctx({ now: T0 })).doc
    expect(modelPurgeDue(doc, day(29))).toEqual({ types: [], fields: [] })
    expect(modelPurgeDue(doc, day(30))).toEqual({ types: [], fields: [{ type: 'x_course', key: 'price' }] })
    const empty0 = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'price' }], ctx({ now: T0, counts: { values: { 'x_course.price': 0 } } })).doc
    expect(modelPurgeDue(empty0, new Date(T0.getTime() + 59 * 60 * 1000)).fields).toEqual([])
    expect(modelPurgeDue(empty0, new Date(T0.getTime() + 60 * 60 * 1000)).fields).toEqual([{ type: 'x_course', key: 'price' }])
    expect(modelPurgeDue(courses(), day(400))).toEqual({ types: [], fields: [] })
  })

  it('leaves the fields of a purged type to the type', () => {
    const doc = apply(courses(), [{ op: 'field.remove', type: 'x_course', key: 'price' }, { op: 'type.remove', type: 'x_course' }], ctx({ now: T0 })).doc
    expect(modelPurgeDue(doc, day(30))).toEqual({ types: ['x_course'], fields: [] })
  })

  it('holds a type back while a field outside the purge points at it', () => {
    const early = apply(twoTypes(), [{ op: 'field.remove', type: 'x_teacher', key: 'course' }], ctx({ now: day(25) })).doc
    const doc = apply(early, [{ op: 'type.remove', type: 'x_course' }], ctx({ now: T0 })).doc
    const held = modelPurgeDue(doc, day(31))
    expect(held).toEqual({ types: [], fields: [] })
    const due = modelPurgeDue(doc, day(56))
    expect(due).toEqual({ types: ['x_course'], fields: [{ type: 'x_teacher', key: 'course' }] })
    for (const [d, result] of [[31, held], [56, due]] as const) {
      expect(() => apply(doc, [{ op: 'purge', ...result }], ctx({ now: day(d), internal: true }))).not.toThrow()
    }
  })

  it('holds a type back for a visible field in a hidden type, and keeps going until stable', () => {
    // x_course and x_teacher are hidden; x_teacher is not due, so it stays and its visible field holds x_course back.
    const early = apply(twoTypes(), [{ op: 'type.remove', type: 'x_teacher' }], ctx({ now: day(25) })).doc
    const doc = apply(early, [{ op: 'type.remove', type: 'x_course' }], ctx({ now: T0 })).doc
    const result = modelPurgeDue(doc, day(31))
    expect(result).toEqual({ types: [], fields: [] })
    expect(() => apply(doc, [{ op: 'purge', ...result }], ctx({ now: day(31), internal: true }))).not.toThrow()
    // a chain: C points at B, B points at A; only A and C are due, B is not
    const chain = apply(emptyModelDoc(), [
      { op: 'type.add', name: 'x_a', label: L('A') },
      { op: 'type.add', name: 'x_b', label: L('B') },
      { op: 'type.add', name: 'x_c', label: L('C') },
      { op: 'field.add', type: 'x_b', field: { type: 'relation', key: 'toA', label: L('A'), to: 'x_a' } },
      { op: 'field.add', type: 'x_c', field: { type: 'relation', key: 'toB', label: L('B'), to: 'x_b' } },
      { op: 'field.remove', type: 'x_c', key: 'toB' },
      { op: 'type.remove', type: 'x_c' },
    ], ctx({ now: T0 })).doc
    const chainDue = modelPurgeDue(chain, day(31))
    expect(chainDue.types).toEqual(['x_c'])
    expect(() => apply(chain, [{ op: 'purge', ...chainDue }], ctx({ now: day(31), internal: true }))).not.toThrow()
  })
})

describe('applyModelOps purity', () => {
  it('leaves a deep-frozen input untouched', () => {
    const doc = deepFreeze(twoTypes())
    const before = JSON.stringify(doc)
    const ops: ModelOp[] = [
      { op: 'type.update', type: 'x_course', listColumns: ['title', 'level'], page: { image: 'cover' } },
      { op: 'field.update', type: 'x_course', key: 'level', addOptions: [{ label: L('Expert') }], removeOptions: ['beginner'] },
      { op: 'field.remove', type: 'x_course', key: 'cover' },
      { op: 'field.order', type: 'x_course', keys: ['price', 'title', 'perex', 'level', 'startsAt', 'category'] },
      { op: 'type.add', label: L('Nový') },
    ]
    const { doc: next, notes } = apply(doc, ops)
    expect(JSON.stringify(doc)).toBe(before)
    expect(next).not.toBe(doc)
    expect(next.types.length).toBe(3)
    expect(notes.length).toBeGreaterThan(0)
    // the ops and the context are not touched either
    const frozenOps = deepFreeze(JSON.parse(JSON.stringify(ops))) as ModelOp[]
    expect(() => apply(doc, frozenOps, deepFreeze(ctx()))).not.toThrow()
  })

  it('is all or nothing', () => {
    const doc = deepFreeze(courses())
    const before = JSON.stringify(doc)
    const p = refusal(() => apply(doc, [
      { op: 'type.add', label: L('Dobrý') },
      { op: 'field.add', type: 'x_course', field: { type: 'text', key: 'id', label: L('Zlý') } },
    ]))
    expect({ code: p.code, op: p.op }).toEqual({ code: 'reserved-key', op: 1 })
    expect(JSON.stringify(doc)).toBe(before)
  })

  it('does nothing for no operations and returns the same content', () => {
    const doc = courses()
    const { doc: next, notes } = apply(doc, [])
    expect(next).toEqual(doc)
    expect(notes).toEqual([])
  })
})
