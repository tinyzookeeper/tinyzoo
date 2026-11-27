import { describe, expect, it } from 'vitest'
import { cmsBuilderMove, cmsBuilderPathOf, cmsBuilderPlaceIndex, isCmsBuilderPlace, isCmsBuilderToAdmin, isCmsBuilderToPage } from '../../packages/cms/shared/builder'
import {
  addSlots, axisOf, dropPlace, droppedOrder, edgeSpeed, linesOf, nearestBoundary, nearestSlot, oneLine, placeInList, selectDepth, shiftFor, slotsOf, targetAmongOthers, targetIndex,
  type Box,
} from '../../packages/cms/app/builder/geometry'

const texts = { drag: 'a', moveUp: 'b', moveDown: 'c', duplicate: 'd', remove: 'e', insertHere: 'f' }
const list = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
const ids = (l: { id: string }[] | null) => l?.map((b) => b.id).join('')

describe('builder messages to the page', () => {
  it('accepts the two messages of the admin', () => {
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: { hero: 'Hero' }, texts, selected: null })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts, selected: 'x' })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts: { ...texts, chooseField: 'a', fieldMissing: 'b {name}', fieldUnfit: 'c', emptyCard: 'd', sampleCard: 'e' }, selected: null })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:select', id: 'x', scroll: true })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:select', id: null, scroll: false })).toBe(true)
  })

  it('refuses anything else', () => {
    expect(isCmsBuilderToPage(null)).toBe(false)
    expect(isCmsBuilderToPage('cms:builder:on')).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:preview' })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: { hero: 1 }, texts, selected: null })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts: { drag: 'a' }, selected: null })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts: { ...texts, emptyCard: 1 }, selected: null })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts, selected: '' })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: [], texts, selected: null })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:select', id: 'x' })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:select', id: 4, scroll: true })).toBe(false)
    // The page's own messages are not for the page.
    expect(isCmsBuilderToPage({ type: 'cms:builder:remove', id: 'x' })).toBe(false)
  })
})

describe('builder messages of a card (3c)', () => {
  const block = { label: 'Text', shows: '← Cena', chip: '← Cena', field: 'price', kind: 'number', own: 'text', ref: 'field' }
  const cards = { s1: { entity: 'custom_course', label: 'Kurzy', blocks: { b1: block, g: { label: 'Group', shows: '2 bloky', chip: '', group: true }, w: { label: 'Text', shows: 'Nenapojeno', chip: 'Nenapojeno', warn: true } } } }
  it('accepts the cards and a try', () => {
    expect(isCmsBuilderToPage({ type: 'cms:builder:cards', cards })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:cards', cards: {} })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:try', try: null })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:try', try: { path: ['s1', 'b1'], key: 'field', value: 'price' } })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:try', try: { path: ['s1'], key: 'field', value: '', chosen: true } })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:cards', cards: { s1: { ...cards.s1, blocks: { b: { ...block, field: 'slug' } } } } })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts: { ...texts, editEntry: 'Edit' }, selected: null })).toBe(true)
  })
  it('refuses malformed ones', () => {
    const cardsOf = (c: unknown) => ({ type: 'cms:builder:cards', cards: c })
    expect(isCmsBuilderToPage({ type: 'cms:builder:cards' })).toBe(false)
    expect(isCmsBuilderToPage(cardsOf([]))).toBe(false)
    expect(isCmsBuilderToPage(cardsOf({ s1: { ...cards.s1, entity: 'not a name' } }))).toBe(false)
    expect(isCmsBuilderToPage(cardsOf({ s1: { ...cards.s1, label: 'x'.repeat(201) } }))).toBe(false)
    expect(isCmsBuilderToPage(cardsOf({ s1: { ...cards.s1, blocks: { b: { ...block, shows: 1 } } } }))).toBe(false)
    expect(isCmsBuilderToPage(cardsOf({ s1: { ...cards.s1, blocks: { b: { label: 'a', shows: 'b' } } } }))).toBe(false)
    expect(isCmsBuilderToPage(cardsOf({ s1: { ...cards.s1, blocks: { b: { ...block, ref: 'a b' } } } }))).toBe(false)
    expect(isCmsBuilderToPage(cardsOf({ s1: { ...cards.s1, blocks: { b: { ...block, warn: 'yes' } } } }))).toBe(false)
    expect(isCmsBuilderToPage(cardsOf({ '': cards.s1 }))).toBe(false)
    expect(isCmsBuilderToPage(cardsOf(Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`s${i}`, cards.s1]))))).toBe(false)
    expect(isCmsBuilderToPage(cardsOf({ s1: { ...cards.s1, blocks: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`b${i}`, block])) } }))).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:try' })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:try', try: { path: [], key: 'field', value: 'x' } })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:try', try: { path: ['s'], key: 'a b', value: 'x' } })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:try', try: { path: ['s'], key: 'field', value: 3 } })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:try', try: { path: ['s'], key: 'field', value: 'x'.repeat(201) } })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:try', try: { path: ['s'], key: 'field', value: 'x', chosen: 'y' } })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts: { ...texts, editEntry: 1 }, selected: null })).toBe(false)
  })
  it('takes the card a click was in, on a selection', () => {
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: 'b', path: ['s', 'b'], card: { entity: 'custom_course', id: 'e1' } })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: 'b', card: { entity: 'custom_course', id: 'e1' } })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: 'b', card: { entity: 'no name', id: 'e1' } })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: 'b', card: { entity: 'custom_course', id: '' } })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: 'b', card: 'x' })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: null, card: { entity: 'a', id: 'b' } })).toBe(true)
  })
})

describe('builder messages to the admin', () => {
  it('accepts each message of the page', () => {
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:ready' })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: null })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: 'x' })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:move', id: 'x', place: { before: 'y' } })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:move', id: 'x', place: { after: 'y' } })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:duplicate', id: 'x' })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:remove', id: 'x' })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:add', place: { after: 'x' } })).toBe(true)
  })

  it('refuses wrong shapes', () => {
    expect(isCmsBuilderToAdmin(undefined)).toBe(false)
    expect(isCmsBuilderToAdmin([])).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:other' })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select' })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:move', id: 'x' })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:move', id: 'x', place: { before: 'y', after: 'z' } })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:move', id: '', place: { before: 'y' } })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:remove', id: 3 })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:add', place: { at: 'x' } })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: 'x'.repeat(201) })).toBe(false)
  })

  it('knows a place', () => {
    expect(isCmsBuilderPlace({ before: 'x' })).toBe(true)
    expect(isCmsBuilderPlace({ after: 'x' })).toBe(true)
    expect(isCmsBuilderPlace({})).toBe(false)
    expect(isCmsBuilderPlace({ before: 1 })).toBe(false)
    expect(isCmsBuilderPlace(null)).toBe(false)
  })
})

describe('builder places', () => {
  it('turns a place into an index', () => {
    expect(cmsBuilderPlaceIndex(['a', 'b', 'c'], { before: 'a' })).toBe(0)
    expect(cmsBuilderPlaceIndex(['a', 'b', 'c'], { before: 'c' })).toBe(2)
    expect(cmsBuilderPlaceIndex(['a', 'b', 'c'], { after: 'a' })).toBe(1)
    expect(cmsBuilderPlaceIndex(['a', 'b', 'c'], { after: 'c' })).toBe(3)
    expect(cmsBuilderPlaceIndex(['a', 'b', 'c'], { after: 'z' })).toBeNull()
    expect(cmsBuilderPlaceIndex([], { before: 'a' })).toBeNull()
  })

  it('moves a block up, down, to the start and to the end', () => {
    expect(ids(cmsBuilderMove(list, 'c', { before: 'b' }))).toBe('acbd')
    expect(ids(cmsBuilderMove(list, 'b', { after: 'c' }))).toBe('acbd')
    expect(ids(cmsBuilderMove(list, 'd', { before: 'a' }))).toBe('dabc')
    expect(ids(cmsBuilderMove(list, 'a', { after: 'd' }))).toBe('bcda')
    expect(ids(cmsBuilderMove(list, 'a', { after: 'b' }))).toBe('bacd')
    // The original list is left alone.
    expect(ids(list)).toBe('abcd')
  })

  it('changes nothing for a move that changes nothing', () => {
    expect(cmsBuilderMove(list, 'b', { before: 'b' })).toBeNull()
    expect(cmsBuilderMove(list, 'b', { after: 'b' })).toBeNull()
    expect(cmsBuilderMove(list, 'b', { after: 'a' })).toBeNull()
    expect(cmsBuilderMove(list, 'b', { before: 'c' })).toBeNull()
    expect(cmsBuilderMove(list, 'a', { before: 'b' })).toBeNull()
    expect(cmsBuilderMove(list, 'd', { after: 'c' })).toBeNull()
  })

  it('refuses unknown ids', () => {
    expect(cmsBuilderMove(list, 'z', { before: 'a' })).toBeNull()
    expect(cmsBuilderMove(list, 'a', { before: 'z' })).toBeNull()
    expect(cmsBuilderMove([], 'a', { after: 'b' })).toBeNull()
  })
})

describe('overlay geometry', () => {
  it('finds the target index from the pointer and the midpoints of the others', () => {
    const mids = [100, 300, 500]
    expect(targetIndex(-20, mids)).toBe(0)
    expect(targetIndex(100, mids)).toBe(0)
    expect(targetIndex(101, mids)).toBe(1)
    expect(targetIndex(400, mids)).toBe(2)
    expect(targetIndex(900, mids)).toBe(3)
    expect(targetIndex(50, [])).toBe(0)
  })

  it('names the place a drop lands in, and none for where the block is', () => {
    const all = ['a', 'b', 'c', 'd']
    expect(dropPlace(all, 1, 1)).toBeNull()
    expect(dropPlace(all, 1, 0)).toEqual({ before: 'a' })
    expect(dropPlace(all, 1, 2)).toEqual({ before: 'd' })
    expect(dropPlace(all, 1, 3)).toEqual({ after: 'd' })
    expect(dropPlace(all, 3, 0)).toEqual({ before: 'a' })
    expect(dropPlace(['a'], 0, 0)).toBeNull()
  })

  it('agrees with the move the admin makes', () => {
    const all = list.map((b) => b.id)
    for (let from = 0; from < all.length; from++) {
      for (let target = 0; target < all.length; target++) {
        const where = dropPlace(all, from, target)
        const moved = where ? cmsBuilderMove(list, all[from]!, where)?.map((b) => b.id) : null
        expect(moved ?? all).toEqual(droppedOrder(all, from, target))
      }
    }
  })

  it('shifts only the blocks the dragged one passes', () => {
    const shifts = (from: number, target: number) => [0, 1, 2, 3].map((i) => shiftFor(i, from, target, 10))
    expect(shifts(1, 1)).toEqual([0, 0, 0, 0])
    expect(shifts(0, 2)).toEqual([0, -10, -10, 0])
    expect(shifts(3, 1)).toEqual([0, 10, 10, 0])
    expect(shifts(1, 0)).toEqual([10, 0, 0, 0])
    expect(shifts(1, 3)).toEqual([0, 0, -10, -10])
  })

  it('shows the plus only near a boundary', () => {
    expect(nearestBoundary(100, [100, 300])).toBe(0)
    expect(nearestBoundary(120, [100, 300])).toBe(0)
    expect(nearestBoundary(280, [100, 300])).toBe(1)
    expect(nearestBoundary(200, [100, 300])).toBeNull()
    expect(nearestBoundary(125, [100, 300])).toBeNull()
    expect(nearestBoundary(205, [100, 210])).toBe(1)
    expect(nearestBoundary(10, [])).toBeNull()
  })

  it('scrolls faster the closer the pointer is to an edge', () => {
    expect(edgeSpeed(300, 800)).toBe(0)
    expect(edgeSpeed(30, 800)).toBeLessThan(0)
    expect(edgeSpeed(10, 800)).toBeLessThan(edgeSpeed(30, 800))
    expect(edgeSpeed(-50, 800)).toBe(-22)
    expect(edgeSpeed(770, 800)).toBeGreaterThan(0)
    expect(edgeSpeed(790, 800)).toBeGreaterThan(edgeSpeed(770, 800))
    expect(edgeSpeed(900, 800)).toBe(22)
  })
})

describe('builder messages with paths (2c)', () => {
  const lists = { types: { section_layout: { label: 'Layout', sig: 's1', list: { types: { heading: { label: 'Heading', sig: 'h1' } }, max: 12 } } }, max: null }

  it('accepts the additions to the messages to the page, and the messages of part 1 as they were', () => {
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts, selected: 'b', selectedPath: ['a', 'b'], lists })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts: { ...texts, moveLeft: 'l', moveRight: 'r', addBlock: 'Add' }, selected: null, selectedPath: null })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:select', id: 'b', path: ['a', 'b'], scroll: true })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:key', key: 'Escape' })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:key', key: 'ArrowLeft' })).toBe(true)
  })

  it('refuses wrong additions', () => {
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts: { ...texts, moveLeft: 3 }, selected: null })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts, selected: null, selectedPath: [] })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts, selected: null, lists: { types: { a: { label: 'A' } }, max: null } })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts, selected: null, lists: { types: {}, max: 0 } })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:select', id: 'b', path: 'a/b', scroll: true })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:key', key: 'Enter' })).toBe(false)
    // Kinds nested deeper than any list can be are refused.
    let deep: any = { types: {}, max: null }
    for (let i = 0; i < 5; i++) deep = { types: { x: { label: 'x', sig: 'x', list: deep } }, max: null }
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts, selected: null, lists: deep })).toBe(false)
  })

  it('accepts a block named by its path, and a place in the list of a block', () => {
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: 'c', path: ['a', 'b', 'c'] })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:move', id: 'c', path: ['a', 'c'], place: { before: 'd', in: ['a'] } })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:move', id: 'c', path: ['a', 'c'], place: { end: true, in: ['g'] } })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:duplicate', id: 'c', path: ['a', 'c'] })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:remove', id: 'c', path: ['a', 'c'] })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:add', place: { after: 'c', in: ['a', 'g'] } })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:add', place: { end: true, in: [] } })).toBe(true)
  })

  it('refuses a path that does not end in the id, and a wrong place', () => {
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: 'c', path: ['a', 'b'] })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:select', id: null, path: ['a'] })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:remove', id: 'c', path: [] })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:remove', id: 'c', path: ['', 'c'] })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:remove', id: 'i', path: 'abcdefghi'.split('') })).toBe(false)
    expect(isCmsBuilderPlace({ end: true })).toBe(false)
    expect(isCmsBuilderPlace({ end: false, in: [] })).toBe(false)
    expect(isCmsBuilderPlace({ before: 'x', in: 'a' })).toBe(false)
    expect(isCmsBuilderPlace({ before: 'x', after: 'y', in: [] })).toBe(false)
    expect(isCmsBuilderPlace({ in: ['a'] })).toBe(false)
  })

  it('reads a message\'s block as a path, and a place at the end of a list', () => {
    expect(cmsBuilderPathOf({ id: 'x' })).toEqual(['x'])
    expect(cmsBuilderPathOf({ id: 'c', path: ['a', 'c'] })).toEqual(['a', 'c'])
    expect(cmsBuilderPathOf({ id: 'c', path: ['a', 'b'] })).toEqual(['c'])
    expect(cmsBuilderPlaceIndex(['a', 'b'], { end: true, in: ['g'] })).toBe(2)
    expect(cmsBuilderPlaceIndex(['a', 'b'], { before: 'b', in: ['g'] })).toBe(1)
  })
})

/** Boxes of `w` × `h` in lines of `perLine`, `gap` apart, from (0, 0). */
function grid(count: number, perLine: number, w = 100, h = 50, gap = 20): Box[] {
  return Array.from({ length: count }, (_, i) => {
    const left = (i % perLine) * (w + gap)
    const top = Math.floor(i / perLine) * (h + gap)
    return { left, top, right: left + w, bottom: top + h }
  })
}

describe('the drop line and the "+" along a list\'s direction', () => {
  it('reads a stack as one column: a horizontal line in the middle of each gap, above the first and below the last', () => {
    const stack = grid(3, 1)
    expect(axisOf(stack)).toBe('y')
    expect(oneLine(stack, 'y')).toBe(true)
    const slots = slotsOf(stack)
    expect(slots.map((s) => s.index)).toEqual([0, 1, 2, 3])
    expect(slots.map((s) => s.y1)).toEqual([-10, 60, 130, 200])
    expect(slots.every((s) => s.y1 === s.y2 && s.x1 === 0 && s.x2 === 100)).toBe(true)
    expect(nearestSlot(slots, 50, 66)!.index).toBe(1)
    expect(nearestSlot(slots, 50, 140)!.index).toBe(2)
    expect(nearestSlot(slots, 50, 500)!.index).toBe(3)
  })

  it('reads a row as one line: a vertical line in the middle of each gap, as tall as the row', () => {
    // A row of a tall picture and two shorter blocks, aligned at the top.
    const row: Box[] = [{ left: 0, top: 0, right: 200, bottom: 150 }, { left: 220, top: 0, right: 320, bottom: 40 }, { left: 340, top: 0, right: 440, bottom: 60 }]
    expect(axisOf(row)).toBe('x')
    expect(linesOf(row)).toEqual([[0, 1, 2]])
    expect(oneLine(row, 'x')).toBe(true)
    const slots = slotsOf(row)
    expect(slots.map((s) => [s.index, s.x1])).toEqual([[0, -10], [1, 210], [2, 330], [3, 450]])
    expect(slots.every((s) => s.x1 === s.x2 && s.y1 === 0 && s.y2 === 150)).toBe(true)
    expect(nearestSlot(slots, 300, 100)!.index).toBe(2)
    expect(nearestSlot(slots, 215, 140)!.index).toBe(1)
  })

  it('reads a wrapping row line by line: the place between two lines is at the end of one and the start of the next', () => {
    const wrapped: Box[] = [{ left: 0, top: 0, right: 300, bottom: 50 }, { left: 320, top: 0, right: 500, bottom: 80 }, { left: 0, top: 100, right: 250, bottom: 150 }]
    expect(linesOf(wrapped)).toEqual([[0, 1], [2]])
    expect(axisOf(wrapped)).toBe('x')
    expect(oneLine(wrapped, 'x')).toBe(false)
    const slots = slotsOf(wrapped)
    expect(slots.map((s) => s.index)).toEqual([0, 1, 2, 2, 3])
    // Near the end of the first line, or near the start of the second: both are place 2.
    expect(nearestSlot(slots, 505, 40)!.index).toBe(2)
    expect(nearestSlot(slots, 2, 120)!.index).toBe(2)
    expect(nearestSlot(slots, 240, 130)!.index).toBe(3)
    // One "+" per place; between the lines, the one before the block that starts the line.
    const adds = addSlots(slots, 3)
    expect(adds.map((s) => s.index)).toEqual([0, 1, 2, 3])
    expect(adds[2]!.y1).toBe(100)
  })

  it('reads a grid line by line, and the place nearest the pointer is the nearest gap', () => {
    const cells = grid(5, 3)
    expect(linesOf(cells)).toEqual([[0, 1, 2], [3, 4]])
    const slots = slotsOf(cells)
    // Between the second and third cell of the first line.
    expect(nearestSlot(slots, 225, 25)!.index).toBe(2)
    // In the second line, right of the last cell.
    expect(nearestSlot(slots, 300, 90)!.index).toBe(5)
    // At the start of the second line.
    expect(nearestSlot(slots, -5, 100)!.index).toBe(3)
    expect(addSlots(slots, 5).map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('has nothing to say about a list of one block or none', () => {
    expect(axisOf(grid(1, 1))).toBeNull()
    expect(slotsOf([])).toEqual([])
    expect(slotsOf(grid(1, 1), 'x').map((s) => s.index)).toEqual([0, 1])
    expect(nearestSlot([], 0, 0)).toBeNull()
  })

  it('turns a slot into a place in the block\'s own list or in another one', () => {
    expect(targetAmongOthers(3, 1)).toBe(2)
    expect(targetAmongOthers(1, 1)).toBe(1)
    expect(targetAmongOthers(0, 2)).toBe(0)
    expect(placeInList(['a', 'b'], 0, ['L', 'G'])).toEqual({ before: 'a', in: ['L', 'G'] })
    expect(placeInList(['a', 'b'], 2, ['L'])).toEqual({ after: 'b', in: ['L'] })
    expect(placeInList([], 0, ['M'])).toEqual({ end: true, in: ['M'] })
  })
})

describe('each click one level deeper', () => {
  it('selects the section first, then the block under the pointer, then the block in a group', () => {
    expect(selectDepth(['L', 'G', 'h'], null)).toBe(0)
    expect(selectDepth(['L', 'G', 'h'], ['L'])).toBe(1)
    expect(selectDepth(['L', 'G', 'h'], ['L', 'G'])).toBe(2)
    expect(selectDepth(['L', 'G', 'h'], ['L', 'G', 'h'])).toBe(2)
  })

  it('selects a sibling at the same level, and goes up on a click outside the selected block', () => {
    expect(selectDepth(['L', 'G', 'k'], ['L', 'G', 'h'])).toBe(2)
    expect(selectDepth(['L', 'b'], ['L', 'G', 'h'])).toBe(1)
    expect(selectDepth(['L'], ['L', 'G'])).toBe(0)
    expect(selectDepth(['M', 'x'], ['L', 'G'])).toBe(0)
    expect(selectDepth([], ['L'])).toBe(-1)
  })
})
