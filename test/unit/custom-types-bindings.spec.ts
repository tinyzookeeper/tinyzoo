import { describe, expect, it } from 'vitest'
import { customTypeBlocks, defineBlock, f, type CmsBinding, type ModelDoc } from '../../packages/cms/src/index'
import { blocksGraph } from '../../packages/cms/src/blocks'
import {
  bindingBlockTypes, bindingFields, bindingMissing, bindingsIn, bindingUses, publicCustomTypes, withoutBindingBlocks,
} from '../../packages/cms/server/utils/cmsBindings'

// The pure parts of what the generic blocks (x_entries, x_chosen) need on the server
// (cmsBindings.ts). The walk of the stored pages and the routes are in test/api/tenants-custom.spec.ts.

const label = (en: string) => ({ en })
const blocks = { text: defineBlock({ label: 'Text', fields: { body: f.text() } }), ...customTypeBlocks() }
const types = bindingBlockTypes(blocks)

/** A document with one type, `x_course`, the way the model keeps it. */
function docOf(over: Record<string, unknown> = {}, fields: any[] = []): ModelDoc {
  return {
    format: 1,
    types: [{
      name: 'x_course', label: label('Courses'), titleField: 'title', ...over,
      fields: [
        { key: 'title', type: 'text', label: label('Title'), required: true },
        { key: 'perex', type: 'text', long: true, label: label('Perex') },
        { key: 'startsAt', type: 'datetime', allDay: true, label: label('Starts') },
        ...fields,
      ],
    }],
  } as unknown as ModelDoc
}

describe('bindingBlockTypes', () => {
  it('lists the blocks that hold a binding with the keys of those fields, and no other block', () => {
    expect([...types.entries()]).toEqual([['x_entries', ['source']], ['x_chosen', ['source']]])
    expect(bindingBlockTypes({})).toEqual(new Map())
  })
})

describe('bindingsIn', () => {
  const entries = { id: 'b1', type: 'x_entries', heading: 'Courses', source: { type: 'x_course', limit: 3 } }

  it('finds the binding of each block with the block\'s id, type and heading', () => {
    const found = bindingsIn([{ id: 't', type: 'text', body: 'x' }, entries, { id: 'b2', type: 'x_chosen', heading: '  ', source: { type: 'x_course', entries: [] } }], types)
    expect(found).toEqual([
      { block: { id: 'b1', type: 'x_entries', heading: 'Courses' }, key: 'source', binding: { type: 'x_course', limit: 3 } },
      { block: { id: 'b2', type: 'x_chosen', heading: null }, key: 'source', binding: { type: 'x_course', entries: [] } },
    ])
  })

  it('skips a block whose binding is absent, null or has no type', () => {
    const none = [
      { id: '1', type: 'x_entries' }, { id: '2', type: 'x_entries', source: null }, { id: '3', type: 'x_entries', source: {} },
      { id: '4', type: 'x_entries', source: { type: 7 } }, { id: '5', type: 'x_entries', source: { type: '' } }, { id: '6', type: 'x_entries', source: [] },
      { id: '7', type: 'x_entries', source: 'x_course' },
    ]
    expect(bindingsIn(none, types)).toEqual([])
  })

  it('tolerates what is not a list of blocks', () => {
    for (const junk of [null, undefined, 'x', 5, {}, [null, 3, 'a', [], { type: 4 }, { type: 'x_entries', source: { type: 'x_course' } }]]) {
      expect(() => bindingsIn(junk, types)).not.toThrow()
    }
    expect(bindingsIn({ type: 'x_entries', source: { type: 'x_course' } }, types)).toEqual([])
    expect(bindingsIn([null, 3, { type: 4 }, { type: 'x_entries', source: { type: 'x_course' } }], types)).toHaveLength(1)
    expect(bindingsIn([{ type: 'x_entries', source: { type: 'x_course' } }], types)[0]!.block.id).toBe('')
  })
})

describe('bindingFields and bindingUses', () => {
  const binding: CmsBinding = { type: 'x_course', show: { image: 'cover', text: 'perex', date: null, label: 'level', more: ['price', 'perex'] }, order: { by: 'startsAt', dir: 'asc' } }

  it('names each field once, in every place a binding uses one', () => {
    expect(bindingFields(binding)).toEqual(['cover', 'perex', 'level', 'price', 'startsAt'])
    expect(bindingFields({ type: 'x_course' })).toEqual([])
    expect(bindingFields({ type: 'x_course', show: { more: [3 as any, '', 'a'] }, order: null })).toEqual(['a'])
  })

  it('uses a type when it names it, and a field when it shows it or orders by it', () => {
    expect(bindingUses(binding, 'x_course', null)).toBe(true)
    expect(bindingUses(binding, 'x_recipe', null)).toBe(false)
    for (const field of ['cover', 'perex', 'level', 'price', 'startsAt']) expect(bindingUses(binding, 'x_course', field), field).toBe(true)
    expect(bindingUses(binding, 'x_course', 'title')).toBe(false)
    expect(bindingUses(binding, 'x_recipe', 'cover')).toBe(false)
    expect(bindingUses({ type: 'x_course' }, 'x_course', 'cover')).toBe(false)
  })
})

describe('bindingMissing', () => {
  const doc = docOf({ page: { prefix: 'kurzy' }, publish: true })

  it('says the type when the document has no such type, or has it hidden', () => {
    expect(bindingMissing({ type: 'x_recipe' }, doc)).toEqual({ type: 'x_recipe' })
    expect(bindingMissing({ type: 'x_course' }, null)).toEqual({ type: 'x_course' })
    expect(bindingMissing({ type: 'x_course' }, docOf({ removedAt: '2026-11-01T00:00:00.000Z' }))).toEqual({ type: 'x_course' })
    // The type decides: its fields are not looked at.
    expect(bindingMissing({ type: 'x_recipe', show: { image: 'nothing' } }, doc)).toEqual({ type: 'x_recipe' })
  })

  it('says the fields the type does not have, or has hidden', () => {
    expect(bindingMissing({ type: 'x_course', show: { image: 'cover', text: 'perex' }, order: { by: 'price', dir: 'desc' } }, doc)).toEqual({ fields: ['cover', 'price'] })
    const hidden = docOf({}, [{ key: 'cover', type: 'media', label: label('Cover'), removedAt: '2026-11-01T00:00:00.000Z' }])
    expect(bindingMissing({ type: 'x_course', show: { image: 'cover' } }, hidden)).toEqual({ fields: ['cover'] })
  })

  it('never misses what every type has, and the fields the mapper adds by the type\'s settings', () => {
    const every: CmsBinding = { type: 'x_course', show: { date: 'createdAt', label: 'updatedAt', more: ['title'] }, order: { by: 'createdAt', dir: 'desc' } }
    expect(bindingMissing(every, docOf())).toBeNull()
    const mapped: CmsBinding = { type: 'x_course', show: { more: ['slug', 'status', 'position'] } }
    expect(bindingMissing(mapped, docOf())).toEqual({ fields: ['slug', 'status', 'position'] })
    expect(bindingMissing(mapped, docOf({ page: { prefix: 'kurzy' } }))).toEqual({ fields: ['status', 'position'] })
    expect(bindingMissing(mapped, docOf({ page: { prefix: 'kurzy' }, publish: true }))).toEqual({ fields: ['position'] })
    expect(bindingMissing(mapped, docOf({ page: { prefix: 'kurzy' }, publish: true, order: 'manual' }))).toBeNull()
  })

  it('has nothing missing when the type and its fields are there', () => {
    expect(bindingMissing({ type: 'x_course' }, doc)).toBeNull()
    expect(bindingMissing({ type: 'x_course', show: { text: 'perex', date: 'startsAt' }, order: { by: 'startsAt', dir: 'asc' } }, doc)).toBeNull()
  })
})

describe('withoutBindingBlocks', () => {
  /** A graph as `/api/cms/_graph` has it: blocks fields at the top, in a group, and inside a block's list. */
  function makeGraph() {
    const all = blocksGraph(blocks)
    const entity = (name: string, fields: unknown[]) => ({ name, label: name, fields, listColumns: ['title'] })
    const sections = { key: 'sections', type: 'blocks', meta: { blocks: all } }
    const faq = { key: 'faq', type: 'blocks', meta: { blocks: blocksGraph({ item: defineBlock({ label: 'Item', fields: { q: f.text() } }) }), list: { max: 5 } } }
    const group = { key: 'extra', type: 'group', meta: { fields: [{ key: 'more', type: 'blocks', meta: { blocks: all } }, { key: 'note', type: 'text', meta: {} }] } }
    return [
      entity('page', [{ key: 'title', type: 'text', meta: {} }, sections, group]),
      entity('post', [{ key: 'title', type: 'text', meta: {} }, faq]),
      entity('author', [{ key: 'name', type: 'text', meta: {} }]),
    ]
  }
  const deepFreeze = <T>(v: T): T => {
    if (v && typeof v === 'object') { Object.values(v).forEach(deepFreeze); Object.freeze(v) }
    return v
  }

  it('takes the blocks that hold a binding out of a blocks field and of one inside a group, and keeps the others', () => {
    const graph = makeGraph()
    const out = withoutBindingBlocks(graph) as any[]
    const was = graph as any[]
    expect(Object.keys(was[0].fields[1].meta.blocks)).toEqual(['text', 'x_entries', 'x_chosen'])
    expect(Object.keys(out[0].fields[1].meta.blocks)).toEqual(['text'])
    expect(Object.keys(out[0].fields[2].meta.fields[0].meta.blocks)).toEqual(['text'])
    expect(out[0].fields[2].meta.fields[1]).toBe(was[0].fields[2].meta.fields[1])
    expect(out[0].fields[1].meta.blocks.text).toBe(was[0].fields[1].meta.blocks.text)
  })

  it('never changes its input, and returns the same objects for what did not change', () => {
    const graph = deepFreeze(makeGraph())
    const before = structuredClone(graph)
    const out = withoutBindingBlocks(graph) as any[]
    expect(graph).toEqual(before)
    expect(out).not.toBe(graph)
    expect(out[0]).not.toBe(graph[0])
    expect(out[1]).toBe(graph[1])
    expect(out[2]).toBe(graph[2])
    expect(out[0].fields[0]).toBe((graph as any[])[0].fields[0])
  })

  it('returns the graph itself when no block holds a binding', () => {
    const graph = makeGraph().slice(1)
    expect(withoutBindingBlocks(graph)).toBe(graph)
    expect(withoutBindingBlocks([])).toEqual([])
  })
})

describe('publicCustomTypes', () => {
  const doc = docOf(
    { labelSingular: label('Course'), page: { prefix: 'kurzy', image: 'cover', summary: 'perex' }, publish: true, order: { by: 'startsAt', dir: 'asc' } },
    [
      { key: 'level', type: 'select', label: label('Level'), help: label('How hard'), options: [{ value: 'a', label: label('Easy') }, { value: 'b', label: label('Old'), removed: true }] },
      { key: 'cover', type: 'media', label: label('Cover'), removedAt: '2026-11-01T00:00:00.000Z' },
      { key: 'price', type: 'number', decimal: true, label: label('Price') },
      { key: 'teacher', type: 'text', format: 'email', label: label('Teacher') },
      { key: 'author', type: 'relation', to: 'author', label: label('Author') },
    ],
  )
  doc.types.push({ name: 'x_old', label: label('Old'), titleField: 'title', removedAt: '2026-11-01T00:00:00.000Z', fields: [] } as any)

  it('describes a visible type: labels, address, order, page and publishing', () => {
    const [course, ...rest] = publicCustomTypes(doc)
    expect(rest).toEqual([])
    expect(course).toMatchObject({
      name: 'x_course', label: label('Courses'), labelSingular: label('Course'), titleField: 'title',
      path: '/kurzy/:slug', prefix: 'kurzy', publish: true, order: { by: 'startsAt', dir: 'asc' },
    })
  })

  it('leaves out a hidden type and a hidden field, and the page\'s picture when its field is hidden', () => {
    const [course] = publicCustomTypes(doc)
    expect(course!.fields.map((x) => x.key)).toEqual(['title', 'perex', 'startsAt', 'level', 'price', 'teacher', 'author'])
    expect(course!.page).toEqual({ image: null, summary: 'perex' })
  })

  it('gives each kind\'s options only when set, and every choice, a removed one marked', () => {
    const by = Object.fromEntries(publicCustomTypes(doc)[0]!.fields.map((x) => [x.key, x]))
    expect(by.title).toEqual({ key: 'title', type: 'text', label: label('Title') })
    expect(by.perex).toEqual({ key: 'perex', type: 'text', label: label('Perex'), long: true })
    expect(by.startsAt).toEqual({ key: 'startsAt', type: 'datetime', label: label('Starts'), allDay: true })
    expect(by.price).toEqual({ key: 'price', type: 'number', label: label('Price'), decimal: true })
    expect(by.teacher).toEqual({ key: 'teacher', type: 'text', label: label('Teacher'), format: 'email' })
    expect(by.author).toEqual({ key: 'author', type: 'relation', label: label('Author'), to: 'author' })
    expect(by.level).toEqual({
      key: 'level', type: 'select', label: label('Level'), help: label('How hard'),
      options: [{ value: 'a', label: label('Easy') }, { value: 'b', label: label('Old'), removed: true }],
    })
  })

  it('has no address and no page for a type without pages', () => {
    const [plain] = publicCustomTypes(docOf())
    expect(plain).toMatchObject({ path: null, prefix: null, page: null, publish: false, order: null, labelSingular: null })
  })

  it('leaves out what the instance did not build', () => {
    const built = (type: string, field: string | null) => !(field === 'price' || type === 'x_nowhere')
    expect(publicCustomTypes(doc, built)[0]!.fields.map((x) => x.key)).not.toContain('price')
    expect(publicCustomTypes(doc, () => false)).toEqual([])
    expect(publicCustomTypes(null)).toEqual([])
  })
})
