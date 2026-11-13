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

  it('ignores an unknown sort key and caps the page size', async () => {
    await publish()
    expect((await anonymous().get('/api/content/post?sort=constructor')).status).toBe(200)
    expect((await anonymous().get('/api/content/post?limit=5000')).body.limit).toBe(100)
  })

  it('is cacheable by default', async () => {
    const res = await anonymous().get('/api/content/post')
    expect(res.headers.get('cache-control')).toMatch(/^public, /)
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
