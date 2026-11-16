import { describe, expect, it } from 'vitest'
import { blocksSchema, defineBlock, defineEntity, f, mediaIdsInBlocks } from 'tinyzoo'
import * as config from '../../playground/cms.config'

const defs = config.Page.fields.sections.blocks!
const schema = blocksSchema(defs)
const M = '00000000-0000-4000-8000-0000000000aa'

describe('defineBlock', () => {
  it('refuses field types blocks do not support, and reserved keys', () => {
    const Tag = defineEntity('blocktag', { label: 'T', titleField: 'name', fields: { name: f.text() } })
    expect(() => defineBlock({ label: 'X', fields: { tag: f.relation({ to: () => Tag, kind: 'many-to-one' }) } })).toThrow(/do not support/)
    expect(() => defineBlock({ label: 'X', fields: { type: f.text() } })).toThrow(/reserved/)
  })

  it('allows a list inside a block, one level deep', () => {
    const faq = f.list({ fields: { q: f.text({ required: true }), a: f.text() } })
    expect(() => defineBlock({ label: 'FAQ', fields: { items: faq } })).not.toThrow()
    const deeper = f.list({ fields: { group: f.text(), items: faq } })
    expect(() => defineBlock({ label: 'X', fields: { groups: deeper } })).toThrow(/one level/)
  })
})

describe('a list inside a block', () => {
  const card = (id: string, over: Record<string, unknown> = {}) => ({ id, type: 'item', title: `Karta ${id}`, text: null, image: null, ...over })

  it('validates each item and points an error at block, list and item', () => {
    expect(schema.safeParse([{ id: 'c', type: 'cards', heading: 'Proč my', items: [card('1'), card('2', { image: M })] }]).success).toBe(true)
    expect(schema.safeParse([{ id: 'c', type: 'cards', heading: null }]).success).toBe(true) // the list may be left empty
    const r = schema.safeParse([{ id: 'c', type: 'cards', items: [card('1'), card('2', { title: '' })] }])
    expect(r.success).toBe(false)
    expect(r.error!.issues[0]!.path).toEqual([0, 'items', 1, 'title'])
  })

  it('finds media inside the list (for cleanup and the content API)', () => {
    const M2 = '00000000-0000-4000-8000-0000000000bb'
    const ids = mediaIdsInBlocks([{ id: 'h', type: 'hero', heading: 'X', image: M }, { id: 'c', type: 'cards', items: [card('1', { image: M2 }), card('2')] }], defs)
    expect(ids).toEqual([M, M2])
  })
})

describe('blocks validation', () => {
  it('accepts known block types with their own fields', () => {
    const r = schema.safeParse([
      { id: 'a1', type: 'hero', heading: 'Vítejte', image: M },
      { id: 'a2', type: 'text', body: { type: 'doc', content: [] } },
    ])
    expect(r.success).toBe(true)
  })

  it('rejects an unknown type and points at the missing required field', () => {
    expect(schema.safeParse([{ id: 'x', type: 'video' }]).success).toBe(false)
    const r = schema.safeParse([{ id: 'ok', type: 'text' }, { id: 'h', type: 'hero', heading: '' }])
    expect(r.success).toBe(false)
    expect(r.error!.issues[0]!.path).toEqual([1, 'heading'])
  })

  it('sanitises rich text inside blocks like everywhere else', () => {
    const r: any = schema.parse([{ id: 't', type: 'text', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] } }])
    expect(r[0].body.content[0].content[0].marks).toEqual([])
  })

  it('finds every media id: media fields and images inside rich text', () => {
    const ids = mediaIdsInBlocks([
      { id: '1', type: 'hero', heading: 'H', image: 'm-hero' },
      { id: '2', type: 'text', body: { type: 'doc', content: [{ type: 'image', attrs: { mediaId: 'm-inline' } }] } },
      { id: '3', type: 'gone', image: 'not-counted' },
    ], defs)
    expect(ids.sort()).toEqual(['m-hero', 'm-inline'])
  })
})
