import { describe, expect, it } from 'vitest'
import { blocksSchema, defineBlock, defineEntity, f, mediaIdsInBlocks } from '@my-cms/core'
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
