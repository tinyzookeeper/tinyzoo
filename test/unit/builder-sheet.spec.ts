import { describe, expect, it } from 'vitest'
import { cmsSheetAfterSelect, cmsSheetCovers, cmsSheetDragEnd, cmsSheetDragOffset, cmsSheetStagePad } from '../../packages/cms/shared/builder-sheet'

describe('the phone-sized admin sheet', () => {
  it('opens for a block inside a section picked in the page, and follows it', () => {
    expect(cmsSheetAfterSelect('page', 2, false)).toBe(true)
    expect(cmsSheetAfterSelect('page', 3, true)).toBe(true)
  })
  it('stays at its handle for a section or nothing picked in the page', () => {
    expect(cmsSheetAfterSelect('page', 1, true)).toBe(false)
    expect(cmsSheetAfterSelect('page', 0, true)).toBe(false)
    expect(cmsSheetAfterSelect('page', 1, false)).toBe(false)
  })
  it('keeps what it was when the selection is made inside it', () => {
    expect(cmsSheetAfterSelect('inside', 1, true)).toBe(true)
    expect(cmsSheetAfterSelect('inside', 0, false)).toBe(false)
  })
  it('ends a drag by its distance', () => {
    expect(cmsSheetDragEnd(true, 80)).toBe('close')
    expect(cmsSheetDragEnd(true, 60)).toBe('back')
    expect(cmsSheetDragEnd(true, -80)).toBe('back')
    expect(cmsSheetDragEnd(false, -50)).toBe('open')
    expect(cmsSheetDragEnd(false, -10)).toBe('back')
    expect(cmsSheetDragEnd(false, 90)).toBe('back')
  })
  it('follows the finger only the way it can go', () => {
    expect(cmsSheetDragOffset(true, 30)).toBe(30)
    expect(cmsSheetDragOffset(true, -30)).toBe(0)
    expect(cmsSheetDragOffset(false, -30)).toBe(-30)
    expect(cmsSheetDragOffset(false, -300)).toBe(-72)
    expect(cmsSheetDragOffset(false, 30)).toBe(0)
  })
  it('says how much of the frame an open sheet covers', () => {
    expect(cmsSheetCovers(false, 400, 800, 740)).toBe(0)
    // The sheet's top is at 400; the frame ends at 740.
    expect(cmsSheetCovers(true, 400, 800, 740)).toBe(340)
    // A sheet lower than the frame's end covers nothing of it.
    expect(cmsSheetCovers(true, 40, 800, 740)).toBe(0)
  })
  it('keeps room under the stage for the closed handle', () => {
    // The stage ends 12 px above the screen's bottom; the handle is 56 px tall.
    expect(cmsSheetStagePad(56, 800, 788)).toBe(44)
    expect(cmsSheetStagePad(56, 800, 700)).toBe(0)
  })
})
