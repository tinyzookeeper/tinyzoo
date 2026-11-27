import { describe, expect, it } from 'vitest'
import { createBuilderHistory } from '../../packages/cms/shared/builder-history'
import {
  cmsEntryFieldAt, cmsIsPlainText, cmsPendingBody, cmsPendingChange, cmsPendingKey, cmsPendingPut, cmsPendingRow, cmsPendingSummary, cmsPendingText,
  cmsPendingValueAt, isEntryStep, type CmsBuilderStep, type CmsGraphField, type CmsPendingEntry,
} from '../../packages/cms/shared/builder-pending'

// Part 2g of the builder: the changes to entries and globals made in the page, waiting in the page's
// editor. What a change at a path does to an entry, a field put back to what the row holds, the field's
// description at a path, what a save sends (a part for an entry, the whole for a global, the per-language
// fields for a translation), the line beside the save button, and the history that holds the page's steps
// and the entries' in one order.

const fields: CmsGraphField[] = [
  { key: 'day', type: 'select' },
  { key: 'from', type: 'text', meta: { max: 5 } },
  { key: 'note', type: 'text', optional: true, localized: true },
  { key: 'body', type: 'text', meta: { multiline: true } },
  { key: 'web', type: 'text', meta: { format: 'url' } },
  { key: 'secret', type: 'text', readOnly: true },
  { key: 'tags', type: 'relation', relation: { kind: 'many-to-many' } },
  { key: 'visits', type: 'relation', relation: { kind: 'one-to-many' } },
  { key: 'rows', type: 'blocks', meta: { list: {}, blocks: { item: { fields: [{ key: 'label', type: 'text', meta: { max: 10 } }, { key: 'price', type: 'number' }] } } } },
  { key: 'address', type: 'group', optional: true, meta: { fields: [{ key: 'city', type: 'text' }] } },
]
const base = {
  id: 'r1', updatedAt: 'v1', day: 'mon', from: '7:00', note: 'Odběry krve', body: 'A\nB', secret: 's',
  rows: [{ id: 'a', type: 'item', label: 'Jedna', price: 10 }, { id: 'b', type: 'item', label: 'Dvě', price: 20 }], address: { city: 'Jičín' },
}
const entry = (values: Record<string, unknown> = {}, more: Partial<CmsPendingEntry> = {}): CmsPendingEntry => ({
  entity: 'openingHour', id: 'r1', rowId: 'r1', global: false, locale: null, base, version: 'v1', values, can: true, error: null, ...more,
})

describe('a change to an entry made in the page', () => {
  it('is the whole top-level field, before and after', () => {
    expect(cmsPendingChange(entry(), ['note'], 'Odběry')).toEqual({ key: 'note', before: 'Odběry krve', after: 'Odběry' })
    const inList = cmsPendingChange(entry(), ['rows', 'b', 'label'], 'Tři')!
    expect(inList.key).toBe('rows')
    expect(inList.before).toBe(base.rows)
    expect(inList.after).toEqual([{ id: 'a', type: 'item', label: 'Jedna', price: 10 }, { id: 'b', type: 'item', label: 'Tři', price: 20 }])
    expect(cmsPendingChange(entry(), ['address', 'city'], 'Praha')!.after).toEqual({ city: 'Praha' })
  })

  it('starts from what is already changed, and is nothing when nothing changes or the place is gone', () => {
    const changed = entry({ rows: [{ id: 'a', type: 'item', label: 'Nová', price: 10 }, { id: 'b', type: 'item', label: 'Dvě', price: 20 }] })
    expect((cmsPendingChange(changed, ['rows', 'b', 'price'], 25)!.after as { label: string; price: number }[]).map((x) => [x.label, x.price])).toEqual([['Nová', 10], ['Dvě', 25]])
    expect(cmsPendingChange(entry(), ['note'], 'Odběry krve')).toBeNull()
    expect(cmsPendingChange(entry(), ['rows', 'zz', 'label'], 'x')).toBeNull()
    expect(cmsPendingChange(entry(), ['nothing', 'x'], 'x')).toBeNull()
    expect(cmsPendingChange(entry(), [], 'x')).toBeNull()
  })

  it('keeps a field only while it differs from the row', () => {
    expect(cmsPendingPut(entry(), 'note', 'Odběry')).toEqual({ note: 'Odběry' })
    expect(cmsPendingPut(entry({ note: 'Odběry', from: '6:30' }), 'note', 'Odběry krve')).toEqual({ from: '6:30' })
    expect(cmsPendingRow(entry({ from: '6:30' })).from).toBe('6:30')
    expect(cmsPendingValueAt(entry({ from: '6:30' }), ['from'])).toBe('6:30')
    expect(cmsPendingValueAt(entry(), ['rows', 'a', 'label'])).toBe('Jedna')
    expect(cmsPendingKey('openingHour', 'r1')).toBe('openingHour\nr1')
  })
})

describe('the field at a path of an entry', () => {
  it('is the field, a field of a list\'s item by the item\'s type, or a field of a group', () => {
    expect(cmsEntryFieldAt(fields, base, ['from'])!.meta).toEqual({ max: 5 })
    expect(cmsEntryFieldAt(fields, base, ['rows', 'a', 'label'])!.key).toBe('label')
    expect(cmsEntryFieldAt(fields, base, ['rows', 'a', 'price'])!.type).toBe('number')
    expect(cmsEntryFieldAt(fields, base, ['address', 'city'])!.key).toBe('city')
    expect(cmsEntryFieldAt(fields, base, ['rows', 'zz', 'label'])).toBeNull()
    expect(cmsEntryFieldAt(fields, base, ['rows', 'a', 'nothing'])).toBeNull()
    expect(cmsEntryFieldAt(fields, base, ['nothing'])).toBeNull()
  })

  it('clips a typed text as the field takes it', () => {
    expect(cmsPendingText(cmsEntryFieldAt(fields, base, ['from']), '12:345678')).toBe('12:34')
    expect(cmsPendingText(cmsEntryFieldAt(fields, base, ['note']), 'jedna\ndva')).toBe('jedna dva')
    expect(cmsPendingText(cmsEntryFieldAt(fields, base, ['body']), 'jedna\ndva')).toBe('jedna\ndva')
    expect(cmsIsPlainText(cmsEntryFieldAt(fields, base, ['note']))).toBe(true)
    expect(cmsIsPlainText(cmsEntryFieldAt(fields, base, ['web']))).toBe(false)
    expect(cmsIsPlainText(cmsEntryFieldAt(fields, base, ['secret']))).toBe(false)
    expect(cmsIsPlainText(cmsEntryFieldAt(fields, base, ['day']))).toBe(false)
  })
})

describe('what a save sends', () => {
  it('sends an entry\'s changed fields only: its status and the rest stay as they are', () => {
    expect(cmsPendingBody(entry({ note: 'Odběry', rows: [] }), fields)).toEqual({ note: 'Odběry', rows: [] })
  })

  it('sends a global whole, as its form does: the row with the changes, without what the person may not write', () => {
    const global = entry({ from: '6:30', note: '' }, { global: true })
    expect(cmsPendingBody(global, fields)).toEqual({
      day: 'mon', from: '6:30', body: 'A\nB', rows: base.rows, address: { city: 'Jičín' },
      // An empty optional text is left out, a field the row does not have gets its blank, a read-only one and a list of related entries are not sent.
      tags: [],
    })
    expect(cmsPendingBody(global, fields)).not.toHaveProperty('secret')
    expect(cmsPendingBody(global, fields)).not.toHaveProperty('visits')
    expect(cmsPendingBody(global, fields)).not.toHaveProperty('web')
  })

  it('sends a translation\'s per-language fields only', () => {
    expect(cmsPendingBody(entry({ note: 'Blood samples', from: '6:30' }, { locale: 'en' }), fields)).toEqual({ note: 'Blood samples' })
    expect(cmsPendingBody(entry({ note: 'Blood samples' }, { locale: 'en', global: true }), fields)).toEqual({ note: 'Blood samples' })
  })

  it('counts what one save stores besides the page', () => {
    expect(cmsPendingSummary(true, [entry({ note: 'x' }), entry({}), entry({ from: 'y' })])).toEqual({ page: true, others: 2 })
    expect(cmsPendingSummary(false, [])).toEqual({ page: false, others: 0 })
  })
})

describe('one history for the page and the entries', () => {
  it('takes the steps back in the order they were made, whatever they changed', () => {
    const h = createBuilderHistory<CmsBuilderStep>()
    const hour = { entity: 'openingHour', id: 'r1' }
    h.record({ key: 'sections', value: [{ id: 's1', heading: 'A' }] }, { key: 'sections', value: [{ id: 's1', heading: 'B' }] }, { now: 0 })
    h.record({ entry: hour, field: 'note', value: 'Odběry krve' }, { entry: hour, field: 'note', value: 'Odběry' }, { group: 'entry:openingHour:r1:note', now: 5000 })
    // Typing on in the same text within the pause is the same step.
    h.record({ entry: hour, field: 'note', value: 'Odběry' }, { entry: hour, field: 'note', value: 'Odběry ráno' }, { group: 'entry:openingHour:r1:note', now: 5400 })
    h.record({ key: 'sections', value: [{ id: 's1', heading: 'B' }] }, { key: 'sections', value: [] }, { now: 9000 })
    expect(h.size).toBe(3)
    const third = h.undo()!
    expect(isEntryStep(third.before)).toBe(false)
    const second = h.undo()!
    expect(isEntryStep(second.before) && second.before.value).toBe('Odběry krve')
    expect(isEntryStep(second.after) && second.after.value).toBe('Odběry ráno')
    const first = h.undo()!
    expect(!isEntryStep(first.before) && first.before.value).toEqual([{ id: 's1', heading: 'A' }])
    expect(h.redo()).toBe(first)
    expect(h.redo()).toBe(second)
    // An entry handed to its own editor: its steps go, the page's stay.
    h.drop((s) => isEntryStep(s.before) && s.before.entry.id === 'r1')
    expect(h.size).toBe(1)
    expect(h.canRedo).toBe(true)
  })
})
