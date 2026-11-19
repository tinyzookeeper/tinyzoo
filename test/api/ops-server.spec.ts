import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Client, PNG_1x1 } from '../helpers/api'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'

// Behaviour that needs a server of its own: first-run setup in production without a
// configured token (the shared test server has one), and the cms:error hook (its own
// broken storage driver, webhook address and database).
const person = { name: 'Ada Admin', email: 'ada@example.com', password: 'correct horse battery' }
const CODE = /Setup code: ([A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}) — open /

let servers: SpawnedServer[] = []
const start = async (url: string, env: Record<string, string> = {}) => {
  const s = await startServer(url, env)
  servers.push(s)
  return s
}
afterEach(async () => {
  await Promise.all(servers.map((s) => s.stop()))
  servers = []
})

async function sql<T = any>(url: string, text: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: url })
  await c.connect()
  try { return (await c.query(text, params)).rows }
  finally { await c.end() }
}

describe('setup code in production', () => {
  let db: Awaited<ReturnType<typeof scratchDatabase>>
  beforeAll(async () => { db = await scratchDatabase('setup') })
  afterAll(() => db.drop())

  it('makes a one-time code, prints it, and setup needs it; the code is gone afterwards', async () => {
    const srv = await start(db.url)
    const code = (await srv.waitForLog(CODE))[1]!
    const c = new Client(srv.baseURL)

    expect((await c.get('/api/cms/_auth/status')).body).toEqual({ mode: 'builtin', needsSetup: true, needsToken: true, codeIn: 'log' })
    // Without NUXT_CMS_STATUS_TOKEN the site summary is not there at all.
    expect((await c.get('/api/health/status')).status).toBe(404)
    // Only a hash is stored.
    const [row] = await sql(db.url, `select value from cms_state where key = 'setup_code'`)
    expect(row.value.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(row.value)).not.toContain(code)

    // Without the code, or with a wrong one: refused, and no account was made.
    expect((await c.post('/api/cms/_auth/setup', person)).status).toBe(403)
    const wrong = await c.post('/api/cms/_auth/setup', { ...person, token: 'AAAA-BBBB-CCCC-DDDD' })
    expect(wrong.status).toBe(403)
    expect(wrong.body.data).toEqual({ code: 'setup_token' })
    expect((await sql(db.url, 'select count(*)::int as n from cms_users'))[0].n).toBe(0)

    // The right code, typed the way people do (lower case, no dashes), works once.
    const ok = await c.post('/api/cms/_auth/setup', { ...person, token: code.toLowerCase().replaceAll('-', '') })
    expect(ok.status).toBe(201)
    expect(await sql(db.url, `select 1 from cms_state where key = 'setup_code'`)).toEqual([])
    expect((await c.get('/api/cms/_auth/status')).body).toMatchObject({ needsSetup: false, needsToken: false })
    expect((await new Client(srv.baseURL).post('/api/cms/_auth/setup', { ...person, token: code })).status).toBe(409)
    // The failed attempts are in the audit log.
    expect((await sql(db.url, `select count(*)::int as n from cms_audit where action = 'auth.setup_failed'`))[0].n).toBe(2)
  })

  it('keeps the code across a restart, and replaces it when it is old (its plain text is gone)', async () => {
    await scratchDatabase('setup')
    const first = await start(db.url)
    const code1 = (await first.waitForLog(CODE))[1]!
    await first.stop()

    // A restart a moment later (another replica, a crash loop) does not invalidate the printed code.
    const second = await start(db.url)
    await second.waitForLog(/A setup code was issued a moment ago/)
    expect(second.logs.join('')).not.toMatch(CODE)
    expect((await new Client(second.baseURL).post('/api/cms/_auth/setup', { ...person, token: 'WRONG-CODE-WRONG-CODE' })).status).toBe(403)
    await second.stop()

    // Old enough: the next start makes a new one, prints it, and the old one stops working.
    await sql(db.url, `update cms_state set updated_at = now() - interval '10 minutes' where key = 'setup_code'`)
    const third = await start(db.url)
    const code2 = (await third.waitForLog(CODE))[1]!
    expect(code2).not.toBe(code1)
    const c = new Client(third.baseURL)
    expect((await c.post('/api/cms/_auth/setup', { ...person, token: code1 })).status).toBe(403)
    expect((await c.post('/api/cms/_auth/setup', { ...person, token: code2 })).status).toBe(201)
  })

  it('a configured token still wins: no code is made', async () => {
    await scratchDatabase('setup')
    const srv = await start(db.url, { NUXT_CMS_AUTH_SETUP_TOKEN: 'deploy-token-1' })
    await new Promise((r) => setTimeout(r, 800))
    expect(srv.logs.join('')).not.toContain('Setup code:')
    expect(await sql(db.url, `select 1 from cms_state where key = 'setup_code'`)).toEqual([])
    const c = new Client(srv.baseURL)
    expect((await c.get('/api/cms/_auth/status')).body).toMatchObject({ needsToken: true, codeIn: 'config' })
    expect((await c.post('/api/cms/_auth/setup', { ...person, token: 'AAAA-BBBB-CCCC-DDDD' })).status).toBe(403)
    expect((await c.post('/api/cms/_auth/setup', { ...person, token: 'deploy-token-1' })).status).toBe(201)
  })

  it('development needs no code', async () => {
    await scratchDatabase('setup')
    const srv = await start(db.url, { NODE_ENV: 'development' })
    expect((await new Client(srv.baseURL).get('/api/cms/_auth/status')).body).toEqual({ mode: 'builtin', needsSetup: true, needsToken: false })
    expect(srv.logs.join('')).not.toContain('Setup code:')
    expect((await new Client(srv.baseURL).post('/api/cms/_auth/setup', person)).status).toBe(201)
  })
})

describe('the cms:error hook', () => {
  let dir: string
  let sink: string
  let db: Awaited<ReturnType<typeof scratchDatabase>>
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'cms-error-sink-'))
    db = await scratchDatabase('errors')
  })
  afterAll(async () => {
    rmSync(dir, { recursive: true, force: true })
    await db.drop()
  })

  const reports = () => (existsSync(sink) ? readFileSync(sink, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])
  const waitForReport = async (match: (r: any) => boolean, timeoutMs = 15_000) => {
    const until = Date.now() + timeoutMs
    for (;;) {
      const r = reports().find(match)
      if (r) return r
      if (Date.now() > until) throw new Error(`no matching report within ${timeoutMs} ms: ${JSON.stringify(reports())}`)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  it('reports a 5xx request with its id, path without query, and who was signed in', async () => {
    await scratchDatabase('errors')
    sink = join(dir, 'requests.jsonl')
    writeFileSync(sink, '')
    // No bucket configured: any request that needs storage fails with a real 500.
    const srv = await start(db.url, { NUXT_CMS_STORAGE_DRIVER: 's3', NUXT_CMS_AUTH_SETUP_TOKEN: 't', CMS_ERROR_SINK_FILE: sink })
    const admin = new Client(srv.baseURL)
    const setup = await admin.post('/api/cms/_auth/setup', { ...person, token: 't' })
    expect(setup.status).toBe(201)

    const res = await admin.upload('/api/cms/_media?secret=hunter2', { name: 'a.png', type: 'image/png', data: PNG_1x1 })
    expect(res.status).toBe(500)
    const report = await waitForReport((r) => r.source === 'request')
    expect(report).toMatchObject({
      source: 'request', status: 500, method: 'POST', path: '/api/cms/_media',
      requestId: res.headers.get('x-request-id'), userId: setup.body.user.id,
    })
    expect(report.message).toContain('missing config')
    expect(JSON.stringify(report)).not.toContain('hunter2')
    // Nitro's own line for an unhandled error carries the whole URL, query string included: it is not written.
    await srv.waitForLog(/"level":"error"/)
    expect(srv.logs.join('')).not.toContain('hunter2')
    // 4xx are not errors worth reporting.
    expect((await admin.get('/api/cms/_users/not-a-uuid')).status).toBe(404) // an expected error
    await new Promise((r) => setTimeout(r, 300))
    expect(reports().filter((r) => r.source === 'request')).toHaveLength(1)
  })

  it('a failed query\'s bound values never reach report.error, its cause chain, its stack or the JSON log line', async () => {
    await scratchDatabase('errors')
    sink = join(dir, 'query.jsonl')
    writeFileSync(sink, '')
    const srv = await start(db.url, { NUXT_CMS_AUTH_SETUP_TOKEN: 't', CMS_ERROR_SINK_FILE: sink })
    const admin = new Client(srv.baseURL)
    expect((await admin.post('/api/cms/_auth/setup', { ...person, token: 't' })).status).toBe(201)
    // The table is gone: the insert fails with drizzle's "Failed query: … params: …".
    await sql(db.url, 'drop table tag cascade')
    const secret = 'leak-me-42@example.test'
    const res = await admin.post('/api/cms/tag', { name: secret, slug: 'leak-slug-42' })
    expect(res.status).toBe(500)
    const report = await waitForReport((r) => r.source === 'request' && r.path === '/api/cms/tag')
    expect(report.message).toMatch(/^Query failed/)
    expect(report.error.message).toBe(report.message)
    expect(report.error.stack).toContain(report.message) // header with the safe message, then the frames
    expect(report.error.stack).toMatch(/\n\s+at /)
    let depth = 0
    for (let e = report.error; e; e = e.cause, depth++) expect(e.message).not.toMatch(/Failed query|params:/)
    expect(depth).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(report)).not.toContain('leak-me-42')
    expect(JSON.stringify(report)).not.toContain('leak-slug-42')
    expect(report.rawErrorKept).toBe(true) // the raw error is still handed over, under its own name
    await srv.waitForLog(/"level":"error"/)
    const jsonLines = srv.logs.join('').split('\n').filter((l) => l.startsWith('{"level":"error"'))
    expect(jsonLines.length).toBeGreaterThan(0)
    expect(jsonLines.join('\n')).not.toContain('leak-me-42')
  })

  it('the server\'s whole output has no personal data when a query fails: Nitro\'s own error log is hushed, the answer is unchanged', async () => {
    await scratchDatabase('errors')
    sink = join(dir, 'whole-log.jsonl')
    writeFileSync(sink, '')
    const srv = await start(db.url, { NUXT_CMS_AUTH_SETUP_TOKEN: 't', CMS_ERROR_SINK_FILE: sink })
    const admin = new Client(srv.baseURL)
    expect((await admin.post('/api/cms/_auth/setup', { ...person, token: 't' })).status).toBe(201)
    await sql(db.url, 'drop table tag cascade')

    // The same failed insert as above, with an email in the bound values, and an email in the query string too.
    const email = 'wholelog.leak.7731@example.test'
    const res = await admin.post(`/api/cms/tag?who=${email}`, { name: email, slug: 'wholelog-slug-7731' })
    expect(res.status).toBe(500)
    // What the client gets is what it got before: a plain "Server Error", no details.
    expect(res.body).toMatchObject({ error: true, statusCode: 500, statusMessage: 'Server Error', message: 'Server Error' })
    expect(res.body.data).toBeUndefined()
    expect(res.body.stack).toBeUndefined()

    // A browser asking for a page gets the host's error page (Nuxt renders error.vue, or its own), not JSON: the other way Nitro prints it.
    const page = await admin.get(`/api/cms/tag?who=${email}`, { accept: 'text/html' })
    expect(page.status).toBe(500)
    expect(page.headers.get('content-type')).toMatch(/text\/html/)
    expect(String(page.body)).toMatch(/<html/i)
    // (The page echoes the address the visitor asked for, as Nuxt always does; nothing from the failed query.)
    expect(String(page.body)).toContain('Server Error')
    expect(String(page.body)).not.toMatch(/Failed query|relation|params:|select |insert /i)

    await waitForReport((r) => r.source === 'request' && r.path === '/api/cms/tag')
    await srv.waitForLog(/"level":"error"/)
    await new Promise((r) => setTimeout(r, 300))

    const output = srv.logs.join('')
    for (const needle of [email, 'wholelog.leak', 'wholelog-slug-7731', 'Failed query', 'params:']) expect(output).not.toContain(needle)
    // Nitro's and h3's own dumps of an unhandled error are not written; tinyzoo's JSON line is (with the driver's reason).
    expect(output).not.toMatch(/\[request error\]|\[unhandled\]|\[h3\]/)
    const line = output.split('\n').find((l) => l.startsWith('{"level":"error"') && l.includes('/api/cms/tag'))
    expect(JSON.parse(line!)).toMatchObject({ level: 'error', status: 500, method: 'POST', path: '/api/cms/tag', error: expect.stringContaining('relation "tag" does not exist') })
    expect(line).toMatch(/\\n\s*at |\\n {4}at /)
    // The hook still gets the thrown error, intact, for code inside the process.
    expect((await waitForReport((r) => r.path === '/api/cms/tag')).rawErrorKept).toBe(true)
  })

  it('a failing hook never breaks the request', async () => {
    await scratchDatabase('errors')
    sink = join(dir, 'throwing.jsonl')
    writeFileSync(sink, '')
    const srv = await start(db.url, { NUXT_CMS_STORAGE_DRIVER: 's3', CMS_ERROR_SINK_FILE: sink, CMS_ERROR_SINK_THROW: '1' })
    const c = new Client(srv.baseURL)
    // The raw route serves only files with a media row; with no bucket configured, serving one fails with a real 500.
    await sql(db.url, "insert into cms_media (url, key, mime, size) values ('/api/cms/_media/raw/x.png', 'x.png', 'image/png', 1)")
    expect((await c.get('/api/cms/_media/raw/x.png')).status).toBe(500)
    await srv.waitForLog(/cms:error hook failed/)
    expect((await c.get('/api/health/live')).status).toBe(200)
    expect(reports()).toHaveLength(1)
  })

  it('reports a webhook delivery that gave up', async () => {
    await scratchDatabase('errors')
    sink = join(dir, 'webhooks.jsonl')
    writeFileSync(sink, '')
    const srv = await start(db.url, {
      NUXT_CMS_AUTH_SETUP_TOKEN: 't', CMS_ERROR_SINK_FILE: sink,
      NUXT_CMS_WEBHOOKS_URLS: 'http://127.0.0.1:1/hook?token=tok-not-in-report', NUXT_CMS_WEBHOOKS_SECRET: 'secret',
    })
    const admin = new Client(srv.baseURL)
    expect((await admin.post('/api/cms/_auth/setup', { ...person, token: 't' })).status).toBe(201)
    expect((await admin.post('/api/cms/tag', { name: 'Hello', slug: 'hello' })).status).toBe(201)
    const report = await waitForReport((r) => r.source === 'webhook', 20_000)
    expect(report.webhook).toMatchObject({ type: 'entry.created' })
    expect(report.webhook.url).toMatch(/^http:\/\/127\.0\.0\.1:1\/…#[0-9a-f]{8}$/)
    // A token no random id can contain (the delivery id is a UUID: hex digits and dashes).
    expect(JSON.stringify(report)).not.toContain('tok-not-in-report')
    expect(JSON.stringify(report)).not.toContain('/hook')
    expect(report.status).toBeNull()
  }, 40_000)

  it('reports a scheduled task that failed', async () => {
    await scratchDatabase('errors')
    sink = join(dir, 'tasks.jsonl')
    writeFileSync(sink, '')
    await start(db.url, { CMS_ERROR_SINK_FILE: sink })
    // The scheduler keeps its state in cms_state: without it the minute task cannot run.
    await sql(db.url, 'drop table cms_state')
    const report = await waitForReport((r) => r.source === 'task', 15_000)
    expect(report).toMatchObject({ source: 'task', task: 'cms:scheduled', requestId: null, path: null })
    expect(report.message).toMatch(/cms_state/)
  }, 30_000)
})

