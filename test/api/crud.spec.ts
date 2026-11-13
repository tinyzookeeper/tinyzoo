import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type Client, doc, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'

const db = testDb()
let admin: Client

beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

describe('create', () => {
  it('creates a row, applies defaults and answers 201', async () => {
    const author = await createAuthor(admin)
    const res = await admin.post('/api/cms/post', { title: 'Hello', slug: 'hello', author: author.id, body: doc('Hi') })
    expect(res.status).toBe(201)
    expect(res.body.row).toMatchObject({ title: 'Hello', slug: 'hello', status: 'draft', authorId: author.id })
    expect(res.body.row.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('answers 422 with the Zod issues for an invalid payload', async () => {
    const res = await admin.post('/api/cms/post', { slug: 'Not A Slug' })
    expect(res.status).toBe(422)
    const paths = res.body.data.map((i: any) => i.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['title', 'slug', 'author']))
  })

  it('answers 404 for an unknown entity', async () => {
    expect((await admin.post('/api/cms/nope', {})).status).toBe(404)
    expect((await admin.get('/api/cms/nope')).status).toBe(404)
  })

  it('writes many-to-many links into the junction', async () => {
    const author = await createAuthor(admin)
    const [t1, t2] = [await createTag(admin), await createTag(admin)]
    const post = await createPost(admin, { author: author.id, tags: [t1.id, t2.id] })
    const { rows } = await db.query('select tag_id from post_to_tag where post_id = $1 order by tag_id', [post.id])
    expect(rows.map((r) => r.tag_id).sort()).toEqual([t1.id, t2.id].sort())
  })
})

describe('read', () => {
  it('lists with pagination, total, to-one labels and search', async () => {
    const author = await createAuthor(admin, { name: 'Carol' })
    for (const title of ['Alpha', 'Beta', 'Gamma']) await createPost(admin, { author: author.id, title })

    const page1 = await admin.get('/api/cms/post?limit=2&page=1&sort=title&dir=asc')
    expect(page1.status).toBe(200)
    expect(page1.body).toMatchObject({ total: 3, page: 1, limit: 2 })
    expect(page1.body.rows.map((r: any) => r.title)).toEqual(['Alpha', 'Beta'])
    expect(page1.body.rows[0].author__label).toBe('Carol')

    const page2 = await admin.get('/api/cms/post?limit=2&page=2&sort=title&dir=asc')
    expect(page2.body.rows.map((r: any) => r.title)).toEqual(['Gamma'])

    const search = await admin.get('/api/cms/post?q=amm')
    expect(search.body.rows.map((r: any) => r.title)).toEqual(['Gamma'])
  })

  it('shapes a single row for the edit form (FK aliases, m2m id lists)', async () => {
    const author = await createAuthor(admin)
    const tag = await createTag(admin)
    const post = await createPost(admin, { author: author.id, tags: [tag.id] })
    const res = await admin.get(`/api/cms/post/${post.id}`)
    expect(res.status).toBe(200)
    expect(res.body.row).toMatchObject({ id: post.id, author: author.id, tags: [tag.id], hero: null })
  })

  it('answers 404 for a missing row', async () => {
    expect((await admin.get('/api/cms/post/00000000-0000-4000-8000-000000000000')).status).toBe(404)
  })

  it('answers 404 (not 500) for an id that is not a uuid', async () => {
    expect((await admin.get('/api/cms/post/not-a-uuid')).status).toBe(404)
    expect((await admin.patch('/api/cms/post/not-a-uuid', { title: 'x' })).status).toBe(404)
    expect((await admin.delete('/api/cms/post/not-a-uuid')).status).toBe(404)
  })
})

describe('update', () => {
  // Regression: PATCH used to fire create defaults and wipe omitted fields.
  it('changes only the fields sent', async () => {
    const author = await createAuthor(admin)
    const tag = await createTag(admin)
    const post = await createPost(admin, { author: author.id, tags: [tag.id], status: 'published' })

    const res = await admin.patch(`/api/cms/post/${post.id}`, { title: 'Renamed' })
    expect(res.status).toBe(200)
    const after = (await admin.get(`/api/cms/post/${post.id}`)).body.row
    expect(after).toMatchObject({ title: 'Renamed', status: 'published', tags: [tag.id], slug: post.slug })
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(post.updatedAt).getTime())
  })

  it('replaces the m2m set when tags are sent', async () => {
    const author = await createAuthor(admin)
    const [t1, t2] = [await createTag(admin), await createTag(admin)]
    const post = await createPost(admin, { author: author.id, tags: [t1.id] })
    await admin.patch(`/api/cms/post/${post.id}`, { tags: [t2.id] })
    expect((await admin.get(`/api/cms/post/${post.id}`)).body.row.tags).toEqual([t2.id])
    await admin.patch(`/api/cms/post/${post.id}`, { tags: [] })
    expect((await admin.get(`/api/cms/post/${post.id}`)).body.row.tags).toEqual([])
  })

  it('validates on update too', async () => {
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id })
    expect((await admin.patch(`/api/cms/post/${post.id}`, { status: 'archived' })).status).toBe(422)
  })
})

describe('delete', () => {
  it('deletes a row and its junction links', async () => {
    const author = await createAuthor(admin)
    const tag = await createTag(admin)
    const post = await createPost(admin, { author: author.id, tags: [tag.id] })
    expect((await admin.delete(`/api/cms/post/${post.id}`)).status).toBe(200)
    expect((await admin.get(`/api/cms/post/${post.id}`)).status).toBe(404)
    const { rowCount } = await db.query('select 1 from post_to_tag where post_id = $1', [post.id])
    expect(rowCount).toBe(0)
  })

  it('answers 404 for a missing row', async () => {
    expect((await admin.delete('/api/cms/post/00000000-0000-4000-8000-000000000000')).status).toBe(404)
  })

  // An author with posts is protected by `onDelete: 'restrict'`. The editor should
  // hear "still in use" (409), not a generic server error.
  it('refuses to delete a row that is still referenced, with 409', async () => {
    const author = await createAuthor(admin)
    await createPost(admin, { author: author.id })
    const res = await admin.delete(`/api/cms/author/${author.id}`)
    expect(res.status).toBe(409)
    expect((await admin.get(`/api/cms/author/${author.id}`)).status).toBe(200)
  })
})

describe('references', () => {
  it('answers 422 when a relation points at a row that does not exist', async () => {
    const res = await admin.post('/api/cms/post', { title: 'T', slug: 't', author: '00000000-0000-4000-8000-000000000000', body: { type: 'doc', content: [] } })
    expect(res.status).toBe(422)
  })
})

describe('unique constraints', () => {
  it('answers 409 when a unique value is taken', async () => {
    await createAuthor(admin, { email: 'taken@example.com' })
    const res = await admin.post('/api/cms/author', { name: 'Other', email: 'taken@example.com' })
    expect(res.status).toBe(409)
    expect(res.body.data).toEqual([{ path: ['email'], code: 'unique', message: 'Already in use' }])
  })
})
