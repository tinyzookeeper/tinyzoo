import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { buildRegistry, defineEntity, defineSingleton, eq, f } from '../../packages/cms/src/index'
import { modelEntities } from '../../packages/cms/src/model-map'
import type { ModelDoc, ModelField, ModelType } from '../../packages/cms/src/model-doc'

// The mapper turns a model document into entities through defineEntity and f.*. These tests write
// documents as plain objects and compare what comes out with what a developer would write.

const category = () => defineEntity('category', {
  label: 'Categories',
  titleField: 'name',
  fields: { name: f.text({ required: true }) },
  content: { public: true },
})
const settings = () => defineSingleton('settings', { label: 'Settings', titleField: 'siteName', fields: { siteName: f.text({ required: true }) } })
const designOf = () => ({ category: category(), settings: settings() })

const type = (name: string, fields: ModelField[], more: Partial<ModelType> = {}): ModelType => ({
  name,
  label: { en: name },
  titleField: 'title',
  fields,
  ...more,
})
const title = (): ModelField => ({ key: 'title', type: 'text', label: { en: 'Title' }, required: true })
const doc = (...types: ModelType[]): ModelDoc => ({ format: 1, types })

const courseDoc: ModelType = {
  name: 'x_course',
  label: { cs: 'Kurzy', en: 'Courses' },
  labelSingular: { cs: 'Kurz', en: 'Course' },
  description: { en: 'What we teach.' },
  icon: 'i-lucide-graduation-cap',
  titleField: 'title',
  page: { prefix: 'kurzy' },
  publish: true,
  order: 'manual',
  listColumns: ['title', 'level', 'status'],
  fields: [
    { key: 'title', type: 'text', label: { cs: 'Název', en: 'Title' }, required: true },
    { key: 'perex', type: 'text', long: true, max: 300, label: { cs: 'Krátký popis', en: 'Summary' }, help: { cs: 'Dvě věty.', en: 'Two sentences.' } },
    { key: 'website', type: 'text', format: 'url', label: { cs: 'Web', en: 'Website' } },
    { key: 'body', type: 'richtext', required: true, label: { cs: 'Text', en: 'Text' } },
    { key: 'price', type: 'number', decimal: true, min: 0, max: 100000, label: { cs: 'Cena', en: 'Price' } },
    { key: 'featured', type: 'boolean', default: true, label: { cs: 'Doporučeno', en: 'Featured' } },
    { key: 'startsAt', type: 'datetime', allDay: true, label: { cs: 'Začátek', en: 'Starts' } },
    {
      key: 'level',
      type: 'select',
      required: true,
      default: 'beginner',
      label: { cs: 'Úroveň', en: 'Level' },
      options: [
        { value: 'beginner', label: { cs: 'Začátečníci', en: 'Beginners' } },
        { value: 'advanced', label: { cs: 'Pokročilí', en: 'Advanced' } },
        { value: 'legacy', label: { cs: 'Starý', en: 'Old' }, removed: true },
      ],
    },
    { key: 'cover', type: 'media', required: true, label: { cs: 'Obrázek', en: 'Image' } },
    { key: 'brochure', type: 'file', label: { cs: 'Brožura', en: 'Brochure' } },
    { key: 'photos', type: 'gallery', label: { cs: 'Fotky', en: 'Photos' } },
    { key: 'accent', type: 'color', required: true, label: { cs: 'Barva', en: 'Colour' } },
    { key: 'category', type: 'relation', to: 'category', label: { cs: 'Kategorie', en: 'Category' } },
    { key: 'teacher', type: 'relation', to: 'x_teacher', required: true, label: { cs: 'Lektor', en: 'Teacher' } },
  ],
}
const teacherDoc: ModelType = {
  name: 'x_teacher',
  label: { en: 'Teachers' },
  titleField: 'title',
  listColumns: null,
  fields: [
    title(),
    { key: 'mentor', type: 'relation', to: 'x_teacher', label: { en: 'Mentor' } },
    { key: 'bio', type: 'richtext', label: { en: 'Bio' } },
    { key: 'photo', type: 'media', label: { en: 'Photo' } },
    { key: 'gallery', type: 'gallery', label: { en: 'Gallery' } },
    { key: 'since', type: 'datetime', label: { en: 'Teaching since' } },
    { key: 'note', type: 'text', label: { en: 'Note' } },
  ],
}

function byHand() {
  const course: any = defineEntity('x_course', {
    label: { cs: 'Kurzy', en: 'Courses' },
    labelSingular: { cs: 'Kurz', en: 'Course' },
    description: { en: 'What we teach.' },
    icon: 'i-lucide-graduation-cap',
    titleField: 'title',
    fields: {
      title: f.text({ required: true }).label({ cs: 'Název', en: 'Title' }),
      perex: f.text({ multiline: true, max: 300 }).optional().label({ cs: 'Krátký popis', en: 'Summary' }).help({ cs: 'Dvě věty.', en: 'Two sentences.' }),
      website: f.text({ format: 'url' }).optional().label({ cs: 'Web', en: 'Website' }),
      body: f.richtext().label({ cs: 'Text', en: 'Text' }),
      price: f.number({ int: false, min: 0, max: 100000 }).optional().label({ cs: 'Cena', en: 'Price' }),
      featured: f.boolean({ default: true }).label({ cs: 'Doporučeno', en: 'Featured' }),
      startsAt: f.datetime({ allDay: true }).optional().label({ cs: 'Začátek', en: 'Starts' }),
      level: f.select({
        options: ['beginner', 'advanced', 'legacy'] as const,
        default: 'beginner',
        labels: { beginner: { cs: 'Začátečníci', en: 'Beginners' }, advanced: { cs: 'Pokročilí', en: 'Advanced' }, legacy: { cs: 'Starý', en: 'Old' } },
      }).label({ cs: 'Úroveň', en: 'Level' }),
      cover: f.media({ accept: 'image/*' }).label({ cs: 'Obrázek', en: 'Image' }),
      brochure: f.file().optional().label({ cs: 'Brožura', en: 'Brochure' }),
      photos: f.gallery().label({ cs: 'Fotky', en: 'Photos' }),
      accent: f.color({ required: true }).label({ cs: 'Barva', en: 'Colour' }),
      category: f.relation({ to: () => category, kind: 'many-to-one' }).label({ cs: 'Kategorie', en: 'Category' }),
      teacher: f.relation({ to: () => teacher, kind: 'many-to-one', required: true }).label({ cs: 'Lektor', en: 'Teacher' }),
      slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)', de: 'Adresse (URL)' }),
      status: f.select({
        options: ['draft', 'published'] as const,
        default: 'draft',
        labels: { draft: { en: 'Draft', cs: 'Koncept', de: 'Entwurf' }, published: { en: 'Published', cs: 'Zveřejněno', de: 'Veröffentlicht' } },
      }).label({ en: 'Status', cs: 'Stav', de: 'Status' }),
      position: f.number().optional().label({ en: 'Position', cs: 'Pořadí', de: 'Reihenfolge' }),
    },
    admin: { list: { columns: ['title', 'level', 'status'], orderField: 'position' } },
    content: { public: true, slug: 'slug', path: '/kurzy/:slug', published: (t: any) => eq(t.status, 'published') },
    publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/kurzy/:slug' },
  } as any)
  const teacher: any = defineEntity('x_teacher', {
    label: { en: 'Teachers' },
    titleField: 'title',
    fields: {
      title: f.text({ required: true }).label({ en: 'Title' }),
      mentor: f.relation({ to: () => teacher, kind: 'many-to-one' }).label({ en: 'Mentor' }),
      bio: f.richtext().optional().label({ en: 'Bio' }),
      photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photo' }),
      gallery: f.gallery().label({ en: 'Gallery' }),
      since: f.datetime().optional().label({ en: 'Teaching since' }),
      note: f.text().optional().label({ en: 'Note' }),
    },
    admin: { list: { columns: ['title', 'mentor', 'photo', 'since'] } },
    content: { public: true },
  } as any)
  return { x_course: course, x_teacher: teacher }
}

// The first place two JSON values differ, as a path: a short message where a whole diff is long.
function firstDiff(a: any, b: any, path = ''): string {
  if (JSON.stringify(a) === JSON.stringify(b)) return ''
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDiff(a[key], b[key], `${path}/${key}`)
      if (d) return d
    }
  }
  return `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`
}

const graphOf = (config: Record<string, unknown>) => JSON.parse(JSON.stringify(buildRegistry(config).graph))
const columnsOf = (table: any) => getTableConfig(table).columns.map((c: any) => ({
  name: c.name,
  type: c.columnType,
  notNull: c.notNull,
  hasDefault: c.hasDefault,
  default: c.default !== undefined && typeof c.default !== 'object' ? c.default : null,
}))

describe('the same types written in a document and in code', () => {
  const design = designOf()
  const { entities, problems } = modelEntities(doc(courseDoc, teacherDoc), design)
  const hand = byHand()
  const mine = buildRegistry({ ...design, ...entities })
  const theirs = buildRegistry({ ...design, ...hand })

  it('builds both types without a problem', () => {
    expect(problems).toEqual([])
    expect(Object.keys(entities)).toEqual(['x_course', 'x_teacher'])
  })

  it('gives the same admin graph', () => {
    const a = graphOf({ ...design, ...entities })
    const b = graphOf({ ...design, ...hand })
    expect(a).toEqual(b)
    const course = a.find((e: any) => e.name === 'x_course')
    expect(course.fields.map((x: any) => x.key)).toContain('teacher')
  })

  it('gives tables with the same columns', () => {
    for (const name of ['x_course', 'x_teacher']) {
      expect(columnsOf(mine.schema[name])).toEqual(columnsOf(theirs.schema[name]))
    }
  })

  it('keeps the removed choice in the column, as the database keeps its values', () => {
    expect((entities.x_course!.fields.level as any).spec.base.values).toEqual(['beginner', 'advanced', 'legacy'])
  })
})

describe('the columns of the admin list', () => {
  const fields: ModelField[] = [
    title(),
    { key: 'body', type: 'richtext', label: { en: 'Body' } },
    { key: 'photos', type: 'gallery', label: { en: 'Photos' } },
    { key: 'a', type: 'text', label: { en: 'A' } },
    { key: 'b', type: 'number', label: { en: 'B' } },
    { key: 'c', type: 'boolean', label: { en: 'C' } },
    { key: 'd', type: 'text', label: { en: 'D' } },
  ]
  const columnsFor = (t: ModelType) => modelEntities(doc(t), designOf()).entities.x_item?.admin?.list?.columns

  it('is the title and the first three fields that read well in a list', () => {
    expect(columnsFor(type('x_item', fields))).toEqual(['title', 'a', 'b', 'c'])
    expect(columnsFor(type('x_item', fields, { listColumns: [] }))).toEqual(['title', 'a', 'b', 'c'])
  })

  it('is what the document lists', () => {
    expect(columnsFor(type('x_item', fields, { listColumns: ['d', 'title'] }))).toEqual(['d', 'title'])
  })

  it('leaves out a column that is not a field', () => {
    expect(columnsFor(type('x_item', fields, { listColumns: ['title', 'gone', 'b'] }))).toEqual(['title', 'b'])
  })

  it('leaves out a column that is a hidden field', () => {
    const hidden: ModelField = { key: 'old', type: 'text', label: { en: 'Old' }, removedAt: '2026-11-24T10:00:00.000Z' }
    expect(columnsFor(type('x_item', [...fields, hidden], { listColumns: ['title', 'old', 'a'] }))).toEqual(['title', 'a'])
  })
})

describe('hidden types and fields', () => {
  const removedAt = '2026-11-24T10:00:00.000Z'
  const fields: ModelField[] = [
    title(),
    { key: 'visibleRequired', type: 'text', required: true, label: { en: 'Visible' } },
    { key: 'hiddenText', type: 'text', required: true, label: { en: 'Hidden text' }, removedAt },
    { key: 'hiddenMedia', type: 'media', required: true, label: { en: 'Hidden media' }, removedAt },
    { key: 'hiddenRelation', type: 'relation', to: 'category', required: true, label: { en: 'Hidden relation' }, removedAt },
  ]
  const hiddenType = type('x_old', [title()], { removedAt })
  const pointing = type('x_point', [title(), { key: 'old', type: 'relation', to: 'x_old', label: { en: 'Old' } }])
  const documentWith = doc(type('x_item', fields), hiddenType, pointing)

  it('leaves them out by default, and reports a relation to a hidden type', () => {
    const { entities, problems } = modelEntities(documentWith, designOf())
    expect(Object.keys(entities)).toEqual(['x_item', 'x_point'])
    expect(Object.keys(entities.x_item!.fields)).toEqual(['title', 'visibleRequired'])
    expect(Object.keys(entities.x_point!.fields)).toEqual(['title'])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ type: 'x_point', field: 'old' })
  })

  it('builds them with withHidden, and the hidden fields are optional', () => {
    const { entities, problems } = modelEntities(documentWith, designOf(), { withHidden: true })
    expect(problems).toEqual([])
    expect(Object.keys(entities)).toEqual(['x_item', 'x_old', 'x_point'])
    expect(Object.keys(entities.x_point!.fields)).toEqual(['title', 'old'])
    const item = entities.x_item!
    const columns = columnsOf(buildRegistry({ ...designOf(), ...entities }).schema.x_item)
    const notNull = (name: string) => columns.find((c: any) => c.name === name)!.notNull
    expect(item.fields.visibleRequired!.isOptional).toBe(false)
    expect(notNull('visible_required')).toBe(true)
    for (const [key, column] of [['hiddenText', 'hidden_text'], ['hiddenMedia', 'hidden_media_id'], ['hiddenRelation', 'hidden_relation_id']] as const) {
      expect(item.fields[key]!.isOptional, key).toBe(true)
      expect(notNull(column), column).toBe(false)
    }
  })

  it('does not make the fields of a hidden type optional', () => {
    const { entities } = modelEntities(doc(type('x_old', [title()], { removedAt })), designOf(), { withHidden: true })
    expect(entities.x_old!.fields.title!.isOptional).toBe(false)
  })
})

describe('a document that is wrong never stops the site', () => {
  it('leaves out a relation to a design collection that is gone', () => {
    const { entities, problems } = modelEntities(doc(type('x_item', [title(), { key: 'gone', type: 'relation', to: 'ghost', label: { en: 'Gone' } }])), designOf())
    expect(Object.keys(entities.x_item!.fields)).toEqual(['title'])
    expect(problems).toEqual([expect.objectContaining({ type: 'x_item', field: 'gone' })])
  })

  it('leaves out a relation to a single page of the design', () => {
    const { entities, problems } = modelEntities(doc(type('x_item', [title(), { key: 'where', type: 'relation', to: 'settings', label: { en: 'Where' } }])), designOf())
    expect(Object.keys(entities.x_item!.fields)).toEqual(['title'])
    expect(problems).toEqual([expect.objectContaining({ type: 'x_item', field: 'where' })])
  })

  it('leaves out a type whose name the design took', () => {
    const design = { ...designOf(), Course: defineEntity('x_course', { label: 'Mine', titleField: 'name', fields: { name: f.text({ required: true }) } }) }
    const { entities, problems } = modelEntities(doc(type('x_course', [title()]), type('x_other', [title()])), design)
    expect(Object.keys(entities)).toEqual(['x_other'])
    expect(problems).toEqual([expect.objectContaining({ type: 'x_course' })])
  })

  it('leaves out a type that would clash in the schema with a design entity', () => {
    const design = { ...designOf(), clash: defineEntity('xCourse', { label: 'Mine', titleField: 'name', fields: { name: f.text({ required: true }) } }) }
    const { entities, problems } = modelEntities(doc(type('x_course', [title()]), type('x_other', [title()])), design)
    expect(Object.keys(entities)).toEqual(['x_other'])
    expect(problems).toEqual([expect.objectContaining({ type: 'x_course' })])
  })

  it('leaves out a choice that would clash with a design table', () => {
    // x_course + level = x_course_level, which the design already has as a table.
    const design = { ...designOf(), clash: defineEntity('x_course_level', { label: 'Mine', titleField: 'name', fields: { name: f.text({ required: true }) } }) }
    const select: ModelField = { key: 'level', type: 'select', label: { en: 'Level' }, options: [{ value: 'a', label: { en: 'A' } }] }
    const { entities, problems } = modelEntities(doc(type('x_course', [title(), select])), design)
    expect(entities).toEqual({})
    expect(problems).toEqual([expect.objectContaining({ type: 'x_course' })])
  })

  it('leaves out a name without the prefix', () => {
    const { entities, problems } = modelEntities(doc(type('course', [title()]), type('x_ok', [title()])), designOf())
    expect(Object.keys(entities)).toEqual(['x_ok'])
    expect(problems).toEqual([expect.objectContaining({ type: 'course' })])
  })

  it('leaves out a type that defineEntity refuses, and keeps the other fields of a type that pointed at it', () => {
    const bad = type('x_bad', [title(), { key: 'id', type: 'text', label: { en: 'Id' } }])
    const next = type('x_next', [title(), { key: 'bad', type: 'relation', to: 'x_bad', label: { en: 'Bad' } }, { key: 'note', type: 'text', label: { en: 'Note' } }])
    const { entities, problems } = modelEntities(doc(bad, next), designOf())
    expect(Object.keys(entities)).toEqual(['x_next'])
    expect(Object.keys(entities.x_next!.fields)).toEqual(['title', 'note'])
    expect(problems.map((p) => [p.type, p.field])).toEqual([['x_bad', undefined], ['x_next', 'bad']])
    expect(problems[0]!.message).toContain('id')
  })

  it('leaves out a field of a kind it does not know', () => {
    const rating = { key: 'rating', type: 'rating', label: { en: 'Rating' } } as unknown as ModelField
    const { entities, problems } = modelEntities(doc(type('x_item', [title(), rating, { key: 'note', type: 'text', label: { en: 'Note' } }])), designOf())
    expect(Object.keys(entities.x_item!.fields)).toEqual(['title', 'note'])
    expect(problems).toEqual([expect.objectContaining({ type: 'x_item', field: 'rating' })])
  })

  it('leaves out a type whose title field is missing', () => {
    const { entities, problems } = modelEntities(doc(type('x_item', [{ key: 'note', type: 'text', label: { en: 'Note' } }])), designOf())
    expect(entities).toEqual({})
    expect(problems).toEqual([expect.objectContaining({ type: 'x_item' })])
  })

  it('loads no type when the design itself is broken', () => {
    const one = () => defineEntity('dup', { label: 'Dup', titleField: 'name', fields: { name: f.text({ required: true }) } })
    const { entities, problems } = modelEntities(doc(type('x_a', [title()]), type('x_b', [title()])), { first: one(), second: one() })
    expect(entities).toEqual({})
    expect(problems.map((p) => p.type)).toEqual(['x_a', 'x_b'])
  })

  it('leaves out the second of two types whose names would meet in the schema', () => {
    // x_a with the choice b makes x_a_b in the database: the name of the second type.
    const select: ModelField = { key: 'b', type: 'select', label: { en: 'B' }, options: [{ value: 'a', label: { en: 'A' } }] }
    const { entities, problems } = modelEntities(doc(type('x_a', [title(), select]), type('x_a_b', [title()])), designOf())
    expect(Object.keys(entities)).toEqual(['x_a'])
    expect(problems).toEqual([expect.objectContaining({ type: 'x_a_b' })])
  })

  it('does not throw on a document that is not one', () => {
    expect(() => modelEntities(null as any, designOf())).not.toThrow()
    expect(modelEntities({ format: 1, types: [null as any, { name: 5 } as any] }, designOf()).entities).toEqual({})
  })
})

describe('what the content API sees', () => {
  it('makes every custom type public', () => {
    const { entities } = modelEntities(doc(type('x_plain', [title()]), type('x_paged', [title()], { page: { prefix: 'kurzy' } })), designOf())
    expect(entities.x_plain!.content).toEqual({ public: true })
    expect(entities.x_paged!.content!.public).toBe(true)
  })

  it('gives a page type its address and the same address for the preview', () => {
    const { entities } = modelEntities(doc(type('x_paged', [title()], { page: { prefix: 'kurzy' }, publish: true })), designOf())
    const e = entities.x_paged!
    expect(e.content!.path).toBe('/kurzy/:slug')
    expect(e.content!.slug).toBe('slug')
    expect(e.publish!.preview).toBe('/kurzy/:slug')
    expect(Object.keys(e.fields)).toEqual(['title', 'slug', 'status'])
  })

  it('has no publishing and no address without them', () => {
    const e = modelEntities(doc(type('x_plain', [title()])), designOf()).entities.x_plain!
    expect(e.publish).toBeUndefined()
    expect(Object.keys(e.fields)).toEqual(['title'])
  })
})
