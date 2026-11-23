// How many real Postgres connections does ONE multi-tenant app hold when many sites are used
// in a burst, with and without PgBouncer in front? (See README.md.)
//
//   TEST_DATABASE_URL=postgres://cms:cms@localhost:55440/t5_test node test/pgbouncer/burst.mjs [options]
//
//   --sites 50                          how many sites (each: its own empty database and its own user)
//   --via postgres://localhost:55451    the sites reach their databases through this address (PgBouncer)
//   --cap 30                            NUXT_CMS_TENANCY_MAX_CONNECTIONS of the app (its default is 30)
//   --entry <.../server/index.mjs>      the built playground to start (default: the API suites' build)
//   --minute                            also watch one round of the every-minute tasks (a build with production's cron)
//   --sockets                           also count the server process's own established sockets to the database (lsof)
//   --keep                              keep the databases and roles (default: dropped at the end)
//
// It makes N roles `<test db>_burst_<i>_user` and N empty databases `<test db>_burst_<i>`
// (nobody else may connect), writes a site directory, starts one server process in
// multi-tenant mode and then:
//   1. cold: asks every site for one API route at the same moment, right after the start.
//      Every database is empty: each site is migrated by the app at its first use.
//   2. warm: waits until no connection is left, and asks every site again at the same moment.
// All along it counts, every 20 ms, the connections of the sites' users in pg_stat_activity
// (asked straight from Postgres), and with --via PgBouncer's own count of client connections.
// Only the server started here is stopped (by its pid); only the databases and roles made
// here are dropped.
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback }

const N = Number(option('sites', 50))
const via = option('via', '')
const cap = option('cap', '')
const entry = resolve(option('entry', join(repoRoot, 'node_modules/.cache/cms-test/output/server/index.mjs')))
if (!process.env.TEST_DATABASE_URL) throw new Error('set TEST_DATABASE_URL (the administrator\'s address of the test Postgres)')
if (!existsSync(entry)) throw new Error(`no built server at ${entry}: run an API spec once (it builds the playground), or pass --entry`)
const base = new URL(process.env.TEST_DATABASE_URL)
const testDb = base.pathname.slice(1)
if (!/(^|_)test(_|$)/.test(testDb)) throw new Error(`the test database name must contain "test", got ${testDb}`)

const dbName = (i) => `${testDb}_burst_${i}`
const roleName = (i) => `${testDb}_burst_${i}_user`
const rolePattern = `${testDb}_burst_%`.replace(/_/g, '\\_')
const siteUrl = (i) => {
  const u = new URL(base)
  u.username = roleName(i); u.password = `pw_burst_${i}`; u.pathname = `/${dbName(i)}`
  if (via) { const v = new URL(via); u.hostname = v.hostname; u.port = v.port }
  return u.toString()
}
const adminUrl = (() => { const u = new URL(base); u.pathname = '/postgres'; return u.toString() })()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const freePort = () => new Promise((resolve, reject) => {
  const srv = createServer()
  srv.on('error', reject)
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
})

const admin = new pg.Client({ connectionString: adminUrl })
await admin.connect()
const dropAll = async () => {
  for (let i = 0; i < N; i++) await admin.query(`drop database if exists "${dbName(i)}" with (force)`)
  for (let i = 0; i < N; i++) await admin.query(`drop role if exists "${roleName(i)}"`)
}

// ── the sites ──
let started = Date.now()
await dropAll()
for (let i = 0; i < N; i++) {
  await admin.query(`create role "${roleName(i)}" login password 'pw_burst_${i}' nosuperuser nocreatedb nocreaterole`)
  await admin.query(`create database "${dbName(i)}" owner "${roleName(i)}"`)
  await admin.query(`revoke connect on database "${dbName(i)}" from public`)
}
console.log(`${N} roles and empty databases made in ${Date.now() - started} ms`)

const dirs = mkdtempSync(join(tmpdir(), 'cms-burst-'))
const port = await freePort()
const directoryFile = join(dirs, 'sites.json')
writeFileSync(directoryFile, JSON.stringify({
  sites: Array.from({ length: N }, (_, i) => ({
    id: `burst-${i}`,
    hosts: [`burst-${i}.localhost`],
    publicUrl: `http://burst-${i}.localhost:${port}`,
    databaseUrl: siteUrl(i),
    secret: `secret-of-burst-site-${i}-at-least-32-characters`,
    config: { auth: { setupToken: `setup-code-${i}` }, storage: { driver: 'local', local: { dir: join(dirs, `uploads-${i}`) } }, mail: { file: { dir: join(dirs, `mail-${i}`) } } },
  })),
}))

// ── the counting ──
/** What Postgres lists for the sites' users, and (with --via) what PgBouncer lists as its clients. */
const counter = new pg.Client({ connectionString: adminUrl })
await counter.connect()
let bouncer = null
if (via) {
  const v = new URL(via)
  // PgBouncer's console: its own login (userlist.txt), simple queries only.
  bouncer = new pg.Client({ host: v.hostname, port: Number(v.port), database: 'pgbouncer', user: process.env.PGB_ADMIN_USER || 't5_pgbouncer', password: process.env.PGB_ADMIN_PASSWORD || 't5-pgbouncer-auth-password' })
  await bouncer.connect()
}
const samples = []
let sampling = true
const sampler = (async () => {
  while (sampling) {
    const at = Date.now()
    const { rows } = await counter.query(`select count(*)::int total, count(*) filter (where state <> 'idle')::int busy, count(distinct usename)::int users from pg_stat_activity where usename like $1`, [rolePattern])
    const s = { at, real: rows[0].total, busy: rows[0].busy, sites: rows[0].users, clients: null }
    if (bouncer) {
      const pools = (await bouncer.query('SHOW POOLS')).rows.filter((p) => p.database.startsWith(`${testDb}_burst_`))
      s.clients = pools.reduce((n, p) => n + Number(p.cl_active) + Number(p.cl_waiting) + Number(p.cl_active_cancel_req ?? 0) + Number(p.cl_waiting_cancel_req ?? 0), 0)
      s.waiting = pools.reduce((n, p) => n + Number(p.cl_waiting), 0)
    }
    samples.push(s)
    await sleep(20)
  }
})()
const window = (from, to = Date.now()) => {
  const w = samples.filter((s) => s.at >= from && s.at <= to)
  const most = (key) => w.reduce((m, s) => Math.max(m, s[key] ?? 0), 0)
  return { real: most('real'), busy: most('busy'), sites: most('sites'), clients: bouncer ? most('clients') : null, waiting: bouncer ? most('waiting') : null, sockets: most('sockets'), samples: w.length }
}
const untilQuiet = async (what, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const last = samples.findLast((x) => x.real !== undefined)
    if (last && last.real === 0 && (last.clients ?? 0) === 0) return
    if (Date.now() > deadline) { console.log(`  (${what}: still ${last?.real} real connections after ${timeoutMs} ms)`); return }
    await sleep(100)
  }
}

// ── the server ──
const logs = []
const { TEST: _t, VITEST: _v, NUXT_APP_SECRET: _a, NITRO_APP_SECRET: _na, NUXT_SESSION_PASSWORD: _p, NITRO_SESSION_PASSWORD: _np, ...parentEnv } = process.env
const child = spawn(process.execPath, [entry], {
  cwd: join(repoRoot, 'playground'),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...parentEnv,
    NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
    DATABASE_URL: '', NUXT_CMS_DATABASE_URL: '', NUXT_CMS_PUBLIC_URL: '',
    NUXT_CMS_TENANCY_MODE: 'multi', NUXT_CMS_TENANCY_FILE: directoryFile,
    NUXT_APP_SECRET: 'burst-app-secret-at-least-32-characters-long',
    NUXT_CMS_STORAGE_DRIVER: 'local', NUXT_CMS_MAIL_TRANSPORT: 'file', NUXT_CMS_MIGRATIONS_ON_START: 'true',
    ...(cap ? { NUXT_CMS_TENANCY_MAX_CONNECTIONS: cap } : {}),
  },
})
child.stdout.on('data', (d) => logs.push(String(d)))
child.stderr.on('data', (d) => logs.push(String(d)))

let failed = false
const report = { sites: N, via: via || 'straight to Postgres', cap: cap || '30 (the default)', entry: entry.replace(repoRoot + '/', '') }
try {
  started = Date.now()
  for (;;) {
    if (child.exitCode !== null) throw new Error(`the server exited with ${child.exitCode}:\n${logs.join('')}`)
    try { if ((await fetch(`http://127.0.0.1:${port}/api/health/ready`)).ok) break }
    catch { /* not listening yet */ }
    if (Date.now() - started > 60_000) throw new Error(`the server did not start:\n${logs.join('')}`)
    await sleep(50)
  }
  console.log(`server up in ${Date.now() - started} ms (pid ${child.pid}, port ${port})`)
  if (flag('sockets')) {
    // The app's own count, from outside it: the established TCP connections of its process to the database's port.
    const dbPort = new URL(siteUrl(0)).port
    void (async () => {
      while (sampling) {
        const at = Date.now()
        const out = await new Promise((r) => execFile('lsof', ['-nP', '-a', '-p', String(child.pid), '-iTCP', '-sTCP:ESTABLISHED'], (_err, stdout) => r(String(stdout))))
        samples.push({ at, sockets: out.split('\n').filter((l) => l.includes(`:${dbPort} `) || l.endsWith(`:${dbPort}`) || l.includes(`:${dbPort} (`)).length })
        await sleep(10)
      }
    })()
  }

  /** One API route of every site, all at the same moment. */
  const burst = async (label) => {
    const from = Date.now()
    const answers = await Promise.all(Array.from({ length: N }, async (_, i) => {
      const t0 = Date.now()
      try {
        const res = await fetch(`http://burst-${i}.localhost:${port}/api/content/tag`, { headers: { accept: 'application/json' } })
        const body = await res.text()
        return { status: res.status, ms: Date.now() - t0, ok: res.status === 200 && body.startsWith('{') }
      }
      catch (err) { return { status: 0, ms: Date.now() - t0, ok: false, error: String(err?.cause?.code ?? err) } }
    }))
    const took = Date.now() - from
    await sleep(300) // what Postgres still lists right after the last answer
    const w = window(from)
    const bad = answers.filter((a) => !a.ok)
    if (bad.length) failed = true
    const ms = answers.map((a) => a.ms).sort((a, b) => a - b)
    report[label] = {
      answered: `${answers.length - bad.length} of ${N} with 200`, failures: bad.length ? bad.slice(0, 5) : 0,
      'took ms': took, 'slowest answer ms': ms.at(-1), 'median answer ms': ms[Math.floor(ms.length / 2)],
      'real Postgres connections at once (most)': w.real, 'of them busy (most)': w.busy, 'sites holding one (most)': w.sites,
      ...(bouncer ? { 'the app\'s connections to PgBouncer at once (most)': w.clients, 'of them waiting for a real one (most)': w.waiting } : {}),
      ...(flag('sockets') ? { 'established sockets of the app to the database at once (most)': w.sockets } : {}),
    }
    console.log(`${label}:`, JSON.stringify(report[label]))
    return from
  }

  const cold = await burst('cold (first use: every site is migrated)')
  // The start-up sweep goes through the sites too (ten at a time): let it and the sites' start-up work finish.
  await sleep(2000)
  await untilQuiet('after the cold burst')
  const settled = Date.now()
  report['after the cold burst'] = { 'real connections were at most': window(cold).real, 'ms until none was left': settled - cold }
  console.log('quiet again:', JSON.stringify(report['after the cold burst']))

  const warm = await burst('warm (every site migrated, no connection open)')
  await untilQuiet('after the warm burst')
  report['after the warm burst'] = { 'ms until no real connection was left': Date.now() - warm }
  console.log('quiet again:', JSON.stringify(report['after the warm burst']))

  if (flag('minute')) {
    // The tasks that run every minute walk every site (five at a time): watch one full minute.
    const from = Date.now()
    await sleep(65_000)
    const w = window(from)
    report['one round of the every-minute tasks, no visitor'] = { 'real Postgres connections at once (most)': w.real, 'sites holding one (most)': w.sites, ...(bouncer ? { 'the app\'s connections to PgBouncer at once (most)': w.clients } : {}) }
    console.log('a minute of scheduled work:', JSON.stringify(report['one round of the every-minute tasks, no visitor']))
  }

  const trouble = logs.join('').split('\n').filter((l) => /error|failed|No site for|Too many database connections|timeout/i.test(l))
  report['server log lines about errors'] = trouble.length ? trouble.slice(0, 10) : 0
  if (trouble.length) failed = true
}
finally {
  sampling = false
  await sampler.catch(() => {})
  if (child.exitCode === null) { child.kill('SIGTERM'); await new Promise((r) => child.once('exit', r)) }
  await counter.end().catch(() => {})
  await bouncer?.end().catch(() => {})
  rmSync(dirs, { recursive: true, force: true })
  if (!flag('keep')) await dropAll()
  await admin.end()
}
console.log('\n' + JSON.stringify(report, null, 2))
process.exit(failed ? 1 : 0)
