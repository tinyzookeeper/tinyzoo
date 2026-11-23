import { createHash, randomBytes } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client as McpClient, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { Client, doc, linkIn, PNG_1x1, tokenOf } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'
import { repoRoot } from '../setup/database'
import { expectNoSiteErrors, siteClient, siteLogin, siteMail, siteQuery, startTenants, TENANT_PASSWORD, type Tenants, type TenantSite, until, waitForSiteMail } from '../helpers/tenants'
import { plugins } from '../../playground/cms.config'

// Two sites in one process: the admin API, sessions, tokens, OAuth and the links in e-mails.
//
// The hard case throughout: site B's database is a copy of site A's, made after the content
// below existed. So every id used here (accounts, entries, files, tokens, revisions) is a
// real row on BOTH sites, and site A's session names an account that site B has too, with
// the same password hash and the same session version. Only the site's own separation can
// refuse it.
let t: Tenants
/** Ids that exist on both sites (made before the copy). */
let ids: { post: string; tag: string; page: string; media: string; mediaKey: string; redirect: string; revision: string; token: string }
/** Accounts made before the copy for the tests that end sessions or change passwords (the three shared ones stay as they are). */
const EXTRA = ['reset', 'signout', 'mover'] as const

beforeAll(async () => {
  t = await startTenants('admin', {}, {
    async seed({ url, admin }) {
      const author = await createAuthor(admin, { name: 'Shared Author' })
      const tag = await createTag(admin, { name: 'Shared tag', slug: 'shared-tag' })
      const media = await admin.upload('/api/cms/_media', { name: 'shared.png', type: 'image/png', data: PNG_1x1 })
      if (media.status !== 201) throw new Error(`seed upload: ${media.status}`)
      const post = await createPost(admin, { author: author.id, title: 'Shared post', slug: 'shared-post', status: 'published', tags: [tag.id], hero: media.body.id, body: doc('Shared text') })
      await admin.patch(`/api/cms/post/${post.id}`, { title: 'Shared post, edited' }) // a second revision
      const page = await admin.post('/api/cms/page', { title: 'Shared page', slug: 'shared-page', status: 'published', sections: [] })
      if (page.status !== 201) throw new Error(`seed page: ${page.status} ${JSON.stringify(page.body)}`)
      const redirect = await admin.post('/api/cms/redirect', { from: '/shared-old', to: '/shared-new' })
      if (redirect.status !== 201) throw new Error(`seed redirect: ${redirect.status}`)
      await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Shared name' })
      const token = await admin.post('/api/cms/_auth/tokens', { name: 'Made before the copy', rights: { write: false, publish: false, delete: false, media: false, entities: null }, expiresInDays: null })
      if (token.status !== 201) throw new Error(`seed token: ${token.status}`)
      for (const who of EXTRA) {
        const invited = await admin.post('/api/cms/_users', { email: `${who}@test.local`, role: 'editor' })
        if (invited.status !== 201) throw new Error(`seed invite ${who}: ${invited.status}`)
        const accepted = await new Client(url).post('/api/cms/_auth/accept', { token: tokenOf(invited.body.inviteUrl), name: `Person ${who}`, password: TENANT_PASSWORD })
        if (accepted.status !== 200) throw new Error(`seed accept ${who}: ${accepted.status}`)
      }
    },
  })
  const one = async (sql: string) => (await siteQuery(t.a, sql))[0]
  const media = await one('select id, key from cms_media limit 1')
  ids = {
    post: (await one('select id from post limit 1')).id,
    tag: (await one('select id from tag limit 1')).id,
    page: (await one('select id from page limit 1')).id,
    media: media.id, mediaKey: media.key,
    redirect: (await one('select id from redirect limit 1')).id,
    revision: (await one(`select id from cms_revisions where entity = 'post' order by created_at limit 1`)).id,
    token: (await one('select id from cms_access_tokens limit 1')).id,
  }
  // The premise: the same rows on both sites.
  for (const [table, id] of [['post', ids.post], ['cms_media', ids.media], ['cms_revisions', ids.revision], ['cms_access_tokens', ids.token], ['cms_users', t.a.users.admin]] as const) {
    expect(await siteQuery(t.b, `select 1 from ${table} where id = $1`, [id]), `${table} on B`).toHaveLength(1)
  }
}, 120_000)
afterAll(async () => {
  try { expectNoSiteErrors(t) }
  finally { await t?.stop() }
})

// ── the sweep: every admin route, generated from the files that define them ──────────────

interface Route { method: string; path: string; source: string }

const UUID_NOWHERE = '00000000-0000-4000-8000-000000000000'

/** What stands in for a route parameter, by the file it is in. A parameter this table does not know fails the sweep: add it here. */
function param(name: string, source: string): string {
  if (name === 'entity') return 'post'
  if (name === 'rev') return ids.revision
  if (name === 'name') return 'siteSettings'
  if (name === 'token') return 'not-a-real-token'
  if (name === '...key') return ids.mediaKey
  if (name === 'file') return source.startsWith('_brand/') ? 'admin.webmanifest' : '320.webp'
  if (name === 'id') {
    if (source.startsWith('_media/')) return ids.media
    if (source.startsWith('_users/')) return t.a.users.editor
    if (source.startsWith('_auth/tokens/')) return ids.token
    if (source.startsWith('_auth/oauth/')) return UUID_NOWHERE
    if (source.startsWith('[entity]/')) return ids.post
  }
  throw new Error(`the sweep has no value for the parameter [${name}] of ${source}: add it to param()`)
}

/** The routes under server/api/cms, from the file tree (Nitro's naming: `index`, `[param]`, `.get.ts`). Sockets have no method suffix and are left to tenants-hosts.spec.ts. */
function adminRoutes(): Route[] {
  const root = join(repoRoot, 'packages/cms/server/api/cms')
  const out: Route[] = []
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true }) as any[]) {
    if (!entry.isFile()) continue
    const source = join(entry.parentPath ?? entry.path, entry.name).slice(root.length + 1)
    const m = /^(.*)\.(get|post|put|patch|delete|head)\.ts$/.exec(source)
    if (!m) continue
    const path = m[1]!.split('/').filter((s) => s !== 'index').map((s) => (/^\[(.+)\]$/.test(s) ? param(s.slice(1, -1), source) : s)).join('/')
    out.push({ method: m[2]!.toUpperCase(), path: `/api/cms/${path}`, source })
  }
  return out.sort((x, y) => x.source.localeCompare(y.source))
}

/** The admin routes the plugins of the playground add (/api/cms/_p/<plugin>/…), from the plugins themselves. */
function pluginRoutes(): (Route & { access: string })[] {
  const out: (Route & { access: string })[] = []
  for (const p of plugins as any[]) {
    for (const h of p.serverHandlers ?? []) {
      if (h.route === undefined) continue
      out.push({ method: String(h.method ?? 'get').toUpperCase(), path: `/api/cms/_p/${p.name}${h.route}`, source: `_p/${p.name}${h.route}`, access: h.access ?? 'user' })
    }
  }
  return out
}

/**
 * Routes that answer a visitor who is not signed in, by design (the sign-in page's own
 * needs, links from e-mails, the logo, public files). For these a foreign session must
 * change nothing: the answer is the one site B gives an anonymous visitor. Every route NOT
 * listed here must answer 401 to site A's session.
 */
const OPEN = new Set([
  'GET _auth/status.get.ts', 'GET _auth/invite/[token].get.ts', 'GET _auth/email/[token].get.ts', 'GET _auth/email/revert/[token].get.ts',
  'GET _brand/[file].get.ts', 'GET _theme.get.ts',
  'GET _media/raw/[...key].get.ts', 'HEAD _media/raw/[...key].head.ts', 'GET _media/img/[id]/[file].get.ts',
  'POST _auth/login.post.ts', 'POST _auth/logout.post.ts', 'POST _auth/setup.post.ts', 'POST _auth/accept.post.ts',
  'POST _auth/forgot.post.ts', 'POST _auth/reset.post.ts', 'POST _auth/email/confirm.post.ts', 'POST _auth/email/revert.post.ts',
])

/** One request as a new browser (a refused cookie is cleared by the answer; nothing is kept between requests). */
async function call(site: { url: string }, cookie: string, r: Route) {
  const c = new Client(site.url)
  c.cookie = cookie
  const write = r.method !== 'GET' && r.method !== 'HEAD'
  const res = await c.request(r.method, r.path, write ? { json: {} } : {})
  return { status: res.status, body: res.body, text: typeof res.body === 'string' ? res.body : JSON.stringify(res.body ?? null) }
}

/** What must never come back to a foreign session: the things only a signed-in person of the site sees. */
const PRIVATE = ['admin@test.local', 'editor@test.local', 'Ada Admin', 'Shared post', 'Shared Author', 'Made before the copy']

describe('the admin API, swept: site A\'s valid session on site B\'s host', () => {
  it('finds the routes (the sweep is generated, so it must not quietly find none)', () => {
    const routes = adminRoutes()
    expect(routes.length).toBeGreaterThan(60)
    expect(routes.filter((r) => r.method === 'GET').length).toBeGreaterThan(25)
    expect(pluginRoutes().map((r) => r.path)).toEqual(expect.arrayContaining(['/api/cms/_p/analytics/stats', '/api/cms/_p/consent/stats', '/api/cms/_p/consent/ask-again', '/api/cms/_p/events/summary', '/api/cms/_p/events/clear-past']))
    // Every route named as open exists (a renamed file must not leave a stale exception behind).
    const known = new Set(routes.map((r) => `${r.method} ${r.source}`))
    for (const name of OPEN) expect(known.has(name), name).toBe(true)
  })

  it('every read is refused (401) for each of A\'s three sessions, and the same request with B\'s own session is served', async () => {
    const failures: string[] = []
    let served = 0
    const reads = [...adminRoutes(), ...pluginRoutes().filter((r) => r.access !== 'public')].filter((r) => r.method === 'GET' || r.method === 'HEAD')
    for (const r of reads) {
      const name = `${r.method} ${r.source}`
      if (OPEN.has(name)) continue
      for (const role of ['admin', 'editor', 'author'] as const) {
        const res = await call(t.b, t.a.cookies[role], r)
        if (res.status !== 401) failures.push(`${name} as A's ${role} on B: ${res.status} ${res.text.slice(0, 200)}`)
        for (const secret of PRIVATE) if (res.text.includes(secret)) failures.push(`${name} as A's ${role} on B shows "${secret}"`)
      }
      // The control: on B with B's own administrator the route is there and answers (so the 401 above is the session's, not the route's).
      const own = await call(t.b, t.b.cookies.admin, r)
      if (own.status === 401 || own.status >= 500) failures.push(`${name} with B's own session: ${own.status} ${own.text.slice(0, 200)}`)
      if (own.status === 200) served++
      // And A's session still opens A.
      const home = await call(t.a, t.a.cookies.admin, r)
      if (home.status === 401 || home.status >= 500) failures.push(`${name} with A's session on A: ${home.status} ${home.text.slice(0, 200)}`)
    }
    expect(failures).toEqual([])
    expect(served).toBeGreaterThan(25)
  }, 60_000)

  it('every write is refused (401) and changes nothing on B', async () => {
    const counts = () => siteQuery(t.b, `select (select count(*)::int from post) as posts, (select count(*)::int from tag) as tags, (select count(*)::int from cms_media) as media,
      (select count(*)::int from cms_users) as users, (select count(*)::int from redirect) as redirects, (select count(*)::int from cms_access_tokens) as tokens,
      (select count(*)::int from cms_audit) as audit, (select sum(session_version)::int from cms_users) as versions, (select site_name from site_settings limit 1) as name`)
    const before = await counts()
    const failures: string[] = []
    const writes = [...adminRoutes(), ...pluginRoutes().filter((r) => r.access !== 'public')].filter((r) => r.method !== 'GET' && r.method !== 'HEAD')
    expect(writes.length).toBeGreaterThan(30)
    for (const r of writes) {
      const name = `${r.method} ${r.source}`
      if (OPEN.has(name)) continue
      const res = await call(t.b, t.a.cookies.admin, r)
      if (res.status !== 401) failures.push(`${name} as A's admin on B: ${res.status} ${res.text.slice(0, 200)}`)
    }
    expect(failures).toEqual([])
    expect(await counts()).toEqual(before)
    // The entry the deletes aimed at is still there, on both sites.
    expect((await siteClient(t.b, 'admin').get(`/api/cms/post/${ids.post}`)).status).toBe(200)
    expect((await siteClient(t.a, 'admin').get(`/api/cms/post/${ids.post}`)).status).toBe(200)
  }, 60_000)

  it('a route open to visitors answers a foreign session exactly as it answers nobody', async () => {
    const failures: string[] = []
    for (const r of adminRoutes()) {
      const name = `${r.method} ${r.source}`
      // Signing out and the sign-in forms are exercised below; an empty body here would only test their validation.
      if (!OPEN.has(name) || r.method === 'POST') continue
      const anonymous = await call(t.b, '', r)
      const foreign = await call(t.b, t.a.cookies.admin, r)
      if (foreign.status !== anonymous.status || foreign.text !== anonymous.text) failures.push(`${name}: anonymous ${anonymous.status}, with A's session ${foreign.status}`)
    }
    expect(failures).toEqual([])
  })

  it('a file upload with A\'s session on B is refused before a byte is stored', async () => {
    const c = siteClient(t.b, { cookie: t.a.cookies.admin })
    expect((await c.upload('/api/cms/_media', { name: 'x.png', type: 'image/png', data: PNG_1x1 })).status).toBe(401)
    expect((await siteQuery(t.b, 'select count(*)::int as n from cms_media'))[0].n).toBe(1)
  })
})

describe('a session belongs to its site', () => {
  it('B answers A\'s cookie by clearing it, and a session made on B opens B only', async () => {
    const res = await fetch(`${t.b.url}/api/cms/_auth/me`, { headers: { cookie: t.a.cookies.admin, accept: 'application/json' } })
    expect(res.status).toBe(401)
    // The same cookie still opens A afterwards: B could only drop it from the browser that sent it.
    expect((await siteClient(t.a, 'admin').get('/api/cms/_auth/me')).body.user.email).toBe('admin@test.local')
    expect((await siteClient(t.a, { cookie: t.b.cookies.admin }).get('/api/cms/_auth/me')).status).toBe(401)
    expect((await siteClient(t.b, 'admin').get('/api/cms/_auth/me')).status).toBe(200)
  })

  it('A\'s cookie shows nothing of its person on B: the session route the pages ask, and the admin\'s pages', async () => {
    // The cookie is sealed with the process's key, so B can read it; it must not act on it.
    const own = await siteClient(t.a, 'admin').get('/api/_auth/session')
    expect(JSON.stringify(own.body)).toContain('admin@test.local')
    const onB = await siteClient(t.b, { cookie: t.a.cookies.admin }).get('/api/_auth/session')
    expect(JSON.stringify(onB.body)).not.toContain('admin@test.local')
    expect(JSON.stringify(onB.body)).not.toContain('Ada Admin')
    expect(onB.body?.user).toBeUndefined()
    for (const path of ['/admin', '/admin/post', '/admin/account']) {
      const page = await fetch(`${t.b.url}${path}`, { headers: { cookie: t.a.cookies.admin }, redirect: 'manual' })
      const html = await page.text()
      expect(html, path).not.toContain('admin@test.local')
      expect(html, path).not.toContain('Ada Admin')
      expect(html, path).not.toContain('Shared post')
    }
  })

  it('changing a password on A signs that person out everywhere on A, and leaves B\'s session and password alone', async () => {
    const email = 'signout@test.local'
    const laptopA = await siteLogin(t.a, email)
    const phoneA = await siteLogin(t.a, email)
    const onB = await siteLogin(t.b, email)
    expect((await laptopA.post('/api/cms/_auth/password', { current: TENANT_PASSWORD, password: 'a new password for site a' })).status).toBe(200)
    // A: the other browser is out, the old password is gone.
    expect((await phoneA.get('/api/cms/_auth/me')).status).toBe(401)
    expect((await laptopA.get('/api/cms/_auth/me')).status).toBe(200)
    expect((await new Client(t.a.url).post('/api/cms/_auth/login', { email, password: TENANT_PASSWORD })).status).toBe(401)
    // B: the session made before lives on, and the old password still signs in.
    expect((await onB.get('/api/cms/_auth/me')).status).toBe(200)
    await siteLogin(t.b, email, TENANT_PASSWORD)
    expect((await new Client(t.b.url).post('/api/cms/_auth/login', { email, password: 'a new password for site a' })).status).toBe(401)
    // The session version moved on A only: A's fresh session (version 2) is not B's version 1 either.
    expect((await siteClient(t.b, { cookie: laptopA.cookie }).get('/api/cms/_auth/me')).status).toBe(401)
  })

  it('disabling an account on A does not disable it on B', async () => {
    const admin = siteClient(t.a, 'admin')
    const id = (await siteQuery(t.a, `select id from cms_users where email = 'mover@test.local'`))[0].id
    const onA = await siteLogin(t.a, 'mover@test.local')
    const onB = await siteLogin(t.b, 'mover@test.local')
    expect((await admin.patch(`/api/cms/_users/${id}`, { status: 'disabled' })).status).toBe(200)
    expect((await onA.get('/api/cms/_auth/me')).status).toBe(401)
    expect((await onB.get('/api/cms/_auth/me')).status).toBe(200)
    expect((await admin.patch(`/api/cms/_users/${id}`, { status: 'active' })).status).toBe(200)
  })
})

// ── personal access tokens and the MCP server ────────────────────────────────────────────

const READ = { write: false, publish: false, delete: false, media: false, entities: null }
// A tag has no drafts: changing one changes the website, which is publishing.
const WRITE = { ...READ, write: true, publish: true }
let ip = 0
const mcpRequest = (site: { url: string }, token: string, body: unknown = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) => fetch(`${site.url}/api/mcp`, {
  method: 'POST',
  headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json', 'accept': 'application/json, text/event-stream', 'x-forwarded-for': `198.19.20.${++ip}` },
  body: JSON.stringify(body),
})
async function makeToken(site: TenantSite, rights: Record<string, unknown>, name: string) {
  const res = await siteClient(site, 'editor').post('/api/cms/_auth/tokens', { name, rights, expiresInDays: null })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body as { token: { id: string }; value: string }
}
const mcpClients: McpClient[] = []
async function connect(site: { url: string }, token: string) {
  const client = new McpClient({ name: 'tinyzoo-tenants', version: '1' })
  await client.connect(new StreamableHTTPClientTransport(new URL(`${site.url}/api/mcp`), { requestInit: { headers: { 'authorization': `Bearer ${token}`, 'x-forwarded-for': `198.19.21.${++ip}` } } }))
  mcpClients.push(client)
  return client
}
async function tool(client: McpClient, name: string, args: Record<string, unknown> = {}) {
  const res: any = await client.callTool({ name, arguments: args })
  const text = res.content?.[0]?.text ?? ''
  let body: any = text
  try { body = JSON.parse(text) } catch { /* an error message */ }
  return { error: !!res.isError, body, text }
}
afterAll(async () => { await Promise.all(mcpClients.map((c) => c.close().catch(() => {}))) })

describe('personal access tokens', () => {
  it('a token made on A opens A\'s MCP server and is refused by B\'s; and the other way round', async () => {
    const a = await makeToken(t.a, READ, 'Made on A')
    const b = await makeToken(t.b, READ, 'Made on B')
    expect((await mcpRequest(t.a, a.value)).status).toBe(200)
    expect((await mcpRequest(t.b, a.value)).status).toBe(401)
    expect((await mcpRequest(t.b, b.value)).status).toBe(200)
    expect((await mcpRequest(t.a, b.value)).status).toBe(401)
    // As a header on the admin API it opens nothing on either site (a token is for /api/mcp only).
    for (const site of [t.a, t.b]) {
      expect((await siteClient(site).get('/api/cms/_auth/me', { authorization: `Bearer ${a.value}` })).status).toBe(401)
      expect((await siteClient(site).get('/api/cms/post', { 'x-api-key': a.value })).status).toBe(401)
    }
    // Each site lists its own tokens.
    const listed = async (site: TenantSite) => (await siteClient(site, 'editor').get('/api/cms/_auth/tokens')).body.tokens.map((x: any) => x.name)
    expect(await listed(t.a)).toContain('Made on A')
    expect(await listed(t.a)).not.toContain('Made on B')
    expect(await listed(t.b)).not.toContain('Made on A')
    // Revoking on B a token id of A's does nothing to A's.
    expect((await siteClient(t.b, 'editor').delete(`/api/cms/_auth/tokens/${a.token.id}`)).status).toBe(404)
    expect((await mcpRequest(t.a, a.value)).status).toBe(200)
  })

  it('the tools of a token work inside its own site: what it reads and writes is that site\'s', async () => {
    const onlyA = await createTag(siteClient(t.a, 'admin'), { name: 'Tag only on A', slug: 'tag-only-on-a' })
    const onlyB = await createTag(siteClient(t.b, 'admin'), { name: 'Tag only on B', slug: 'tag-only-on-b' })
    const a = await connect(t.a, (await makeToken(t.a, WRITE, 'Tools on A')).value)
    const b = await connect(t.b, (await makeToken(t.b, WRITE, 'Tools on B')).value)
    // The tools call the admin's own routes inside the process: each stays in its site.
    const tagsOf = async (c: McpClient) => JSON.stringify((await tool(c, 'list_entries', { collection: 'tag', fields: 'all' })).body.entries)
    const [inA, inB] = await Promise.all([tagsOf(a), tagsOf(b)])
    expect(inA).toContain('tag-only-on-a')
    expect(inA).not.toContain('tag-only-on-b')
    expect(inB).toContain('tag-only-on-b')
    expect(inB).not.toContain('tag-only-on-a')
    expect((await tool(a, 'get_entry', { collection: 'tag', id: onlyB.id })).error).toBe(true)
    expect((await tool(b, 'get_entry', { collection: 'tag', id: onlyA.id })).error).toBe(true)
    // Writing at the same moment on both, to the same entry id: each lands in its own database.
    const [wa, wb] = await Promise.all([
      tool(a, 'update_entry', { collection: 'tag', id: ids.tag, data: { name: 'Renamed by A\'s token' } }),
      tool(b, 'update_entry', { collection: 'tag', id: ids.tag, data: { name: 'Renamed by B\'s token' } }),
    ])
    expect([wa.error, wb.error], `${wa.text} ${wb.text}`).toEqual([false, false])
    expect((await siteQuery(t.a, 'select name from tag where id = $1', [ids.tag]))[0].name).toBe('Renamed by A\'s token')
    expect((await siteQuery(t.b, 'select name from tag where id = $1', [ids.tag]))[0].name).toBe('Renamed by B\'s token')
    // What the tools tell about the site is the site's own address.
    const about = JSON.stringify((await tool(a, 'describe_site')).body)
    expect(about).not.toContain(t.b.host)
  })
})

// ── OAuth for the MCP server ─────────────────────────────────────────────────────────────

const CB = 'http://127.0.0.1:8976/callback'
const visitor = () => ({ 'x-forwarded-for': `198.19.22.${++ip}` })
const pkce = () => {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}
async function register(site: { url: string }, name = 'Test program') {
  const res = await fetch(`${site.url}/api/mcp/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json', ...visitor() }, body: JSON.stringify({ client_name: name, redirect_uris: [CB] }) })
  return { status: res.status, body: await res.json() as any }
}
const authorize = (site: { url: string }, clientId: string, challenge: string) => {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: CB, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state: 'st' })
  return fetch(`${site.url}/api/mcp/oauth/authorize?${q}`, { redirect: 'manual', headers: visitor() })
}
const exchange = (site: { url: string }, body: Record<string, string>) => fetch(`${site.url}/api/mcp/oauth/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...visitor() }, body: new URLSearchParams(body),
}).then(async (r) => ({ status: r.status, body: await r.json() as any }))

describe('OAuth', () => {
  it('each site\'s discovery documents name its own address', async () => {
    for (const site of [t.a, t.b, t.a]) {
      const resource = (await siteClient(site).get('/.well-known/oauth-protected-resource/api/mcp')).body
      expect(resource).toMatchObject({ resource: `${site.url}/api/mcp`, authorization_servers: [site.url] })
      const server = (await siteClient(site).get('/.well-known/oauth-authorization-server')).body
      expect(server.issuer).toBe(site.url)
      for (const key of ['authorization_endpoint', 'token_endpoint', 'registration_endpoint']) expect(String(server[key]).startsWith(`${site.url}/`), key).toBe(true)
      const unauth = await fetch(`${site.url}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', ...visitor() }, body: '{}' })
      expect(unauth.headers.get('www-authenticate')).toContain(`resource_metadata="${site.url}/.well-known/oauth-protected-resource/api/mcp"`)
    }
  })

  it('a program registered on A is unknown to B, and what A granted (request, code, access and refresh token) opens nothing on B', async () => {
    const { body: client } = await register(t.a)
    expect(client.client_id).toBeTruthy()
    const { verifier, challenge } = pkce()

    // B does not know A's client: a page, not a redirect with a code.
    const onB = await authorize(t.b, client.client_id, challenge)
    expect(onB.status).toBe(400)

    // On A: the request, decided by A's editor.
    const start = await authorize(t.a, client.client_id, challenge)
    expect(start.status).toBe(302)
    const consent = new URL(start.headers.get('location')!, t.a.url)
    expect(consent.origin).toBe(t.a.url)
    const request = consent.searchParams.get('request')!
    // The same person signed in on B cannot see or decide A's request.
    expect((await siteClient(t.b, 'editor').get(`/api/cms/_auth/oauth/${request}`)).status).toBeGreaterThanOrEqual(400)
    expect((await siteClient(t.b, 'editor').post(`/api/cms/_auth/oauth/${request}`, { approve: true, name: 'x', rights: READ })).status).toBeGreaterThanOrEqual(400)
    expect(await siteQuery(t.b, 'select 1 from cms_oauth_requests')).toEqual([])
    const decided = await siteClient(t.a, 'editor').post(`/api/cms/_auth/oauth/${request}`, { approve: true, name: 'Laptop', rights: READ })
    expect(decided.status, JSON.stringify(decided.body)).toBe(200)
    const code = new URL(decided.body.redirectTo).searchParams.get('code')!

    // The code is A's: B refuses it, and trying it there does not spend it.
    const wrongSite = await exchange(t.b, { grant_type: 'authorization_code', code, client_id: client.client_id, redirect_uri: CB, code_verifier: verifier })
    expect(wrongSite.status).toBeGreaterThanOrEqual(400)
    expect(wrongSite.body.access_token).toBeUndefined()
    const tokens = await exchange(t.a, { grant_type: 'authorization_code', code, client_id: client.client_id, redirect_uri: CB, code_verifier: verifier })
    expect(tokens.status).toBe(200)

    expect((await mcpRequest(t.a, tokens.body.access_token)).status).toBe(200)
    expect((await mcpRequest(t.b, tokens.body.access_token)).status).toBe(401)
    const refreshOnB = await exchange(t.b, { grant_type: 'refresh_token', refresh_token: tokens.body.refresh_token, client_id: client.client_id })
    expect(refreshOnB.body.access_token).toBeUndefined()
    expect(refreshOnB.body.error).toBe('invalid_grant')
    // Revoking it on B ends nothing on A.
    await fetch(`${t.b.url}/api/mcp/oauth/revoke`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tokens.body.refresh_token }) })
    expect((await mcpRequest(t.a, tokens.body.access_token)).status).toBe(200)
    const refreshed = await exchange(t.a, { grant_type: 'refresh_token', refresh_token: tokens.body.refresh_token, client_id: client.client_id })
    expect(refreshed.status).toBe(200)
    // The connection is listed on A's account page only.
    expect(JSON.stringify((await siteClient(t.a, 'editor').get('/api/cms/_auth/tokens')).body)).toContain('Laptop')
    expect(JSON.stringify((await siteClient(t.b, 'editor').get('/api/cms/_auth/tokens')).body)).not.toContain('Laptop')
  })
})

// ── invitations, password resets and the e-mails that carry them ─────────────────────────

describe('links sent by e-mail', () => {
  it('an invitation made on A is mailed from A, leads to A and opens nothing on B', async () => {
    const email = 'invited-on-a@test.local'
    const invited = await siteClient(t.a, 'admin').post('/api/cms/_users', { email, role: 'author' })
    expect(invited.status).toBe(201)
    expect(String(invited.body.inviteUrl).startsWith(`${t.a.url}/admin/`)).toBe(true)
    const mail = await waitForSiteMail(t.a, email)
    expect(linkIn(mail.text)).toBe(invited.body.inviteUrl)
    expect(mail.text + mail.html).not.toContain(t.b.host)
    expect(siteMail(t.b, email)).toEqual([])

    const token = tokenOf(invited.body.inviteUrl)
    expect((await siteClient(t.b).get(`/api/cms/_auth/invite/${token}`)).status).toBe(410)
    expect((await siteClient(t.b).post('/api/cms/_auth/accept', { token, name: 'Intruder', password: TENANT_PASSWORD })).status).toBe(410)
    expect(await siteQuery(t.b, 'select 1 from cms_users where email = $1', [email])).toEqual([])
    // On A it is still good (trying it on B did not spend it).
    expect((await siteClient(t.a).get(`/api/cms/_auth/invite/${token}`)).status).toBe(200)
    expect((await siteClient(t.a).post('/api/cms/_auth/accept', { token, name: 'Invited', password: TENANT_PASSWORD })).status).toBe(200)
    // The account is A's: the same address cannot sign in to B.
    expect((await new Client(t.b.url).post('/api/cms/_auth/login', { email, password: TENANT_PASSWORD })).status).toBe(401)
  })

  it('a password reset asked for on A is mailed from A, leads to A and resets nothing on B', async () => {
    const email = 'reset@test.local' // the same account, id and password on both sites
    const onA = await siteLogin(t.a, email)
    const onB = await siteLogin(t.b, email)
    expect((await siteClient(t.a).post('/api/cms/_auth/forgot', { email })).status).toBe(200)
    const mail = await waitForSiteMail(t.a, email, (m) => m.text.includes('/admin/reset/'))
    const link = linkIn(mail.text)
    expect(link.startsWith(`${t.a.url}/admin/reset/`)).toBe(true)
    expect(mail.text + mail.html).not.toContain(t.b.host)
    // Nothing was written to B: no mail, no token row.
    await new Promise((r) => setTimeout(r, 300))
    expect(siteMail(t.b, email)).toEqual([])
    const tokens = (site: TenantSite) => siteQuery(site, `select count(*)::int as n from cms_tokens where kind = 'reset'`).then((r) => r[0].n)
    expect([await tokens(t.a), await tokens(t.b)]).toEqual([1, 0])

    expect((await siteClient(t.b).post('/api/cms/_auth/reset', { token: tokenOf(link), password: 'set on the wrong site' })).status).toBe(410)
    await siteLogin(t.b, email, TENANT_PASSWORD) // B's password is what it was
    expect((await siteClient(t.a).post('/api/cms/_auth/reset', { token: tokenOf(link), password: 'reset on site a only' })).status).toBe(200)
    await siteLogin(t.a, email, 'reset on site a only')
    expect((await onA.get('/api/cms/_auth/me')).status).toBe(401) // A's old sessions ended
    expect((await onB.get('/api/cms/_auth/me')).status).toBe(200) // B's did not
    expect((await new Client(t.b.url).post('/api/cms/_auth/login', { email, password: 'reset on site a only' })).status).toBe(401)
  })

  it('a reset asked for on both sites at once: each mail lands in its own folder with its own site\'s link', async () => {
    const email = 'author@test.local'
    await Promise.all([siteClient(t.a).post('/api/cms/_auth/forgot', { email }), siteClient(t.b).post('/api/cms/_auth/forgot', { email })])
    const [a, b] = await Promise.all([
      waitForSiteMail(t.a, email, (m) => m.text.includes('/admin/reset/')),
      waitForSiteMail(t.b, email, (m) => m.text.includes('/admin/reset/')),
    ])
    expect(linkIn(a.text).startsWith(`${t.a.url}/admin/reset/`)).toBe(true)
    expect(linkIn(b.text).startsWith(`${t.b.url}/admin/reset/`)).toBe(true)
    expect(siteMail(t.a, email).filter((m) => m.text.includes(t.b.url))).toEqual([])
    expect(siteMail(t.b, email).filter((m) => m.text.includes(t.a.url))).toEqual([])
    // Each link is its own site's token.
    expect((await siteClient(t.b).post('/api/cms/_auth/reset', { token: tokenOf(linkIn(a.text)), password: 'set on the wrong site' })).status).toBe(410)
    expect((await siteClient(t.a).post('/api/cms/_auth/reset', { token: tokenOf(linkIn(b.text)), password: 'set on the wrong site' })).status).toBe(410)
  })

  it('a change of e-mail address asked for on A is confirmed on A only, and its mails are A\'s', async () => {
    const acc = await siteLogin(t.a, 'mover@test.local')
    const to = 'moved-on-a@test.local'
    expect((await acc.post('/api/cms/_auth/email', { email: to, password: TENANT_PASSWORD })).status).toBe(200)
    const mail = await waitForSiteMail(t.a, to, (m) => m.text.includes('/admin/email/'))
    const link = linkIn(mail.text)
    expect(link.startsWith(`${t.a.url}/admin/email/`)).toBe(true)
    expect(siteMail(t.b, to)).toEqual([])
    expect((await siteClient(t.b).post('/api/cms/_auth/email/confirm', { token: tokenOf(link) })).status).toBeGreaterThanOrEqual(400)
    expect((await siteQuery(t.b, `select email from cms_users where email in ('mover@test.local', $1)`, [to])).map((r) => r.email)).toEqual(['mover@test.local'])
    expect((await siteClient(t.a).post('/api/cms/_auth/email/confirm', { token: tokenOf(link) })).status).toBe(200)
    expect((await siteQuery(t.a, `select email from cms_users where email in ('mover@test.local', $1)`, [to])).map((r) => r.email)).toEqual([to])
    // The notice to the old address, with its way back, is A's as well.
    const notice = await waitForSiteMail(t.a, 'mover@test.local', (m) => m.text.includes('/admin/email/revert/'))
    expect(linkIn(notice.text).startsWith(`${t.a.url}/admin/email/revert/`)).toBe(true)
    await until('no mail on B', () => siteMail(t.b, 'mover@test.local'), (m) => m.length === 0, 300)
  })
})
