import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, doc, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'

const db = testDb()
let admin: Client
let author: any
let tag: any

beforeAll(async () => { admin = await signIn('admin') })
beforeEach(async () => {
  await truncateAll(db)
  author = await createAuthor(admin, { name: 'Carol', email: 'carol@example.com' })
  tag = await createTag(admin, { name: 'News', slug: 'news' })
})
afterAll(() => db.end())

const publish = (over: Record<string, unknown> = {}) => createPost(admin, { author: author.id, tags: [tag.id], status: 'published', ...over })
const draft = (over: Record<string, unknown> = {}) => createPost(admin, { author: author.id, status: 'draft', ...over })

describe('collection list', () => {
  it('serves only published items, to anyone', async () => {
    await publish({ title: 'Live', slug: 'live' })
    await draft({ title: 'Secret draft', slug: 'secret' })
    const res = await anonymous().get('/api/content/post')
    expect(res.status).toBe(200)
    expect(res.body.items.map((i: any) => i.slug)).toEqual(['live'])
    expect(res.body.total).toBe(1)
  })

  it('populates relations and media into nested objects and never leaks raw FK ids', async () => {
    const media = (await admin.upload('/api/cms/_media', { name: 'hero.png', type: 'image/png', data: PNG_1x1 })).body
    await publish({ slug: 'p', hero: media.id })
    const [item] = (await anonymous().get('/api/content/post')).body.items
    expect(item.author).toEqual({ id: author.id, name: 'Carol', bio: null, position: null })
    expect(item.tags).toEqual([{ id: tag.id, name: 'News', slug: 'news' }])
    expect(item.hero).toEqual({ id: media.id, url: media.url, width: 1, height: 1, alt: null, mime: 'image/png', focal: null })
    expect(item).not.toHaveProperty('authorId')
    expect(item).not.toHaveProperty('heroId')
  })

  it('never exposes hidden fields, not even through filters or sort', async () => {
    const res = await anonymous().get('/api/content/author')
    expect(res.body.items[0]).not.toHaveProperty('email')
    // A hidden field cannot be used as a filter (would be an oracle) …
    const filtered = await anonymous().get('/api/content/author?email=nobody@example.com')
    expect(filtered.body.total).toBe(1)
    // … nor as a sort key (falls back to createdAt instead of erroring).
    expect((await anonymous().get('/api/content/author?sort=email')).status).toBe(200)
  })

  it('filters by allowed fields, searches the title and escapes LIKE wildcards', async () => {
    await publish({ title: '100% organic', slug: 'organic' })
    await publish({ title: 'Plain', slug: 'plain' })
    expect((await anonymous().get('/api/content/post?slug=plain')).body.items.map((i: any) => i.slug)).toEqual(['plain'])
    expect((await anonymous().get(`/api/content/post?author=${author.id}`)).body.total).toBe(2)
    expect((await anonymous().get('/api/content/post?q=%25')).body.items.map((i: any) => i.slug)).toEqual(['organic'])
  })

  it('filters a date field by range: from, to (a bare date covers the whole day)', async () => {
    await publish({ title: 'Jaro', slug: 'jaro', publishedAt: '2025-04-14T10:00:00Z' })
    await publish({ title: 'Léto', slug: 'leto', publishedAt: '2025-07-27T18:30:00Z' })
    await publish({ title: 'Loni', slug: 'loni', publishedAt: '2024-08-05T08:00:00Z' })
    const titles = async (q: string) => (await anonymous().get(`/api/content/post?sort=publishedAt&dir=asc&${q}`)).body.items.map((p: any) => p.title)
    expect(await titles('publishedAt.from=2025-01-01&publishedAt.to=2025-12-31')).toEqual(['Jaro', 'Léto'])
    expect(await titles('publishedAt.to=2025-07-27')).toEqual(['Loni', 'Jaro', 'Léto'])
    expect(await titles('publishedAt.to=2025-07-27T18:00:00Z')).toEqual(['Loni', 'Jaro'])
    expect((await anonymous().get('/api/content/post?publishedAt.from=nope')).status).toBe(400)
    expect((await anonymous().get('/api/content/post?publishedAt.from=1')).status).toBe(400) // not an ISO date
    expect((await anonymous().get('/api/content/post?publishedAt.to=%2B275760-09-13')).status).toBe(400)
    expect(await titles('publishedAt.to=2025-07-27T18:00')).toEqual(['Loni', 'Jaro']) // no offset: UTC
    expect(await titles('publishedAt.to=2025-07-27T20:30%2B02:00')).toEqual(['Loni', 'Jaro', 'Léto'])
    expect(await titles('publishedAt.from.x=2026-01-01')).toHaveLength(3) // not a filter
    expect(await titles('title.from=2025-01-01')).toHaveLength(3) // not a date field: ignored
  })

  it('ignores an unknown sort key and caps the page size', async () => {
    await publish()
    expect((await anonymous().get('/api/content/post?sort=constructor')).status).toBe(200)
    expect((await anonymous().get('/api/content/post?limit=5000')).body.limit).toBe(100)
  })

  it('is cacheable by default', async () => {
    const res = await anonymous().get('/api/content/post')
    expect(res.headers.get('cache-control')).toMatch(/^public, /)
  })

  it('lets browsers check back cheaply: an ETag, 304 while unchanged, the new answer once changed', async () => {
    const post = await publish({ title: 'První verze', slug: 'prvni' })
    const first = await anonymous().get('/api/content/post/prvni')
    // Browsers ask every time (a CDN may keep it for a while).
    expect(first.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate, s-maxage=300')
    const etag = first.headers.get('etag')!
    expect(etag).toMatch(/^W\/".+"$/)
    const again = await anonymous().get('/api/content/post/prvni', { 'if-none-match': etag })
    expect(again.status).toBe(304)
    expect(again.body).toBeFalsy()
    // A published change: the old fingerprint no longer matches, the new content comes back.
    await admin.request('PATCH', `/api/cms/post/${post.id}`, { json: { title: 'Druhá verze' } })
    const changed = await anonymous().get('/api/content/post/prvni', { 'if-none-match': etag })
    expect(changed.status).toBe(200)
    expect(changed.body.item.title).toBe('Druhá verze')
    expect(changed.headers.get('etag')).not.toBe(etag)
    // Lists and globals too.
    const list = await anonymous().get('/api/content/post')
    expect((await anonymous().get('/api/content/post', { 'if-none-match': list.headers.get('etag')! })).status).toBe(304)
  })

  it('answers 404 for an unknown collection and for a global on the collection route', async () => {
    expect((await anonymous().get('/api/content/nope')).status).toBe(404)
    expect((await anonymous().get('/api/content/siteSettings')).status).toBe(404)
  })
})

describe('single item', () => {
  it('finds a published item by slug, and by id', async () => {
    const post = await publish({ slug: 'hello' })
    expect((await anonymous().get('/api/content/post/hello')).body.item.id).toBe(post.id)
    expect((await anonymous().get(`/api/content/post/${post.id}`)).body.item.slug).toBe('hello')
  })

  it('answers 404 for a draft, exactly like a missing item', async () => {
    const post = await draft({ slug: 'wip' })
    expect((await anonymous().get('/api/content/post/wip')).status).toBe(404)
    expect((await anonymous().get(`/api/content/post/${post.id}`)).status).toBe(404)
  })
})

describe('draft preview', () => {
  it('shows a draft to a signed-in editor with ?preview, never cached', async () => {
    await draft({ slug: 'wip', title: 'Work in progress' })
    const res = await admin.get('/api/content/post/wip?preview')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ preview: true, item: { title: 'Work in progress' } })
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('does not let an anonymous visitor preview', async () => {
    await draft({ slug: 'wip' })
    expect((await anonymous().get('/api/content/post/wip?preview')).status).toBe(404)
    expect((await anonymous().get('/api/content/post/wip?preview=1')).status).toBe(404)
  })

  it('lays an editor’s unsaved values over their own preview only, while they type', async () => {
    const post = await publish({ slug: 'live', title: 'Saved title' })
    const typed = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'typed', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }
    const sent = await admin.post('/api/cms/_preview', { entity: 'post', id: post.id, locale: null, data: { title: 'Typed title', body: typed } })
    expect(sent.status).toBe(204)

    const mine = await admin.get('/api/content/post/live?preview')
    expect(mine.body.item.title).toBe('Typed title')
    expect(JSON.stringify(mine.body.item.body)).toContain('typed')
    expect(JSON.stringify(mine.body.item.body)).not.toContain('javascript:') // checked as a save would be
    expect(mine.headers.get('cache-control')).toBe('private, no-store')
    expect((await admin.get('/api/content/post?preview')).body.items[0].title).toBe('Typed title')

    // Nobody else sees them: not the public, not another editor.
    expect((await anonymous().get('/api/content/post/live')).body.item.title).toBe('Saved title')
    expect((await admin.get('/api/content/post/live')).body.item.title).toBe('Saved title')
    const editor = await signIn('editor')
    expect((await editor.get('/api/content/post/live?preview')).body.item.title).toBe('Saved title')

    // Closing the editor drops them.
    await admin.post('/api/cms/_preview', { entity: 'post', id: post.id, locale: null, clear: true })
    expect((await admin.get('/api/content/post/live?preview')).body.item.title).toBe('Saved title')
  })

  it('keeps the saved value where a typed one is not valid yet', async () => {
    const post = await publish({ slug: 'live', title: 'Saved title' })
    await admin.post('/api/cms/_preview', { entity: 'post', id: post.id, locale: null, data: { title: 42 } })
    expect((await admin.get('/api/content/post/live?preview')).body.item.title).toBe('Saved title')
    expect((await anonymous().post('/api/cms/_preview', { entity: 'post', id: post.id, data: { title: 'x' } })).status).toBe(401)
  })

  it('does not turn a published item into a preview response for anonymous callers', async () => {
    await publish({ slug: 'live' })
    const res = await anonymous().get('/api/content/post/live?preview')
    expect(res.status).toBe(200)
    expect(res.body.preview).toBeUndefined()
  })
})

describe('rich text on the public API', () => {
  it('is sanitised on write, so consumers never receive a script link', async () => {
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }
    await publish({ slug: 'xss', body })
    const item = (await anonymous().get('/api/content/post/xss')).body.item
    expect(JSON.stringify(item.body)).not.toContain('javascript:')
    expect(item.body.content[0].content[0].text).toBe('click')
  })

  it('round-trips a normal document unchanged', async () => {
    await publish({ slug: 'fine', body: doc('Just text') })
    expect((await anonymous().get('/api/content/post/fine')).body.item.body).toEqual(doc('Just text'))
  })
})

describe('unknown API addresses', () => {
  it('answer 404 at once, never rendered as a website page (no request loop)', async () => {
    for (const path of ['/api/content/page/a/b', '/api/content/nothing/a/b/c', '/api/cms/nothing/a/b', '/api/content/.well-known/x']) {
      const started = Date.now()
      const res = await anonymous().request('GET', path, { headers: { accept: 'text/html' } })
      expect(res.status, path).toBe(404)
      expect(Date.now() - started, path).toBeLessThan(2000)
    }
  })
})

