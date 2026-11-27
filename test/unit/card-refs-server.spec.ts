import { describe, expect, it } from 'vitest'
import { customTypeCard, customTypeFieldRef, defineBlock, f, type ModelDoc } from '../../packages/cms/src/index'
import {
  bindingBlockTypes, bindingFields, bindingMissing, bindingsIn, bindingUses, cardRefProblems, cardRefsIn, publicCustomTypes, refKind,
} from '../../packages/cms/server/utils/cmsBindings'

// The pure parts of what a card's references to the fields of a content type need on the server
// (cmsBindings.ts): finding them in stored blocks, saying which fields they use and whether the
// site has them, and checking a written reference. The package's side is in card-refs.spec.ts.

const label = (en: string) => ({ en })

const heading = defineBlock({ label: 'Heading', fields: { field: customTypeFieldRef({ takes: ['text', 'longText'] }), tag: f.text() } })
const picture = defineBlock({ label: 'Picture', fields: { field: customTypeFieldRef({ takes: ['picture'] }) } })
const when = defineBlock({ label: 'When', fields: { field: customTypeFieldRef({ takes: ['date'] }) } })
const group = defineBlock({ label: 'Group', fields: { items: f.blocks({ heading, picture, when }) } })
const card = defineBlock({ label: 'Card', fields: { source: customTypeCard(), items: f.blocks({ heading, picture, when, group }) } })
const text = defineBlock({ label: 'Text', fields: { body: f.text() } })
const other = defineBlock({ label: 'Other', fields: { source: customTypeCard(), items: f.blocks({ heading }) } })
const entries = defineBlock({ label: 'Entries', fields: { source: customTypeCard() } })
const defs = { card, other, text, entries }
const sections = f.blocks(defs) as any
const fields = { sections }

/** A document with one type, `custom_course`, the way the model keeps it. */
function docOf(over: Record<string, unknown> = {}, extra: any[] = []): ModelDoc {
  return {
    format: 1,
    types: [{
      name: 'custom_course', label: label('Courses'), titleField: 'title', ...over,
      fields: [
        { key: 'title', type: 'text', label: label('Title'), required: true },
        { key: 'perex', type: 'text', long: true, label: label('Perex') },
        { key: 'cover', type: 'media', label: label('Cover') },
        { key: 'startsAt', type: 'datetime', allDay: true, label: label('Starts') },
        { key: 'level', type: 'select', options: [], label: label('Level') },
        { key: 'old', type: 'text', label: label('Old'), removedAt: '2026-11-01T00:00:00.000Z' },
        ...extra,
      ],
    }],
  } as unknown as ModelDoc
}
const doc = docOf({ page: { prefix: 'kurzy' } })

const h = (id: string, field: unknown) => ({ id, type: 'heading', field })
const p = (id: string, field: unknown) => ({ id, type: 'picture', field })
const w = (id: string, field: unknown) => ({ id, type: 'when', field })
const g = (id: string, ...items: unknown[]) => ({ id, type: 'group', items })
const cardOf = (id: string, items: unknown[], type: string | null = 'custom_course') => ({ id, type: 'card', source: type ? { type } : null, items })
const write = (...blocks: unknown[]) => ({ sections: blocks })
const problems = (data: Record<string, unknown>, stored: Record<string, unknown> | null = null, d: ModelDoc | null = doc) => cardRefProblems(fields, data, stored, d)
const paths = (list: { path: (string | number)[] }[]) => list.map((x) => x.path)

describe('cardRefsIn', () => {
  const block = cardOf('c1', [h('i1', 'title'), p('i2', 'cover'), g('i3', h('i4', 'perex'), w('i5', 'startsAt')), h('i6', '')])

  it('finds the references at both levels, with their kinds taken, paths and ids', () => {
    expect(cardRefsIn(block, card)).toEqual([
      { key: 'title', takes: ['text', 'longText'], path: ['items', 0, 'field'], ids: ['i1'] },
      { key: 'cover', takes: ['picture'], path: ['items', 1, 'field'], ids: ['i2'] },
      { key: 'perex', takes: ['text', 'longText'], path: ['items', 2, 'items', 0, 'field'], ids: ['i3', 'i4'] },
      { key: 'startsAt', takes: ['date'], path: ['items', 2, 'items', 1, 'field'], ids: ['i3', 'i5'] },
    ])
  })

  it('leaves out an empty or blank reference, and trims a key', () => {
    expect(cardRefsIn(cardOf('c', [h('a', ''), h('b', '   '), h('c', null), h('d', undefined), h('e', 5), h('f', ' title ')]), card).map((r) => [r.key, r.path])).toEqual([['title', ['items', 5, 'field']]])
  })

  it('skips a block of a type the definition does not have, and anything of an odd shape', () => {
    expect(cardRefsIn(cardOf('c', [{ id: 'x', type: 'unknown', field: 'title' }, { id: 'y', field: 'title' }, null, 'a', 3, [], { id: 'z', type: 4 }]), card)).toEqual([])
    for (const junk of [null, undefined, 'x', 5, [], {}, { items: 'no' }, { items: { id: 'a' } }]) expect(() => cardRefsIn(junk, card)).not.toThrow()
    expect(cardRefsIn(null, card)).toEqual([])
    expect(cardRefsIn({ items: 3 }, card)).toEqual([])
    expect(cardRefsIn(block, { fields: {} })).toEqual([])
    expect(cardRefsIn(block, undefined as any)).toEqual([])
  })

  it('does not take a block type from the prototype', () => {
    expect(cardRefsIn(cardOf('c', [{ id: 'x', type: 'constructor', field: 'title' }, { id: 'y', type: 'toString', field: 'title' }]), card)).toEqual([])
  })

  it('gives an empty id for a block without one', () => {
    expect(cardRefsIn(cardOf('c', [{ type: 'heading', field: 'title' }]), card)[0]!.ids).toEqual([''])
  })

  it('finds nothing in a block with no list, and nothing below the second level', () => {
    expect(cardRefsIn({ id: 'c', type: 'text', body: 'x' }, text)).toEqual([])
    const deep = cardOf('c', [g('i3', { id: 'i4', type: 'group', items: [h('i5', 'title')] })])
    expect(cardRefsIn(deep, card)).toEqual([])
  })
})

describe('bindingsIn with the definitions of the blocks', () => {
  const types = bindingBlockTypes(defs)
  const block = cardOf('c1', [h('i1', 'title'), g('i3', h('i4', 'title'), p('i5', 'cover'))])

  it('names the types that hold a binding, a card block among them', () => {
    expect([...types.keys()]).toEqual(['card', 'other', 'entries'])
  })

  it('gives a card\'s binding with the fields its blocks show, each once, at both levels', () => {
    const [found] = bindingsIn([block], types, defs)
    expect(found!.block).toEqual({ id: 'c1', type: 'card', heading: null })
    expect(found!.key).toBe('source')
    expect(found!.binding).toEqual({ type: 'custom_course' })
    expect(found!.refs).toEqual(['title', 'cover'])
  })

  it('gives no refs without the definitions', () => {
    expect(bindingsIn([block], types)[0]!.refs).toEqual([])
    expect(bindingsIn([block], types, undefined)[0]!.refs).toEqual([])
  })

  it('gives no refs for a block whose definition is not among them', () => {
    expect(bindingsIn([block], types, { text })[0]!.refs).toEqual([])
    expect(bindingsIn([block], types, {})[0]!.refs).toEqual([])
  })

  it('gives no refs for a binding of another kind, which holds no references', () => {
    const blocksWithEntries = { ...defs, ...{ custom_entries: defineBlock({ label: 'E', fields: { source: customTypeCard() } }) } }
    const [found] = bindingsIn([{ id: 'e', type: 'entries', source: { type: 'custom_course' } }], bindingBlockTypes(blocksWithEntries), blocksWithEntries)
    expect(found!.refs).toEqual([])
  })

  it('has no refs for a block that is skipped, and finds the card again in each block', () => {
    expect(bindingsIn([cardOf('c', [h('i', 'title')], null)], types, defs)).toEqual([])
    const found = bindingsIn([block, cardOf('c2', [p('j', 'cover')])], types, defs)
    expect(found.map((x) => x.refs)).toEqual([['title', 'cover'], ['cover']])
  })
})

describe('bindingFields, bindingUses and bindingMissing with the fields a card shows', () => {
  const binding = { type: 'custom_course', order: { by: 'startsAt', dir: 'asc' as const } }

  it('names each field once, the references after the places and the order', () => {
    expect(bindingFields(binding, ['title', 'cover', 'startsAt'])).toEqual(['startsAt', 'title', 'cover'])
    expect(bindingFields(binding, [])).toEqual(['startsAt'])
    expect(bindingFields({ type: 'custom_course' }, ['a', '', 'a'])).toEqual(['a'])
  })

  it('uses a field a card\'s block shows, and not another one', () => {
    expect(bindingUses(binding, 'custom_course', 'cover', ['cover'])).toBe(true)
    expect(bindingUses(binding, 'custom_course', 'cover')).toBe(false)
    expect(bindingUses(binding, 'custom_course', 'cover', ['perex'])).toBe(false)
    expect(bindingUses(binding, 'custom_recipe', 'cover', ['cover'])).toBe(false)
    expect(bindingUses(binding, 'custom_course', null, [])).toBe(true)
  })

  it('misses a shown field the type does not have or has hidden', () => {
    expect(bindingMissing({ type: 'custom_course' }, doc, ['title', 'cover'])).toBeNull()
    expect(bindingMissing({ type: 'custom_course' }, doc, ['cover', 'nothing', 'old'])).toEqual({ fields: ['nothing', 'old'] })
  })

  it('has slug only when the type has pages', () => {
    expect(bindingMissing({ type: 'custom_course' }, doc, ['slug'])).toBeNull()
    expect(bindingMissing({ type: 'custom_course' }, docOf(), ['slug'])).toEqual({ fields: ['slug'] })
  })

  it('misses the type first, whatever its blocks show', () => {
    expect(bindingMissing({ type: 'custom_recipe' }, doc, ['cover'])).toEqual({ type: 'custom_recipe' })
    expect(bindingMissing({ type: 'custom_course' }, null, ['cover'])).toEqual({ type: 'custom_course' })
  })
})

describe('refKind', () => {
  const type = doc.types[0]!
  const typeNoPage = docOf().types[0]!

  it('says the kind of a visible field', () => {
    expect(refKind(type, 'title')).toBe('text')
    expect(refKind(type, 'perex')).toBe('longText')
    expect(refKind(type, 'cover')).toBe('picture')
    expect(refKind(type, 'startsAt')).toBe('date')
    expect(refKind(type, 'level')).toBe('choice')
  })

  it('says page for slug when the type has pages, and null when it has none', () => {
    expect(refKind(type, 'slug')).toBe('page')
    expect(refKind(typeNoPage, 'slug')).toBeNull()
  })

  it('says null for a hidden field and one the type does not have', () => {
    expect(refKind(type, 'old')).toBeNull()
    expect(refKind(type, 'nothing')).toBeNull()
    expect(refKind(type, '')).toBeNull()
  })

  it('does not let a field named slug of a type without pages stand for the page', () => {
    const odd = docOf({}, [{ key: 'slug', type: 'text', label: label('Slug') }]).types[0]!
    expect(refKind(odd, 'slug')).toBeNull()
  })
})

describe('cardRefProblems', () => {
  it('accepts references that fit, at both levels, with pages for slug', () => {
    const data = write(cardOf('c1', [h('i1', 'title'), h('i2', 'perex'), p('i3', 'cover'), w('i4', 'startsAt'), g('i5', h('i6', 'title'), p('i7', 'cover'))]))
    expect(problems(data)).toEqual([])
  })

  it('accepts an empty reference, a blank one and no reference at all', () => {
    expect(problems(write(cardOf('c1', [h('i1', ''), h('i2', '  '), h('i3', null), { id: 'i4', type: 'heading' }, g('i5', h('i6', ''))]), cardOf('c2', [], null)))).toEqual([])
    expect(problems(write(cardOf('c1', [h('i1', '')], null)))).toEqual([])
  })

  it('accepts slug when the type has pages, as the kind page the block takes', () => {
    const slugBlock = defineBlock({ label: 'Link', fields: { field: customTypeFieldRef({ takes: ['page'] }) } })
    const own = defineBlock({ label: 'Own', fields: { source: customTypeCard(), items: f.blocks({ link: slugBlock }) } })
    const own2 = { sections: f.blocks({ own }) as any }
    const data = write({ id: 'c', type: 'own', source: { type: 'custom_course' }, items: [{ id: 'l', type: 'link', field: 'slug' }] })
    expect(cardRefProblems(own2, data, null, doc)).toEqual([])
    const msg = cardRefProblems(own2, data, null, docOf())
    expect(msg).toHaveLength(1)
    expect(msg[0]!.message).toContain('has no pages')
  })

  it('refuses a field the type does not have, with the path at the first level', () => {
    const [one, ...rest] = problems(write(cardOf('c1', [h('i1', 'title'), h('i2', 'nothing')])))
    expect(rest).toEqual([])
    expect(one).toMatchObject({ code: 'custom', path: ['sections', 0, 'items', 1, 'field'] })
    expect(one!.message).toContain('"custom_course"')
    expect(one!.message).toContain('"nothing"')
  })

  it('refuses a field the type does not have, with the path at the second level', () => {
    const list = problems(write(cardOf('c0', []), cardOf('c1', [h('i1', 'title'), g('i2', h('i3', 'title'), h('i4', 'nothing'))])))
    expect(paths(list)).toEqual([['sections', 1, 'items', 1, 'items', 1, 'field']])
  })

  it('refuses a hidden field', () => {
    const list = problems(write(cardOf('c1', [h('i1', 'old')])))
    expect(paths(list)).toEqual([['sections', 0, 'items', 0, 'field']])
    expect(list[0]!.message).toContain('has no field "old"')
  })

  it('refuses a field of a kind the block does not take, naming both', () => {
    const list = problems(write(cardOf('c1', [h('i1', 'cover'), g('i2', p('i3', 'title'))])))
    expect(paths(list)).toEqual([['sections', 0, 'items', 0, 'field'], ['sections', 0, 'items', 1, 'items', 0, 'field']])
    expect(list[0]!.message).toContain('picture')
    expect(list[0]!.message).toContain('text, longText')
    expect(list[1]!.message).toContain('"title"')
    expect(list[1]!.message).toContain('kind text')
  })

  it('refuses slug when the type has no pages, with its own message', () => {
    const slugBlock = defineBlock({ label: 'Link', fields: { field: customTypeFieldRef({ takes: ['text', 'page'] }) } })
    const own = defineBlock({ label: 'Own', fields: { source: customTypeCard(), items: f.blocks({ link: slugBlock }) } })
    const data = write({ id: 'c', type: 'own', source: { type: 'custom_course' }, items: [{ id: 'l', type: 'link', field: 'slug' }] })
    expect(cardRefProblems({ sections: f.blocks({ own }) as any }, data, null, docOf())[0]!.message).toContain('no pages')
  })

  it('refuses a reference while the block has no type chosen yet', () => {
    for (const source of [null, undefined, {}, { type: '' }, { type: 7 }]) {
      const list = problems(write({ id: 'c1', type: 'card', source, items: [h('i1', 'title')] }))
      expect(paths(list)).toEqual([['sections', 0, 'items', 0, 'field']])
      expect(list[0]!.message).toMatch(/none is chosen yet/)
    }
  })

  it('refuses a reference to a type that is not among the site\'s own, or is hidden', () => {
    expect(problems(write(cardOf('c1', [h('i1', 'title')], 'custom_recipe')))[0]!.message).toContain('"custom_recipe"')
    const hidden = docOf({ removedAt: '2026-11-01T00:00:00.000Z' })
    expect(paths(problems(write(cardOf('c1', [h('i1', 'title')])), null, hidden))).toEqual([['sections', 0, 'items', 0, 'field']])
  })

  it('refuses a new reference when there is no document at all', () => {
    expect(paths(problems(write(cardOf('c1', [h('i1', 'title'), g('i2', p('i3', 'cover'))])), null, null))).toEqual([
      ['sections', 0, 'items', 0, 'field'], ['sections', 0, 'items', 1, 'items', 0, 'field'],
    ])
  })

  it('looks at each block against its own type', () => {
    const list = problems(write(
      { id: 'a', type: 'other', source: { type: 'custom_course' }, items: [h('h1', 'title')] },
      { id: 'b', type: 'other', source: { type: 'custom_recipe' }, items: [h('h2', 'title')] },
    ))
    expect(paths(list)).toEqual([['sections', 1, 'items', 0, 'field']])
  })

  it('ignores a block without a card, a block of an unknown type and junk in the list', () => {
    const data = write({ id: 't', type: 'text', body: 'x', items: [h('i', 'nothing')] }, { id: 'u', type: 'unknown', items: [h('i', 'nothing')] }, null, 'x', 3, { id: 'v' })
    expect(problems(data)).toEqual([])
  })

  it('skips a blocks field that is not in the write, and one that is not a list', () => {
    expect(problems({})).toEqual([])
    expect(problems({ title: 'x' })).toEqual([])
    expect(problems({ sections: null })).toEqual([])
    expect(problems({ sections: 'x' })).toEqual([])
    expect(problems({ sections: {} })).toEqual([])
  })

  it('checks every blocks field of the entity and leaves other fields alone', () => {
    const two = { title: f.text() as any, intro: f.blocks({ card }) as any, sections }
    const data = { title: 'x', intro: [cardOf('c1', [h('i1', 'nothing')])], sections: [cardOf('c2', [h('i2', 'nothing')])] }
    expect(paths(cardRefProblems(two, data, null, doc))).toEqual([['intro', 0, 'items', 0, 'field'], ['sections', 0, 'items', 0, 'field']])
  })

  it('collects every refusal of a write', () => {
    expect(problems(write(cardOf('c1', [h('i1', 'a'), h('i2', 'b'), h('i3', 'c')])))).toHaveLength(3)
  })

  it('tolerates fields and data that are missing', () => {
    expect(cardRefProblems(undefined as any, {}, null, doc)).toEqual([])
    expect(cardRefProblems(fields, undefined as any, null, doc)).toEqual([])
    expect(cardRefProblems({ sections: { type: 'blocks' } }, write(), null, doc)).toEqual([])
  })
})

describe('cardRefProblems keeps a reference that is stored already', () => {
  // The type lost the field: a new reference to it is refused, the stored one stays.
  const lost = docOf({ page: { prefix: 'kurzy' } })
  lost.types[0]!.fields = lost.types[0]!.fields.filter((x) => x.key !== 'cover')
  const stored = write(cardOf('c1', [h('i1', 'title'), p('i2', 'cover'), g('i3', h('i4', 'title'), p('i5', 'cover'))]))
  const check = (data: Record<string, unknown>, s: Record<string, unknown> | null | undefined = stored) => cardRefProblems(fields, data, s, lost)

  it('refuses it without a stored copy', () => {
    expect(paths(check(stored, null))).toEqual([['sections', 0, 'items', 1, 'field'], ['sections', 0, 'items', 2, 'items', 1, 'field']])
    expect(paths(cardRefProblems(fields, stored, undefined, lost))).toHaveLength(2)
  })

  it('keeps it at both levels when the same blocks hold the same value', () => {
    expect(check(stored)).toEqual([])
    expect(check(structuredClone(stored))).toEqual([])
  })

  it('keeps it when the block moved in the list, since it is found by its id', () => {
    const moved = write(cardOf('c0', []), cardOf('c1', [g('i3', p('i5', 'cover'), h('i4', 'title')), p('i2', 'cover'), h('i1', 'title')]))
    expect(check(moved)).toEqual([])
  })

  it('keeps it when the stored field is a JSON string', () => {
    expect(check(stored, { sections: JSON.stringify(stored.sections) })).toEqual([])
  })

  it('refuses it when the stored field is a JSON string that is no JSON or no list', () => {
    expect(paths(check(stored, { sections: '{not json' }))).toHaveLength(2)
    expect(paths(check(stored, { sections: '{"a":1}' }))).toHaveLength(2)
    expect(paths(check(stored, { sections: null }))).toHaveLength(2)
    expect(paths(check(stored, {}))).toHaveLength(2)
  })

  it('re-checks a reference whose stored value changed, at both levels', () => {
    const changed = write(cardOf('c1', [h('i1', 'title'), p('i2', 'level'), g('i3', h('i4', 'title'), p('i5', 'nothing'))]))
    expect(paths(check(changed))).toEqual([['sections', 0, 'items', 1, 'field'], ['sections', 0, 'items', 2, 'items', 1, 'field']])
  })

  it('re-checks a reference that moved into another block\'s list', () => {
    const moved = write(cardOf('c1', [h('i1', 'title'), g('i3', h('i4', 'title'), p('i5', 'cover'), p('i2', 'cover'))]))
    // i2 was at the first level and is now inside group i3, so it is a new reference there; i5 stays.
    expect(paths(check(moved))).toEqual([['sections', 0, 'items', 1, 'items', 2, 'field']])
  })

  it('re-checks a reference of a block whose top-level block has another id', () => {
    const copy = write(cardOf('c9', [h('i1', 'title'), p('i2', 'cover'), g('i3', h('i4', 'title'), p('i5', 'cover'))]))
    expect(check(copy)).toHaveLength(2)
  })

  it('re-checks a reference of a block that has no id', () => {
    const noIds = write({ type: 'card', source: { type: 'custom_course' }, items: [{ type: 'picture', field: 'cover' }] })
    expect(check(noIds)).toHaveLength(1)
  })

  it('keeps a reference stored with spaces around the key as the same key', () => {
    const spaced = write(cardOf('c1', [p('i2', ' cover ')]))
    expect(check(spaced)).toEqual([])
  })

  it('keeps it only down the same list key and the same inner block ids', () => {
    const otherList = defineBlock({ label: 'Card', fields: { source: customTypeCard(), items: f.blocks({ picture }), more: f.blocks({ picture }) } })
    const own = { sections: f.blocks({ card: otherList }) as any }
    const before = write({ id: 'c1', type: 'card', source: { type: 'custom_course' }, items: [p('i2', 'cover')], more: [] })
    const after = write({ id: 'c1', type: 'card', source: { type: 'custom_course' }, items: [], more: [p('i2', 'cover')] })
    expect(cardRefProblems(own, after, before, lost)).toHaveLength(1)
    expect(cardRefProblems(own, before, before, lost)).toEqual([])
  })

  it('keeps a stored reference when the block has no type chosen yet, and refuses a new one', () => {
    const before = write({ id: 'c1', type: 'card', source: null, items: [h('i1', 'title')] })
    const same = write({ id: 'c1', type: 'card', source: null, items: [h('i1', 'title')] })
    expect(cardRefProblems(fields, same, before, doc)).toEqual([])
    const added = write({ id: 'c1', type: 'card', source: null, items: [h('i1', 'title'), h('i2', 'title')] })
    const list = cardRefProblems(fields, added, before, doc)
    expect(paths(list)).toEqual([['sections', 0, 'items', 1, 'field']])
    expect(list[0]!.message).toMatch(/none is chosen yet/)
  })

  it('keeps a stored reference when there is no document, and refuses a new one', () => {
    expect(cardRefProblems(fields, stored, stored, null)).toEqual([])
    const added = write(cardOf('c1', [h('i1', 'title'), p('i2', 'cover'), g('i3', h('i4', 'title'), p('i5', 'cover')), h('i6', 'title')]))
    expect(paths(cardRefProblems(fields, added, stored, null))).toEqual([['sections', 0, 'items', 3, 'field']])
  })

  it('keeps a stored reference to a field of the wrong kind too, as long as it is unchanged', () => {
    const odd = write(cardOf('c1', [h('i1', 'cover')]))
    expect(problems(odd, odd)).toEqual([])
    expect(problems(odd, null)).toHaveLength(1)
  })
})

describe('publicCustomTypes carries the kind of each field', () => {
  it('gives each field its kind, null for one it does not know', () => {
    const d = docOf({ page: { prefix: 'kurzy' } }, [
      { key: 'mail', type: 'text', format: 'email', label: label('Mail') },
      { key: 'site', type: 'text', format: 'url', label: label('Site') },
      { key: 'author', type: 'relation', to: 'author', label: label('Author') },
      { key: 'strange', type: 'hologram', label: label('Strange') },
    ])
    const by = Object.fromEntries(publicCustomTypes(d)[0]!.fields.map((x) => [x.key, x.kind]))
    expect(by).toEqual({ title: 'text', perex: 'longText', cover: 'picture', startsAt: 'date', level: 'choice', mail: 'email', site: 'link', author: 'relation', strange: null })
  })
})
