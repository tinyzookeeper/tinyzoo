import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, doc, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

const db = testDb()
let admin: Client
let author: Client
beforeAll(async () => {
  admin = await signIn('admin')
  author = await signIn('author')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

async function upload(c: Client, name: string, folder?: string) {
  const form = new FormData()
  form.append('file', new Blob([PNG_1x1 as Uint8Array<ArrayBuffer>], { type: 'image/png' }), name)
  if (folder) form.append('folder', folder)
  const res = await c.request('POST', '/api/cms/_media', { body: form })
  expect(res.status).toBe(201)
  return res.body
}

describe('media library', () => {
  it('keeps the file name and folder, and finds files by them', async () => {
    const team = await upload(admin, 'C:\\fakepath\\tym-2026.png', 'Tým')
    const other = await upload(admin, 'logo.png')
    expect(team).toMatchObject({ name: 'tym-2026.png', folder: 'Tým' })
    const byFolder = (await admin.get('/api/cms/_media?folder=T%C3%BDm')).body
    expect(byFolder.items.map((m: any) => m.id)).toEqual([team.id])
    expect(byFolder.folders).toEqual(['Tým'])
    expect((await admin.get('/api/cms/_media?folder=none')).body.items.map((m: any) => m.id)).toEqual([other.id])
    expect((await admin.get('/api/cms/_media?q=tym-2026')).body.items.map((m: any) => m.id)).toEqual([team.id])
  })

  it('stores descriptions per language, a folder and a focal point — and the website gets them', async () => {
    const m = await upload(admin, 'hero.png')
    const res = await admin.patch(`/api/cms/_media/${m.id}`, { alt: 'Zahrada', altLocales: { en: 'Garden', de: 'ignored', cs: 'ignored' }, folder: ' Zahrady ', focal: { x: 30.4, y: 70 } })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ alt: 'Zahrada', altLocales: { en: 'Garden' }, folder: 'Zahrady', focalX: 30, focalY: 70 })
    expect((await admin.patch(`/api/cms/_media/${m.id}`, { focal: { x: 'left' } })).status).toBe(422)
    // Only the fields sent change.
    expect((await admin.patch(`/api/cms/_media/${m.id}`, { folder: null })).body).toMatchObject({ folder: null, alt: 'Zahrada', focalX: 30 })

    const a = await createAuthor(admin)
    await createPost(admin, { author: a.id, slug: 'z', status: 'published', hero: m.id })
    const cs = (await anonymous().get('/api/content/post/z')).body.item.hero
    expect(cs).toMatchObject({ alt: 'Zahrada', focal: { x: 30, y: 70 } })
    expect((await anonymous().get('/api/content/post/z?locale=en')).body.item.hero.alt).toBe('Garden')
  })

  it('says where a file is used — fields, rich text, translations — and only to those who may read it', async () => {
    const m = await upload(admin, 'used.png')
    const a = await createAuthor(admin)
    const p1 = await createPost(admin, { author: a.id, title: 'S obrázkem', hero: m.id })
    const p2 = await createPost(admin, { author: a.id, title: 'V textu', body: doc('x', { mediaId: m.id, src: m.url }) })
    await admin.patch(`/api/cms/post/${p1.id}?locale=en`, { body: doc('y', { mediaId: m.id, src: m.url }) })
    const usage = (await admin.get(`/api/cms/_media/${m.id}/usage`)).body.usage
    expect(usage.map((u: any) => [u.entity, u.id, u.locale]).sort()).toEqual([['post', p1.id, 'en'], ['post', p1.id, null], ['post', p2.id, null]].sort())
    expect((await author.patch(`/api/cms/_media/${m.id}`, { alt: 'x' })).status).toBe(403) // not theirs
  })
})
