import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type Client, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'

const db = testDb()
let admin: Client
let editor: Client

beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

describe('admin home overview', () => {
  it('counts each collection and lists the latest edits first, with publish state', async () => {
    const author = await createAuthor(admin, { name: 'Carol' })
    await createTag(admin)
    const older = await createPost(admin, { author: author.id, title: 'Older', status: 'published' })
    const newer = await createPost(admin, { author: author.id, title: 'Newer' })

    const res = await admin.get('/api/cms/_overview')
    expect(res.status).toBe(200)
    expect(res.body.counts).toMatchObject({ post: 2, author: 1, tag: 1, siteSettings: 0 })
    const posts = res.body.recent.filter((r: any) => r.entity === 'post')
    expect(posts.map((r: any) => r.id)).toEqual([newer.id, older.id])
    expect(posts.map((r: any) => r.published)).toEqual([false, true])
    expect(res.body.recent.find((r: any) => r.entity === 'author')).toMatchObject({ title: 'Carol', published: null })
  })

  it('lists my own drafts, and what is scheduled to go live next, soonest first', async () => {
    const a = await createAuthor(admin)
    const mine = await createPost(editor, { author: a.id, title: 'Můj koncept' })
    await createPost(admin, { author: a.id, title: 'Cizí koncept' })
    const later = await createPost(admin, { author: a.id, title: 'Později', status: 'published', publishedAt: new Date(Date.now() + 2 * 86400_000).toISOString() })
    const sooner = await createPost(admin, { author: a.id, title: 'Dříve', status: 'published', publishedAt: new Date(Date.now() + 86400_000).toISOString() })
    const res = (await editor.get('/api/cms/_overview')).body
    expect(res.drafts.map((d: any) => d.id)).toEqual([mine.id])
    expect(res.scheduled.map((d: any) => d.id)).toEqual([sooner.id, later.id])
  })

  it('requires sign-in', async () => {
    expect((await fetch(`${admin.baseURL}/api/cms/_overview`)).status).toBe(401)
  })

  it('counts what an author may read (everything) the same as an admin', async () => {
    const author = await createAuthor(admin)
    await createPost(admin, { author: author.id })
    expect((await editor.get('/api/cms/_overview')).body.counts.post).toBe(1)
  })
})

describe('admin list status tabs', () => {
  it('filters by publication state', async () => {
    const author = await createAuthor(admin)
    await createPost(admin, { author: author.id, title: 'Live', status: 'published' })
    await createPost(admin, { author: author.id, title: 'Wip' })
    const titles = async (status?: string) => (await admin.get(`/api/cms/post${status ? `?status=${status}` : ''}`)).body.rows.map((r: any) => r.title).sort()
    expect(await titles()).toEqual(['Live', 'Wip'])
    expect(await titles('published')).toEqual(['Live'])
    expect(await titles('draft')).toEqual(['Wip'])
  })
})

describe('admin pages (server-rendered)', () => {
  const html = async (c: Client, path: string, headers: Record<string, string> = {}) => {
    const res = await c.request('GET', path, { headers: { accept: 'text/html', ...headers } })
    return { status: res.status, body: String(res.body) }
  }

  it('renders in Czech when the browser asks for it', async () => {
    const { status, body } = await html(admin, '/admin', { 'accept-language': 'cs-CZ,cs;q=0.9,en;q=0.8' })
    expect(status).toBe(200)
    expect(body).toMatch(/<html[^>]*lang="cs"/)
    expect(body).toMatch(/<html[^>]*data-cms-admin/)
    expect(body).toContain('Pokračovat v úpravách')
    expect(body).toContain('Články') // a config label in its Czech form
  })

  it('renders in English when the browser asks for it', async () => {
    const { body } = await html(admin, '/admin', { 'accept-language': 'en-US,en;q=0.9' })
    expect(body).toMatch(/<html[^>]*lang="en"/)
    expect(body).toContain('Continue editing')
    expect(body).toContain('Posts')
  })

  it('lets the language cookie win over the browser', async () => {
    const c = await signIn('admin')
    c.cookie += '; cms_admin_locale=en'
    const { body } = await html(c, '/admin', { 'accept-language': 'cs' })
    expect(body).toMatch(/<html[^>]*lang="en"/)
  })

  it('uses field labels, not raw keys, as list column headers', async () => {
    const { body } = await html(admin, '/admin/post', { 'accept-language': 'en' })
    expect(body).toContain('Publish date')
    expect(body).not.toContain('>publishedAt<')
  })

  // Generated ids differ between the server and the browser on pages that await
  // data, which left server-rendered labels pointing at nothing. Labels use stable
  // ids derived from the field key instead.
  it('links every server-rendered label to its control by a stable id', async () => {
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id })
    const { body } = await html(admin, `/admin/post/${post.id}`, { 'accept-language': 'en' })
    for (const key of ['slug', 'publishedAt']) {
      expect(body).toContain(`for="cms-field-${key}"`)
      expect(body).toContain(`id="cms-field-${key}"`)
    }
  })

  it('serves the design system page', async () => {
    const { status, body } = await html(admin, '/admin/styleguide', { 'accept-language': 'en' })
    expect(status).toBe(200)
    expect(body).toContain('Typography')
  })

  it('sends anonymous visitors to sign in', async () => {
    const res = await fetch(`${admin.baseURL}/admin`, { redirect: 'manual' })
    expect([301, 302, 307]).toContain(res.status)
    expect(res.headers.get('location')).toMatch(/^\/admin\/login/)
  })
})

describe('health', () => {
  it('reports liveness and readiness (after start-up migrations)', async () => {
    const live = await fetch(`${admin.baseURL}/api/health/live`)
    expect(live.status).toBe(200)
    const ready = await (await fetch(`${admin.baseURL}/api/health/ready`)).json()
    expect(ready).toEqual({ ok: true, migrations: 'done' })
  })
})
