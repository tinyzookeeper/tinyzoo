import { describe, expect, it } from 'vitest'
import { defineNavigation, f } from 'tinyzoo'
import { cmsMenuTree } from '@tinyzoo/client'

// Field types and helpers added for the pilot (docs/pilot-plan.md, A2/A3).
describe('f.list', () => {
  const team = f.list({ fields: { name: f.text({ required: true }), role: f.text() }, max: 2 })

  it('stores items with an id and its item type, each validated against the fields', () => {
    const z = team.zod('create')
    expect(z.parse([{ id: 'a1', type: 'item', name: 'Jana', role: null }])).toEqual([{ id: 'a1', type: 'item', name: 'Jana', role: null }])
    expect(z.safeParse([{ id: 'a1', type: 'item', role: 'Coach' }]).success).toBe(false) // name is required
    // a type that is gone is kept when it is stored already, and never added
    const gone = { id: 'a1', type: 'other', name: 'X' }
    expect(z.safeParse([gone]).success).toBe(false)
    expect(team.zod('update', { stored: [gone] }).parse([gone])).toEqual([gone])
    expect(z.safeParse([{ id: 'a1', name: 'X' }]).success).toBe(false) // …but it still needs a type
  })

  it('caps the number of items and defaults to an empty list', () => {
    const z = team.zod('create')
    const item = (id: string) => ({ id, type: 'item', name: id })
    expect(z.safeParse([item('a'), item('b'), item('c')]).success).toBe(false)
    expect(z.parse(undefined)).toEqual([])
    expect(team.type).toBe('blocks')
    expect((team.meta as any).list).toEqual({ max: 2, itemLabel: null })
  })

  it('keeps the stored type of an existing one-type blocks field (menus: "link")', () => {
    const nav = defineNavigation()
    const main = nav.fields.main as any
    expect(Object.keys(main.blocks)).toEqual(['link'])
    expect(main.meta.list).toBeTruthy()
    expect(main.zod('create').safeParse([{ id: 'x', type: 'link', label: 'Home', url: '/', sub: false }]).success).toBe(true)
  })
})

describe('f.color', () => {
  it('accepts #rrggbb only', () => {
    const z = f.color().zod('create')
    expect(z.safeParse('#1f6feb').success).toBe(true)
    expect(z.safeParse('#FFF').success).toBe(false)
    expect(z.safeParse('red').success).toBe(false)
  })
})

describe('cmsMenuTree', () => {
  it('puts sub links into the dropdown of the link above, and keeps an orphan on top', () => {
    const tree = cmsMenuTree([
      { id: '1', label: 'Tým', url: '/tym', sub: true },
      { id: '2', label: 'O nás', url: '/o-nas' },
      { id: '3', label: 'Trenéři', url: '/treneri', sub: true },
      { id: '4', label: 'Historie', url: '/historie', sub: true },
      { id: '5', label: 'Kontakt', url: '/kontakt', sub: null },
    ])
    expect(tree.map((l) => [l.label, l.children.map((c) => c.label)])).toEqual([
      ['Tým', []], ['O nás', ['Trenéři', 'Historie']], ['Kontakt', []],
    ])
    expect(cmsMenuTree(null)).toEqual([])
  })
})
