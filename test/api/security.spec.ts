import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, newAccount, PNG_1x1, signIn, testDb, tokenOf, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

// Regression tests for the Phase 2 security review.
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

describe('cross-site request forgery', () => {
  // A page on a sibling subdomain or the host site can auto-submit an HTML form;
  // h3 would parse it into an object the handler accepts. Forms cannot send JSON.
  it('refuses an urlencoded form post to the admin API (would have invited an attacker as admin)', async () => {
    const res = await admin.request('POST', '/api/cms/_users', {
      body: 'email=attacker@evil.test&role=admin',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })
    expect(res.status).toBe(415)
    const { rowCount } = await db.query(`select 1 from cms_users where email = 'attacker@evil.test'`)
    expect(rowCount).toBe(0)
  })

  it('accepts multipart only for media uploads', async () => {
    const form = new FormData()
    form.append('title', 'x')
    expect((await admin.request('POST', '/api/cms/post', { body: form })).status).toBe(415)
    expect((await admin.upload('/api/cms/_media', { name: 'a.png', type: 'image/png', data: PNG_1x1 })).status).toBe(201)
  })

  it('refuses requests the browser marks as cross-site or same-site (another subdomain)', async () => {
    for (const site of ['cross-site', 'same-site']) {
      const res = await admin.request('POST', '/api/cms/_users', {
        json: { email: `x-${site}@test.local`, role: 'admin' },
        headers: { 'sec-fetch-site': site },
      })
      expect(res.status).toBe(403)
    }
    const ok = await admin.request('POST', '/api/cms/tag', { json: { name: 'Same origin', slug: 'same-origin' }, headers: { 'sec-fetch-site': 'same-origin' } })
    expect(ok.status).toBe(201)
  })
})

describe('one-time links', () => {
  it('can be used once even by simultaneous requests', async () => {
    const invited = await admin.post('/api/cms/_users', { email: `race-${Date.now()}@test.local`, role: 'editor' })
    const token = tokenOf(invited.body.inviteUrl)
    const tries = await Promise.all(Array.from({ length: 4 }, (_, i) =>
      anonymous().post('/api/cms/_auth/accept', { token, name: `Racer ${i}`, password: 'a long enough password' })))
    expect(tries.map((r) => r.status).sort()).toEqual([200, 410, 410, 410])
  })
})

describe('sessions', () => {
  it('expire: the cookie lasts 14 days from sign-in, not forever', async () => {
    const acc = await newAccount('editor')
    const res = await fetch(`${anonymous().baseURL}/api/cms/_auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.18.250.1' },
      body: JSON.stringify({ email: acc.email, password: acc.password }),
    })
    const expires = /Expires=([^;]+)/i.exec(res.headers.getSetCookie().join(';'))?.[1]
    const days = (new Date(expires!).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(13.9)
    expect(days).toBeLessThan(14.1)
  })

  it('a profile update cannot carry a session past a password change made elsewhere', async () => {
    const acc = await newAccount('editor')
    const thief = await (async () => { const c = anonymous(); c.cookie = acc.client.cookie; return c })()
    await acc.client.post('/api/cms/_auth/password', { current: acc.password, password: 'changed after theft' })
    expect((await thief.patch('/api/cms/_auth/me', { name: 'Still here?' })).status).toBe(401)
    expect((await thief.get('/api/cms/_graph')).status).toBe(401)
  })
})

describe('authors', () => {
  let byline: any
  beforeEach(async () => { byline = await createAuthor(admin) })

  it("cannot delete someone else's file by pointing a draft at it and clearing it", async () => {
    const theirs = (await editor.upload('/api/cms/_media', { name: 'e.png', type: 'image/png', data: PNG_1x1 })).body
    const draft = await createPost(author, { author: byline.id, hero: theirs.id })
    await author.patch(`/api/cms/post/${draft.id}`, { hero: null })
    await author.delete(`/api/cms/post/${draft.id}`)
    const { rowCount } = await db.query('select 1 from cms_media where id = $1', [theirs.id])
    expect(rowCount).toBe(1)
  })

  it('cannot take a live entry off the website by deleting it', async () => {
    const post = await createPost(author, { author: byline.id })
    await editor.patch(`/api/cms/post/${post.id}`, { status: 'published' })
    expect((await author.delete(`/api/cms/post/${post.id}`)).status).toBe(403)
  })

  it('cannot write public content that has no publish step (it would go live at once)', async () => {
    expect((await author.post('/api/cms/tag', { name: 'Live now', slug: 'live-now' })).status).toBe(403)
    expect((await editor.post('/api/cms/tag', { name: 'Editor tag', slug: 'editor-tag' })).status).toBe(201)
  })
})
