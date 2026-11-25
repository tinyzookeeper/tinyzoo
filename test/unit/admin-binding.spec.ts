import { describe, expect, it } from 'vitest'
import {
  cmsBindingDirKind, cmsBindingFieldsFor, cmsBindingMissing, cmsBindingMoveEntry, cmsBindingMoreFields, cmsBindingOrderMode, cmsBindingRead,
  cmsBindingSetEntries, cmsBindingSetLimit, cmsBindingSetOrder, cmsBindingSetPlace, cmsBindingSetType, cmsBindingSortFields,
  cmsBindingToggleMore, cmsBindingTypes,
} from '../../packages/cms/app/utils/cmsBinding'

const f = (key: string, type: string, meta: Record<string, any> = {}, extra: Record<string, any> = {}) => ({ key, type, optional: true, required: false, ui: {}, meta: { label: key, ...meta }, ...extra })
const course = {
  name: 'custom_course', label: 'Courses', titleField: 'title',
  fields: [
    f('title', 'text'), f('slug', 'slug'), f('status', 'status'), f('position', 'number'),
    f('cover', 'media'), f('brochure', 'media', { file: true }),
    f('intro', 'text', { multiline: true }), f('summary', 'text'), f('mail', 'text', { format: 'email' }), f('tint', 'text', { format: 'color' }),
    f('body', 'richtext'), f('startsAt', 'datetime'), f('price', 'number'), f('level', 'select'), f('open', 'boolean'),
    f('teacher', 'relation', { kind: 'many-to-one' }, { relation: { to: 'custom_teacher' } }), f('photos', 'gallery'),
  ],
}
const graph = [{ name: 'page', label: 'Pages', titleField: 'title', fields: [] }, course]
const types = cmsBindingTypes(graph)
const [type] = types as [(typeof types)[number]]
const keys = (list: { key: string }[]) => list.map((x) => x.key)

describe('binding: what the site offers', () => {
  it('takes only the types of its own', () => {
    expect(types.map((x) => x.name)).toEqual(['custom_course'])
    expect(cmsBindingTypes(null)).toEqual([])
  })

  it('offers fields to the places they fit, never the title or the mapper fields', () => {
    expect(keys(cmsBindingFieldsFor(type, 'image'))).toEqual(['cover'])
    expect(keys(cmsBindingFieldsFor(type, 'text'))).toEqual(['intro', 'body', 'summary'])
    expect(keys(cmsBindingFieldsFor(type, 'date'))).toEqual(['startsAt'])
    expect(keys(cmsBindingFieldsFor(type, 'label'))).toEqual(['summary', 'level', 'teacher'])
  })

  it('offers the other simple fields as more, without the ones a place took', () => {
    expect(keys(cmsBindingMoreFields(type, null))).toEqual(['summary', 'startsAt', 'price', 'level', 'open', 'teacher'])
    expect(keys(cmsBindingMoreFields(type, { date: 'startsAt', label: 'level' }))).toEqual(['summary', 'price', 'open', 'teacher'])
  })

  it('offers the fields the content API can sort by', () => {
    expect(keys(cmsBindingSortFields(type))).toEqual(['title', 'intro', 'summary', 'mail', 'tint', 'startsAt', 'price', 'level', 'open'])
  })

  it('tells how a direction reads and which way a list is ordered', () => {
    expect(cmsBindingDirKind(type.fields.find((x) => x.key === 'startsAt'))).toBe('date')
    expect(cmsBindingDirKind(type.fields.find((x) => x.key === 'price'))).toBe('number')
    expect(cmsBindingDirKind(type.fields.find((x) => x.key === 'summary'))).toBe('text')
    expect(cmsBindingDirKind(type.fields.find((x) => x.key === 'open'))).toBe('other')
    expect(cmsBindingOrderMode(null)).toBe('own')
    expect(cmsBindingOrderMode({ by: 'createdAt', dir: 'desc' })).toBe('newest')
    expect(cmsBindingOrderMode({ by: 'createdAt', dir: 'asc' })).toBe('oldest')
    expect(cmsBindingOrderMode({ by: 'price', dir: 'asc' })).toBe('field')
  })
})

describe('binding: what is missing', () => {
  it('names nothing for no value or a value that is not a binding', () => {
    for (const v of [null, undefined, 'x', 3, [], {}, { type: 3 }]) expect(cmsBindingMissing(v, types)).toEqual({ type: false, fields: [] })
  })

  it('names a type the site does not have', () => {
    expect(cmsBindingMissing({ type: 'custom_recipe', show: { date: 'startsAt' } }, types)).toEqual({ type: true, fields: [] })
  })

  it('names the places that hold a field the type does not have', () => {
    const value = { type: 'custom_course', show: { date: 'startsAt', label: 'gone', more: ['price', 'old'] }, order: { by: 'rank', dir: 'asc' } }
    expect(cmsBindingMissing(value, types)).toEqual({
      type: false, fields: [{ place: 'label', key: 'gone' }, { place: 'more', key: 'old' }, { place: 'order', key: 'rank' }],
    })
    expect(cmsBindingMissing({ type: 'custom_course', order: { by: 'createdAt', dir: 'desc' } }, types).fields).toEqual([])
  })

  it('tolerates junk inside', () => {
    expect(cmsBindingMissing({ type: 'custom_course', show: 'x', order: 5, entries: 'a' }, types)).toEqual({ type: false, fields: [] })
    expect(cmsBindingMissing({ type: 'custom_course', show: { more: [1, null, 'price'] } }, types).fields).toEqual([])
  })
})

describe('binding: setters', () => {
  const full = { type: 'custom_course', show: { image: 'cover', date: 'startsAt', more: ['price'] }, order: { by: 'price', dir: 'asc' as const }, limit: 9, entries: ['a'] }

  it('empties the value for no type, and starts a new one with the limit only', () => {
    expect(cmsBindingSetType(full, null)).toBeNull()
    expect(cmsBindingSetType(full, 'custom_recipe')).toEqual({ type: 'custom_recipe', limit: 9 })
    expect(cmsBindingSetType(null, 'custom_course')).toEqual({ type: 'custom_course' })
    expect(cmsBindingSetType(full, 'custom_course')).toEqual(full)
  })

  it('never changes what it is given', () => {
    const before = structuredClone(full)
    cmsBindingSetPlace(full, 'text', 'intro')
    cmsBindingToggleMore(full, 'open', true)
    cmsBindingSetOrder(full, null)
    cmsBindingSetLimit(full, 3)
    cmsBindingSetEntries(full, ['b'])
    expect(full).toEqual(before)
  })

  it('sets and clears a place, and drops what became empty', () => {
    expect(cmsBindingSetPlace({ type: 'custom_course' }, 'date', 'startsAt')).toEqual({ type: 'custom_course', show: { date: 'startsAt' } })
    expect(cmsBindingSetPlace({ type: 'custom_course', show: { date: 'startsAt' } }, 'date', null)).toEqual({ type: 'custom_course' })
    expect(cmsBindingSetPlace(null, 'date', 'startsAt')).toBeNull()
  })

  it('ticks at most six more details', () => {
    let v: any = { type: 'custom_course' }
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) v = cmsBindingToggleMore(v, k, true)
    expect(v.show.more).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    v = cmsBindingToggleMore(v, 'a', false)
    expect(v.show.more).toEqual(['b', 'c', 'd', 'e', 'f'])
    for (const k of ['b', 'c', 'd', 'e', 'f']) v = cmsBindingToggleMore(v, k, false)
    expect(v).toEqual({ type: 'custom_course' })
  })

  it('sets the order and the limit, and leaves them out when empty', () => {
    expect(cmsBindingSetOrder({ type: 'custom_course' }, { by: 'createdAt', dir: 'desc' })).toEqual({ type: 'custom_course', order: { by: 'createdAt', dir: 'desc' } })
    expect(cmsBindingSetOrder(full, null)).not.toHaveProperty('order')
    expect(cmsBindingSetLimit({ type: 'custom_course' }, 12)).toEqual({ type: 'custom_course', limit: 12 })
    expect(cmsBindingSetLimit({ type: 'custom_course' }, 99)).toEqual({ type: 'custom_course', limit: 48 })
    expect(cmsBindingSetLimit({ type: 'custom_course' }, 0)).toEqual({ type: 'custom_course', limit: 1 })
    expect(cmsBindingSetLimit(full, null)).not.toHaveProperty('limit')
    expect(cmsBindingSetLimit(full, Number.NaN)).not.toHaveProperty('limit')
  })

  it('keeps chosen entries in order, once each, at most twelve', () => {
    const ids = Array.from({ length: 14 }, (_, i) => `id${i}`)
    expect(cmsBindingSetEntries({ type: 'custom_course' }, ['b', 'a', 'b'])).toEqual({ type: 'custom_course', entries: ['b', 'a'] })
    expect(cmsBindingSetEntries({ type: 'custom_course' }, ids)!.entries).toHaveLength(12)
    expect(cmsBindingSetEntries(full, [])).not.toHaveProperty('entries')
    expect(cmsBindingMoveEntry(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(cmsBindingMoveEntry(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })

  it('writes no key the schema does not know', () => {
    const read = cmsBindingRead({ type: 'custom_course', extra: 1, show: { image: 'cover', junk: 1, more: ['p', 3] }, order: { by: 'p', dir: 'up' }, limit: 2.5 })
    expect(read).toEqual({ type: 'custom_course', show: { image: 'cover', more: ['p'] } })
    expect(cmsBindingRead({ show: {} })).toBeNull()
  })
})
