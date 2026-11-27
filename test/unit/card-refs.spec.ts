import { describe, expect, it } from 'vitest'
import {
  blocksSchema, CUSTOM_FIELD_KINDS, cardBindingKey, customFieldKind, customTypeCard, customTypeFieldRef, defineBlock, defineEntity, definePages,
  f, fieldRefTakes, isCardBinding, isCustomFieldKind, isFieldRef, isSearchableField, entryTexts, type CustomFieldKind,
} from 'tinyzoo'
import { bindingField } from '../../packages/cms/src/fields'
import { blocksGraph } from '../../packages/cms/src/blocks'
import { isPlainTextField } from '../../packages/cms/shared/block-tree'

// A card: a page block that shows the entries of a content type with blocks a person designs, and
// the references those blocks hold to the fields of the type (customTypeCard, customTypeFieldRef).
// The server's checks of a written reference are in test/unit/card-refs-server.spec.ts.

const heading = defineBlock({ label: 'Heading', fields: { field: customTypeFieldRef({ takes: ['text'] }), tag: f.text() } })
const picture = defineBlock({ label: 'Picture', fields: { field: customTypeFieldRef({ takes: ['picture'] }) } })
const innerGroup = defineBlock({ label: 'Group', fields: { items: f.blocks({ heading, picture }) } })
const card = defineBlock({ label: 'Card', fields: { source: customTypeCard(), items: f.blocks({ heading, picture, group: innerGroup }) } })
const plain = defineBlock({ label: 'Plain', fields: { body: f.text() } })

const refused = (make: () => unknown) => {
  try { make() } catch (e) { return (e as Error).message }
  return null
}

describe('customFieldKind', () => {
  it('reads the kind of every field type of the model', () => {
    const kinds: [Parameters<typeof customFieldKind>[0], CustomFieldKind][] = [
      [{ type: 'text' }, 'text'],
      [{ type: 'text', long: false }, 'text'],
      [{ type: 'text', long: true }, 'longText'],
      [{ type: 'text', format: 'email' }, 'email'],
      [{ type: 'text', format: 'url' }, 'link'],
      [{ type: 'text', format: 'link' }, 'link'],
      [{ type: 'text', format: null, long: true }, 'longText'],
      [{ type: 'richtext' }, 'richText'],
      [{ type: 'number' }, 'number'],
      [{ type: 'datetime' }, 'date'],
      [{ type: 'select' }, 'choice'],
      [{ type: 'boolean' }, 'yesNo'],
      [{ type: 'media' }, 'picture'],
      [{ type: 'file' }, 'file'],
      [{ type: 'gallery' }, 'gallery'],
      [{ type: 'color' }, 'color'],
      [{ type: 'relation' }, 'relation'],
    ]
    for (const [field, kind] of kinds) expect(customFieldKind(field), JSON.stringify(field)).toBe(kind)
  })

  it('gives an email or a link format precedence over a long text', () => {
    expect(customFieldKind({ type: 'text', long: true, format: 'email' })).toBe('email')
    expect(customFieldKind({ type: 'text', long: true, format: 'url' })).toBe('link')
  })

  it('gives null for a field type it does not know', () => {
    expect(customFieldKind({ type: 'hologram' })).toBeNull()
    expect(customFieldKind({ type: '' })).toBeNull()
    expect(customFieldKind(null as any)).toBeNull()
  })

  it('has 15 distinct kinds, and isCustomFieldKind agrees', () => {
    expect(CUSTOM_FIELD_KINDS).toHaveLength(15)
    expect(new Set(CUSTOM_FIELD_KINDS).size).toBe(15)
    for (const kind of CUSTOM_FIELD_KINDS) expect(isCustomFieldKind(kind)).toBe(true)
    for (const no of ['', 'Text', 'string', 'picture ', null, undefined, 3, {}]) expect(isCustomFieldKind(no)).toBe(false)
  })

  it('reaches every kind but page from a model field type', () => {
    const reached = new Set([
      ...['text', 'richtext', 'number', 'datetime', 'select', 'boolean', 'media', 'file', 'gallery', 'color', 'relation'].map((type) => customFieldKind({ type })),
      customFieldKind({ type: 'text', long: true }), customFieldKind({ type: 'text', format: 'email' }), customFieldKind({ type: 'text', format: 'url' }),
    ])
    expect([...CUSTOM_FIELD_KINDS].filter((k) => !reached.has(k))).toEqual(['page'])
  })
})

describe('customTypeCard', () => {
  const field: any = customTypeCard()
  const zod = field.zod('create')
  const ok = (v: unknown) => zod.safeParse(v).success

  it('is a binding field marked as a card', () => {
    expect(field.type).toBe('binding')
    expect(field.meta.binding).toBe('card')
    expect(isCardBinding(field)).toBe(true)
    expect(isCardBinding(bindingField('entries'))).toBe(false)
    expect(isCardBinding(bindingField('chosen'))).toBe(false)
    expect(isCardBinding(f.text() as any)).toBe(false)
    expect(isCardBinding(null)).toBe(false)
  })

  it('accepts a type, with an order and a limit', () => {
    expect(ok({ type: 'custom_course' })).toBe(true)
    expect(ok({ type: 'custom_course', limit: 6 })).toBe(true)
    expect(ok({ type: 'custom_course', limit: 1 })).toBe(true)
    expect(ok({ type: 'custom_course', limit: 48 })).toBe(true)
    expect(ok({ type: 'custom_course', order: { by: 'startsAt', dir: 'asc' } })).toBe(true)
    expect(ok({ type: 'custom_course', order: { by: 'startsAt', dir: 'desc' }, limit: 12 })).toBe(true)
    expect(ok({ type: 'custom_course', order: null, limit: null })).toBe(true)
  })

  it('refuses the places and the picked entries of the other bindings', () => {
    expect(ok({ type: 'custom_course', show: { image: 'cover' } })).toBe(false)
    expect(ok({ type: 'custom_course', entries: [] })).toBe(false)
    expect(ok({ type: 'custom_course', entries: ['0b7c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'] })).toBe(false)
    expect(ok({ type: 'custom_course', other: 1 })).toBe(false)
  })

  it('refuses a limit of 0 or 49, a wrong order, and a type that is not custom_', () => {
    expect(ok({ type: 'custom_course', limit: 0 })).toBe(false)
    expect(ok({ type: 'custom_course', limit: 49 })).toBe(false)
    expect(ok({ type: 'custom_course', limit: 2.5 })).toBe(false)
    expect(ok({ type: 'custom_course', order: { by: 'startsAt', dir: 'sideways' } })).toBe(false)
    expect(ok({ type: 'custom_course', order: { by: 'not a key', dir: 'asc' } })).toBe(false)
    expect(ok({ type: 'course' })).toBe(false)
    expect(ok({ type: 'page' })).toBe(false)
    expect(ok({ type: '' })).toBe(false)
    expect(ok({})).toBe(false)
  })

  it('keeps the other bindings as they were', () => {
    const entries: any = bindingField('entries')
    expect(entries.zod('create').safeParse({ type: 'custom_course', show: { image: 'cover' } }).success).toBe(true)
  })
})

describe('customTypeFieldRef', () => {
  const field: any = customTypeFieldRef({ takes: ['text', 'number', 'text'] })
  const zod = field.zod('create')

  it('is a text with the format field, the kinds it takes without repeats, and the reference editor', () => {
    expect(field.type).toBe('text')
    expect(field.meta.format).toBe('field')
    expect(field.meta.ref.takes).toEqual(['text', 'number'])
    expect(field.ui.edit).toBe('CmsFieldRef')
    expect(isFieldRef(field)).toBe(true)
    expect(fieldRefTakes(field)).toEqual(['text', 'number'])
  })

  it('is not recognised in a plain text, a text with another format or a malformed field', () => {
    expect(isFieldRef(f.text() as any)).toBe(false)
    expect(isFieldRef(f.text({ format: 'link' }) as any)).toBe(false)
    expect(isFieldRef({ type: 'text', meta: { format: 'field' } })).toBe(false)
    expect(isFieldRef({ type: 'blocks', meta: { format: 'field', ref: { takes: [] } } })).toBe(false)
    expect(isFieldRef(null)).toBe(false)
    expect(fieldRefTakes(f.text() as any)).toEqual([])
    expect(fieldRefTakes({ type: 'text', meta: { format: 'field', ref: { takes: 'text' } } })).toEqual([])
  })

  it('throws on no kinds and on a kind it does not know', () => {
    expect(() => customTypeFieldRef({ takes: [] })).toThrow(/needs `takes`/)
    expect(() => customTypeFieldRef({} as any)).toThrow(/needs `takes`/)
    expect(() => customTypeFieldRef({ takes: ['hologram' as any] })).toThrow(/"hologram"/)
    expect(() => customTypeFieldRef({ takes: ['text', 'Text' as any] })).toThrow(/"Text"/)
  })

  it('accepts an empty text and a key, and trims it', () => {
    expect(zod.parse('')).toBe('')
    expect(zod.parse('photo')).toBe('photo')
    expect(zod.parse(' photo ')).toBe('photo')
    expect(zod.parse('slug')).toBe('slug')
  })

  it('refuses what is not a key, and a key of 65 characters', () => {
    for (const no of ['a b', 'Photo', '1photo', 'photo!', 'a-b']) expect(zod.safeParse(no).success, no).toBe(false)
    expect(zod.safeParse('a'.repeat(65)).success).toBe(false)
    expect(zod.safeParse('a'.repeat(64)).success).toBe(true)
    expect(zod.safeParse(3).success).toBe(false)
  })

  it('still takes a label', () => {
    const labelled: any = customTypeFieldRef({ takes: ['picture'] }).label({ en: 'Shows', cs: 'Ukazuje' })
    expect(isFieldRef(labelled)).toBe(true)
    expect(labelled.meta.ref.takes).toEqual(['picture'])
    expect(labelled.ui.edit).toBe('CmsFieldRef')
  })
})

describe('defineBlock and cards', () => {
  it('refuses two card bindings in one block, naming both', () => {
    const msg = refused(() => defineBlock({ label: 'Two', fields: { a: customTypeCard(), b: customTypeCard() } }))
    expect(msg).toMatch(/"a" and "b"/)
    expect(msg).toContain('customTypeCard()')
  })

  it('allows one card with an entries binding', () => {
    expect(() => defineBlock({ label: 'Both', fields: { a: customTypeCard(), b: bindingField('entries') } })).not.toThrow()
    expect(() => defineBlock({ label: 'One', fields: { a: customTypeCard() } })).not.toThrow()
  })

  it('finds the key of the card of a block', () => {
    expect(cardBindingKey(card)).toBe('source')
    expect(cardBindingKey(plain)).toBeNull()
    expect(cardBindingKey(defineBlock({ label: 'E', fields: { s: bindingField('entries') } }))).toBeNull()
    expect(cardBindingKey(undefined)).toBeNull()
  })

  it('still refuses a binding, a card too, inside a block of an inner list', () => {
    const inner = defineBlock({ label: 'Inner', fields: { source: customTypeCard() } })
    expect(() => defineBlock({ label: 'Outer', fields: { items: f.blocks({ inner }) } })).toThrow()
    const entriesInner = defineBlock({ label: 'Inner', fields: { source: bindingField('entries') } })
    expect(() => defineBlock({ label: 'Outer', fields: { items: f.blocks({ inner: entriesInner }) } })).toThrow()
  })
})

describe('where a reference may stand', () => {
  const page = (blocks: Record<string, any>) => () => definePages({ blocks })

  it('allows it at the first level of a card, with pages and with a collection', () => {
    expect(() => definePages({ blocks: { card, plain } })).not.toThrow()
    expect(() => defineEntity('refplace_ok', { label: 'P', titleField: 'title', fields: { title: f.text(), sections: f.blocks({ card }) } })).not.toThrow()
  })

  it('allows it at the second level, in a group block with its own list', () => {
    const body = defineBlock({ label: 'Body', fields: { source: customTypeCard(), items: f.blocks({ group: innerGroup }) } })
    expect(() => definePages({ blocks: { body } })).not.toThrow()
  })

  it('allows it in an f.list inside a card block, with a card that also holds other fields', () => {
    const rows = defineBlock({ label: 'Rows', fields: { source: customTypeCard(), items: f.blocks({ heading }), extra: f.list({ fields: { field: customTypeFieldRef({ takes: ['text'] }) } }) } })
    expect(() => definePages({ blocks: { rows } })).not.toThrow()
  })

  it('refuses it as a field of a top-level block, with the path', () => {
    const top = defineBlock({ label: 'Top', fields: { source: customTypeCard(), field: customTypeFieldRef({ takes: ['text'] }) } })
    const msg = refused(page({ top }))!
    expect(msg).toContain('page › sections › top › field')
    expect(msg).toContain('customTypeCard()')
  })

  it('refuses it as a field of a top-level block that holds no card', () => {
    const top = defineBlock({ label: 'Top', fields: { field: customTypeFieldRef({ takes: ['text'] }) } })
    expect(refused(page({ top }))).toContain('page › sections › top › field')
  })

  it('refuses it in the lists of a block that holds no card, at both levels', () => {
    const one = defineBlock({ label: 'Plain', fields: { items: f.blocks({ heading }) } })
    expect(refused(page({ plain: one }))).toContain('page › sections › plain › items › heading › field')
    const two = defineBlock({ label: 'Plain', fields: { items: f.blocks({ group: innerGroup }) } })
    expect(refused(page({ plain: two }))).toContain('page › sections › plain › items › group › items › heading › field')
  })

  it('refuses it in a group, anywhere', () => {
    const grouped = defineBlock({ label: 'Grouped', fields: { source: customTypeCard(), look: f.group({ fields: { field: customTypeFieldRef({ takes: ['text'] }) } }) } })
    expect(refused(page({ grouped }))).toContain('page › sections › grouped › look › field')
    const innerGrouped = defineBlock({ label: 'Inner', fields: { look: f.group({ fields: { field: customTypeFieldRef({ takes: ['text'] }) } }) } })
    const outer = defineBlock({ label: 'Outer', fields: { source: customTypeCard(), items: f.blocks({ inner: innerGrouped }) } })
    expect(refused(page({ outer }))).toContain('page › sections › outer › items › inner › look › field')
    const deep = defineBlock({ label: 'Deep', fields: { source: customTypeCard(), look: f.group({ fields: { more: f.group({ fields: { field: customTypeFieldRef({ takes: ['text'] }) } }) } }) } })
    expect(refused(page({ deep }))).toContain('page › sections › deep › look › more › field')
  })

  it('refuses it as a field of an entity, with the path', () => {
    const msg = refused(() => defineEntity('refplace_field', { label: 'P', titleField: 'title', fields: { title: f.text(), shows: customTypeFieldRef({ takes: ['text'] }) } }))!
    expect(msg).toContain('refplace_field › shows')
    expect(msg).toContain('customTypeCard()')
  })

  it('refuses it in a group of an entity', () => {
    const msg = refused(() => defineEntity('refplace_group', { label: 'P', titleField: 'title', fields: { title: f.text(), look: f.group({ fields: { field: customTypeFieldRef({ takes: ['text'] }) } }) } }))
    expect(msg).toContain('refplace_group › look › field')
  })

  it('refuses it in an f.list item of an entity', () => {
    const msg = refused(() => defineEntity('refplace_list', { label: 'P', titleField: 'title', fields: { title: f.text(), rows: f.list({ fields: { field: customTypeFieldRef({ takes: ['text'] }) } }) } }))
    expect(msg).toContain('refplace_list › rows › item › field')
  })

  it('allows an f.list of a card block, and refuses it in a block without a card', () => {
    const top = defineBlock({ label: 'Top', fields: { source: customTypeCard(), rows: f.list({ fields: { field: customTypeFieldRef({ takes: ['text'] }) } }) } })
    // A list directly in a card block is a list of blocks like another: this is the allowed first level.
    expect(() => definePages({ blocks: { top } })).not.toThrow()
    const plainTop = defineBlock({ label: 'Top', fields: { rows: f.list({ fields: { field: customTypeFieldRef({ takes: ['text'] }) } }) } })
    expect(refused(page({ top: plainTop }))).toContain('page › sections › top › rows › item › field')
  })

  it('cannot reach a third level, where a block does not load at all', () => {
    const third = defineBlock({ label: 'Third', fields: { items: f.blocks({ heading }) } })
    const second = defineBlock({ label: 'Second', fields: { items: f.blocks({ third }) } })
    expect(() => defineBlock({ label: 'Top', fields: { source: customTypeCard(), items: f.blocks({ second }) } })).toThrow(/three levels deep/)
  })

  it('still refuses a card in an inner block', () => {
    const inner = defineBlock({ label: 'Inner', fields: { source: customTypeCard() } })
    expect(() => defineBlock({ label: 'Outer', fields: { source: customTypeCard(), items: f.blocks({ inner }) } })).toThrow()
  })
})

describe('the admin graph of a card', () => {
  const graph: any = blocksGraph({ card })
  const fieldOf = (fields: any[], key: string) => fields.find((x) => x.key === key)

  it('marks the binding as a card', () => {
    expect(fieldOf(graph.card.fields, 'source').meta.binding).toBe('card')
    expect(fieldOf(graph.card.fields, 'source').type).toBe('binding')
  })

  it('carries what a reference takes at the first level', () => {
    const items = fieldOf(graph.card.fields, 'items')
    const ref = fieldOf(items.meta.blocks.heading.fields, 'field')
    expect(ref.meta.ref.takes).toEqual(['text'])
    expect(ref.meta.format).toBe('field')
    expect(ref.ui.edit).toBe('CmsFieldRef')
    expect(fieldOf(items.meta.blocks.picture.fields, 'field').meta.ref.takes).toEqual(['picture'])
  })

  it('carries what a reference takes at the second level', () => {
    const items = fieldOf(graph.card.fields, 'items')
    const inner = fieldOf(items.meta.blocks.group.fields, 'items')
    expect(fieldOf(inner.meta.blocks.heading.fields, 'field').meta.ref.takes).toEqual(['text'])
    expect(fieldOf(inner.meta.blocks.picture.fields, 'field').meta.ref.takes).toEqual(['picture'])
  })

  it('is the same in the graph of the entity\'s own field', () => {
    const Page: any = definePages({ blocks: { card } })
    const sections = Page.fields.sections
    expect(fieldOf(sections.meta.blocks.card.fields, 'source').meta.binding).toBe('card')
    expect(fieldOf(fieldOf(sections.meta.blocks.card.fields, 'items').meta.blocks.heading.fields, 'field').meta.ref.takes).toEqual(['text'])
  })
})

describe('a reference is no prose', () => {
  it('is not searched, and its value is not in the words of an entry', () => {
    const ref: any = customTypeFieldRef({ takes: ['text'] })
    expect(isSearchableField(ref)).toBe(false)
    expect(isSearchableField(f.text() as any)).toBe(true)
    const Searchy = defineEntity('refsearch', { label: 'P', titleField: 'title', fields: { title: f.text(), sections: f.blocks({ card }) } })
    const row = { sections: [{ id: 'b1', type: 'card', source: { type: 'custom_course' }, items: [{ id: 'i1', type: 'heading', field: 'cover', tag: 'Hello' }] }] }
    const texts = entryTexts(Searchy.fields as any, row)
    expect(texts).toContain('Hello')
    expect(texts).not.toContain('cover')
  })

  it('is never typed in the page', () => {
    const graph: any = blocksGraph({ heading })
    const [ref, tag] = [graph.heading.fields.find((x: any) => x.key === 'field'), graph.heading.fields.find((x: any) => x.key === 'tag')]
    expect(isPlainTextField(ref)).toBe(false)
    expect(isPlainTextField(tag)).toBe(true)
  })
})

describe('a reference as written in blocks', () => {
  const GOOD = '00000000-0000-4000-8000-0000000000b1'
  const schema = blocksSchema({ card })
  const block = (field: unknown) => [{ id: GOOD, type: 'card', source: { type: 'custom_course' }, items: [{ id: '00000000-0000-4000-8000-0000000000b2', type: 'heading', field }] }]

  it('is stored as a text', () => {
    const parsed = schema.safeParse(block('cover'))
    expect(parsed.success).toBe(true)
    expect(parsed.success && (parsed.data as any)[0].items[0].field).toBe('cover')
  })

  it('may be empty or null', () => {
    expect(schema.safeParse(block('')).success).toBe(true)
    expect(schema.safeParse(block(null)).success).toBe(true)
    expect(schema.safeParse(block(undefined)).success).toBe(true)
  })

  it('is trimmed', () => {
    const parsed = schema.safeParse(block(' cover '))
    expect(parsed.success && (parsed.data as any)[0].items[0].field).toBe('cover')
  })

  it('refuses a text that is not a key, at its path', () => {
    const parsed = schema.safeParse(block('not a key'))
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(parsed.error.issues.some((i) => i.path.includes('field'))).toBe(true)
  })

  it('refuses a card binding with places', () => {
    const parsed = schema.safeParse([{ id: GOOD, type: 'card', source: { type: 'custom_course', show: { image: 'cover' } }, items: [] }])
    expect(parsed.success).toBe(false)
  })

  it('checks a reference at the second level the same way', () => {
    const nested = (field: unknown) => [{ id: GOOD, type: 'card', source: { type: 'custom_course' }, items: [{ id: '00000000-0000-4000-8000-0000000000b3', type: 'group', items: [{ id: '00000000-0000-4000-8000-0000000000b4', type: 'heading', field }] }] }]
    expect(schema.safeParse(nested('cover')).success).toBe(true)
    expect(schema.safeParse(nested('Not a key')).success).toBe(false)
  })
})
