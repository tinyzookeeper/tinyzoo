import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, doc, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

const db = testDb()
let admin: Client
beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const raw = (path: string) => fetch(anonymous().baseURL + path, { redirect: 'manual' })

describe('redirects', () => {
  it('sends old addresses to new ones, permanently by default, keeping the query', async () => {
    expect((await admin.post('/api/cms/redirect', { from: '/stara-stranka', to: '/nova-stranka' })).status).toBe(201)
    const res = await raw('/stara-stranka?utm=x')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/nova-stranka?utm=x')
    expect((await raw('/stara-stranka/')).status).toBe(301) // trailing slash
  })

  it('can be temporary, and stops at once when removed', async () => {
    const r = (await admin.post('/api/cms/redirect', { from: '/akce', to: 'https://example.com/akce', permanent: false })).body.row
    expect((await raw('/akce')).status).toBe(302)
    await admin.delete(`/api/cms/redirect/${r.id}`)
    expect((await raw('/akce')).status).not.toBe(302)
  })

  it('only accepts addresses on this site as the source, and never touches the API or admin', async () => {
    expect((await admin.post('/api/cms/redirect', { from: 'https://evil.test/x', to: '/y' })).status).toBe(422)
    expect((await admin.post('/api/cms/redirect', { from: '//evil.test', to: '/y' })).status).toBe(422)
    await db.query(`insert into redirect ("from", "to", permanent) values ('/api/cms/_graph', '/x', true)`)
    expect((await raw('/api/cms/_graph')).status).toBe(401)
  })
})

describe('sitemap', () => {
  it('lists published items at their website address, per language, with alternates', async () => {
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id, status: 'published', slug: 'kvaskovy-chleb', body: doc('x') })
    await admin.request('PATCH', `/api/cms/post/${post.id}?locale=en`, { json: { slug: 'sourdough-bread' } })
    await createPost(admin, { author: author.id, slug: 'koncept' }) // draft: not listed

    const json = (await anonymous().get('/api/content/_sitemap')).body.entries
    expect(json.map((e: any) => e.loc).sort()).toEqual(['/blog/kvaskovy-chleb', '/en/blog/sourdough-bread'])
    expect(json[0].alternates).toHaveLength(2)

    const res = await raw('/sitemap.xml')
    expect(res.headers.get('content-type')).toContain('application/xml')
    const xml = await res.text()
    expect(xml).toContain(`<loc>${anonymous().baseURL}/blog/kvaskovy-chleb</loc>`)
    expect(xml).toContain(`hreflang="en" href="${anonymous().baseURL}/en/blog/sourdough-bread"`)
    expect(xml).not.toContain('koncept')
  })
})

describe('navigation', () => {
  it('delivers menus as lists of links, per language', async () => {
    const link = (label: string, url: string) => ({ id: label, type: 'link', label, url, newTab: false })
    expect((await admin.put('/api/cms/_singleton/navigation', { main: [link('O nás', '/o-nas'), link('Kontakt', '/kontakt')], footer: [] })).status).toBe(200)
    expect((await admin.request('PUT', '/api/cms/_singleton/navigation?locale=en', { json: { main: [link('About', '/en/about')] } })).status).toBe(200)
    expect((await admin.get('/api/cms/_singleton/navigation?locale=en')).body.row).toMatchObject({ __translated: true, __locales: ['cs', 'en'] })

    const cs = (await anonymous().get('/api/content/_global/navigation')).body.item
    expect(cs.main.map((l: any) => l.label)).toEqual(['O nás', 'Kontakt'])
    const en = (await anonymous().get('/api/content/_global/navigation?locale=en')).body.item
    expect(en.main).toEqual([{ id: 'About', type: 'link', label: 'About', url: '/en/about', newTab: false }])
    expect(en.footer).toEqual([])
  })
})
