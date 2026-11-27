import { describe, expect, it } from 'vitest'
import {
  cardApplyNext, cardBindingFieldOf, cardBlockForField, cardEmptyChoices, cardPickerFields, cardSectionBlock, cardEntryTitle, cardExampleRow, cardItemsOf, cardKindsList, cardRowFields, cardUsedElsewhere, cardBlockState, cardDropUnbound, cardExample, cardGroupBlock, cardHiddenFields, cardLeaves,
  cardGroupCount, cardItemsIn, cardNextValues, cardOptionsOf, cardQuote, cardRedesign, cardRepeatCount, cardRowSummary, cardSectionUnbound, cardTypeChange, cardRefOf, cardRemap, cardStarter, cardUnbound, cardUsedFields, cardValue,
  type CardOptions, type CardType,
} from '../../packages/cms/shared/builder-card'
import type { BlockDefs, BlockKindDef } from '../../packages/cms/shared/block-tree'

// The card's design in the admin graph's shape: the kit's small blocks (templates/kit/sections.ts),
// the section with its card binding, and two content types.

const ref = (takes: string[], extra: Record<string, unknown> = {}) => ({ key: 'field', type: 'text', meta: { format: 'field', ref: { takes, ...extra } } })
const plain = (key: string, type = 'text', meta: Record<string, unknown> = {}) => ({ key, type, meta })

const heading: BlockKindDef = { fields: [ref(['text', 'number', 'date', 'choice'], { own: 'text' }), plain('text'), plain('level', 'select'), plain('size', 'select')] }
const text: BlockKindDef = {
  fields: [
    ref(['text', 'longText', 'richText', 'number', 'date', 'choice'], { own: 'text', only: { number: ['before', 'after'], date: ['date', 'nope'] } }),
    plain('text'), plain('before'), plain('after'), plain('date', 'select'), plain('scale', 'select'), plain('size', 'select'),
  ],
}
const picture: BlockKindDef = { fields: [ref(['picture']), plain('shape', 'select'), plain('size', 'select')] }
const button: BlockKindDef = { fields: [ref(['link', 'email', 'file', 'page']), plain('label'), plain('size', 'select')] }
const small: BlockDefs = { heading, text, picture, button }
const group: BlockKindDef = {
  fields: [{ key: 'items', type: 'blocks', meta: { blocks: small } }, plain('arrangement', 'select'), plain('size', 'select')],
}
const listDefs: BlockDefs = { ...small, group }

const STARTER: CardOptions = {
  starter: [
    { block: 'picture', from: ['picture'] },
    { block: 'heading', from: 'title' },
    { block: 'text', from: ['longText', 'richText'] },
    { block: 'button', from: ['page'], set: { label: { en: 'Read more', cs: 'Zjistit víc', de: 'Mehr erfahren' } } },
  ],
  groups: [
    { block: 'group', label: { en: 'Row' }, icon: 'i-lucide-columns-3', set: { arrangement: 'row' }, next: { size: 'content' } },
    { block: 'group', label: { en: 'Column' }, set: { arrangement: 'stack' } },
  ],
}
const section: BlockKindDef = {
  fields: [
    { key: 'source', type: 'binding', meta: { binding: 'card', card: STARTER } },
    { key: 'items', type: 'blocks', meta: { blocks: listDefs } },
  ],
}

const kurzy: CardType = {
  name: 'Kurzy',
  titleField: 'name',
  fields: [
    { key: 'name', kind: 'text', label: 'Název' },
    { key: 'description', kind: 'longText', label: 'Popis' },
    { key: 'date', kind: 'date', label: 'Datum' },
    { key: 'price', kind: 'number', label: 'Cena' },
    { key: 'photo', kind: 'picture', label: 'Fotka' },
    { key: 'signup', kind: 'link', label: 'Přihláška' },
    { key: 'slug', kind: 'page', label: 'Stránka' },
  ],
}
const reference: CardType = {
  name: 'Reference',
  titleField: 'author',
  fields: [
    { key: 'quote', kind: 'longText', label: 'Citát' },
    { key: 'author', kind: 'text', label: 'Autor' },
    { key: 'photo', kind: 'picture', label: 'Fotka' },
  ],
}
const plainType: CardType = { name: 'Plain', titleField: 'title', fields: [{ key: 'title', kind: 'text', label: 'Title' }, { key: 'note', kind: 'text', label: 'Note' }] }

const bound = (type: string, key: string, more: Record<string, unknown> = {}) => ({ id: `${type}-${key}`, type, field: key, ...more })
const types = (items: any[]) => items.map((b) => b.type)

describe('reading the design', () => {
  it('finds the card binding field and its options', () => {
    expect(cardBindingFieldOf(section)?.key).toBe('source')
    expect(cardBindingFieldOf(heading)).toBeNull()
    expect(cardOptionsOf(section)).toEqual(STARTER)
    expect(cardOptionsOf(heading)).toEqual({ starter: [], groups: [] })
    expect(cardOptionsOf({ fields: [{ key: 'x', type: 'binding', meta: { binding: 'card' } }] })).toEqual({ starter: [], groups: [] })
  })

  it('drops malformed steps and groups', () => {
    const def: BlockKindDef = {
      fields: [{ key: 's', type: 'binding', meta: { binding: 'card', card: {
        starter: [null, { block: 'a', from: [] }, { block: 'b', from: 'what' }, { block: 'c', from: ['picture', 3] }, { block: 'd', from: 'title', set: { x: 1, y: { en: 2 } } }, { from: 'title' }],
        groups: [{ block: 'g' }, 'no', { label: 'x' }],
      } } }],
    }
    expect(cardOptionsOf(def)).toEqual({
      starter: [{ block: 'c', from: ['picture'] }, { block: 'd', from: 'title', set: { x: 1 } }],
      groups: [{ block: 'g', label: undefined }],
    })
  })

  it('reads the reference of a small block', () => {
    expect(cardRefOf(heading)).toEqual({ key: 'field', takes: ['text', 'number', 'date', 'choice'], own: 'text', only: {} })
    const r = cardRefOf(text)!
    // `only` keeps the kinds in takes and the keys that are fields of the block
    expect(r.only).toEqual({ number: ['before', 'after'], date: ['date'] })
    expect(cardRefOf(picture)).toEqual({ key: 'field', takes: ['picture'], own: null, only: {} })
    expect(cardRefOf(group)).toBeNull()
    expect(cardRefOf({ fields: [ref(['text'], { own: 'gone', only: { picture: ['x'] } })] })).toEqual({ key: 'field', takes: ['text'], own: null, only: {} })
  })

  it('resolves a value by language', () => {
    const v = { en: 'Read more', cs: 'Zjistit víc' }
    expect(cardValue(v, 'cs')).toBe('Zjistit víc')
    expect(cardValue(v, 'cs-CZ')).toBe('Zjistit víc')
    expect(cardValue(v, 'de')).toBe('Read more')
    expect(cardValue({ cs: 'jen' }, 'de')).toBe('jen')
    expect(cardValue({}, 'de')).toBe('')
    expect(cardValue('x', 'cs')).toBe('x')
    expect(cardValue(3, 'cs')).toBe(3)
    expect(cardValue(false, 'cs')).toBe(false)
    expect(cardValue(null, 'cs')).toBeNull()
  })
})

describe('the starter card', () => {
  it('Kurzy: picture, heading, text, button with the label in the language', () => {
    const cards = cardStarter(listDefs, STARTER, kurzy, 'cs')
    expect(types(cards)).toEqual(['picture', 'heading', 'text', 'button'])
    expect(cards.map((b) => b.field)).toEqual(['photo', 'name', 'description', 'slug'])
    expect(cards[3]!.label).toBe('Zjistit víc')
    expect(cardStarter(listDefs, STARTER, kurzy, 'en')[3]!.label).toBe('Read more')
    expect(cardStarter(listDefs, STARTER, kurzy, 'de')[3]!.label).toBe('Mehr erfahren')
    expect(cards.every((b) => typeof b.id === 'string' && b.id.length === 12)).toBe(true)
    expect(new Set(cards.map((b) => b.id)).size).toBe(4)
    expect(cards[0]!.shape).toBeNull()
  })

  it('Reference: no button without a page', () => {
    const cards = cardStarter(listDefs, STARTER, reference, 'en')
    expect(types(cards)).toEqual(['picture', 'heading', 'text'])
    expect(cards.map((b) => b.field)).toEqual(['photo', 'author', 'quote'])
  })

  it('skips steps with no field', () => {
    expect(types(cardStarter(listDefs, STARTER, plainType, 'en'))).toEqual(['heading'])
  })

  it('skips a step naming an unknown block and a block with no reference', () => {
    const o: CardOptions = { starter: [{ block: 'nope', from: 'title' }, { block: 'group', from: 'title' }, { block: 'heading', from: 'title' }], groups: [] }
    expect(types(cardStarter(listDefs, o, kurzy, 'en'))).toEqual(['heading'])
  })

  it('takes each field once and ignores set keys the block has not', () => {
    const o: CardOptions = { starter: [{ block: 'text', from: ['text'] }, { block: 'text', from: ['text'] }, { block: 'text', from: ['text'], set: { bogus: 'x', before: 'Od ' } }], groups: [] }
    const cards = cardStarter(listDefs, o, plainType, 'en')
    expect(cards.map((b) => b.field)).toEqual(['title', 'note'])
    const o2: CardOptions = { starter: [{ block: 'text', from: ['text'], set: { bogus: 'x', before: 'Od ' } }], groups: [] }
    const one = cardStarter(listDefs, o2, plainType, 'en')[0]!
    expect(one.before).toBe('Od ')
    expect('bogus' in one).toBe(false)
  })

  it('does not take a title the block cannot show', () => {
    const t: CardType = { name: 'T', titleField: 'pic', fields: [{ key: 'pic', kind: 'picture', label: 'Pic' }] }
    expect(cardStarter(listDefs, STARTER, t, 'en').map((b) => b.type)).toEqual(['picture'])
  })
})

describe('the block a field brings', () => {
  const brings = (key: string, lang = 'cs') => cardBlockForField(listDefs, STARTER, kurzy, key, lang)

  it('maps kinds to blocks', () => {
    expect(brings('name')).toMatchObject({ type: 'heading', field: 'name' })
    expect(brings('price')).toMatchObject({ type: 'text', field: 'price' })
    expect(brings('date')).toMatchObject({ type: 'text', field: 'date' })
    expect(brings('description')).toMatchObject({ type: 'text', field: 'description' })
    expect(brings('photo')).toMatchObject({ type: 'picture', field: 'photo' })
    expect(brings('signup')).toMatchObject({ type: 'button', field: 'signup', label: 'Zjistit víc' })
    expect(brings('slug')).toMatchObject({ type: 'button', field: 'slug', label: 'Zjistit víc' })
    expect(brings('slug', 'de')!.label).toBe('Mehr erfahren')
    expect(brings('nope')).toBeNull()
  })

  it('has no block for a kind no block takes', () => {
    const t: CardType = { name: 'T', titleField: 'a', fields: [{ key: 'a', kind: 'text', label: 'A' }, { key: 'c', kind: 'color', label: 'C' }] }
    expect(cardBlockForField(listDefs, STARTER, t, 'c', 'en')).toBeNull()
  })

  it('a title without a title step takes the first candidate', () => {
    const o: CardOptions = { starter: [], groups: [] }
    expect(cardBlockForField(listDefs, o, kurzy, 'name', 'en')!.type).toBe('heading')
    expect(cardBlockForField(listDefs, o, kurzy, 'description', 'en')!.type).toBe('text')
  })
})

describe('groups', () => {
  it('makes a row and a column', () => {
    const row = cardGroupBlock(listDefs, STARTER.groups[0]!, 'en')!
    expect(row).toMatchObject({ type: 'group', arrangement: 'row', items: [] })
    expect(cardGroupBlock(listDefs, STARTER.groups[1]!, 'en')).toMatchObject({ arrangement: 'stack' })
    expect(cardGroupBlock(listDefs, { block: 'nope', label: 'x' }, 'en')).toBeNull()
  })

  it('gives the next values of a row that holds a block', () => {
    const row = (items: any[]) => ({ id: 'g', type: 'group', arrangement: 'row', items })
    expect(cardNextValues(STARTER, row([bound('heading', 'name')]), 'en')).toEqual({ size: 'content' })
    expect(cardNextValues(STARTER, row([]), 'en')).toEqual({})
    expect(cardNextValues(STARTER, { id: 'g', type: 'group', arrangement: 'stack', items: [bound('heading', 'name')] }, 'en')).toEqual({})
    expect(cardNextValues(STARTER, { id: 'g', type: 'other', items: [1] }, 'en')).toEqual({})
    expect(cardNextValues(STARTER, null, 'en')).toEqual({})
  })

  it('a group def without set matches any group of its type', () => {
    const o: CardOptions = { starter: [], groups: [{ block: 'group', label: 'x', next: { size: 'fill' } }] }
    expect(cardNextValues(o, { type: 'group', arrangement: 'stack', items: [1] }, 'en')).toEqual({ size: 'fill' })
  })
})

describe('the state of a block', () => {
  const state = (b: unknown, def: BlockKindDef | undefined, t: CardType | null = kurzy) => cardBlockState(b, def, t)

  it('names every state', () => {
    expect(state(bound('heading', 'name'), heading)).toEqual({ state: 'field', key: 'name', kind: 'text', label: 'Název' })
    expect(state(bound('button', 'slug'), button)).toEqual({ state: 'page', key: 'slug', label: 'Stránka' })
    expect(state(bound('heading', '', { text: ' Hello ' }), heading)).toEqual({ state: 'own', text: 'Hello' })
    expect(state(bound('heading', '', { text: '  ' }), heading)).toEqual({ state: 'unbound' })
    expect(state(bound('picture', ''), picture)).toEqual({ state: 'unbound' })
    expect(state({ id: 'x', type: 'picture', field: null, text: 'no own here' }, picture)).toEqual({ state: 'unbound' })
    expect(state(bound('heading', 'gone'), heading)).toEqual({ state: 'missing', key: 'gone' })
    expect(state(bound('heading', 'name'), heading, null)).toEqual({ state: 'missing', key: 'name' })
    expect(state(bound('heading', 'photo'), heading)).toEqual({ state: 'unfit', key: 'photo', kind: 'picture', label: 'Fotka' })
    expect(state(bound('heading', 'slug'), heading)).toMatchObject({ state: 'unfit' })
    expect(state({ id: 'g', type: 'group', items: [] }, group)).toEqual({ state: 'group' })
    expect(state({ id: 'x', type: 'x' }, { fields: [plain('a')] })).toEqual({ state: 'other' })
    expect(state({ id: 'x', type: 'x' }, undefined)).toEqual({ state: 'other' })
  })

  it('tolerates a block that is not one', () => {
    expect(state(null, heading)).toEqual({ state: 'unbound' })
    expect(state('x', heading)).toEqual({ state: 'unbound' })
  })
})

describe('the leaves of a card', () => {
  const card = (): any[] => [
    bound('picture', 'photo'),
    { id: 'g1', type: 'group', arrangement: 'row', items: [bound('heading', 'name'), bound('text', ''), bound('button', 'photo')] },
    bound('heading', 'gone'),
    { id: 'g2', type: 'group', items: [] },
  ]

  it('lists both levels in order, without groups', () => {
    const leaves = cardLeaves(card(), listDefs)
    expect(leaves.map((l) => l.block.id)).toEqual(['picture-photo', 'heading-name', 'text-', 'button-photo', 'heading-gone'])
    expect(leaves.map((l) => l.parent?.id ?? null)).toEqual([null, 'g1', 'g1', 'g1', null])
  })

  it('stops at two levels', () => {
    const deep = [{ id: 'a', type: 'group', items: [{ id: 'b', type: 'group', items: [bound('heading', 'name')] }] }]
    // the inner "group" has no group def in a group's list: it is unknown there and not a leaf
    expect(cardLeaves(deep, listDefs)).toEqual([])
  })

  it('finds the unbound ones', () => {
    expect(cardUnbound(card(), listDefs, kurzy)).toEqual(['text-', 'button-photo', 'heading-gone'])
    expect(cardUnbound(card(), listDefs, null).sort()).toEqual(['button-photo', 'heading-gone', 'heading-name', 'picture-photo', 'text-'].sort())
  })

  it('drops them, keeping groups and identity where nothing changed', () => {
    const items = card()
    const out = cardDropUnbound(items, listDefs, kurzy)
    expect(out.map((b) => b.id)).toEqual(['picture-photo', 'g1', 'g2'])
    expect(out[1].items.map((b: any) => b.id)).toEqual(['heading-name'])
    expect(items[1]!.items).toHaveLength(3)
    expect(out[0]).toBe(items[0])
    expect(out[2]).toBe(items[3])
    const clean = [bound('heading', 'name')]
    expect(cardDropUnbound(clean, listDefs, kurzy)).toBe(clean)
  })

  it('counts used fields', () => {
    const used = cardUsedFields([bound('heading', 'name'), { id: 'g', type: 'group', items: [bound('text', 'name'), bound('text', ''), bound('picture', 'photo')] }], listDefs)
    expect([...used]).toEqual([['name', 2], ['photo', 1]])
  })
})

describe('remapping the card to another type', () => {
  const starter = () => cardStarter(listDefs, STARTER, kurzy, 'en')

  it('keeps keys that fit and takes same labels, then the first free fit', () => {
    const r = cardRemap(starter(), listDefs, kurzy, reference, 'en')
    // picture photo kept; heading name -> no key, no label, first free text-ish: author; text description -> quote; button slug -> nothing
    expect(r.items.map((b) => b.field)).toEqual(['photo', 'author', 'quote', ''])
    expect(r.unbound).toBe(1)
    expect(r.items.map((b) => b.id)).toEqual(starter().map((b) => b.id).length ? r.items.map((b) => b.id) : [])
  })

  it('goes back', () => {
    const there = cardRemap(starter(), listDefs, kurzy, reference, 'en').items
    const back = cardRemap(there, listDefs, reference, kurzy, 'en')
    // photo kept; author (text): free fit is the first text-like field, name; quote: first longText-ish free: description
    expect(back.items.map((b) => b.field)).toEqual(['photo', 'name', 'description', ''])
    expect(back.unbound).toBe(1)
  })

  it('takes a field with the same name', () => {
    const a: CardType = { name: 'A', titleField: 'x', fields: [{ key: 'x', kind: 'text', label: 'Autor ' }, { key: 'y', kind: 'text', label: 'Název' }] }
    const b: CardType = { name: 'B', titleField: 'p', fields: [{ key: 'p', kind: 'text', label: 'Other' }, { key: 'q', kind: 'text', label: ' název' }, { key: 'r', kind: 'text', label: 'autor' }] }
    const items = [bound('heading', 'x'), bound('heading', 'y')]
    expect(cardRemap(items, listDefs, a, b, 'en').items.map((x) => x.field)).toEqual(['r', 'q'])
    // without the old type the label is unknown: the first free fit
    expect(cardRemap(items, listDefs, null, b, 'en').items.map((x) => x.field)).toEqual(['p', 'q'])
  })

  it('gives a field to one block only', () => {
    const items = [bound('heading', 'name', { id: 'a' }), bound('heading', 'name', { id: 'b' })]
    const r = cardRemap(items, listDefs, kurzy, kurzy, 'en')
    expect(r.items.map((b) => b.field)).toEqual(['name', 'date'])
  })

  it('a heading on a number goes to free fit or empty', () => {
    const items = [bound('heading', 'price')]
    expect(cardRemap(items, listDefs, kurzy, reference, 'en').items[0].field).toBe('author')
    const none: CardType = { name: 'N', titleField: 'p', fields: [{ key: 'p', kind: 'picture', label: 'P' }] }
    const r = cardRemap(items, listDefs, kurzy, none, 'en')
    expect(r.items[0].field).toBe('')
    expect(r.unbound).toBe(1)
  })

  it('leaves blocks with no field as they are and walks groups', () => {
    const own = bound('heading', '', { text: 'Own' })
    const items: any[] = [own, { id: 'g', type: 'group', items: [bound('picture', 'photo'), bound('text', 'price')] }]
    const r = cardRemap(items, listDefs, kurzy, reference, 'en')
    expect(r.items[0]).toBe(own)
    expect(r.items[1].items.map((b: any) => b.field)).toEqual(['photo', 'quote'])
    expect(r.unbound).toBe(0)
    expect(items[1].items[1].field).toBe('price')
  })

  it('never produces a reference whose kind does not fit', () => {
    for (const [a, b] of [[kurzy, reference], [reference, kurzy], [kurzy, plainType], [plainType, kurzy], [kurzy, kurzy]] as const) {
      const r = cardRemap(starter(), listDefs, a, b, 'en')
      expect(cardUnbound(r.items, listDefs, b).filter((id) => cardLeaves(r.items, listDefs).find((l) => l.block.id === id && l.block.field))).toEqual([])
      const used = [...cardUsedFields(r.items, listDefs).values()]
      expect(used.every((n) => n === 1)).toBe(true)
    }
  })
})

describe('hidden fields', () => {
  it('hides the own text while a field is named', () => {
    expect([...cardHiddenFields(heading, bound('heading', 'name'), kurzy)]).toEqual(['text'])
    expect([...cardHiddenFields(heading, bound('heading', ''), kurzy)]).toEqual([])
    expect([...cardHiddenFields(heading, bound('heading', 'gone'), kurzy)]).toEqual(['text'])
    expect([...cardHiddenFields(heading, bound('heading', 'photo'), kurzy)]).toEqual(['text'])
  })

  it('shows the fields of a kind only for that kind', () => {
    const hidden = (key: string) => [...cardHiddenFields(text, bound('text', key), kurzy)].sort()
    expect(hidden('price')).toEqual(['date', 'text'])
    expect(hidden('date')).toEqual(['after', 'before', 'text'])
    expect(hidden('description')).toEqual(['after', 'before', 'date', 'text'])
    expect([...cardHiddenFields(text, bound('text', ''), kurzy)].sort()).toEqual(['after', 'before', 'date'])
  })

  it('a key under several kinds is shown if any matches', () => {
    const def: BlockKindDef = { fields: [ref(['number', 'date'], { only: { number: ['x'], date: ['x', 'y'] } }), plain('x'), plain('y')] }
    expect([...cardHiddenFields(def, bound('d', 'date'), kurzy)]).toEqual([])
    expect([...cardHiddenFields(def, bound('d', 'price'), kurzy)]).toEqual(['y'])
  })

  it('is empty for a block with no reference', () => {
    expect(cardHiddenFields(group, { type: 'group' }, kurzy).size).toBe(0)
    expect(cardHiddenFields(undefined, null, null).size).toBe(0)
  })
})

describe('examples', () => {
  const f = (kind: any, key = 'v', more: object = {}) => ({ key, kind, label: key, ...more })
  const ex = (kind: any, v: unknown, lang = 'en', more: object = {}) => cardExample(f(kind, 'v', more), { v }, lang)

  it('text and long text: the first non-empty line, cut', () => {
    expect(ex('text', '  Hello  ')).toBe('Hello')
    expect(ex('longText', '\n  \n second line \nthird')).toBe('second line')
    expect(ex('text', 'a'.repeat(61))).toBe(`${'a'.repeat(59)}…`)
    expect(ex('text', 'a'.repeat(60))).toBe('a'.repeat(60))
    expect(ex('text', '')).toBe('')
    expect(ex('text', null)).toBe('')
  })

  it('rich text: the plain text of the doc', () => {
    const doc = { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world', marks: [] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Next' }] },
    ] }
    expect(ex('richText', doc)).toBe('Hello world Next')
    expect(ex('richText', { type: 'doc', content: [] })).toBe('')
    expect(ex('richText', { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(80) }] }] })).toBe(`${'x'.repeat(59)}…`)
    expect(ex('richText', 'not json')).toBe('')
  })

  it('numbers use plain spaces', () => {
    expect(ex('number', 1234.5, 'en')).toBe('1,234.5')
    const cs = ex('number', 1234567, 'cs')
    expect(cs).toBe('1 234 567')
    expect(/[  ]/.test(cs)).toBe(false)
    expect(ex('number', 'x')).toBe('')
    expect(ex('number', null)).toBe('')
    expect(ex('number', 0)).toBe('0')
  })

  it('dates', () => {
    expect(ex('date', '2027-03-14', 'cs')).toBe('14. března 2027')
    expect(ex('date', '2027-03-14', 'en')).toBe('March 14, 2027')
    expect(ex('date', new Date(Date.UTC(2027, 2, 14, 12)), 'cs')).toBe('14. března 2027')
    expect(ex('date', 'garbage')).toBe('')
    expect(ex('date', null)).toBe('')
  })

  it('choice, yes or no, colour and the others', () => {
    expect(ex('choice', 'beg', 'en', { choices: { beg: 'Beginner' } })).toBe('Beginner')
    expect(ex('choice', 'adv', 'en', { choices: { beg: 'Beginner' } })).toBe('adv')
    expect(ex('choice', null)).toBe('')
    expect(ex('yesNo', true)).toBe('true')
    expect(ex('yesNo', false)).toBe('false')
    expect(ex('color', '#fff')).toBe('#fff')
    expect(ex('relation', { id: 1 })).toBe('')
    expect(ex('gallery', [1])).toBe('')
    expect(ex('relation', 4)).toBe('4')
  })

  it('pictures and files use their media', () => {
    const row = (media: unknown) => ({ photo: 'x', photo__media: media })
    const photo = f('picture', 'photo')
    expect(cardExample(photo, row({ alt: 'A cat', filename: 'cat.jpg' }), 'en')).toBe('A cat')
    expect(cardExample(photo, row({ alt: '', title: 'T', filename: 'cat.jpg' }), 'en')).toBe('T')
    expect(cardExample(photo, row({ filename: 'cat.jpg' }), 'en')).toBe('cat.jpg')
    expect(cardExample(f('file', 'photo'), row({ originalName: 'o.pdf' }), 'en')).toBe('o.pdf')
    expect(cardExample(photo, row({}), 'en')).toBe('')
    expect(cardExample(photo, { photo: 'x' }, 'en')).toBe('')
  })

  it('links, e-mails and pages', () => {
    expect(ex('link', 'https://a.cz')).toBe('https://a.cz')
    expect(ex('email', 'a@b.cz')).toBe('a@b.cz')
    expect(ex('link', 3)).toBe('')
    const page = f('page', 'slug')
    expect(cardExample(page, { slug: 'yoga' }, 'en')).toBe('/yoga')
    expect(cardExample(page, { slug: 'yoga' }, 'en', 'kurzy')).toBe('/kurzy/yoga')
    expect(cardExample(page, { slug: 'yoga' }, 'en', '/kurzy/')).toBe('/kurzy/yoga')
    expect(cardExample(page, { slug: '' }, 'en')).toBe('')
  })

  it('no row, no example', () => {
    expect(cardExample(f('text'), null, 'en')).toBe('')
    expect(cardExample(f('text'), undefined, 'en')).toBe('')
  })
})

describe('rubbish input', () => {
  const rubbish: any[] = [null, undefined, 'x', 5, {}, [], [null, 1, 'x', { id: 'a' }, { id: 'b', type: 'nope' }, { id: 'c', type: 'group', items: 'no' }]]

  it('never throws', () => {
    for (const r of rubbish) {
      expect(() => {
        cardBindingFieldOf(r)
        cardOptionsOf(r)
        cardRefOf(r)
        cardStarter(r, r, r, 'en')
        cardBlockForField(r, r, r, 'a', 'en')
        cardGroupBlock(r, r, 'en')
        cardNextValues(r, r, 'en')
        cardBlockState(r, r, r)
        cardLeaves(r, r)
        cardUnbound(r, r, r)
        cardDropUnbound(r, r, r)
        cardUsedFields(r, r)
        cardRemap(r, r, r, r, 'en')
        cardHiddenFields(r, r, r)
        cardExample(r, r, 'en')
      }).not.toThrow()
    }
  })

  it('works on a card made of rubbish with real defs', () => {
    const items = rubbish[6]
    expect(cardLeaves(items, listDefs)).toEqual([])
    expect(cardUnbound(items, listDefs, kurzy)).toEqual([])
    expect(cardUsedFields(null, listDefs).size).toBe(0)
    expect(cardDropUnbound('x', listDefs, kurzy)).toEqual([])
    expect(cardRemap(null, listDefs, kurzy, reference, 'en')).toEqual({ items: [], unbound: 0 })
    expect(cardStarter(listDefs, STARTER, null as any, 'en')).toEqual([])
  })
})

describe('the panel of a card block', () => {
  const rows = [{ id: 'a', name: 'Alfa' }, { id: 'b', name: 'Beta' }, { id: 'c', name: ' Gama ' }]
  const pick = { entity: 'custom_x', section: 's1' }

  it('takes the example from the clicked card, else the section\'s first entry, else the first row', () => {
    expect(cardExampleRow(rows, { ...pick, cardEntry: { section: 's1', entity: 'custom_x', id: 'c' } })?.id).toBe('c')
    // a click in another section, another type or an entry that is not among the rows says nothing
    expect(cardExampleRow(rows, { ...pick, cardEntry: { section: 's2', entity: 'custom_x', id: 'c' } })?.id).toBe('a')
    expect(cardExampleRow(rows, { ...pick, cardEntry: { section: 's1', entity: 'custom_y', id: 'c' } })?.id).toBe('a')
    expect(cardExampleRow(rows, { ...pick, cardEntry: { section: 's1', entity: 'custom_x', id: 'zzz' } })?.id).toBe('a')
    const sources = [{ entity: 'custom_y', entries: [{ id: 'a' }] }, { entity: 'custom_x', entries: [{ id: 'gone' }, { id: 'b' }, { id: 'c' }] }]
    expect(cardExampleRow(rows, { ...pick, sources })?.id).toBe('b')
    expect(cardExampleRow(rows, { ...pick, sources: [{ entity: 'custom_x', entries: [{ id: 'gone' }] }] })?.id).toBe('a')
    expect(cardExampleRow(rows, { ...pick, section: null, cardEntry: { section: 's1', entity: 'custom_x', id: 'c' } })?.id).toBe('a')
  })

  it('has no example without rows, and never throws on rubbish', () => {
    expect(cardExampleRow([], pick)).toBeNull()
    expect(cardExampleRow(null, pick)).toBeNull()
    expect(cardExampleRow([null as any, 3 as any, 'x' as any], pick)).toBeNull()
    expect(cardExampleRow(rows, { ...pick, sources: 'x' as any, cardEntry: 5 as any })?.id).toBe('a')
    expect(cardEntryTitle(rows[2], 'name')).toBe('Gama')
    expect(cardEntryTitle({ n: 4 }, 'n')).toBe('4')
    expect(cardEntryTitle(null, 'name')).toBe('')
    expect(cardEntryTitle({ name: {} }, 'name')).toBe('')
  })

  it('writes the kinds a block takes as one sentence in the language', () => {
    const word = (k: string) => ({ text: 'krátké texty', number: 'čísla', date: 'data', choice: 'výběry', longText: 'krátké texty' })[k] ?? k
    // Czech sets a no-break space after the one-letter "a".
    expect(cardKindsList(['text', 'number', 'date', 'choice'], word, 'cs').replace(/\u00a0/g, ' ')).toBe('krátké texty, čísla, data a výběry')
    expect(cardKindsList(['text', 'longText'], word, 'cs')).toBe('krátké texty')
    expect(cardKindsList(['picture'], (k) => k, 'en')).toBe('picture')
    expect(cardKindsList(['a', 'b', 'c'], (k) => k, 'en')).toBe('a, b, and c')
    expect(cardKindsList(['a', 'b'], (k) => k, 'de')).toBe('a und b')
    expect(cardKindsList([], word, 'cs')).toBe('')
    expect(cardKindsList(['a', 'b'], (k) => k, 'not a language!!')).toBe('a, b')
  })

  it('splits the type\'s fields into the ones a block takes (the page first) and the rest', () => {
    const { fits, misfits } = cardRowFields(kurzy, ['link', 'page'])
    expect(fits.map((f) => f.key)).toEqual(['slug', 'signup'])
    expect(misfits.map((f) => f.key)).toEqual(['name', 'description', 'date', 'price', 'photo'])
    expect(cardRowFields(kurzy, ['text']).fits.map((f) => f.key)).toEqual(['name'])
    expect(cardRowFields(null, ['text'])).toEqual({ fits: [], misfits: [] })
  })

  it('tells which fields other blocks of the card show', () => {
    const items = [bound('heading', 'name'), bound('text', 'description'), { id: 'g', type: 'group', items: [bound('text', 'description'), bound('picture', 'photo')] }]
    const top = { id: 's1', type: 'section', items }
    expect(cardItemsOf(top, section)?.items).toBe(items)
    expect([...cardUsedElsewhere(top, section, 'name')]).toEqual(['description', 'photo'])
    // the block being edited does not count against itself, a second one using the same field does
    expect([...cardUsedElsewhere(top, section, 'description')]).toEqual(['name', 'description', 'photo'])
    expect([...cardUsedElsewhere(top, section, null)].sort()).toEqual(['description', 'name', 'photo'])
    expect(cardItemsOf(top, plainSection())).toBeNull()
    expect(cardUsedElsewhere(null, section, 'x').size).toBe(0)
    expect(cardUsedElsewhere(top, null, 'x').size).toBe(0)
  })
})

describe('the picker of a card', () => {
  const pageDefs: BlockDefs = { text: { fields: [plain('text')] }, section }

  it('makes the section of a chosen type with its starter card in one block', () => {
    const b = cardSectionBlock(pageDefs, 'section', 'Kurzy', kurzy, 'cs')!
    expect(b.type).toBe('section')
    expect(typeof b.id).toBe('string')
    expect(b.source).toEqual({ type: 'Kurzy' })
    expect(types(b.items)).toEqual(['picture', 'heading', 'text', 'button'])
    expect(b.items[3].label).toBe('Zjistit víc')
    // a type with no fields that fit: an empty card, no error
    expect(cardSectionBlock(pageDefs, 'section', 'Empty', { name: 'Empty', titleField: '', fields: [] }, 'cs')!.items).toEqual([])
    expect(cardSectionBlock(pageDefs, 'text', 'Kurzy', kurzy, 'cs')).toBeNull()
    expect(cardSectionBlock(pageDefs, 'nope', 'Kurzy', kurzy, 'cs')).toBeNull()
  })

  it('lists the fields a list takes with the block each brings, the page last', () => {
    const rows = cardPickerFields(listDefs, STARTER, kurzy)
    expect(rows.map((r) => r.key)).toEqual(['name', 'description', 'date', 'price', 'photo', 'signup', 'slug'])
    expect(rows.find((r) => r.key === 'name')).toEqual({ key: 'name', kind: 'text', label: 'Název', block: 'heading' })
    expect(rows.find((r) => r.key === 'photo')?.block).toBe('picture')
    expect(rows.at(-1)).toMatchObject({ key: 'slug', block: 'button' })
    // a list that takes only pictures offers only picture fields
    expect(cardPickerFields({ picture }, STARTER, kurzy).map((r) => r.key)).toEqual(['photo'])
    expect(cardPickerFields({}, STARTER, kurzy)).toEqual([])
    expect(cardPickerFields(listDefs, STARTER, null)).toEqual([])
  })

  it('offers empty blocks: plain ones, and at the top the declared groups', () => {
    expect(cardEmptyChoices(listDefs, STARTER, true).map((c) => [c.type, c.group?.set?.arrangement ?? null])).toEqual([
      ['heading', null], ['text', null], ['picture', null], ['button', null], ['group', 'row'], ['group', 'stack'],
    ])
    // inside a group: no groups
    expect(cardEmptyChoices(small, STARTER, false).map((c) => c.type)).toEqual(['heading', 'text', 'picture', 'button'])
    expect(cardEmptyChoices(listDefs, STARTER, false).map((c) => c.type)).toEqual(['heading', 'text', 'picture', 'button'])
    // a group type no declared group covers is a plain empty block at the top
    expect(cardEmptyChoices(listDefs, { starter: [], groups: [] }, true).map((c) => [c.type, c.group])).toEqual([
      ['heading', null], ['text', null], ['picture', null], ['button', null], ['group', null],
    ])
  })

  it('gives a block added into a group that holds one the next values', () => {
    const row = { id: 'g', type: 'group', arrangement: 'row', items: [bound('heading', 'name')] }
    const added = cardBlockForField(listDefs, STARTER, kurzy, 'price', 'cs')!
    expect(cardApplyNext(added, listDefs, STARTER, row, 'cs')).toMatchObject({ type: 'text', field: 'price' })
    const wide = cardApplyNext(added, listDefs, STARTER, row, 'cs')
    expect(wide.size).toBe('content')
    // an empty group, or one that is not a row: nothing changes
    expect(cardApplyNext(added, listDefs, STARTER, { ...row, items: [] }, 'cs')).toEqual(added)
    expect(cardApplyNext(added, listDefs, STARTER, { ...row, arrangement: 'stack' }, 'cs')).toEqual(added)
    expect(cardApplyNext(added, listDefs, STARTER, null, 'cs')).toEqual(added)
    // a block with no such field keeps its shape
    const noSize = { id: 'x', type: 'picture' }
    expect(cardApplyNext(noSize, { picture: { fields: [plain('field')] } }, STARTER, row, 'cs')).toEqual(noSize)
  })
})

function plainSection(): BlockKindDef { return { fields: [{ key: 'title', type: 'text', meta: {} }] } }

describe('the rows of a card (part 3c)', () => {
  it('quotes a text as its language does', () => {
    expect(cardQuote('Ahoj', 'cs')).toBe('\u201EAhoj\u201C')
    expect(cardQuote('Hallo', 'de-AT')).toBe('\u201EHallo\u201C')
    expect(cardQuote('Hi', 'en')).toBe('\u201CHi\u201D')
  })

  it('sums a block up by what it shows', () => {
    const s = (b: unknown, def: BlockKindDef) => cardRowSummary(cardBlockState(b, def, kurzy), 'cs')
    expect(s(bound('picture', 'photo'), picture)).toEqual({ kind: 'field', text: 'Fotka', warn: false })
    expect(s(bound('button', 'slug'), button)).toEqual({ kind: 'page', text: 'Stránka', warn: false })
    expect(s({ id: 'a', type: 'heading', text: 'Nový termín' }, heading)).toEqual({ kind: 'own', text: '\u201ENový termín\u201C', warn: false })
    expect(s({ id: 'a', type: 'picture' }, picture)).toEqual({ kind: 'unbound', text: '', warn: true })
    expect(s(bound('heading', 'gone'), heading)).toEqual({ kind: 'missing', text: 'gone', warn: true })
    expect(s(bound('picture', 'name'), picture)).toEqual({ kind: 'unfit', text: 'Název', warn: true })
    expect(s({ id: 'g', type: 'group', items: [] }, group)).toEqual({ kind: 'group', text: '', warn: false })
    expect(cardRowSummary(cardBlockState({}, undefined, null), 'cs').kind).toBe('other')
  })

  it('cuts a long text of its own and joins its lines', () => {
    const long = 'a'.repeat(80)
    const sum = cardRowSummary({ state: 'own', text: `${long}\n b` }, 'en')
    expect(sum.text.length).toBeLessThanOrEqual(43)
    expect(sum.text.endsWith('…\u201D')).toBe(true)
    expect(cardRowSummary({ state: 'own', text: 'a\n\n b' }, 'en').text).toBe('\u201Ca b\u201D')
  })

  it('counts the blocks of a group', () => {
    expect(cardGroupCount({ items: [1, 2, 3] }, group)).toBe(3)
    expect(cardGroupCount({ items: [] }, group)).toBe(0)
    expect(cardGroupCount({}, group)).toBe(0)
    expect(cardGroupCount(null, null)).toBe(0)
  })

  it('counts the repeats of the card', () => {
    expect(cardRepeatCount(4, 20, 3)).toBe(4)
    expect(cardRepeatCount(0, 20, 3)).toBe(0)
    expect(cardRepeatCount(null, 20, 3)).toBe(3)
    expect(cardRepeatCount(null, 2, 3)).toBe(2)
    expect(cardRepeatCount(undefined, 20, null)).toBe(6)
    expect(cardRepeatCount(null, 0, null)).toBe(0)
    expect(cardRepeatCount(null, null, 3)).toBeNull()
    expect(cardRepeatCount(null, -1, 3)).toBeNull()
  })
})

describe('the type changing under the card (part 3c)', () => {
  const holding = (items: any[]) => ({ id: 's', type: 'section', source: { type: 'Kurzy' }, items })

  it('reads the card of a section', () => {
    expect(cardItemsIn(holding([]), section)).toMatchObject({ key: 'items', items: [] })
    expect(cardItemsIn(holding([]), heading)).toBeNull()
    expect(cardItemsIn(null, section)).toBeNull()
  })

  it('designs an empty card from the new type', () => {
    const out = cardTypeChange(holding([]), section, null, kurzy, 'cs')!
    expect(out.mode).toBe('starter')
    expect(out.key).toBe('items')
    expect(types(out.items)).toEqual(['picture', 'heading', 'text', 'button'])
    expect(out.unbound).toBe(0)
  })

  it('remaps a card with blocks and counts the blocks left unbound', () => {
    const items = [bound('picture', 'photo'), bound('heading', 'name'), bound('text', 'description')]
    const out = cardTypeChange(holding(items), section, kurzy, reference, 'cs')!
    expect(out.mode).toBe('remap')
    expect(out.items.map((b) => b.field)).toEqual(['photo', 'author', 'quote'])
    expect(out.unbound).toBe(0)
    const few = cardTypeChange(holding(items), section, kurzy, plainType, 'cs')!
    expect(few.unbound).toBe(1)
  })

  it('does nothing for the same type or a section with no card', () => {
    expect(cardTypeChange(holding([bound('picture', 'photo')]), section, kurzy, kurzy, 'cs')).toBeNull()
    expect(cardTypeChange({ id: 'x' }, heading, null, kurzy, 'cs')).toBeNull()
  })

  it('remaps from a type that is gone', () => {
    const out = cardTypeChange(holding([bound('picture', 'photo')]), section, null, kurzy, 'cs')!
    expect(out.mode).toBe('remap')
    expect(out.items[0].field).toBe('photo')
  })

  it('designs the card again and counts a section\'s unbound blocks', () => {
    const items = [bound('picture', 'gone'), { id: 'e', type: 'heading' }]
    expect(cardSectionUnbound(holding(items), section, kurzy)).toEqual(['picture-gone', 'e'])
    expect(cardSectionUnbound(holding([]), section, kurzy)).toEqual([])
    expect(cardSectionUnbound({}, heading, kurzy)).toEqual([])
    const again = cardRedesign(holding(items), section, kurzy, 'en')!
    expect(again.key).toBe('items')
    expect(types(again.items)).toEqual(['picture', 'heading', 'text', 'button'])
    expect(cardRedesign({}, heading, kurzy, 'en')).toBeNull()
  })
})

describe('cardExampleRow: the fullest entry when no card was clicked', () => {
  it('takes the shown entry that fills the most fields, in the shown order', async () => {
    const { cardExampleRow } = await import('../../packages/cms/shared/builder-card')
    const rows = [{ id: 'a', name: 'Bare' }, { id: 'b', name: 'Full', description: 'x', price: 1 }, { id: 'c', name: 'Also full', description: 'y', price: 2 }]
    expect(cardExampleRow(rows, { entity: 'custom_course', section: 's', fields: ['name', 'description', 'price'] })?.id).toBe('b')
    expect(cardExampleRow(rows, { entity: 'custom_course', section: 's', fields: ['name', 'description', 'price'], sources: [{ entity: 'custom_course', entries: [{ id: 'c' }, { id: 'b' }] }] })?.id).toBe('c')
    expect(cardExampleRow(rows, { entity: 'custom_course', section: 's', fields: ['name'], cardEntry: { section: 's', entity: 'custom_course', id: 'a' } })?.id).toBe('a')
    expect(cardExampleRow(rows, { entity: 'custom_course', section: 's' })?.id).toBe('a')
  })
})
