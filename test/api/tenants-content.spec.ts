import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Client, doc } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'
import { expectNoSiteErrors, siteClient, siteMail, siteQuery, startTenants, type Tenants, type TenantSite, tenantGet, until, waitForSiteMail } from '../helpers/tenants'

// Two sites in one process: what a visitor gets. The public content API in all its kinds,
// the pages rendered on the server, the sitemap and the API description, the editor's
// preview, redirects, forms and a public rate limit.
//
// Site B's database is a copy of site A's made after the "shared" content below existed:
// the same ids, addresses and slugs on both. After the copy each site got content of its
// own and its own version of the shared entries, so every answer can be told apart.
let t: Tenants
let shared: { post: string; page: string; author: string }
let adminA: Client
let adminB: Client
/** A word that is in one site's content only (for search and "is it anywhere in the answer"). */
const WORD = { a: 'alfaslovo', b: 'betaslovo' }

beforeAll(async () => {
  t = await startTenants('content', {}, {
    async seed({ admin }) {
      const author = await createAuthor(admin, { name: 'Shared Author' })
      await createPost(admin, { author: author.id, title: 'Shared post', slug: 'shared-post', status: 'published', body: doc('Sdílený text') })
      const page = await admin.post('/api/cms/page', { title: 'Shared page', slug: 'shared-page', status: 'published', sections: [] })
      if (page.status !== 201) throw new Error(`seed page: ${page.status} ${JSON.stringify(page.body)}`)
      const redirect = await admin.post('/api/cms/redirect', { from: '/shared-old', to: '/shared-page' })
      if (redirect.status !== 201) throw new Error(`seed redirect: ${redirect.status} ${JSON.stringify(redirect.body)}`)
      await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Shared name' })
    },
  })
  adminA = siteClient(t.a, 'admin')
  adminB = siteClient(t.b, 'admin')
  shared = {
    post: (await siteQuery(t.a, `select id from post where slug = 'shared-post'`))[0].id,
    page: (await siteQuery(t.a, `select id from page where slug = 'shared-page'`))[0].id,
    author: (await siteQuery(t.a, 'select id from author limit 1'))[0].id,
  }
  expect((await siteQuery(t.b, `select id from post where slug = 'shared-post'`))[0].id).toBe(shared.post)

  // Each site's own content, and its own version of what both have.
  for (const [site, admin, s] of [[t.a, adminA, 'a'], [t.b, adminB, 'b']] as const) {
    const word = WORD[s]
    await createPost(admin, { author: shared.author, title: `Only on ${s.toUpperCase()} ${word}`, slug: `only-on-${s}`, status: 'published', body: doc(`Text ${word}`) })
    await createPost(admin, { author: shared.author, title: `Draft on ${s.toUpperCase()}`, slug: `draft-on-${s}`, body: doc('Koncept') })
    await createTag(admin, { name: `Tag ${word}`, slug: `tag-${s}` })
    await createAuthor(admin, { name: `Author ${word}` })
    expect((await admin.patch(`/api/cms/post/${shared.post}`, { title: `Shared post as ${word}`, body: doc(`Sdílený text ${word}`) })).status).toBe(200)
    expect((await admin.patch(`/api/cms/page/${shared.page}`, { title: `Shared page as ${word}` })).status).toBe(200)
    expect((await admin.post('/api/cms/page', { title: `Page ${word}`, slug: `page-${s}`, status: 'published', sections: [] })).status).toBe(201)
    expect((await admin.post('/api/cms/page', { title: `Child ${word}`, slug: `child-${s}`, status: 'published', sections: [], parent: shared.page })).status).toBe(201)
    expect((await admin.put('/api/cms/_singleton/siteSettings', { siteName: `Site ${word}`, tagline: `Tagline ${word}` })).status).toBe(200)
    expect((await admin.post('/api/cms/events', { title: `Event ${word}`, startsAt: new Date(Date.now() + 86_400_000).toISOString() })).status).toBe(201)
    void site
  }
}, 120_000)
afterAll(async () => {
  try { expectNoSiteErrors(t) }
  finally { await t?.stop() }
})

const other = (s: 'a' | 'b') => (s === 'a' ? 'b' : 'a')
const sites = () => [['a', t.a], ['b', t.b]] as const
const text = async (site: TenantSite, path: string, headers: Record<string, string> = {}) => {
  const res = await tenantGet(site.url, path, '', headers)
  return { status: res.status, text: res.text, body: res.body, headers: res.headers }
}

describe('the public content API', () => {
  it('lists, single entries, the page tree, globals and plugin routes answer from the site\'s own database', async () => {
    // Asked in turn (A, B, A, B): an answer kept from the other site would show here.
    for (let round = 0; round < 2; round++) {
      for (const [s, site] of sites()) {
        const mine = WORD[s]
        const theirs = WORD[other(s)]
        const paths = [
          '/api/content/post', '/api/content/post?limit=50&sort=-publishedAt', '/api/content/tag', '/api/content/author', '/api/content/page',
          '/api/content/post/shared-post', `/api/content/post/${shared.post}`, `/api/content/post/only-on-${s}`,
          '/api/content/_tree/page', '/api/content/page/shared-page', `/api/content/page/page-${s}`,
          '/api/content/_global/siteSettings', '/api/content/_events/next',
          `/api/content/_search?q=${mine}`, '/api/content/_search?q=shared',
        ]
        for (const path of paths) {
          const res = await text(site, path)
          expect(res.status, `${s} ${path}`).toBe(200)
          expect(res.text, `${s} ${path}`).toContain(mine)
          expect(res.text, `${s} ${path}`).not.toContain(theirs)
          expect(res.text, `${s} ${path}`).not.toContain(`only-on-${other(s)}`)
        }
      }
    }
  })

  it('what exists on one site only is 404 on the other: by slug, by id, as a page, in search', async () => {
    const onlyA = (await siteQuery(t.a, `select id from post where slug = 'only-on-a'`))[0].id
    for (const path of ['/api/content/post/only-on-a', `/api/content/post/${onlyA}`, '/api/content/page/page-a', '/api/content/page/shared-page%2Fchild-a']) {
      expect((await text(t.a, path)).status, `A ${path}`).toBe(200)
      expect((await text(t.b, path)).status, `B ${path}`).toBe(404)
    }
    expect((await text(t.b, `/api/content/_search?q=${WORD.a}`)).body.items).toEqual([])
    expect((await text(t.a, `/api/content/_search?q=${WORD.b}`)).body.items).toEqual([])
    // A draft stays a draft on both, and its preview needs the site's own session.
    expect((await text(t.a, '/api/content/post/draft-on-a')).status).toBe(404)
    expect((await siteClient(t.a, 'editor').get('/api/content/post/draft-on-a?preview')).status).toBe(200)
    expect((await siteClient(t.b, { cookie: t.a.cookies.editor }).get('/api/content/post/draft-on-b?preview')).status).toBe(404)
  })

  it('a change published on A shows on A at once and never on B (lists, search, sitemap, the tree)', async () => {
    const made = await createPost(adminA, { author: shared.author, title: 'Fresh alfaslovo novinka', slug: 'fresh-on-a', status: 'published', body: doc('Čerstvé') })
    const page = await adminA.post('/api/cms/page', { title: 'Fresh page alfaslovo', slug: 'fresh-page-a', status: 'published', sections: [] })
    expect(page.status).toBe(201)
    for (const path of ['/api/content/post', '/api/content/_search?q=novinka', '/api/content/_sitemap', '/api/content/_tree/page', '/sitemap.xml']) {
      expect((await text(t.a, path)).text, `A ${path}`).toMatch(/fresh-on-a|fresh-page-a/)
      expect((await text(t.b, path)).text, `B ${path}`).not.toMatch(/fresh-on-a|fresh-page-a|Fresh/)
    }
    expect((await text(t.b, '/api/content/_search?q=novinka')).body.total).toBe(0)
    // Deleting on B the entry id that both have removes B's and leaves A's.
    expect((await adminB.delete(`/api/cms/page/${page.body.row.id}`)).status).toBe(404)
    expect((await adminA.delete(`/api/cms/post/${made.id}`)).status).toBe(200)
  })

  it('an unchanged answer is "304 Not Modified" only for the site it came from', async () => {
    // The same address and the same entry id on both sites, with different content: the
    // fingerprint of A's answer must not make B say "you have it already".
    const a = await text(t.a, '/api/content/post/shared-post')
    const etag = a.headers.get('etag')!
    expect(etag).toBeTruthy()
    expect((await text(t.a, '/api/content/post/shared-post', { 'if-none-match': etag })).status).toBe(304)
    const b = await text(t.b, '/api/content/post/shared-post', { 'if-none-match': etag })
    expect(b.status).toBe(200)
    expect(b.text).toContain(WORD.b)
  })
})

describe('pages rendered on the server', () => {
  it('fetch their content inside the site that was asked: each site\'s blog shows its own posts and name', async () => {
    for (const [s, site] of [...sites(), ...sites()]) {
      const blog = await text(site, '/blog')
      expect(blog.status).toBe(200)
      expect(blog.text).toContain(`Only on ${s.toUpperCase()}`)
      expect(blog.text).toContain(`Site ${WORD[s]}`)
      expect(blog.text).not.toContain(WORD[other(s)])
      const post = await text(site, '/blog/shared-post')
      expect(post.text).toContain(`Shared post as ${WORD[s]}`)
      expect(post.text).not.toContain(WORD[other(s)])
      expect((await text(site, `/blog/only-on-${other(s)}`)).text).toContain('Post not found.')
      // Nothing in the page (its data payload included) names the other site's address.
      expect(blog.text).not.toContain(sites().find(([x]) => x !== s)![1].host)
    }
  })

  it('rendered for both sites at the same moment, each page still has only its own content', async () => {
    const pages = await Promise.all(Array.from({ length: 12 }, (_, i) => text(i % 2 ? t.b : t.a, i % 3 ? '/blog' : '/blog/shared-post')))
    pages.forEach((page, i) => {
      const s = i % 2 ? 'b' : 'a'
      expect(page.status).toBe(200)
      expect(page.text, `page ${i}`).toContain(WORD[s])
      expect(page.text, `page ${i}`).not.toContain(WORD[other(s)])
    })
  })
})

describe('the sitemap and the API description', () => {
  it('/sitemap.xml names its own host and lists its own addresses, asked in turn inside its cache time', async () => {
    for (const [s, site] of [...sites(), ...sites(), ...sites()]) {
      const res = await text(site, '/sitemap.xml')
      expect(res.status).toBe(200)
      const locs = [...res.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!)
      expect(locs.length).toBeGreaterThan(3)
      for (const loc of locs) expect(loc.startsWith(`${site.url}/`), `${s}: ${loc}`).toBe(true)
      expect(locs).toContain(`${site.url}/blog/only-on-${s}`)
      expect(locs).toContain(`${site.url}/page-${s}`)
      expect(locs).toContain(`${site.url}/blog/shared-post`)
      expect(res.text).not.toContain(`only-on-${other(s)}`)
      expect(res.text).not.toContain(`page-${other(s)}`)
      expect(res.text).not.toContain(sites().find(([x]) => x !== s)![1].host)
      // The addresses in other languages (hreflang) are the site's own too.
      for (const m of res.text.matchAll(/href="(https?:[^"]+)"/g)) expect(m[1]!.startsWith(`${site.url}/`), `${s}: ${m[1]}`).toBe(true)
    }
  })

  it('/api/content/_sitemap lists the same addresses per site', async () => {
    for (const [s, site] of [...sites(), ...sites()]) {
      const locs = (await text(site, '/api/content/_sitemap')).body.entries.map((e: any) => e.loc)
      expect(locs).toContain(`/blog/only-on-${s}`)
      expect(locs).not.toContain(`/blog/only-on-${other(s)}`)
      expect(locs).toContain(`/shared-page/child-${s}`)
      expect(locs).not.toContain(`/shared-page/child-${other(s)}`)
    }
  })

  it('/api/openapi.json names the site\'s own address as its server, asked in turn', async () => {
    for (const [, site] of [...sites(), ...sites(), ...sites()]) {
      const res = await text(site, '/api/openapi.json')
      expect(res.status).toBe(200)
      expect(res.body.servers).toEqual([{ url: site.url }])
      expect(res.text).not.toContain(site === t.a ? t.b.host : t.a.host)
    }
  })

  it('/robots.txt names its own site\'s sitemap', async ({ skip }) => {
    // The starter's and the templates' robots.txt route writes the sitemap's address from the
    // site's own settings; the playground, which this suite runs, has no such route.
    const a = await text(t.a, '/robots.txt')
    if (a.status === 404) skip('the playground has no /robots.txt')
    for (const [, site] of [...sites(), ...sites()]) {
      const res = await text(site, '/robots.txt')
      expect(res.status).toBe(200)
      expect(res.text).toContain(`${site.url}/sitemap.xml`)
      expect(res.text).not.toContain(site === t.a ? t.b.host : t.a.host)
    }
  })
})

describe('the editor\'s live preview', () => {
  it('unsaved values typed on A show in that editor\'s preview on A, and never on B for the same account id and entry id', async () => {
    expect(t.a.users.admin).toBe(t.b.users.admin)
    const sent = await adminA.post('/api/cms/_preview', { entity: 'post', id: shared.post, locale: null, data: { title: 'Typed on A, not saved' } })
    expect(sent.status).toBe(204)
    expect((await adminA.get('/api/content/post/shared-post?preview')).body.item.title).toBe('Typed on A, not saved')
    // The same person (same id), the same entry (same id), the other site: the saved title of that site.
    const onB = await adminB.get('/api/content/post/shared-post?preview')
    expect(onB.status).toBe(200)
    expect(onB.body.item.title).toBe(`Shared post as ${WORD.b}`)
    expect(JSON.stringify((await adminB.get('/api/content/post?preview')).body)).not.toContain('Typed on A')
    // A's session on B gets no preview at all, and the page rendered for B shows nothing typed.
    expect(JSON.stringify((await siteClient(t.b, { cookie: t.a.cookies.admin }).get('/api/content/post/shared-post?preview')).body)).not.toContain('Typed on A')
    expect((await tenantGet(t.b.url, '/blog/shared-post?preview=1', t.b.cookies.admin)).text).not.toContain('Typed on A')

    // B's editor types too: two drafts under the same key, one per site.
    expect((await adminB.post('/api/cms/_preview', { entity: 'post', id: shared.post, locale: null, data: { title: 'Typed on B, not saved' } })).status).toBe(204)
    expect((await adminA.get('/api/content/post/shared-post?preview')).body.item.title).toBe('Typed on A, not saved')
    expect((await adminB.get('/api/content/post/shared-post?preview')).body.item.title).toBe('Typed on B, not saved')
    // Closing the editor on B drops B's draft only.
    await adminB.post('/api/cms/_preview', { entity: 'post', id: shared.post, locale: null, clear: true })
    expect((await adminA.get('/api/content/post/shared-post?preview')).body.item.title).toBe('Typed on A, not saved')
    expect((await adminB.get('/api/content/post/shared-post?preview')).body.item.title).toBe(`Shared post as ${WORD.b}`)
    await adminA.post('/api/cms/_preview', { entity: 'post', id: shared.post, locale: null, clear: true })
  })
})

describe('redirects', () => {
  const hit = (site: TenantSite, path: string) => fetch(site.url + path, { redirect: 'manual' }).then((r) => ({ status: r.status, location: r.headers.get('location') }))

  it('a redirect made on A acts on A at once and not on B, also while B keeps its list for 30 seconds', async () => {
    // B first (it now holds its list of redirects in memory), then A, then B again.
    expect((await hit(t.b, '/moved-on-a')).status).not.toBe(301)
    expect((await hit(t.a, '/moved-on-a')).status).not.toBe(301)
    expect((await adminA.post('/api/cms/redirect', { from: '/moved-on-a', to: '/page-a' })).status).toBe(201)
    expect(await hit(t.a, '/moved-on-a')).toEqual({ status: 301, location: '/page-a' })
    expect((await hit(t.b, '/moved-on-a')).status).not.toBe(301)
    // And the other way round, with the same old address leading somewhere else.
    expect((await adminB.post('/api/cms/redirect', { from: '/moved-on-a', to: '/page-b', permanent: false })).status).toBe(201)
    expect(await hit(t.b, '/moved-on-a')).toEqual({ status: 302, location: '/page-b' })
    expect(await hit(t.a, '/moved-on-a')).toEqual({ status: 301, location: '/page-a' })
  })

  it('a redirect both sites have (the same row id) is removed on A only when A removes it', async () => {
    expect((await hit(t.a, '/shared-old')).status).toBe(301)
    expect((await hit(t.b, '/shared-old')).status).toBe(301)
    const id = (await siteQuery(t.a, `select id from redirect where "from" = '/shared-old'`))[0].id
    expect((await adminA.delete(`/api/cms/redirect/${id}`)).status).toBe(200)
    expect((await hit(t.a, '/shared-old')).status).not.toBe(301)
    expect((await hit(t.b, '/shared-old')).status).toBe(301)
  })
})

describe('forms', () => {
  const good = { name: 'Jana', email: 'jana@example.com', message: 'Kdy je další závod?', consent: true, _t: 5000 }
  const send = (c: Client, body: Record<string, unknown> = good) => c.post('/api/content/_form/contactForm', body)

  it('a message sent on A is stored in A\'s database and mailed to A\'s address from A\'s folder, with A\'s admin link', async () => {
    expect((await siteClient(t.a).get('/api/content/_form/contactForm')).status).toBe(200)
    expect((await send(siteClient(t.a), { ...good, message: 'Zpráva pro A' })).status).toBe(201)
    expect((await siteQuery(t.a, 'select message from contact_form')).map((r) => r.message)).toEqual(['Zpráva pro A'])
    expect(await siteQuery(t.b, 'select 1 from contact_form')).toEqual([])

    // The address comes from the site's own settings (the directory: forms.notifyTo).
    const mail = await waitForSiteMail(t.a, 'owner@site-a.test')
    expect(mail.text).toContain('Zpráva pro A')
    expect(mail.text).toContain(`${t.a.url}/admin/contactForm/`)
    expect(mail.text + mail.html).not.toContain(t.b.host)
    await new Promise((r) => setTimeout(r, 300))
    expect(siteMail(t.b)).toEqual([])
    expect(siteMail(t.a, 'owner@site-b.test')).toEqual([])

    // And B's own message goes to B's address only.
    expect((await send(siteClient(t.b), { ...good, message: 'Zpráva pro B' })).status).toBe(201)
    const toB = await waitForSiteMail(t.b, 'owner@site-b.test')
    expect(toB.text).toContain('Zpráva pro B')
    expect(toB.text).toContain(`${t.b.url}/admin/contactForm/`)
    expect(siteMail(t.a).filter((m) => m.text.includes('Zpráva pro B'))).toEqual([])
    expect((await siteQuery(t.b, 'select message from contact_form')).map((r) => r.message)).toEqual(['Zpráva pro B'])
  })

  it('the people in A\'s Forms settings get A\'s messages; B\'s settings are B\'s', async () => {
    expect((await adminA.put('/api/cms/_singleton/formSettings', { notifyTo: [{ id: 'a', type: 'item', email: 'office-a@example.com' }] })).status).toBe(200)
    expect((await send(siteClient(t.a), { ...good, message: 'Druhá zpráva pro A' })).status).toBe(201)
    await waitForSiteMail(t.a, 'office-a@example.com', (m) => m.text.includes('Druhá zpráva pro A'))
    expect((await send(siteClient(t.b), { ...good, message: 'Druhá zpráva pro B' })).status).toBe(201)
    await waitForSiteMail(t.b, 'owner@site-b.test', (m) => m.text.includes('Druhá zpráva pro B'))
    expect(siteMail(t.b, 'office-a@example.com')).toEqual([])
    expect(siteMail(t.a, 'office-a@example.com').filter((m) => m.text.includes('pro B'))).toEqual([])
  })

  it('a form on A takes submissions from A\'s pages only: B\'s origin is another site', async () => {
    const from = (origin: string) => siteClient(t.a).request('POST', '/api/content/_form/contactForm', { json: good, headers: { origin } })
    expect((await from(t.b.url)).status).toBe(403)
    expect((await from(t.a.url)).status).toBe(201)
  })

  it('the limit on messages is counted per site: a visitor who used up A\'s can still write to B', async () => {
    const visitor = siteClient(t.a)
    const sameVisitorOnB = siteClient(t.b)
    sameVisitorOnB.ip = visitor.ip // one person, one address, two websites
    const codes: number[] = []
    for (let i = 0; i < 9; i++) codes.push((await send(visitor)).status)
    expect(codes).toEqual([201, 201, 201, 201, 201, 201, 201, 201, 429])
    expect((await send(sameVisitorOnB)).status).toBe(201)
    // The search limit likewise (120 a minute): exhausted on A, open on B.
    const search = (c: Client) => c.get('/api/content/_search?q=shared')
    const statuses = await Promise.all(Array.from({ length: 125 }, () => search(visitor)))
    expect(statuses.filter((r) => r.status === 429).length).toBeGreaterThan(0)
    expect((await search(visitor)).status).toBe(429)
    expect((await search(sameVisitorOnB)).status).toBe(200)
  })
})

describe('where the search index is built', () => {
  it('each site\'s index holds its own entries (the shared entry id once per site, with that site\'s text)', async () => {
    const rows = (site: TenantSite) => siteQuery(site, 'select * from cms_search').then((r) => JSON.stringify(r))
    await until('A\'s index', () => rows(t.a), (r) => r.includes(WORD.a))
    expect(await rows(t.a)).not.toContain(WORD.b)
    expect(await rows(t.b)).toContain(WORD.b)
    expect(await rows(t.b)).not.toContain(WORD.a)
  })
})
