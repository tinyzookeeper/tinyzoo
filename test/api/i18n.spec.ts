import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, doc, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'

// Content languages in the playground: cs (default, the entry's own row) and en.
const db = testDb()
let admin: Client
let author: Client
let byline: any
beforeAll(async () => {
  admin = await signIn('admin')
  author = await signIn('author')
})
beforeEach(async () => {
  await truncateAll(db)
  byline = await createAuthor(admin)
})
afterAll(() => db.end())

const translate = (id: string, body: Record<string, unknown>, c = admin) => c.request('PATCH', `/api/cms/post/${id}?locale=en`, { json: body })
const live = (over: Record<string, unknown> = {}) => createPost(admin, { author: byline.id, status: 'published', title: 'Vánoční cukroví', slug: 'vanocni-cukrovi', body: doc('Česky'), ...over })

describe('writing translations (admin)', () => {
  it('stores a translation and reads it back with the default-language values for reference', async () => {
    const post = await live()
    const res = await translate(post.id, { title: 'Christmas cookies', slug: 'christmas-cookies' })
    expect(res.status).toBe(200)
    const row = (await admin.get(`/api/cms/post/${post.id}?locale=en`)).body.row
    expect(row).toMatchObject({ title: 'Christmas cookies', slug: 'christmas-cookies', body: null, __translated: true })
    expect(row.__defaults).toMatchObject({ title: 'Vánoční cukroví', slug: 'vanocni-cukrovi' })
    expect(row.__locales).toEqual(['cs', 'en'])
    // The default language is untouched.
    expect((await admin.get(`/api/cms/post/${post.id}`)).body.row.title).toBe('Vánoční cukroví')
  })

  it('accepts only translatable fields, and treats an emptied field as "use the default"', async () => {
    const post = await live()
    expect((await translate(post.id, { publishedAt: new Date().toISOString() })).status).toBe(422)
    expect((await translate(post.id, { title: '' })).status).toBe(200)
    expect((await admin.get(`/api/cms/post/${post.id}?locale=en`)).body.row.title).toBeNull()
  })

  it('refuses a language the site does not have', async () => {
    const post = await live()
    expect((await admin.request('PATCH', `/api/cms/post/${post.id}?locale=de`, { json: { title: 'x' } })).status).toBe(400)
  })

  it('keeps URL addresses unique per language', async () => {
    const a = await live({ slug: 'a' })
    const b = await live({ slug: 'b', title: 'B' })
    await translate(a.id, { slug: 'same' })
    const res = await translate(b.id, { slug: 'same' })
    expect(res.status).toBe(409)
    expect(res.body.data).toEqual([{ path: ['slug'], code: 'unique', message: 'Already in use' }])
  })

  it('lists the languages each entry has', async () => {
    const post = await live()
    await createPost(admin, { author: byline.id })
    await translate(post.id, { title: 'EN' })
    const rows = (await admin.get('/api/cms/post?sort=title')).body.rows
    expect(rows.find((r: any) => r.id === post.id).__locales).toEqual(['cs', 'en'])
    expect(rows.find((r: any) => r.id !== post.id).__locales).toEqual(['cs'])
  })

  it('removes a translation', async () => {
    const post = await live()
    await translate(post.id, { title: 'EN' })
    expect((await admin.request('DELETE', `/api/cms/post/${post.id}?locale=en`)).status).toBe(200)
    expect((await admin.get(`/api/cms/post/${post.id}?locale=en`)).body.row.__translated).toBe(false)
    expect((await admin.get(`/api/cms/post/${post.id}`)).status).toBe(200) // the entry stays
  })

  it('follows the same rules as editing: an author cannot translate a live entry', async () => {
    const mine = await createPost(author, { author: byline.id })
    expect((await translate(mine.id, { title: 'Mine in English' }, author)).status).toBe(200)
    await admin.patch(`/api/cms/post/${mine.id}`, { status: 'published' })
    expect((await translate(mine.id, { title: 'Live edit' }, author)).status).toBe(403)
  })
})

describe('reading translations (public content API)', () => {
  it('serves a language with per-field fallback and says which languages exist', async () => {
    const post = await live()
    await translate(post.id, { title: 'Christmas cookies', slug: 'christmas-cookies' })
    const en = (await anonymous().get('/api/content/post/christmas-cookies?locale=en')).body.item
    expect(en).toMatchObject({ title: 'Christmas cookies', slug: 'christmas-cookies', body: doc('Česky'), locale: 'en', locales: ['cs', 'en'] })
    const cs = (await anonymous().get('/api/content/post/vanocni-cukrovi')).body.item
    expect(cs).toMatchObject({ title: 'Vánoční cukroví', locale: 'cs', locales: ['cs', 'en'] })
  })

  it('finds an entry by its default URL address in any language, and refuses unknown languages', async () => {
    await live()
    expect((await anonymous().get('/api/content/post/vanocni-cukrovi?locale=en')).body.item.locale).toBe('en')
    expect((await anonymous().get('/api/content/post/vanocni-cukrovi?locale=xx')).status).toBe(400)
  })

  it('searches and filters in the requested language', async () => {
    const post = await live()
    await translate(post.id, { title: 'Christmas cookies', slug: 'christmas-cookies' })
    expect((await anonymous().get('/api/content/post?locale=en&q=cookies')).body.total).toBe(1)
    expect((await anonymous().get('/api/content/post?q=cookies')).body.total).toBe(0)
    expect((await anonymous().get('/api/content/post?locale=en&slug=christmas-cookies')).body.total).toBe(1)
  })

  it('translates related items too', async () => {
    const tag = await createTag(admin, { name: 'Recepty', slug: 'recepty' })
    await admin.request('PATCH', `/api/cms/tag/${tag.id}?locale=en`, { json: { name: 'Recipes' } })
    await live({ tags: [tag.id] })
    const item = (await anonymous().get('/api/content/post/vanocni-cukrovi?locale=en')).body.item
    expect(item.tags).toEqual([{ id: tag.id, name: 'Recipes', slug: 'recepty' }])
  })

  it('translates blocks as a whole list per language', async () => {
    const page = (await admin.post('/api/cms/page', { title: 'Domů', slug: 'domu', status: 'published', sections: [{ id: 'h', type: 'hero', heading: 'Vítejte' }] })).body.row
    await admin.request('PATCH', `/api/cms/page/${page.id}?locale=en`, { json: { title: 'Home', slug: 'home', sections: [{ id: 'h', type: 'hero', heading: 'Welcome' }] } })
    const en = (await anonymous().get('/api/content/page/home?locale=en')).body.item
    expect(en.sections[0].heading).toBe('Welcome')
    expect((await anonymous().get('/api/content/page/domu')).body.item.sections[0].heading).toBe('Vítejte')
  })
})

describe('media in translations', () => {
  it('protects images used only in a translation, and cleans them up with it', async () => {
    const m = (await admin.upload('/api/cms/_media', { name: 'p.png', type: 'image/png', data: PNG_1x1 })).body
    const post = await live()
    await translate(post.id, { body: doc('English', { mediaId: m.id, src: m.url }) })
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBe(409)
    await translate(post.id, { body: doc('English, no image') })
    expect((await db.query('select 1 from cms_media where id = $1', [m.id])).rowCount).toBe(0)
  })

  it('cleans up translation images when the entry is deleted', async () => {
    const m = (await admin.upload('/api/cms/_media', { name: 'p.png', type: 'image/png', data: PNG_1x1 })).body
    const post = await live()
    await translate(post.id, { body: doc('English', { mediaId: m.id, src: m.url }) })
    await admin.delete(`/api/cms/post/${post.id}`)
    expect((await db.query('select 1 from cms_media where id = $1', [m.id])).rowCount).toBe(0)
  })
})
