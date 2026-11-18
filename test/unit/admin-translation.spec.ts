import { describe, expect, it } from 'vitest'
import { cmsBlank, cmsSavedAt } from '../../packages/cms/app/utils/cmsTranslation'

// The translation editor's helpers: when it was saved, and whether a translated field is still empty.
describe('cmsSavedAt', () => {
  // The row the server sends for ?locale=en: the entry's own times, and the translation's under `__version`.
  const row = { updatedAt: '2026-11-17T22:34:56.135Z', __version: '2026-11-17T22:36:55.417Z' }

  it('takes the translation\'s own time for a translation, not the original\'s', () => {
    expect(cmsSavedAt(row, true)).toBe('2026-11-17T22:36:55.417Z')
  })

  it('takes the entry\'s time for the entry itself', () => {
    expect(cmsSavedAt(row, false)).toBe('2026-11-17T22:34:56.135Z')
  })

  it('says nothing for a translation that was never saved (it has no row, so no version)', () => {
    expect(cmsSavedAt({ updatedAt: row.updatedAt, __version: null }, true)).toBeNull()
    expect(cmsSavedAt({ updatedAt: row.updatedAt }, true)).toBeNull()
  })

  it('copes with no row at all', () => {
    expect(cmsSavedAt(null, true)).toBeNull()
    expect(cmsSavedAt(undefined, false)).toBeNull()
  })
})

describe('cmsBlank', () => {
  it('is blank for nothing, empty text, empty lists', () => {
    for (const v of [null, undefined, '', []]) expect(cmsBlank(v)).toBe(true)
  })

  it('is blank for a rich text of empty paragraphs, not for one with words', () => {
    expect(cmsBlank({ type: 'doc', content: [] })).toBe(true)
    expect(cmsBlank({ type: 'doc', content: [{ type: 'paragraph' }, { type: 'paragraph', content: [] }] })).toBe(true)
    expect(cmsBlank({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }] })).toBe(false)
  })

  it('is blank for a group of blanks, not for one with a value in it', () => {
    expect(cmsBlank({})).toBe(true)
    expect(cmsBlank({ place: '', note: null })).toBe(true)
    expect(cmsBlank({ place: 'Praha', note: '' })).toBe(false)
  })

  it('is not blank for text, a list with items, or a number or switch that is zero or off', () => {
    expect(cmsBlank('Hi')).toBe(false)
    expect(cmsBlank([{ type: 'text' }])).toBe(false)
    expect(cmsBlank(0)).toBe(false)
    expect(cmsBlank(false)).toBe(false)
  })
})
