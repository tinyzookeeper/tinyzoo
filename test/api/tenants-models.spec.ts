import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client, doc } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'
import { repoRoot } from '../setup/database'
import { expectNoSiteErrors, siteClient, siteHooks, siteHooksMark, siteMail, siteQuery, startTenants, type Tenants, tenantGet, until, waitForSiteHooks, waitForSiteMail } from '../helpers/tenants'

// Two sites in one process whose content MODELS differ: site A has the playground's own model,
// site B the model `shop` (playground/models/shop). Each site's directory row names its model;
// B's database is new and empty, and the server migrates it with the shop migrations.
//
// What is proven: a type of one model does not exist on the other site (every route that takes
// a type name answers 404), a name both models use (post, tag) means each site's own shape,
// the generated descriptions, the search, the sitemap, the forms, the databases and the
// webhooks of one model never show anything of the other, and a directory row naming a model
// the build does not have is refused without touching the sites that are served.
let t: Tenants
let adminA: Client
let adminB: Client

/** Words that are in one site's content only (for search: far enough apart that a typo-tolerant match cannot cross). */
const WORD = { a: 'kometovnik', b: 'zeppelinova' }

/** The types each model has, by name. `post` and `tag` are in both, with another shape. */
const ONLY_A = ['author', 'page', 'navigation', 'redirect', 'contactForm'] as const
const ONLY_B = ['product', 'category', 'orderForm'] as const
const BOTH = ['post', 'tag', 'events', 'formSettings', 'consent_settings', 'analytics_settings'] as const
const SINGLETON_ONLY_A = 'siteSettings'

const UUID_NOWHERE = '00000000-0000-4000-8000-000000000000'

/** The entities each model's graph lists for the signed-in administrator (singletons, forms and the plugins' entities included). */
const EXPECTED_GRAPH = {
  a: ['analytics_settings', 'author', 'consent_settings', 'contactForm', 'events', 'formSettings', 'navigation', 'page', 'post', 'redirect', 'siteSettings', 'tag'],
  b: ['analytics_settings', 'category', 'consent_settings', 'events', 'formSettings', 'orderForm', 'post', 'product', 'tag'],
}

let authorA: string
let productB: { id: string; slug: string }

beforeAll(async () => {
  t = await startTenants('models', {}, { models: { b: 'shop' } })
  adminA = siteClient(t.a, 'admin')
  adminB = siteClient(t.b, 'admin')

  // Content of each site's own, made before anything is asked of the sitemap (it is cached for a minute).
  authorA = (await createAuthor(adminA, { name: 'Autor A' })).id
  await createPost(adminA, { author: authorA, title: `Příspěvek ${WORD.a}`, slug: 'only-on-a', status: 'published', body: doc(`Text ${WORD.a}`) })
  const made = await adminB.post('/api/cms/product', { title: `Produkt ${WORD.b}`, slug: 'produkt-zeppelinova', price: 120, description: `Popis ${WORD.b}` })
  if (made.status !== 201) throw new Error(`product on B: ${made.status} ${JSON.stringify(made.body)}`)
  productB = { id: made.body.row.id, slug: made.body.row.slug }
}, 240_000)
afterAll(async () => {
  try { expectNoSiteErrors(t) }
  finally { await t?.stop() }
})

const names = (graph: any[]) => graph.map((e) => e.name).sort()
const get = (site: { url: string }, path: string) => tenantGet(site.url, path)

describe('the premise', () => {
  it('B is a site of its own model with its own accounts, and both are served by the same process', async () => {
    expect(t.b.users.admin).not.toBe(t.a.users.admin)
    expect((await adminA.get('/api/cms/_auth/me')).body.user.email).toBe('admin@test.local')
    expect((await adminB.get('/api/cms/_auth/me')).body.user.email).toBe('admin@test.local')
    expect(t.rows[1].model).toBe('shop')
    expect(t.rows[0].model).toBeUndefined()
    // A's session is not B's although the e-mail is the same.
    expect((await siteClient(t.b, { cookie: t.a.cookies.admin }).get('/api/cms/_graph')).status).toBe(401)
  })
})

describe('a type of one model does not exist on the other site', () => {
  /** Admin routes taking a type name, from the files (the method is in the file name). */
  function adminTypeRoutes(name: string): { method: string; path: string; source: string }[] {
    const root = join(repoRoot, 'packages/cms/server/api/cms/[entity]')
    const out: { method: string; path: string; source: string }[] = []
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true }) as any[]) {
      if (!entry.isFile()) continue
      const source = join(entry.parentPath ?? entry.path, entry.name).slice(root.length + 1)
      const m = /^(.*)\.(get|post|put|patch|delete|head)\.ts$/.exec(source)
      if (!m) continue
      const path = m[1]!.split('/').filter((s) => s !== 'index').map((s) => (/^\[(.+)\]$/.test(s) ? UUID_NOWHERE : s)).join('/')
      out.push({ method: m[2]!.toUpperCase(), path: `/api/cms/${name}${path ? `/${path}` : ''}`, source })
    }
    return out
  }

  /** Content routes taking a type name: [entity]/[slug], [entity]/, _tree/[entity], _global/[name]. */
  function contentTypeRoutes(name: string): { method: string; path: string; source: string }[] {
    return [
      { method: 'GET', path: `/api/content/${name}`, source: '[entity]/index.get.ts' },
      { method: 'GET', path: `/api/content/${name}/some-slug`, source: '[entity]/[slug].get.ts' },
      { method: 'GET', path: `/api/content/${name}/${UUID_NOWHERE}`, source: '[entity]/[slug].get.ts (by id)' },
      { method: 'GET', path: `/api/content/_tree/${name}`, source: '_tree/[entity].get.ts' },
      { method: 'GET', path: `/api/content/_global/${name}`, source: '_global/[name].get.ts' },
    ]
  }

  it('finds the routes (the sweep is generated from the files, so it must not quietly find none)', () => {
    const sources = adminTypeRoutes('post').map((r) => `${r.method} ${r.source}`).sort()
    expect(sources).toEqual([
      'DELETE [id].delete.ts', 'GET [id].get.ts', 'GET [id]/revisions/[rev].get.ts', 'GET [id]/revisions/index.get.ts', 'GET _export.get.ts',
      'GET _tree.get.ts', 'GET index.get.ts', 'GET options.get.ts', 'PATCH [id].patch.ts', 'POST _move.post.ts', 'POST _order.post.ts', 'POST index.post.ts',
    ].sort())
    // The content routes above are written out: each must still be a file.
    const content = join(repoRoot, 'packages/cms/server/api/content')
    for (const f of ['[entity]/index.get.ts', '[entity]/[slug].get.ts', '_tree/[entity].get.ts', '_global/[name].get.ts']) expect(readdirSync(content, { recursive: true }), f).toContain(f)
  })

  async function sweep(site: typeof t.a, admin: Client, absent: readonly string[]) {
    const failures: string[] = []
    let calls = 0
    for (const name of absent) {
      for (const r of adminTypeRoutes(name)) {
        const write = r.method !== 'GET' && r.method !== 'HEAD'
        const res = await admin.request(r.method, r.path, write ? { json: {} } : {})
        calls++
        if (res.status !== 404) failures.push(`${site.id} admin ${r.method} ${r.path}: ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`)
      }
      // The admin's singleton routes take a name too.
      for (const method of ['GET', 'PUT'] as const) {
        const res = await admin.request(method, `/api/cms/_singleton/${name}`, method === 'PUT' ? { json: {} } : {})
        calls++
        if (res.status !== 404) failures.push(`${site.id} admin ${method} /api/cms/_singleton/${name}: ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`)
      }
      for (const r of contentTypeRoutes(name)) {
        const res = await get(site, r.path)
        calls++
        if (res.status !== 404) failures.push(`${site.id} content ${r.path}: ${res.status} ${res.text.slice(0, 160)}`)
      }
    }
    return { failures, calls }
  }

  it('A\'s types (and its singleton) are 404 on B in every admin and content route, called as B\'s own administrator', async () => {
    const { failures, calls } = await sweep(t.b, adminB, [...ONLY_A, SINGLETON_ONLY_A])
    expect(failures).toEqual([])
    expect(calls).toBeGreaterThan(100)
  })

  it('B\'s types are 404 on A in every admin and content route, called as A\'s own administrator', async () => {
    const { failures, calls } = await sweep(t.a, adminA, ONLY_B)
    expect(failures).toEqual([])
    expect(calls).toBeGreaterThan(50)
  })

  it('the same routes answer for the types a site has (so the 404 above is the model\'s, not the route\'s)', async () => {
    for (const [site, admin, own, singleton] of [[t.a, adminA, 'author', 'siteSettings'], [t.b, adminB, 'product', 'formSettings']] as const) {
      expect((await admin.get(`/api/cms/${own}`)).status, `${site.id} list`).toBe(200)
      expect((await admin.get(`/api/cms/${own}/options`)).status, `${site.id} options`).toBe(200)
      expect((await admin.get(`/api/cms/${own}/${UUID_NOWHERE}`)).status, `${site.id} one`).toBe(404) // an entry that is not there: 404 for another reason
      expect((await admin.get(`/api/cms/_singleton/${singleton}`)).status, `${site.id} singleton`).toBe(200)
      expect((await get(site, `/api/content/${own}`)).status, `${site.id} content`).toBe(200)
    }
    expect((await get(t.a, '/api/content/_global/siteSettings')).status).toBe(200)
  })

  it('the types both models have exist on both sites (routes are not model-specific)', async () => {
    for (const name of ['post', 'tag']) {
      for (const [site, admin] of [[t.a, adminA], [t.b, adminB]] as const) {
        expect((await admin.get(`/api/cms/${name}`)).status, `${site.id} ${name}`).toBe(200)
        expect((await get(site, `/api/content/${name}`)).status, `${site.id} content ${name}`).toBe(200)
      }
    }
  })

  // Not swept, by design: `/api/content/_search?entity=<name>` and `/api/cms/_search` take no type
  // name as a path part (an unknown name in `entity=` narrows the search to nothing: asked in the
  // search test), `/api/content/_form/<name>` is in the forms test, `/api/cms/_p/*` and the
  // plugins' pages are the same on both models (the build refuses models whose plugins differ),
  // and `/api/cms/_media`, `_users`, `_auth` take no type name.
})

describe('the shared name `post` is each model\'s own', () => {
  const fieldKeys = async (admin: Client, name: string) => ((await admin.get('/api/cms/_graph')).body as any[]).find((e) => e.name === name).fields.map((f: any) => f.key as string).sort()

  it('the graph describes the playground\'s post on A and shop\'s post on B', async () => {
    const a = await fieldKeys(adminA, 'post')
    const b = await fieldKeys(adminB, 'post')
    for (const key of ['author', 'status', 'hero', 'gallery', 'publishedAt', 'location', 'metaTitle']) expect(a, `A has ${key}`).toContain(key)
    expect(b).toEqual(expect.arrayContaining(['title', 'slug', 'summary', 'body', 'tags']))
    for (const key of ['author', 'status', 'hero', 'gallery', 'publishedAt', 'location']) expect(b, `B has no ${key}`).not.toContain(key)
    expect(a).not.toContain('summary')
    // The same for tags: `name` and `slug` on A, `label` on B.
    expect(await fieldKeys(adminA, 'tag')).toEqual(expect.arrayContaining(['name', 'slug']))
    expect(await fieldKeys(adminB, 'tag')).toEqual(['label'])
    // And the localised flags: A's title is translated, B's has no languages beyond Czech.
    const titleA = (((await adminA.get('/api/cms/_graph')).body as any[]).find((e) => e.name === 'post').fields.find((f: any) => f.key === 'title'))
    const titleB = (((await adminB.get('/api/cms/_graph')).body as any[]).find((e) => e.name === 'post').fields.find((f: any) => f.key === 'title'))
    expect(titleA.localized).toBe(true)
    expect(titleB.localized ?? false).toBe(false)
  })

  it('a post is made on B with B\'s fields; what B requires is B\'s, and A\'s posts are untouched', async () => {
    const countA = async () => (await siteQuery(t.a, 'select count(*)::int n from post'))[0].n
    const before = await countA()
    const titlesA = (await siteQuery(t.a, 'select title from post order by title')).map((r) => r.title)

    // B's required fields: title and summary. An author is not a field of B's post.
    const made = await adminB.post('/api/cms/post', { title: 'Novinka v obchodě', slug: 'novinka-v-obchode', summary: 'Krátké shrnutí' })
    expect(made.status).toBe(201)
        expect(made.body.row.summary).toBe('Krátké shrnutí')
    expect(made.body.row).not.toHaveProperty('authorId')
    // Without the summary (which A's post does not have): refused.
    const noSummary = await adminB.post('/api/cms/post', { title: 'Bez shrnutí', slug: 'bez-shrnuti' })
    expect([400, 422]).toContain(noSummary.status)
    // A's required field is not asked for, and an A-only field is not taken.
    const extra = await adminB.post('/api/cms/post', { title: 'S autorem', slug: 's-autorem', summary: 'x', author: authorA, status: 'published' })
    if (extra.status === 201) {
      expect(extra.body.row).not.toHaveProperty('authorId')
      expect(extra.body.row).not.toHaveProperty('status')
    }
    else expect([400, 422]).toContain(extra.status)

    // A: its own required field (an author) is still asked for, and a post of B's shape is refused.
    const asB = await adminA.post('/api/cms/post', { title: 'Tvar obchodu', slug: 'tvar-obchodu', summary: 'x' })
    expect([400, 422]).toContain(asB.status)
    expect(await countA()).toBe(before)
    expect((await siteQuery(t.a, 'select title from post order by title')).map((r) => r.title)).toEqual(titlesA)
    expect((await siteQuery(t.b, 'select title from post order by title')).map((r) => r.title)).toEqual(expect.arrayContaining(['Novinka v obchodě']))
    expect((await siteQuery(t.b, 'select title from post')).map((r) => r.title)).not.toContain(`Příspěvek ${WORD.a}`)
  })

  it('the content API delivers each site\'s own shape', async () => {
    const a = await get(t.a, '/api/content/post/only-on-a')
    expect(a.status).toBe(200)
    expect(a.body.item).toHaveProperty('author')
    expect(a.body.item).not.toHaveProperty('summary')
    const b = await get(t.b, '/api/content/post/novinka-v-obchode')
    expect(b.status).toBe(200)
    expect(b.body.item).toHaveProperty('summary', 'Krátké shrnutí')
    expect(b.body.item).not.toHaveProperty('author')
    expect((await get(t.b, '/api/content/post/only-on-a')).status).toBe(404)
  })
})

describe('what the sites say about their model', () => {
  // The generated types and the API description cover what the content API delivers: the public
  // collections and globals. The types that are not public (redirects, forms) are in neither.
  const A_PUBLIC = ['Author', 'Page', 'Navigation', 'SiteSettings']
  const B_PUBLIC = ['Product', 'Category']
  const A_PRIVATE = ['Redirect', 'ContactForm']
  const B_PRIVATE = ['OrderForm']

  it('the admin graph lists exactly the entities of the site\'s own model', async () => {
    const a = names((await adminA.get('/api/cms/_graph')).body)
    const b = names((await adminB.get('/api/cms/_graph')).body)
    expect(a).toEqual(EXPECTED_GRAPH.a)
    expect(b).toEqual(EXPECTED_GRAPH.b)
    for (const name of [...ONLY_A, SINGLETON_ONLY_A]) expect(b, name).not.toContain(name)
    for (const name of ONLY_B) expect(a, name).not.toContain(name)
    for (const name of BOTH) expect(a, name).toContain(name)
    for (const name of BOTH) expect(b, name).toContain(name)
  })

  it('/api/content-types.ts names no type of the other model (in either direction), in the casing it uses', async () => {
    const a = (await get(t.a, '/api/content-types.ts')).text
    const b = (await get(t.b, '/api/content-types.ts')).text
    expect(a.length).toBeGreaterThan(500)
    expect(b.length).toBeGreaterThan(500)
    const word = (src: string, n: string) => new RegExp(`\\b${n}\\b`, 'i').test(src)
    for (const n of A_PUBLIC) { expect(word(a, n), `A names ${n}`).toBe(true); expect(word(b, n), `B names ${n}`).toBe(false) }
    for (const n of B_PUBLIC) { expect(word(b, n), `B names ${n}`).toBe(true); expect(word(a, n), `A names ${n}`).toBe(false) }
    for (const n of [...A_PRIVATE, ...B_PRIVATE]) { expect(word(a, n), `A names ${n}`).toBe(false); expect(word(b, n), `B names ${n}`).toBe(false) }
    // The collection keys of the schema, as the client reads them.
    for (const n of ['author', 'page']) { expect(a).toMatch(new RegExp(`\n  ${n}: \\{ item:`)); expect(b).not.toMatch(new RegExp(`\n  ${n}: \\{ item:`)) }
    for (const n of ['product', 'category']) { expect(b).toMatch(new RegExp(`\n  ${n}: \\{ item:`)); expect(a).not.toMatch(new RegExp(`\n  ${n}: \\{ item:`)) }
    // The shared `Post` has each model's own fields.
    const postOf = (src: string) => /export interface Post \{[^]*?\n\}/.exec(src)?.[0] ?? ''
    expect(postOf(a)).toContain('author:')
    expect(postOf(a)).not.toContain('summary')
    expect(postOf(b)).toContain('summary: string')
    expect(postOf(b)).not.toContain('author')
    expect(postOf(b)).not.toContain('status')
    // Languages: A has two, B one.
    expect(a).toContain(`'cs' | 'en'`)
    expect(b).not.toContain(`'en'`)
  })

  it('/api/openapi.json describes only the site\'s own types and paths', async () => {
    const a = (await get(t.a, '/api/openapi.json')).body
    const b = (await get(t.b, '/api/openapi.json')).body
    const pathsOf = (doc: any) => Object.keys(doc.paths) as string[]
    const schemasOf = (doc: any) => Object.keys(doc.components?.schemas ?? {}) as string[]
    expect(pathsOf(a)).toEqual(expect.arrayContaining(['/api/content/author', '/api/content/post/{slug}', '/api/content/_global/siteSettings']))
    expect(pathsOf(b)).toEqual(expect.arrayContaining(['/api/content/product', '/api/content/product/{slug}', '/api/content/category', '/api/content/post/{slug}']))
    for (const n of ['author', 'page', 'navigation', 'siteSettings', 'redirect', 'contactForm', 'orderForm', 'product', 'category']) {
      const inA = pathsOf(a).filter((p) => p.includes(`/${n}`))
      const inB = pathsOf(b).filter((p) => p.includes(`/${n}`))
      if (['author', 'page', 'navigation', 'siteSettings'].includes(n)) { expect(inA.length, `A has ${n}`).toBeGreaterThan(0); expect(inB, `B has ${n}`).toEqual([]) }
      else if (['product', 'category'].includes(n)) { expect(inB.length, `B has ${n}`).toBeGreaterThan(0); expect(inA, `A has ${n}`).toEqual([]) }
      else { expect(inA, `A has ${n}`).toEqual([]); expect(inB, `B has ${n}`).toEqual([]) }
    }
    for (const n of A_PUBLIC) { expect(schemasOf(a).some((s) => s.startsWith(n)), `A schema ${n}`).toBe(true); expect(schemasOf(b).filter((s) => s.startsWith(n)), `B schema ${n}`).toEqual([]) }
    for (const n of B_PUBLIC) { expect(schemasOf(b).some((s) => s.startsWith(n)), `B schema ${n}`).toBe(true); expect(schemasOf(a).filter((s) => s.startsWith(n)), `A schema ${n}`).toEqual([]) }
    // The shared Post: each model's own properties.
    expect(Object.keys(a.components.schemas.Post.properties)).toContain('author')
    expect(Object.keys(b.components.schemas.Post.properties)).toContain('summary')
    expect(Object.keys(b.components.schemas.Post.properties)).not.toContain('author')
    // Not a word of the other model anywhere in the document.
    // (Type names in their own casing, and the tag each path carries: `page` alone is also the paging parameter.)
    const mentions = (doc: any, n: string) => new RegExp(`\\b${n}|"tags":\\["${n[0]!.toLowerCase()}${n.slice(1)}"\\]`).test(JSON.stringify(doc))
    for (const n of [...A_PUBLIC, ...A_PRIVATE]) expect(mentions(b, n), `B mentions ${n}`).toBe(false)
    for (const n of [...B_PUBLIC, ...B_PRIVATE]) expect(mentions(a, n), `A mentions ${n}`).toBe(false)
  })
})

describe('search', () => {
  it('an entry of B is found by B\'s site search and admin search and never by A\'s, and the other way round', async () => {
    const found = await get(t.b, `/api/content/_search?q=${WORD.b}`)
    expect(found.status).toBe(200)
    expect(found.body.items.map((i: any) => [i.entity, i.path])).toEqual([['product', `/shop/${productB.slug}`]])
    const admin = await adminB.get(`/api/cms/_search?q=${WORD.b}`)
    expect(admin.body.items.map((i: any) => [i.entity, i.id])).toEqual([['product', productB.id]])

    expect((await get(t.a, `/api/content/_search?q=${WORD.b}`)).body.items).toEqual([])
    expect((await adminA.get(`/api/cms/_search?q=${WORD.b}`)).body.items).toEqual([])
    // An entity of the other model named in `entity=` narrows the search to nothing.
    expect((await get(t.a, `/api/content/_search?q=${WORD.b}&entity=product`)).body.items).toEqual([])

    // A's word: found on A (the post with its address), absent on B.
    const onA = await get(t.a, `/api/content/_search?q=${WORD.a}`)
    expect(onA.body.items.map((i: any) => [i.entity, i.path])).toEqual([['post', '/blog/only-on-a']])
    expect((await adminA.get(`/api/cms/_search?q=${WORD.a}`)).body.items.map((i: any) => i.entity)).toContain('post')
    expect((await get(t.b, `/api/content/_search?q=${WORD.a}`)).body.items).toEqual([])
    expect((await adminB.get(`/api/cms/_search?q=${WORD.a}`)).body.items).toEqual([])
  })

  it('each site\'s index holds only its own entries', async () => {
    const entities = async (site: typeof t.a) => (await siteQuery(site, 'select distinct entity from cms_search order by entity')).map((r) => r.entity)
    const a = await entities(t.a)
    const b = await entities(t.b)
    expect(a).toContain('post')
    expect(a).not.toContain('product')
    expect(b).toContain('product')
    expect(b).not.toContain('author')
    expect(b).not.toContain('page')
  })
})

describe('the sitemap', () => {
  it('/sitemap.xml and /api/content/_sitemap list B\'s product and nothing of A; A lists no product', async () => {
    for (let round = 0; round < 2; round++) {
      const b = await get(t.b, '/sitemap.xml')
      expect(b.status).toBe(200)
      const locs = [...b.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!)
      expect(locs).toContain(`${t.b.url}/shop/${productB.slug}`)
      for (const loc of locs) expect(loc.startsWith(`${t.b.url}/`), loc).toBe(true)
      expect(b.text).not.toContain('only-on-a')
      // The app's own static pages (/blog, /blog/typed, /z-hooku from the hook) are in both; no entry of A's is.
      expect(locs.filter((l) => l.startsWith(`${t.b.url}/blog/`) && l !== `${t.b.url}/blog/typed`)).toEqual([])
      expect(b.text).not.toContain(t.a.host)
      // B has one language: the English address the app lists for A is not in B's.
      expect(locs).not.toContain(`${t.b.url}/en/news`)

      const a = await get(t.a, '/sitemap.xml')
      expect(a.status).toBe(200)
      expect(a.text).toContain(`${t.a.url}/blog/only-on-a`)
      expect(a.text).toContain(`${t.a.url}/en/news`)
      expect(a.text).not.toContain('/shop/')
      expect(a.text).not.toContain(productB.slug)
    }
    const entriesB = (await get(t.b, '/api/content/_sitemap')).body.entries.map((e: any) => e.loc)
    expect(entriesB).toContain(`/shop/${productB.slug}`)
    expect(entriesB.filter((l: string) => l.startsWith('/blog/') && l !== '/blog/typed')).toEqual([])
    const entriesA = (await get(t.a, '/api/content/_sitemap')).body.entries.map((e: any) => e.loc)
    expect(entriesA).toContain('/blog/only-on-a')
    expect(entriesA.filter((l: string) => l.startsWith('/shop/'))).toEqual([])
  })
})

describe('the databases', () => {
  const tables = async (site: typeof t.a) => (await siteQuery(site, `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`)).map((r) => r.table_name as string)
  const columns = async (site: typeof t.a, table: string) => (await siteQuery(site, `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by column_name`, [table])).map((r) => r.column_name as string)
  const journal = (dir: string) => (JSON.parse(readFileSync(join(repoRoot, dir, 'meta/_journal.json'), 'utf8')).entries as { tag: string }[])

  it('each database has the tables of its own model only', async () => {
    const a = await tables(t.a)
    const b = await tables(t.b)
    for (const table of ['product', 'category', 'category_to_product', 'order_form', 'post', 'tag', 'post_to_tag', 'cms_users', 'cms_search', 'cms_media', 'events', 'form_settings']) expect(b, `B has ${table}`).toContain(table)
    for (const table of ['author', 'page', 'redirect', 'navigation', 'site_settings', 'contact_form', 'post_locales', 'tag_locales']) {
      expect(b, `B has no ${table}`).not.toContain(table)
      expect(a, `A has ${table}`).toContain(table)
    }
    for (const table of ['product', 'category', 'category_to_product', 'order_form']) expect(a, `A has no ${table}`).not.toContain(table)
    // A's tables are what its own migrations make: the playground's, none of shop's.
    expect(a.filter((x) => /product|category|order_form/.test(x))).toEqual([])
  })

  it('B\'s post has shop\'s columns, A\'s the playground\'s', async () => {
    const b = await columns(t.b, 'post')
    const a = await columns(t.a, 'post')
    expect(b).toEqual(expect.arrayContaining(['id', 'title', 'slug', 'summary', 'body']))
    for (const c of ['author_id', 'status', 'hero_id', 'published_at', 'gallery', 'location']) expect(b, c).not.toContain(c)
    expect(a).toEqual(expect.arrayContaining(['author_id', 'status', 'hero_id', 'published_at']))
    expect(a).not.toContain('summary')
    expect(await columns(t.b, 'tag')).toContain('label')
    expect(await columns(t.a, 'tag')).not.toContain('label')
    // Both have a relation table of this name, with the same two columns.
    expect(await columns(t.a, 'post_to_tag')).toEqual(['post_id', 'tag_id'])
    expect(await columns(t.b, 'post_to_tag')).toEqual(['post_id', 'tag_id'])
  })

  it('B\'s migration table holds exactly the shop migrations, A\'s the playground\'s', async () => {
    const shop = journal('playground/models/shop/server/db/migrations')
    const own = journal('playground/server/db/migrations')
    const b = await siteQuery(t.b, 'select hash, created_at from drizzle.__drizzle_migrations order by id')
    const a = await siteQuery(t.a, 'select hash, created_at from drizzle.__drizzle_migrations order by id')
    expect(b).toHaveLength(shop.length)
    expect(a).toHaveLength(own.length)
    expect(shop.length).toBeGreaterThan(0)
    // Not one migration of the other model's is recorded (hashes are of the SQL).
    expect(b.filter((r) => a.some((x) => x.hash === r.hash))).toEqual([])
    // The upgrade steps' record (plugins' steps run per site): A's and B's are each site's own.
    const stepsOf = async (site: typeof t.a) => (await siteQuery(site, `select count(*)::int n from information_schema.tables where table_schema = 'public' and table_name = 'cms_upgrades'`))[0].n
    expect(await stepsOf(t.b)).toBe(await stepsOf(t.a))
  })

  it('the site\'s own user opens its own database only', async () => {
    expect((await siteQuery(t.b, 'select current_database() d'))[0].d).toBe(t.b.database)
    expect((await siteQuery(t.a, 'select current_database() d'))[0].d).toBe(t.a.database)
    await expect(siteQuery({ databaseUrl: t.b.databaseUrl.replace(t.b.database, t.a.database) }, 'select 1')).rejects.toThrow()
  })
})

describe('a write on one site does not touch the other', () => {
  /** The number of rows of every table of a site, but the ones a read changes by itself (sessions, rate limits). */
  const snapshot = async (site: typeof t.a) => {
    const tables = (await siteQuery(site, `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`)).map((r) => r.table_name as string)
    const out: Record<string, number> = {}
    for (const table of tables) {
      if (['cms_state', 'cms_sessions', 'cms_rate_limits'].includes(table)) continue
      out[table] = (await siteQuery(site, `select count(*)::int n from "${table}"`))[0].n
    }
    return out
  }
  const pause = () => new Promise((r) => setTimeout(r, 600))

  it('a create, an update and a delete on A leave B\'s rows and B\'s webhook receiver as they were', async () => {
    const rowsB = await snapshot(t.b)
    const hooksB = siteHooksMark(t.b)
    const hooksA = siteHooksMark(t.a)

    const post = await createPost(adminA, { author: authorA, title: 'Zapsáno na A', slug: 'written-on-a', status: 'published', body: doc('x') })
    expect((await adminA.patch(`/api/cms/post/${post.id}`, { title: 'Změněno na A' })).status).toBe(200)
    expect((await adminA.delete(`/api/cms/post/${post.id}`)).status).toBe(200)
    await waitForSiteHooks(t.a, hooksA, (h) => h.length >= 3)
    await pause()
    expect(await snapshot(t.b)).toEqual(rowsB)
    expect(siteHooks(t.b, hooksB)).toEqual([])
  })

  it('a create, an update and a delete on B leave A\'s rows and A\'s webhook receiver as they were', async () => {
    const rowsA = await snapshot(t.a)
    const hooksA = siteHooksMark(t.a)
    const hooksB = siteHooksMark(t.b)

    const made = await adminB.post('/api/cms/product', { title: 'Zapsáno na B', slug: 'zapsano-na-b', price: 5 })
    expect(made.status).toBe(201)
    expect((await adminB.patch(`/api/cms/product/${made.body.row.id}`, { price: 6 })).status).toBe(200)
    expect((await adminB.delete(`/api/cms/product/${made.body.row.id}`)).status).toBe(200)
    const got = await waitForSiteHooks(t.b, hooksB, (h) => h.length >= 3)
    expect(got.map((h) => h.json.entity)).toEqual(expect.arrayContaining(['product']))
    await pause()
    expect(await snapshot(t.a)).toEqual(rowsA)
    expect(siteHooks(t.a, hooksA)).toEqual([])
  })
})

describe('forms', () => {
  const order = { name: 'Eva', email: 'eva@example.com', product: 'Čajová konvice', quantity: 2, _t: 5000 }

  it('A\'s form is 404 on B, in the form endpoint and in the database', async () => {
    expect((await get(t.a, '/api/content/_form/contactForm')).status).toBe(200)
    expect((await get(t.b, '/api/content/_form/contactForm')).status).toBe(404)
    const sent = await siteClient(t.b).post('/api/content/_form/contactForm', { name: 'Jana', email: 'jana@example.com', message: 'Dobrý den', consent: true, _t: 5000 })
    expect(sent.status).toBe(404)
    expect(await siteQuery(t.b, `select 1 from information_schema.tables where table_name = 'contact_form'`)).toEqual([])
  })

  it('B\'s orderForm takes a submission on B (stored in B\'s database, mailed from B) and is 404 on A', async () => {
    expect((await get(t.b, '/api/content/_form/orderForm')).status).toBe(200)
    expect((await get(t.a, '/api/content/_form/orderForm')).status).toBe(404)
    const sent = await siteClient(t.b).post('/api/content/_form/orderForm', order)
    expect(sent.status).toBe(201)
    const rows = await siteQuery(t.b, 'select name, email, product from order_form')
    expect(rows).toEqual([{ name: 'Eva', email: 'eva@example.com', product: 'Čajová konvice' }])
    const mail = await waitForSiteMail(t.b, 'owner@site-b.test')
    expect(mail.text).toContain('Čajová konvice')
    expect(mail.text).toContain(`${t.b.url}/admin/orderForm/`)

    const refused = await siteClient(t.a).post('/api/content/_form/orderForm', order)
    expect(refused.status).toBe(404)
    await new Promise((r) => setTimeout(r, 300))
    expect(siteMail(t.a).filter((m) => m.text.includes('Čajová konvice'))).toEqual([])
    // A form needs the shape of its own site: B's submission of A's fields is refused as invalid.
    const wrong = await siteClient(t.b).post('/api/content/_form/orderForm', { name: 'Jana', email: 'jana@example.com', message: 'Dobrý den', consent: true, _t: 5000 })
    expect(wrong.status).toBeGreaterThanOrEqual(400)
    expect(wrong.status).toBeLessThan(500)
  })
})

describe('a many-to-many with the same table name on both sites', () => {
  it('tags linked to a post on each site read back each site\'s own, and the relation tables hold each site\'s own ids', async () => {
    // A: the playground's post and tag (the tag's name is translated, the post has an author).
    const tagA1 = await createTag(adminA, { name: 'Alfa', slug: 'alfa' })
    const tagA2 = await createTag(adminA, { name: 'Beta', slug: 'beta' })
    const postA = await createPost(adminA, { author: authorA, title: 'Se štítky na A', slug: 'tagged-on-a', status: 'published', tags: [tagA1.id, tagA2.id], body: doc('x') })
    // B: shop's post and tag.
    const tagB1 = (await adminB.post('/api/cms/tag', { label: 'Novinka' })).body.row
    const tagB2 = (await adminB.post('/api/cms/tag', { label: 'Sleva' })).body.row
    const madeB = await adminB.post('/api/cms/post', { title: 'Se štítky na B', slug: 'se-stitky-na-b', summary: 'x', tags: [tagB1.id, tagB2.id] })
    expect(madeB.status).toBe(201)
    const postB = madeB.body.row

    const idsOf = (tags: any[]) => tags.map((x) => x.id ?? x).sort()
    const readA = await adminA.get(`/api/cms/post/${postA.id}`)
    const readB = await adminB.get(`/api/cms/post/${postB.id}`)
    expect(readA.status).toBe(200)
    expect(readB.status).toBe(200)
    expect(idsOf(readA.body.row.tags)).toEqual([tagA1.id, tagA2.id].sort())
    expect(idsOf(readB.body.row.tags)).toEqual([tagB1.id, tagB2.id].sort())

    // The content API resolves them with each model's own fields.
    const pubA = (await get(t.a, '/api/content/post/tagged-on-a')).body.item
    expect(pubA.tags.map((x: any) => x.slug).sort()).toEqual(['alfa', 'beta'])
    const pubB = (await get(t.b, `/api/content/post/${postB.slug}`)).body.item
    expect(pubB.tags.map((x: any) => x.label).sort()).toEqual(['Novinka', 'Sleva'])

    // The relation tables: each holds its own site's ids and nothing of the other's.
    const linksA = await siteQuery(t.a, 'select post_id, tag_id from post_to_tag where post_id = $1', [postA.id])
    const linksB = await siteQuery(t.b, 'select post_id, tag_id from post_to_tag where post_id = $1', [postB.id])
    expect(linksA.map((r) => r.tag_id).sort()).toEqual([tagA1.id, tagA2.id].sort())
    expect(linksB.map((r) => r.tag_id).sort()).toEqual([tagB1.id, tagB2.id].sort())
    expect(await siteQuery(t.a, 'select 1 from post_to_tag where post_id = $1', [postB.id])).toEqual([])
    expect(await siteQuery(t.b, 'select 1 from post_to_tag where post_id = $1', [postA.id])).toEqual([])

    // A tag of the other site is not a tag here: the link is refused.
    const cross = await adminB.patch(`/api/cms/post/${postB.id}`, { tags: [tagA1.id] })
    expect(cross.status).toBeGreaterThanOrEqual(400)
    expect(cross.status).toBeLessThan(500)
    expect(idsOf((await adminB.get(`/api/cms/post/${postB.id}`)).body.row.tags)).toEqual([tagB1.id, tagB2.id].sort())

    // Product and category on B (a relation table only B has).
    const category = (await adminB.post('/api/cms/category', { name: 'Čaj' })).body.row
    const withCategory = await adminB.patch(`/api/cms/product/${productB.id}`, { categories: [category.id] })
    expect(withCategory.status).toBe(200)
    expect((await siteQuery(t.b, 'select category_id from category_to_product where product_id = $1', [productB.id])).map((r) => r.category_id)).toEqual([category.id])
    expect((await get(t.b, `/api/content/product/${productB.slug}`)).body.item.categories.map((c: any) => c.name)).toEqual(['Čaj'])
  })
})

describe('a directory row naming a model the build does not have', () => {
  it('is refused with the reason in the log; both sites keep serving with their own models; the restored rows are taken up', async () => {
    const state = async () => ({
      a: names((await adminA.get('/api/cms/_graph')).body),
      b: names((await adminB.get('/api/cms/_graph')).body),
    })
    const before = await state()
    const mark = t.server.logs.length

    await t.writeDirectory([t.rows[0], { ...t.rows[1], model: 'nope' }])
    await until('the server says why', () => t.server.logs.slice(mark).join(''), (log) => /site site-b: "model" names "nope", which this build does not have \(it has: default, shop\)/.test(log), 8000)
    // The last good directory is kept: both sites answer, each with its own model.
    expect(await state()).toEqual(before)
    expect((await get(t.b, '/api/content/product')).status).toBe(200)
    expect((await get(t.a, '/api/content/product')).status).toBe(404)
    expect((await get(t.a, '/api/content/author')).status).toBe(200)
    expect((await get(t.b, '/api/content/author')).status).toBe(404)

    // A site that names no model while the build has `default` is A's case and fine; the same
    // row for B with a name of the wrong shape is refused too.
    await t.writeDirectory([t.rows[0], { ...t.rows[1], model: 'Not A Name' }])
    await until('the server says why (bad name)', () => t.server.logs.slice(mark).join(''), (log) => /site site-b: "model" must be the name of a content model/.test(log), 8000)
    expect(await state()).toEqual(before)

    // Restored: taken up, still the same models.
    await t.writeDirectory(t.rows)
    expect(await state()).toEqual(before)
    expect((await get(t.b, '/api/content/product')).status).toBe(200)
  })
})

