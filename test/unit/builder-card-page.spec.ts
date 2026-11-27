// The page's side of a card bound to a content type (part 3c, second half): shared/builder-card-page.ts.
import { describe, expect, it } from 'vitest'
import { cardBlockName, cardChipAt, cardNameLine, cardPageKey, cardSectionName, cardStagger, cardTryLanded, cardValueEdit, cardValuePart } from '../../packages/cms/shared/builder-card-page'
import type { CmsBuilderCardBlock } from '../../packages/cms/shared/builder'

const block = (b: Partial<CmsBuilderCardBlock>): CmsBuilderCardBlock => ({ label: 'Text', shows: '← Cena', chip: '← Cena', ...b })

describe('a card of a section', () => {
  it('is named by its entry, else by its place', () => {
    expect(cardPageKey('e1', '0')).toBe('e1')
    expect(cardPageKey(undefined, '2')).toBe('@2')
    expect(cardPageKey('', null)).toBe('@')
  })
})

describe('names', () => {
  it('the section says its type and how often the card repeats', () => {
    expect(cardSectionName('Kurzy', 6)).toEqual({ label: 'Kurzy', shows: '6×' })
    expect(cardSectionName('Kurzy', 0)).toEqual({ label: 'Kurzy', shows: '' })
    expect(cardSectionName('Kurzy', Number.NaN).shows).toBe('')
  })
  it('a block says its name and what it shows, a warning when it shows nothing', () => {
    expect(cardBlockName(block({}), 'x')).toEqual({ label: 'Text', shows: '← Cena', warn: false })
    expect(cardBlockName(block({ shows: 'Nenapojeno', warn: true }), 'x').warn).toBe(true)
    expect(cardBlockName(undefined, 'Nadpis')).toEqual({ label: 'Nadpis', shows: '', warn: false })
    expect(cardBlockName(block({ label: '' }), 'Nadpis').label).toBe('Nadpis')
    expect(cardNameLine({ label: 'Text', shows: '← Cena' })).toBe('Text ← Cena')
    expect(cardNameLine({ label: 'Kurzy', shows: '' })).toBe('Kurzy')
  })
})

describe('what a double click on a value does', () => {
  it('types a plain text, boxes a value or a rich text, opens the entry for the rest', () => {
    expect(cardValueEdit(block({ field: 'title', kind: 'text' }))).toEqual({ how: 'text', field: 'title' })
    expect(cardValueEdit(block({ field: 'about', kind: 'longText' }))).toEqual({ how: 'text', field: 'about' })
    expect(cardValueEdit(block({ field: 'body', kind: 'richText' }))).toEqual({ how: 'rich', field: 'body' })
    for (const kind of ['number', 'date', 'choice', 'link', 'email']) expect(cardValueEdit(block({ field: 'f', kind }))?.how).toBe('value')
    expect(cardValueEdit(block({ field: 'cover', kind: 'picture' }))).toEqual({ how: 'entry', field: 'cover' })
    expect(cardValueEdit(block({ field: 'slug', kind: 'page' }))).toEqual({ how: 'entry', field: null })
  })
  it('nothing for an own text, an unbound block or a group', () => {
    expect(cardValueEdit(block({}))).toBeNull()
    expect(cardValueEdit(block({ group: true, field: 'x', kind: 'text' }))).toBeNull()
    expect(cardValueEdit(null)).toBeNull()
  })
})

describe('the chip on a block', () => {
  it('stands in the top right corner, or across the middle of a low block', () => {
    expect(cardChipAt({ left: 0, top: 0, width: 200, height: 100 }, 50, 18)).toEqual({ left: 146, top: 4 })
    expect(cardChipAt({ left: 0, top: 100, width: 200, height: 20 }, 50, 18)).toEqual({ left: 146, top: 101 })
    // never left of the block
    expect(cardChipAt({ left: 10, top: 0, width: 30, height: 100 }, 50, 18).left).toBe(12)
    // scaled
    expect(cardChipAt({ left: 0, top: 0, width: 200, height: 100 }, 50, 18, 2)).toEqual({ left: 142, top: 8 })
  })
})

describe('the stagger', () => {
  it('steps 55 ms per card, at most a dozen, none with reduced motion', () => {
    expect([0, 1, 2, 3].map((i) => cardStagger(i, false))).toEqual([0, 55, 110, 165])
    expect(cardStagger(40, false)).toBe(605)
    expect(cardStagger(3, true)).toBe(0)
    expect(cardStagger(-1, false)).toBe(0)
  })
})

describe('a chosen field lands', () => {
  it('when the draft holds it', () => {
    expect(cardTryLanded('price', { value: 'price' })).toBe(true)
    expect(cardTryLanded('title', { value: 'price' })).toBe(false)
    expect(cardTryLanded(null, { value: '' })).toBe(true)
    expect(cardTryLanded(undefined, { value: '' })).toBe(true)
    expect(cardTryLanded(3, { value: '3' })).toBe(false)
    expect(cardTryLanded('x', null)).toBe(false)
  })
})

describe('the part that shows a value', () => {
  it('is the smallest that shows exactly the value', () => {
    const parts = [{ node: 'root', text: 'od 2 490 Kč' }, { node: 'p', text: 'Jarní kurz' }, { node: 'span', text: 'Jarní kurz' }]
    expect(cardValuePart(parts, 'Jarní kurz')).toBe('span')
    expect(cardValuePart(parts, 'nic')).toBeNull()
    expect(cardValuePart(parts, '')).toBeNull()
  })
})
