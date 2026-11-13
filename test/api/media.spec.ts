import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { anonymous, type Client, doc, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

const db = testDb()
let admin: Client
const blob = (key: string) => join(inject('uploadsDir'), key)
const upload = (c: Client, name = 'a.png', type = 'image/png', data = PNG_1x1) => c.upload('/api/cms/_media', { name, type, data })

beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

describe('upload', () => {
  it('stores the file, records dimensions and who uploaded it', async () => {
    const res = await upload(admin)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ mime: 'image/png', width: 1, height: 1, alt: 'a.png', uploadedBy: expect.any(String) })
    expect(res.body.key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/)
    expect(existsSync(blob(res.body.key))).toBe(true)
  })

  it.each([
    ['image/svg+xml', 'x.svg'],
    ['text/html', 'x.html'],
    ['application/javascript', 'x.js'],
  ])('refuses %s (stored XSS) with 415', async (type, name) => {
    expect((await upload(admin, name, type, new TextEncoder().encode('<svg onload=alert(1)>'))).status).toBe(415)
  })

  it('answers 400 without a file and 401 when signed out', async () => {
    expect((await admin.request('POST', '/api/cms/_media', { body: new FormData() })).status).toBe(400)
    expect((await upload(anonymous())).status).toBe(401)
  })

  it('refuses a body larger than the cap from its Content-Length alone', async () => {
    const big = new Uint8Array(12 * 1024 * 1024) // default cap is 10 MB
    expect((await upload(admin, 'big.png', 'image/png', big)).status).toBe(413)
  })
})

describe('serving', () => {
  it('serves the blob with headers that stop it from ever executing', async () => {
    const media = (await upload(admin)).body
    const res = await fetch(inject('baseURL') + new URL(media.url, 'http://x').pathname)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
  })

  it('does not serve outside the upload directory', async () => {
    const res = await fetch(`${inject('baseURL')}/api/cms/_media/raw/..%2F..%2Fpackage.json`)
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

describe('library', () => {
  it('lists, filters by type and edits alt text', async () => {
    const media = (await upload(admin)).body
    const list = await admin.get('/api/cms/_media?accept=image/*')
    expect(list.body.items.map((m: any) => m.id)).toEqual([media.id])
    expect((await admin.get('/api/cms/_media?accept=video/*')).body.items).toEqual([])
    const patched = await admin.patch(`/api/cms/_media/${media.id}`, { alt: 'A red square' })
    expect(patched.body.alt ?? patched.body.row?.alt).toBe('A red square')
  })
})

describe('cleanup of unused files', () => {
  async function postWith(over: Record<string, unknown>) {
    const author = await createAuthor(admin)
    return createPost(admin, { author: author.id, ...over })
  }
  const mediaRow = async (id: string) => (await db.query('select 1 from cms_media where id = $1', [id])).rowCount

  it('deletes the old file when a field is replaced or cleared', async () => {
    const a = (await upload(admin)).body
    const b = (await upload(admin)).body
    const post = await postWith({ hero: a.id })

    await admin.patch(`/api/cms/post/${post.id}`, { hero: b.id })
    expect(await mediaRow(a.id)).toBe(0)
    expect(existsSync(blob(a.key))).toBe(false)

    await admin.patch(`/api/cms/post/${post.id}`, { hero: null })
    expect(await mediaRow(b.id)).toBe(0)
  })

  it('keeps a file that something else still uses', async () => {
    const a = (await upload(admin)).body
    const p1 = await postWith({ hero: a.id })
    await postWith({ hero: a.id })
    await admin.patch(`/api/cms/post/${p1.id}`, { hero: null })
    expect(await mediaRow(a.id)).toBe(1)
  })

  it('deletes owned files with the row', async () => {
    const a = (await upload(admin)).body
    const post = await postWith({ hero: a.id })
    await admin.delete(`/api/cms/post/${post.id}`)
    expect(await mediaRow(a.id)).toBe(0)
  })

  it('collects an image removed from rich text', async () => {
    const a = (await upload(admin)).body
    const post = await postWith({ body: doc('with image', { mediaId: a.id, src: a.url }) })
    await admin.patch(`/api/cms/post/${post.id}`, { body: doc('no image') })
    expect(await mediaRow(a.id)).toBe(0)
  })

  it('refuses a manual delete while the file is used — as a field or inside rich text', async () => {
    const a = (await upload(admin)).body
    const b = (await upload(admin)).body
    await postWith({ hero: a.id, body: doc('x', { mediaId: b.id, src: b.url }) })
    expect((await admin.delete(`/api/cms/_media/${a.id}`)).status).toBe(409)
    expect((await admin.delete(`/api/cms/_media/${b.id}`)).status).toBe(409)
  })

  it('deletes an unused file on request', async () => {
    const a = (await upload(admin)).body
    expect((await admin.delete(`/api/cms/_media/${a.id}`)).status).toBe(200)
    expect(await mediaRow(a.id)).toBe(0)
    expect(existsSync(blob(a.key))).toBe(false)
  })
})
