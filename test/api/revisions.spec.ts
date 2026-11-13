import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, doc, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

const db = testDb()
let admin: Client
let editor: Client
beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const history = async (c: Client, id: string, locale?: string) =>
  (await c.get(`/api/cms/post/${id}/revisions${locale ? `?locale=${locale}` : ''}`)).body.revisions as any[]

describe('revisions', () => {
  it('keeps a snapshot of every save, newest first, saying what changed and who did it', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, title: 'První', body: doc('Text') })
    await editor.patch(`/api/cms/post/${post.id}`, { title: 'Druhý' })
    await editor.patch(`/api/cms/post/${post.id}`, { status: 'published' })

    const list = await history(admin, post.id)
    expect(list.map((r) => r.action)).toEqual(['entry.published', 'entry.updated', 'entry.created'])
    expect(list[1].changed).toEqual(['title'])
    expect(list[0].changed).toContain('status')
    expect(list[1].byName).toBe('Eda Editor')

    const first = (await admin.get(`/api/cms/post/${post.id}/revisions/${list[2].id}`)).body.revision
    expect(first.data).toMatchObject({ title: 'První', author: a.id })
    expect(JSON.stringify(first.data.body)).toContain('Text')
  })

  it('keeps translations\' history apart', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    await admin.patch(`/api/cms/post/${post.id}?locale=en`, { title: 'In English' })
    const en = await history(admin, post.id, 'en')
    expect(en).toHaveLength(1)
    expect(en[0]).toMatchObject({ action: 'translation.updated' })
    const snap = (await admin.get(`/api/cms/post/${post.id}/revisions/${en[0].id}`)).body.revision
    expect(snap.data.title).toBe('In English')
    expect(snap.data).not.toHaveProperty('author') // only the translatable fields
    expect(await history(admin, post.id)).toHaveLength(1)
  })

  it('needs read access, and goes with the entry when it is deleted', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    expect((await anonymous().get(`/api/cms/post/${post.id}/revisions`)).status).toBe(401)
    expect((await admin.get(`/api/cms/post/00000000-0000-4000-8000-000000000000/revisions`)).status).toBe(404)
    await admin.delete(`/api/cms/post/${post.id}`)
    expect((await db.query(`select count(*)::int as n from cms_revisions where entity = 'post'`)).rows[0].n).toBe(0)
  })
})
