import { describe, expect, it } from 'vitest'
import { defineBlock, f } from '../../packages/cms/src/index'
import { blocksGraph } from '../../packages/cms/src/blocks'
import {
  blankBlock, blockKindSig, blockListFull, blockListKinds, blockListMax, findBlock, isLockedBlock, kindsAlong, listAt, listTakes, newBlockId, pathOfListKey,
  placeOf, treeDuplicate, treeInsert, treeMove, treeRemove, withNewIds, type BlockList,
} from '../../packages/cms/shared/block-tree'

// The value of a page's blocks as a tree (shared/block-tree.ts): the functions both the form's list
// and the editor in the preview change it with, at any depth, against the admin graph of a layout
// section like the kit's (small blocks, and groups of them, each list with its own `max`).

const heading = defineBlock({ label: 'Heading', fields: { text: f.text() } })
const picture = defineBlock({ label: 'Picture', fields: { image: f.media({ accept: 'image/*' }).optional() } })
const group = defineBlock({ label: 'Group', fields: { items: f.blocks({ heading, picture }, { max: 3 }), arrangement: f.select({ options: ['stack', 'row'] }).setting() } })
const layout = defineBlock({ label: 'Layout', fields: { items: f.blocks({ heading, picture, group }, { max: 4 }), cards: f.list({ fields: { title: f.text() } }) } })
const otherHeading = defineBlock({ label: 'Heading', fields: { text: f.text({ required: true }), eyebrow: f.text() } })
const hero = defineBlock({ label: 'Hero', fields: { heading: f.text() } })
const defs = blocksGraph({ hero, layout, heading: otherHeading }) as any

const page = () => [
  { id: 'h', type: 'hero', heading: 'Hi' },
  { id: 'L', type: 'layout', items: [
    { id: 'a', type: 'heading', text: 'A' },
    { id: 'G', type: 'group', items: [{ id: 'g1', type: 'heading', text: 'G1' }, { id: 'g2', type: 'picture', image: null }], arrangement: 'stack' },
    { id: 'b', type: 'picture', image: null },
  ], cards: [] },
  { id: 'M', type: 'layout', items: [], cards: [] },
  { id: 'x', type: 'heading', text: 'Page heading', eyebrow: null },
]
const root = (items: any[] = page(), max: number | null = null): BlockList => ({ items, defs, max })
const idsAt = (items: any[], parent: string[]) => listAt(root(items), parent)!.items.map((b: any) => b.id).join(' ')

describe('a list of blocks as a tree', () => {
  it('finds a block by its path, at any depth', () => {
    expect(findBlock(root(), ['h'])!.block.heading).toBe('Hi')
    expect(findBlock(root(), ['L', 'G', 'g1'])).toMatchObject({ index: 0, parent: ['L', 'G'], block: { text: 'G1' } })
    expect(findBlock(root(), ['L', 'b'])!.index).toBe(2)
    expect(findBlock(root(), ['L', 'g1'])).toBeNull()
    expect(findBlock(root(), ['h', 'a'])).toBeNull()
    expect(findBlock(root(), [])).toBeNull()
  })

  it('reads a list with its types and limit; a block\'s list is its first f.blocks(), never an f.list()', () => {
    expect(listAt(root(), [])!.max).toBeNull()
    expect(listAt(root(), ['L'])).toMatchObject({ key: 'items', max: 4 })
    expect(Object.keys(listAt(root(), ['L'])!.defs)).toEqual(['heading', 'picture', 'group'])
    expect(listAt(root(), ['L', 'G'])).toMatchObject({ key: 'items', max: 3 })
    expect(listAt(root(), ['h'])).toBeNull()
    expect(blockListMax({ meta: { list: { max: 30 } } })).toBe(30)
    expect(blockListMax({ meta: { max: 12 } })).toBe(12)
    expect(blockListMax({ meta: {} })).toBeNull()
    expect(blockListFull({ items: [1, 2], max: 2 })).toBe(true)
    expect(blockListFull({ items: [1, 2], max: null })).toBe(false)
  })

  it('gives the kinds of each list all the way down, and the definitions along a path', () => {
    const kinds = blockListKinds({ defs, max: null }, (d: any) => d.label)
    expect(kinds.types.layout!.list!.max).toBe(4)
    expect(Object.keys(kinds.types.layout!.list!.types)).toEqual(['heading', 'picture', 'group'])
    expect(kinds.types.layout!.list!.types.group!.list!.max).toBe(3)
    expect(kinds.types.hero!.list).toBeUndefined()
    // The small heading and the page's heading share a type, not a definition.
    expect(kinds.types.heading!.sig).not.toBe(kinds.types.layout!.list!.types.heading!.sig)
    expect(kinds.types.layout!.list!.types.heading!.sig).toBe(kinds.types.layout!.list!.types.group!.list!.types.heading!.sig)
    expect(kindsAlong(root(), ['L', 'G', 'g2']).map((k) => k.type)).toEqual(['layout', 'group', 'picture'])
  })

  it('finds the path of a list of the form from its key', () => {
    const items = page()
    expect(pathOfListKey('sections', items, 'sections')).toEqual([])
    expect(pathOfListKey('sections', items, 'sections.1.items')).toEqual(['L'])
    expect(pathOfListKey('sections', items, 'sections.1.items.1.items')).toEqual(['L', 'G'])
    expect(pathOfListKey('sections', items, 'sections.9.items')).toBeNull()
    expect(pathOfListKey('sections', items, 'other.1.items')).toBeNull()
    expect(pathOfListKey('sections', items, 'sectionsx.1.items')).toBeNull()
  })
})

describe('changing the tree', () => {
  it('inserts before, after and at the end of a list, deep inside, and leaves the old value alone', () => {
    const items = page()
    const before = JSON.stringify(items)
    const n = blankBlock(listAt(root(items), ['L', 'G'])!.defs, 'heading')
    expect(idsAt(treeInsert(root(items), { before: 'g2', in: ['L', 'G'] }, n)!, ['L', 'G'])).toBe(`g1 ${n.id} g2`)
    expect(idsAt(treeInsert(root(items), { after: 'g2', in: ['L', 'G'] }, n)!, ['L', 'G'])).toBe(`g1 g2 ${n.id}`)
    expect(idsAt(treeInsert(root(items), { end: true, in: ['M'] }, n)!, ['M'])).toBe(n.id)
    expect(idsAt(treeInsert(root(items), { before: 'h' }, blankBlock(defs, 'hero'))!, []).split(' ').length).toBe(5)
    expect(JSON.stringify(items)).toBe(before)
  })

  it('refuses an insert into a full list, of a type the list does not take, or at a place that is not there', () => {
    const items = page()
    const small = listAt(root(items), ['L'])!.defs
    const full = treeInsert(root(items), { end: true, in: ['L'] }, blankBlock(small, 'heading'))!
    expect(treeInsert(root(full), { end: true, in: ['L'] }, blankBlock(small, 'heading'))).toBeNull()
    expect(treeInsert(root(items), { end: true, in: ['L', 'G'] }, blankBlock(small, 'group'))).toBeNull()
    expect(treeInsert(root(items), { before: 'zz', in: ['L'] }, blankBlock(small, 'heading'))).toBeNull()
    expect(treeInsert(root(items), { end: true, in: ['h'] }, blankBlock(small, 'heading'))).toBeNull()
    expect(treeInsert(root(items, 4), { end: true, in: [] }, blankBlock(defs, 'hero'))).toBeNull()
  })

  it('removes a block deep inside, and says where it was so it can be put back', () => {
    const items = page()
    const gone = treeRemove(root(items), ['L', 'G', 'g1'])!
    expect(idsAt(gone.items, ['L', 'G'])).toBe('g2')
    expect(gone.place).toEqual({ before: 'g2', in: ['L', 'G'] })
    expect(idsAt(treeInsert(root(gone.items), gone.place, gone.removed)!, ['L', 'G'])).toBe('g1 g2')
    const last = treeRemove(root(items), ['L', 'b'])!
    expect(last.place).toEqual({ after: 'G', in: ['L'] })
    const only = treeRemove(root(gone.items), ['L', 'G', 'g2'])!
    expect(only.place).toEqual({ end: true, in: ['L', 'G'] })
    expect(treeRemove(root(items), ['h'])!.place).toEqual({ before: 'L' })
    expect(treeRemove(root(items), ['nope'])).toBeNull()
  })

  it('duplicates with a new id for the copy and for everything inside it', () => {
    const items = page()
    const done = treeDuplicate(root(items), ['L', 'G'])!
    const ids = idsAt(done.items, ['L']).split(' ')
    expect(ids).toEqual(['a', 'G', done.copy.id, 'b'])
    expect(done.path).toEqual(['L', done.copy.id])
    expect(done.copy.items.map((b: any) => b.id)).not.toContain('g1')
    expect(done.copy.items.map((b: any) => b.text ?? null)).toEqual(['G1', null])
    expect(new Set(JSON.stringify(done.items).match(/"id":"[^"]+"/g)).size).toBe(JSON.stringify(done.items).match(/"id":"[^"]+"/g)!.length)
    // The section's list holds at most 4.
    expect(treeDuplicate(root(done.items), ['L', 'a'])).toBeNull()
    expect(treeDuplicate(root(items), ['zz'])).toBeNull()
  })

  it('gives every block inside a copy a new id, at any depth, and nothing else changes', () => {
    const block = { id: 'L', type: 'layout', items: [{ id: 'G', type: 'group', items: [{ id: 'q', type: 'heading', text: 'x' }] }], meta: { id: 'keep' } }
    const copy = withNewIds(block)
    expect(copy.id).not.toBe('L')
    expect(copy.items[0]!.id).not.toBe('G')
    expect(copy.items[0]!.items[0]!.id).not.toBe('q')
    expect(copy.items[0]!.items[0]!.text).toBe('x')
    expect(copy.meta.id).toBe('keep')
    expect(block.items[0]!.items[0]!.id).toBe('q')
    expect(newBlockId()).toMatch(/^[0-9a-z]{12}$/)
  })

  it('moves a block within its own list, at any depth, as the page\'s list does', () => {
    const items = page()
    expect(idsAt(treeMove(root(items), ['L', 'b'], { before: 'a', in: ['L'] })!.items, ['L'])).toBe('b a G')
    expect(idsAt(treeMove(root(items), ['L', 'G', 'g1'], { after: 'g2', in: ['L', 'G'] })!.items, ['L', 'G'])).toBe('g2 g1')
    expect(idsAt(treeMove(root(items), ['x'], { before: 'h' })!.items, [])).toBe('x h L M')
    expect(treeMove(root(items), ['L', 'a'], { before: 'G', in: ['L'] })).toBeNull()
    const moved = treeMove(root(items), ['L', 'b'], { before: 'a', in: ['L'] })!
    expect(moved.back).toEqual({ after: 'G', in: ['L'] })
    expect(idsAt(treeMove(root(moved.items), moved.path, moved.back)!.items, ['L'])).toBe('a G b')
  })

  it('moves a block into another list that takes the same type, and back', () => {
    const items = page()
    const into = treeMove(root(items), ['L', 'a'], { before: 'g2', in: ['L', 'G'] })!
    expect(idsAt(into.items, ['L'])).toBe('G b')
    expect(idsAt(into.items, ['L', 'G'])).toBe('g1 a g2')
    expect(into.path).toEqual(['L', 'G', 'a'])
    expect(into.back).toEqual({ before: 'G', in: ['L'] })
    const out = treeMove(root(into.items), into.path, into.back)!
    expect(idsAt(out.items, ['L'])).toBe('a G b')
    // Out of a group into the section, and into another section's empty list.
    expect(idsAt(treeMove(root(items), ['L', 'G', 'g2'], { after: 'b', in: ['L'] })!.items, ['L'])).toBe('a G b g2')
    expect(idsAt(treeMove(root(items), ['L', 'G'], { end: true, in: ['M'] })!.items, ['M'])).toBe('G')
  })

  it('refuses a move into a list that does not take the type, into a full list, or into itself', () => {
    const items = page()
    // A group inside a group: the group's list has no group.
    expect(treeMove(root(items), ['L', 'G'], { end: true, in: ['L', 'G'] })).toBeNull()
    // The small heading is not the page's heading (another definition of the same type name).
    expect(treeMove(root(items), ['L', 'a'], { after: 'x' })).toBeNull()
    expect(treeMove(root(items), ['x'], { end: true, in: ['L'] })).toBeNull()
    // The group holds at most 3.
    const three = treeMove(root(items), ['L', 'a'], { end: true, in: ['L', 'G'] })!
    expect(treeMove(root(three.items), ['L', 'b'], { end: true, in: ['L', 'G'] })).toBeNull()
    expect(treeMove(root(items), ['L', 'a'], { end: true, in: ['L', 'zz'] })).toBeNull()
  })

  it('knows a locked block, and a type a list takes', () => {
    expect(isLockedBlock(defs, { id: 'q', type: 'gone' })).toBe(true)
    expect(isLockedBlock(defs, { id: 'q', type: 'hero', __upgradeFailed: true })).toBe(true)
    expect(isLockedBlock(defs, { id: 'q', type: 'hero' })).toBe(false)
    const small = listAt(root(), ['L'])!
    expect(listTakes(small, 'heading', small.defs.heading)).toBe(true)
    expect(listTakes(small, 'heading', defs.heading)).toBe(false)
    expect(blockKindSig(defs.hero)).toBe(blockKindSig(JSON.parse(JSON.stringify(defs.hero))))
    expect(placeOf(findBlock(root(), ['M'])!)).toEqual({ before: 'x' })
  })

  it('makes a new block valid at once: every field empty, a list empty', () => {
    const small = listAt(root(), ['L'])!.defs
    const g = blankBlock(small, 'group')
    expect(g).toMatchObject({ type: 'group', items: [], arrangement: null })
    expect(g.id).toMatch(/^[0-9a-z]{12}$/)
  })
})
