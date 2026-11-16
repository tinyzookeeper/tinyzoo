import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, doc, newAccount, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

// Fixes from the pilot's baseline audit (docs/pilot-plan.md, Track B).
const db = testDb()
let admin: Client
beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

describe('redirect loops', () => {
  it('refuses a redirect to its own address, on the target field', async () => {
    const res = await admin.post('/api/cms/redirect', { from: '/stary-clanek', to: '/stary-clanek/' })
    expect(res.status).toBe(422)
    expect(res.body.data).toEqual([expect.objectContaining({ code: 'redirect_loop', path: ['to'] })])
  })

  it('refuses a circle through another redirect, also when changing one', async () => {
    expect((await admin.post('/api/cms/redirect', { from: '/a', to: '/b' })).status).toBe(201)
    const circle = await admin.post('/api/cms/redirect', { from: '/b', to: '/a' })
    expect(circle.status).toBe(422)
    expect(circle.body.data[0].code).toBe('redirect_circle')
    const c = (await admin.post('/api/cms/redirect', { from: '/c', to: '/d' })).body.row
    expect((await admin.patch(`/api/cms/redirect/${c.id}`, { to: '/a' })).status).toBe(200) // c → a → b: no circle
    const b = (await admin.post('/api/cms/redirect', { from: '/b', to: '/x' })).body.row
    expect((await admin.patch(`/api/cms/redirect/${b.id}`, { to: '/c' })).status).toBe(422) // b → c → a → b
  })

  it('still accepts redirects elsewhere, external ones included', async () => {
    expect((await admin.post('/api/cms/redirect', { from: '/x', to: 'https://example.com/x' })).status).toBe(201)
    expect((await admin.post('/api/cms/redirect', { from: '/y', to: '/z' })).status).toBe(201)
  })
})

describe('link picker (/api/cms/_links)', () => {
  it('finds entries by title with their address in the language asked for, drafts marked', async () => {
    const author = await createAuthor(admin)
    await createPost(admin, { author: author.id, title: 'Zimní běh', slug: 'zimni-beh', status: 'published' })
    await createPost(admin, { author: author.id, title: 'Rozepsané', slug: 'rozepsane' })
    const all = (await admin.get('/api/cms/_links')).body
    expect(all.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'post', title: 'Zimní běh', path: '/blog/zimni-beh', published: true }),
      expect.objectContaining({ entity: 'post', title: 'Rozepsané', published: false }),
    ]))
    const found = (await admin.get('/api/cms/_links?q=zimni')).body.items
    expect(found.map((i: any) => i.title)).toEqual(['Zimní běh'])
  })

  it('needs a signed-in user', async () => {
    expect((await anonymous().get('/api/cms/_links')).status).toBe(401)
  })
})

describe('deleting something still in use', () => {
  it('answers 409 naming what uses it', async () => {
    const author = await createAuthor(admin)
    await createPost(admin, { author: author.id, title: 'Kdo psal tohle' })
    const res = await admin.delete(`/api/cms/author/${author.id}`)
    expect(res.status).toBe(409)
    expect(res.body.data).toEqual({ code: 'in_use', usedBy: [expect.objectContaining({ entity: 'post', title: 'Kdo psal tohle' })] })
  })
})

describe('list, file and colour fields (site settings)', () => {
  it('saves and serves opening hours, a brand colour and a PDF to download', async () => {
    const pdf = await admin.upload('/api/cms/_media', { name: 'pravidla.pdf', type: 'application/pdf', data: new TextEncoder().encode('%PDF-1.4\n%%EOF') })
    expect(pdf.status).toBe(201)
    const hours = [{ id: 'po', type: 'item', days: 'Po–Pá', hours: '9–17' }, { id: 'so', type: 'item', days: 'So', hours: null }]
    const saved = await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Web', brandColor: '#1f6feb', openingHours: hours, rules: pdf.body.id })
    expect(saved.status).toBe(200)
    const pub = (await anonymous().get('/api/content/_global/siteSettings')).body.item
    expect(pub.brandColor).toBe('#1f6feb')
    expect(pub.openingHours).toEqual([expect.objectContaining({ id: 'po', days: 'Po–Pá', hours: '9–17' }), expect.objectContaining({ id: 'so', days: 'So' })])
    expect(pub.rules).toEqual(expect.objectContaining({ mime: 'application/pdf', url: expect.any(String) }))
  })

  it('refuses a wrong colour and an item without its required field', async () => {
    expect((await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Web', brandColor: 'red' })).status).toBe(422)
    expect((await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Web', openingHours: [{ id: 'x', type: 'item', hours: '9' }] })).status).toBe(422)
  })
})

describe('library files are kept', () => {
  const libraryUpload = async () => {
    const form = new FormData()
    form.append('file', new Blob([PNG_1x1 as Uint8Array<ArrayBuffer>], { type: 'image/png' }), 'keepme.png')
    form.append('library', '1')
    return (await admin.request('POST', '/api/cms/_media', { body: form })).body
  }
  const exists = async (id: string) => (await db.query('select 1 from cms_media where id = $1', [id])).rowCount

  it('keeps a library file removed from rich text, and still collects a file uploaded into the field', async () => {
    const author = await createAuthor(admin)
    const kept = await libraryUpload()
    expect(kept.inLibrary).toBe(true)
    const post = await createPost(admin, { author: author.id, body: doc('with image', { mediaId: kept.id, src: kept.url }) })
    await admin.patch(`/api/cms/post/${post.id}`, { body: doc('no image') })
    expect(await exists(kept.id)).toBe(1)

    const direct = (await admin.upload('/api/cms/_media', { name: 'a.png', type: 'image/png', data: PNG_1x1 })).body
    await admin.patch(`/api/cms/post/${post.id}`, { body: doc('with image', { mediaId: direct.id, src: direct.url }) })
    await admin.patch(`/api/cms/post/${post.id}`, { body: doc('no image') })
    expect(await exists(direct.id)).toBe(0)
  })

  it('keeps a file once it is described on the library page', async () => {
    const author = await createAuthor(admin)
    const m = (await admin.upload('/api/cms/_media', { name: 'a.png', type: 'image/png', data: PNG_1x1 })).body
    await admin.patch(`/api/cms/_media/${m.id}`, { alt: 'Start závodu', keep: true })
    const post = await createPost(admin, { author: author.id, body: doc('x', { mediaId: m.id, src: m.url }) })
    await admin.patch(`/api/cms/post/${post.id}`, { body: doc('no image') })
    expect(await exists(m.id)).toBe(1)
  })
})

describe('a session the server no longer accepts', () => {
  it('sends an admin page to sign-in and drops the cookie (no 500) after a role change', async () => {
    const eva = await newAccount('editor')
    expect((await eva.client.request('GET', '/admin', { headers: { accept: 'text/html' } })).status).toBe(200)
    expect((await admin.patch(`/api/cms/_users/${eva.id}`, { role: 'author' })).status).toBe(200)

    const before = eva.client.cookie
    const page = await eva.client.request('GET', '/admin/post', { headers: { accept: 'text/html' } })
    expect(page.status).toBe(302)
    expect(page.headers.get('location')).toMatch(/^\/admin\/login/)
    expect(eva.client.cookie).not.toBe(before) // the response cleared it
    const login = await eva.client.request('GET', '/admin/login', { headers: { accept: 'text/html' } })
    expect(login.status).toBe(200)
  })
})
