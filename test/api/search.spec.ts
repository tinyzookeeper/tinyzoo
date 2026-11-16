import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, doc, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

const db = testDb()
let admin: Client
let editor: Client
let author: Client
beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
  author = await signIn('author')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const search = (q: string, extra = '') => anonymous().get(`/api/content/_search?q=${encodeURIComponent(q)}${extra}`)
const textBlock = (id: string, heading: string, body: string) => ({ id, type: 'text', heading, body: doc(body) })

describe('website search', () => {
  it('finds published entries by any word in them, accents and case aside, with an address and a snippet', async () => {
    const a = await createAuthor(admin, { name: 'Jana Nováková' })
    await createPost(admin, { author: a.id, status: 'published', title: 'Kváskový chléb', slug: 'kvaskovy-chleb', body: doc('Zimní příprava kvásku trvá tři dny.') })
    await createPost(admin, { author: a.id, title: 'Koncept o kvásku', slug: 'koncept', body: doc('Zimní příprava') }) // draft

    const res = await search('ZIMNI priprava')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    const [hit] = res.body.items
    expect(hit).toMatchObject({ entity: 'post', title: 'Kváskový chléb', path: '/blog/kvaskovy-chleb', locale: 'cs' })
    expect(hit.excerpt).toContain('Zimní příprava kvásku')
    expect(hit.highlights.map(([s, e]: [number, number]) => hit.excerpt.slice(s, e))).toEqual(['Zimní', 'příprava'])
    expect(hit).not.toHaveProperty('score')
    // Authors are public but have no address: never results. Neither is anything the
    // draft says.
    expect((await search('Nováková')).body.items).toEqual([])
    expect((await search('koncept')).body.items).toEqual([])
  })

  it('ranks a match in the title above one in the text', async () => {
    const a = await createAuthor(admin)
    await createPost(admin, { author: a.id, status: 'published', title: 'Novinky z oddílu', slug: 'novinky', body: doc('Letos jedeme na soustředění do hor.') })
    await createPost(admin, { author: a.id, status: 'published', title: 'Soustředění v horách', slug: 'soustredeni', body: doc('Program.') })
    const titles = (await search('soustředění')).body.items.map((i: any) => i.title)
    expect(titles).toEqual(['Soustředění v horách', 'Novinky z oddílu'])
  })

  it('reads the text inside page blocks, not block types or link addresses', async () => {
    const page = await admin.post('/api/cms/page', {
      title: 'O nás', slug: 'o-nas', status: 'published',
      sections: [
        textBlock('b1', 'Kde trénujeme', 'Plavecký bazén v Táboře, každé úterý.'),
        { id: 'b2', type: 'cta', text: 'Přidejte se', buttonLabel: 'Napište nám', buttonUrl: '/kontakt-formular' },
      ],
    })
    expect(page.status).toBe(201)
    const hit = (await search('bazen tabore')).body.items[0]
    expect(hit).toMatchObject({ entity: 'page', title: 'O nás', path: '/o-nas' })
    expect(hit.excerpt).toContain('Plavecký bazén v Táboře')
    expect((await search('napiste nam')).body.total).toBe(1)
    expect((await search('kontakt-formular')).body.total).toBe(0)
    expect((await search('cta')).body.total).toBe(0)
  })

  it('searches in the requested language, only entries translated into it, at their address there', async () => {
    const a = await createAuthor(admin)
    const translated = await createPost(admin, { author: a.id, status: 'published', title: 'Kváskový chléb', slug: 'kvaskovy-chleb', body: doc('Pečeme doma.') })
    await admin.request('PATCH', `/api/cms/post/${translated.id}?locale=en`, { json: { title: 'Sourdough bread', slug: 'sourdough-bread', body: doc('Baking at home.') } })
    await createPost(admin, { author: a.id, status: 'published', title: 'Chléb bez kvásku', slug: 'chleb-bez-kvasku', body: doc('Jen česky.') })

    const en = await search('bread', '&locale=en')
    expect(en.body.items.map((i: any) => [i.title, i.path, i.locale])).toEqual([['Sourdough bread', '/en/blog/sourdough-bread', 'en']])
    expect(en.body.items[0].excerpt).toBe('')
    expect((await search('baking home', '&locale=en')).body.items[0].excerpt).toBe('Baking at home.')
    // Czech words do not find the English version, and English words not the Czech one.
    expect((await search('pečeme', '&locale=en')).body.total).toBe(0)
    expect((await search('bread', '&locale=cs')).body.total).toBe(0)
    expect((await search('chléb')).body.total).toBe(2)
    expect((await search('bread', '&locale=xx')).status).toBe(400)
  })

  it('answers nothing for a single letter, can be narrowed to collections and limited', async () => {
    const a = await createAuthor(admin)
    for (const n of [1, 2, 3]) await createPost(admin, { author: a.id, status: 'published', title: `Závod ${n}`, slug: `zavod-${n}`, body: doc('x') })
    await admin.post('/api/cms/page', { title: 'Závody', slug: 'zavody', status: 'published', sections: [] })
    expect((await search('z')).body).toEqual({ query: 'z', items: [], total: 0 })
    const limited = (await search('závod', '&limit=2')).body
    expect(limited.items).toHaveLength(2)
    expect(limited.total).toBe(4)
    expect((await search('závod', '&entity=page')).body.items.map((i: any) => i.entity)).toEqual(['page'])
    // LIKE wildcards are plain characters.
    expect((await search('%%')).body.total).toBe(0)
    expect((await search('z_v')).body.total).toBe(0)
  })
})

describe('typos and keeping up with changes', () => {
  it('finds words with a typo, swapped letters or another ending — not lookalikes', async () => {
    const a = await createAuthor(admin)
    await createPost(admin, { author: a.id, status: 'published', title: 'Zimní příprava', slug: 'zimni-priprava', body: doc('Každé úterý trénujeme v plaveckém bazénu v Táboře.') })
    for (const q of ['bazne', 'baezn', 'pripava', 'zimni pripravu', 'plaveckm', 'trenujme tabor']) {
      const res = (await search(q)).body
      expect([q, res.items.map((i: any) => i.title)]).toEqual([q, ['Zimní příprava']])
    }
    const hit = (await search('bazne')).body.items[0]
    expect(hit.highlights.map(([s, e]: [number, number]) => hit.excerpt.slice(s, e))).toEqual(['bazénu'])
    expect((await search('bazar')).body.total).toBe(0)
    expect((await search('zimni xyzzy')).body.total).toBe(0) // every word still has to be there
  })

  it('follows edits, translations and deletes at once', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, status: 'published', title: 'Jarní závod', slug: 'jarni-zavod', body: doc('Start u rybníka.') })
    expect((await search('rybnika')).body.total).toBe(1)
    await admin.patch(`/api/cms/post/${post.id}`, { body: doc('Start u přehrady.') })
    expect((await search('rybnika')).body.total).toBe(0)
    expect((await search('prehrady')).body.total).toBe(1)
    await admin.request('PATCH', `/api/cms/post/${post.id}?locale=en`, { json: { title: 'Spring race', slug: 'spring-race', body: doc('Start at the dam.') } })
    expect((await search('dam', '&locale=en')).body.items.map((i: any) => i.path)).toEqual(['/en/blog/spring-race'])
    await admin.patch(`/api/cms/post/${post.id}`, { status: 'draft' })
    expect((await search('prehrady')).body.total).toBe(0) // unpublished: gone from the website at once
    await admin.delete(`/api/cms/post/${post.id}`)
    const { rows } = await db.query(`select count(*)::int as n from cms_search where record_id = $1`, [post.id])
    expect(rows[0].n).toBe(0)
  })
})

describe('admin search', () => {
  it('needs a signed-in person', async () => {
    expect((await anonymous().get('/api/cms/_search?q=chleb')).status).toBe(401)
  })

  it('finds drafts too, in any language, with their status, across collections', async () => {
    const a = await createAuthor(admin, { name: 'Pekař Josef' })
    const draft = await createPost(admin, { author: a.id, title: 'Kváskový chléb', slug: 'kvaskovy-chleb', body: doc('Recept na chleba.') })
    await admin.request('PATCH', `/api/cms/post/${draft.id}?locale=en`, { json: { title: 'Sourdough bread' } })
    await createPost(admin, { author: a.id, status: 'published', title: 'Rohlíky', slug: 'rohliky', body: doc('Bez kvásku.') })

    const hits = (await editor.get('/api/cms/_search?q=kvask')).body.items
    expect(hits.map((h: any) => [h.entity, h.title, h.status]).sort()).toEqual([['post', 'Kváskový chléb', 'draft'], ['post', 'Rohlíky', 'published']])

    // The English title finds the entry; it is shown by its own (default-language) title.
    const en = (await editor.get('/api/cms/_search?q=sourdough')).body.items
    expect(en.map((h: any) => [h.id, h.title])).toEqual([[draft.id, 'Kváskový chléb']])
    // …with a typo, too.
    expect((await editor.get('/api/cms/_search?q=sourdugh')).body.items.map((h: any) => h.id)).toEqual([draft.id])

    // Other collections: an author by name.
    expect((await author.get('/api/cms/_search?q=pekar')).body.items.map((h: any) => [h.entity, h.title])).toEqual([['author', 'Pekař Josef']])
  })
})
