import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { Agent, request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { doc } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'
import { startServer } from '../helpers/server'
import { Collaborator, LiveTab, upgradeStatus } from '../helpers/sockets'
import { expectNoSiteErrors, siteClient, siteMail, siteQuery, startTenants, tenantGet, tenantPost, type Tenants, until, waitForSiteMail } from '../helpers/tenants'

// Two sites in one process: how a request, and a socket, finds its site, and what the
// directory's states do (paused, read-only, removed, added, changed) while the server runs.
// The directory is rewritten here, so this file has a server of its own.
let t: Tenants
beforeAll(async () => { t = await startTenants('hosts') }, 120_000)
afterAll(async () => {
  try { expectNoSiteErrors(t) }
  finally { await t?.stop() }
})

const LIVE = '/api/cms/_live'
const COLLAB = '/api/cms/_collab/socket'
const tabs: LiveTab[] = []
const open = async (site: { url: string }, cookie: string) => {
  const tab = new LiveTab(siteClient(site, { cookie }))
  tabs.push(tab)
  await tab.opened()
  return tab
}
afterEach(async () => {
  for (const tab of tabs.splice(0)) tab.close()
  // Every test leaves the directory as it found it.
  if (readFileSync(t.directoryFile, 'utf8') !== JSON.stringify({ sites: t.rows }, null, 2)) await t.writeDirectory(t.rows)
})

/** The directory with one site's row changed. */
const withRow = (id: string, change: Record<string, unknown>) => t.rows.map((r) => (r.id === id ? { ...r, ...change } : r))

describe('a socket finds its site by its host name, as a request does', () => {
  it('opens on the site its session was made on', async () => {
    for (const path of [LIVE, COLLAB]) {
      expect(await upgradeStatus(t.a.url, path, { origin: t.a.url, cookie: t.a.cookies.editor }), path).toBe(101)
      expect(await upgradeStatus(t.b.url, path, { origin: t.b.url, cookie: t.b.cookies.editor }), path).toBe(101)
    }
  })

  it('is refused for a host that is no site, by IP, and for an alias host', async () => {
    const alias = `http://www.site-a.localhost:${t.port}`
    for (const path of [LIVE, COLLAB]) {
      // Site A's valid session and origin: only the host is wrong.
      expect(await upgradeStatus(t.unknownUrl, path, { origin: t.a.url, cookie: t.a.cookies.editor }), `${path} unknown host`).toBe(404)
      expect(await upgradeStatus(t.unknownUrl, path, { origin: t.unknownUrl, cookie: t.a.cookies.editor }), `${path} unknown host, own origin`).toBe(404)
      expect(await upgradeStatus(t.ipUrl, path, { origin: t.a.url, cookie: t.a.cookies.editor }), `${path} by IP`).toBe(404)
      // An alias redirects pages; a socket has nothing to follow, so it gets none.
      expect(await upgradeStatus(alias, path, { origin: alias, cookie: t.a.cookies.editor }), `${path} alias`).toBe(404)
      expect(await upgradeStatus(alias, path, { origin: t.a.url, cookie: t.a.cookies.editor }), `${path} alias, main origin`).toBe(404)
    }
  })

  it('refuses site A\'s session on site B\'s host, although the same account id and session version exist there', async () => {
    expect(t.a.users.editor).toBe(t.b.users.editor)
    const versions = async (site: typeof t.a) => (await siteQuery(site, 'select session_version from cms_users where id = $1', [site.users.editor]))[0].session_version
    expect(await versions(t.a)).toBe(await versions(t.b))
    for (const path of [LIVE, COLLAB]) {
      // As a browser on B's admin would send it (B's origin) with a cookie copied from A.
      expect(await upgradeStatus(t.b.url, path, { origin: t.b.url, cookie: t.a.cookies.editor }), path).toBe(401)
      // A page of site A opening a socket to site B (A's origin): refused for its origin.
      expect(await upgradeStatus(t.b.url, path, { origin: t.a.url, cookie: t.a.cookies.editor }), `${path} from A's page`).toBe(403)
      expect(await upgradeStatus(t.b.url, path, { origin: t.a.url, cookie: t.b.cookies.editor }), `${path} B's session from A's page`).toBe(403)
    }
  })

  it('a forged X-Forwarded-Host does not move a socket to another site', async () => {
    // B's session, B's origin and a forwarded host that says B, sent to A's host: still A, which refuses it.
    expect(await upgradeStatus(t.a.url, LIVE, { origin: t.b.url, cookie: t.b.cookies.editor, 'x-forwarded-host': t.b.host })).toBe(403)
    expect(await upgradeStatus(t.a.url, LIVE, { origin: t.a.url, cookie: t.b.cookies.editor, 'x-forwarded-host': t.b.host })).toBe(401)
  })
})

describe('one connection, several host names', () => {
  it('each request on a kept-alive connection is answered by the site its own Host header names', async () => {
    // A proxy in front keeps connections to the app open and sends requests for many sites
    // down each: the site must be chosen per request, never remembered for the connection.
    const admin = siteClient(t.a, 'admin')
    expect((await admin.post('/api/cms/tag', { name: 'Kept alive on A', slug: 'kept-alive-on-a' })).status).toBe(201)
    const agent = new Agent({ keepAlive: true, maxSockets: 1 })
    const sockets = new Set<unknown>()
    const get = (host: string, path: string, cookie = '') => new Promise<{ status: number; text: string }>((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port: t.port, path, agent, headers: { host: `${host}:${t.port}`, accept: 'application/json', ...(cookie ? { cookie } : {}) } }, (res) => {
        let text = ''
        res.on('data', (c) => { text += c })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text }))
      })
      req.on('socket', (socket) => sockets.add(socket))
      req.on('error', reject)
      req.end()
    })
    try {
      for (let round = 0; round < 3; round++) {
        const a = await get(t.a.host, '/api/content/tag')
        expect(a.status).toBe(200)
        expect(a.text).toContain('kept-alive-on-a')
        const b = await get(t.b.host, '/api/content/tag')
        expect(b.status).toBe(200)
        expect(b.text).not.toContain('kept-alive-on-a')
        // A's session right after A's request, on the same connection, to B's host: refused.
        expect((await get(t.a.host, '/api/cms/_auth/me', t.a.cookies.admin)).status).toBe(200)
        expect((await get(t.b.host, '/api/cms/_auth/me', t.a.cookies.admin)).status).toBe(401)
        expect((await get('nobody.localhost', '/api/content/tag')).status).toBe(404)
        expect((await get(t.a.host.toUpperCase(), '/api/content/tag')).text).toContain('kept-alive-on-a')
        expect((await get(`${t.a.host}.`, '/api/content/tag')).text).toContain('kept-alive-on-a')
      }
      expect(sockets.size).toBe(1) // it really was one connection
    }
    finally { agent.destroy() }
  })
})

describe('a request with no site', () => {
  it('the process\'s health checks answer by IP also when a browser sends a session cookie along', async () => {
    // No site, so no accounts to look the cookie up in: it is ignored, not an error.
    for (const cookie of [t.a.cookies.admin, t.b.cookies.editor]) {
      const ready = await tenantGet(t.ipUrl, '/api/health/ready', cookie)
      expect([ready.status, ready.body]).toEqual([200, { ok: true, sites: 2 }])
      const live = await tenantGet(t.unknownUrl, '/api/health/live', cookie)
      expect([live.status, live.body]).toEqual([200, { ok: true }])
    }
    // Nothing else is served without a site, with a cookie or without.
    for (const path of ['/api/cms/_auth/me', '/api/health/status', '/api/content/tag']) {
      expect((await tenantGet(t.ipUrl, path, t.a.cookies.admin)).status, path).toBe(404)
    }
  })
})

describe('a paused site', () => {
  it('answers 503 on every kind of route and comes back; the other site never notices', async () => {
    const tab = await open(t.a, t.a.cookies.editor)
    await t.writeDirectory(withRow('site-a', { state: 'paused' }))
    for (const path of ['/', '/admin', '/api/content/tag', '/api/cms/_auth/me', '/sitemap.xml', '/api/health/status', '/api/health/ready', '/api/mcp']) {
      const res = await tenantGet(t.a.url, path, t.a.cookies.admin)
      expect(res.status, path).toBe(503)
      expect(res.text, path).toBe('This website is paused')
      expect(res.headers.get('retry-after')).toBe('300')
    }
    expect((await tenantPost(t.a.url, '/api/cms/_auth/login', { email: 'admin@test.local', password: 'correct horse battery' })).status).toBe(503)
    for (const path of [LIVE, COLLAB]) expect(await upgradeStatus(t.a.url, path, { origin: t.a.url, cookie: t.a.cookies.editor }), path).toBe(503)
    // A socket that was open when the site was paused is closed, at the latest by its next message.
    if (!tab.closed) tab.send({ type: 'watch', topic: 'list:tag' })
    await tab.ended()
    expect(tab.all.filter((m) => m.type === 'presence')).toEqual([])

    // B meanwhile: pages, the admin and a write.
    expect((await tenantGet(t.b.url, '/api/content/tag')).status).toBe(200)
    expect((await siteClient(t.b, 'admin').post('/api/cms/tag', { name: 'While A is paused', slug: 'while-a-is-paused' })).status).toBe(201)
    // The process's own health check does not count the paused site out of the directory.
    expect((await tenantGet(t.ipUrl, '/api/health/ready')).status).toBe(200)

    await t.writeDirectory(t.rows)
    expect((await tenantGet(t.a.url, '/api/content/tag')).status).toBe(200)
    // The sessions made before the pause still open the admin.
    expect((await siteClient(t.a, 'admin').get('/api/cms/_auth/me')).status).toBe(200)
    expect(await upgradeStatus(t.a.url, LIVE, { origin: t.a.url, cookie: t.a.cookies.editor })).toBe(101)
    // And what B wrote meanwhile did not land on A.
    expect(JSON.stringify((await tenantGet(t.a.url, '/api/content/tag')).body)).not.toContain('while-a-is-paused')
  })
})

describe('a read-only site', () => {
  it('serves reads and refuses every write with 503; the other site writes', async () => {
    const admin = siteClient(t.a, 'admin')
    const before = await admin.post('/api/cms/tag', { name: 'Before read-only', slug: 'before-read-only' })
    expect(before.status).toBe(201)
    await t.writeDirectory(withRow('site-a', { state: 'read-only' }))

    expect((await tenantGet(t.a.url, '/api/content/tag')).status).toBe(200)
    expect((await admin.get('/api/cms/_auth/me')).status).toBe(200)
    expect((await admin.get(`/api/cms/tag/${before.body.row.id}`)).status).toBe(200)
    expect((await tenantGet(t.a.url, '/')).status).toBe(200)

    const writes = [
      await admin.post('/api/cms/tag', { name: 'Refused', slug: 'refused-while-read-only' }),
      await admin.patch(`/api/cms/tag/${before.body.row.id}`, { name: 'Changed' }),
      await admin.delete(`/api/cms/tag/${before.body.row.id}`),
      await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Refused' }),
      // The public writes too: a form, a page view, a consent choice.
      await siteClient(t.a).post('/api/content/_form/contactForm', { name: 'Jana', email: 'jana@example.com', message: 'x', consent: true, _t: 5000 }),
      await siteClient(t.a).post('/api/content/_consent/choice', { choice: { analytics: true }, version: 1 }),
    ]
    for (const res of writes) {
      expect(res.status).toBe(503)
      expect(res.body).toBe('This website is read-only for a moment')
      expect(res.headers.get('retry-after')).toBe('60')
    }
    expect((await siteQuery(t.a, `select name from tag where id = $1`, [before.body.row.id]))[0].name).toBe('Before read-only')
    expect(await siteQuery(t.a, `select 1 from tag where slug = 'refused-while-read-only'`)).toEqual([])
    expect(await siteQuery(t.a, 'select 1 from contact_form')).toEqual([])

    // B writes as always.
    expect((await siteClient(t.b, 'admin').post('/api/cms/tag', { name: 'While A is read-only', slug: 'while-a-is-read-only' })).status).toBe(201)

    await t.writeDirectory(t.rows)
    expect((await admin.patch(`/api/cms/tag/${before.body.row.id}`, { name: 'Changed after' })).status).toBe(200)
  })
})

describe('a site that leaves the directory, and one that joins it, while the server runs', () => {
  it('a removed site answers 404 within a second and its sockets are closed; put back, it works with its old sessions', async () => {
    const tab = await open(t.a, t.a.cookies.editor)
    tab.send({ type: 'watch', topic: 'list:tag' })
    await tab.presence('list:tag', (p) => p.length === 1)
    const onB = await open(t.b, t.b.cookies.editor)

    await t.writeDirectory(t.rows.filter((r) => r.id !== 'site-a')) // returns 0.7 s after the file is in place
    for (const path of ['/', '/admin', '/api/content/tag', '/api/cms/_auth/me', '/api/health/status', '/sitemap.xml']) {
      const res = await tenantGet(t.a.url, path, t.a.cookies.admin)
      expect(res.status, path).toBe(404)
      expect(res.text, path).toBe('No website at this address')
    }
    expect(await upgradeStatus(t.a.url, LIVE, { origin: t.a.url, cookie: t.a.cookies.editor })).toBe(404)
    await tab.ended()
    // The two probes answer for the process under any host that is no site (a platform asks
    // by IP): they say nothing about the site that left, also when its cookie comes along.
    expect((await tenantGet(t.ipUrl, '/api/health/ready')).body).toEqual({ ok: true, sites: 1 })
    expect((await tenantGet(t.a.url, '/api/health/ready', t.a.cookies.admin)).body).toEqual({ ok: true, sites: 1 })
    expect((await tenantGet(t.a.url, '/api/health/live', t.a.cookies.admin)).body).toEqual({ ok: true })
    // B's socket and B's pages are untouched.
    expect(onB.closed).toBeNull()
    expect((await tenantGet(t.b.url, '/api/content/tag')).status).toBe(200)

    await t.writeDirectory(t.rows)
    expect((await tenantGet(t.a.url, '/api/content/tag')).status).toBe(200)
    expect((await siteClient(t.a, 'admin').get('/api/cms/_auth/me')).status).toBe(200)
    expect((await siteClient(t.a, 'admin').post('/api/cms/tag', { name: 'Back again', slug: 'back-again' })).status).toBe(201)
    expect(await upgradeStatus(t.a.url, LIVE, { origin: t.a.url, cookie: t.a.cookies.editor })).toBe(101)
  })

  it('a site added while the server runs is served at once, from its own empty database, with its own setup code', async () => {
    const { row, site: c } = await t.makeThirdSite()
    expect((await tenantGet(c.url, '/api/content/tag')).status).toBe(404) // not in the directory yet
    await t.writeDirectory([...t.rows, row])
    expect((await tenantGet(t.ipUrl, '/api/health/ready')).body).toEqual({ ok: true, sites: 3 })

    // Its first request starts it (migrations checked, search index): wait for ready, as a platform would.
    await until('site C to be ready', () => tenantGet(c.url, '/api/health/ready'), (r) => r.status === 200 && r.body?.migrations === 'done')
    const tags = await tenantGet(c.url, '/api/content/tag')
    expect(tags.status).toBe(200)
    expect(tags.body.items).toEqual([])
    // A's and B's sessions mean nothing here, and there is no account to sign in to.
    expect((await siteClient(c, { cookie: t.a.cookies.admin }).get('/api/cms/_auth/me')).status).toBe(401)
    expect((await tenantPost(c.url, '/api/cms/_auth/login', { email: 'admin@test.local', password: 'correct horse battery' })).status).toBe(401)
    // First-run setup takes C's own code, not A's.
    const account = { name: 'Cecil', email: 'cecil@test.local', password: 'correct horse battery' }
    expect((await tenantPost(c.url, '/api/cms/_auth/setup', { ...account, token: t.a.setupToken })).status).toBe(403)
    const made = await tenantPost(c.url, '/api/cms/_auth/setup', { ...account, token: c.setupToken })
    expect(made.status).toBe(201)
    expect((await siteQuery(c, 'select email from cms_users')).map((r) => r.email)).toEqual(['cecil@test.local'])
    expect((await siteQuery(t.a, `select 1 from cms_users where email = 'cecil@test.local'`))).toEqual([])
    // C's new session opens C and nothing else.
    expect((await siteClient(c, { cookie: made.cookie }).post('/api/cms/tag', { name: 'On C', slug: 'only-on-c' })).status).toBe(201)
    expect((await siteClient(t.a, { cookie: made.cookie }).get('/api/cms/_auth/me')).status).toBe(401)
    expect(JSON.stringify((await tenantGet(t.a.url, '/api/content/tag')).body)).not.toContain('only-on-c')
    expect(JSON.stringify((await tenantGet(t.b.url, '/api/content/tag')).body)).not.toContain('only-on-c')
    expect(await upgradeStatus(c.url, LIVE, { origin: c.url, cookie: made.cookie })).toBe(101)
  })

  it('a changed row takes effect within a second: the site\'s new status token works, the old one does not', async () => {
    const fresh = 'a-new-status-token-for-site-b-0123456789'
    const row = t.rows.find((r) => r.id === 'site-b')
    await t.writeDirectory(withRow('site-b', { config: { ...row.config, status: { token: fresh } } }))
    expect((await tenantGet(t.b.url, '/api/health/status', '', { 'x-api-key': t.b.statusToken })).status).toBe(401)
    expect((await tenantGet(t.b.url, '/api/health/status', '', { 'x-api-key': fresh })).status).toBe(200)
    // The site was unloaded and loaded again: its sessions (the same secret) still hold.
    expect((await siteClient(t.b, 'admin').get('/api/cms/_auth/me')).status).toBe(200)
    // A was not touched: its token is not B's new one.
    expect((await tenantGet(t.a.url, '/api/health/status', '', { 'x-api-key': fresh })).status).toBe(401)
    expect((await tenantGet(t.a.url, '/api/health/status', '', { 'x-api-key': t.a.statusToken })).status).toBe(200)
  })

  it('a request that is under way when its site\'s row changes is finished, not failed', async () => {
    // A save whose body arrives slowly (a large entry on a slow line): the request has been
    // admitted and has its site's database in hand, and is still reading the body when the
    // directory row of that site changes (here: a new status token; when a site is moved: its state).
    const admin = siteClient(t.a, 'admin')
    const tag = (await admin.post('/api/cms/tag', { name: 'Before the change', slug: 'saved-during-a-change' })).body.row
    let finish!: () => void
    const rest = new Promise<void>((r) => { finish = r })
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode('{"name":'))
        await rest
        controller.enqueue(new TextEncoder().encode('"Saved during the change"}'))
        controller.close()
      },
    })
    const saving = fetch(`${t.a.url}/api/cms/tag/${tag.id}`, {
      method: 'PATCH', body, duplex: 'half',
      headers: { 'content-type': 'application/json', accept: 'application/json', cookie: t.a.cookies.admin, origin: t.a.url },
    } as RequestInit).then(async (r) => ({ status: r.status, text: await r.text() }))
    await new Promise((r) => setTimeout(r, 200)) // the request is in the handler, waiting for the rest of its body

    const fresh = 'a-new-status-token-for-site-a-0123456789'
    const row = t.rows.find((r) => r.id === 'site-a')
    await t.writeDirectory(withRow('site-a', { config: { ...row.config, status: { token: fresh } } }))
    // The change has been taken up: the site answers with its new settings.
    expect((await tenantGet(t.a.url, '/api/health/status', '', { 'x-api-key': fresh })).status).toBe(200)

    finish()
    const saved = await saving
    expect(saved.status, saved.text).toBe(200)
    expect((await siteQuery(t.a, 'select name from tag where id = $1', [tag.id]))[0].name).toBe('Saved during the change')
  })

  it('a request that began under the old row does not bring the old row\'s settings back', async () => {
    // The site's settings are kept in memory per site and made on first use. A request that
    // was admitted before the row changed still carries the old row; if it is the first to
    // ask for the settings after the change, the site must not end up with the old ones.
    let finish!: () => void
    const rest = new Promise<void>((r) => { finish = r })
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode('{"email":'))
        await rest
        controller.enqueue(new TextEncoder().encode('"editor@test.local"}'))
        controller.close()
      },
    })
    // A password-reset request whose body arrives slowly: after the body it asks for the site's address (its settings).
    const asking = fetch(`${t.a.url}/api/cms/_auth/forgot`, {
      method: 'POST', body, duplex: 'half',
      headers: { 'content-type': 'application/json', accept: 'application/json', origin: t.a.url },
    } as RequestInit).then((r) => r.status)
    await new Promise((r) => setTimeout(r, 200))

    const fresh = 'another-status-token-for-site-a-0123456789'
    const row = t.rows.find((r) => r.id === 'site-a')
    await t.writeDirectory(withRow('site-a', { config: { ...row.config, status: { token: fresh } } }))
    // Site B is asked, so the server has read the new directory; nothing has asked for A's settings since.
    expect((await tenantGet(t.b.url, '/api/content/tag')).status).toBe(200)
    finish()
    expect(await asking).toBe(200)
    await waitForSiteMail(t.a, 'editor@test.local', (m) => m.text.includes('/admin/reset/'))

    // The new row holds: the new token works and the old one does not.
    expect((await tenantGet(t.a.url, '/api/health/status', '', { 'x-api-key': fresh })).status).toBe(200)
    expect((await tenantGet(t.a.url, '/api/health/status', '', { 'x-api-key': t.a.statusToken })).status).toBe(401)
  })

  it('a changed row closes the site\'s sockets so that they reconnect; text typed into a shared document is kept, not lost', async () => {
    const admin = siteClient(t.a, 'admin')
    const editor = siteClient(t.a, 'editor')
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id, title: 'Open while the row changes', body: doc('Uloženo') })
    const session = async () => (await editor.get(`/api/cms/_collab/session?entity=post&id=${post.id}`)).body
    const first = await session()
    const writer = new Collaborator(editor, first)
    const watcher = new Collaborator(admin, (await admin.get(`/api/cms/_collab/session?entity=post&id=${post.id}`)).body)
    const onB = await open(t.b, t.b.cookies.editor)
    const tab = await open(t.a, t.a.cookies.editor)
    try {
      await writer.synced()
      await watcher.synced()
      writer.type('Rozepsáno před změnou řádku')
      await until('the server to have the typed text', () => watcher.text(), (text) => text.includes('Rozepsáno před změnou řádku'))
      let closed = false
      writer.socket.on('close', () => { closed = true })

      // Another alias for A: its row changed, so its memory (sockets, engine, pool) is let go and made anew.
      await t.writeDirectory(withRow('site-a', { hosts: [...t.rows[0].hosts, 'also.site-a.localhost'] }))
      expect((await tenantGet(t.a.url, '/api/content/tag')).status).toBe(200)
      expect((await tab.ended()).code).toBe(4000) // "Reconnect"
      await until('the shared-editing socket to be closed', () => closed, (c) => c)
      expect(onB.closed).toBeNull() // B's sockets are not touched by A's row
    }
    finally {
      writer.close()
      watcher.close()
    }
    // A browser reconnects at once and is admitted afresh.
    expect(await upgradeStatus(t.a.url, LIVE, { origin: t.a.url, cookie: t.a.cookies.editor })).toBe(101)
    // The text typed before the change is still there for the next editor: in the document, or offered as left-over text.
    const settled = await until('the document to settle', () => siteQuery(t.a, 'select name, active_at is null as idle from cms_collab where name like $1', [`post/${post.id}%`]), (rows) => rows.some((r) => r.name === first.name && r.idle), 10_000)
    expect(settled.length).toBeGreaterThan(0)
    const next = await session()
    const again = new Collaborator(editor, next)
    try {
      await again.synced()
      expect(JSON.stringify(next.unsaved ?? null) + again.text()).toContain('Rozepsáno před změnou řádku')
    }
    finally { again.close() }
  })

  it('a directory that cannot be used keeps the last good one, and says so', async () => {
    writeFileSync(t.directoryFile, '{ "sites": [ this is not JSON')
    await new Promise((r) => setTimeout(r, 700))
    expect((await tenantGet(t.a.url, '/api/content/tag')).status).toBe(200)
    expect((await tenantGet(t.b.url, '/api/content/tag')).status).toBe(200)
    await t.server.waitForLog(/the site directory changed and cannot be used; keeping the previous one/)
    // Two sites claiming one host: refused as a whole, nothing changes hands.
    await t.writeDirectory([t.rows[0], { ...t.rows[1], hosts: [t.a.host] }])
    expect((await siteClient(t.a, 'admin').get('/api/cms/_auth/me')).status).toBe(200)
    expect((await siteClient(t.a, { cookie: t.b.cookies.admin }).get('/api/cms/_auth/me')).status).toBe(401)
    await t.server.waitForLog(/lists the host site-a\.localhost twice/)
  })
})

describe('settings a site has in the directory', () => {
  /** Both rows with something added to each site's own settings. */
  const withConfig = (add: (id: 'site-a' | 'site-b') => Record<string, unknown>) => t.rows.map((r) => ({ ...r, config: { ...r.config, ...add(r.id) } }))
  const tokenOf = (id: string) => `content-token-of-${id}-0123456789abcdef`

  it('a content token is the site\'s own: A\'s token opens A\'s content API and is refused by B\'s; the pages still render', async () => {
    for (const site of [t.a, t.b]) {
      const admin = siteClient(site, 'admin')
      const author = await createAuthor(admin)
      await createPost(admin, { author: author.id, title: `Behind the token of ${site.id}`, slug: 'behind-the-token', status: 'published', body: doc('x') })
      await createPost(admin, { author: author.id, title: `Draft of ${site.id}`, slug: 'draft-behind-the-token', body: doc('x') })
    }
    await t.writeDirectory(withConfig((id) => ({ content: { token: tokenOf(id) } })))
    const get = (site: { url: string }, path: string, token?: string) => tenantGet(site.url, path, '', token ? { 'x-api-key': token } : {})
    for (const [site, own, foreign] of [[t.a, tokenOf('site-a'), tokenOf('site-b')], [t.b, tokenOf('site-b'), tokenOf('site-a')]] as const) {
      for (const path of ['/api/content/post', '/api/content/post/behind-the-token', '/api/content/_global/siteSettings', '/api/content/_search?q=token', '/api/content/_sitemap', '/api/content/_tree/page', '/api/openapi.json']) {
        expect((await get(site, path)).status, `${site.id} ${path} without a token`).toBe(401)
        expect((await get(site, path, foreign)).status, `${site.id} ${path} with the other site's token`).toBe(401)
        expect((await get(site, path, own)).status, `${site.id} ${path} with its own token`).toBe(200)
      }
      // A draft, with the token and ?preview: the site's own token only.
      expect((await get(site, '/api/content/post/draft-behind-the-token?preview', own)).body.item.title).toBe(`Draft of ${site.id}`)
      expect((await get(site, '/api/content/post/draft-behind-the-token?preview', foreign)).status).toBe(401)
      // The site's own pages fetch their content inside the process, without the token, and stay in their site.
      const page = await get(site, '/blog')
      expect(page.status).toBe(200)
      expect(page.text).toContain(`Behind the token of ${site.id}`)
      expect(page.text).not.toContain(tokenOf('site-a'))
      expect(page.text).not.toContain(tokenOf('site-b'))
      expect(page.text).not.toContain(`Behind the token of ${site === t.a ? 'site-b' : 'site-a'}`)
      // A private content API keeps its entries out of the sitemap.
      expect((await get(site, '/sitemap.xml')).text).not.toContain('behind-the-token')
    }
    // One site with a token, the other without: B is public again, A still asks.
    await t.writeDirectory(withConfig((id) => (id === 'site-a' ? { content: { token: tokenOf(id) } } : {})))
    expect((await get(t.b, '/api/content/post')).status).toBe(200)
    expect((await get(t.a, '/api/content/post')).status).toBe(401)
    expect((await get(t.a, '/api/content/post', tokenOf('site-a'))).status).toBe(200)
  })

  it('the sender of a site\'s e-mails is its own', async () => {
    await t.writeDirectory(withConfig((id) => {
      const row = t.rows.find((r) => r.id === id)
      return id === 'site-a' ? { mail: { ...row.config.mail, from: 'Alpha Bakery <hello@alpha.test>' } } : {}
    }))
    const email = 'author@test.local'
    await Promise.all([tenantPost(t.a.url, '/api/cms/_auth/forgot', { email }), tenantPost(t.b.url, '/api/cms/_auth/forgot', { email })])
    const reset = (m: { text: string }) => m.text.includes('/admin/reset/')
    const [a, b] = await Promise.all([waitForSiteMail(t.a, email, reset), waitForSiteMail(t.b, email, reset)])
    expect(a.from).toBe('Alpha Bakery <hello@alpha.test>')
    expect(b.from).not.toContain('alpha.test')
    expect(siteMail(t.b).filter((m) => String(m.from).includes('alpha.test'))).toEqual([])
  })

  it('a site without a setup code in the directory gets one of its own in the log, naming the site', async () => {
    const { row, site: c } = await t.makeThirdSite()
    const { auth: _auth, ...config } = row.config
    await t.writeDirectory([...t.rows, { ...row, config }])
    await until('site C to be ready', () => tenantGet(c.url, '/api/health/ready'), (r) => r.status === 200 && r.body?.migrations === 'done')
    expect((await tenantGet(c.url, '/api/cms/_auth/status')).body).toMatchObject({ needsSetup: true, needsToken: true, codeIn: 'log' })
    const [, code] = await t.server.waitForLog(/No administrator yet \(site site-c\)\. Setup code: (\S+) — open http:\/\/site-c\.localhost:\d+\/admin\/setup/)
    const account = { name: 'Cecil', email: 'cecil@test.local', password: 'correct horse battery' }
    // Neither A's configured code nor nothing: only the code printed for C.
    expect((await tenantPost(c.url, '/api/cms/_auth/setup', { ...account, token: t.a.setupToken })).status).toBe(403)
    expect((await tenantPost(c.url, '/api/cms/_auth/setup', { ...account, token: code })).status).toBe(201)
    // A and B, which have accounts, were not offered a code.
    expect(t.server.logs.join('')).not.toMatch(/No administrator yet \(site site-[ab]\)/)
  })
})

describe('starting in multi-tenant mode', () => {
  const env = (extra: Record<string, string>) => ({ DATABASE_URL: '', NUXT_CMS_DATABASE_URL: '', NUXT_CMS_PUBLIC_URL: '', NUXT_CMS_TENANCY_MODE: 'multi', ...extra })
  const refusal = (extra: Record<string, string>) => startServer('', env(extra)).then(async (server) => { await server.stop(); return 'started' }, (err) => String(err.message))

  it('the server does not start without a usable site directory, and says why', async () => {
    expect(await refusal({})).toContain('set NUXT_CMS_TENANCY_FILE to its JSON file')
    expect(await refusal({ NUXT_CMS_TENANCY_FILE: 'sites.json' })).toContain('must be an absolute path')
    const dir = mkdtempSync(join(tmpdir(), 'cms-tenants-bad-'))
    try {
      const file = join(dir, 'sites.json')
      const good = t.rows[0]
      const cases: [unknown, RegExp][] = [
        [[{ ...good, secret: 'too short' }], /"secret" must be at least 32 characters/],
        [[{ ...good, id: 'Not An Id' }], /"id" must be 1-63 characters/],
        [[good, { ...t.rows[1], hosts: good.hosts }], /lists the host site-a\.localhost twice/],
        [[good, { ...t.rows[1], id: good.id }], /lists the id site-a twice/],
        [[{ ...good, databaseUrl: 'mysql://x' }], /"databaseUrl" must be a postgres:\/\/ address/],
        [[{ ...good, publicUrl: 'site-a.localhost' }], /"publicUrl" must be the site's address/],
        [[{ ...good, hosts: [] }], /"hosts" needs at least one host name/],
      ]
      for (const [sites, message] of cases) {
        writeFileSync(file, JSON.stringify({ sites }))
        expect(await refusal({ NUXT_CMS_TENANCY_FILE: file })).toMatch(message)
      }
      // A request's host must never reach an e-mail link when hosts choose the site.
      writeFileSync(file, JSON.stringify({ sites: [good] }))
      expect(await refusal({ NUXT_CMS_TENANCY_FILE: file, CMS_ALLOW_REQUEST_ORIGIN: '1' })).toContain('CMS_ALLOW_REQUEST_ORIGIN=1 is not allowed in multi-tenant mode')
    }
    finally { rmSync(dir, { recursive: true, force: true }) }
  }, 120_000)
})

describe('a site\'s database user', () => {
  const as = (site: typeof t.a, database: string) => {
    const url = new URL(site.databaseUrl)
    url.pathname = `/${database}`
    return { ...site, databaseUrl: url.toString() }
  }

  it('opens its own database and is refused on the other site\'s, both ways', async () => {
    expect((await siteQuery(t.a, 'select current_user as u, current_database() as d'))[0]).toEqual({ u: t.a.role, d: t.a.database })
    await expect(siteQuery(as(t.a, t.b.database), 'select 1')).rejects.toThrow(/CONNECT privilege|permission denied/)
    await expect(siteQuery(as(t.b, t.a.database), 'select 1')).rejects.toThrow(/CONNECT privilege|permission denied/)
  })

  it('cannot make databases or users, load the extensions that reach another database, or read server files', async () => {
    await expect(siteQuery(t.a, 'create database tzmt_should_not_exist')).rejects.toThrow(/permission denied/)
    await expect(siteQuery(t.a, `create role tzmt_should_not_exist login password 'x'`)).rejects.toThrow(/permission denied/)
    await expect(siteQuery(t.a, 'create extension dblink')).rejects.toThrow(/permission denied|not available|could not open/)
    await expect(siteQuery(t.a, 'create extension postgres_fdw')).rejects.toThrow(/permission denied|not available|could not open/)
    await expect(siteQuery(t.a, `copy cms_users to '/tmp/tzmt_should_not_exist'`)).rejects.toThrow(/permission denied|must be superuser|pg_write_server_files/)
    await expect(siteQuery(t.a, `select pg_read_file('/etc/passwd')`)).rejects.toThrow(/permission denied/)
  })

  it('sees no other site\'s rows from where it can connect', async () => {
    // What the helper's cluster leaves open (CONNECT on `postgres` and `template1` is PUBLIC's
    // by default; a real cluster revokes it, see docs/multi-tenant-plan.md 2.3): wherever the
    // user gets in, the other site's tables are not there to read.
    for (const database of ['postgres', 'template1']) {
      const c = new pg.Client({ connectionString: as(t.a, database).databaseUrl })
      const connected = await c.connect().then(() => true, () => false)
      if (!connected) continue
      try {
        const { rows } = await c.query(`select count(*)::int as n from information_schema.tables where table_name in ('cms_users', 'post', 'cms_media')`)
        expect(rows[0].n, database).toBe(0)
        await expect(c.query('create table tzmt_should_not_exist (x int)'), database).rejects.toThrow(/permission denied|no schema has been selected/)
        // Other sessions exist for it to see, never what they run.
        const seen = await c.query(`select count(*)::int as n from pg_stat_activity where usename <> current_user and query is not null and query <> '<insufficient privilege>'`)
        expect(seen.rows[0].n, database).toBe(0)
      }
      finally { await c.end() }
    }
  })
})
