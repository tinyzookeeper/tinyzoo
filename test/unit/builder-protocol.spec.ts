import { describe, expect, it } from 'vitest'
import { cmsBuilderMove, cmsBuilderPlaceIndex, isCmsBuilderPlace, isCmsBuilderToAdmin, isCmsBuilderToPage } from '../../packages/cms/shared/builder'
import { dropPlace, droppedOrder, edgeSpeed, nearestBoundary, shiftFor, targetIndex } from '../../packages/cms/app/builder/geometry'

const texts = { drag: 'a', moveUp: 'b', moveDown: 'c', duplicate: 'd', remove: 'e', insertHere: 'f' }
const list = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
const ids = (l: { id: string }[] | null) => l?.map((b) => b.id).join('')

describe('builder messages to the page', () => {
  it('accepts the two messages of the admin', () => {
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: { hero: 'Hero' }, texts, selected: null })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts, selected: 'x' })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:select', id: 'x', scroll: true })).toBe(true)
    expect(isCmsBuilderToPage({ type: 'cms:builder:select', id: null, scroll: false })).toBe(true)
  })

  it('refuses anything else', () => {
    expect(isCmsBuilderToPage(null)).toBe(false)
    expect(isCmsBuilderToPage('cms:builder:on')).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:preview' })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: { hero: 1 }, texts, selected: null })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts: { drag: 'a' }, selected: null })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: {}, texts, selected: '' })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:on', labels: [], texts, selected: null })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:select', id: 'x' })).toBe(false)
    expect(isCmsBuilderToPage({ type: 'cms:builder:select', id: 4, scroll: true })).toBe(false)
    // The page's own messages are not for the page.
    expect(isCmsBuilderToPage({ type: 'cms:builder:remove', id: 'x' })).toBe(false)
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
