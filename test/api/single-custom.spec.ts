import { execSync } from 'node:child_process'
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as playground from '../../playground/cms.config'
import { clientCommand } from '../../packages/cms/cli/client'
import { modelCommand } from '../../packages/cms/cli/model'
import { writeModelFile, type ModelFile } from '../../packages/cms/src/index'
import { Client, doc } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'
import { scratchDatabase, startServer, type SpawnedServer } from '../helpers/server'
import { Collaborator, LiveTab } from '../helpers/sockets'
import { expectNoSiteErrors, siteQuery, until } from '../helpers/tenants'

// A single-site app (no site directory, no hosts) with its own content types:
// NUXT_CMS_CUSTOM_TYPES=on in single mode (docs/model-file-plan.md, section 9). The playground's
// build, served as an ordinary single-site server on a database of its own. Every server here is
// one this spec starts (the shared test server of the api project is not used).
//
// What is proven: a type made over the API is served by the very next request on every route
// that knows types; the search follows a hidden and a restored field (the fresh instance rebuilt
// its index); a request under way ends with the model it started with; a live socket is told to
// reconnect; shared editing keeps what was typed; a scheduled entry across changes is announced
// once; the code-first types still work; hiding, restoring and deleting for good; the app's own
// model file (registered at start, `follow`, a file that does not fit, a file that does not
// read, `off`); the developer's flow (pull, then client) equals the served types; two servers on
// one database and one Redis; timings.
const PASSWORD = 'correct horse battery'
const SETUP = 'single-custom-setup-code'
const REDIS = process.env.TEST_REDIS_URL

/** Short waits (the test knobs), as tenants-custom.spec.ts has them. */
const PURGE_EMPTY_MS = 3000
const DELETE_WAIT_MS = 1500
const MAIN_PREFIX = `cms:single:main:${Date.now().toString(36)}`

let db: { url: string; drop: () => Promise<void> }
let server: SpawnedServer
let admin: Client
/** Reads the public content API with no sign-in. */
let pub: Client

const text = (label: string) => ({ en: label })
const textField = (key: string, extra: Record<string, unknown> = {}) => ({ key, type: 'text', label: text(key), ...extra })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const dbOf = (url: string) => ({ databaseUrl: url })

async function model(c: Client): Promise<any> {
  const res = await c.get('/api/cms/_model')
  if (res.status !== 200) throw new Error(`GET /api/cms/_model: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

const changeMs: number[] = []

async function change(c: Client, ops: unknown[], extra: Record<string, unknown> = {}) {
  for (let round = 0; ; round++) {
    const m = await model(c)
    const started = performance.now()
    const res = await c.post('/api/cms/_model', { baseVersion: m.version, ops, ...extra })
    if (res.status === 409 && res.body?.data?.code === 'stale-version' && round < 4) continue
    if (res.status === 200 && !extra.dryRun) changeMs.push(performance.now() - started)
    return res
  }
}

async function mustChange(c: Client, ops: unknown[]) {
  const res = await change(c, ops)
  if (res.status !== 200) throw new Error(`change ${JSON.stringify(ops).slice(0, 300)}: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

const graph = async (c: Client) => (await c.get('/api/cms/_graph')).body as any[]
const graphEntity = async (c: Client, name: string) => (await graph(c)).find((e) => e.name === name)
const fieldKeys = async (c: Client, name: string) => ((await graphEntity(c, name))?.fields ?? []).map((f: any) => f.key as string)
const tablesOf = async (url: string) => (await siteQuery(dbOf(url), `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`)).map((r) => r.table_name as string)
const interfaceOf = (source: string, name: string) => new RegExp(`export interface ${name} \\{[^]*?\\n\\}`).exec(source)?.[0] ?? ''

/** The single-site server's environment: the switch on, its own Redis prefix (the shared test server uses the same Redis). */
export function singleEnv(more: Record<string, string> = {}): Record<string, string> {
  return {
    NUXT_CMS_CUSTOM_TYPES: 'on',
    NUXT_CMS_AUTH_SETUP_TOKEN: SETUP,
    ...(REDIS ? { NUXT_CMS_REDIS_URL: REDIS, NUXT_CMS_REDIS_PREFIX: `cms:single:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` } : {}),
    ...more,
  }
}

// ---------------------------------------------------------------------------------------------
// Every server this file starts is remembered: at the end none of them may have logged work
// without a site, or a "failed" / "could not" line the test did not provoke on purpose.

interface Own { name: string; server: SpawnedServer; db: { url: string; drop: () => Promise<void> }; admin: Client; allowed: RegExp[] }
const owned: Own[] = []
const databases = new Map<string, { url: string; drop: () => Promise<void> }>()

/** A server on its own database (or one given), the first administrator made by first-run setup, or signed in again on a database that has one. */
async function own(name: string, env: Record<string, string>, opts: { db?: { url: string; drop: () => Promise<void> }; allowed?: RegExp[] } = {}): Promise<Own> {
  const database = opts.db ?? await scratchDatabase(`sc_${name}`)
  databases.set(database.url, database)
  const s = await startServer(database.url, env)
  const c = new Client(s.baseURL)
  if (opts.db) {
    const res = await c.post('/api/cms/_auth/login', { email: 'admin@test.local', password: PASSWORD })
    if (res.status !== 200) throw new Error(`login (${name}): ${res.status} ${JSON.stringify(res.body)}`)
  }
  else {
    const res = await c.post('/api/cms/_auth/setup', { name: 'Ada Admin', email: 'admin@test.local', password: PASSWORD, token: SETUP })
    if (res.status !== 201) throw new Error(`setup (${name}): ${res.status} ${JSON.stringify(res.body)}`)
  }
  const o: Own = { name, server: s, db: database, admin: c, allowed: opts.allowed ?? [] }
  owned.push(o)
  return o
}

const providedLines = (o: { server: SpawnedServer; allowed?: RegExp[] }) =>
  o.server.logs.join('').split('\n').filter((l) => (/\[cms\].*(failed|could not)/.test(l) || /"msg":"cms task failed"/.test(l)) && !(o.allowed ?? []).some((re) => re.test(l)))

// The receiver of the webhooks (test 6).
interface Hook { path: string; json: any }
const hooks: Hook[] = []
let receiver: HttpServer
let receiverUrl = ''

beforeAll(async () => {
  receiver = createHttpServer((req, res) => {
    let body = ''
    req.on('data', (d) => { body += d })
    req.on('end', () => {
      try { hooks.push({ path: String(req.url), json: JSON.parse(body) }) }
      catch { hooks.push({ path: String(req.url), json: null }) }
      res.writeHead(200).end('ok')
    })
  })
  await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve))
  receiverUrl = `http://127.0.0.1:${(receiver.address() as { port: number }).port}`

  db = await scratchDatabase('single_custom')
  databases.set(db.url, db)
  server = await startServer(db.url, singleEnv({
    ...(REDIS ? { NUXT_CMS_REDIS_PREFIX: MAIN_PREFIX } : {}),
    NUXT_CMS_WEBHOOKS_URLS: `${receiverUrl}/ok`,
    NUXT_CMS_WEBHOOKS_SECRET: 'single-custom-webhook-secret',
    CMS_TEST_MODEL_PURGE_EMPTY_MS: String(PURGE_EMPTY_MS),
    CMS_TEST_MODEL_DELETE_WAIT_MS: String(DELETE_WAIT_MS),
    CMS_TEST_MODEL_SWEEP_MS: '500',
    // The playground's test route that shows the model one request works with (playground/server/api/test-model-probe.get.ts).
    CMS_TEST_MODEL_PROBE: '1',
  }))
  admin = new Client(server.baseURL)
  pub = new Client(server.baseURL)
  const res = await admin.post('/api/cms/_auth/setup', { name: 'Ada Admin', email: 'admin@test.local', password: PASSWORD, token: SETUP })
  if (res.status !== 201) throw new Error(`setup: ${res.status} ${JSON.stringify(res.body)}`)
  owned.push({ name: 'main', server, db, admin, allowed: [] })
}, 120_000)

afterAll(async () => {
  try {
    if (changeMs.length) {
      const sorted = [...changeMs].sort((a, b) => a - b)
      console.info(`[timing] all structure changes over HTTP in this run: ${sorted.length} samples, min ${sorted[0]!.toFixed(0)} ms, median ${sorted[Math.floor(sorted.length / 2)]!.toFixed(0)} ms, max ${sorted.at(-1)!.toFixed(0)} ms`)
    }
    const problems: string[] = []
    for (const o of owned) {
      const stray = o.server.logs.join('').split('\n').filter((l) => /^(Error|TypeError|\w*Error):/.test(l))
      if (stray.length) console.info(`[log] ${o.name}: ${stray.length} stray error line(s), first: ${stray[0]}`)
      try { expectNoSiteErrors({ server: o.server }) }
      catch (err) { problems.push(`${o.name}: ${(err as Error).message}`) }
      for (const line of providedLines(o)) problems.push(`${o.name}: ${line}`)
    }
    expect(problems, 'lines no test provoked on purpose').toEqual([])
  }
  finally {
    for (const o of owned) await o.server.stop().catch(() => {})
    receiver?.close()
    for (const d of databases.values()) await d.drop().catch(() => {})
    for (const dir of folders) rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------------------------

const WORD = 'kometovnik'
let course: { id: string; slug: string }

describe('a type made over the API', () => {
  it('is served by the next request on every route that knows types', async () => {
    // Fetched BEFORE the change too: a cached stale one would fail below.
    const apiBefore = (await pub.get('/api/openapi.json')).body
    expect(Object.keys(apiBefore.paths)).not.toContain('/api/content/custom_course')
    expect((await pub.get('/api/content-types.ts')).body).not.toMatch(/CustomCourse/)
    expect((await graph(admin)).map((e) => e.name)).not.toContain('custom_course')

    const res = await change(admin, [{ op: 'type.add', name: 'custom_course', label: text('Courses'), labelSingular: text('Course'), titleLabel: text('Title'), page: { prefix: 'kurzy' }, publish: true }])
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    await mustChange(admin, [
      { op: 'field.add', type: 'custom_course', field: textField('teacher') },
      { op: 'field.add', type: 'custom_course', field: textField('blurb', { long: true }) },
    ])
    await mustChange(admin, [{ op: 'type.add', name: 'custom_event', label: text('Events'), labelSingular: text('Event'), page: { prefix: 'akce' }, publish: true }])

    // The admin graph.
    const e = await graphEntity(admin, 'custom_course')
    expect(e.fields.map((f: any) => f.key)).toEqual(expect.arrayContaining(['title', 'teacher']))
    // The entry routes: create, list, read, update.
    const made = await admin.post('/api/cms/custom_course', { title: `Kurz ${WORD}`, slug: 'python', teacher: 'Ada', status: 'published' })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    course = { id: made.body.row.id, slug: made.body.row.slug }
    expect((await admin.get('/api/cms/custom_course')).body.rows.map((r: any) => r.id)).toEqual([course.id])
    expect((await admin.get(`/api/cms/custom_course/${course.id}`)).body.row.teacher).toBe('Ada')
    expect((await admin.patch(`/api/cms/custom_course/${course.id}`, { teacher: 'Jana' })).body.row.teacher).toBe('Jana')
    expect((await admin.patch(`/api/cms/custom_course/${course.id}`, { teacher: 'Ada' })).status).toBe(200)
    // The content API: published entries are read with no sign-in.
    expect((await pub.get('/api/content/custom_course')).body.items.map((i: any) => i.slug)).toEqual(['python'])
    expect((await pub.get('/api/content/custom_course/python')).body.item).toMatchObject({ title: `Kurz ${WORD}`, teacher: 'Ada' })
    // The generated types and the API description.
    expect(interfaceOf((await pub.get('/api/content-types.ts')).body, 'CustomCourse')).toContain('teacher')
    const api = (await pub.get('/api/openapi.json')).body
    expect(Object.keys(api.paths)).toEqual(expect.arrayContaining(['/api/content/custom_course', '/api/content/custom_course/{slug}']))
    expect(Object.keys(api.components.schemas).some((s) => s.startsWith('CustomCourse'))).toBe(true)
    // The searches.
    const site = await until('the site search to find the course', async () => (await pub.get(`/api/content/_search?q=${WORD}`)).body?.items ?? [], (items: any[]) => items.some((i) => i.entity === 'custom_course'), 10_000)
    expect(site.filter((i: any) => i.entity === 'custom_course').map((i: any) => i.path)).toEqual(['/kurzy/python'])
    const inAdmin = await until('the admin search to find the course', async () => (await admin.get(`/api/cms/_search?q=${WORD}`)).body?.items ?? [], (items: any[]) => items.some((i) => i.entity === 'custom_course'), 10_000)
    expect(inAdmin.filter((i: any) => i.entity === 'custom_course').map((i: any) => i.id)).toEqual([course.id])
    // A code-first collection still works.
    expect((await admin.get('/api/cms/post')).status).toBe(200)
  }, 60_000)
})

describe('the search follows hiding and restoring a field', () => {
  const RARE = 'zebrofantnik'
  const found = async (c: Client, route: string) => ((await c.get(`${route}?q=${RARE}`)).body?.items ?? []).filter((i: any) => i.entity === 'custom_course').length
  const both = async () => [await found(pub, '/api/content/_search'), await found(admin, '/api/cms/_search')]

  it('stops finding a word of a hidden field, and finds it again once the field is restored', async () => {
    const made = await admin.post('/api/cms/custom_course', { title: 'Kurz dva', slug: 'dva', teacher: 'Bob', blurb: `Jen tady je slovo ${RARE}`, status: 'published' })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    await until('both searches to find the word', both, ([a, b]) => a === 1 && b === 1, 15_000)

    expect((await change(admin, [{ op: 'field.remove', type: 'custom_course', key: 'blurb' }])).status).toBe(200)
    // The first request of the fresh instance; the index is rebuilt in the background after it.
    expect(await fieldKeys(admin, 'custom_course')).not.toContain('blurb')
    await until('neither search to find the hidden field\'s word', both, ([a, b]) => a === 0 && b === 0, 20_000)

    expect((await change(admin, [{ op: 'field.restore', type: 'custom_course', key: 'blurb' }])).status).toBe(200)
    expect(await fieldKeys(admin, 'custom_course')).toContain('blurb')
    await until('both searches to find the word again', both, ([a, b]) => a === 1 && b === 1, 20_000)
    expect((await admin.delete(`/api/cms/custom_course/${made.body.row.id}`)).status).toBe(200)
  }, 90_000)
})

describe('a request under way while the structure changes', () => {
  it('ends well with the model it started with, and the next request sees the new model', async () => {
    const hold = new pg.Client({ connectionString: db.url })
    await hold.connect()
    let pending: Promise<{ status: number; body: any }> | undefined
    try {
      await hold.query('begin')
      await hold.query('select id from custom_course where id = $1 for update', [course.id])
      let settled = false
      pending = admin.patch(`/api/cms/custom_course/${course.id}`, { title: `Kurz ${WORD} (změněno)` })
      void pending.then(() => { settled = true }, () => { settled = true })
      await sleep(300)
      expect(settled, 'the update waits for the row the test holds').toBe(false)

      // The structure of ANOTHER type changes while the update waits.
      const res = await change(admin, [{ op: 'field.add', type: 'custom_event', field: textField('city') }])
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(settled, 'the update is still waiting after the change').toBe(false)
      await hold.query('commit')
    }
    finally {
      await hold.query('rollback').catch(() => {})
      await hold.end()
    }
    const done = await pending!
    expect(done.status, JSON.stringify(done.body)).toBe(200)
    expect(done.body.row.title).toBe(`Kurz ${WORD} (změněno)`)
    expect((await siteQuery(dbOf(db.url), 'select title from custom_course where id = $1', [course.id]))[0].title).toBe(`Kurz ${WORD} (změněno)`)
    await admin.patch(`/api/cms/custom_course/${course.id}`, { title: `Kurz ${WORD}` })
    // The new request is served by the new model.
    expect(await fieldKeys(admin, 'custom_event')).toContain('city')
    expect((await pub.get('/api/content/custom_course/python')).status).toBe(200)
  })

  it('sees one model from its start to its end: a type made meanwhile is not there for it, and is there for the next request', async () => {
    const LOCK = 72_099_001
    const hold = new pg.Client({ connectionString: db.url })
    await hold.connect()
    let pending: Promise<{ status: number; body: any }> | undefined
    try {
      await hold.query('select pg_advisory_lock($1)', [LOCK])
      // The request reads the site's own types, then waits for the lock the test holds, then reads them again.
      pending = admin.get(`/api/test-model-probe?lock=${LOCK}`)
      await sleep(300)
      expect((await change(admin, [{ op: 'type.add', name: 'custom_probe', label: text('Probe') }])).status).toBe(200)
      // A request made after the change is served by the new model while the first one still waits.
      expect((await admin.get('/api/test-model-probe')).body.after).toContain('custom_probe')
    }
    finally {
      await hold.query('select pg_advisory_unlock($1)', [LOCK]).catch(() => {})
      await hold.end()
    }
    const done = await pending!
    expect(done.status, JSON.stringify(done.body)).toBe(200)
    expect(done.body.before).not.toContain('custom_probe')
    expect(done.body.after, 'the request under way saw a second model').toEqual(done.body.before)
    expect((await change(admin, [{ op: 'type.remove', type: 'custom_probe' }])).status).toBe(200)
  })
})

describe('a live socket during a change', () => {
  it('is told to reconnect (4000), and a new socket works', async () => {
    const tabs: LiveTab[] = []
    try {
      const old = new LiveTab(admin)
      tabs.push(old)
      await old.opened()
      old.send({ type: 'watch', topic: 'list:custom_course' })
      await old.presence('list:custom_course', (p) => p.length >= 1)

      expect((await change(admin, [{ op: 'field.add', type: 'custom_event', field: textField('live1') }])).status).toBe(200)
      // The next request makes the fresh instance; the old one is released once its requests finished.
      expect(await fieldKeys(admin, 'custom_event')).toContain('live1')
      expect((await old.ended(10_000)).code).toBe(4000)

      const fresh = new LiveTab(admin)
      tabs.push(fresh)
      await fresh.opened()
      fresh.send({ type: 'watch', topic: 'list:custom_course' })
      const people = await fresh.presence('list:custom_course', (p) => p.length >= 1)
      expect(people.people.map((p: any) => p.name)).toContain('Ada Admin')
      // And a change notice reaches it.
      expect((await admin.patch(`/api/cms/custom_course/${course.id}`, { teacher: 'Eva' })).status).toBe(200)
      expect((await fresh.next((m) => m.type === 'change' && m.topic === 'list:custom_course')).type).toBe('change')
      await admin.patch(`/api/cms/custom_course/${course.id}`, { teacher: 'Ada' })
      expect(fresh.closed).toBeNull()
    }
    finally {
      for (const t of tabs) t.close()
    }
  }, 30_000)
})

describe('shared editing across a change of structure', () => {
  it('keeps what a Collaborator typed and was not stored yet', async () => {
    const TYPED = 'ptakopyskovec'
    await mustChange(admin, [
      { op: 'type.add', name: 'custom_memo', label: text('Memo') },
      { op: 'field.add', type: 'custom_memo', field: { key: 'bodyText', type: 'richtext', label: text('Body') } },
    ])
    const made = await admin.post('/api/cms/custom_memo', { title: 'Poznámka', bodyText: doc('saved text') })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    const session = () => admin.get<any>(`/api/cms/_collab/session?entity=custom_memo&id=${made.body.row.id}`)
    const s1 = await session()
    expect(s1.status, JSON.stringify(s1.body)).toBe(200)

    const tab = new Collaborator(admin, s1.body)
    const later: Collaborator[] = []
    try {
      await tab.synced()
      tab.type(`typed ${TYPED}`, 'bodyText')
      await sleep(400) // the text has reached the server, it is not stored yet
      // The structure of ANOTHER type changes.
      expect((await change(admin, [{ op: 'field.add', type: 'custom_event', field: textField('collab1') }])).status).toBe(200)
      expect(await fieldKeys(admin, 'custom_event')).toContain('collab1')
      tab.close()

      // The next browser to open the entry sees what was typed (the working copy, or the text offered aside).
      const seen = await until('the typed text to be kept', async () => {
        const s = await session()
        if (s.status !== 200) return `session ${s.status}`
        const c = new Collaborator(admin, s.body)
        later.push(c)
        try { await c.synced(); return `${c.text('bodyText')} ${JSON.stringify(s.body.unsaved ?? null)}` }
        catch (err) { return `refused ${(err as Error).message} ${JSON.stringify(s.body.unsaved ?? null)}` }
      }, (t) => t.includes(TYPED), 20_000)
      expect(seen).toContain(TYPED)
    }
    finally {
      tab.close()
      for (const c of later) c.close()
    }
    // The entry itself still reads.
    expect((await admin.get(`/api/cms/custom_memo/${made.body.row.id}`)).status).toBe(200)
  }, 60_000)
})

describe('a scheduled task across changes', () => {
  it('announces the entry exactly once and logs no error about the task', async () => {
    const author = await createAuthor(admin)
    const at = new Date(Date.now() + 2500).toISOString()
    const post = await createPost(admin, { author: author.id, slug: 'brzy', status: 'published', publishedAt: at })
    const mine = () => hooks.filter((h) => h.json?.id === post.id && h.json?.type === 'entry.published')
    expect(mine()).toEqual([])
    // Structure changes while the entry waits for its time (each one gives the site a fresh instance, the scheduler runs every second).
    for (let n = 1; n <= 3; n++) {
      expect((await change(admin, [{ op: 'field.add', type: 'custom_event', field: textField(`sched${n}`) }])).status).toBe(200)
      expect(await fieldKeys(admin, 'custom_event')).toContain(`sched${n}`)
      await sleep(500)
    }
    await until('the publish webhook', () => mine(), (h) => h.length >= 1, 15_000).catch((e) => { console.info(JSON.stringify(hooks).slice(0, 1500), server.logs.join('').slice(-3000)); throw e })
    await sleep(3500) // several more scheduler runs: none may announce it again
    expect(mine()).toHaveLength(1)
    expect(mine()[0]!.json).toMatchObject({ type: 'entry.published', public: true })
    expect((await pub.get('/api/content/post/brzy')).status).toBe(200)
    const lines = server.logs.join('').split('\n').filter((l) => /scheduled/i.test(l) && /(error|fail|could not)/i.test(l))
    expect(lines).toEqual([])
    expect(providedLines({ server })).toEqual([])
  }, 60_000)
})

describe('the code-first types after the changes', () => {
  it('still make, read and serve an author and a post', async () => {
    const author = await createAuthor(admin, { name: 'Autor po změnách' })
    const post = await createPost(admin, { author: author.id, slug: 'po-zmenach', status: 'published' })
    expect((await admin.get(`/api/cms/author/${author.id}`)).body.row.name).toBe('Autor po změnách')
    expect((await admin.get(`/api/cms/post/${post.id}`)).body.row.slug).toBe('po-zmenach')
    const served = await pub.get('/api/content/post/po-zmenach')
    expect(served.status, JSON.stringify(served.body)).toBe(200)
    expect(served.body.item.slug).toBe('po-zmenach')
    // Their entries are told apart from the custom types' in the one admin graph.
    const names = (await graph(admin)).map((e) => e.name)
    expect(names).toEqual(expect.arrayContaining(['author', 'post', 'custom_course', 'custom_event']))
  })
})

describe('hiding, restoring and deleting for good', () => {
  it('hides a field and a type, restores the field, and deletes the type for good; its table is gone', async () => {
    await mustChange(admin, [
      { op: 'type.add', name: 'custom_gone', label: text('Gone') },
      { op: 'field.add', type: 'custom_gone', field: textField('note') },
      { op: 'field.add', type: 'custom_course', field: textField('tmpField') },
    ])
    // The type holds an entry, so the server's own timer (for what was removed empty) leaves it for a person to delete.
    expect((await admin.post('/api/cms/custom_gone', { title: 'Zůstane chvíli', note: 'x' })).status).toBe(201)
    expect(await tablesOf(db.url)).toContain('custom_gone')

    expect((await change(admin, [{ op: 'field.remove', type: 'custom_course', key: 'tmpField' }, { op: 'type.remove', type: 'custom_gone' }])).status).toBe(200)
    const hiddenAt = performance.now()
    expect(await fieldKeys(admin, 'custom_course')).not.toContain('tmpField')
    expect((await graph(admin)).map((e) => e.name)).not.toContain('custom_gone')
    expect((await admin.get('/api/cms/custom_gone')).status).toBe(404)
    expect((await pub.get('/api/content-types.ts')).body).not.toMatch(/CustomGone/)

    expect((await change(admin, [{ op: 'field.restore', type: 'custom_course', key: 'tmpField' }])).status).toBe(200)
    expect(await fieldKeys(admin, 'custom_course')).toContain('tmpField')

    // Too soon is refused; after the wait it goes.
    const soon = await change(admin, [{ op: 'purge', types: ['custom_gone'] }])
    expect(soon.status, JSON.stringify(soon.body)).toBe(422)
    expect(soon.body.data.code).toBe('too-soon')
    await sleep(Math.max(0, DELETE_WAIT_MS + 300 - (performance.now() - hiddenAt)))
    const gone = await change(admin, [{ op: 'purge', types: ['custom_gone'] }])
    expect(gone.status, JSON.stringify(gone.body)).toBe(200)
    expect(await tablesOf(db.url)).not.toContain('custom_gone')
    expect((await model(admin)).doc.types.map((x: any) => x.name)).not.toContain('custom_gone')
    expect((await admin.get('/api/cms/custom_course')).status).toBe(200)
  }, 60_000)
})

// ---------------------------------------------------------------------------------------------
// The app's own model file: each case has its own server and database.

const folders: string[] = []
const folder = () => { const dir = mkdtempSync(join(tmpdir(), 'single-custom-')); folders.push(dir); return dir }

const TITLE = { key: 'title', type: 'text', label: text('Title'), required: true }
const fileOf = (types: unknown[]): ModelFile => ({ format: 1, version: 1, types } as ModelFile)
const courseType = (fields: unknown[], label = 'Courses') => ({ name: 'custom_course', label: text(label), labelSingular: text('Course'), titleField: 'title', page: { prefix: 'kurzy' }, publish: true, fields })
const bookType = () => ({ name: 'custom_book', label: text('Books'), labelSingular: text('Book'), titleField: 'title', fields: [TITLE, textField('isbn')] })
function writeFile(content: string | ModelFile): string {
  const path = join(folder(), 'cms.model.json')
  writeFileSync(path, typeof content === 'string' ? content : writeModelFile(content))
  return path
}
const fileEnv = (path: string, more: Record<string, string> = {}) => singleEnv({ CMS_TEST_MODEL_FILE: path, ...more })
const codeList = async (c: Client) => (await c.get('/api/cms/_model/code')).body.registrations as any[]
const auditRows = async (url: string, action: string) => siteQuery(dbOf(url), `select action, meta from cms_audit where action = $1 order by created_at`, [action])

describe('the app\'s model file', () => {
  it('is registered at start with `follow`, refuses what it reads being removed, and is not registered again by a restart', async () => {
    const path = writeFile(fileOf([courseType([TITLE, textField('teacher')])]))
    const env = fileEnv(path, { NUXT_CMS_MODEL_FILE: 'follow' })
    const a = await own('9a', env)
    expect((await model(a.admin)).doc.types.map((x: any) => x.name)).toEqual(['custom_course'])
    const list = await codeList(a.admin)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'app', source: 'app', types: 1, breaks: [] })

    // Taking away what the app reads is refused, and the registration is named.
    const m = await model(a.admin)
    const res = await a.admin.post('/api/cms/_model', { baseVersion: m.version, ops: [{ op: 'field.remove', type: 'custom_course', key: 'teacher' }] })
    expect(res.status, JSON.stringify(res.body)).toBe(409)
    expect(res.body.data.code).toBe('breaks-code')
    expect(res.body.data.registrations.map((r: any) => r.name)).toEqual(['app'])

    // A restart on the same database with the same file registers nothing new.
    const before = (await auditRows(a.db.url, 'model.code.register')).length
    expect(before).toBe(1)
    await a.server.stop()
    const again = await own('9a', env, { db: a.db })
    const list2 = await codeList(again.admin)
    expect(list2).toEqual(list)
    expect((await auditRows(a.db.url, 'model.code.register')).length).toBe(before)
    // Nothing was added either (the file has nothing the database lacks).
    expect((await model(again.admin)).version).toBe(m.version)
    await again.server.stop()
  }, 120_000)

  it('`follow` adds what the file has and the database lacks, and never removes or changes', async () => {
    // First a server with no file: the structure is made over the API.
    const first = await own('9b', singleEnv())
    await mustChange(first.admin, [
      { op: 'type.add', name: 'custom_event', label: text('Events'), labelSingular: text('Event') },
      { op: 'field.add', type: 'custom_event', field: textField('place') },
      { op: 'type.add', name: 'custom_course', label: text('Old label'), labelSingular: text('Course'), page: { prefix: 'kurzy' }, publish: true },
      { op: 'field.add', type: 'custom_course', field: textField('room') },
    ])
    const event = await first.admin.post('/api/cms/custom_event', { title: 'Open day', place: 'Prague' })
    expect(event.status, JSON.stringify(event.body)).toBe(201)
    const before = await model(first.admin)
    await first.server.stop()

    const path = writeFile(fileOf([courseType([TITLE, textField('teacher')], 'New label'), bookType()]))
    const next = await own('9b', fileEnv(path, { NUXT_CMS_MODEL_FILE: 'follow' }), { db: first.db })
    const m = await model(next.admin)
    const types = Object.fromEntries(m.doc.types.map((x: any) => [x.name, x]))
    expect(Object.keys(types).sort()).toEqual(['custom_book', 'custom_course', 'custom_event'])
    expect(types.custom_book.fields.map((f: any) => f.key)).toEqual(expect.arrayContaining(['isbn']))
    expect(types.custom_course.fields.map((f: any) => f.key)).toEqual(expect.arrayContaining(['room', 'teacher']))
    expect(types.custom_course.label).toEqual(text('Old label'))
    expect(types.custom_course.fields.find((f: any) => f.key === 'room').removedAt).toBeUndefined()
    expect(types.custom_event).toEqual(before.doc.types.find((x: any) => x.name === 'custom_event'))
    expect((await next.admin.get('/api/cms/custom_event')).body.rows.map((r: any) => [r.id, r.place])).toEqual([[event.body.row.id, 'Prague']])
    expect(m.version).toBeGreaterThan(before.version)

    // The history shows the added version with no person, and the audit line says it came from the file.
    const history = (await next.admin.get('/api/cms/_model/history')).body
    expect(history[0]).toMatchObject({ version: m.version, by: null })
    const audit = (await auditRows(next.db.url, 'model.change')).at(-1)!
    expect(audit.meta.via).toBe('file')
    expect(audit.meta.version).toBe(m.version)
    // And the file is registered as the app's code.
    expect((await codeList(next.admin)).map((r) => [r.name, r.source])).toEqual([['app', 'app']])
    await next.server.stop()
  }, 120_000)

  it('registers a file that does not fit, lists what the site lacks, and logs a warning', async () => {
    const first = await own('9c', singleEnv())
    await mustChange(first.admin, [{ op: 'type.add', name: 'custom_course', label: text('Courses'), labelSingular: text('Course'), page: { prefix: 'kurzy' }, publish: true }])
    await first.server.stop()
    // The file reads a field the site has not got (and no follow to add it).
    const path = writeFile(fileOf([courseType([TITLE, textField('teacher')])]))
    const next = await own('9c', fileEnv(path), { db: first.db })
    expect((await next.admin.get('/api/health/ready')).status).toBe(200)
    expect((await next.admin.get('/api/cms/custom_course')).status).toBe(200)
    const list = await codeList(next.admin)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'app', source: 'app' })
    expect(list[0].breaks.length).toBeGreaterThan(0)
    expect(JSON.stringify(list[0].breaks)).toContain('teacher')
    expect(next.server.logs.join('')).toMatch(/\[cms\].*the code "app" was registered although the site lacks what it reads/)
    // The site did not take the field in.
    expect(await fieldKeys(next.admin, 'custom_course')).not.toContain('teacher')
    await next.server.stop()
  }, 120_000)

  it('ignores a file that does not parse, with one error line, and serves', async () => {
    for (const [name, content] of [['9d1', '{ this is not json'], ['9d2', JSON.stringify({ format: 1, version: 1, types: [], bogus: true })]] as const) {
      const o = await own(name, fileEnv(writeFile(content), { NUXT_CMS_MODEL_FILE: 'follow' }))
      expect((await o.admin.get('/api/health/ready')).status, name).toBe(200)
      expect((await o.admin.get('/api/cms/post')).status, name).toBe(200)
      expect(await codeList(o.admin), name).toEqual([])
      expect((await model(o.admin)).doc.types, name).toEqual([])
      const lines = o.server.logs.join('').split('\n').filter((l) => /model file/.test(l) && /\[cms\]/.test(l))
      expect(lines, `${name}: ${lines.join('\n')}`).toHaveLength(1)
      expect(lines[0]).toMatch(/cannot be read, so it is ignored/)
      await o.server.stop()
    }
  }, 120_000)

  it('is not registered with NUXT_CMS_MODEL_FILE=off, and nothing is added', async () => {
    const path = writeFile(fileOf([courseType([TITLE, textField('teacher')])]))
    const o = await own('9e', fileEnv(path, { NUXT_CMS_MODEL_FILE: 'off' }))
    expect(await codeList(o.admin)).toEqual([])
    expect((await model(o.admin)).doc.types).toEqual([])
    expect(await tablesOf(o.db.url)).not.toContain('custom_course')
    await o.server.stop()
  }, 60_000)
})

// ---------------------------------------------------------------------------------------------

describe('the developer\'s flow in single mode', () => {
  it('`tinyzoo model pull`, then `tinyzoo client` over the playground\'s config, give the types the site serves', async () => {
    const made = await admin.post('/api/cms/_auth/tokens', { name: 'single flow', rights: { write: false, publish: false, delete: false, media: false, entities: null, model: true }, expiresInDays: null })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    const token = made.body.value as string
    const cwd = folder()
    const out: string[] = []
    const code = await modelCommand(['pull', '--url', server.baseURL], { cwd, env: { TINYZOO_TOKEN: token }, log: (l) => out.push(l), error: (l) => out.push(l), interactive: false })
    expect(code, out.join('\n')).toBe(0)
    const pulled = JSON.parse(readFileSync(join(cwd, 'cms.model.json'), 'utf8'))
    expect(pulled.types.map((x: any) => x.name)).toEqual(expect.arrayContaining(['custom_course', 'custom_event']))

    let built = ''
    const c = await clientCommand('client', ['--stdout'], { cwd, loadConfig: async () => playground, write: (s) => { built += s }, log: () => {}, error: () => {} })
    expect(c).toBe(0)
    const served = (await fetch(`${server.baseURL}/api/content-types.ts`)).text()
    expect(built.length).toBeGreaterThan(0)
    expect(built).toBe(await served)
    expect(built).toContain('custom_course')
  }, 60_000)
})

describe.skipIf(!REDIS)('two servers on one database and one Redis', () => {
  it('serve each other\'s changes of structure within about a second', async () => {
    const second = await startServer(db.url, singleEnv({ NUXT_CMS_REDIS_PREFIX: MAIN_PREFIX }))
    owned.push({ name: 'second', server: second, db, admin, allowed: [] })
    const other = new Client(second.baseURL)
    other.cookie = admin.cookie
    try {
      expect((await other.get('/api/cms/_auth/me')).status).toBe(200)
      // The second server has an instance with the old model.
      expect((await other.get('/api/cms/custom_event')).status).toBe(200)
      expect(await fieldKeys(other, 'custom_event')).not.toContain('twin1')

      const started = performance.now()
      expect((await change(admin, [{ op: 'field.add', type: 'custom_event', field: textField('twin1') }])).status).toBe(200)
      await until('the second server to serve the change', async () => fieldKeys(other, 'custom_event'), (keys) => keys.includes('twin1'), 5000)
      const took = performance.now() - started
      console.info(`[timing] a change made on one server served by the other after ${took.toFixed(0)} ms (including the change)`)
      expect(took).toBeLessThan(2500)

      // And the other way round.
      expect(await fieldKeys(admin, 'custom_event')).not.toContain('twin2')
      const res = await change(other, [{ op: 'field.add', type: 'custom_event', field: textField('twin2') }])
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      await until('the first server to serve the change', async () => fieldKeys(admin, 'custom_event'), (keys) => keys.includes('twin2'), 5000)
    }
    finally {
      await second.stop()
    }
  }, 60_000)
})

describe('timings', () => {
  it('measures a change of structure, the first request after it, the same request warm, and the server\'s memory (printed)', async () => {
    await mustChange(admin, [{ op: 'type.add', name: 'custom_timing', label: text('Timing') }])
    const rss = () => Number(execSync(`ps -o rss= -p ${server.pid}`).toString().trim()) / 1024
    expect((await admin.get('/api/cms/custom_timing')).status).toBe(200)
    const before = rss()
    const changes: number[] = []
    const firsts: number[] = []
    for (let n = 1; n <= 20; n++) {
      const m = await model(admin)
      const started = performance.now()
      const res = await admin.post('/api/cms/_model', { baseVersion: m.version, ops: [{ op: 'field.add', type: 'custom_timing', field: textField(`sample${n}`) }] })
      changes.push(performance.now() - started)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const first = performance.now()
      expect((await admin.get('/api/cms/custom_timing')).status).toBe(200)
      firsts.push(performance.now() - first)
    }
    expect(await fieldKeys(admin, 'custom_timing')).toContain('sample20')
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
    const warms: number[] = []
    for (let i = 0; i < 5; i++) {
      const warm = performance.now()
      await admin.get('/api/cms/custom_timing')
      warms.push(performance.now() - warm)
    }
    const after = rss()
    console.info(`[timing] structure change over HTTP, 20 samples (a field added): median ${median(changes).toFixed(0)} ms (min ${Math.min(...changes).toFixed(0)}, max ${Math.max(...changes).toFixed(0)})`)
    console.info(`[timing] first request after a change (the admin list of the type, which makes the fresh instance): median ${median(firsts).toFixed(0)} ms (min ${Math.min(...firsts).toFixed(0)}, max ${Math.max(...firsts).toFixed(0)})`)
    console.info(`[timing] the same request warm: median ${median(warms).toFixed(0)} ms`)
    console.info(`[timing] the server's resident memory: ${before.toFixed(0)} MB before, ${after.toFixed(0)} MB after the 20 changes`)
  }, 120_000)
})
