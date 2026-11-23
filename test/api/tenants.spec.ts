import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '../helpers/api'
import { siteQuery, startTenants, tenantGet, tenantPost, type Tenants } from '../helpers/tenants'

// Two sites in one process (multi-tenant mode): the basics. The areas each have a file of their own (tenants-*.spec.ts).
let t: Tenants
beforeAll(async () => { t = await startTenants('basics') }, 120_000)
afterAll(async () => { await t?.stop() })

const as = (site: { url: string }, cookie = '') => { const c = new Client(site.url); c.cookie = cookie; return c }

describe('a request finds its site by its host name', () => {
  it('an unknown host gets 404 from every kind of route, and no route runs', async () => {
    for (const path of ['/', '/admin', '/api/content/post', '/api/cms/_graph', '/api/cms/_auth/status', '/sitemap.xml', '/api/health/status', '/api/mcp']) {
      const res = await tenantGet(t.unknownUrl, path)
      expect(res.status, path).toBe(404)
      expect(res.text, path).toBe('No website at this address')
    }
    expect((await tenantGet(t.ipUrl, '/api/content/post')).status).toBe(404)
  })

  it('by IP the process answers its health checks, and nothing else', async () => {
    expect((await tenantGet(t.ipUrl, '/api/health/live')).body).toEqual({ ok: true })
    expect((await tenantGet(t.ipUrl, '/api/health/ready')).body).toEqual({ ok: true, sites: 2 })
    const ready = await tenantGet(t.a.url, '/api/health/ready')
    expect(ready.body).toMatchObject({ ok: true, migrations: 'done' })
  })

  it('an alias host redirects to the site\'s own address', async () => {
    const res = await tenantGet(`http://www.site-a.localhost:${t.port}`, '/api/content/post?limit=1')
    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe(`${t.a.url}/api/content/post?limit=1`)
  })

  it('a forged X-Forwarded-Host does not choose the site', async () => {
    const res = await tenantGet(t.a.url, '/api/health/status', '', { 'x-forwarded-host': 'site-b.localhost', 'x-api-key': t.b.statusToken })
    expect(res.status).toBe(401)
    const own = await tenantGet(t.a.url, '/api/health/status', '', { 'x-forwarded-host': 'site-b.localhost', 'x-api-key': t.a.statusToken })
    expect(own.status).toBe(200)
  })
})

describe('each site has its own database', () => {
  it('an entry made on A is on A and not on B', async () => {
    const admin = as(t.a, t.a.cookies.admin)
    const made = await admin.post('/api/cms/tag', { name: 'Only on A', slug: 'only-on-a' })
    expect(made.status).toBe(201)
    const onA = await as(t.a).get('/api/content/tag')
    const onB = await as(t.b).get('/api/content/tag')
    expect(JSON.stringify(onA.body)).toContain('only-on-a')
    expect(JSON.stringify(onB.body)).not.toContain('only-on-a')
    expect((await siteQuery(t.a, 'select slug from tag')).map((r) => r.slug)).toContain('only-on-a')
    expect((await siteQuery(t.b, 'select slug from tag')).map((r) => r.slug)).not.toContain('only-on-a')
    // By id on B: the same request, the other site.
    expect((await as(t.b, t.b.cookies.admin).get(`/api/cms/tag/${made.body.id}`)).status).toBe(404)
  })

  it('a site\'s database user cannot open the other site\'s database', async () => {
    const other = new URL(t.a.databaseUrl)
    other.pathname = `/${t.b.database}`
    await expect(siteQuery({ ...t.a, databaseUrl: other.toString() }, 'select 1')).rejects.toThrow(/CONNECT privilege|permission denied/)
  })
})

describe('a session belongs to its site', () => {
  it('A\'s session is refused on B, although the same account id exists there', async () => {
    expect(t.a.users.admin).toBe(t.b.users.admin)
    expect((await as(t.a, t.a.cookies.admin).get('/api/cms/_auth/me')).status).toBe(200)
    for (const path of ['/api/cms/_auth/me', '/api/cms/_graph', '/api/cms/tag', '/api/cms/_users']) {
      expect((await as(t.b, t.a.cookies.admin).get(path)).status, path).toBe(401)
    }
    // And B's own session still works on B.
    expect((await as(t.b, t.b.cookies.admin).get('/api/cms/_auth/me')).status).toBe(200)
  })

  it('each site has its own setup code and status token', async () => {
    expect((await tenantGet(t.a.url, '/api/health/status', '', { 'x-api-key': t.b.statusToken })).status).toBe(401)
    expect((await tenantGet(t.b.url, '/api/health/status', '', { 'x-api-key': t.b.statusToken })).status).toBe(200)
  })

  it('sign-in tries on A do not lock the same address out of B', async () => {
    for (let i = 0; i < 12; i++) await tenantPost(t.a.url, '/api/cms/_auth/login', { email: 'editor@test.local', password: 'wrong password' })
    const locked = await tenantPost(t.a.url, '/api/cms/_auth/login', { email: 'editor@test.local', password: 'wrong password' })
    expect(locked.status).toBe(429)
    const onB = await tenantPost(t.b.url, '/api/cms/_auth/login', { email: 'editor@test.local', password: 'correct horse battery' })
    expect(onB.status).toBe(200)
  })
})
