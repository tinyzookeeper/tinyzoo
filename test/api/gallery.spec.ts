import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

const db = testDb()
let admin: Client
beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const upload = async () => (await admin.upload('/api/cms/_media', { name: 'g.png', type: 'image/png', data: PNG_1x1 })).body

describe('gallery field', () => {
  it('keeps files in order with captions; the website gets media objects', async () => {
    const [a, b] = [await upload(), await upload()]
    const au = await createAuthor(admin)
    const post = await createPost(admin, { author: au.id, slug: 'g', status: 'published', gallery: [{ mediaId: b.id, caption: 'Cíl' }, { mediaId: a.id }] })
    expect(post.gallery).toEqual([{ mediaId: b.id, caption: 'Cíl' }, { mediaId: a.id }])
    const item = (await anonymous().get('/api/content/post/g')).body.item
    expect(item.gallery.map((g: any) => [g.id, g.caption])).toEqual([[b.id, 'Cíl'], [a.id, null]])
    expect(item.gallery[0]).toMatchObject({ url: b.url, mime: 'image/png', focal: null })
  })

  it('refuses invalid items, counts files as used, and cleans up removed ones', async () => {
    const au = await createAuthor(admin)
    expect((await admin.post('/api/cms/post', { title: 'x', slug: 'x', author: au.id, body: { type: 'doc', content: [] }, gallery: [{ mediaId: 'nope' }] })).status).toBe(422)
    const m = await upload()
    const post = await createPost(admin, { author: au.id, gallery: [{ mediaId: m.id }] })
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBe(409)
    expect((await admin.get(`/api/cms/_media/${m.id}/usage`)).body.usage.map((u: any) => u.id)).toEqual([post.id])
    await admin.patch(`/api/cms/post/${post.id}`, { gallery: [] })
    expect((await admin.get(`/api/cms/_media/${m.id}`)).status).toBe(404) // removed and unused → gone
  })
})
