import { describe, expect, it } from 'vitest'
import { customFieldKind } from 'tinyzoo'
import type { CustomFieldKind } from 'tinyzoo'
import type { CustomType, CustomTypeField } from '../../templates/kit/app/utils/customTypes'
import {
  CARD_GROUP_MAX, CARD_MAX, CARD_TAKES, cardDate, cardEntries, cardFieldKind, cardHref, cardItems, cardLinkOf, cardListClasses, cardListPlan, cardMailto,
  cardMedia, cardNumber, cardPageHref, cardRich, cardSource, cardText, type CardBlockType, type CardListPlan,
} from '../../templates/kit/app/utils/card'

// What the kit reads from a list with a card of the owner's own, before it draws it
// (templates/kit/app/utils/card.ts): the table of what each block shows, the card as designed, the values
// by the field's kind and the card of each entry. No Nuxt.

const label = (cs: string, en = cs, de = cs) => ({ cs, en, de })
const field = (key: string, type: string, extra: Partial<CustomTypeField> = {}): CustomTypeField => ({ key, type, label: label(key), ...extra })
const NBSP = '\u00a0'

// One field of every kind a block can be told about, keyed by its kind.
const OPTIONS = [{ value: 'easy', label: label('Lehký', 'Easy', 'Leicht') }, { value: 'hard', label: label('Těžký') }]
const BY_KIND: Record<string, CustomTypeField> = {
  text: field('k_text', 'text'),
  longText: field('k_longText', 'text', { long: true }),
  richText: field('k_richText', 'richtext'),
  number: field('k_number', 'number'),
  date: field('k_date', 'datetime'),
  choice: field('k_choice', 'select', { options: OPTIONS }),
  yesNo: field('k_yesNo', 'boolean'),
  picture: field('k_picture', 'media'),
  gallery: field('k_gallery', 'gallery'),
  file: field('k_file', 'file'),
  link: field('k_link', 'text', { format: 'url' }),
  email: field('k_email', 'text', { format: 'email' }),
  color: field('k_color', 'color'),
  relation: field('k_relation', 'relation', { to: 'custom_teacher' }),
}
const VALUES: Record<string, unknown> = {
  text: 'Taneční kurz',
  longText: 'Řádek jedna\nŘádek dva',
  richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bohatý text' }] }] },
  number: 2400,
  date: '2027-03-14T10:00:00Z',
  choice: 'easy',
  picture: { url: '/media/a.jpg', width: 800, height: 600 },
  file: { url: '/media/program.pdf' },
  link: '/kontakt',
  email: 'jana@example.cz',
}
const ALL_KINDS = [...Object.keys(BY_KIND), 'page'] as CustomFieldKind[]
const BLOCKS = Object.keys(CARD_TAKES) as CardBlockType[]

const course: CustomType = {
  name: 'custom_course',
  label: label('Kurzy', 'Courses', 'Kurse'),
  labelSingular: label('Kurz', 'Course', 'Kurs'),
  titleField: 'name',
  path: '/kurzy/:slug',
  prefix: 'kurzy',
  publish: true,
  order: { by: 'startsAt', dir: 'desc' },
  page: null,
  fields: [
    field('name', 'text', { label: label('Název', 'Name', 'Titel') }),
    field('startsAt', 'datetime', { label: label('Začátek', 'Starts', 'Beginn') }),
    field('price', 'number', { label: label('Cena', 'Price', 'Preis') }),
    field('cover', 'media', { label: label('Titulní obrázek', 'Cover', 'Titelbild') }),
    field('level', 'select', { label: label('Úroveň', 'Level', 'Stufe'), options: OPTIONS }),
    field('about', 'text', { label: label('O kurzu'), long: true }),
    field('notes', 'richtext'),
    field('site', 'text', { format: 'url' }),
    field('mail', 'text', { format: 'email' }),
    field('program', 'file'),
    field('day', 'datetime', { allDay: true }),
    field('full', 'boolean'),
  ],
}
const noPages: CustomType = { ...course, name: 'custom_note', prefix: null, path: null, order: null }
const types = [course, noPages]

const entry = (extra: Record<string, unknown> = {}) => ({
  id: 'e1', slug: 'tanec', name: ' Tanec ', startsAt: '2027-03-14T10:00:00Z', price: 2400, cover: { url: '/media/a.jpg', width: 800, height: 600 },
  level: 'easy', about: 'Řádek 1\nŘádek 2', site: '/kontakt', mail: 'a@b.cz', program: { url: '/media/p.pdf' }, ...extra,
})
const heading = (extra: Record<string, unknown> = {}) => ({ id: 'h', type: 'heading', ...extra })
const text = (extra: Record<string, unknown> = {}) => ({ id: 't', type: 'text', ...extra })
const picture = (extra: Record<string, unknown> = {}) => ({ id: 'p', type: 'picture', ...extra })
const button = (extra: Record<string, unknown> = {}) => ({ id: 'b', type: 'button', ...extra })
const group = (items: unknown[], extra: Record<string, unknown> = {}) => ({ id: 'g', type: 'group', items, ...extra })

const plan = (items: unknown[], extra: Record<string, unknown> = {}, lang = 'cs') => {
  const p = cardListPlan({ source: { type: 'custom_course' }, items, ...extra }, types, lang)
  if (!p.ok) throw new Error(p.reason)
  return p
}
const entries = (items: unknown[], list: unknown[], opts: { lang?: string; editing?: boolean } = {}, extra: Record<string, unknown> = {}) =>
  cardEntries(plan(items, extra, opts.lang ?? 'cs'), list, { lang: opts.lang ?? 'cs', editing: opts.editing })

describe('the card: what each block takes', () => {
  it('is the table of the plan', () => {
    expect(CARD_TAKES.heading).toEqual(['text', 'number', 'date', 'choice'])
    expect(CARD_TAKES.text).toEqual(['text', 'longText', 'richText', 'number', 'date', 'choice'])
    expect(CARD_TAKES.picture).toEqual(['picture'])
    expect(CARD_TAKES.button).toEqual(['link', 'email', 'file', 'page'])
    expect(CARD_MAX).toBe(12)
    expect(CARD_GROUP_MAX).toBe(8)
  })

  for (const block of BLOCKS) {
    const takes = CARD_TAKES[block] as readonly string[]
    it(`reads every kind a ${block} takes, as a field of its own`, () => {
      for (const kind of takes) {
        const t: CustomType = { ...course, fields: [BY_KIND[kind] ?? field('slug_unused', 'text')] }
        const key = kind === 'page' ? 'slug' : BY_KIND[kind]!.key
        const src = cardSource(block, key, t, 'cs')
        expect(src.from, `${block} takes ${kind}`).toBe(kind === 'page' ? 'page' : 'field')
        if (src.from === 'field') expect(src.kind).toBe(kind)
      }
    })

    it(`gives unfit for every kind a ${block} does not take`, () => {
      for (const kind of ALL_KINDS.filter((k) => !takes.includes(k))) {
        const t: CustomType = { ...course, fields: [BY_KIND[kind] ?? field('x', 'text')] }
        const key = kind === 'page' ? 'slug' : BY_KIND[kind]!.key
        expect(cardSource(block, key, t, 'cs').from, `${block} does not take ${kind}`).toBe('unfit')
      }
    })

    it(`fills a ${block} from an entry's value of each kind it takes`, () => {
      for (const kind of takes) {
        const t: CustomType = { ...course, fields: [BY_KIND[kind] ?? field('x', 'text')] }
        const key = kind === 'page' ? 'slug' : BY_KIND[kind]!.key
        const design = { ...({ heading, text, picture, button }[block] as (e: Record<string, unknown>) => Record<string, unknown>)({ field: key, label: 'Více' }) }
        const p = cardListPlan({ source: { type: t.name }, items: [design] }, [t], 'cs')
        if (!p.ok) throw new Error(p.reason)
        const cards = cardEntries(p, [{ id: '1', slug: 'tanec', ...(kind === 'page' ? {} : { [key]: VALUES[kind] }) }], { lang: 'cs' })
        expect(cards, `${block} ← ${kind}`).toHaveLength(1)
        expect(cards[0]!.items[0]!.type).toBe(block)
      }
    })
  }
})

describe('the field\'s kind', () => {
  it('is the given kind first', () => {
    expect(cardFieldKind(field('a', 'text', { kind: 'email' }))).toBe('email')
    expect(cardFieldKind(field('a', 'media', { kind: 'file' }))).toBe('file')
    expect(cardFieldKind(field('a', 'text', { kind: null }))).toBeNull()
    expect(cardFieldKind(null)).toBeNull()
    expect(cardFieldKind(undefined)).toBeNull()
  })

  it('is read from the field\'s form without it, as the package reads it', () => {
    const shapes: CustomTypeField[] = [
      ...Object.values(BY_KIND), field('a', 'text', { format: 'link' }), field('a', 'unknownType'), field('a', 'text', { long: true, format: 'email' }),
    ]
    for (const shape of shapes) expect(cardFieldKind(shape), JSON.stringify(shape)).toBe(customFieldKind(shape))
    expect(cardFieldKind(BY_KIND.longText)).toBe('longText')
    expect(cardFieldKind(BY_KIND.link)).toBe('link')
    expect(cardFieldKind(BY_KIND.email)).toBe('email')
    expect(cardFieldKind(field('a', 'unknownType'))).toBeNull()
  })
})

describe('where a block takes its content from', () => {
  it('is its own text for no, an empty or a non-string reference', () => {
    for (const ref of [undefined, null, '', '   ', 5, {}, [], true]) expect(cardSource('heading', ref, course, 'cs')).toEqual({ from: 'own' })
  })

  it('is the entry\'s page for slug when the type has pages and the block takes it', () => {
    expect(cardSource('button', 'slug', course, 'cs')).toEqual({ from: 'page', key: 'slug', name: 'Kurz' })
    expect(cardSource('button', 'slug', course, 'en')).toEqual({ from: 'page', key: 'slug', name: 'Course' })
  })

  it('is missing for slug when the type has no pages, and unfit when the block does not take a page', () => {
    expect(cardSource('button', 'slug', noPages, 'cs')).toEqual({ from: 'missing', key: 'slug', name: 'slug' })
    for (const block of ['heading', 'text', 'picture'] as const) expect(cardSource(block, 'slug', course, 'cs').from).toBe('unfit')
    expect(cardSource('heading', 'slug', noPages, 'cs').from).toBe('missing')
  })

  it('is missing, with the key as its name, for a key the type does not have', () => {
    expect(cardSource('text', 'gone', course, 'cs')).toEqual({ from: 'missing', key: 'gone', name: 'gone' })
  })

  it('is unfit, with the label in the site\'s language, for a field of the wrong kind', () => {
    expect(cardSource('picture', 'price', course, 'cs')).toEqual({ from: 'unfit', key: 'price', name: 'Cena' })
    expect(cardSource('picture', 'price', course, 'de')).toEqual({ from: 'unfit', key: 'price', name: 'Preis' })
    expect(cardSource('button', 'price', course, 'en')).toEqual({ from: 'unfit', key: 'price', name: 'Price' })
  })

  it('is a field of the type with its kind and name', () => {
    const src = cardSource('heading', 'price', course, 'en')
    expect(src).toMatchObject({ from: 'field', key: 'price', kind: 'number', name: 'Price' })
  })
})

describe('the list plan', () => {
  it('draws nothing with no binding, no type or a type the site does not have', () => {
    for (const block of [null, undefined, 'x', [], {}, { source: null }, { source: {} }, { source: { type: '' } }, { source: { type: 5 } }]) {
      expect(cardListPlan(block, types, 'cs').ok).toBe(false)
    }
    expect(cardListPlan({ source: { type: 'custom_gone' } }, types, 'cs').ok).toBe(false)
    expect(cardListPlan({ source: { type: 'custom_course' } }, null, 'cs').ok).toBe(false)
    expect(cardListPlan({ source: { type: 'custom_course' } }, undefined, 'cs').ok).toBe(false)
    const bad = cardListPlan({ source: { type: 'custom_gone' } }, types, 'cs')
    expect(bad.ok === false && bad.reason).toContain('custom_gone')
  })

  it('has defaults for an empty block and for rubbish settings', () => {
    for (const extra of [{}, { arrangement: 'x', columns: 'x', space: 5, surface: null, heading: 5, text: {}, items: 'x' }]) {
      const p = plan([], extra)
      expect(p).toMatchObject({ arrangement: 'cards', columns: 3, space: 'medium', surface: 'soft', heading: '', text: '', design: [] })
      expect(p.type).toBe(course)
    }
  })

  it('reads the settings, columns as a string or a number', () => {
    expect(plan([], { arrangement: 'rows', columns: '2', space: 'large', surface: 'none', heading: ' H ', text: ' T ' }))
      .toMatchObject({ arrangement: 'rows', columns: 2, space: 'large', surface: 'none', heading: 'H', text: 'T' })
    expect(plan([], { columns: 4 }).columns).toBe(4)
    expect(plan([], { columns: '4' }).columns).toBe(4)
    expect(plan([], { columns: 2 }).columns).toBe(2)
    expect(plan([], { columns: 7 }).columns).toBe(3)
  })

  it('asks for the entries: the limit (6, at most 48) and the order', () => {
    const request = (binding: Record<string, unknown>, t = course) => {
      const p = cardListPlan({ source: { type: t.name, ...binding } }, [t], 'cs')
      if (!p.ok) throw new Error(p.reason)
      return p.request
    }
    expect(request({}).path).toBe('/api/content/custom_course')
    expect(request({}).query).toEqual({ limit: 6, sort: 'startsAt', dir: 'desc' })
    expect(request({ limit: 10 }).query.limit).toBe(10)
    expect(request({ limit: 500 }).query.limit).toBe(48)
    for (const limit of ['x', 0, -3, 2.5, null]) expect(request({ limit }).query.limit, String(limit)).toBe(6)
    expect(request({ order: { by: 'price', dir: 'asc' } }).query).toMatchObject({ sort: 'price', dir: 'asc' })
    // an order the type cannot sort by falls back to the type's own
    expect(request({ order: { by: 'gone', dir: 'asc' } }).query).toMatchObject({ sort: 'startsAt', dir: 'desc' })
    expect(request({}, { ...course, order: 'manual' }).query).toEqual({ limit: 6 })
    expect(request({}, noPages).query).toEqual({ limit: 6 })
  })

  it('reads at most 12 blocks in a card and 8 in a group', () => {
    const many = Array.from({ length: 20 }, (_, i) => heading({ id: `h${i}`, text: 'x' }))
    expect(plan(many).design).toHaveLength(12)
    const g = plan([group(many)]).design[0]!
    expect(g.type === 'group' && g.items).toHaveLength(8)
  })

  it('leaves out a group inside a group and an unknown block, and names a block with no id by its place', () => {
    const p = plan([{ type: 'video' }, null, 'x', heading({ id: undefined, text: 'a' }), { type: 'text', text: 'b' }, group([heading({ id: undefined, text: 'c' }), group([heading()]), { type: 'weird' }, button({ id: '' })], { id: undefined })])
    expect(p.design.map((d) => d.type)).toEqual(['heading', 'text', 'group'])
    expect(p.design.map((d) => d.id)).toEqual(['3', '4', '5'])
    const g = p.design[2]!
    expect(g.type === 'group' && g.items.map((i) => [i.type, i.id])).toEqual([['heading', '0'], ['button', '3']])
  })

  it('reads the blocks\' settings with their defaults', () => {
    const p = plan([heading({}), text({}), picture({}), button({}), group([], { arrangement: 'x', space: 'x' }), heading({ level: 'large', size: 'content' }), picture({ shape: 'square' }), text({ date: 'short', scale: 'small', before: ' a ', after: ' b ' }), group([], { arrangement: 'stack', space: 'small' })])
    expect(p.design[0]).toMatchObject({ type: 'heading', level: 'medium', size: 'fill', text: '' })
    expect(p.design[1]).toMatchObject({ type: 'text', date: 'long', scale: 'normal', before: '', after: '', size: 'fill' })
    expect(p.design[2]).toMatchObject({ type: 'picture', shape: 'landscape' })
    expect(p.design[3]).toMatchObject({ type: 'button', size: 'content', label: '' })
    expect(p.design[4]).toMatchObject({ type: 'group', arrangement: 'row', space: 'medium' })
    expect(p.design[5]).toMatchObject({ level: 'large', size: 'content' })
    expect(p.design[6]).toMatchObject({ shape: 'square' })
    expect(p.design[7]).toMatchObject({ date: 'short', scale: 'small', before: 'a', after: 'b' })
    expect(p.design[8]).toMatchObject({ arrangement: 'stack', space: 'small' })
  })

  it('names the classes of the list', () => {
    expect(cardListClasses(plan([]))).toEqual(['kit-cards', 'kit-cards-cards', 'kit-cards-cols-3', 'kit-cards-gap-medium', 'kit-cards-soft'])
    expect(cardListClasses(plan([], { arrangement: 'rows', columns: '2', space: 'small', surface: 'none' })))
      .toEqual(['kit-cards', 'kit-cards-rows', 'kit-cards-cols-2', 'kit-cards-gap-small', 'kit-cards-none'])
  })
})

describe('the values of a field', () => {
  const f = (key: string) => BY_KIND[key]!

  it('is a text trimmed, and a number as text', () => {
    expect(cardText('text', f('text'), '  Ahoj  ', 'cs')).toBe('Ahoj')
    expect(cardText('text', f('text'), 42, 'cs')).toBe('42')
    expect(cardText('text', f('text'), Number.NaN, 'cs')).toBe('')
    expect(cardText('text', f('text'), null, 'cs')).toBe('')
    expect(cardText('text', f('text'), {}, 'cs')).toBe('')
  })

  it('is a long text with its lines kept', () => {
    expect(cardText('longText', f('longText'), ' a\nb\n\nc ', 'cs')).toBe('a\nb\n\nc')
    expect(cardText('longText', f('longText'), 5, 'cs')).toBe('')
  })

  it('is a number in the site\'s way, its spaces unbreakable', () => {
    expect(cardText('number', f('number'), 2400, 'cs')).toBe(`2${NBSP}400`)
    expect(cardNumber(2400, 'cs')).toContain(NBSP)
    expect(cardNumber('2400', 'cs')).toBe(`2${NBSP}400`)
    expect(cardNumber(' 12 ', 'cs')).toBe('12')
    expect(cardNumber(1234.5, 'cs')).toBe(`1${NBSP}234,5`)
    expect(cardNumber(1234.5, 'en')).toBe('1,234.5')
    expect(cardNumber(0, 'cs')).toBe('0')
    for (const bad of [Number.NaN, Infinity, -Infinity, '', '  ', 'abc', {}, [], null, undefined, true]) expect(cardNumber(bad, 'cs'), String(bad)).toBe('')
  })

  it('is a date in three forms in the site\'s language', () => {
    const at = '2027-03-14T00:00:00Z'
    expect(cardDate(at, 'long', 'cs', true)).toBe('14. března 2027')
    expect(cardDate(at, 'short', 'cs', true)).toBe('14. 3. 2027')
    expect(cardDate(at, 'weekday', 'cs', true)).toBe('ne 14. 3.')
    expect(cardDate(at, 'long', 'en', true)).toBe('14 March 2027')
    expect(cardDate(at, 'short', 'en', true)).toBe('14/03/2027')
    expect(cardDate(at, 'long', 'de', true)).toBe('14. März 2027')
    expect(cardDate(at, 'short', 'de', true)).toBe('14.3.2027')
    expect(cardDate(at, 'weekday', 'de', true)).toMatch(/^So\.?,? 14\.3\.?$/)
    expect(cardDate(at, 'weekday', 'en', true)).toMatch(/Sun/)
  })

  it('leaves out the time for an all-day field and for midnight in Prague, else puts it after a comma', () => {
    expect(cardText('date', f('date'), '2027-03-14T10:00:00Z', 'cs', 'long')).toBe('14. března 2027, 11.00')
    expect(cardText('date', { ...f('date'), allDay: true }, '2027-03-14T10:00:00Z', 'cs')).toBe('14. března 2027')
    // 23:00 UTC is midnight of the next day in Prague (winter)
    expect(cardDate('2027-03-13T23:00:00Z', 'long', 'cs')).toBe('14. března 2027')
    expect(cardDate('2027-03-14T08:30:00Z', 'long', 'cs')).toBe('14. března 2027, 9.30')
    expect(cardDate('2027-03-14T08:30:00Z', 'short', 'cs')).toBe('14. 3. 2027, 9.30')
    expect(cardDate('2027-03-14T08:30:00Z', 'long', 'en')).toMatch(/^14 March 2027, 0?9[:.]30/)
    expect(cardDate('2027-03-14T08:30:00Z', 'long', 'de')).toMatch(/^14\. März 2027, 0?9[:.]30/)
    // summer time: 22:00 UTC is midnight in Prague
    expect(cardDate('2027-07-14T22:00:00Z', 'long', 'cs')).toBe('15. července 2027')
  })

  it('is empty for a date that is rubbish', () => {
    for (const bad of ['', '  ', 'not a date', 5, null, undefined, {}, Number.NaN]) expect(cardDate(bad, 'long', 'cs'), String(bad)).toBe('')
    expect(cardText('date', f('date'), 'rubbish', 'cs')).toBe('')
  })

  it('is a choice as its option\'s label in the site\'s language, empty for a value not among the options', () => {
    expect(cardText('choice', f('choice'), 'easy', 'cs')).toBe('Lehký')
    expect(cardText('choice', f('choice'), 'easy', 'en')).toBe('Easy')
    expect(cardText('choice', f('choice'), 'easy', 'de')).toBe('Leicht')
    expect(cardText('choice', f('choice'), 'hard', 'en')).toBe('Těžký')
    expect(cardText('choice', f('choice'), 'gone', 'cs')).toBe('')
    expect(cardText('choice', f('choice'), '', 'cs')).toBe('')
    expect(cardText('choice', f('choice'), 5, 'cs')).toBe('')
  })

  it('is empty for a kind that is not a text', () => {
    expect(cardText('picture', f('picture'), 'x', 'cs')).toBe('')
    expect(cardText('richText', f('richText'), 'x', 'cs')).toBe('')
  })

  it('is a rich text only with a letter or a picture in it', () => {
    const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content })
    const hello = { type: 'doc', content: [paragraph({ type: 'text', text: 'Ahoj' })] }
    expect(cardRich(hello)).toBe(hello)
    const withImage = { type: 'doc', content: [{ type: 'image', attrs: { src: '/a.jpg' } }] }
    expect(cardRich(withImage)).toBe(withImage)
    const nested = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [paragraph({ type: 'text', text: 'x' })] }] }] }
    expect(cardRich(nested)).toBe(nested)
    expect(cardRich({ type: 'doc', content: [] })).toBeNull()
    expect(cardRich({ type: 'doc' })).toBeNull()
    expect(cardRich({ type: 'doc', content: [paragraph({ type: 'text', text: '   ' }), paragraph()] })).toBeNull()
    for (const bad of [null, undefined, '', 'text', 5, [], {}, { content: [] }, { type: 5 }]) expect(cardRich(bad), String(bad)).toBeNull()
  })

  it('is a picture or a file only with an address', () => {
    const media = { url: '/a.jpg', alt: 'A' }
    expect(cardMedia(media)).toBe(media)
    for (const bad of [null, undefined, '', 'x', 5, [], {}, { url: '' }, { url: '  ' }, { url: 5 }]) expect(cardMedia(bad), String(bad)).toBeNull()
  })
})

describe('links', () => {
  it('keeps the site\'s own addresses and turns the home page into /', () => {
    expect(cardLinkOf('/kontakt')).toEqual({ href: '/kontakt', external: false })
    expect(cardLinkOf('/kurzy/tanec?x=1#a')).toEqual({ href: '/kurzy/tanec?x=1#a', external: false })
    expect(cardLinkOf('/home')).toEqual({ href: '/', external: false })
    expect(cardLinkOf('/home#x')).toEqual({ href: '/#x', external: false })
    expect(cardLinkOf('#x')).toEqual({ href: '#x', external: false })
  })

  it('keeps addresses elsewhere, mailto: and tel:, and makes www.example.cz an https address', () => {
    expect(cardLinkOf('https://example.cz/a')).toEqual({ href: 'https://example.cz/a', external: true })
    expect(cardLinkOf('http://example.cz')).toEqual({ href: 'http://example.cz', external: true })
    expect(cardLinkOf('//example.cz/a')).toEqual({ href: 'https://example.cz/a', external: true })
    expect(cardLinkOf('mailto:a@b.cz')).toEqual({ href: 'mailto:a@b.cz', external: true })
    expect(cardLinkOf('tel:+420123456789')).toEqual({ href: 'tel:+420123456789', external: true })
    expect(cardLinkOf('www.example.cz')).toEqual({ href: 'https://www.example.cz', external: true })
    expect(cardLinkOf('example.cz/a?b#c')).toEqual({ href: 'https://example.cz/a?b#c', external: true })
    expect(cardLinkOf('  /kontakt  ')).toEqual({ href: '/kontakt', external: false })
  })

  it('refuses what is not an address', () => {
    for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', 'some words here', '/with space', 'plainword', '', '  ', null, undefined, 5, {}, []]) {
      expect(cardLinkOf(bad), String(bad)).toBeNull()
    }
  })

  it('makes an e-mail address a mailto: link', () => {
    expect(cardMailto('jana@example.cz')).toEqual({ href: 'mailto:jana@example.cz', external: true })
    expect(cardMailto('  jana@example.cz ')).toEqual({ href: 'mailto:jana@example.cz', external: true })
    for (const bad of ['jana', 'jana@', '@example.cz', 'a b@c.cz', 'a@b', '', null, 5, {}]) expect(cardMailto(bad), String(bad)).toBeNull()
  })

  it('leads to an entry\'s page with the slug encoded, else nowhere', () => {
    expect(cardPageHref(course, { slug: 'tanec' })).toEqual({ href: '/kurzy/tanec', external: false })
    expect(cardPageHref(course, { slug: 'a b/č' })).toEqual({ href: `/kurzy/${encodeURIComponent('a b/č')}`, external: false })
    expect(cardPageHref(noPages, { slug: 'tanec' })).toBeNull()
    expect(cardPageHref(course, {})).toBeNull()
    expect(cardPageHref(course, { slug: '  ' })).toBeNull()
    expect(cardPageHref(course, { slug: 5 })).toBeNull()
    expect(cardPageHref(course, null as any)).toBeNull()
  })

  it('leads where a button\'s source says', () => {
    const source = (key: string) => {
      const s = cardSource('button', key, course, 'cs')
      if (s.from !== 'field' && s.from !== 'page') throw new Error(key)
      return s
    }
    expect(cardHref(source('site'), { site: '/kontakt' }, course)).toEqual({ href: '/kontakt', external: false })
    expect(cardHref(source('site'), { site: 'javascript:alert(1)' }, course)).toBeNull()
    expect(cardHref(source('mail'), { mail: 'a@b.cz' }, course)).toEqual({ href: 'mailto:a@b.cz', external: true })
    expect(cardHref(source('mail'), { mail: 'nope' }, course)).toBeNull()
    expect(cardHref(source('program'), { program: { url: '/media/p.pdf' } }, course)).toEqual({ href: '/media/p.pdf', external: true })
    expect(cardHref(source('program'), { program: { url: 'javascript:x' } }, course)).toBeNull()
    expect(cardHref(source('program'), { program: null }, course)).toBeNull()
    expect(cardHref(source('slug'), { slug: 'tanec' }, course)).toEqual({ href: '/kurzy/tanec', external: false })
    expect(cardHref(source('slug'), {}, course)).toBeNull()
    expect(cardHref({ from: 'own' }, entry(), course)).toBeNull()
    expect(cardHref({ from: 'missing', key: 'x', name: 'x' }, entry(), course)).toBeNull()
  })
})

describe('the cards of a list on the website', () => {
  it('has no cards for no entries, an empty card or rubbish entries', () => {
    expect(entries([heading({ field: 'name' })], [])).toEqual([])
    expect(entries([], [entry()])).toEqual([])
    expect(entries([heading({ field: 'name' })], [null, 'x', 5, [], undefined])).toEqual([])
    expect(cardEntries(plan([heading({ field: 'name' })]), 'x' as any, { lang: 'cs' })).toEqual([])
    const cards = entries([heading({ field: 'name' })], [null, entry(), 'x', [1]])
    expect(cards).toHaveLength(1)
  })

  it('fills a card from each entry, in the entries\' order', () => {
    const cards = entries([heading({ field: 'name' }), text({ field: 'price', before: 'od ', after: ' Kč' })], [entry({ id: 'a', name: 'A' }), entry({ id: 'b', name: 'B' })])
    expect(cards.map((c) => c.id)).toEqual(['a', 'b'])
    expect(cards[0]).toMatchObject({ collection: 'custom_course', rest: 2, items: [{ type: 'heading', shown: 'A' }, { type: 'text', shown: `2${NBSP}400`, before: 'od', after: 'Kč', doc: null }] })
  })

  it('names an entry with no id by its place', () => {
    const cards = entries([heading({ field: 'name' })], [{ name: 'A' }, { name: 'B' }])
    expect(cards.map((c) => c.id)).toEqual(['0', '1'])
  })

  it('leaves a block out of the card of an entry that has nothing for it', () => {
    const cards = entries([heading({ field: 'name' }), text({ field: 'about' }), picture({ field: 'cover' })], [entry(), entry({ id: 'e2', about: '  ', cover: null }), entry({ id: 'e3', about: undefined })])
    expect(cards.map((c) => c.items.map((i) => i.type))).toEqual([['heading', 'text', 'picture'], ['heading'], ['heading', 'picture']])
    for (const empty of ['', '  ', null, undefined, {}, [], Number.NaN]) {
      const c = entries([text({ field: 'about' })], [entry({ about: empty })])
      expect(c, String(empty)).toEqual([])
    }
  })

  it('leaves a group with nothing left out, and a card with nothing left out', () => {
    const design = [group([text({ field: 'about' }), button({ field: 'site', label: 'Více' })]), heading({ field: 'name' })]
    const cards = entries(design, [entry({ about: '', site: '' }), entry({ id: 'e2', about: '', site: '/kontakt' })])
    expect(cards[0]!.items.map((i) => i.type)).toEqual(['heading'])
    const g = cards[1]!.items[0]!
    expect(g.type === 'group' && g.items.map((i) => i.type)).toEqual(['button'])
    expect(entries([group([text({ field: 'about' })])], [entry({ about: '' })])).toEqual([])
    expect(entries([heading({ field: 'name' })], [entry({ name: '' }), entry({ name: '  ' })])).toEqual([])
  })

  it('leaves out a block with no field and no text, a missing or unfit field, a button without its text, and a picture or a button with no field', () => {
    const design = [
      heading({ id: 'ok', field: 'name' }), heading({ id: 'a' }), text({ id: 'b' }), heading({ id: 'c', field: 'gone', text: 'own' }), text({ id: 'd', field: 'cover' }),
      picture({ id: 'e' }), picture({ id: 'f', field: 'price' }), picture({ id: 'g', field: 'gone' }),
      button({ id: 'h' }), button({ id: 'i', label: 'Více' }), button({ id: 'j', field: 'site' }), button({ id: 'k', field: 'price', label: 'x' }), button({ id: 'l', field: 'gone', label: 'x' }),
    ]
    const cards = entries(design, [entry()])
    expect(cards[0]!.items.map((i) => i.id)).toEqual(['ok'])
    expect(entries(design, [entry()]).every((c) => c.items.every((i) => !('state' in i && i.state)))).toBe(true)
  })

  it('draws the own text of a heading and a text on every card, and the bound ones without `text`', () => {
    const design = [heading({ id: 'a', text: ' Zápis ' }), text({ id: 'b', text: 'Řádek 1\nŘádek 2' }), heading({ id: 'c', field: 'name', text: 'ignored' }), text({ id: 'd', field: 'about', text: 'ignored' })]
    const cards = entries(design, [entry(), entry({ id: 'e2', name: '', about: '' })])
    expect(cards[0]!.items).toMatchObject([
      { id: 'a', type: 'heading', shown: 'Zápis', text: 'Zápis' },
      { id: 'b', type: 'text', shown: 'Řádek 1\nŘádek 2', text: 'Řádek 1\nŘádek 2', before: '', after: '', doc: null },
      { id: 'c', type: 'heading', shown: 'Tanec' },
      { id: 'd', type: 'text', shown: 'Řádek 1\nŘádek 2' },
    ])
    expect(cards[0]!.items[2]).not.toHaveProperty('text')
    expect(cards[0]!.items[3]).not.toHaveProperty('text')
    expect(cards[1]!.items.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('fills a text from a rich text, and leaves it out for an empty one', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ahoj' }] }] }
    const cards = entries([text({ field: 'notes' })], [entry({ notes: doc }), entry({ id: 'e2', notes: { type: 'doc', content: [] } })])
    expect(cards).toHaveLength(1)
    expect(cards[0]!.items[0]).toMatchObject({ type: 'text', shown: '', doc })
  })

  it('keeps before and after only for a text bound to a number', () => {
    const cards = entries([text({ id: 'n', field: 'price', before: 'od ', after: ' Kč' }), text({ id: 'o', field: 'about', before: 'a ', after: ' b' }), text({ id: 'p', before: 'a ', after: ' b', text: 'vlastní' }), text({ id: 'q', field: 'level', before: 'a', after: 'b' }), text({ id: 'd', field: 'startsAt', before: 'a', after: 'b' })], [entry()])
    const by = Object.fromEntries(cards[0]!.items.map((i) => [i.id, i]))
    expect(by.n).toMatchObject({ before: 'od', after: 'Kč' })
    for (const id of ['o', 'p', 'q', 'd']) expect(by[id], id).toMatchObject({ before: '', after: '' })
  })

  it('reads a date in the form the text names', () => {
    const items = (date: string) => entries([text({ field: 'startsAt', date })], [entry({ startsAt: '2027-03-14T08:30:00Z' })])[0]!.items[0]
    expect(items('long')).toMatchObject({ shown: '14. března 2027, 9.30' })
    expect(items('short')).toMatchObject({ shown: '14. 3. 2027, 9.30' })
    expect(entries([text({ field: 'day', date: 'weekday' })], [entry({ day: '2027-03-14T10:00:00Z' })])[0]!.items[0]).toMatchObject({ shown: 'ne 14. 3.' })
    expect(entries([heading({ field: 'day' })], [entry({ day: '2027-03-14T10:00:00Z' })], { lang: 'en' })[0]!.items[0]).toMatchObject({ shown: '14 March 2027' })
  })

  it('fills a picture with its ratio, a button with where it leads', () => {
    const cards = entries([picture({ field: 'cover', shape: 'square' }), picture({ id: 'o', field: 'cover', shape: 'original' }), button({ id: 'b1', field: 'slug', label: 'Více' }), button({ id: 'b2', field: 'program', label: 'PDF' }), button({ id: 'b3', field: 'site', label: 'Web' })], [entry()])
    expect(cards[0]!.items).toMatchObject([
      { type: 'picture', image: { url: '/media/a.jpg' }, shape: 'square', ratio: '1 / 1' },
      { id: 'o', type: 'picture', ratio: '800 / 600' },
      { id: 'b1', type: 'button', label: 'Více', href: '/kurzy/tanec', external: false },
      { id: 'b2', type: 'button', href: '/media/p.pdf', external: true },
      { id: 'b3', type: 'button', href: '/kontakt', external: false },
    ])
    const o = entries([picture({ field: 'cover', shape: 'original' })], [entry({ cover: { url: '/x.jpg' } })])[0]!.items[0]
    expect(o).toMatchObject({ ratio: null })
  })

  it('gives the first picture at the first level the side, and only one', () => {
    const cards = entries([group([picture({ id: 'in', field: 'cover' })]), heading({ field: 'name' }), picture({ id: 'p1', field: 'cover' }), picture({ id: 'p2', field: 'cover' }), text({ field: 'about' })], [entry()])
    const items = cards[0]!.items
    const sides = items.filter((i) => i.type === 'picture' && i.side)
    expect(sides.map((i) => i.id)).toEqual(['p1'])
    const g = items[0]!
    expect(g.type === 'group' && g.items[0]).not.toHaveProperty('side')
    // 5 blocks at the first level, less the side picture
    expect(cards[0]!.rest).toBe(4)
  })

  it('counts rest as at least 1, and without a side picture as all the blocks', () => {
    expect(entries([picture({ field: 'cover' })], [entry()])[0]!.rest).toBe(1)
    expect(entries([heading({ field: 'name' }), text({ field: 'about' })], [entry()])[0]!.rest).toBe(2)
  })

  it('draws a type without pages, with no slug for a button', () => {
    const p = cardListPlan({ source: { type: 'custom_note' }, items: [heading({ field: 'name' }), button({ field: 'slug', label: 'x' })] }, types, 'cs')
    if (!p.ok) throw new Error(p.reason)
    expect(cardEntries(p, [entry()], { lang: 'cs' })[0]!.items.map((i) => i.type)).toEqual(['heading'])
  })
})

describe('the cards of a list while editing', () => {
  const ed = (items: unknown[], list: unknown[], lang = 'cs') => entries(items, list, { editing: true, lang })

  it('keeps a placeholder for a block that shows nothing by its design, on every card', () => {
    const design = [heading({ id: 'a' }), picture({ id: 'b' }), button({ id: 'c' }), text({ id: 'd', field: 'gone' }), picture({ id: 'e', field: 'price' }), button({ id: 'f', field: 'site' }), heading({ id: 'g', field: 'name' })]
    const cards = ed(design, [entry(), entry({ id: 'e2' })])
    expect(cards).toHaveLength(2)
    for (const c of cards) {
      expect(c.items.map((i) => [i.id, i.type, i.state])).toEqual([
        ['a', 'heading', 'unbound'], ['b', 'picture', 'unbound'], ['c', 'button', 'unbound'], ['d', 'text', 'missing'], ['e', 'picture', 'unfit'], ['f', 'button', 'label'], ['g', 'heading', undefined],
      ])
    }
    const by = Object.fromEntries(cards[0]!.items.map((i) => [i.id, i]))
    expect(by.d).toMatchObject({ name: 'gone', shown: '' })
    expect(by.e).toMatchObject({ name: 'Cena', image: null })
    expect(by.a).not.toHaveProperty('name')
    expect(by.f).toMatchObject({ label: '', href: '' })
  })

  it('names the field of a block whose kind does not fit, in the site\'s language', () => {
    const cards = ed([picture({ field: 'price' }), heading({ id: 'x', field: 'cover' })], [entry()], 'de')
    expect(cards[0]!.items).toMatchObject([{ state: 'unfit', name: 'Preis' }, { state: 'unfit', name: 'Titelbild' }])
  })

  it('leaves out an empty value even while editing: that is no placeholder', () => {
    const cards = ed([heading({ id: 'a', field: 'name' }), text({ id: 'b', field: 'about' }), picture({ id: 'c', field: 'cover' }), button({ id: 'd', field: 'site', label: 'Více' })], [entry({ about: '', cover: null, site: 'nonsense words' })])
    expect(cards[0]!.items.map((i) => i.id)).toEqual(['a'])
  })

  it('keeps a group with no blocks as empty, and leaves out a group whose blocks are all empty for the entry', () => {
    const cards = ed([group([], { id: 'none' }), group([text({ field: 'about' })], { id: 'all-empty' }), group([text({ field: 'about' }), heading({ field: 'name' })], { id: 'some' })], [entry({ about: '' })])
    expect(cards[0]!.items.map((i) => i.id)).toEqual(['none', 'some'])
    expect(cards[0]!.items[0]).toMatchObject({ type: 'group', empty: true, items: [] })
    const some = cards[0]!.items[1]!
    expect(some).not.toHaveProperty('empty')
    expect(some.type === 'group' && some.items.map((i) => i.type)).toEqual(['heading'])
  })

  it('keeps the placeholders of a group\'s blocks', () => {
    const cards = ed([group([heading({ id: 'x' })], { id: 'g' })], [entry()])
    const g = cards[0]!.items[0]!
    expect(g.type === 'group' && g.items).toMatchObject([{ id: 'x', state: 'unbound' }])
    expect(g).not.toHaveProperty('empty')
  })

  it('gives one empty card for a card with no blocks', () => {
    for (const list of [[entry()], []]) {
      const cards = ed([], list)
      expect(cards).toEqual([{ id: '', collection: 'custom_course', items: [], rest: 1, empty: true }])
    }
  })

  it('gives one sample card naming the fields for a type with no entries', () => {
    const design = [heading({ id: 'h', field: 'name' }), text({ id: 't', field: 'price', before: 'od ', after: ' Kč' }), text({ id: 't2', field: 'about' }), picture({ id: 'p', field: 'cover', shape: 'square' }), button({ id: 'b', field: 'slug', label: 'Více' }), heading({ id: 'o', text: 'Vlastní' }), picture({ id: 'u' })]
    for (const list of [[], [null, 'x']]) {
      const cards = ed(design, list)
      expect(cards).toHaveLength(1)
      expect(cards[0]).toMatchObject({ id: '', collection: 'custom_course', sample: true })
      const by = Object.fromEntries(cards[0]!.items.map((i) => [i.id, i]))
      expect(by.h).toMatchObject({ type: 'heading', shown: 'Název', sample: true, name: 'Název' })
      expect(by.t).toMatchObject({ type: 'text', shown: 'Cena', sample: true, name: 'Cena', before: 'od', after: 'Kč' })
      expect(by.t2).toMatchObject({ shown: 'o kurzu'.replace('o', 'O'), sample: true, before: '', after: '' })
      expect(by.p).toMatchObject({ type: 'picture', image: null, name: 'Titulní obrázek', sample: true, ratio: '1 / 1' })
      expect(by.b).toMatchObject({ type: 'button', label: 'Více', href: '', sample: true, name: 'Kurz' })
      expect(by.o).toMatchObject({ shown: 'Vlastní', text: 'Vlastní' })
      expect(by.o).not.toHaveProperty('sample')
      expect(by.u).toMatchObject({ state: 'unbound' })
    }
    expect(ed(design, [], 'en')[0]!.items[0]).toMatchObject({ shown: 'Name' })
  })

  it('gives no sample card when entries exist but every card is empty', () => {
    expect(ed([text({ field: 'about' })], [entry({ about: '' }), entry({ about: '' })])).toEqual([])
  })

  it('draws nothing but the empty card on the website for the same designs', () => {
    expect(entries([heading({ field: 'name' })], [])).toEqual([])
    expect(cardItems([], entry(), { type: course, lang: 'cs', editing: false, sample: false })).toEqual([])
  })
})

describe('drawing never fails', () => {
  const rubbish: unknown[] = [null, undefined, 0, 5, Number.NaN, '', 'x', true, [], [null], {}, { a: 1 }, () => 1]

  it('reads a block of any shape', () => {
    for (const block of rubbish) for (const ts of [types, null, undefined, [], 'x' as any, [null] as any]) {
      expect(() => cardListPlan(block, ts, 'cs')).not.toThrow()
      expect(() => cardListPlan({ source: { type: 'custom_course' }, items: block, columns: block, arrangement: block, space: block, surface: block, heading: block, text: block }, ts, 'cs')).not.toThrow()
    }
  })

  it('reads blocks of any shape and a type without fields', () => {
    const bare = { ...course, fields: [] as CustomTypeField[] }
    const items = [...rubbish.flatMap((r) => [r, heading({ field: r, text: r, level: r, size: r }), text({ field: r, text: r, before: r, after: r, date: r, scale: r }), picture({ field: r, shape: r }), button({ field: r, label: r }), group(r as any, { arrangement: r, space: r }), group([r, heading({ field: r })])])]
    for (const t of [bare, course, noPages]) {
      const p = cardListPlan({ source: { type: t.name }, items }, [t], 'cs')
      expect(p.ok).toBe(true)
      if (p.ok) for (const editing of [false, true]) expect(() => cardEntries(p, [entry(), ...rubbish], { lang: 'cs', editing })).not.toThrow()
    }
  })

  it('fills a card from entries with the wrong type for every field', () => {
    const everyField = course.fields.map((f) => f.key).concat('slug', 'id', 'gone')
    const design = everyField.flatMap((key) => [heading({ id: `h${key}`, field: key }), text({ id: `t${key}`, field: key, before: 'a', after: 'b' }), picture({ id: `p${key}`, field: key }), button({ id: `b${key}`, field: key, label: 'x' })])
    const p = cardListPlan({ source: { type: 'custom_course' }, items: [group(design.slice(0, 8)), ...design.slice(8, 11)] }, types, 'cs') as Extract<CardListPlan, { ok: true }>
    for (const wrong of rubbish) {
      const e = Object.fromEntries(everyField.map((k) => [k, wrong]))
      for (const editing of [false, true]) {
        expect(() => cardEntries(p, [e], { lang: 'cs', editing })).not.toThrow()
        expect(() => cardEntries(p, [e], { lang: 'xx', editing })).not.toThrow()
      }
    }
    const all = cardListPlan({ source: { type: 'custom_course' }, items: design.slice(0, 12) }, types, 'cs') as Extract<CardListPlan, { ok: true }>
    for (const wrong of rubbish) expect(() => cardEntries(all, [Object.fromEntries(everyField.map((k) => [k, wrong]))], { lang: 'cs', editing: true })).not.toThrow()
  })

  it('reads labels and options that are rubbish', () => {
    const odd: CustomType = {
      ...course, labelSingular: null, label: null as any,
      fields: [field('a', 'select', { label: null as any, options: [{ value: 'x', label: null as any }] }), field('b', 'select', { options: undefined }), field('c', 'number', { label: {} })],
    }
    const p = cardListPlan({ source: { type: odd.name }, items: [heading({ field: 'a' }), heading({ field: 'b' }), text({ field: 'c' }), button({ field: 'slug', label: 'x' })] }, [odd], 'cs')
    expect(p.ok).toBe(true)
    if (p.ok) for (const editing of [false, true]) expect(() => cardEntries(p, [{ a: 'x', b: 'y', c: 1, slug: 's' }, {}], { lang: 'cs', editing })).not.toThrow()
    expect(() => cardSource('button', 'slug', odd, 'cs')).not.toThrow()
  })
})
