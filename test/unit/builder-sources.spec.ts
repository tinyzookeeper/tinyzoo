import { describe, expect, it } from 'vitest'
import { isCmsBuilderToAdmin, isCmsBuilderToPage } from '../../packages/cms/shared/builder'
import type { CmsMatchField, CmsMatchNode } from '../../packages/cms/shared/builder-match'
import {
  cmsBuilderEntities, cmsBuilderEntryAddress, cmsContentEntries, cmsContentRequest, cmsContentWithPreview, cmsSourceCardAt, cmsSourceFields, cmsSourceFind,
  cmsSourcePartAt, cmsSourcePictureOf, cmsSourcesOf, cmsSourceState, cmsSourceTitle, cmsSourceWithRelated, cmsTextRest, cmsTextsReport, isCmsEmbedMessage,
  type CmsBuilderEntity, type CmsSourceRecord,
} from '../../packages/cms/shared/builder-sources'

// Part 2f of the builder: content a block draws from elsewhere. The content API's requests and answers as
// the page keeps them, an entry's title and state, the texts of entries as the matcher reads them, finding
// an entry's texts and its card in a block (a text two entries share, a text of the block itself, a list
// drawn as a table, a picture), the sources of a block, what the texts of a block resolve to, the messages,
// and what the admin tells the page about its collections and globals.

/** A tiny DOM with parents: text, elements with children and attributes. */
type N = CmsMatchNode & { name: string }
const t = (value: string): N => ({ nodeType: 3, nodeName: '#text', name: '#text', nodeValue: value, childNodes: [], parentNode: null })
function e(name: string, children: N[] = [], attrs: Record<string, string> = {}): N {
  const el: N = { nodeType: 1, nodeName: name.toUpperCase(), name, nodeValue: null, childNodes: children, parentNode: null, getAttribute: (n) => attrs[n] ?? null }
  for (const c of children) c.parentNode = el
  return el
}

const ORIGIN = 'https://web.example'
const notice: CmsBuilderEntity = {
  label: 'Oznámení', title: 'title', publish: { field: 'status', published: 'published', date: 'publishedAt' },
  fields: { title: { kind: 'text', label: 'Nadpis' }, text: { kind: 'text', label: 'Text' }, photo: { kind: 'picture' } }, edit: true, create: true,
}
const settings: CmsBuilderEntity = { label: 'Nastavení webu', global: true, fields: { phone: { kind: 'text' }, town: { kind: 'text' } }, edit: true }
const entities = { notice, siteSettings: settings }
const record = (entity: string, global: boolean, entries: Record<string, Record<string, unknown>>): CmsSourceRecord => ({ entity, global, entries: new Map(Object.entries(entries)) })
const notices = record('notice', false, {
  n1: { id: 'n1', title: 'Dovolená od 21. do 31. prosince', text: 'Mezi svátky neordinujeme.', status: 'published' },
  n2: { id: 'n2', title: 'Očkujeme proti chřipce', text: 'Vakcíny máme skladem.', status: 'published' },
  n3: { id: 'n3', title: 'Ve středu jen do 11:00', text: 'Vakcíny máme skladem.', status: 'published' },
})
const site = record('siteSettings', true, { s1: { id: 's1', phone: '123 456 703', town: 'Jičín' } })
const own: CmsMatchField[] = [{ field: 'heading', item: null, list: null, kind: 'text', norm: 'Aktuálně z ordinace', text: 'line' }]

describe('the content API as the page keeps it', () => {
  it('tells a collection, an entry and a global from the address, and leaves out the API\'s own routes and other sites', () => {
    expect(cmsContentRequest('/api/content/notice?limit=100', ORIGIN)).toEqual({ entity: 'notice', global: false })
    expect(cmsContentRequest('/api/content/page/home?preview', ORIGIN)).toEqual({ entity: 'page', global: false })
    expect(cmsContentRequest(`${ORIGIN}/api/content/_global/siteSettings`, ORIGIN)).toEqual({ entity: 'siteSettings', global: true })
    expect(cmsContentRequest('/base/api/content/notice', ORIGIN)).toEqual({ entity: 'notice', global: false })
    for (const url of ['/api/content/_search?q=x', '/api/content/_sitemap', '/api/content/_tree/page', '/api/content/_types', '/api/cms/notice', 'https://other.example/api/content/notice', '/api/content/a/b/c', '/api/content/_global/'])
      expect(cmsContentRequest(url, ORIGIN), url).toBeNull()
  })

  it('asks for the editor\'s preview, keeping the address as it was written', () => {
    expect(cmsContentWithPreview('/api/content/notice?limit=100', ORIGIN)).toBe('/api/content/notice?limit=100&preview')
    expect(cmsContentWithPreview('/api/content/notice', ORIGIN)).toBe('/api/content/notice?preview')
    expect(cmsContentWithPreview(`${ORIGIN}/api/content/_global/siteSettings`, ORIGIN)).toBe(`${ORIGIN}/api/content/_global/siteSettings?preview`)
    expect(cmsContentWithPreview('/api/content/page/home?preview', ORIGIN)).toBe('/api/content/page/home?preview')
  })

  it('reads the entries of a list, an entry and a global', () => {
    expect(cmsContentEntries({ items: [{ id: 'a' }, 'x', { id: 'b' }], total: 2 })).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(cmsContentEntries({ item: { id: 'a' } })).toEqual([{ id: 'a' }])
    expect(cmsContentEntries({ item: null })).toEqual([])
    expect(cmsContentEntries('nope')).toEqual([])
  })
})

describe('an entry\'s title and state', () => {
  it('takes the title field, else the word for an entry without one; a global is its name', () => {
    expect(cmsSourceTitle({ title: 'Péče o *vaše zdraví*' }, notice, 'Bez názvu')).toBe('Péče o vaše zdraví')
    expect(cmsSourceTitle({ title: '' }, notice, 'Bez názvu')).toBe('Bez názvu')
    expect(cmsSourceTitle({ phone: '1' }, settings, 'Bez názvu')).toBe('Nastavení webu')
  })

  it('says a draft and a date ahead, and nothing for what is live or unknown', () => {
    const now = Date.parse('2026-11-26T10:00:00Z')
    expect(cmsSourceState({ status: 'draft' }, notice, now)).toBe('draft')
    expect(cmsSourceState({ status: 'published', publishedAt: '2026-12-01T00:00:00Z' }, notice, now)).toBe('scheduled')
    expect(cmsSourceState({ status: 'published', publishedAt: '2026-11-01T00:00:00Z' }, notice, now)).toBeNull()
    expect(cmsSourceState({ title: 'x' }, notice, now)).toBeNull()
  })
})

describe('the texts of entries', () => {
  it('are fields of items of a list named after their collection; the page being edited and what the admin does not describe are left out', () => {
    const pages = record('page', false, { p1: { id: 'p1', title: 'Domů' }, p2: { id: 'p2', title: 'Ceník' } })
    const all = { ...entities, page: { label: 'Stránky', title: 'title', fields: { title: { kind: 'text' as const } } } }
    const { texts, pictures } = cmsSourceFields([notices, site, pages, record('unknown', false, { u: { id: 'u', title: 'Nic' } })], all, { entity: 'page', id: 'p1' })
    expect(texts.find((f) => f.norm === 'Očkujeme proti chřipce')).toMatchObject({ field: 'title', item: 'n2', list: 'notice', kind: 'text' })
    expect(texts.find((f) => f.norm === 'Jičín')).toMatchObject({ field: 'town', item: 's1', list: 'siteSettings' })
    expect(texts.some((f) => f.norm === 'Domů')).toBe(false)
    expect(texts.some((f) => f.norm === 'Ceník')).toBe(true)
    expect(texts.some((f) => f.norm === 'Nic')).toBe(false)
    expect(pictures).toEqual([])
  })

  it('takes an entry the content API put inside another through a relation for an entry of its own collection', () => {
    const all = {
      lesson: { label: 'Lekce', title: 'name', fields: { name: { kind: 'text' as const }, instructor: { kind: 'relation' as const, to: 'instructor' } } },
      instructor: { label: 'Lektoři', title: 'name', fields: { name: { kind: 'text' as const } } },
    }
    const lessons = record('lesson', false, {
      l1: { id: 'l1', name: 'Jóga', instructor: { id: 'i1', name: 'Marta' } },
      l2: { id: 'l2', name: 'Pilates', instructor: { id: 'i1', name: 'Marta' } },
      l3: { id: 'l3', name: 'Tanec', instructor: { id: 'i2', name: 'Klára' } },
    })
    const own = record('instructor', false, { i2: { id: 'i2', name: 'Klára Nová' } })
    const out = cmsSourceWithRelated(new Map([['lesson', lessons], ['instructor', own]]), all)
    expect([...out.get('instructor')!.entries.keys()].sort()).toEqual(['i1', 'i2'])
    // An entry loaded on its own keeps its own values.
    expect(out.get('instructor')!.entries.get('i2')).toMatchObject({ name: 'Klára Nová' })
    const texts = cmsSourceFields(out.values(), all).texts
    expect(texts.filter((f) => f.norm === 'Marta')).toEqual([expect.objectContaining({ list: 'instructor', item: 'i1' })])
    // In a lesson's card, the teacher's name is the teacher's; the lesson keeps its card.
    const m1 = e('span', [t('Marta')])
    const card1 = e('li', [e('b', [t('Jóga')]), m1])
    const card2 = e('li', [e('b', [t('Pilates')]), e('span', [t('Marta')])])
    const root = e('section', [e('ul', [card1, card2])])
    const found = cmsSourceFind([root], texts, { related: (parent, child) => parent === 'lesson' && child === 'instructor' })
    expect(found.parts.get(m1)).toMatchObject({ entity: 'instructor', id: 'i1' })
    expect(found.cards.find((c) => c.id === 'l1')!.els).toEqual([card1])
    expect(cmsSourceCardAt(found, m1)).toMatchObject({ entity: 'instructor', id: 'i1' })
    expect(cmsSourceCardAt(found, m1)!.els).toHaveLength(2)
  })

  it('finds an entry\'s picture by its address, also a smaller copy by its id, and not one two entries share', () => {
    const team = record('notice', false, { a: { id: 'a', photo: { id: 'm1', url: '/media/m1/anna.jpg' } }, b: { id: 'b', photo: [{ id: 'm2', url: '/media/m2/ben.jpg' }] } })
    const { pictures } = cmsSourceFields([team], entities)
    expect(cmsSourcePictureOf([`${ORIGIN}/media/m1/anna.jpg?w=10`], pictures)).toMatchObject({ id: 'a', field: 'photo' })
    expect(cmsSourcePictureOf(['/_ipx/w_400/media/m2/x.webp'], pictures)).toMatchObject({ id: 'b' })
    expect(cmsSourcePictureOf(['/other.jpg'], pictures)).toBeNull()
    const both = record('notice', false, { a: { id: 'a', photo: { id: 'm1', url: '/same.jpg' } }, b: { id: 'b', photo: { id: 'm9', url: '/same.jpg' } } })
    expect(cmsSourcePictureOf(['/same.jpg'], cmsSourceFields([both], entities).pictures)).toBeNull()
  })
})

/** Čekárna's notices block: its own heading, the important notice large, the others beside it with a date line. */
function noticesBlock() {
  const h2 = e('h2', [t('Aktuálně z ordinace')])
  const mainTitle = e('h3', [t('Dovolená od 21. do 31. prosince')])
  const main = e('article', [e('p', [e('span', [], { 'aria-hidden': 'true' }), t('Důležité')]), mainTitle, e('p', [t('Mezi svátky neordinujeme.')])])
  const restA = e('article', [e('p', [t('od 1. 10. do vyčerpání')]), e('h3', [t('Očkujeme proti chřipce')]), e('p', [t('Vakcíny máme skladem.')])])
  const restB = e('article', [e('p', [t('středa 2. 12. 2026')]), e('h3', [t('Ve středu jen do 11:00')]), e('p', [t('Vakcíny máme skladem.')])])
  const root = e('section', [h2, e('div', [main, e('div', [restA, restB])])])
  return { root, h2, main, mainTitle, restA, restB }
}

describe('finding entries in a block', () => {
  const { texts } = cmsSourceFields([notices, site], entities)

  it('finds each entry\'s texts and its card; the block\'s own heading stays the block\'s', () => {
    const b = noticesBlock()
    const found = cmsSourceFind([b.root], texts, { own })
    expect(found.cards.map((c) => [c.id, c.els])).toEqual([['n1', [b.main]], ['n2', [b.restA]], ['n3', [b.restB]]])
    expect(found.own).toEqual([b.h2])
    expect(cmsSourcePartAt(found, b.mainTitle.childNodes[0] as N)).toMatchObject({ el: b.mainTitle, part: { entity: 'notice', id: 'n1', field: 'title' } })
    // A computed text (the date line) is in the card, and no part.
    const date = b.restA.childNodes[0] as N
    expect(cmsSourcePartAt(found, date)).toBeNull()
    expect(cmsSourceCardAt(found, date)?.id).toBe('n2')
    expect(cmsSourceCardAt(found, b.h2)).toBeNull()
  })

  it('gives a text two entries share to the entry whose other texts stand around it', () => {
    const b = noticesBlock()
    const found = cmsSourceFind([b.root], texts, { own })
    const sharedA = b.restA.childNodes[2] as N
    const sharedB = b.restB.childNodes[2] as N
    expect(found.parts.get(sharedA)).toMatchObject({ id: 'n2', field: 'text' })
    expect(found.parts.get(sharedB)).toMatchObject({ id: 'n3', field: 'text' })
  })

  it('gives a text two collections share to the one the block loads itself, when nothing around it tells', () => {
    const hours = record('openingHour', false, { h1: { id: 'h1', label: 'Odběry krve' } })
    const services = record('service', false, { s1: { id: 's1', title: 'Odběry krve' } })
    const all = { ...entities, openingHour: { label: 'Ordinační hodiny', fields: { label: { kind: 'text' as const } } }, service: { label: 'Služby', title: 'title', fields: { title: { kind: 'text' as const } } } }
    const span = e('span', [t('Odběry krve')])
    const root = e('section', [e('p', [t('7:00–8:00 '), span])])
    const tx = cmsSourceFields([hours, services], all).texts
    expect(cmsSourceFind([root], tx).parts.get(span)).toBeUndefined()
    expect(cmsSourceFind([root], tx, { prefer: new Set(['openingHour']) }).parts.get(span)).toMatchObject({ entity: 'openingHour', id: 'h1' })
  })

  it('never takes a text of the block itself for an entry\'s, nor a text a site marks for the block', () => {
    const same = record('notice', false, { x: { id: 'x', title: 'Aktuálně z ordinace' } })
    const b = noticesBlock()
    expect(cmsSourceFind([b.root], cmsSourceFields([same], entities).texts, { own }).cards).toEqual([])
    const marked = e('section', [e('h2', [t('Dovolená od 21. do 31. prosince')], { 'data-cms-field': 'heading' })])
    expect(cmsSourceFind([marked], texts).cards).toEqual([])
  })

  it('takes a card up through wrappers that hold nothing else', () => {
    const article = e('article', [e('h3', [t('Očkujeme proti chřipce')]), e('p', [t('Vakcíny máme skladem.')])])
    const link = e('a', [article])
    const li = e('li', [link])
    const other = e('li', [e('a', [e('article', [e('h3', [t('Ve středu jen do 11:00')])])])])
    const root = e('section', [e('ul', [li, other])])
    const found = cmsSourceFind([root], texts)
    expect(found.cards.find((c) => c.id === 'n2')!.els).toEqual([li])
  })

  it('takes the whole card when only one of its texts is found (a text the look splits into paragraphs)', () => {
    const title = e('h3', [t('Dovolená od 21. do 31. prosince')])
    const main = e('article', [e('p', [t('Důležité')]), title, e('p', [t('Mezi svátky')]), e('p', [t('neordinujeme.')])])
    const rest = e('article', [e('h3', [t('Očkujeme proti chřipce')])])
    const root = e('section', [e('h2', [t('Aktuálně z ordinace')]), e('div', [main, e('div', [rest])])])
    const found = cmsSourceFind([root], texts, { own })
    expect(found.cards.find((c) => c.id === 'n1')!.els).toEqual([main])
  })

  it('makes pieces of a card whose texts stand among another entry\'s (a list drawn as a table)', () => {
    const dt1 = e('dt', [t('Očkujeme proti chřipce')])
    const dd1 = e('dd', [t('Mezi svátky neordinujeme.')])
    const dt2 = e('dt', [t('Ve středu jen do 11:00')])
    const root = e('section', [e('dl', [dt1, dd1, dt2])])
    const two = record('notice', false, { n2: { id: 'n2', title: 'Očkujeme proti chřipce', text: 'Mezi svátky neordinujeme.' }, n3: { id: 'n3', title: 'Ve středu jen do 11:00' } })
    const found = cmsSourceFind([root], cmsSourceFields([two], entities).texts)
    expect(found.cards.find((c) => c.id === 'n2')!.els).toEqual([dt1, dd1])
    expect(found.cards.find((c) => c.id === 'n3')!.els).toEqual([dt2])
  })

  it('finds a global\'s values, and an entry\'s picture', () => {
    const phone = e('a', [t('123 456 703')])
    const img = e('img', [], { src: '/media/m1/anna.jpg' })
    const root = e('section', [e('p', [t('Telefon: '), phone]), e('figure', [img])])
    const team = record('notice', false, { a: { id: 'a', photo: { id: 'm1', url: '/media/m1/anna.jpg' } } })
    const { texts: tx, pictures } = cmsSourceFields([site, team], entities)
    const found = cmsSourceFind([root], tx, { picture: (n) => cmsSourcePictureOf([n.getAttribute?.('src') ?? ''], pictures) })
    expect(found.parts.get(phone)).toMatchObject({ entity: 'siteSettings', field: 'phone' })
    expect(found.parts.get(img)).toMatchObject({ entity: 'notice', id: 'a', kind: 'picture' })
  })

  it('leaves out a block inside the block and what is switched off', () => {
    const inner = e('div', [e('h3', [t('Očkujeme proti chřipce')])], { 'data-cms-block': 'b2' })
    const off = e('div', [e('h3', [t('Ve středu jen do 11:00')])], { 'data-cms-field': 'off' })
    const root = e('section', [inner, off], { 'data-cms-block': 'b1' })
    expect(cmsSourceFind([root], texts).cards).toEqual([])
  })
})

describe('the sources of a block', () => {
  it('lists what it shows in the page\'s order, then the collections it loads and shows nothing of; a global only when shown', () => {
    const b = noticesBlock()
    const { texts } = cmsSourceFields([notices], entities)
    const found = cmsSourceFind([b.root], texts, { own })
    const records = new Map([['notice', notices], ['siteSettings', site]])
    const out = cmsSourcesOf(found, ['team', 'siteSettings', 'notice'], records, { ...entities, team: { label: 'Tým', fields: { name: { kind: 'text' } } } }, 'Bez názvu')
    expect(out).toEqual([
      { entity: 'notice', entries: [{ id: 'n1', title: 'Dovolená od 21. do 31. prosince' }, { id: 'n2', title: 'Očkujeme proti chřipce' }, { id: 'n3', title: 'Ve středu jen do 11:00' }] },
      { entity: 'team', entries: [] },
    ])
  })

  it('says when an entry shown is a draft', () => {
    const drafts = record('notice', false, { d: { id: 'd', title: 'Nový ceník', status: 'draft' } })
    const root = e('section', [e('h3', [t('Nový ceník')])])
    const found = cmsSourceFind([root], cmsSourceFields([drafts], entities).texts)
    expect(cmsSourcesOf(found, [], new Map([['notice', drafts]]), entities, '')).toEqual([{ entity: 'notice', entries: [{ id: 'd', title: 'Nový ceník', state: 'draft' }] }])
  })
})

describe('what the texts of a block resolve to', () => {
  it('says own, entry, global or nothing, and the kind of what is nothing', () => {
    const b = noticesBlock()
    const phone = e('p', [t('123 456 703')])
    b.root.childNodes = [...Array.from(b.root.childNodes), phone] as N[]
    phone.parentNode = b.root
    const { texts } = cmsSourceFields([notices, site], entities)
    const found = cmsSourceFind([b.root], texts, { own })
    const report = cmsTextsReport([b.root], own, found, entities, { values: texts.map((f) => f.norm) })
    const of = (text: string) => report.find((r) => r.text === text)
    expect(of('Aktuálně z ordinace')).toEqual({ text: 'Aktuálně z ordinace', res: 'own' })
    expect(of('Očkujeme proti chřipce')?.res).toBe('entry')
    expect(of('123 456 703')?.res).toBe('global')
    expect(of('Důležité')).toEqual({ text: 'Důležité', res: 'none', rest: 'word' })
    expect(of('od 1. 10. do vyčerpání')?.rest).toBe('date')
  })

  it('tells a date, a number, a text made from a value, a form and a word', () => {
    expect(cmsTextRest('Dnes, čtvrtek 26. listopadu', [])).toBe('date')
    expect(cmsTextRest('12:00–18:00', [])).toBe('date')
    expect(cmsTextRest('245 Kč', [])).toBe('number')
    expect(cmsTextRest('MUDr. Beran, praktik', ['MUDr. Beran'])).toBe('derived')
    expect(cmsTextRest('Odeslat', [], true)).toBe('form')
    expect(cmsTextRest('Celý týden', ['Jičín'])).toBe('word')
  })
})

describe('the messages', () => {
  it('lets the page say a block\'s sources and ask for an entry', () => {
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:sources', id: 'b', path: ['b'], sources: [{ entity: 'notice', entries: [{ id: 'n1', title: 'A', state: 'draft' }] }, { entity: 'team', entries: [] }] })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:sources', id: 'b', sources: [{ entity: 'no-tice', entries: [] }] })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:sources', id: 'b', sources: [{ entity: 'notice', entries: [{ id: 'n1', title: 'A', state: 'gone' }] }] })).toBe(false)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:entry', entity: 'notice', id: 'n1', field: 'title' })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:entry', entity: 'notice', id: null, open: true })).toBe(true)
    expect(isCmsBuilderToAdmin({ type: 'cms:builder:entry', entity: 'notice', id: 5 })).toBe(false)
  })

  it('lets the admin describe its collections and globals, and the entry being edited', () => {
    const on = { type: 'cms:builder:on', labels: {}, texts: { drag: '', moveUp: '', moveDown: '', duplicate: '', remove: '', insertHere: '', edit: 'Upravit', openIn: 'Otevřít v sekci {name}' }, selected: null }
    expect(isCmsBuilderToPage({ ...on, entities, self: { entity: 'page', id: 'p1' } })).toBe(true)
    expect(isCmsBuilderToPage({ ...on, entities: { notice: { ...notice, fields: { title: { kind: 'date' } } } } })).toBe(false)
    expect(isCmsBuilderToPage({ ...on, self: { entity: 'page' } })).toBe(false)
    expect(isCmsBuilderToPage({ ...on, entities: { notice: { ...notice, fields: { author: { kind: 'relation', to: 'person' } } } } })).toBe(true)
    expect(isCmsBuilderToPage({ ...on, entities: { notice: { ...notice, fields: { author: { kind: 'relation' } } } } })).toBe(false)
  })

  it('reads what the editor in the sheet says', () => {
    expect(isCmsEmbedMessage({ type: 'cms:entry:state', entity: 'notice', id: null, dirty: true, saving: false, title: 'Nový' })).toBe(true)
    expect(isCmsEmbedMessage({ type: 'cms:entry:saved', entity: 'notice', id: 'n1' })).toBe(true)
    expect(isCmsEmbedMessage({ type: 'cms:entry:draft', entity: 'notice' })).toBe(false)
    expect(isCmsEmbedMessage({ type: 'cms:preview', entity: 'notice', id: 'n1' })).toBe(false)
  })
})

describe('what the admin tells the page', () => {
  it('describes the collections and globals from its graph, with what the person may do', () => {
    const graph = [
      { name: 'notice', label: 'Oznámení', titleField: 'title', publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', dateField: 'publishedAt' }, can: { create: true, update: true }, fields: [{ key: 'title', type: 'text' }, { key: 'body', type: 'richtext' }, { key: 'kind', type: 'select' }, { key: 'photo', type: 'media' }, { key: 'author', type: 'text', relation: { to: 'x' } }] },
      { name: 'siteSettings', label: 'Nastavení', singleton: true, can: { update: false }, fields: [{ key: 'phone', type: 'text' }] },
      { name: 'counter', label: 'Počty', fields: [{ key: 'n', type: 'number' }] },
      { name: 'locked', label: 'Zamčené', adminCreate: false, can: { create: true, update: true }, fields: [{ key: 'title', type: 'text' }] },
    ]
    const out = cmsBuilderEntities(graph, { entity: (m) => m.label, field: (f) => f.key.toUpperCase() })
    expect(out.notice).toEqual({
      label: 'Oznámení', title: 'title', publish: { field: 'status', published: 'published', date: 'publishedAt' },
      fields: { title: { kind: 'text', label: 'TITLE' }, body: { kind: 'rich', label: 'BODY' }, photo: { kind: 'picture', label: 'PHOTO' }, author: { kind: 'relation', to: 'x', label: 'AUTHOR' } }, edit: true, create: true,
    })
    expect(out.siteSettings).toMatchObject({ global: true, edit: false, create: false })
    expect(out.counter).toBeUndefined()
    expect(out.locked!.create).toBe(false)
  })

  it('names an entry\'s address in the admin, and the sheet\'s', () => {
    expect(cmsBuilderEntryAddress('notice', 'n1', false)).toBe('/admin/notice/n1')
    expect(cmsBuilderEntryAddress('notice', null, false, {})).toBe('/admin/notice/new?embed=builder')
    expect(cmsBuilderEntryAddress('notice', 'n1', false, { field: 'title' })).toBe('/admin/notice/n1?embed=builder&field=title')
    expect(cmsBuilderEntryAddress('siteSettings', 's1', true, { field: 'phone' })).toBe('/admin/siteSettings?embed=builder&field=phone')
  })
})
