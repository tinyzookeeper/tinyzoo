import { describe, expect, it } from 'vitest'
import { cardPlaces, leastHidden, nextPress, pressCount, scrollTargetFor, scrollToShow, visibleBottom, weighCovers, type Box } from '../../packages/cms/app/builder/geometry'

// Since 3e: the phone-sized admin's sheet over the bottom of the preview, taps, and a card block's toolbar.

describe('the bottom of what is seen', () => {
  it('is the frame\'s bottom when nothing covers it', () => {
    expect(visibleBottom(800, 0, 60)).toBe(800)
  })
  it('stops at the sheet\'s top edge', () => {
    expect(visibleBottom(800, 320, 0)).toBe(480)
  })
  it('never goes up under the sticky header, however tall the sheet is', () => {
    expect(visibleBottom(800, 790, 60)).toBe(108)
    expect(visibleBottom(800, 5000, 0)).toBe(48)
  })
  it('is never below the frame', () => {
    expect(visibleBottom(800, -10, 0)).toBe(800)
  })
})

describe('scrolling a block into the room above the sheet', () => {
  it('does nothing for a block in sight between the margins', () => {
    expect(scrollToShow({ top: 100, bottom: 300 }, 500, 60, 480)).toBeNull()
  })
  it('scrolls a block under the sheet into the middle of the room', () => {
    expect(scrollToShow({ top: 440, bottom: 540 }, 500, 60, 480)).toBe(440 + 500 - 60 - 160)
  })
  it('scrolls a block above the header back down', () => {
    expect(scrollToShow({ top: -200, bottom: -100 }, 600, 60, 480)).toBe(Math.max(0, -200 + 600 - 60 - 160))
  })
  it('gives a block taller than the room its top 24 px under the header', () => {
    expect(scrollToShow({ top: 300, bottom: 1300 }, 100, 60, 480)).toBe(300 + 100 - 60 - 24)
  })
  it('does nothing when a tall block already has its top there', () => {
    expect(scrollToShow({ top: 84, bottom: 1084 }, 100, 60, 480)).toBeNull()
  })
  it('counts a block touching a margin as not in sight', () => {
    expect(scrollToShow({ top: 70, bottom: 200 }, 500, 60, 480)).not.toBeNull()
    expect(scrollToShow({ top: 300, bottom: 470 }, 500, 60, 480)).not.toBeNull()
  })
  it('never scrolls above the top of the page', () => {
    expect(scrollTargetFor({ top: -50, bottom: 10 }, 20, 0, 400)).toBe(0)
  })
})

describe('presses in a row', () => {
  const at = (t: number, x = 100, y = 100, inside = false) => ({ at: t, x, y, inside })
  it('counts a second press within 400 ms and 24 px', () => {
    const first = nextPress(null, at(0))
    expect(first.count).toBe(1)
    expect(nextPress(first, at(300, 110, 112)).count).toBe(2)
  })
  it('starts over when it is late or far', () => {
    const first = nextPress(null, at(0))
    expect(nextPress(first, at(500)).count).toBe(1)
    expect(nextPress(first, at(200, 140, 100)).count).toBe(1)
  })
  it('counts by time alone when asked', () => {
    const first = nextPress(null, at(0))
    expect(nextPress(first, at(300, 500, 500), { ms: 500, px: Infinity }).count).toBe(2)
  })
  it('keeps where the row began', () => {
    const page = nextPress(null, at(0, 100, 100, false), { px: Infinity })
    const second = nextPress(page, at(200, 100, 140, true), { px: Infinity })
    expect(second.count).toBe(2)
    expect(second.inside).toBe(false)
    const tool = nextPress(null, at(0, 10, 10, true), { px: Infinity })
    expect(nextPress(tool, at(150, 10, 10, true), { px: Infinity }).inside).toBe(true)
  })
  it('lets a touch\'s mouse event with detail 1 be a double click, and leaves the mouse as it is', () => {
    const touch = { at: 1000, x: 0, y: 0, count: 2, inside: false }
    expect(pressCount(1, touch, 1010)).toBe(2)
    expect(pressCount(0, touch, 1010)).toBe(2)
    expect(pressCount(2, touch, 1010)).toBe(2)
    expect(pressCount(1, null, 1010)).toBe(1)
    expect(pressCount(1, touch, 5000)).toBe(1)
    expect(pressCount(1, { ...touch, count: 1 }, 1010)).toBe(1)
  })
})

describe('a card block\'s toolbar', () => {
  const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom })
  it('weighs the card\'s other text 3, the block\'s own 4 and the page\'s other text 1', () => {
    const covers = weighCovers([box(10, 200, 100, 220)], [box(10, 150, 100, 170), box(10, 500, 100, 520)], box(0, 0, 300, 400))
    expect(covers.map((c) => c.weight)).toEqual([4, 3, 1])
  })
  it('weighs all other text 1 outside a card', () => {
    expect(weighCovers([], [box(0, 0, 10, 10)], null)[0]!.weight).toBe(1)
  })
  it('gives places inside the card\'s top (left, right) and below it', () => {
    expect(cardPlaces(box(100, 100, 400, 500), 160, 30, 6, (x) => x)).toEqual([{ left: 106, top: 106 }, { left: 234, top: 106 }, { left: 100, top: 506 }])
  })
  it('gives only the place below a card too short for the inside', () => {
    expect(cardPlaces(box(0, 0, 300, 60), 160, 30, 6, (x) => x)).toEqual([{ left: 0, top: 66 }])
  })
  it('goes over the picture, not the price row or the description, in a card with a picture', () => {
    const card = box(0, 0, 300, 400)
    const own = [box(10, 230, 200, 250)]
    const other = [box(10, 190, 120, 206), box(200, 190, 290, 206), box(10, 260, 290, 330)]
    const w = 160, h = 30, gap = 6
    const places = [{ left: 10, top: 230 - h - gap }, ...cardPlaces(card, w, h, gap, (x) => x)]
    const boxes = places.map((p) => box(p.left, p.top, p.left + w, p.top + h))
    expect(places[leastHidden(boxes, weighCovers(own, other, card), box(0, 0, 400, 800))]).toEqual({ left: 6, top: 6 })
  })
  it('stays out of the inside places in a card without a picture', () => {
    const card = box(0, 0, 300, 400)
    const own = [box(10, 100, 200, 120)]
    const other = [box(10, 10, 290, 40), box(10, 44, 290, 80), box(10, 130, 290, 200)]
    const w = 160, h = 30, gap = 6
    const places = [{ left: 10, top: 100 - h - gap }, ...cardPlaces(card, w, h, gap, (x) => x)]
    const boxes = places.map((p) => box(p.left, p.top, p.left + w, p.top + h))
    expect([0, 3]).toContain(leastHidden(boxes, weighCovers(own, other, card), box(0, 0, 400, 800)))
  })
})
