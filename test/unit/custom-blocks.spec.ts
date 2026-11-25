import { describe, expect, it } from 'vitest'
import {
  blocksSchema, buildOpenApiDocument, CUSTOM_PREFIX, customTypeBlocks, defineBlock, defineEntity, emitContentTypes, entryTexts, f, isSearchableField, mediaIdsInBlocks,
  BINDING_ENTRIES_MAX, BINDING_LIMIT_MAX, BINDING_MORE_MAX, CUSTOM_BLOCK_TYPES,
} from 'tinyzoo'
import { bindingField, bindingSchema } from '../../packages/cms/src/fields'

const ID = '0b7c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
const full = {
  type: 'custom_course',
  show: { image: 'cover', text: 'perex', date: 'startsAt', label: 'level', more: ['price'] },
  order: { by: 'startsAt', dir: 'asc' },
  limit: 6,
  entries: [ID],
}
const ok = (v: unknown) => bindingSchema.safeParse(v).success

describe('the binding schema', () => {
  it('accepts a full binding, a minimal one, and nulls where they are allowed', () => {
    expect(ok(full)).toBe(true)
    expect(ok({ type: 'custom_course' })).toBe(true)
    expect(ok({ type: 'custom_course', show: { image: null, text: null, date: null, label: null }, order: null, limit: null })).toBe(true)
    expect(ok({ type: 'custom_course', limit: BINDING_LIMIT_MAX })).toBe(true)
  })

  it('refuses a key it does not know, at every level', () => {
    expect(ok({ ...full, extra: 1 })).toBe(false)
    expect(ok({ ...full, show: { ...full.show, extra: 'a' } })).toBe(false)
    expect(ok({ ...full, order: { ...full.order, extra: 1 } })).toBe(false)
  })

  it('refuses a type that is not the name of a custom type', () => {
    expect(ok({ type: 'course' })).toBe(false)
    expect(ok({ type: 'custom_Course' })).toBe(false)
    expect(ok({ type: 'custom_cou rse' })).toBe(false)
    expect(ok({ type: `custom_${'a'.repeat(58)}` })).toBe(false)
    expect(ok({})).toBe(false)
  })

  it('refuses a bad field key, or one that is too long', () => {
    expect(ok({ type: 'custom_course', show: { image: 'Cover' } })).toBe(false)
    expect(ok({ type: 'custom_course', show: { text: 'a-b' } })).toBe(false)
    expect(ok({ type: 'custom_course', show: { more: ['1a'] } })).toBe(false)
    expect(ok({ type: 'custom_course', order: { by: 'a'.repeat(65), dir: 'asc' } })).toBe(false)
    expect(ok({ type: 'custom_course', show: { date: 'a'.repeat(65) } })).toBe(false)
  })

  it('limits the extra fields, the limit and the entries', () => {
    expect(ok({ type: 'custom_course', show: { more: Array.from({ length: BINDING_MORE_MAX }, (_, i) => `f${i}`) } })).toBe(true)
    expect(ok({ type: 'custom_course', show: { more: Array.from({ length: BINDING_MORE_MAX + 1 }, (_, i) => `f${i}`) } })).toBe(false)
    for (const limit of [0, BINDING_LIMIT_MAX + 1, 1.5]) expect(ok({ type: 'custom_course', limit })).toBe(false)
    expect(ok({ type: 'custom_course', entries: ids(BINDING_ENTRIES_MAX) })).toBe(true)
    expect(ok({ type: 'custom_course', entries: ids(BINDING_ENTRIES_MAX + 1) })).toBe(false)
    expect(ok({ type: 'custom_course', entries: ['not-an-id'] })).toBe(false)
  })

  it('takes only asc or desc as a direction', () => {
    expect(ok({ type: 'custom_course', order: { by: 'startsAt', dir: 'desc' } })).toBe(true)
    expect(ok({ type: 'custom_course', order: { by: 'startsAt', dir: 'up' } })).toBe(false)
    expect(ok({ type: 'custom_course', order: { by: 'startsAt' } })).toBe(false)
  })
})

describe('a binding inside a block', () => {
  const defs = customTypeBlocks()
  const schema = blocksSchema(defs)
  const block = (type: string, extra: Record<string, unknown> = {}) => [{ id: 'b1', type, heading: 'Courses', ...extra }]

  it('may be missing, null, or a full binding', () => {
    for (const type of Object.values(CUSTOM_BLOCK_TYPES)) {
      expect(schema.safeParse(block(type)).success).toBe(true)
      expect(schema.safeParse(block(type, { source: null })).success).toBe(true)
      expect(schema.safeParse(block(type, { source: full, layout: 'rows' })).success).toBe(true)
    }
  })

  it('refuses a binding of the wrong shape, pointing at the field', () => {
    const r = schema.safeParse(block('custom_entries', { source: { ...full, extra: 1 } }))
    expect(r.success).toBe(false)
    expect(r.error!.issues.every((is) => is.path[0] === 0 && is.path[1] === 'source')).toBe(true)
  })
})

describe('a binding outside a block', () => {
  const inner = () => ({ source: bindingField('entries') })

  it('is refused as a field of a collection or a global', () => {
    expect(() => defineEntity('bindingholder', { label: 'X', titleField: 'name', fields: { name: f.text(), source: bindingField('entries') } })).toThrow(/a binding is a field of a block only/)
  })

  it('is refused in a group, a list item, and a block inside a block', () => {
    expect(() => f.group({ fields: inner() })).toThrow(/Group field "source" has type "binding": a binding is a field of a block only/)
    expect(() => f.list({ fields: inner() })).toThrow(/List item field "source" has type "binding"/)
    const withBinding = defineBlock({ label: 'B', fields: inner() })
    expect(() => defineBlock({ label: 'Outer', fields: { rows: f.blocks({ b: withBinding }) } })).toThrow(/Block field "source" has type "binding"/)
  })

  it('is refused in the blocks field of a group', () => {
    const withBinding = defineBlock({ label: 'B', fields: inner() })
    expect(() => f.group({ fields: { rows: f.blocks({ b: withBinding }) } })).toThrow(/Group field "source" has type "binding"/)
  })

  it('is allowed as a field of a block used straight on a collection', () => {
    const Page = defineEntity('bindingpage', { label: 'P', titleField: 'title', fields: { title: f.text(), sections: f.blocks({ ...customTypeBlocks() }) } })
    expect(Page.fields.sections.blocks).toHaveProperty('custom_entries')
  })
})

describe('customTypeBlocks()', () => {
  const defs = customTypeBlocks()

  it('has the two blocks, named from the prefix', () => {
    expect(Object.keys(defs)).toEqual([`${CUSTOM_PREFIX}entries`, `${CUSTOM_PREFIX}chosen`])
    expect(CUSTOM_BLOCK_TYPES).toEqual({ entries: 'custom_entries', chosen: 'custom_chosen' })
  })

  it('says what each is, in three languages, with an icon', () => {
    for (const def of Object.values(defs)) {
      for (const text of [def.label, def.description]) expect(Object.keys(text as object)).toEqual(['en', 'cs', 'de'])
      expect(def.icon).toMatch(/^i-lucide-/)
    }
    expect(defs.custom_entries.label).toEqual({ en: 'Entries', cs: 'Seznam záznamů', de: 'Einträge' })
    expect(defs.custom_chosen.label).toEqual({ en: 'Chosen entries', cs: 'Vybrané záznamy', de: 'Ausgewählte Einträge' })
  })

  it('holds the same four fields, the source being a binding of its kind', () => {
    for (const [type, kind] of [['custom_entries', 'entries'], ['custom_chosen', 'chosen']] as const) {
      const fields: any = defs[type].fields
      expect(Object.keys(fields)).toEqual(['heading', 'text', 'source', 'layout'])
      expect(fields.source.type).toBe('binding')
      expect(fields.source.meta.binding).toBe(kind)
      expect(fields.source.ui.edit).toBe('CmsFieldBinding')
      expect(fields.source.isRequired).toBe(false)
      expect(fields.layout.meta.options).toEqual(['cards', 'rows'])
      expect(fields.layout.default).toBe('cards')
    }
  })
})

describe('what is generated for a binding', () => {
  const Plain = defineEntity('plainpage', { label: 'P', titleField: 'title', content: { public: true }, fields: { title: f.text(), sections: f.blocks({ text: defineBlock({ label: 'T', fields: { body: f.text() } }) }) } })
  const Bound = defineEntity('boundpage', { label: 'P', titleField: 'title', content: { public: true }, fields: { title: f.text(), sections: f.blocks({ ...customTypeBlocks() }) } })

  it('types the source with CmsBinding when the blocks are there', () => {
    const ts = emitContentTypes({ Bound })
    expect(ts).toContain('export interface CmsBinding {')
    expect(ts).toContain("type: 'custom_entries'; heading: string | null; text: string | null; source: CmsBinding | null")
    expect(ts).toContain("type: 'custom_chosen'")
    const doc: any = buildOpenApiDocument({ Bound })
    expect(doc.components.schemas.CmsBinding).toMatchObject({ type: 'object', additionalProperties: false, required: ['type'] })
    expect(doc.components.schemas.CmsBinding.properties.limit).toEqual({ type: ['integer', 'null'], minimum: 1, maximum: 48 })
    expect(doc.components.schemas.CmsBinding.properties.entries).toMatchObject({ maxItems: 12 })
    expect(JSON.stringify(doc.components.schemas.BoundPage ?? doc.components.schemas.Boundpage)).toContain('#/components/schemas/CmsBinding')
  })

  it('says nothing of it without them', () => {
    expect(emitContentTypes({ Plain })).not.toContain('CmsBinding')
    expect(JSON.stringify(buildOpenApiDocument({ Plain }))).not.toContain('CmsBinding')
  })
})

describe('a binding is not text, and holds no media', () => {
  const defs = customTypeBlocks()
  const source: any = defs.custom_entries.fields.source

  it('is not searched', () => {
    expect(isSearchableField(source)).toBe(false)
    const Bound = defineEntity('searchpage', { label: 'P', titleField: 'title', fields: { title: f.text(), sections: f.blocks({ ...customTypeBlocks() }) } })
    const row = { sections: [{ id: 'b1', type: 'custom_entries', heading: 'Courses', source: { type: 'custom_course', show: { text: 'perex' } } }] }
    expect(entryTexts(Bound.fields as any, row)).toEqual(['Courses'])
  })

  it('counts no media', () => {
    expect(mediaIdsInBlocks([{ id: 'b1', type: 'custom_chosen', source: { type: 'custom_course', entries: [ID] } }], defs)).toEqual([])
  })
})
