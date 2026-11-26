import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  blocksSchema, buildOpenApiDocument, buildRegistry, defineBlock, defineEntity, emitContentTypes, entryTexts, f, linkRef, linkRefsOf, mapRowLinks,
  mediaIdsInBlocks, upgradeBlocks, upgradeStoredRow,
} from 'tinyzoo'
import { bindingField } from '../../packages/cms/src/fields'
import { mediaIdsOfValue, newerStoredBlocks } from '../../packages/cms/cli/transfer'

// Loaded by path: the server file leans on Nitro's auto-imports (stood in for in the test), which the root type-check does not know.
const { applyPreviewDrafts, putPreviewDraft } = await import(/* @vite-ignore */ join(import.meta.dirname, '../../packages/cms/server/utils/cmsPreviewDraft.ts'))

// Lists two levels deep inside a block: a page's layout section holds small blocks and
// groups, a group holds small blocks of its own (docs/builder-plan.md, section 8, part 2).
// Everything that reads or writes a block's lists, at that depth.

const M1 = '00000000-0000-4000-8000-0000000000a1'
const M2 = '00000000-0000-4000-8000-0000000000a2'
const M3 = '00000000-0000-4000-8000-0000000000a3'
const PAGE = '00000000-0000-4000-8000-0000000000f1'
const REF = linkRef('page', PAGE)

// A heading was renamed once: v1 { title } → v2 { text }.
const heading = defineBlock({
  label: 'Heading',
  version: 2,
  upgrade: (data, from) => {
    if (from !== 1) return data
    const { title, ...rest } = data
    return { ...rest, text: title }
  },
  fields: { text: f.text({ required: true }), link: f.text({ format: 'link' }).optional() },
})
const picture = defineBlock({ label: 'Picture', fields: { image: f.media(), caption: f.richtext() } })
const group = defineBlock({
  label: 'Group',
  fields: {
    items: f.blocks({ heading, picture }),
    gap: f.select({ options: ['small', 'large'] as const, segments: true }).setting(),
  },
})
const stats = defineBlock({ label: 'Stats', fields: { rows: f.list({ fields: { n: f.number() }, max: 2 }) } })
const layout = defineBlock({
  label: 'Layout',
  fields: {
    arrangement: f.select({ options: ['row', 'stack', 'grid'] as const, icons: { row: 'i-lucide-columns-3', stack: 'i-lucide-rows-3' }, segments: true }).setting(),
    title: f.text(),
    items: f.blocks({ heading, picture, group, stats }),
    space: f.select({ options: ['s', 'm', 'l'] as const }).setting().label('Space between'),
  },
})
const defs = { layout, heading }
const Page = defineEntity('nestpage', {
  label: 'Pages', titleField: 'title',
  fields: { title: f.text({ required: true }), sections: f.blocks(defs) },
  content: { public: true },
})
const schema = blocksSchema(defs)

const rich = (mediaId: string) => ({ type: 'doc', content: [{ type: 'image', attrs: { src: '/x.jpg', mediaId } }] })
const h = (id: string, text: string, over: Record<string, unknown> = {}) => ({ id, type: 'heading', text, link: null, v: 2, ...over })
/** A layout whose second item is a group of two small blocks. */
const page = () => [{
  id: 'L', type: 'layout', arrangement: 'row', title: null, space: null,
  items: [
    h('a', 'Vítejte'),
    { id: 'g', type: 'group', gap: 'small', items: [h('g1', 'Uvnitř', { link: REF }), { id: 'g2', type: 'picture', image: M1, caption: rich(M2) }] },
  ],
}]

describe('the definition', () => {
  it('takes a list inside the items of a block\'s list, in both spellings', () => {
    expect(() => defineBlock({ label: 'X', fields: { items: f.blocks({ group }) } })).not.toThrow()
    const cells = f.list({ fields: { text: f.text() } })
    expect(() => defineBlock({ label: 'X', fields: { rows: f.list({ fields: { label: f.text(), cells } }) } })).not.toThrow()
    expect(() => f.group({ fields: { rows: f.list({ fields: { cells } }) } })).not.toThrow() // a group on an entry
  })

  it('refuses a third level, and names the way down', () => {
    expect(() => defineBlock({ label: 'X', fields: { sections: f.blocks({ layout }) } }))
      .toThrow(/Block field "sections" holds lists three levels deep \(sections › items › items\)\. Lists inside a block go two levels deep at most/)
    const deep = f.list({ fields: { a: f.list({ fields: { b: f.list({ fields: { c: f.text() } }) } }) } }) // two inside its item: fine on its own
    expect(() => defineBlock({ label: 'X', fields: { deep } })).toThrow(/"deep" holds lists three levels deep \(deep › a › b\)/)
    expect(() => f.group({ fields: { deep } })).toThrow(/Group field "deep" holds lists three levels deep/)
  })

  it('keeps the rules of groups and bindings at the second level', () => {
    const withList = f.group({ fields: { hours: f.list({ fields: { day: f.text() } }) } })
    const inner = defineBlock({ label: 'I', fields: { g: f.group({ fields: { t: f.text() } }) } })
    expect(() => defineBlock({ label: 'X', fields: { items: f.blocks({ outer: defineBlock({ label: 'O', fields: { items: f.blocks({ inner }) } }) }) } })).not.toThrow()
    const badInner = { label: 'I', fields: { g: withList } } // not made with defineBlock: only its place checks it
    expect(() => defineBlock({ label: 'X', fields: { items: f.blocks({ outer: { label: 'O', fields: { items: f.blocks({ badInner }) } } }) } }))
      .toThrow(/"g" is a group with a list inside/)
    const bound = defineBlock({ label: 'B', fields: { source: bindingField('entries') } })
    expect(() => defineBlock({ label: 'X', fields: { items: f.blocks({ outer: { label: 'O', fields: { items: f.blocks({ bound }) } } }) } }))
      .toThrow(/Block field "source" has type "binding"/)
  })
})

describe('a write, two levels down', () => {
  it('checks each small block and points at it', () => {
    expect(schema.safeParse(page()).success).toBe(true)
    const bad = page()
    ;(bad[0]!.items[1] as any).items[0].text = ''
    const r = schema.safeParse(bad)
    expect(r.success).toBe(false)
    expect(r.error!.issues.map((is) => is.path)).toEqual([[0, 'items', 1, 'items', 0, 'text']])
  })

  it('refuses the same id twice in the inner list', () => {
    const v = page()
    ;(v[0]!.items[1] as any).items[1].id = 'g1'
    const r = schema.safeParse(v)
    expect(r.error!.issues.map((is) => [is.path, is.message])).toEqual([[[0, 'items', 1, 'items', 1, 'id'], 'Duplicate block id']])
  })

  it('keeps the inner list\'s own most', () => {
    const v: any[] = [{ id: 'L', type: 'layout', items: [{ id: 's', type: 'stats', rows: [{ id: '1', type: 'item', n: 1 }, { id: '2', type: 'item', n: 2 }, { id: '3', type: 'item', n: 3 }] }] }]
    const r = schema.safeParse(v)
    expect(r.error!.issues.map((is) => [is.path, is.code])).toEqual([[[0, 'items', 0, 'rows'], 'too_big']])
    v[0].items[0].rows.pop()
    expect(schema.safeParse(v).success).toBe(true)
  })

  it('keeps the most of a list of blocks (f.blocks with max) at every level, and says it in the admin graph', () => {
    const small = defineBlock({ label: 'Small', fields: { text: f.text() } })
    const box = defineBlock({ label: 'Box', fields: { items: f.blocks({ small }, { max: 2 }) } })
    const section = defineBlock({ label: 'Section', fields: { items: f.blocks({ small, box }, { max: 3 }) } })
    const top = blocksSchema({ section }, 2)
    const smalls = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, type: 'small', text: null }))
    const v: any[] = [{ id: 'S', type: 'section', items: [...smalls(2), { id: 'B', type: 'box', items: smalls(3) }] }]
    expect(top.safeParse(v).error!.issues.map((is) => [is.path, is.code])).toEqual([[[0, 'items', 2, 'items'], 'too_big']])
    v[0].items[2].items.pop()
    expect(top.safeParse(v).success).toBe(true)
    v[0].items.push(...smalls(1).map((b) => ({ ...b, id: 'x' })))
    expect(top.safeParse(v).error!.issues.map((is) => [is.path, is.code])).toEqual([[[0, 'items'], 'too_big']])
    expect(top.safeParse([v[0], { ...v[0], id: 'T', items: [] }, { ...v[0], id: 'U', items: [] }]).success).toBe(false)
    expect((f.blocks({ section }, { max: 3 }) as any).meta.max).toBe(3)
    expect((f.blocks({ section }) as any).meta.max).toBeUndefined()
  })

  it('keeps an inner block of a type that is gone only when the same block is stored there', () => {
    const gone = { id: 'old', type: 'video', url: 'https://example.com/v.mp4' }
    const v = page()
    ;(v[0]!.items[1] as any).items.push(gone)
    expect(schema.safeParse(v).success).toBe(false) // never added
    const kept: any = blocksSchema(defs, 500, structuredClone(v)).parse(v)
    expect(kept[0].items[1].items[2]).toEqual(gone)
    // stored, but somewhere else: not the same block
    const elsewhere = page()
    ;(elsewhere[0]!.items as any[]).push(gone)
    expect(blocksSchema(defs, 500, elsewhere).safeParse(v).success).toBe(false)
  })

  it('takes an inner block that says it is behind only when it is stored so, and brings it up to date', () => {
    const v = page()
    ;(v[0]!.items[1] as any).items[0] = { id: 'g1', type: 'heading', title: 'Starý', v: 1 }
    const r = schema.safeParse(v)
    expect(r.error!.issues.map((is) => [is.path, is.message])).toEqual([[[0, 'items', 1, 'items', 0, 'v'], 'This block is out of date — reload the page and try again']])
    const stored = structuredClone(v)
    const out: any = blocksSchema(defs, 500, stored).parse(v)
    expect(out[0].items[1].items[0]).toEqual({ id: 'g1', type: 'heading', text: 'Starý', v: 2 })
  })
})

describe('reading stored pages', () => {
  it('upgrades a small block inside a group (and says where, for content:migrate)', () => {
    const stored = page()
    ;(stored[0]!.items[1] as any).items[0] = { id: 'g1', type: 'heading', title: 'Starý' }
    const seen: unknown[] = []
    const out: any = upgradeBlocks(stored, defs, { onUpgrade: (i) => seen.push([i.type, i.path]) })
    expect(out[0].items[1].items[0]).toEqual({ id: 'g1', type: 'heading', text: 'Starý', v: 2 })
    expect(out[0].items[0]).toBe(stored[0]!.items[0]) // what needs no change stays the same object
    expect(seen).toEqual([['heading', [0, 'items', 1, 'items', 0]]])
    const row: any = upgradeStoredRow(Page.fields, { sections: stored }, {})
    expect(row.sections[0].items[1].items[0].text).toBe('Starý')
  })

  it('finds the media two levels down, pictures in rich text too, for the content API and cleanup', () => {
    expect(mediaIdsInBlocks(page(), defs)).toEqual([M1, M2])
    expect(mediaIdsOfValue(Page.fields.sections, page())).toEqual([M1, M2])
    // an inner block of an older shape: every id inside it counts, so its files are not deleted under it
    const old = page()
    ;(old[0]!.items[1] as any).items[0] = { id: 'g1', type: 'heading', title: M3 }
    expect(mediaIdsInBlocks(old, defs)).toEqual([M3, M1, M2])
  })

  it('finds and rewrites the links two levels down', () => {
    const fields = Page.fields as any
    expect([...linkRefsOf(fields, { sections: page() })]).toEqual([REF])
    const out: any = mapRowLinks(fields, { sections: page() }, { field: (v) => (v === REF ? '/o-nas' : undefined) })
    expect(out.sections[0].items[1].items[0].link).toBe('/o-nas')
  })

  it('indexes the text two levels down for search', () => {
    expect(entryTexts(Page.fields as any, { title: 'Úvod', sections: page() })).toEqual(['Úvod', 'Vítejte', 'Uvnitř'])
  })

  it('names a small block stored by a newer version of the site (import, transfer)', () => {
    const v = page()
    ;(v[0]!.items[1] as any).items[0].v = 3
    expect(newerStoredBlocks(v, defs, ['sections'])).toEqual(['the "heading" block g1 at sections.0.items.1.items.0 is stored at version 3, this site\'s definition is at 2'])
  })
})

describe('the generated types and OpenAPI', () => {
  it('type the inner list as an array of a union of its blocks, with no any', () => {
    const src = emitContentTypes({ Page })
    const line = src.split('\n').find((l) => l.startsWith('  sections: '))!
    expect(line).toContain("{ id: string; type: 'group'; items: Array<{ id: string; type: 'heading'; text: string; link: string | null } | { id: string; type: 'picture'; image: CmsMedia | null; caption: RichTextDoc | null }>; gap: 'small' | 'large' | null }")
    expect(line).toContain("{ id: string; type: 'stats'; rows: Array<{ id: string; type: 'item'; n: number | null }> }")
    expect(line).not.toMatch(/\bany\b|unknown/)
  })

  it('describe the inner list in OpenAPI as one of its blocks', () => {
    const doc: any = buildOpenApiDocument({ Page }, { title: 'T' })
    const sections = doc.components.schemas.Nestpage.properties.sections
    const layoutItems = sections.items.oneOf.find((s: any) => s.properties.type.const === 'layout').properties.items
    const groupItems = layoutItems.items.oneOf.find((s: any) => s.properties.type.const === 'group').properties.items
    expect(groupItems.items.oneOf.map((s: any) => s.properties.type.const)).toEqual(['heading', 'picture'])
    expect(groupItems.items.discriminator).toEqual({ propertyName: 'type' })
  })
})

describe('the admin graph', () => {
  const graph = buildRegistry({ Page }).graph as any[]
  const sections = graph.find((e) => e.name === 'nestpage').fields.find((x: any) => x.key === 'sections')
  const layoutFields = sections.meta.blocks.layout.fields

  it('carries the inner list with its own block types', () => {
    const items = layoutFields.find((x: any) => x.key === 'items')
    expect(items.meta.blocks.group.fields.find((x: any) => x.key === 'items').meta.blocks.heading.fields.map((x: any) => x.key)).toEqual(['text', 'link'])
    expect(items.meta.blocks.stats.fields[0].meta.list).toEqual({ max: 2, itemLabel: null })
  })

  it('marks the settings and the segmented choices, in the order they are defined', () => {
    expect(layoutFields.filter((x: any) => x.meta.setting).map((x: any) => x.key)).toEqual(['arrangement', 'space'])
    expect(layoutFields.find((x: any) => x.key === 'space').meta).toMatchObject({ setting: true, label: 'Space between' })
    expect(layoutFields.find((x: any) => x.key === 'arrangement').meta).toMatchObject({ segments: true, icons: { row: 'i-lucide-columns-3' } })
    expect(layoutFields.find((x: any) => x.key === 'title').meta).toEqual({})
  })
})

describe('the live preview', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('leaves out only a small block not filled in yet, not its group or its layout', () => {
    vi.stubGlobal('getQuery', (e: any) => e.query ?? {})
    vi.stubGlobal('roleOf', () => ({ name: 'editor' }))
    const reg = buildRegistry({ Page })
    const e = reg.byName.get('nestpage')!
    const v = page()
    ;(v[0]!.items[1] as any).items.push({ id: 'new', type: 'heading', text: null, link: null }) // just added, still empty
    v.push({ id: 'H2', type: 'heading', text: '', link: null, v: 2 } as any) // an empty top-level block, as before
    putPreviewDraft(reg, e, 'u1', 'r1', null, { sections: v })
    const rows: any[] = [{ id: 'r1', sections: [] }]
    expect(applyPreviewDrafts({ context: { cmsUser: { id: 'u1', role: 'editor' } }, query: { preview: '' } }, reg, e, rows, null)).toBe(true)
    expect(rows[0].sections).toHaveLength(1)
    expect(rows[0].sections[0].items[1].items.map((x: any) => x.id)).toEqual(['g1', 'g2'])
  })
})
