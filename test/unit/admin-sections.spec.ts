import { describe, expect, it } from 'vitest'
import { defineEntity, f } from 'tinyzoo'
import {
  cmsFieldIcon, cmsFormSections, cmsIsShortField, cmsNeedsSectionMenu, cmsSelectAsButtons, cmsWaitingFields,
} from '../../packages/cms/app/utils/cmsSections'

// A form reads as a few titled sections; empty optional fields wait behind "+ Add …".
const fld = (key: string, type: string, extra: Record<string, any> = {}) => ({ key, type, optional: false, meta: {}, ...extra })
const keys = (s: { fields: { key: string }[] }) => s.fields.map((x) => x.key)

describe('form sections', () => {
  const event = [
    fld('kind', 'select'), fld('organised', 'boolean'), fld('startsAt', 'datetime'), fld('endsAt', 'datetime', { optional: true }),
    fld('place', 'text', { optional: true }), fld('note', 'text', { optional: true }), fld('url', 'text', { optional: true, meta: { format: 'link' } }),
    fld('article', 'relation', { optional: true }),
  ]

  it('follows admin.sections, in the order given', () => {
    const view = cmsFormSections(event, [
      { label: 'When?', fields: ['startsAt', 'endsAt'] },
      { label: 'What is it?', icon: 'i-lucide-tag', fields: ['kind', 'organised'] },
      { label: 'Where?', fields: ['place'] },
      { label: 'More', fields: ['note', 'url', 'article'] },
    ])
    expect(view.map((s) => s.label)).toEqual(['When?', 'What is it?', 'Where?', 'More'])
    expect(keys(view[0]!)).toEqual(['startsAt', 'endsAt'])
    expect(view[0]!.icon).toBe('i-lucide-calendar') // none given: from the first field's kind
    expect(view[1]!.icon).toBe('i-lucide-tag')
  })

  it('groups fields no section lists by kind, after the configured ones', () => {
    const view = cmsFormSections(event, [{ label: 'What is it?', fields: ['kind', 'organised'] }])
    expect(view.map((s) => s.label ?? s.kind)).toEqual(['What is it?', 'basics', 'when', 'links', 'related'])
    expect(keys(view[1]!)).toEqual(['place', 'note'])
  })

  it('groups a long form by kind on its own, and leaves a short one without headings', () => {
    expect(cmsFormSections(event).map((s) => s.kind)).toEqual(['basics', 'when', 'links', 'related'])
    const short = cmsFormSections([fld('logo', 'media'), fld('url', 'text', { meta: { format: 'url' } })])
    expect(short).toHaveLength(1)
    expect(short[0]!.kind).toBeNull()
    expect(keys(short[0]!)).toEqual(['logo', 'url'])
  })

  it('folds .group() fields away at the end', () => {
    const view = cmsFormSections([...event, fld('metaTitle', 'text', { meta: { group: 'SEO' } }), fld('ogImage', 'media', { meta: { group: 'SEO' } })], [])
    const last = view.at(-1)!
    expect(last.folded).toBe(true)
    expect(last.label).toBe('SEO')
    expect(keys(last)).toEqual(['metaTitle', 'ogImage'])
  })

  it('offers a section menu only for long forms', () => {
    expect(cmsNeedsSectionMenu(cmsFormSections(event))).toBe(false) // 4 sections, 8 fields
    const club = Array.from({ length: 12 }, (_, i) => fld(`f${i}`, i % 3 === 0 ? 'datetime' : i % 3 === 1 ? 'media' : 'relation'))
    expect(cmsNeedsSectionMenu(cmsFormSections([...club, fld('a', 'text')]))).toBe(true)
  })
})

describe('fields waiting behind "+ Add"', () => {
  const when = { fields: [fld('startsAt', 'datetime'), fld('endsAt', 'datetime', { optional: true })] }
  const more = { fields: [fld('note', 'text', { optional: true }), fld('url', 'text', { optional: true }), fld('article', 'relation', { optional: true })] }

  it('hides empty optional fields, but never a whole section', () => {
    expect(cmsWaitingFields(when, { startsAt: '2026-06-13T07:00:00Z', endsAt: null }, new Set())).toEqual(['endsAt'])
    expect(cmsWaitingFields(more, {}, new Set())).toEqual(['url', 'article'])
  })

  it('keeps showing what was filled in, what was asked for and what has an error', () => {
    expect(cmsWaitingFields(more, { note: '', url: 'https://x.cz' }, new Set(['article']))).toEqual(['note'])
    expect(cmsWaitingFields(more, {}, new Set(), { url: 'Invalid' })).toEqual(['note', 'article'])
  })

  it('never hides switches or text bodies', () => {
    const s = { fields: [fld('title', 'text'), fld('body', 'richtext', { optional: true }), fld('on', 'boolean', { optional: true })] }
    expect(cmsWaitingFields(s, {}, new Set())).toEqual([])
  })
})

describe('field controls', () => {
  it('picks an icon from the developer, else from the kind of value', () => {
    expect(cmsFieldIcon(fld('place', 'text', { meta: { icon: 'i-lucide-map-pin' } }))).toBe('i-lucide-map-pin')
    expect(cmsFieldIcon(fld('email', 'text', { meta: { format: 'email' } }))).toBe('i-lucide-mail')
    expect(cmsFieldIcon(fld('web', 'text', { meta: { format: 'url' } }))).toBe('i-lucide-link')
    expect(cmsFieldIcon(fld('name', 'text'))).toBeUndefined()
  })

  it('shows a few choices as buttons in the content column only', () => {
    const kind = fld('kind', 'select', { meta: { options: ['a', 'b', 'c', 'd'] } })
    expect(cmsSelectAsButtons(kind)).toBe(true)
    expect(cmsSelectAsButtons(kind, 'sidebar')).toBe(false)
    expect(cmsSelectAsButtons(fld('x', 'select', { meta: { options: ['1', '2', '3', '4', '5', '6'] } }))).toBe(false)
  })

  it('puts single-line fields side by side in two-column sections', () => {
    expect(cmsIsShortField(fld('email', 'text'))).toBe(true)
    expect(cmsIsShortField(fld('about', 'text', { meta: { multiline: true } }))).toBe(false)
    expect(cmsIsShortField(fld('photo', 'media'))).toBe(false)
  })

  it('carries icons, formats and all-day through the graph', () => {
    const Event = defineEntity('event', {
      label: 'Events', titleField: 'title',
      fields: {
        title: f.text(),
        kind: f.select({ options: ['race', 'club'] as const, icons: { race: 'i-lucide-trophy' } }),
        startsAt: f.datetime({ allDay: true }),
        place: f.text().optional().icon('i-lucide-map-pin'),
        url: f.text({ format: 'link' }).optional(),
      },
      admin: { sections: [{ label: 'When?', fields: ['startsAt'] }] },
    })
    expect(Event.fields.kind.meta.icons).toEqual({ race: 'i-lucide-trophy' })
    expect(Event.fields.startsAt.meta.allDay).toBe(true)
    expect(Event.fields.place.meta.icon).toBe('i-lucide-map-pin')
    expect(Event.fields.url.meta.format).toBe('link')
    expect(Event.admin?.sections?.[0]?.fields).toEqual(['startsAt'])
  })

  it('refuses a section listing a field that does not exist', () => {
    expect(() => defineEntity('bad', {
      label: 'Bad', titleField: 'title', fields: { title: f.text() },
      admin: { sections: [{ label: 'X', fields: ['nope' as 'title'] }] },
    })).toThrow(/lists "nope", which is not a field/)
  })
})
