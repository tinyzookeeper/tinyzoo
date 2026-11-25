import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CUSTOM_PREFIX, defineEntity, defineSingleton, emitSchema, f } from 'tinyzoo'
import {
  customBlockPlan, customCards, customChosenEntries, customEntryHref, customEntryView, customFieldText, customPageFor, customShow,
  type CustomPage, type CustomType, type CustomTypeField,
} from '../../templates/kit/app/utils/customTypes'
import { customPrefixProblems, exportedTypeNames } from '../../templates/kit/design-build'
import { ENTRY_COLUMNS, ENTRY_PICTURES, kitEntryBlocks } from '../../templates/kit/sections'
import { repoRoot } from '../setup/database'

// What the kit decides about a site's own content types before it draws them
// (templates/kit/app/utils/customTypes.ts, templates/kit/design-build.ts).

const label = (cs: string, en = cs) => ({ cs, en })
const field = (key: string, type: string, extra: Partial<CustomTypeField> = {}): CustomTypeField => ({ key, type, label: label(key), ...extra })

const course: CustomType = {
  name: 'custom_course',
  label: label('Kurzy', 'Courses'),
  labelSingular: label('Kurz', 'Course'),
  titleField: 'name',
  path: '/kurzy/:slug',
  prefix: 'kurzy',
  publish: true,
  order: { by: 'startsAt', dir: 'desc' },
  page: { image: 'cover', summary: null },
  fields: [
    field('name', 'text'),
    field('cover', 'media'),
    field('startsAt', 'datetime', { label: label('Začátek', 'Starts') }),
    field('price', 'number', { label: label('Cena', 'Price') }),
    field('level', 'select', { label: label('Úroveň', 'Level'), options: [{ value: 'easy', label: label('Lehký', 'Easy') }, { value: 'hard', label: label('Těžký') }] }),
    field('teacher', 'relation', { label: label('Lektor', 'Teacher'), to: 'custom_teacher' }),
    field('full', 'boolean', { label: label('Obsazeno', 'Full') }),
    field('room', 'text', { label: label('Místnost', 'Room') }),
    field('about', 'text', { label: label('O kurzu', 'About'), long: true }),
    field('notes', 'richtext', { label: label('Poznámky', 'Notes') }),
    field('photos', 'gallery', { label: label('Fotky', 'Photos') }),
    field('program', 'file', { label: label('Program', 'Program') }),
    field('tint', 'color', { label: label('Barva', 'Colour') }),
  ],
}
const teacher: CustomType = {
  ...course, name: 'custom_teacher', titleField: 'fullName', prefix: null, path: null, order: 'manual', page: null,
  fields: [field('fullName', 'text'), field('title', 'text')],
}
const plain: CustomType = { ...course, name: 'custom_note', order: null, prefix: null, path: null, page: null, fields: [field('name', 'text'), field('createdOn', 'datetime')] }
const types = [course, teacher, plain]
const opts = { lang: 'cs', types }

const doc = (...paragraphs: string[]) => ({ type: 'doc', content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })) })
const pic = (url: string, alt?: string) => ({ url, alt })

describe('the text of a field of a custom type', () => {
  const text = (f: CustomTypeField | undefined, value: unknown, o: { lang: string; types?: CustomType[] } = opts) => customFieldText(f, value, o)
  const of = (key: string) => course.fields.find((x) => x.key === key)

  it('is a text and a long text as they are', () => {
    expect(text(of('room'), '  Sál A ')).toBe('Sál A')
    expect(text(of('about'), 'Dlouhý text')).toBe('Dlouhý text')
  })

  it('is the first paragraph of a rich text, as plain text', () => {
    expect(text(of('notes'), doc('První odstavec', 'Druhý'))).toBe('První odstavec')
  })

  it('is an integer as it is and a decimal in the Czech number format', () => {
    expect(text(of('price'), 2490)).toBe('2490')
    expect(text(field('km', 'number', { decimal: true }), 12.5)).toBe('12,5')
  })

  it('is the label of a yes/no when it is yes, and nothing when no', () => {
    expect(text(of('full'), true)).toBe('Obsazeno')
    expect(text(of('full'), false)).toBe('')
  })

  it('is a date without the time when the field is all-day', () => {
    expect(text(field('day', 'datetime', { allDay: true }), '2027-03-13T23:00:00.000Z')).toBe('14. března 2027')
  })

  it('is a date with its time otherwise, on the Prague clock', () => {
    expect(text(of('startsAt'), '2027-03-14T17:30:00.000Z')).toBe('14. března 2027, 18.30')
  })

  it('is the label of a choice in the site\'s language, the other language when it is missing, and the raw value for an unknown option', () => {
    expect(text(of('level'), 'easy', { lang: 'en' })).toBe('Easy')
    expect(text(of('level'), 'easy', { lang: 'cs' })).toBe('Lehký')
    expect(text(of('level'), 'hard', { lang: 'en' })).toBe('Těžký')
    expect(text(of('level'), 'gone')).toBe('gone')
  })

  it('is the title of a linked entry: the target type\'s title field, else "title"', () => {
    expect(text(of('teacher'), { id: '1', fullName: 'Jana Nová', title: 'x' })).toBe('Jana Nová')
    expect(text(of('teacher'), { id: '1', title: 'Jana' }, { lang: 'cs', types: [] })).toBe('Jana')
    expect(text(of('teacher'), { id: '1' })).toBe('')
  })

  it('is nothing for a colour, a picture, a gallery or a file', () => {
    expect(text(of('tint'), '#ff0000')).toBe('')
    expect(text(of('cover'), pic('/a.jpg'))).toBe('')
    expect(text(of('photos'), [pic('/a.jpg')])).toBe('')
    expect(text(of('program'), pic('/a.pdf'))).toBe('')
  })

  it('is nothing for no value, or no field', () => {
    for (const v of [null, undefined, '']) expect(text(of('room'), v)).toBe('')
    expect(text(undefined, 'x')).toBe('')
  })
})

describe('which request a block leads to', () => {
  const block = (source: unknown, extra: Record<string, unknown> = {}) => ({ heading: 'Kurzy', text: '', source, layout: null, ...extra })
  const binding = (extra: Record<string, unknown> = {}) => ({ type: 'custom_course', show: {}, order: null, limit: null, entries: [], ...extra })
  const request = (b: unknown, kind: 'entries' | 'chosen' = 'entries') => {
    const plan = customBlockPlan(b, types, kind)
    if (!plan.ok) throw new Error(plan.reason)
    return plan.request
  }

  it('is a list with the binding\'s order and limit', () => {
    expect(request(block(binding({ order: { by: 'startsAt', dir: 'asc' }, limit: 3 })))).toEqual({
      kind: 'list', path: '/api/content/custom_course', query: { limit: 3, sort: 'startsAt', dir: 'asc' },
    })
  })

  it('takes the type\'s own order when the binding has none', () => {
    expect(request(block(binding()))).toEqual({ kind: 'list', path: '/api/content/custom_course', query: { limit: 6, sort: 'startsAt', dir: 'desc' } })
  })

  it('asks for no sort when the type is arranged by hand, or has no order', () => {
    expect(request(block(binding({ type: 'custom_teacher' })))).toEqual({ kind: 'list', path: '/api/content/custom_teacher', query: { limit: 6 } })
    expect(request(block(binding({ type: 'custom_note' })))).toEqual({ kind: 'list', path: '/api/content/custom_note', query: { limit: 6 } })
  })

  it('falls back to the type\'s order when the binding orders by a field the type no longer has', () => {
    expect(request(block(binding({ order: { by: 'removed', dir: 'asc' } })))).toMatchObject({ query: { sort: 'startsAt', dir: 'desc' } })
  })

  it('lets a list be ordered by the date the entry was created', () => {
    expect(request(block(binding({ order: { by: 'createdAt', dir: 'desc' } })))).toMatchObject({ query: { sort: 'createdAt', dir: 'desc' } })
  })

  it('shows 6 entries when the limit is missing, and at most 48', () => {
    expect(request(block(binding({ limit: null })))).toMatchObject({ query: { limit: 6 } })
    expect(request(block(binding({ limit: undefined })))).toMatchObject({ query: { limit: 6 } })
    expect(request(block(binding({ limit: 100 })))).toMatchObject({ query: { limit: 48 } })
    expect(request(block(binding({ limit: 48 })))).toMatchObject({ query: { limit: 48 } })
  })

  it('draws cards when the layout is empty, and rows when it says rows', () => {
    const layout = (l: string | null) => { const p = customBlockPlan(block(binding(), { layout: l }), types, 'entries'); return p.ok ? p.layout : null }
    expect(layout(null)).toBe('cards')
    expect(layout('cards')).toBe('cards')
    expect(layout('rows')).toBe('rows')
  })

  it('shows three cards side by side at most, or the two or four the block chose', () => {
    const columns = (c: unknown) => { const p = customBlockPlan(block(binding(), { columns: c }), types, 'entries'); return p.ok ? p.columns : null }
    expect(columns(undefined)).toBe(3)
    expect(columns(null)).toBe(3)
    expect(columns('')).toBe(3)
    expect(columns('2')).toBe(2)
    expect(columns('3')).toBe(3)
    expect(columns('4')).toBe(4)
    expect(columns('12')).toBe(3)
  })

  it('cuts the pictures on their side, or to the square or the upright shape the block chose', () => {
    const picture = (c: unknown) => { const p = customBlockPlan(block(binding(), { picture: c }), types, 'chosen'); return p.ok ? p.picture : null }
    const chosen = (c: unknown) => { const p = customBlockPlan(block(binding({ entries: ['a'] }), { picture: c }), types, 'chosen'); return p.ok ? p.picture : null }
    expect(picture('square')).toBeNull() // a block of chosen entries with none chosen draws nothing
    expect(chosen(undefined)).toBe('landscape')
    expect(chosen(null)).toBe('landscape')
    expect(chosen('landscape')).toBe('landscape')
    expect(chosen('square')).toBe('square')
    expect(chosen('portrait')).toBe('portrait')
    expect(chosen('round')).toBe('landscape')
  })

  it('asks for chosen entries one by one, in the picked order, each once and at most 12', () => {
    expect(request(block(binding({ entries: ['b', 'a', 'b', 'c'] })), 'chosen')).toEqual({
      kind: 'chosen', paths: ['/api/content/custom_course/b', '/api/content/custom_course/a', '/api/content/custom_course/c'],
    })
    const many = Array.from({ length: 20 }, (_, i) => `e${i}`)
    const req = request(block(binding({ entries: many })), 'chosen')
    expect(req.kind === 'chosen' && req.paths).toHaveLength(12)
    expect(req.kind === 'chosen' && req.paths[11]).toBe('/api/content/custom_course/e11')
  })

  it('keeps the heading and the short text', () => {
    const plan = customBlockPlan(block(binding(), { heading: ' Naše kurzy ', text: ' Pojďte k nám ' }), types, 'entries')
    expect(plan).toMatchObject({ ok: true, heading: 'Naše kurzy', text: 'Pojďte k nám' })
  })
})

describe('a block that has nothing to draw', () => {
  const reason = (block: unknown, kind: 'entries' | 'chosen' = 'entries', list: CustomType[] | null = types) => {
    const plan = customBlockPlan(block, list, kind)
    expect(plan.ok).toBe(false)
    return plan.ok ? '' : plan.reason
  }

  it('says so when it has no source, or a source without a type', () => {
    expect(reason({ heading: 'x' })).toMatch(/no type/)
    expect(reason({ source: null })).toMatch(/no type/)
    expect(reason({ source: { show: {} } })).toMatch(/no type/)
    expect(reason({ source: { type: '' } })).toMatch(/no type/)
    expect(reason(null)).toMatch(/no type/)
  })

  it('says so when the site does not have the type', () => {
    expect(reason({ source: { type: 'custom_gone' } })).toContain('custom_gone')
    expect(reason({ source: { type: 'custom_course' } }, 'entries', [])).toContain('custom_course')
    expect(reason({ source: { type: 'custom_course' } }, 'entries', null)).toContain('custom_course')
  })

  it('says so when no entries are chosen', () => {
    expect(reason({ source: { type: 'custom_course', entries: [] } }, 'chosen')).toMatch(/no entries/)
    expect(reason({ source: { type: 'custom_course' } }, 'chosen')).toMatch(/no entries/)
  })

  it('leaves a place empty when it names a field the type no longer has, and drops a "more" the type lacks', () => {
    const show = customShow(course, { image: 'gone', text: 'gone', date: 'gone', label: 'gone', more: ['gone', 'price', 'price', 'level'] })
    expect(show).toMatchObject({ image: null, text: null, date: null, label: null })
    expect(show.more.map((x) => x.key)).toEqual(['price', 'level'])
    expect(customShow(course, null)).toEqual({ image: null, text: null, date: null, label: null, more: [] })
  })

  it('leaves a place empty when the field does not fit it', () => {
    const show = customShow(course, { image: 'room', date: 'price', text: 'name', label: 'name', more: ['name', 'cover', 'photos'] })
    expect(show).toEqual({ image: null, text: null, date: null, label: null, more: [] })
  })
})

describe('the cards of a block', () => {
  const plan = (show: Record<string, unknown>) => {
    const p = customBlockPlan({ source: { type: 'custom_course', show } }, types, 'entries')
    if (!p.ok) throw new Error(p.reason)
    return p
  }
  const entry = { id: 'e1', slug: 'jóga', name: 'Jóga', cover: pic('/j.jpg', 'Jóga'), startsAt: '2027-03-14T17:30:00.000Z', price: 2490, level: 'easy', about: 'Text', full: true }

  it('are none for an empty list', () => {
    expect(customCards([], plan({}), opts)).toEqual([])
  })

  it('hold the picture, the date and label, the text and the extra facts of an entry', () => {
    const [card] = customCards([entry], plan({ image: 'cover', date: 'startsAt', label: 'level', text: 'about', more: ['price', 'full'] }), opts)
    expect(card).toEqual({
      id: 'e1', title: 'Jóga', href: '/kurzy/j%C3%B3ga', image: entry.cover, meta: '14. března 2027, 18.30 · Lehký', text: 'Text',
      more: [{ label: 'Cena', value: '2490' }, { label: '', value: 'Obsazeno' }],
    })
  })

  it('leave out an entry without a title', () => {
    const cards = customCards([{ ...entry, name: '  ' }, { id: 'e2' }, null, entry], plan({}), opts)
    expect(cards.map((c) => c.id)).toEqual(['e1'])
  })

  it('have no picture when the entry has none', () => {
    const [card] = customCards([{ ...entry, cover: null }], plan({ image: 'cover' }), opts)
    expect(card!.image).toBeNull()
    const [none] = customCards([entry], plan({}), opts)
    expect(none!.image).toBeNull()
  })

  it('leave out extra facts without a value', () => {
    const [card] = customCards([{ ...entry, price: null, full: false }], plan({ more: ['price', 'full', 'level'] }), opts)
    expect(card!.more).toEqual([{ label: 'Úroveň', value: 'Lehký' }])
  })
})

describe('the answers of chosen entries', () => {
  it('keep the picked order and leave out a 404 and an answer without an item', () => {
    const answers = [{ item: { id: 'b' } }, null, { item: { id: 'a' } }, {}, { item: null }, undefined, { item: { id: 'c' } }]
    expect(customChosenEntries(answers).map((e) => e.id)).toEqual(['b', 'a', 'c'])
    expect(customChosenEntries([])).toEqual([])
  })
})

describe('the address of an entry', () => {
  it('is the type\'s prefix and the entry\'s slug', () => {
    expect(customEntryHref(course, { slug: 'jóga' })).toBe('/kurzy/j%C3%B3ga')
  })

  it('is nothing for a type without pages, or an entry without a slug', () => {
    expect(customEntryHref(teacher, { slug: 'x' })).toBeNull()
    expect(customEntryHref(course, {})).toBeNull()
    expect(customEntryHref(course, { slug: '' })).toBeNull()
  })
})

describe('the page an address leads to', () => {
  const pages: CustomPage[] = [{ prefix: 'kurzy', type: 'custom_course' }, { prefix: 'alba', type: 'custom_album' }]

  it('is the site\'s page when the address has two parts and the first is a custom prefix', () => {
    expect(customPageFor(['kurzy', 'joga'], pages, ['album'])).toEqual({ prefix: 'kurzy', type: 'custom_course' })
  })

  it('is nothing for one part or three parts', () => {
    expect(customPageFor(['kurzy'], pages, [])).toBeNull()
    expect(customPageFor(['kurzy', 'joga', 'x'], pages, [])).toBeNull()
    expect(customPageFor([], pages, [])).toBeNull()
  })

  it('is nothing when the prefix is one of the design\'s own entry pages', () => {
    expect(customPageFor(['alba', 'x'], pages, ['alba'])).toBeNull()
  })

  it('is nothing for an unknown prefix, or when the site has no pages', () => {
    expect(customPageFor(['jine', 'x'], pages, [])).toBeNull()
    expect(customPageFor(['kurzy', 'x'], [], [])).toBeNull()
    expect(customPageFor(['kurzy', 'x'], null, [])).toBeNull()
  })
})

describe('the page of one entry', () => {
  const entry = {
    name: ' Jóga ', cover: pic('/cover.jpg'), startsAt: '2027-03-14T17:30:00.000Z', price: 2490, level: 'hard',
    teacher: { fullName: 'Jana Nová' }, full: true, room: 'Sál A', about: 'První\n\nDruhý odstavec',
    notes: doc('Pozn.'), photos: [pic('/1.jpg'), { id: 'x' }, pic('/2.jpg')], program: pic('/p.pdf', 'Program kurzu'), tint: '#fff',
  }

  it('has the title and the type\'s page picture', () => {
    const view = customEntryView(entry, course, opts)
    expect(view.title).toBe('Jóga')
    expect(view.image).toEqual(pic('/cover.jpg'))
  })

  it('takes the first picture field when the type names no page picture', () => {
    const type = { ...course, page: null, fields: [...course.fields, field('second', 'media')] }
    expect(customEntryView({ ...entry, cover: null, second: pic('/s.jpg') }, type, opts).image).toEqual(pic('/s.jpg'))
    expect(customEntryView({ ...entry, cover: null, second: null }, type, opts).image).toBeNull()
  })

  it('lists the short facts in the type\'s order', () => {
    expect(customEntryView(entry, course, opts).facts).toEqual([
      { key: 'startsAt', label: 'Začátek', value: '14. března 2027, 18.30' },
      { key: 'price', label: 'Cena', value: '2490' },
      { key: 'level', label: 'Úroveň', value: 'Těžký' },
      { key: 'teacher', label: 'Lektor', value: 'Jana Nová' },
      { key: 'full', label: '', value: 'Obsazeno' },
      { key: 'room', label: 'Místnost', value: 'Sál A' },
    ])
  })

  it('shows a long text as paragraphs, keeps a rich text, and lists the gallery and the file', () => {
    const { parts } = customEntryView(entry, course, opts)
    expect(parts.map((p) => p.kind)).toEqual(['text', 'rich', 'gallery', 'file'])
    expect(parts[0]).toEqual({ kind: 'text', key: 'about', label: 'O kurzu', paragraphs: ['První', 'Druhý odstavec'] })
    expect(parts[1]).toMatchObject({ kind: 'rich', doc: entry.notes })
    expect(parts[2]).toMatchObject({ kind: 'gallery', items: [pic('/1.jpg'), pic('/2.jpg')] })
  })

  it('names a file by its alt text, else by the field\'s label', () => {
    const named = customEntryView(entry, course, opts).parts.find((p) => p.kind === 'file')
    expect(named).toMatchObject({ kind: 'file', name: 'Program kurzu' })
    const unnamed = customEntryView({ ...entry, program: pic('/p.pdf') }, course, opts).parts.find((p) => p.kind === 'file')
    expect(unnamed).toMatchObject({ kind: 'file', name: 'Program' })
  })

  it('leaves out fields without a value, and colours', () => {
    const view = customEntryView({ name: 'Jóga', tint: '#fff', price: null, full: false, room: '', about: ' ', notes: doc(), photos: [], program: null }, course, opts)
    expect(view.facts).toEqual([])
    expect(view.parts).toEqual([])
    expect(JSON.stringify(view)).not.toContain('#fff')
  })
})

describe('the module\'s check of a design\'s content model', () => {
  it('gives one message naming the design and the type for a type that starts with the prefix', () => {
    const problems = customPrefixProblems('photographer', ['album', 'custom_course'], 'custom_')
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('photographer')
    expect(problems[0]).toContain('custom_course')
    expect(problems[0]).not.toContain('"album"')
  })

  it('gives none for clean names', () => {
    expect(customPrefixProblems('photographer', ['album', 'page', 'siteSettings'], 'custom_')).toEqual([])
    expect(customPrefixProblems('photographer', [], 'custom_')).toEqual([])
  })

  it('reads the names of the types a config exports, and ignores other exports', () => {
    const Album = defineEntity('album', { label: 'Album', titleField: 'title', fields: { title: f.text() } })
    const Settings = defineSingleton('siteSettings', { label: 'Settings', titleField: 'siteName', fields: { siteName: f.text() } })
    const config = { Album, Settings, locales: { default: 'cs' }, helper: () => 1, nothing: null, text: 'x' }
    expect(exportedTypeNames(config).sort()).toEqual(['album', 'siteSettings'])
    expect(exportedTypeNames({ Album, Again: Album })).toEqual(['album'])
    expect(exportedTypeNames({})).toEqual([])
  })

  it('uses the prefix tinyzoo gives to a site\'s own types', () => {
    expect(CUSTOM_PREFIX).toBe('custom_')
  })
})

// The twenty templates of the one app, as the scripts list them.
const lib: { BUILT_TEMPLATES: Array<{ id: string; app: string }> } = await import(/* @vite-ignore */ join(repoRoot, 'cloud', 'scripts', 'lib.mjs'))
const TEMPLATE_IDS = lib.BUILT_TEMPLATES.filter((t) => t.app === 'templates').map((t) => t.id)

describe('the twenty templates', () => {
  it('are twenty', () => {
    expect(TEMPLATE_IDS).toHaveLength(20)
  })

  it('have no content type whose name starts with the prefix of a site\'s own types', async () => {
    for (const id of TEMPLATE_IDS) {
      const config = await import(/* @vite-ignore */ join(repoRoot, 'templates', id, 'cms.config.ts'))
      expect(customPrefixProblems(id, exportedTypeNames(config), CUSTOM_PREFIX), id).toEqual([])
    }
  })

  it('keep their database schema as it was committed', async () => {
    for (const id of TEMPLATE_IDS) {
      const config = await import(/* @vite-ignore */ join(repoRoot, 'templates', id, 'cms.config.ts'))
      const committed = readFileSync(join(repoRoot, 'templates', id, 'server', 'db', 'schema.ts'), 'utf8')
      expect(emitSchema(config) === committed, `templates/${id}/server/db/schema.ts differs from what its cms.config.ts gives`).toBe(true)
    }
  })
})

// The frame of the kit's sections (docs/builder-plan.md, 3.1): a look's own Text part, with what
// the section draws in its slot. A look without the slot would draw the heading and drop the rest.
describe('the frame every look gives the kit\'s sections', () => {
  const templates = readdirSync(join(repoRoot, 'templates'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'kit' && d.name !== 'app' && existsSync(join(repoRoot, 'templates', d.name, 'looks.ts')))
    .map((d) => d.name)
  const parts = templates.flatMap((template) => {
    const folder = join(repoRoot, 'templates', template, 'app', 'components')
    return readdirSync(folder, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(folder, d.name, 'Text.vue')))
      .map((d) => ({ look: `${template}/${d.name}`, source: readFileSync(join(folder, d.name, 'Text.vue'), 'utf8') }))
  })

  it('is there in all 52 looks of the 20 templates', () => {
    expect(templates).toHaveLength(20)
    expect(parts).toHaveLength(52)
  })

  it('has one slot in each look\'s Text part, after its heading and its text', () => {
    const wrong = parts.filter((p) => {
      const slots = p.source.match(/<slot\b[^>]*\/>/g) ?? []
      return slots.length !== 1 || p.source.indexOf('<slot') < p.source.lastIndexOf('block.body')
    })
    expect(wrong.map((p) => p.look)).toEqual([])
  })

  it('is passed on by LookPart, and the entries of a site\'s own types are drawn inside it', () => {
    const kit = join(repoRoot, 'templates', 'kit', 'app', 'components')
    expect(readFileSync(join(kit, 'LookPart.vue'), 'utf8')).toContain('<template v-if="$slots.default" #default><slot /></template>')
    expect(readFileSync(join(kit, 'KitEntries.vue'), 'utf8')).toMatch(/<LookPart [^>]*part="Text"/)
  })
})

// The two blocks as the hosted templates use them (templates/kit/sections.ts): tinyzoo's, with
// the kit's choices of how the entries are shown.
describe('the kit\'s blocks of a site\'s own types', () => {
  const blocks = kitEntryBlocks()

  it('are tinyzoo\'s two blocks, each with its fields and the two choices after them', () => {
    expect(Object.keys(blocks)).toEqual(['custom_entries', 'custom_chosen'])
    for (const def of Object.values(blocks)) expect(Object.keys(def.fields)).toEqual(['heading', 'text', 'source', 'layout', 'columns', 'picture'])
  })

  it('offer two, three or four columns and three picture shapes, the default first', () => {
    const { columns, picture } = blocks.custom_entries.fields as unknown as Record<string, { meta: { options: readonly string[] } }>
    expect(columns!.meta.options).toEqual(['2', '3', '4'])
    expect(picture!.meta.options).toEqual(['landscape', 'square', 'portrait'])
    expect(ENTRY_COLUMNS[0]).toBe('3')
    expect(ENTRY_PICTURES[0]).toBe('landscape')
  })

  it('are in the page blocks of all 20 templates, in place of tinyzoo\'s own', () => {
    const configs = readdirSync(join(repoRoot, 'templates'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'kit' && d.name !== 'app' && existsSync(join(repoRoot, 'templates', d.name, 'cms.config.ts')))
      .map((d) => ({ id: d.name, source: readFileSync(join(repoRoot, 'templates', d.name, 'cms.config.ts'), 'utf8') }))
    expect(configs).toHaveLength(20)
    expect(configs.filter((c) => !c.source.includes('...kitEntryBlocks()') || c.source.includes('customTypeBlocks')).map((c) => c.id)).toEqual([])
  })
})
