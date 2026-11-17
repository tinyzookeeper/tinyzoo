import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { anonymous, type Client, hooksMark, type ReceivedHook, receivedHooks, signIn, testDb, truncateAll, waitForHooks } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'
import { WEBHOOK_SECRET } from '../setup/server'

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

const settle = () => new Promise((r) => setTimeout(r, 400))

describe('publish webhooks', () => {
  it('sends a signed change to every URL when a post goes live', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const mark = hooksMark()
    expect((await editor.patch(`/api/cms/post/${post.id}`, { status: 'published' })).status).toBe(200)

    const hooks = await waitForHooks(mark, (h) => h.some((x) => x.path === '/ok') && h.some((x) => x.path === '/flaky' && !x.failed))
    const ok = hooks.find((h) => h.path === '/ok')!
    expect(ok.json).toMatchObject({ type: 'entry.published', entity: 'post', id: post.id, locale: null, public: true, paths: [`/blog/${post.slug}`] })
    expect(ok.headers['x-cms-event']).toBe('entry.published')
    expect(ok.headers['content-type']).toBe('application/json')

    // Signature: HMAC-SHA256 over `${t}.${raw body}`.
    const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(ok.headers['x-cms-signature']!)
    expect(m).toBeTruthy()
    expect(Math.abs(Date.now() / 1000 - Number(m![1]))).toBeLessThan(60)
    expect(m![2]).toBe(createHmac('sha256', WEBHOOK_SECRET).update(`${m![1]}.${ok.body}`).digest('hex'))
  })

  it('retries a failed delivery under the same delivery id', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, status: 'published' })
    const mark = hooksMark()
    await admin.patch(`/api/cms/post/${post.id}`, { title: 'Changed' })
    const updates = (h: ReceivedHook[]) => h.filter((x) => x.path === '/flaky' && x.json.type === 'entry.updated')
    const flaky = updates(await waitForHooks(mark, (h) => updates(h).length >= 2))
    expect(flaky.map((x) => x.failed)).toEqual([true, false])
    expect(new Set(flaky.map((x) => x.headers['x-cms-delivery'])).size).toBe(1)
    expect(flaky[1]!.json).toMatchObject({ type: 'entry.updated', id: post.id })
  })

  it('reports the old and the new address when a live slug changes, and deletes', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, status: 'published', slug: 'stary' })
    let mark = hooksMark()
    await admin.patch(`/api/cms/post/${post.id}`, { slug: 'novy' })
    const ok = (type: string) => (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.type === type)
    expect(ok('entry.updated')(await waitForHooks(mark, (h) => !!ok('entry.updated')(h)))!.json.paths).toEqual(['/blog/stary', '/blog/novy'])

    mark = hooksMark()
    await admin.delete(`/api/cms/post/${post.id}`)
    expect(ok('entry.deleted')(await waitForHooks(mark, (h) => !!ok('entry.deleted')(h)))!.json).toMatchObject({ paths: ['/blog/novy'] })
  })

  it('reports translations with the address in that language', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, status: 'published', slug: 'clanek' })
    const mark = hooksMark()
    // (Posts publish each language on their own: `status: null` makes this first translation follow Czech, so it is on the
    // website at once; without it, it would be being translated, which visitors do not see and which sends nothing.)
    expect((await admin.patch(`/api/cms/post/${post.id}?locale=en`, { title: 'Article', slug: 'article', status: null })).status).toBe(200)
    const tr = (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.type === 'translation.updated')
    const json = tr(await waitForHooks(mark, (h) => !!tr(h)))!.json
    expect(json).toMatchObject({ locale: 'en' })
    // Its new address, and the one English was served at through Czech until now (it reads English there too).
    expect([...json.paths].sort()).toEqual(['/en/blog/article', '/en/blog/clanek'])
  })

  it('reports the translated address of a collection with one per language', async () => {
    const page = (await admin.post('/api/cms/page', { title: 'Kontakt', slug: 'kontakt', status: 'published', sections: [] })).body.row
    const mark = hooksMark()
    expect((await admin.patch(`/api/cms/page/${page.id}?locale=en`, { title: 'Contact', slug: 'contact' })).status).toBe(200)
    const tr = (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.type === 'translation.updated' && x.json.entity === 'page')
    expect(tr(await waitForHooks(mark, (h) => !!tr(h)))!.json).toMatchObject({ locale: 'en', paths: ['/en/pages/contact'] })
  })

  it('gives the admin the preview address per language', async () => {
    const graph = (await admin.get('/api/cms/_graph')).body
    expect(graph.find((g: any) => g.name === 'page').previewPaths).toEqual({ cs: '/:slug', en: '/en/pages/:slug' })
    expect(graph.find((g: any) => g.name === 'post').previewPaths).toEqual({ cs: '/blog/:slug', en: '/en/blog/:slug' })
  })

  it('signs the delivery id into the body and keeps who made the change out', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, status: 'published' })
    const mark = hooksMark()
    await admin.patch(`/api/cms/post/${post.id}`, { title: 'Signed' })
    const hook = (await waitForHooks(mark, (h) => h.some((x) => x.path === '/ok' && x.json.type === 'entry.updated')))
      .find((x) => x.path === '/ok' && x.json.type === 'entry.updated')!
    expect(hook.json.delivery).toBe(hook.headers['x-cms-delivery'])
    expect(hook.json).not.toHaveProperty('by')
  })

  it('covers every language: a renamed translated slug, and a deleted translated post', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, status: 'published', slug: 'akce' })
    await admin.patch(`/api/cms/post/${post.id}?locale=en`, { title: 'Event', slug: 'event', status: null }) // follows Czech: live
    let mark = hooksMark()
    await admin.patch(`/api/cms/post/${post.id}?locale=en`, { slug: 'events' })
    const tr = (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.type === 'translation.updated' && x.json.paths.includes('/en/blog/events'))
    expect(tr(await waitForHooks(mark, (h) => !!tr(h)))!.json.paths).toEqual(['/en/blog/event', '/en/blog/events'])

    mark = hooksMark()
    await admin.delete(`/api/cms/post/${post.id}`)
    const del = (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.type === 'entry.deleted')
    expect(del(await waitForHooks(mark, (h) => !!del(h)))!.json.paths.sort()).toEqual(['/blog/akce', '/en/blog/events'])
  })

  it('does not announce the new address of a post taken off the website', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, status: 'published', slug: 'verejny' })
    const mark = hooksMark()
    await admin.patch(`/api/cms/post/${post.id}`, { status: 'draft', slug: 'tajny' })
    const un = (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.type === 'entry.unpublished')
    expect(un(await waitForHooks(mark, (h) => !!un(h)))!.json.paths).toEqual(['/blog/verejny'])
  })

  it('stays quiet about drafts nobody can see on the website', async () => {
    const a = await createAuthor(admin)
    const mark = hooksMark()
    const draft = await createPost(author, { author: a.id })
    await author.patch(`/api/cms/post/${draft.id}`, { title: 'Still a draft' })
    await settle()
    expect(receivedHooks(mark).filter((h) => h.json.id === draft.id)).toEqual([])
  })

  it('reports live content without a publish workflow, and globals', async () => {
    const mark = hooksMark()
    await createTag(admin)
    expect((await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Web' })).status).toBe(200)
    const mine = (h: ReceivedHook[]) => h.filter((x) => x.path === '/ok' && ['tag', 'siteSettings'].includes(x.json.entity))
    const hooks = mine(await waitForHooks(mark, (h) => mine(h).length >= 2))
    expect(hooks.map((x) => x.json.type).sort()).toEqual(['entry.created', 'global.updated'])
  })
})

describe('response headers', () => {
  it('stop the admin from being framed and give every response a request id', async () => {
    const res = await fetch(`${anonymous().baseURL}/admin/login`)
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(res.headers.get('referrer-policy')).toBe('same-origin')
    expect(res.headers.get('x-request-id')).toMatch(/^[\w.-]{8,64}$/)
  })

  it('keep a sane incoming request id and replace a hostile one', async () => {
    const base = anonymous().baseURL
    expect((await fetch(`${base}/api/cms/_auth/status`, { headers: { 'x-request-id': 'req-12345678' } })).headers.get('x-request-id')).toBe('req-12345678')
    expect((await fetch(`${base}/api/cms/_auth/status`, { headers: { 'x-request-id': 'a b<script>' } })).headers.get('x-request-id')).not.toContain('<')
  })

  it('never let the admin API be cached by shared caches', async () => {
    const res = await admin.get('/api/cms/_graph')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe.skipIf(!process.env.TEST_REDIS_URL)('changes from other replicas', () => {
  it('clear this instance’s redirect cache at once', async () => {
    const base = anonymous().baseURL
    const raw = (path: string) => fetch(base + path, { redirect: 'manual' })
    // Warm the cache, then add a redirect behind its back (as another replica would).
    expect((await raw('/z-repliky')).status).not.toBe(301)
    await db.query(`insert into redirect ("from", "to", permanent) values ('/z-repliky', '/jinam', true)`)
    expect((await raw('/z-repliky')).status).not.toBe(301) // still cached

    const { default: Redis } = await import('ioredis')
    const r = new Redis(process.env.TEST_REDIS_URL!)
    // Channels are namespaced by database name (cms.redis.prefix default).
    const dbName = new URL(inject('databaseUrl')).pathname.slice(1)
    await r.publish(`cms:${dbName}:changes`, JSON.stringify({ origin: 'another-replica', change: { type: 'entry.created', entity: 'redirect', id: 'x' } }))
    await r.quit()
    await settle()
    const res = await raw('/z-repliky')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/jinam')
  })
})
