import { describe, expect, it } from 'vitest'
import { cmsBindingTypes } from '../../packages/cms/app/utils/cmsBinding'
import {
  CMS_REF_KIND_ICONS, cmsCardBindingOf, cmsGraphFieldKind, cmsRefFields, cmsRefFitting, cmsRefState,
} from '../../packages/cms/app/utils/cmsFieldRef'
import { CUSTOM_FIELD_KINDS } from '../../packages/cms/src/custom-kinds'

const f = (key: string, type: string, meta: Record<string, any> = {}, extra: Record<string, any> = {}) => ({ key, type, optional: true, required: false, ui: {}, meta: { label: key, ...meta }, ...extra })
const course = {
  name: 'custom_course', label: 'Courses', titleField: 'title',
  fields: [
    f('title', 'text'), f('slug', 'slug'), f('status', 'status'), f('position', 'number'),
    f('cover', 'media'), f('brochure', 'media', { file: true }),
    f('intro', 'text', { multiline: true }), f('mail', 'text', { format: 'email' }), f('site', 'text', { format: 'url' }), f('more', 'text', { format: 'link' }),
    f('tint', 'text', { format: 'color' }), f('plain', 'text', { format: 'plain' }),
    f('body', 'richtext'), f('startsAt', 'datetime'), f('price', 'number'), f('level', 'select'), f('open', 'boolean'),
    f('teacher', 'relation', { kind: 'many-to-one' }, { relation: { to: 'custom_teacher' } }), f('photos', 'gallery'), f('odd', 'mystery'),
  ],
}
const [type] = cmsBindingTypes([course]) as [ReturnType<typeof cmsBindingTypes>[number]]
const field = (key: string) => type.fields.find((x) => x.key === key)!
const keys = (list: { key: string }[]) => list.map((x) => x.key)

describe('field reference: kinds', () => {
  it('reads the kind of every graph field shape', () => {
    const kinds = Object.fromEntries(type.fields.map((x) => [x.key, cmsGraphFieldKind(x)]))
    expect(kinds).toEqual({
      title: 'text', slug: 'page', status: null, position: null, cover: 'picture', brochure: 'file',
      intro: 'longText', mail: 'email', site: 'link', more: 'link', tint: 'color', plain: 'text',
      body: 'richText', startsAt: 'date', price: 'number', level: 'choice', open: 'yesNo',
      teacher: 'relation', photos: 'gallery', odd: null,
    })
  })

  it('is not a page for a slug field of another name, and survives odd fields', () => {
    expect(cmsGraphFieldKind({ ...field('slug'), key: 'path' })).toBeNull()
    expect(cmsGraphFieldKind({ key: 'x', type: 'text', label: 'x' })).toBe('text')
    expect(cmsGraphFieldKind(null as any)).toBeNull()
  })

  it('has an icon for every kind', () => {
    for (const k of CUSTOM_FIELD_KINDS) expect(CMS_REF_KIND_ICONS[k]).toMatch(/^i-lucide-/)
  })
})

describe('field reference: what a block can name', () => {
  it('lists every field with a kind in the type\'s order, never the status or position', () => {
    expect(keys(cmsRefFields(type))).toEqual([
      'title', 'slug', 'cover', 'brochure', 'intro', 'mail', 'site', 'more', 'tint', 'plain',
      'body', 'startsAt', 'price', 'level', 'open', 'teacher', 'photos',
    ])
    expect(cmsRefFields(type).find((x) => x.key === 'slug')?.kind).toBe('page')
  })

  it('offers only the fields of the kinds a block takes', () => {
    expect(keys(cmsRefFitting(type, ['text', 'longText']))).toEqual(['title', 'intro', 'plain'])
    expect(keys(cmsRefFitting(type, ['picture']))).toEqual(['cover'])
    expect(keys(cmsRefFitting(type, ['link', 'page']))).toEqual(['slug', 'site', 'more'])
    expect(cmsRefFitting(type, [])).toEqual([])
  })

  it('has no page when the type has no slug', () => {
    const noPages = { ...type, fields: type.fields.filter((x) => x.key !== 'slug') }
    expect(keys(cmsRefFitting(noPages, ['page']))).toEqual([])
  })
})

describe('field reference: what a stored value says', () => {
  const takes = ['text', 'longText'] as const
  it('is empty for nothing and for anything that is not a text', () => {
    for (const v of [undefined, null, '', 0, 5, true, {}, [], ['title']]) expect(cmsRefState(v, type, takes)).toEqual({ state: 'empty' })
  })
  it('is ok for a field the type has and the block takes', () => {
    expect(cmsRefState('title', type, takes)).toMatchObject({ state: 'ok', field: { key: 'title', kind: 'text' } })
  })
  it('is gone for a key the type lacks', () => {
    expect(cmsRefState('removed', type, takes)).toEqual({ state: 'gone', key: 'removed' })
    expect(cmsRefState('status', type, takes)).toEqual({ state: 'gone', key: 'status' })
  })
  it('is unfit for a field of a kind the block does not take', () => {
    expect(cmsRefState('cover', type, takes)).toMatchObject({ state: 'unfit', field: { key: 'cover', kind: 'picture' } })
  })
  it('keeps the key when there is no type', () => {
    expect(cmsRefState('title', undefined, takes)).toEqual({ state: 'noType', key: 'title' })
    expect(cmsRefState(null, undefined, takes)).toEqual({ state: 'empty' })
  })
})

describe('field reference: the card around a block', () => {
  const def = { fields: [{ key: 'title', type: 'text' }, { key: 'entries', type: 'binding', meta: { binding: 'card' } }] }
  it('reads the value of the def\'s card binding', () => {
    expect(cmsCardBindingOf({ type: 'courses', entries: { type: 'custom_course' } }, def)).toEqual({ type: 'custom_course' })
    // A card with no binding yet is still a card: null, not undefined.
    expect(cmsCardBindingOf({ type: 'courses' }, def)).toBeNull()
  })
  it('is undefined with no card binding, no def or an odd block', () => {
    const other = { fields: [{ key: 'list', type: 'binding', meta: { binding: 'chosen' } }, { key: 'x', type: 'binding' }] }
    expect(cmsCardBindingOf({ list: { type: 'custom_course' } }, other)).toBeUndefined()
    expect(cmsCardBindingOf({}, undefined)).toBeUndefined()
    expect(cmsCardBindingOf(null, def)).toBeUndefined()
    expect(cmsCardBindingOf('x', { fields: 3 as any })).toBeUndefined()
  })
})
