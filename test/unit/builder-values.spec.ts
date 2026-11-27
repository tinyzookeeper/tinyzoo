import { describe, expect, it } from 'vitest'
import { isCmsBuilderToAdmin, isCmsBuilderToPage } from '../../packages/cms/shared/builder'
import { createBuilderHistory } from '../../packages/cms/shared/builder-history'
import type { CmsMatchNode } from '../../packages/cms/shared/builder-match'
import {
  cmsBuilderEntities, cmsEntityFieldAt, cmsSourceFields, cmsSourceFind, cmsTextsReport, isCmsEmbedSet,
  type CmsBuilderEntity, type CmsSourceRecord,
} from '../../packages/cms/shared/builder-sources'
import {
  cmsFormKey, cmsValueAt, cmsValueForms, cmsValueIndex, cmsValueMatch, cmsValueSet, isCmsValuePath,
  type CmsValueField,
} from '../../packages/cms/shared/builder-values'

// Part 2g of the builder: the values of an entry or a global, edited where they stand in the page. Where a
// value is inside an entry, the forms a value may be drawn in, what a text is made of (one value with a
// unit, several values in a row), which entry it is when several could have made it (the opening hours of a
// week), what the admin tells the page about a collection's fields, and the messages.

/** A tiny DOM with parents: text, elements with children and attributes. */
type N = CmsMatchNode & { name: string }
const t = (value: string): N => ({ nodeType: 3, nodeName: '#text', name: '#text', nodeValue: value, childNodes: [], parentNode: null })
function e(name: string, children: N[] = [], attrs: Record<string, string> = {}): N {
  const el: N = { nodeType: 1, nodeName: name.toUpperCase(), name, nodeValue: null, childNodes: children, parentNode: null, getAttribute: (n) => attrs[n] ?? null }
  for (const c of children) c.parentNode = el
  return el
}
const record = (entity: string, global: boolean, entries: Record<string, Record<string, unknown>>): CmsSourceRecord => ({ entity, global, entries: new Map(Object.entries(entries)) })

describe('where a value is inside an entry', () => {
  const row = {
    note: 'Odběry krve',
    rows: [{ id: 'a1', type: 'item', from: '7:00', inner: [{ id: 'b1', type: 'item', label: 'x' }] }, { id: 'a2', type: 'item', from: '8:00' }],
    address: { city: 'Jičín', zip: null },
    gone: null,
  }

  it('reads a field, a field of an item by the item\'s id, and a field of a group', () => {
    expect(cmsValueAt(row, ['note'])).toBe('Odběry krve')
    expect(cmsValueAt(row, ['rows', 'a2', 'from'])).toBe('8:00')
    expect(cmsValueAt(row, ['rows', 'a1', 'inner', 'b1', 'label'])).toBe('x')
    expect(cmsValueAt(row, ['address', 'city'])).toBe('Jičín')
    expect(cmsValueAt(row, ['address', 'zip'])).toBeNull()
    expect(cmsValueAt(row, ['rows', 'a9', 'from'])).toBeUndefined()
    expect(cmsValueAt(row, ['note', 'deeper'])).toBeUndefined()
    expect(cmsValueAt(undefined, ['note'])).toBeUndefined()
  })

  it('replaces a value there in a copy, and says when the path is not there', () => {
    const next = cmsValueSet(row, ['rows', 'a2', 'from'], '8:30')!
    expect(cmsValueAt(next, ['rows', 'a2', 'from'])).toBe('8:30')
    expect(row.rows[1]!.from).toBe('8:00')
    // Only what is on the path is copied.
    expect(next.rows[0]).toBe(row.rows[0])
    expect(cmsValueSet(row, ['address', 'city'], 'Praha')!.address).toEqual({ city: 'Praha', zip: null })
    expect(cmsValueSet(row.rows, ['a1', 'inner', 'b1', 'label'], 'y')![0]!.inner![0]!.label).toBe('y')
    expect(cmsValueSet(row, ['rows', 'a9', 'from'], 'x')).toBeUndefined()
    expect(cmsValueSet(row, ['gone', 'x'], 1)).toBeUndefined()
    expect(cmsValueSet(row, ['missing', 'x'], 1)).toBeUndefined()
    // An item is not replaced whole through its id.
    expect(cmsValueSet(row, ['rows', 'a1'], {})).toBeUndefined()
  })

  it('knows a path from anything else', () => {
    expect(isCmsValuePath(['note'])).toBe(true)
    expect(isCmsValuePath(['rows', 'a1', 'from'])).toBe(true)
    expect(isCmsValuePath([])).toBe(false)
    expect(isCmsValuePath(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBe(false)
    expect(isCmsValuePath(['', 'x'])).toBe(false)
    expect(isCmsValuePath('note')).toBe(false)
  })
})

describe('the forms a value may be drawn in', () => {
  it('writes a number plain, grouped and with a decimal comma', () => {
    const forms = cmsValueForms(1200, { value: 'number' }, ['cs'])
    expect(forms).toEqual(expect.arrayContaining(['1200', '1 200', '1,200', '1.200', '1 200,00']))
    expect(cmsValueForms(450, { value: 'number' })).toContain('450')
    // A decimal the content API gives as a string.
    expect(cmsValueForms('19.90', { value: 'number' }, ['cs'])).toEqual(expect.arrayContaining(['19.9', '19,9', '19,90', '19.90']))
    expect(cmsValueForms('abc', { value: 'number' })).toEqual([])
    expect(cmsValueForms(null, { value: 'number' })).toEqual([])
  })

  it('writes a date and a time as a Czech page does', () => {
    const forms = cmsValueForms('2026-12-21T18:30:00.000Z', { value: 'date' }, ['cs'])
    expect(forms).toEqual(expect.arrayContaining(['21. 12. 2026', '21.12.2026', '21. 12', '21. prosince', '21. prosince 2026', 'pondělí 21. prosince', '18:30', '2026-12-21']))
    expect(cmsValueForms('not a date', { value: 'date' }, ['cs'])).toEqual([])
    expect(cmsValueForms(undefined, { value: 'date' }, ['cs'])).toEqual([])
  })

  it('writes a choice by its names and its stored value', () => {
    expect(cmsValueForms('mon', { value: 'choice', options: { mon: ['Monday', 'Pondělí'], tue: ['Tuesday', 'Úterý'] } })).toEqual(['mon', 'monday', 'pondělí'])
    expect(cmsValueForms('', { value: 'choice', options: {} })).toEqual([])
    // Nothing else is drawn as a text.
    expect(cmsValueForms(true, {})).toEqual([])
  })

  it('compares a form without what a look puts around it, in lower case', () => {
    expect(cmsFormKey(' Pondělí: ')).toBe('pondělí')
    expect(cmsFormKey('450,-')).toBe('450')
    expect(cmsFormKey('21. 12.')).toBe('21. 12')
  })
})

describe('what a text is made of', () => {
  const f = (id: string, at: string[], kind: 'text' | 'value', ...keys: string[]): CmsValueField => ({ entity: 'openingHour', id, at, kind, keys })
  const hours = cmsValueIndex([
    f('mon1', ['day'], 'value', 'mon', 'pondělí'), f('mon1', ['from'], 'text', '7:00'), f('mon1', ['to'], 'text', '8:00'), f('mon1', ['note'], 'text', 'odběry krve'),
    f('mon2', ['day'], 'value', 'mon', 'pondělí'), f('mon2', ['from'], 'text', '8:00'), f('mon2', ['to'], 'text', '11:00'),
    f('tue1', ['day'], 'value', 'tue', 'úterý'), f('tue1', ['from'], 'text', '7:00'), f('tue1', ['to'], 'text', '8:00'),
  ])
  const dish = cmsValueIndex([
    { entity: 'dish', id: 'd1', at: ['price'], kind: 'value', keys: ['245', '245,00'] },
    { entity: 'dish', id: 'd1', at: ['weight'], kind: 'value', keys: ['150'] },
    { entity: 'dish', id: 'd1', at: ['name'], kind: 'text', keys: ['svíčková na smetaně'] },
    { entity: 'dish', id: 'd2', at: ['price'], kind: 'value', keys: ['195'] },
    { entity: 'dish', id: 'd2', at: ['rooms'], kind: 'value', keys: ['3'] },
    { entity: 'dish', id: 'd2', at: ['beds'], kind: 'value', keys: ['3'] },
    { entity: 'person', id: 'p1', at: ['first'], kind: 'text', keys: ['tomáš'] },
    { entity: 'person', id: 'p1', at: ['last'], kind: 'text', keys: ['brabec'] },
    { entity: 'person', id: 'p1', at: ['full'], kind: 'text', keys: ['tomáš brabec'] },
  ])
  const paths = (text: string, index = hours) => cmsValueMatch(text, index).map((h) => `${h.id}:${h.values.map((v) => v.at.join('.')).join('+')}`)

  it('finds two values of one entry in a row, for every entry that could have made the text', () => {
    expect(paths('7:00–8:00')).toEqual(['mon1:from+to', 'tue1:from+to'])
    expect(paths('8:00–11:00')).toEqual(['mon2:from+to'])
    // No entry has both: the span of a whole day is made of two rows.
    expect(paths('7:00–11:00')).toEqual([])
    expect(paths('Pondělí 7:00–8:00')).toEqual(['mon1:day+from+to'])
  })

  it('finds a value in another form than it is stored in', () => {
    expect(paths('Pondělí')).toEqual(['mon1:day', 'mon2:day'])
    expect(paths('ÚTERÝ:')).toEqual(['tue1:day'])
  })

  it('finds one value with a unit or a look\'s word around it, never among other digits', () => {
    expect(paths('245 Kč', dish)).toEqual(['d1:price'])
    expect(paths('od 245 Kč', dish)).toEqual(['d1:price'])
    expect(paths('245,-', dish)).toEqual(['d1:price'])
    expect(paths('150 g · alergeny 1, 7', dish)).toEqual([])
    expect(paths('Cena za celou porci je 245 Kč včetně přílohy', dish)).toEqual([])
    // A plain text counts with a word around it only when it is long enough to be no coincidence.
    expect(paths('trenér Tomáš Brabec', dish)).toEqual(['p1:full'])
    expect(paths('pan Tomáš', dish)).toEqual([])
  })

  it('finds nothing when the text does not tell which field it is', () => {
    // Two fields of one entry with the same value.
    expect(paths('3', dish)).toEqual([])
    // A name made of two fields, or one field that holds the same: different sets of fields.
    expect(paths('Tomáš Brabec', dish)).toEqual([])
    expect(paths('', dish)).toEqual([])
    expect(paths('Úplně jiný text', dish)).toEqual([])
  })

  it('takes "from" and "to" of the same time as the two fields they are', () => {
    const same = cmsValueIndex([f('x', ['from'], 'text', '8:00'), f('x', ['to'], 'text', '8:00')])
    expect(paths('8:00–8:00', same)).toEqual(['x:from+to'])
    expect(paths('8:00', same)).toEqual([])
  })
})

describe('what the admin tells the page about a collection\'s fields', () => {
  const graph = [{
    name: 'openingHour', label: 'Ordinační hodiny', titleField: 'note', orderField: 'position', can: { update: true },
    fields: [
      { key: 'day', type: 'select', meta: { options: ['mon', 'tue'], labels: { mon: { en: 'Monday', cs: 'Pondělí' }, tue: 'Úterý' } } },
      { key: 'from', type: 'text', meta: { max: 5 } },
      { key: 'note', type: 'text', localized: true },
      { key: 'web', type: 'text', meta: { format: 'url' } },
      { key: 'colour', type: 'text', ui: { edit: 'CmsFieldColor' } },
      { key: 'price', type: 'number', readOnly: true },
      { key: 'on', type: 'datetime' },
      { key: 'active', type: 'boolean' },
      { key: 'position', type: 'number' },
      { key: 'rows', type: 'blocks', meta: { list: { max: null }, blocks: { item: { fields: [{ key: 'label', type: 'text' }, { key: 'photo', type: 'media' }, { key: 'more', type: 'blocks', meta: { list: {}, blocks: { item: { fields: [{ key: 'word', type: 'text' }] } } } }] } } } },
      { key: 'address', type: 'group', meta: { fields: [{ key: 'city', type: 'text' }, { key: 'floor', type: 'number' }] } },
      { key: 'sections', type: 'blocks', meta: { blocks: { hero: { fields: [] } } } },
    ],
  }, {
    name: 'post', label: 'Články', publish: { field: 'status', publishedValue: 'published', dateField: 'publishedAt' },
    fields: [{ key: 'title', type: 'text' }, { key: 'status', type: 'select', meta: { options: ['draft', 'published'] } }, { key: 'publishedAt', type: 'datetime' }],
  }]
  const words = { entity: (m: { label: string }) => m.label, field: (f: { key: string }) => f.key.toUpperCase() }
  const out = cmsBuilderEntities(graph, words)

  it('says what a plain text takes, what a value is, and what is inside a list and a group', () => {
    const fields = out.openingHour!.fields
    expect(fields.day).toEqual({ kind: 'value', value: 'choice', label: 'DAY', options: { mon: ['Monday', 'Pondělí'], tue: ['Úterý'] } })
    expect(fields.from).toEqual({ kind: 'text', label: 'FROM', text: 'line', max: 5 })
    // A text with a form (an address) is found as a text and edited in its own control.
    expect(fields.web).toEqual({ kind: 'text', label: 'WEB' })
    expect(fields.price).toEqual({ kind: 'value', value: 'number', label: 'PRICE', locked: true })
    expect(fields.on).toEqual({ kind: 'value', value: 'date', label: 'ON' })
    expect(fields.rows!.kind).toBe('list')
    expect(fields.rows!.items!.item!.label).toEqual({ kind: 'text', label: 'LABEL', text: 'line' })
    // A picture inside an item is not found; a list inside an item is, one level more.
    expect(fields.rows!.items!.item!.photo).toBeUndefined()
    expect(fields.rows!.items!.item!.more!.items!.item!.word!.kind).toBe('text')
    expect(fields.address).toEqual({ kind: 'group', label: 'ADDRESS', items: { '': { city: { kind: 'text', label: 'CITY', text: 'line' }, floor: { kind: 'value', value: 'number', label: 'FLOOR' } } } })
    // Not described: a colour, a switch, the order, a page's own blocks.
    expect(Object.keys(fields).sort()).toEqual(['address', 'day', 'from', 'note', 'on', 'price', 'rows', 'web'])
  })

  it('leaves the status out and locks the date an entry goes live', () => {
    expect(out.post!.fields.status).toBeUndefined()
    expect(out.post!.fields.publishedAt).toMatchObject({ kind: 'value', value: 'date', locked: true })
  })

  it('locks what is not per-language while the preview shows a translation', () => {
    const fields = cmsBuilderEntities(graph, words, { translating: true }).openingHour!.fields
    expect(fields.note!.locked).toBeUndefined()
    expect(fields.from!.locked).toBe(true)
    expect(fields.day!.locked).toBe(true)
  })

  it('passes as a message to the page, and reads the field at a path', () => {
    const on = { type: 'cms:builder:on', labels: {}, texts: { drag: '', moveUp: '', moveDown: '', duplicate: '', remove: '', insertHere: '', shared: 'Změna se projeví všude.' }, selected: null }
    expect(isCmsBuilderToPage({ ...on, entities: JSON.parse(JSON.stringify(out)) })).toBe(true)
    expect(isCmsBuilderToPage({ ...on, entities: { x: { label: 'X', fields: { a: { kind: 'value', value: 'colour' } } } } })).toBe(false)
    expect(isCmsBuilderToPage({ ...on, entities: { x: { label: 'X', fields: { a: { kind: 'list', items: { item: { b: { kind: 'nope' } } } } } } } })).toBe(false)
    expect(isCmsBuilderToPage({ ...on, texts: { ...on.texts, shared: 5 } })).toBe(false)
    const info = out.openingHour!
    const row = { rows: [{ id: 'r1', type: 'item', label: 'A', more: [{ id: 'm1', type: 'item', word: 'w' }] }], address: { city: 'Jičín' } }
    expect(cmsEntityFieldAt(info, row, ['from'])!.max).toBe(5)
    expect(cmsEntityFieldAt(info, row, ['rows', 'r1', 'label'])!.text).toBe('line')
    expect(cmsEntityFieldAt(info, row, ['rows', 'r1', 'more', 'm1', 'word'])!.kind).toBe('text')
    expect(cmsEntityFieldAt(info, row, ['address', 'floor'])!.value).toBe('number')
    expect(cmsEntityFieldAt(info, row, ['rows', 'r9', 'label'])).toBeNull()
    expect(cmsEntityFieldAt(info, row, ['nothing'])).toBeNull()
    expect(cmsEntityFieldAt(undefined, row, ['from'])).toBeNull()
  })
})

describe('finding values in a block: the opening hours of a week', () => {
  const info: CmsBuilderEntity = {
    label: 'Ordinační hodiny', title: 'note', edit: true,
    fields: {
      day: { kind: 'value', value: 'choice', options: { mon: ['Pondělí'], tue: ['Úterý'], fri: ['Pátek'] } },
      from: { kind: 'text', text: 'line', max: 5 }, to: { kind: 'text', text: 'line', max: 5 }, note: { kind: 'text', text: 'line' },
    },
  }
  const entities = { openingHour: info }
  const rows = record('openingHour', false, {
    mon1: { id: 'mon1', day: 'mon', from: '7:00', to: '8:00', note: 'Odběry krve' },
    mon2: { id: 'mon2', day: 'mon', from: '8:00', to: '11:00', note: 'Akutní potíže, bez objednání' },
    tue1: { id: 'tue1', day: 'tue', from: '7:00', to: '8:00', note: 'Odběry krve' },
    tue2: { id: 'tue2', day: 'tue', from: '8:00', to: '11:00', note: 'Akutní potíže, bez objednání' },
    fri1: { id: 'fri1', day: 'fri', from: '7:00', to: '12:00', note: 'Akutní potíže, bez objednání' },
  })
  const { texts, values } = cmsSourceFields([rows], entities, null, ['cs'])
  const part = (time: string, note: string) => e('li', [e('p', [t(time)]), e('p', [t(note)])])
  const day = (name: string, span: string, parts: N[]) => e('div', [e('h3', [t(name)]), e('p', [e('span', [t(span)])]), e('ul', parts)])
  const monday = day('Pondělí', '7:00–11:00', [part('7:00–8:00', 'Odběry krve'), part('8:00–11:00', 'Akutní potíže, bez objednání')])
  const tuesday = day('Úterý', '7:00–11:00', [part('7:00–8:00', 'Odběry krve'), part('8:00–11:00', 'Akutní potíže, bez objednání')])
  const friday = day('Pátek', '7:00–12:00', [part('7:00–12:00', 'Akutní potíže, bez objednání')])
  const block = e('section', [e('h2', [t('Kdy ordinujeme')]), e('div', [monday, tuesday, friday])])
  const own = [{ field: 'heading', item: null, list: null, kind: 'text' as const, norm: 'Kdy ordinujeme', text: 'line' as const }]
  const found = cmsSourceFind([block], texts, { own, values: cmsValueIndex(values) })
  const li = (d: N, i: number) => d.childNodes[2]!.childNodes[i] as N
  const partOf = (n: N) => found.parts.get(n)

  it('tells the rows of one day from the same hours of another by the day\'s name beside them', () => {
    expect(partOf(li(monday, 0).childNodes[0] as N)).toEqual({ entity: 'openingHour', id: 'mon1', field: 'from', kind: 'value', values: [['from'], ['to']] })
    expect(partOf(li(tuesday, 0).childNodes[0] as N)).toMatchObject({ id: 'tue1', kind: 'value' })
    expect(partOf(li(monday, 1).childNodes[0] as N)).toMatchObject({ id: 'mon2', values: [['from'], ['to']] })
    // The note is a plain text of the same row, shared by three rows: the same rule settles it.
    expect(partOf(li(monday, 0).childNodes[1] as N)).toEqual({ entity: 'openingHour', id: 'mon1', field: 'note', kind: 'text' })
    expect(partOf(li(tuesday, 1).childNodes[1] as N)).toMatchObject({ id: 'tue2', field: 'note', kind: 'text' })
  })

  it('leaves alone what belongs to several rows or to none', () => {
    // The day's name is the day of both of its rows; the span of the day is made of two rows.
    expect(partOf(monday.childNodes[0] as N)).toBeUndefined()
    expect(partOf(monday.childNodes[1]!.childNodes[0] as N)).toBeUndefined()
    // A day of one row: its name and its span are that row's.
    expect(partOf(friday.childNodes[0] as N)).toEqual({ entity: 'openingHour', id: 'fri1', field: 'day', kind: 'value', values: [['day']] })
    expect(partOf(friday.childNodes[1]!.childNodes[0] as N)).toMatchObject({ id: 'fri1', values: [['from'], ['to']] })
    // The block's own heading stays the block's.
    expect(found.own).toEqual([block.childNodes[0]])
  })

  it('gives each row a card of its own', () => {
    const cards = Object.fromEntries(found.cards.map((c) => [c.id, c.els]))
    expect(cards.mon1).toEqual([li(monday, 0)])
    expect(cards.mon2).toEqual([li(monday, 1)])
    expect(cards.tue1).toEqual([li(tuesday, 0)])
    // The one row of a day is the day.
    expect(cards.fri1).toEqual([friday])
    expect(found.cards.map((c) => c.id)).toEqual(['mon1', 'mon2', 'tue1', 'tue2', 'fri1'])
  })

  it('counts a text found by a form apart from one found as it is stored', () => {
    const report = cmsTextsReport([block], own, found, entities)
    const by = (text: string) => report.filter((p) => p.text === text).map((p) => `${p.res}${p.by ? `/${p.by}` : ''}`)
    expect(by('7:00–8:00')).toEqual(['entry/value', 'entry/value'])
    expect(by('Odběry krve')).toEqual(['entry', 'entry'])
    expect(by('Pátek')).toEqual(['entry/value'])
    expect(by('Pondělí')).toEqual(['none'])
    expect(by('Kdy ordinujeme')).toEqual(['own'])
  })

  it('finds a text inside a list of a global, with where it is', () => {
    const settings: CmsBuilderEntity = { label: 'Nastavení', global: true, fields: { links: { kind: 'list', items: { item: { label: { kind: 'text', text: 'line' }, price: { kind: 'value', value: 'number' } } } } } }
    const site = record('siteSettings', true, { s1: { id: 's1', links: [{ id: 'l1', type: 'item', label: 'Parkování', price: 40 }, { id: 'l2', type: 'item', label: 'Vstup', price: 120 }] } })
    const made = cmsSourceFields([site], { siteSettings: settings }, null, ['cs'])
    expect(made.texts.map((x) => [x.field, x.at, x.norm])).toEqual([['links', ['links', 'l1', 'label'], 'Parkování'], ['links', ['links', 'l2', 'label'], 'Vstup']])
    const box = e('div', [e('p', [t('Parkování')]), e('p', [t('40 Kč')]), e('p', [t('Vstup')]), e('p', [t('120 Kč')])])
    const got = cmsSourceFind([box], made.texts, { values: cmsValueIndex(made.values) })
    expect(got.parts.get(box.childNodes[0] as N)).toEqual({ entity: 'siteSettings', id: 's1', field: 'links', kind: 'text', at: ['links', 'l1', 'label'] })
    expect(got.parts.get(box.childNodes[3] as N)).toEqual({ entity: 'siteSettings', id: 's1', field: 'links', kind: 'value', values: [['links', 'l2', 'price']] })
  })
})

describe('the messages of 2g', () => {
  it('takes a typed text of an entry, a box for values and where the box stands', () => {
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:entry-text', entity: 'openingHour', id: 'mon1', at: ['note'], value: 'Odběry', end: true })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:entry-text', entity: 'siteSettings', id: 's1', at: ['links', 'l1', 'label'], value: '' })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:entry-text', entity: 'openingHour', id: 'mon1', at: [], value: 'x' })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:entry-text', entity: 'openingHour', id: 'mon1', at: ['no te'], value: 'x' })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:entry-text', entity: 'openingHour', id: 'mon1', at: ['note'], value: 5 })).toBe(false)
    const rect = { left: 10, top: 20.5, width: 100, height: 24 }
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:value', entity: 'openingHour', id: 'mon1', values: [['from'], ['to']], rect })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:value', entity: 'openingHour', id: 'mon1', values: [], rect })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:value', entity: 'openingHour', id: 'mon1', values: [['from']], rect: { ...rect, width: -1 } })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:value', entity: 'openingHour', id: 'mon1', values: [['from']], rect: { ...rect, left: Number.NaN } })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:anchor', rect })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:anchor', rect: null })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:anchor' })).toBe(false)
  })

  it('tells the page what waits in the editor, and that the box closed', () => {
    expect(isCmsBuilderToPage({ type: 'cms:builder:pending', entries: [{ entity: 'openingHour', id: 'mon1', values: { note: 'x', rows: [] } }] })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:pending', entries: [], locked: [{ entity: 'notice', id: 'n1' }], sheet: { entity: 'siteSettings', id: null } })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:pending', entries: [{ entity: 'openingHour', id: 'mon1' }] })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:pending', entries: [{ entity: 'openingHour', id: 'mon1', values: { 'no te': 1 } }] })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:pending', entries: [], locked: [{ entity: 'notice' }] })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:box', open: false })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:box', open: true })).toBe(false)
  })

  it('hands values into the editor in the sheet', () => {
    expect(isCmsEmbedSet({ type: 'cms:entry:set', sets: [{ at: ['note'], value: 'x' }, { at: ['rows', 'r1', 'from'], value: null }] })).toBe(true)
    expect(isCmsEmbedSet({ type: 'cms:entry:set', sets: [{ at: [], value: 'x' }] })).toBe(false)
    expect(isCmsEmbedSet({ type: 'cms:entry:set', sets: [{ at: ['note'] }] })).toBe(false)
    expect(isCmsEmbedSet({ type: 'cms:entry:state', sets: [] })).toBe(false)
  })
})

describe('the history with steps that can be forgotten', () => {
  it('drops the steps of an entry handed to its own editor, done and undone alike', () => {
    const h = createBuilderHistory<{ who: string; v: number }>()
    h.record({ who: 'page', v: 0 }, { who: 'page', v: 1 })
    h.record({ who: 'entry', v: 0 }, { who: 'entry', v: 1 })
    h.record({ who: 'page', v: 1 }, { who: 'page', v: 2 })
    h.record({ who: 'entry', v: 1 }, { who: 'entry', v: 2 })
    expect(h.undo()!.before).toEqual({ who: 'entry', v: 1 })
    h.drop((s) => s.before.who === 'entry')
    expect(h.canRedo).toBe(false)
    expect(h.size).toBe(2)
    expect(h.undo()!.before).toEqual({ who: 'page', v: 1 })
    expect(h.undo()!.before).toEqual({ who: 'page', v: 0 })
    expect(h.undo()).toBeNull()
  })
})
