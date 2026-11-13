import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'

const db = testDb()
let admin: Client
let author: Client
beforeAll(async () => {
  admin = await signIn('admin')
  author = await signIn('author')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const ids = async (path: string) => (await admin.get(path)).body.rows.map((r: any) => r.id)

describe('list filters', () => {
  it('filters by related entry, tag, image and date range', async () => {
    const ada = await createAuthor(admin)
    const bob = await createAuthor(admin)
    const tag = await createTag(admin)
    const p1 = await createPost(admin, { author: ada.id, tags: [tag.id], publishedAt: '2026-01-10T10:00:00.000Z' })
    const p2 = await createPost(admin, { author: bob.id, publishedAt: '2026-03-10T10:00:00.000Z' })

    expect(await ids(`/api/cms/post?filter.author=${ada.id}`)).toEqual([p1.id])
    expect(await ids(`/api/cms/post?filter.tags=${tag.id}`)).toEqual([p1.id])
    expect((await ids('/api/cms/post?filter.hero=no')).sort()).toEqual([p1.id, p2.id].sort())
    expect(await ids('/api/cms/post?filter.hero=yes')).toEqual([])
    expect(await ids('/api/cms/post?filter.publishedAt.from=2026-02-01T00:00:00.000Z')).toEqual([p2.id])
    expect(await ids('/api/cms/post?filter.publishedAt.to=2026-02-01T00:00:00.000Z')).toEqual([p1.id])
    // Unknown fields and bad values are ignored, never an error.
    expect((await admin.get('/api/cms/post?filter.nope=1&filter.author=not-a-uuid&filter.publishedAt.from=yesterday')).status).toBe(200)
  })

  it('treats search wildcards as plain characters', async () => {
    const a = await createAuthor(admin)
    await createPost(admin, { author: a.id, title: '100% hotovo' })
    await createPost(admin, { author: a.id, title: 'Jiný' })
    expect((await admin.get('/api/cms/post?q=%25')).body.rows.map((r: any) => r.title)).toEqual(['100% hotovo'])
  })
})

describe('manual order', () => {
  it('stores an order, and the website lists entries in it', async () => {
    const a = await createAuthor(admin, { name: 'Anna' })
    const b = await createAuthor(admin, { name: 'Bára' })
    const c = await createAuthor(admin, { name: 'Cyril' })
    const res = await admin.post('/api/cms/author/_order', { ids: [c.id, a.id, b.id] })
    expect(res.status).toBe(200)
    expect(res.body.moved).toBe(3)
    expect((await anonymous().get('/api/content/author')).body.items.map((x: any) => x.name)).toEqual(['Cyril', 'Anna', 'Bára'])
    expect(await ids('/api/cms/author?sort=position&dir=asc')).toEqual([c.id, a.id, b.id])
    // Saving the same order changes nothing.
    expect((await admin.post('/api/cms/author/_order', { ids: [c.id, a.id, b.id] })).body.moved).toBe(0)
  })

  it('needs edit rights on every entry, and a collection with an order', async () => {
    const a = await createAuthor(admin)
    const b = await createAuthor(admin)
    expect((await author.post('/api/cms/author/_order', { ids: [b.id, a.id] })).status).toBe(403)
    expect((await admin.post('/api/cms/post/_order', { ids: [a.id] })).status).toBe(404)
    expect((await admin.post('/api/cms/author/_order', { ids: [a.id, a.id] })).status).toBe(422)
  })
})

describe('stable paging', () => {
  it('never repeats or skips entries when their positions tie', async () => {
    const all = []
    for (let i = 0; i < 5; i++) all.push((await createAuthor(admin)).id)
    const seen: string[] = []
    for (let page = 1; page <= 3; page++) seen.push(...(await anonymous().get(`/api/content/author?limit=2&page=${page}`)).body.items.map((x: any) => x.id))
    expect(seen.sort()).toEqual(all.sort())
  })
})
