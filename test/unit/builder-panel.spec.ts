import { describe, expect, it } from 'vitest'
import { defineBlock, f } from '../../packages/cms/src/index'
import { blocksGraph } from '../../packages/cms/src/blocks'
import { changedBlock, issueCounts, keyOfPath, pathOfId, treeSet, typingGroup, type BlockList } from '../../packages/cms/shared/block-tree'
import { createBuilderHistory } from '../../packages/cms/shared/builder-history'
import { cmsBuilderFit, cmsBuilderNames, isCmsBuilderToAdmin, isCmsBuilderToPage } from '../../packages/cms/shared/builder'
import { cellShifts, innerArea, leastHidden, overlapArea, sameSizes, type Box } from '../../packages/cms/app/builder/geometry'

// The second half of 2c: the focus panel's path logic (where a block is in the form, which errors it
// does not show), the history of undo and redo, the arithmetic of the scaled preview, and the tools'
// own placement in the page (a nested toolbar, a grid that closes its gap, a group's inner area).

const heading = defineBlock({ label: 'Heading', fields: { text: f.text(), size: f.select({ options: ['large', 'small'] }).setting() } })
const picture = defineBlock({ label: 'Picture', fields: { image: f.media({ accept: 'image/*' }).optional() } })
const group = defineBlock({ label: 'Group', fields: { items: f.blocks({ heading, picture }, { max: 3 }), arrangement: f.select({ options: ['stack', 'row'] }).setting() } })
const layout = defineBlock({ label: 'Layout', fields: { items: f.blocks({ heading, picture, group }, { max: 4 }), cards: f.list({ fields: { title: f.text() } }) } })
const hero = defineBlock({ label: 'Hero', fields: { heading: f.text(), body: f.richtext() } })
const defs = blocksGraph({ hero, layout }) as any

const page = () => [
  { id: 'h', type: 'hero', heading: 'Hi', body: null },
  { id: 'L', type: 'layout', items: [
    { id: 'a', type: 'heading', text: 'A', size: null },
    { id: 'G', type: 'group', items: [{ id: 'g1', type: 'heading', text: 'G1', size: null }, { id: 'g2', type: 'picture', image: null }], arrangement: 'stack' },
  ], cards: [{ id: 'c1', type: 'item', title: 'One' }] },
]
const root = (items: any[] = page()): BlockList => ({ items, defs, max: null })

describe('the focus panel: where a block is in the form', () => {
  it('names a block by the form\'s key of it, as errors are kept', () => {
    expect(keyOfPath('sections', root(), ['h'])).toBe('sections.0')
    expect(keyOfPath('sections', root(), ['L', 'G'])).toBe('sections.1.items.1')
    expect(keyOfPath('sections', root(), ['L', 'G', 'g2'])).toBe('sections.1.items.1.items.1')
    expect(keyOfPath('sections', root(), ['L', 'nope'])).toBeNull()
    expect(keyOfPath('sections', root(), [])).toBe('sections')
  })

  it('finds a block by its id at any depth', () => {
    expect(pathOfId(root(), 'g2')).toEqual(['L', 'G', 'g2'])
    expect(pathOfId(root(), 'h')).toEqual(['h'])
    // An item of an f.list() is not a block of the page's tree.
    expect(pathOfId(root(), 'c1')).toBeNull()
  })

  it('sets one field of a block deep inside, leaving the rest as it was', () => {
    const before = page()
    const next = treeSet(root(before), ['L', 'G', 'g1'], 'text', 'New')!
    expect(next[1].items[1].items[0].text).toBe('New')
    expect(before[1]!.items![1]!.items![0]!.text).toBe('G1')
    expect(next[0]).toBe(before[0])
    expect(treeSet(root(), ['L', 'x'], 'text', 'y')).toBeNull()
    expect(treeSet(root(), ['h'], 'id', 'other')).toBeNull()
  })

  it('counts the errors it does not show where they lead from: the way back and each part of the breadcrumb', () => {
    const issues = ['title', 'sections.0.heading', 'sections.1.cards.0.title', 'sections.1.items.0.text', 'sections.1.items.1.arrangement', 'sections.1.items.1.items.0.text', 'sections.1.items.1.items.1.image']
    // The group selected: its own fields and its rows show theirs; the layout's other errors are on its crumb.
    expect(issueCounts('sections', root(), ['L', 'G'], issues)).toEqual({ outside: 2, along: [2] })
    // A small block in the group: the group's own setting and its other block are on the group's crumb.
    expect(issueCounts('sections', root(), ['L', 'G', 'g1'], issues)).toEqual({ outside: 2, along: [2, 2] })
    expect(issueCounts('sections', root(), ['h'], issues)).toEqual({ outside: 6, along: [] })
    expect(issueCounts('sections', root(), ['L'], [])).toEqual({ outside: 0, along: [] })
  })
})

describe('the history: what changed, and what is typing', () => {
  it('finds the block a change made a difference to', () => {
    const a = page()
    const added = page()
    added[1]!.items!.push({ id: 'n', type: 'picture', image: null } as any)
    expect(changedBlock(defs, a, added)).toEqual({ id: 'n', around: ['L'] })
    expect(changedBlock(defs, added, a)).toEqual({ id: 'n', around: ['L'] })
    const three = [{ id: 'p', type: 'hero' }, { id: 'q', type: 'hero' }, { id: 'r', type: 'hero' }]
    expect(changedBlock(defs, three, [three[1], three[2], three[0]])).toEqual({ id: 'p', around: [] })
    expect(changedBlock(defs, three, [three[2], three[0], three[1]])).toEqual({ id: 'r', around: [] })
    const typed = page()
    typed[1]!.items![1]!.items![0]!.text = 'G1!'
    expect(changedBlock(defs, a, typed)).toEqual({ id: 'g1', around: ['L', 'G'] })
    const across = page()
    const [g2] = across[1]!.items![1]!.items!.splice(1, 1)
    across[1]!.items!.push(g2 as any)
    expect(changedBlock(defs, a, across)!.id).toBe('g2')
    expect(changedBlock(defs, a, page())).toBeNull()
  })

  it('groups typing in one text field, never a setting, a choice or a change of the blocks', () => {
    const a = page()
    const typed = page()
    typed[1]!.items![1]!.items![0]!.text = 'G1!'
    expect(typingGroup(defs, a, typed)).toBe('g1:text')
    const setting = page()
    setting[1]!.items![1]!.arrangement = 'row'
    expect(typingGroup(defs, a, setting)).toBeNull()
    const rich = page()
    rich[0]!.body = { type: 'doc', content: [] } as any
    expect(typingGroup(defs, a, rich)).toBe('h:body')
    const card = page()
    card[1]!.cards![0]!.title = 'Two'
    expect(typingGroup(defs, a, card)).toBe('L:cards')
    const more = page()
    more[1]!.cards!.push({ id: 'c2', type: 'item', title: '' } as any)
    expect(typingGroup(defs, a, more)).toBeNull()
    const two = page()
    two[0]!.heading = 'X'
    two[1]!.items![0]!.text = 'Y'
    expect(typingGroup(defs, a, two)).toBeNull()
    const added = page()
    added.push({ id: 'z', type: 'hero', heading: '', body: null })
    expect(typingGroup(defs, a, added)).toBeNull()
  })
})

describe('the history of undo and redo', () => {
  it('takes steps back and forth, and a new change ends what could be redone', () => {
    const h = createBuilderHistory<number>()
    expect(h.canUndo).toBe(false)
    h.record(0, 1, { now: 0 })
    h.record(1, 2, { now: 10 })
    expect(h.size).toBe(2)
    expect(h.undo()!.before).toBe(1)
    expect(h.canRedo).toBe(true)
    expect(h.undo()!.before).toBe(0)
    expect(h.undo()).toBeNull()
    expect(h.redo()!.after).toBe(1)
    h.record(1, 5, { now: 20 })
    expect(h.canRedo).toBe(false)
    expect(h.redo()).toBeNull()
    expect(h.undo()!.after).toBe(5)
  })

  it('makes typing in one field within a pause one step; a pause, another field or an undo starts a new one', () => {
    const h = createBuilderHistory<string>({ pause: 1000 })
    h.record('', 'a', { group: 'x:text', now: 0 })
    h.record('a', 'ab', { group: 'x:text', now: 400 })
    h.record('ab', 'abc', { group: 'x:text', now: 1300 })
    expect(h.size).toBe(1)
    h.record('abc', 'abcd', { group: 'x:text', now: 2400 })
    expect(h.size).toBe(2)
    h.record('abcd', 'abcde', { group: 'y:text', now: 2500 })
    expect(h.size).toBe(3)
    h.record('abcde', 'abcdef', { now: 2600 })
    h.record('abcdef', 'abcdefg', { now: 2650 })
    expect(h.size).toBe(5)
    const back = h.undo()!
    expect(back.before).toBe('abcdef')
    h.record('abcdef', 'abcdefX', { group: 'y:text', now: 2700 })
    expect(h.size).toBe(5)
    h.seal()
    h.record('abcdefX', 'abcdefXY', { group: 'y:text', now: 2710 })
    expect(h.size).toBe(6)
    const first = createBuilderHistory<string>()
    first.record('', 'a', { group: 'x', now: 0 })
    first.record('a', 'ab', { group: 'x', now: 100 })
    expect(first.undo()).toMatchObject({ before: '', after: 'ab' })
  })

  it('keeps at most 50 steps, the newest', () => {
    const h = createBuilderHistory<number>()
    for (let i = 0; i < 60; i++) h.record(i, i + 1, { now: i })
    expect(h.size).toBe(50)
    let last = null
    for (let s = h.undo(); s; s = h.undo()) last = s
    expect(last!.before).toBe(10)
  })

  it('names the step an undo takes back now, and forgets every step when cleared', () => {
    const h = createBuilderHistory<number>()
    const one = h.record(0, 1)
    expect(h.top()).toBe(one)
    const two = h.record(1, 2)
    expect(h.top()).toBe(two)
    h.undo()
    expect(h.top()).toBe(one)
    h.clear()
    expect(h.top()).toBeNull()
    expect(h.canUndo || h.canRedo).toBe(false)
  })
})

describe('the scaled preview', () => {
  it('lays a desktop page out at 1280 px (or wider) and scales it to the stage', () => {
    expect(cmsBuilderFit('desktop', 960, 720)).toEqual({ width: 1280, height: 960, scale: 0.75 })
    expect(cmsBuilderFit('desktop', 1500, 800)).toEqual({ width: 1500, height: 800, scale: 1 })
    const odd = cmsBuilderFit('desktop', 777, 600)
    expect(odd.scale).toBeLessThanOrEqual(777 / 1280)
    expect(odd.width * odd.scale).toBeLessThanOrEqual(777)
    expect(Math.abs(odd.height * odd.scale - 600)).toBeLessThan(1)
  })

  it('draws a phone at 390 px, at full size unless it does not fit', () => {
    expect(cmsBuilderFit('phone', 900, 700)).toEqual({ width: 390, height: 700, scale: 1 })
    expect(cmsBuilderFit('phone', 300, 600)).toMatchObject({ width: 390, scale: 0.769 })
    expect(cmsBuilderFit('desktop', 0, 0).scale).toBeGreaterThan(0)
  })

  it('tells the page its scale, and the page passes undo and redo on', () => {
    expect(isCmsBuilderToPage({ type: 'cms:builder:view', scale: 0.72 })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:view', scale: 0 })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:view', scale: Number.NaN })).toBe(false)
    const on = { type: 'cms:builder:on', labels: {}, texts: { drag: 'a', moveUp: 'b', moveDown: 'c', duplicate: 'd', remove: 'e', insertHere: 'f', blank: 'g' }, selected: null }
    expect(isCmsBuilderToPage({ ...on, scale: 0.5 })).toBe(true)
    expect(isCmsBuilderToPage({ ...on, scale: '0.5' })).toBe(false)
    expect(isCmsBuilderToPage({ ...on, texts: { ...on.texts, blank: 3 } })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:history', action: 'undo' })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:history', action: 'redo' })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:history', action: 'clear' })).toBe(false)
  })

  it('gives the page every block type\'s name in the admin\'s language, all the way down', () => {
    const lists = { max: null, types: { layout: { label: 'Rozvržení', sig: 's', list: { max: 12, types: { heading: { label: 'Nadpis', sig: 'h' }, group: { label: 'Skupina', sig: 'g', list: { max: 8, types: { heading: { label: 'Nadpis (ve skupině)', sig: 'h' } } } } } } } } }
    expect(cmsBuilderNames({ hero: 'Úvod' }, lists)).toEqual({ hero: 'Úvod', layout: 'Rozvržení', heading: 'Nadpis', group: 'Skupina' })
    expect(cmsBuilderNames({ hero: 'Úvod' }, null)).toEqual({ hero: 'Úvod' })
  })
})

describe('the tools in the page', () => {
  const box = (left: number, top: number, w: number, h: number): Box => ({ left, top, right: left + w, bottom: top + h })

  it('puts a nested toolbar where it hides the least, on the screen', () => {
    const screen = box(0, 0, 1000, 800)
    const above = box(100, 70, 200, 30)
    const inside = box(106, 106, 200, 30)
    const below = box(100, 306, 200, 30)
    // The block above has text right where the toolbar would stand above: inside the top edge is better.
    expect(leastHidden([above, inside, below], [{ box: box(100, 60, 400, 40), weight: 1 }, { box: box(100, 200, 400, 30), weight: 4 }], screen)).toBe(1)
    // The selected block's own text at its top: below, where nothing is, wins; with text below as well, above (the first of equals).
    expect(leastHidden([above, inside, below], [{ box: box(100, 60, 400, 40), weight: 1 }, { box: box(100, 100, 400, 40), weight: 4 }], screen)).toBe(2)
    expect(leastHidden([above, inside, below], [{ box: box(100, 60, 400, 40), weight: 1 }, { box: box(100, 100, 400, 40), weight: 4 }, { box: box(100, 300, 400, 40), weight: 1 }], screen)).toBe(0)
    // Nothing covered anywhere: the first place, above.
    expect(leastHidden([above, inside, below], [], screen)).toBe(0)
    // Above is off the screen: the next place.
    expect(leastHidden([box(100, -20, 200, 30), inside, below], [], screen)).toBe(1)
    expect(overlapArea(box(0, 0, 10, 10), box(5, 5, 10, 10))).toBe(25)
    expect(overlapArea(box(0, 0, 10, 10), box(10, 0, 10, 10))).toBe(0)
  })

  it('closes the gap in a grid of cells of one size and opens one at the target', () => {
    const cells = [box(0, 0, 100, 100), box(120, 0, 100, 100), box(240, 0, 100, 100), box(0, 120, 100, 100)]
    expect(sameSizes(cells)).toBe(true)
    expect(sameSizes([...cells, box(0, 240, 160, 100)])).toBe(false)
    // The first one held at the end: the others each move one cell back, the last up to the first line.
    expect(cellShifts(cells, 0, 3)).toEqual([[0, 0], [-120, 0], [-120, 0], [240, -120]])
    // The last one held first: the others each move one cell on, wrapping to the next line.
    expect(cellShifts(cells, 3, 0)).toEqual([[120, 0], [120, 0], [-240, 120], [0, 0]])
    expect(cellShifts(cells, 1, 1)).toEqual([[0, 0], [0, 0], [0, 0], [0, 0]])
  })

  it('enters a group at once only in its inner area', () => {
    expect(innerArea(box(0, 0, 400, 200))).toEqual({ left: 120, top: 60, right: 280, bottom: 140 })
    // A small group: still a middle to aim at.
    const small = innerArea(box(0, 0, 60, 40))
    expect(small.right).toBeGreaterThan(small.left)
    expect(small.bottom).toBeGreaterThan(small.top)
  })
})
