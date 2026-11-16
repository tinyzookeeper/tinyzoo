import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '../helpers/api'
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
    expect((await new Client(srv.baseURL).get('/api/cms/_auth/status')).body).toMatchObject({ needsSetup: true, needsToken: false, codeIn: null })
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

    const res = await admin.get('/api/cms/_media/raw/x.png?secret=hunter2')
    expect(res.status).toBe(500)
    const report = await waitForReport((r) => r.source === 'request')
    expect(report).toMatchObject({
      source: 'request', status: 500, method: 'GET', path: '/api/cms/_media/raw/x.png',
      requestId: res.headers.get('x-request-id'), userId: setup.body.user.id,
    })
    expect(report.message).toContain('missing config')
    expect(JSON.stringify(report)).not.toContain('hunter2')
    // 4xx are not errors worth reporting.
    expect((await admin.get('/api/cms/_users/not-a-uuid')).status).toBe(404) // an expected error
    await new Promise((r) => setTimeout(r, 300))
    expect(reports().filter((r) => r.source === 'request')).toHaveLength(1)
  })

  it('a failing hook never breaks the request', async () => {
    await scratchDatabase('errors')
    sink = join(dir, 'throwing.jsonl')
    writeFileSync(sink, '')
    const srv = await start(db.url, { NUXT_CMS_STORAGE_DRIVER: 's3', CMS_ERROR_SINK_FILE: sink, CMS_ERROR_SINK_THROW: '1' })
    const c = new Client(srv.baseURL)
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
      NUXT_CMS_WEBHOOKS_URLS: 'http://127.0.0.1:1/hook?token=abc', NUXT_CMS_WEBHOOKS_SECRET: 'secret',
    })
    const admin = new Client(srv.baseURL)
    expect((await admin.post('/api/cms/_auth/setup', { ...person, token: 't' })).status).toBe(201)
    expect((await admin.post('/api/cms/tag', { name: 'Hello', slug: 'hello' })).status).toBe(201)
    const report = await waitForReport((r) => r.source === 'webhook', 20_000)
    expect(report.webhook).toMatchObject({ url: 'http://127.0.0.1:1/hook', type: 'entry.created' })
    expect(JSON.stringify(report)).not.toContain('abc')
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

