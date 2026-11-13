import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { accounts, type Client, doc, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

// Built-in roles: admin and editor do everything with content; an author creates
// drafts, changes and deletes only their own entries, never publishes and never
// touches site settings.
const db = testDb()
let admin: Client
let editor: Client
let author: Client
let authorRow: any

beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
  author = await signIn('author')
})
beforeEach(async () => {
  await truncateAll(db)
  authorRow = await createAuthor(admin, { name: 'Byline' })
})
afterAll(() => db.end())

const draftBy = (c: Client, over: Record<string, unknown> = {}) => createPost(c, { author: authorRow.id, ...over })

describe('who created and changed what', () => {
  it('stamps createdBy and updatedBy with the account', async () => {
    const post = await draftBy(author)
    expect(post).toMatchObject({ createdBy: accounts().author.id, updatedBy: accounts().author.id })
    const res = await editor.patch(`/api/cms/post/${post.id}`, { title: 'Edited by the editor' })
    expect(res.body.row).toMatchObject({ createdBy: accounts().author.id, updatedBy: accounts().editor.id })
  })
})

describe('author', () => {
  it('creates drafts and edits their own', async () => {
    const post = await draftBy(author)
    expect((await author.patch(`/api/cms/post/${post.id}`, { title: 'Mine, edited' })).status).toBe(200)
  })

  it('cannot publish — not on create, not on update', async () => {
    const created = await author.post('/api/cms/post', { title: 'T', slug: 't', author: authorRow.id, body: doc('x'), status: 'published' })
    expect(created.status).toBe(403)
    const post = await draftBy(author)
    expect((await author.patch(`/api/cms/post/${post.id}`, { status: 'published' })).status).toBe(403)
  })

  it('cannot change an entry once it is live (the change would go straight to the website)', async () => {
    const post = await draftBy(author)
    await editor.patch(`/api/cms/post/${post.id}`, { status: 'published' })
    expect((await author.patch(`/api/cms/post/${post.id}`, { title: 'Sneaky live edit' })).status).toBe(403)
  })

  it("cannot change or delete someone else's entry (it does not exist for them)", async () => {
    const theirs = await draftBy(editor)
    expect((await author.patch(`/api/cms/post/${theirs.id}`, { title: 'Hijack' })).status).toBe(404)
    expect((await author.delete(`/api/cms/post/${theirs.id}`)).status).toBe(404)
    const { rows } = await db.query('select title from post where id = $1', [theirs.id])
    expect(rows[0].title).toBe(theirs.title)
  })

  it('still reads everything', async () => {
    await draftBy(editor)
    expect((await author.get('/api/cms/post')).body.total).toBe(1)
  })

  it('never edits site settings', async () => {
    expect((await author.put('/api/cms/_singleton/siteSettings', { siteName: 'Mine now' })).status).toBe(403)
    const graph = (await author.get('/api/cms/_graph')).body
    expect(graph.find((g: any) => g.name === 'siteSettings').can.update).toBe(false)
    expect(graph.find((g: any) => g.name === 'post').can).toMatchObject({ create: true, publish: false })
  })

  it("cannot change or delete someone else's files", async () => {
    const media = (await editor.upload('/api/cms/_media', { name: 'e.png', type: 'image/png', data: PNG_1x1 })).body
    expect((await author.patch(`/api/cms/_media/${media.id}`, { alt: 'x' })).status).toBe(403)
    expect((await author.delete(`/api/cms/_media/${media.id}`)).status).toBe(403)
    const own = (await author.upload('/api/cms/_media', { name: 'a.png', type: 'image/png', data: PNG_1x1 })).body
    expect((await author.patch(`/api/cms/_media/${own.id}`, { alt: 'Mine' })).status).toBe(200)
  })
})

describe('editor', () => {
  it("edits and publishes anyone's entries, and edits settings", async () => {
    const post = await draftBy(author)
    expect((await editor.patch(`/api/cms/post/${post.id}`, { status: 'published' })).status).toBe(200)
    expect((await editor.put('/api/cms/_singleton/siteSettings', { siteName: 'Site' })).status).toBe(200)
    expect((await editor.get('/api/cms/_graph')).body.find((g: any) => g.name === 'post').can.publish).toBe(true)
  })

  it('does not manage people', async () => {
    expect((await editor.get('/api/cms/_users')).status).toBe(403)
  })
})

describe('audit log', () => {
  it('records who created, published and deleted an entry', async () => {
    const post = await draftBy(author)
    await editor.patch(`/api/cms/post/${post.id}`, { status: 'published' })
    await admin.delete(`/api/cms/post/${post.id}`)
    const { rows } = await db.query(
      'select action, user_id from cms_audit where record_id = $1 order by created_at, action', [post.id],
    )
    expect(rows).toEqual([
      { action: 'entry.create', user_id: accounts().author.id },
      { action: 'entry.publish', user_id: accounts().editor.id },
      { action: 'entry.delete', user_id: accounts().admin.id },
    ])
  })
})
