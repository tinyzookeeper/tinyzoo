import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '../helpers/api'
import { startServer, type SpawnedServer } from '../helpers/server'
import { LiveTab, upgradeStatus } from '../helpers/sockets'
import { expectNoSiteErrors, siteLogin, siteQuery, startTenants, tenantGet, until, type Tenants } from '../helpers/tenants'

// The site directory kept in Postgres, with the sites' secrets encrypted; host names a
// site is also served at; a site that moved away; the operator's list of sites; sites
// that nobody uses giving their memory back; the name of the session cookie.
//
// The two sites are the helper's (made through a server that reads the directory from a
// file). A SECOND server serves the same two sites from a directory table, which the tests
// then change as the cloud app would.
const KEY = 'directory-key-of-the-test-0123456789-abcdef'
const OPERATOR = 'operator-token-of-the-test-0123456789'
const TEMPLATE = 'playground'
const COOKIE = '__Host-tinyzoo-test'

/** The format of packages/cms/server/utils/cmsSite.ts (`cmsEncryptDirectorySecret`), written out here so the test pins it. */
function encrypt(plain: string, key = KEY): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(key, 'utf8').digest(), iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return 'enc:v1:' + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}

let t: Tenants
let second: SpawnedServer
let admin: pg.Client
let control: pg.Client
let controlDb: string
let reader: string
let readerUrl: string
const url = (site: 'a' | 'b' | string) => `http://${site.length === 1 ? `site-${site}` : site}.localhost:${new URL(second.baseURL).port}`
const ip = () => second.baseURL

/** A directory row as the cloud would store it: the database address, the secret and one token inside the settings encrypted. */
function stored(row: any, over: Record<string, unknown> = {}) {
  return {
    ...row,
    databaseUrl: encrypt(row.databaseUrl),
    secret: encrypt(row.secret),
    config: { ...row.config, status: { token: encrypt(row.config.status.token) } },
    ...over,
  }
}
const put = (row: any, template = TEMPLATE) => control.query(
  'insert into tenant_sites (id, template, row, updated_at) values ($1, $2, $3, now()) on conflict (id) do update set template = excluded.template, row = excluded.row, updated_at = now()',
  [row.id, template, JSON.stringify(row)],
)
const rowOf = (id: string) => t.rows.find((r) => r.id === id)
const operator = (base = ip(), token = OPERATOR) => tenantGet(base, '/api/health/sites', '', token ? { authorization: `Bearer ${token}` } : {})
const seen = async (id: string) => (await operator()).body.sites.find((s: any) => s.id === id)

beforeAll(async () => {
  t = await startTenants('dir')
  const base = new URL(t.adminUrl)
  controlDb = `${new URL(t.a.databaseUrl).pathname.slice(1).replace(/_a$/, '')}_control`
  reader = `${controlDb}_reader`
  admin = new pg.Client({ connectionString: t.adminUrl })
  await admin.connect()
  await admin.query(`drop database if exists "${controlDb}" with (force)`)
  await admin.query(`drop role if exists "${reader}"`)
  await admin.query(`create database "${controlDb}"`)
  // The app reads the directory with a role that may read that one table and nothing else.
  await admin.query(`create role "${reader}" login password 'reader' nosuperuser nocreatedb nocreaterole`)
  await admin.query(`revoke connect on database "${controlDb}" from public`)
  await admin.query(`grant connect on database "${controlDb}" to "${reader}"`)
  const controlUrl = new URL(base); controlUrl.pathname = `/${controlDb}`
  control = new pg.Client({ connectionString: controlUrl.toString() })
  await control.connect()
  await control.query('create table tenant_sites (id text primary key, template text not null, row jsonb not null, updated_at timestamptz not null default now())')
  await control.query('create table something_else (secret text)')
  await control.query(`grant select on tenant_sites to "${reader}"`)
  const ru = new URL(controlUrl); ru.username = reader; ru.password = 'reader'
  readerUrl = ru.toString()
  for (const row of t.rows) await put(stored(row))

  second = await startServer('', {
    DATABASE_URL: '', NUXT_CMS_DATABASE_URL: '', NUXT_CMS_PUBLIC_URL: '',
    NUXT_CMS_TENANCY_MODE: 'multi',
    NUXT_CMS_TENANCY_DATABASE_URL: readerUrl, NUXT_CMS_TENANCY_TEMPLATE: TEMPLATE, NUXT_CMS_TENANCY_KEY: KEY,
    NUXT_CMS_TENANCY_POLL_MS: '250',
    NUXT_CMS_TENANCY_OPERATOR_TOKEN: OPERATOR,
    CMS_TEST_TENANCY_IDLE_MS: '2000',
    NUXT_SESSION_NAME: COOKIE,
    NUXT_CMS_MAIL_TRANSPORT: 'file',
    NUXT_CMS_STORAGE_UPLOAD_RATE_PER_MIN: '1000',
  })
}, 180_000)

afterAll(async () => {
  expectNoSiteErrors(t)
  if (second) expectNoSiteErrors({ server: second })
  await second?.stop()
  await control?.end()
  await admin?.query(`drop database if exists "${controlDb}" with (force)`)
  await admin?.query(`drop role if exists "${reader}"`)
  await admin?.end()
  await t?.stop()
})

/** Wait until the server has taken a change of the table up. */
const taken = (what: string, read: () => Promise<number>, status: number) => until(what, read, (s) => s === status, 6000)

describe('the site directory in Postgres', () => {
  it('serves both sites from the table, each from its own database, with secrets that are stored encrypted', async () => {
    const a = await siteLogin({ url: url('a') }, 'admin@test.local')
    const b = await siteLogin({ url: url('b') }, 'admin@test.local')
    const made = await a.post('/api/cms/tag', { name: 'From the table', slug: 'from-the-table' })
    expect(made.status).toBe(201)
    expect(JSON.stringify((await a.get('/api/content/tag')).body)).toContain('from-the-table')
    expect(JSON.stringify((await b.get('/api/content/tag')).body)).not.toContain('from-the-table')
    expect((await siteQuery(t.a, 'select slug from tag where slug = $1', ['from-the-table']))).toHaveLength(1)
    expect((await siteQuery(t.b, 'select slug from tag where slug = $1', ['from-the-table']))).toHaveLength(0)
    // A token that sits encrypted inside the row's settings is the site's token.
    expect((await tenantGet(url('a'), '/api/health/status', '', { 'x-api-key': t.a.statusToken })).status).toBe(200)
    expect((await tenantGet(url('a'), '/api/health/status', '', { 'x-api-key': t.b.statusToken })).status).toBe(401)
    // Nothing in the table is readable as a password.
    const { rows } = await control.query('select row::text as text from tenant_sites')
    for (const r of rows) {
      expect(r.text).not.toContain(new URL(t.a.databaseUrl).password)
      expect(r.text).not.toContain(new URL(t.b.databaseUrl).password)
      expect(r.text).not.toContain(rowOf('site-a').secret)
    }
  })

  it('the app\'s role reads that one table and nothing else', async () => {
    const c = new pg.Client({ connectionString: readerUrl })
    await c.connect()
    try {
      expect((await c.query('select count(*)::int n from tenant_sites')).rows[0].n).toBe(2)
      await expect(c.query(`update tenant_sites set template = 'x'`)).rejects.toThrow(/permission denied/)
      await expect(c.query('delete from tenant_sites')).rejects.toThrow(/permission denied/)
      await expect(c.query('select * from something_else')).rejects.toThrow(/permission denied/)
    }
    finally { await c.end() }
  })

  it('a change of a row is taken up within a second: paused, back, removed, added', async () => {
    const status = () => tenantGet(url('b'), '/api/content/tag').then((r) => r.status)
    await put(stored(rowOf('site-b'), { state: 'paused' }))
    await taken('B is paused', status, 503)
    expect((await tenantGet(url('a'), '/api/content/tag')).status).toBe(200)
    await put(stored(rowOf('site-b')))
    await taken('B is back', status, 200)
    await control.query('delete from tenant_sites where id = $1', ['site-b'])
    await taken('B is gone', status, 404)
    await put(stored(rowOf('site-b')))
    await taken('B is there again', status, 200)
  })

  it('rows of another app (another template) are not this app\'s', async () => {
    await put(stored({ ...rowOf('site-b'), id: 'site-of-another-app', hosts: ['another-app.localhost'] }), 'another-template')
    await new Promise((r) => setTimeout(r, 800))
    expect((await tenantGet(url('another-app'), '/api/content/tag')).status).toBe(404)
    await control.query('delete from tenant_sites where id = $1', ['site-of-another-app'])
  })

  it('a row with a password in plain text is refused: the last good directory stays, and the log says why', async () => {
    await put({ ...stored(rowOf('site-a')), databaseUrl: rowOf('site-a').databaseUrl })
    await second.waitForLog(/site site-a: "databaseUrl" must be encrypted/, 8000)
    // Site A is still served, from the row as it was.
    expect((await tenantGet(url('a'), '/api/content/tag')).status).toBe(200)
    // A row encrypted with another key is refused the same way.
    await put({ ...stored(rowOf('site-a')), secret: encrypt(rowOf('site-a').secret, 'another-key-that-is-long-enough-0123456789') })
    await new Promise((r) => setTimeout(r, 800))
    expect((await tenantGet(url('a'), '/api/content/tag')).status).toBe(200)
    await put(stored(rowOf('site-a')))
    await new Promise((r) => setTimeout(r, 800))
  })
})

describe('host names a site is also served at, and a site that moved away', () => {
  it('an "also" host serves the site without a redirect; any other host of the site still redirects to its own', async () => {
    await put(stored(rowOf('site-a'), { alsoHosts: ['internal-a.localhost'] }))
    await taken('the also-host is served', () => tenantGet(url('internal-a'), '/api/content/tag').then((r) => r.status), 200)
    const viaAlso = await tenantGet(url('internal-a'), '/api/content/tag')
    expect(JSON.stringify(viaAlso.body)).toContain('from-the-table')
    const alias = await tenantGet(url('www.site-a'), '/api/content/tag?limit=1')
    expect(alias.status).toBe(308)
    expect(alias.headers.get('location')).toBe(`${rowOf('site-a').publicUrl}/api/content/tag?limit=1`)
    // Signing in on the also-host works (a session of its own: the cookie belongs to the host).
    const there = await siteLogin({ url: url('internal-a') }, 'admin@test.local')
    expect((await there.get('/api/cms/_auth/me')).status).toBe(200)
    // The admin's sockets are admitted from the also-host too, and not from a look-alike.
    expect(await upgradeStatus(url('internal-a'), '/api/cms/_live', { origin: url('internal-a'), cookie: there.cookie })).toBe(101)
    expect(await upgradeStatus(url('internal-a'), '/api/cms/_live', { origin: 'http://internal-b.localhost', cookie: there.cookie })).toBe(403)
    // A host cannot belong to two sites: the directory with the clash is not taken up.
    await put(stored(rowOf('site-b'), { alsoHosts: ['internal-a.localhost'] }))
    await second.waitForLog(/lists the host internal-a\.localhost twice/, 8000)
    await put(stored(rowOf('site-b')))
    await put(stored(rowOf('site-a')))
    await taken('the also-host is gone', () => tenantGet(url('internal-a'), '/api/content/tag').then((r) => r.status), 404)
  })

  it('a moved site sends every request to where it lives now, and has no sockets here', async () => {
    const b = await siteLogin({ url: url('b') }, 'editor@test.local')
    await put(stored(rowOf('site-b'), { state: 'moved', movedTo: 'https://b.example/' }))
    await taken('B moved', () => tenantGet(url('b'), '/api/content/tag?x=1').then((r) => r.status), 308)
    for (const path of ['/', '/admin', '/api/content/tag?x=1', '/api/cms/_graph']) {
      const res = await tenantGet(url('b'), path, b.cookie)
      expect(res.status, path).toBe(308)
      expect(res.headers.get('location'), path).toBe(`https://b.example${path}`)
    }
    expect((await fetch(`${url('b')}/api/cms/tag`, { method: 'POST', redirect: 'manual', headers: { cookie: b.cookie, 'content-type': 'application/json' }, body: '{}' })).status).toBe(308)
    expect(await upgradeStatus(url('b'), '/api/cms/_live', { origin: url('b'), cookie: b.cookie })).toBe(404)
    // A is not touched; a moved site without an address to go to is refused by the directory.
    expect((await tenantGet(url('a'), '/api/content/tag')).status).toBe(200)
    await put(stored(rowOf('site-b'), { state: 'moved' }))
    await second.waitForLog(/a moved site needs "movedTo"/, 8000)
    await put(stored(rowOf('site-b')))
    await taken('B is served again', () => tenantGet(url('b'), '/api/content/tag').then((r) => r.status), 200)
  })
})

describe('the operator\'s list of sites', () => {
  it('needs the operator\'s token, and does not exist where none is configured', async () => {
    expect((await operator(ip(), '')).status).toBe(401)
    expect((await operator(ip(), 'a-wrong-token-0123456789')).status).toBe(401)
    expect((await operator(ip(), t.a.statusToken)).status).toBe(401)
    // A site's own session opens nothing there.
    const a = await siteLogin({ url: url('a') }, 'admin@test.local')
    expect((await tenantGet(url('a'), '/api/health/sites', a.cookie)).status).toBe(401)
    // The helper's server has no operator token: no such route.
    expect((await tenantGet(t.ipUrl, '/api/health/sites', '', { authorization: `Bearer ${OPERATOR}` })).status).toBe(404)
  })

  it('lists every site with its state, by IP or on any host, and no secret', async () => {
    await tenantGet(url('a'), '/api/content/tag')
    await tenantGet(url('b'), '/api/content/tag')
    for (const base of [ip(), url('a'), `http://nobody.localhost:${new URL(ip()).port}`]) {
      const res = await operator(base)
      expect(res.status, base).toBe(200)
      expect(res.body.sites.map((s: any) => s.id).sort()).toEqual(['site-a', 'site-b'])
    }
    const res = await operator()
    const a = res.body.sites.find((s: any) => s.id === 'site-a')
    expect(a).toMatchObject({ hosts: ['site-a.localhost', 'www.site-a.localhost'], state: 'active', loaded: true, migrations: 'done' })
    expect(res.body.totals).toMatchObject({ sites: 2, failedMigrations: [] })
    expect(res.body.totals.connections.cap).toBeGreaterThan(0)
    expect(res.body.totals.memory.rssBytes).toBeGreaterThan(0)
    for (const secret of [new URL(t.a.databaseUrl).password, rowOf('site-a').secret, t.a.statusToken, KEY]) expect(res.text).not.toContain(secret)
    expect(res.text).not.toContain('databaseUrl')
  })
})

describe('a site nobody uses gives its memory back', () => {
  it('is unloaded after the idle time and made again by its next request; one with an open admin tab stays', async () => {
    const a = new Client(url('a'))
    const b = await siteLogin({ url: url('b') }, 'editor@test.local')
    expect((await a.get('/api/content/tag')).status).toBe(200)
    const tab = new LiveTab(b)
    await tab.opened()
    try {
      expect((await seen('site-a')).loaded).toBe(true)
      // Two seconds of quiet (the test's setting): A goes, B, with its open tab, stays.
      await until('A is unloaded', () => seen('site-a'), (s) => s.loaded === false, 8000)
      const bNow = await seen('site-b')
      expect(bNow.loaded).toBe(true)
      expect((await seen('site-a')).connections).toBeNull()
      // Looking at the list did not load A again.
      expect((await seen('site-a')).loaded).toBe(false)
      // The next request makes it again, with nothing lost.
      const again = await a.get('/api/content/tag')
      expect(again.status).toBe(200)
      expect(JSON.stringify(again.body)).toContain('from-the-table')
      expect((await seen('site-a'))).toMatchObject({ loaded: true, migrations: 'done' })
    }
    finally {
      tab.close()
      await tab.ended()
    }
    // With its tab closed, B goes too.
    await until('B is unloaded', () => seen('site-b'), (s) => s.loaded === false, 10_000)
    expect((await b.get('/api/cms/_auth/me')).status).toBe(200)
  })
})

describe('the session cookie', () => {
  it('carries the __Host- prefix when it is named so: Secure, for the whole site, and for this host only', async () => {
    const res = await fetch(`${url('a')}/api/cms/_auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: url('a') },
      body: JSON.stringify({ email: 'author@test.local', password: 'correct horse battery' }),
    })
    expect(res.status).toBe(200)
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE}=`))
    expect(cookie, res.headers.getSetCookie().join(' | ')).toBeTruthy()
    const attrs = cookie!.split(';').slice(1).map((a) => a.trim().toLowerCase())
    expect(attrs).toContain('secure')
    expect(attrs).toContain('path=/')
    expect(attrs).toContain('httponly')
    expect(attrs.some((a) => a.startsWith('domain='))).toBe(false)
    // The session works, and only on its own site.
    const pair = cookie!.split(';')[0]!
    expect((await tenantGet(url('a'), '/api/cms/_auth/me', pair)).status).toBe(200)
    expect((await tenantGet(url('b'), '/api/cms/_auth/me', pair)).status).toBe(401)
  })

  it('a server whose cookie has no such prefix says so when it starts', async () => {
    expect(t.server.logs.join('')).toMatch(/Name it with the __Host- prefix/)
    expect(second.logs.join('')).not.toMatch(/Name it with the __Host- prefix/)
  })
})
