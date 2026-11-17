import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { accounts, anonymous, type Client, doc, login, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

// A visitor who is not signed in gets no cookie: the public content API, the sitemap, the
// website's pages, media and error pages are cacheable by a CDN, and a cookie on every
// response would also need a cookie banner. Only a sign-in sets the session cookie.
const db = testDb()
let admin: Client
beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const cookiesOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(';')[0]!.split('=')[0])
const get = (path: string, headers: Record<string, string> = {}) => fetch(inject('baseURL') + path, { redirect: 'manual', headers })

describe('anonymous visitors', () => {
  it('get no Set-Cookie from the content API, the sitemap, the website, media or error pages', async () => {
    const author = await createAuthor(admin)
    await createPost(admin, { author: author.id, slug: 'zebra', status: 'published', body: doc('Zebra') })
    const m = (await admin.upload('/api/cms/_media', { name: 'a.png', type: 'image/png', data: PNG_1x1 })).body
    const paths = [
      '/api/content/post',
      '/api/content/post/zebra',
      '/api/content/_sitemap',
      '/api/openapi.json',
      '/api/health/ready',
      '/sitemap.xml',
      '/',
      '/kontakt',
      '/blog',
      '/blog/zebra',
      '/neexistuje',
      new URL(m.url, 'http://x').pathname,
      `/api/cms/_media/img/${m.id}/320.webp`,
      '/api/cms/_media/raw/2026/01/00000000-0000-4000-8000-000000000000.png',
      '/api/cms/_auth/status',
      '/api/cms/_graph', // 401
    ]
    const withCookie: string[] = []
    for (const path of paths) {
      const res = await get(path)
      await res.arrayBuffer()
      if (res.headers.getSetCookie().length) withCookie.push(`${path} (${res.status}): ${res.headers.getSetCookie().join(' | ').slice(0, 60)}`)
    }
    expect(withCookie).toEqual([])
  })

  it('get none for a wrong password, a request for the admin pages, or a stale session cookie either', async () => {
    const wrong = await anonymous().request('POST', '/api/cms/_auth/login', { json: { email: 'nobody@test.local', password: 'wrong password here' } })
    expect([wrong.status, wrong.headers.getSetCookie()]).toEqual([401, []])
    for (const path of ['/admin/login', '/admin']) {
      const res = await get(path)
      await res.arrayBuffer()
      expect([path, res.headers.getSetCookie()]).toEqual([path, []])
    }
    // A cookie from another secret / an old session: not valid, not replaced by a new anonymous one either.
    const stale = await get('/api/content/post', { cookie: 'nuxt-auth-session=Fe26.2**nonsense' })
    await stale.arrayBuffer()
    expect(cookiesOf(stale).filter((c) => c !== 'nuxt-auth-session')).toEqual([])
  })

  it('treat the cookie of tinyzoo 0.3 and older (`nuxt-session`) as no session at all', async () => {
    // What a browser signed in before the update still sends: it opens nothing, and nothing
    // fails or sets a cookie because of it.
    for (const path of ['/api/content/post', '/api/cms/_auth/me', '/api/_auth/session', '/admin']) {
      const res = await get(path, { cookie: 'nuxt-session=Fe26.2**0123456789abcdef*sealed-by-nuxt-auth-utils-0.5' })
      await res.arrayBuffer()
      expect([path, res.status < 500, res.headers.getSetCookie()]).toEqual([path, true, []])
    }
    const me = await get('/api/cms/_auth/me', { cookie: 'nuxt-session=Fe26.2**0123456789abcdef*sealed-by-nuxt-auth-utils-0.5' })
    expect(me.status).toBe(401)
  })
})

describe('signing in still works', () => {
  it('sets the session cookie on sign-in, and the cookie opens the admin API', async () => {
    const a = accounts().editor
    const c = await login(a.email, a.password)
    expect(c.cookie).toContain('nuxt-auth-session=')
    expect((await c.get('/api/cms/_auth/me')).body.user.email).toBe(a.email)
    expect((await c.get('/api/cms/_graph')).status).toBe(200)
    // The signed-in person's own requests keep their session (and the cookie is not re-issued on every read).
    expect((await c.get('/api/cms/post')).status).toBe(200)
  })

  it('a signed-in visitor on a public page still keeps their session', async () => {
    const res = await fetch(inject('baseURL') + '/api/content/post', { headers: { cookie: accounts().admin.cookie } })
    await res.arrayBuffer()
    expect(res.status).toBe(200)
    expect((await signIn('admin').then((c) => c.get('/api/cms/_auth/me'))).status).toBe(200)
  })
})
