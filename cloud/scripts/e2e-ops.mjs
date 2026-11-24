// Operating shared hosting for real, locally: the site directory in Postgres, a domain of the
// owner's own, the limits of a plan, moving a website out and in, and closing a Postgres
// server to the websites' database users.
//
//   pnpm --filter tinyzoo-cloud e2e:ops     # needs both apps built: pnpm --filter tinyzoo-cloud templates:build
//
// It starts a cloud app of its own with the shared driver and NUXT_HOSTING_SHARED_DIRECTORY=postgres
// (database tz_cloud_ops_e2e, data under .data/ops-e2e, app ports 4580–4599, site
// databases and users tzops_e2e_…, the cloud on 3296 or the next free port, its own build
// folder) and removes everything it made at the end (--keep leaves it). The names and ports
// can be set from the environment: E2E_OPS_DB, E2E_OPS_SITE_PREFIX, E2E_OPS_PORT,
// E2E_OPS_SITE_PORTS ("4580-4599"), E2E_OPS_DATA (the folder's name under .data); the Postgres
// server from CLOUD_PG_URL. Unless those are set, CLOUD_RUN_TAG and CLOUD_PORT_SHIFT give the
// run names and ports of its own, as for scripts/e2e.mjs (lib.mjs `runDb`, `runSitePrefix`,
// `runPort`), so a second checkout can run it beside the first.
//
// Two apps use the table `tenant_sites`: the one app (Photographer sites) and the Basic app (a
// Basic site). Each app's process reads it with a role of its own that sees only the rows of its
// own app; the column `template` holds the app's id and a kit site's row names its template as `model`.
//
// `tinyzoo backup` and `restore` need pg_dump, pg_restore and psql. On a machine without them
// the script uses the wrappers in scripts/pg-tools, which run the tools inside the Postgres
// container: name the container with TINYZOO_PG_CONTAINER.
//
// The last part (`postgres:close`) changes every database of a server, so it runs only against
// a Postgres of its own that is named on purpose: E2E_OPS_CLOSE_URL, a superuser's address of
// a server nothing else uses, e.g.
//   docker run -d --name tz-mt-pg-close -p 127.0.0.1:55442:5432 -e POSTGRES_USER=cms -e POSTGRES_PASSWORD=cms postgres:16-alpine
//   E2E_OPS_CLOSE_URL=postgres://cms:cms@localhost:55442/postgres
// Without it that part is left out, and the run says so.
//
// Everything goes through the sign-up app's real API and the sites' own addresses; no browser.
import { execFile, spawn } from 'node:child_process'
import { createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import pg from 'pg'
import { alive, appEntries, arg, cloudDir, dbUrl, freePortFrom, log, PG_URL, portFree, repoRoot, runDb, runPort, runSitePrefix, sleep, startCloud, waitFor, withPg } from './lib.mjs'

const run = promisify(execFile)
const keep = arg('keep', false) === true
const DB = process.env.E2E_OPS_DB || runDb('tz_cloud_ops_e2e')
const PREFIX = process.env.E2E_OPS_SITE_PREFIX || runSitePrefix('tzops_e2e')
const [portFrom, portTo] = (process.env.E2E_OPS_SITE_PORTS || `${runPort(4580)}-${runPort(4599)}`).split('-').map(Number)
const PORTS = { from: portFrom, to: portTo }
const APP_PORT = Number(process.env.E2E_OPS_PORT) || runPort(3296)
const dataDir = join(cloudDir, '.data', process.env.E2E_OPS_DATA || runDb('ops-e2e'))
const CLOSE_URL = process.env.E2E_OPS_CLOSE_URL || ''
// The database is dropped at the end, so only one that is this script's own: named …_e2e, or …_e2e_<run tag>.
if (!/^[a-z][a-z0-9_]*_e2e(_[a-z0-9]+)?$/.test(DB)) { console.error(`E2E_OPS_DB must be a database of this script's own, named …_e2e (it is dropped): ${DB}`); process.exit(2) }
if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(PREFIX)) { console.error(`E2E_OPS_SITE_PREFIX is not a usable prefix: ${PREFIX}`); process.exit(2) }
if (!Number.isInteger(PORTS.from) || !Number.isInteger(PORTS.to) || PORTS.to < PORTS.from + 1) { console.error('E2E_OPS_SITE_PORTS must be "from-to", two ports or more'); process.exit(2) }
if (CLOSE_URL && new URL(CLOSE_URL).host === new URL(PG_URL).host) { console.error('E2E_OPS_CLOSE_URL must be a Postgres of its own, not the server the run itself uses: postgres:close changes every database of it.'); process.exit(2) }

// One folder per app (`<data>/<app id>/`). The one app serves the Photographer sites; the Basic app the Basic site.
const templateDir = join(dataDir, 'templates')
const basicDir = join(dataDir, 'basic')
const workDir = join(dataDir, '_e2e')
const singleDir = join(dataDir, '_single')
const preview = join(cloudDir, '.preview')
const logFile = join(preview, 'e2e-ops-cloud.log')
const stamp = Date.now().toString(36).slice(-5)
const startedAt = Date.now()
const results = []
const measures = {}
const KEY = `directory-key-${randomBytes(24).toString('base64url')}`
const TEMPLATE = 'photographer'
// The apps and the roles their processes read the table with (`<prefix>_reader_<app id>`).
const APP = 'templates'
const READER = `${PREFIX}_reader_${APP}`
const READER_BASIC = `${PREFIX}_reader_basic`
const SINGLE_DB = `${PREFIX}_single`
const photographerDir = join(repoRoot, 'templates', 'photographer')

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: ok ? '' : String(detail) })
  log(ok ? '  ✓' : '  ✗', name, detail && !ok ? `— ${detail}` : '')
  if (!ok) throw new Error(`failed: ${name}${detail ? ` (${detail})` : ''}`)
}
const note = (text) => log('   ', text)

for (const id of ['templates', 'basic']) {
  if (!existsSync(appEntries[id])) {
    console.error(`The app "${id}" is not built (${appEntries[id]}).\nRun: pnpm --filter tinyzoo-cloud templates:build`)
    process.exit(2)
  }
}

// ── the Postgres tools tinyzoo's command line needs ──

const onPath = async (program) => { try { await run('which', [program]); return true } catch { return false } }
const toolEnv = {}
for (const name of ['TINYZOO_PG_DUMP', 'TINYZOO_PG_RESTORE', 'TINYZOO_PSQL', 'TINYZOO_PG_CONTAINER', 'TINYZOO_PG_CONTAINER_PORT']) if (process.env[name]) toolEnv[name] = process.env[name]
if (!toolEnv.TINYZOO_PG_DUMP && !(await onPath('pg_dump'))) {
  if (!toolEnv.TINYZOO_PG_CONTAINER) {
    console.error('This machine has no pg_dump. Name the Postgres container (TINYZOO_PG_CONTAINER=<name>): the wrappers in scripts/pg-tools run the tools inside it.')
    process.exit(2)
  }
  const tools = join(cloudDir, 'scripts', 'pg-tools')
  Object.assign(toolEnv, { TINYZOO_PG_DUMP: join(tools, 'pg_dump'), TINYZOO_PG_RESTORE: join(tools, 'pg_restore'), TINYZOO_PSQL: join(tools, 'psql') })
}

// ── a small client that keeps its cookies (the cloud's API, a site's admin API) ──

class Http {
  constructor(base) { this.base = base.replace(/\/+$/, ''); this.cookies = new Map() }
  get cookie() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
  /** `cookie`: send this one instead of the client's own. `body` + `type`: a body that is not JSON. `raw`: the answer's bytes. */
  async request(method, path, { json, form, cookie, body, type, raw, headers: extra } = {}) {
    const headers = { accept: 'application/json', origin: this.base, ...extra }
    const sent = cookie ?? this.cookie
    if (sent) headers.cookie = sent
    let payload
    if (json !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(json) }
    if (form) payload = form
    if (body !== undefined) { headers['content-type'] = type; payload = body }
    const streamed = payload instanceof Readable
    const res = await fetch(path.startsWith('http') ? path : this.base + path, {
      method, headers, body: streamed ? Readable.toWeb(payload) : payload, redirect: 'manual', signal: AbortSignal.timeout(180_000), ...(streamed ? { duplex: 'half' } : {}),
    })
    if (cookie === undefined) for (const c of res.headers.getSetCookie()) { const [pair] = c.split(';'); const at = pair.indexOf('='); this.cookies.set(pair.slice(0, at), pair.slice(at + 1)) }
    const bytes = Buffer.from(await res.arrayBuffer())
    const text = raw ? '' : bytes.toString('utf8')
    let parsed = null
    try { parsed = text ? JSON.parse(text) : null } catch { /* not JSON */ }
    return { status: res.status, body: parsed, text, bytes, location: res.headers.get('location'), headers: res.headers }
  }
  get(path, opts) { return this.request('GET', path, opts) }
  post(path, json, opts) { return this.request('POST', path, { json, ...opts }) }
}

// ── Postgres: only what this run made ──

const dropCloudDatabase = () => withPg((c) => c.query(`drop database if exists "${DB}" with (force)`))
const SITE_NAME = new RegExp(`^${PREFIX}_[0-9a-f]{8}(_[0-9a-f]{4}){3}_[0-9a-f]{12}$`)
const OWN_NAME = (name) => SITE_NAME.test(name) || name === READER || name === READER_BASIC || name === SINGLE_DB
const own = (name) => {
  if (!OWN_NAME(name)) throw new Error(`refusing to touch ${name}`)
  return `"${name}"`
}
const like = `${PREFIX.replace(/_/g, '\\_')}\\_%`
const ownDatabases = () => withPg(async (c) => (await c.query('select datname as name from pg_database where datname like $1 order by 1', [like])).rows.map((r) => r.name).filter(OWN_NAME))
const ownRoles = () => withPg(async (c) => (await c.query('select rolname as name from pg_roles where rolname like $1 order by 1', [like])).rows.map((r) => r.name).filter(OWN_NAME))
const siteDatabases = async () => (await ownDatabases()).filter((n) => SITE_NAME.test(n))
const siteRoles = async () => (await ownRoles()).filter((n) => SITE_NAME.test(n))

async function query(url, text, params = []) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 8000 })
  await client.connect()
  try { return (await client.query(text, params)).rows }
  finally { await client.end().catch(() => {}) }
}
/** What Postgres answers to a connection (or a statement) that should be refused: its error code, or 'allowed'. */
async function refusal(url, text = 'select 1') {
  try { await query(url, text); return 'allowed' }
  catch (err) { return String(err.code ?? err.message) }
}
const onDatabase = (url, name) => { const u = new URL(url); u.pathname = `/${name}`; return u.toString() }
const asUser = (url, user, password, database) => { const u = new URL(url); u.username = user; u.password = password; if (database) u.pathname = `/${database}`; return u.toString() }
const cloudQuery = (text, params) => query(dbUrl(DB), text, params)

// ── the processes of this run's data folder ──

/** Processes this run started: the apps' (the shared driver's `--app-dir=<folder>`) and the moved-out site's (`--ops-single=<folder>`). */
async function ownProcesses() {
  const { stdout } = await run('ps', ['-axo', 'pid=,rss=,command='])
  const appMarker = `--app-dir=${resolve(dataDir)}/`
  const markers = [appMarker, `--ops-single=${resolve(singleDir)}`]
  return stdout.split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .filter((m) => m[3].split(/\s+/).some((word) => markers.some((marker) => word.startsWith(marker))))
    .map((m) => ({ pid: Number(m[1]), rssBytes: Number(m[2]) * 1024, single: m[3].includes('--ops-single='), app: m[3].includes(appMarker) ? m[3].split(appMarker)[1].split(/\s/)[0] : null, command: m[3] }))
}
/** The one app's process (the Photographer sites) and the Basic app's. */
const templateProcesses = async () => (await ownProcesses()).filter((p) => p.app === APP)
const basicProcesses = async () => (await ownProcesses()).filter((p) => p.app === 'basic')

/** Stop them: only pids whose command line carries one of this run's markers, asked first, then insisted on. */
async function stopProcesses(which = () => true) {
  const procs = (await ownProcesses()).filter(which)
  for (const p of procs) { try { process.kill(p.pid, 'SIGTERM') } catch { /* gone */ } }
  for (let i = 0; i < 40; i++) {
    if (!(await Promise.all(procs.map((p) => alive(p.pid)))).some(Boolean)) break
    await sleep(250)
  }
  for (const p of (await ownProcesses()).filter(which)) {
    if (procs.some((was) => was.pid === p.pid)) { try { process.kill(p.pid, 'SIGKILL') } catch { /* gone */ } }
  }
  return procs
}

async function listeners(port) {
  try {
    const { stdout } = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    return [...new Set(stdout.split('\n').map((l) => Number(l.trim())).filter((n) => Number.isInteger(n) && n > 1))]
  }
  catch { return [] }
}

/** Remove everything a run made: its processes, the cloud's database, its site databases and users (the readers too), its folder. */
async function cleanUp() {
  const stopped = await stopProcesses()
  // The cloud's database first: the reader's rights are on it, and a role with rights cannot be dropped.
  await dropCloudDatabase()
  const databases = await ownDatabases()
  const roles = await ownRoles()
  await withPg(async (c) => {
    for (const name of databases) await c.query(`drop database if exists ${own(name)} with (force)`)
    for (const name of roles) await c.query(`drop role if exists ${own(name)}`)
  })
  if (existsSync(dataDir) && resolve(dataDir).startsWith(join(cloudDir, '.data') + '/')) rmSync(dataDir, { recursive: true, force: true })
  return { processes: stopped.map((p) => p.pid), databases: databases.length, roles: roles.length }
}

// ── the directory's secrets, read as an app's process reads them (written out here: nothing of tinyzoo's server is imported) ──

function decrypt(value, key = KEY) {
  if (!String(value).startsWith('enc:v1:')) return value
  const raw = Buffer.from(String(value).slice(7), 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(key, 'utf8').digest(), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
}
/** The rows of the table as they are stored, by site id. */
const tableRows = async () => Object.fromEntries((await cloudQuery('select id, template, row, updated_at from tenant_sites order by id')).map((r) => [r.id, r]))
/** One site's row with its secrets in plain text. */
const openRow = (row) => ({ ...row, databaseUrl: decrypt(row.databaseUrl), secret: decrypt(row.secret), config: { ...row.config, auth: { ...row.config.auth, setupToken: decrypt(row.config.auth.setupToken), ...(row.config.auth.account ? { account: { ...row.config.auth.account, clientSecret: decrypt(row.config.auth.account.clientSecret) } } : {}) }, status: { token: decrypt(row.config.status.token) } } })
const secretsOf = (plain) => [new URL(plain.databaseUrl).password, plain.secret, plain.config.auth.setupToken, plain.config.status.token, plain.config.auth.account?.clientSecret].filter(Boolean)

// ── files ──

function filesUnder(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath ?? e.path, e.name))
}
const mode = (file) => (statSync(file).mode & 0o777).toString(8)
const appFile = (dir = templateDir) => JSON.parse(readFileSync(join(dir, 'app.json'), 'utf8'))
const templateLog = () => (existsSync(join(templateDir, 'server.log')) ? readFileSync(join(templateDir, 'server.log'), 'utf8') : '')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

// A 1 × 1 PNG, and a few bytes after its end so every run uploads another file.
const PNG = Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'), Buffer.from(`e2e-ops-${stamp}`)])

const ready = async (url) => {
  try {
    const res = await fetch(`${url}/api/health/ready`, { signal: AbortSignal.timeout(4000), redirect: 'manual' })
    return res.status === 200 ? await res.json() : null
  }
  catch { return null }
}
const page = async (url, path = '/', init = {}) => {
  const res = await fetch(url + path, { signal: AbortSignal.timeout(30_000), redirect: 'manual', headers: { accept: 'text/html' }, ...init })
  return { status: res.status, text: await res.text(), location: res.headers.get('location') }
}
const siteStatus = (url, token) => fetch(`${url}/api/health/status`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000), redirect: 'manual' }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }))

/** tinyzoo's command line, run the way the cloud runs it: from the template's own folder and packages, the database and the upload folder in the environment. */
async function tinyzoo(args, { databaseUrl, uploadsDir, cwd }) {
  return run(join(photographerDir, 'node_modules', '.bin', 'tsx'), [join(photographerDir, 'node_modules', 'tinyzoo', 'cli', 'index.ts'), ...args], {
    cwd, maxBuffer: 16 * 1024 * 1024,
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}), ...toolEnv, NUXT_CMS_DATABASE_URL: databaseUrl, NUXT_CMS_STORAGE_DRIVER: 'local', NUXT_CMS_STORAGE_LOCAL_DIR: uploadsDir },
  })
}

/** A copy of an archive with one of its small files changed (for the archives the cloud must refuse). */
async function alteredArchive(archive, name, file, change) {
  const dir = join(workDir, `altered-${name}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  await run('tar', ['-xf', archive, '-C', dir])
  writeFileSync(join(dir, file), JSON.stringify(change(JSON.parse(readFileSync(join(dir, file), 'utf8')))))
  const out = join(workDir, `${name}.tar`)
  rmSync(out, { force: true })
  await run('tar', ['-cf', out, '-C', dir, ...readdirSync(dir)])
  rmSync(dir, { recursive: true, force: true })
  return out
}

let cloud = null
let single = null
mkdirSync(preview, { recursive: true })

/**
 * Start the one app as the process of a site that moved out to a server of its own (its own marker), and wait
 * until it answers. The one app cannot run in single mode: a site is served in multi-tenant mode from a site
 * directory file that holds that one site (its model, database, secret, hosts, public address, storage folder).
 * This is how the cloud's local driver runs a site too (server/hosting/local.ts, `localSiteRow` in shared/sharedHosting.ts).
 * `appSecret` is the process's own secret, which seals the people's sessions.
 */
async function startSingle(port, { row, appSecret, cookieName }) {
  writeFileSync(join(singleDir, 'sites.json'), `${JSON.stringify({ sites: [row] }, null, 2)}\n`, { mode: 0o600 })
  const out = openSync(join(singleDir, 'server.log'), 'a', 0o600)
  const child = spawn(process.execPath, [appEntries.templates, `--ops-single=${resolve(singleDir)}`], {
    cwd: singleDir, detached: true, stdio: ['ignore', out, out],
    env: {
      PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      NUXT_CMS_TENANCY_MODE: 'multi', NUXT_CMS_TENANCY_FILE: join(singleDir, 'sites.json'), NUXT_APP_SECRET: appSecret, NUXT_SESSION_NAME: cookieName,
      NUXT_CMS_MIGRATIONS_ON_START: 'true', NUXT_CMS_MAIL_TRANSPORT: 'log',
    },
  })
  child.unref()
  const url = `http://127.0.0.1:${port}`
  await waitFor(async () => (await ready(url))?.migrations === 'done', { timeout: 120_000, every: 300, what: 'the process of the moved-out site to answer' })
  return { pid: child.pid, url }
}

async function main() {
  log('preparing: nothing of an earlier run is left, a clean database for the cloud')
  const left = await cleanUp()
  if (left.processes.length || left.databases || left.roles) log(`    removed what an earlier run left: ${left.processes.length} process(es), ${left.databases} database(s), ${left.roles} user(s)`)
  await withPg((c) => c.query(`create database "${DB}"`))
  mkdirSync(workDir, { recursive: true })
  if (existsSync(logFile)) rmSync(logFile)
  const port = await freePortFrom(APP_PORT)
  const cloudEnv = {
      NUXT_DATABASE_URL: dbUrl(DB),
      NUXT_HOSTING_DRIVER: 'shared',
      NUXT_HOSTING_SHARED_DATA_DIR: dataDir,
      NUXT_HOSTING_SHARED_DATABASE_PREFIX: PREFIX,
      NUXT_HOSTING_SHARED_PORT_FROM: String(PORTS.from),
      NUXT_HOSTING_SHARED_PORT_TO: String(PORTS.to - 1),
      NUXT_HOSTING_SHARED_DIRECTORY: 'postgres',
      NUXT_HOSTING_SHARED_DIRECTORY_KEY: KEY,
      NUXT_HOSTING_DOMAIN_TARGET: '127.0.0.1',
      NUXT_HOSTING_IMPORT_MAX_MB: '48',
      NUXT_MAX_SITES_PER_USER: '6',
      NUXT_REQUIRE_VERIFIED_EMAIL: 'false',
      NUXT_MAIL_TRANSPORT: 'log',
      CLOUD_BUILD_DIR: '.nuxt-scripts-ops',
      ...toolEnv,
  }
  cloud = await startCloud({ port, logFile, env: cloudEnv })
  // Nuxt moves to another port by itself when its own is taken in the moment between the check and the start
  // (another script of a second run); the answer on `port` would then be somebody else's cloud.
  if (!readFileSync(logFile, 'utf8').includes(`Local:    http://localhost:${port}/`)) throw new Error(`the cloud app did not start on port ${port} (it was taken a moment before): ${logFile}`)
  log(`cloud app up at ${cloud.url} (shared driver, the site directory in Postgres)`)
  if (toolEnv.TINYZOO_PG_DUMP) note(`pg_dump, pg_restore and psql through ${toolEnv.TINYZOO_PG_DUMP.replace(/pg_dump$/, '')} (inside the container ${toolEnv.TINYZOO_PG_CONTAINER ?? 'tz-mt-pg'})`)

  // ── two accounts; two Photographer sites and a Basic site of the first ──
  log('0 · two accounts; the first makes two Photographer sites and a Basic site at the same moment')
  const api = new Http(cloud.url)
  const owner = { name: 'Johana Loudová', email: `johana-${stamp}@example.com`, password: 'dlouhe-heslo-johany-1' }
  const signedUp = await api.post('/api/auth/signup', owner)
  check('an account is made', signedUp.status === 201, `${signedUp.status} ${signedUp.text.slice(0, 200)}`)
  check('its e-mail is confirmed (the way into an admin through the account needs that)', (await api.post('/api/auth/verify', { token: String(signedUp.body.devVerifyUrl).split('/').pop() })).status === 200)
  const other = new Http(cloud.url)
  check('a second person has an account of their own', (await other.post('/api/auth/signup', { name: 'Petr Cizí', email: `petr-${stamp}@example.com`, password: 'dlouhe-heslo-petra-1' })).status === 201)
  const wanted = [
    { name: 'Ateliér Světlo', slug: `ops-svetlo-${stamp}`, template: TEMPLATE, look: 'negativ' },
    { name: 'Foto Zápisník', slug: `ops-zapisnik-${stamp}`, template: TEMPLATE, look: 'zapisnik' },
    { name: 'Pekárna U Mostu', slug: `ops-pekarna-${stamp}`, template: 'basic' },
  ]
  const made = await Promise.all(wanted.map((w) => api.post('/api/sites', w)))
  check('all three sites are accepted', made.every((r) => r.status === 201), made.map((r) => `${r.status} ${r.text.slice(0, 200)}`).join(' | '))
  const untilReady = async (id, what) => waitFor(async () => {
    const now = (await api.get(`/api/sites/${id}?runtime=1`)).body
    if (now?.site.status === 'failed') throw new Error(`${what} failed: ${JSON.stringify(now.site.steps)} ${now.site.errorDetail ?? ''}`)
    return now?.site.status === 'ready' ? now : null
  }, { timeout: 300_000, every: 500, what: `${what} to be ready` })
  const [first, second, basicMade] = await Promise.all(made.map((r, i) => untilReady(r.body.site.id, `site ${i + 1}`)))
  let one = first.site
  const two = second.site
  const bas = basicMade.site
  check('all three sites are ready', one.status === 'ready' && two.status === 'ready' && bas.status === 'ready')
  const sitePort = Number(new URL(one.publicUrl).port)
  const service1 = `http://${one.slug}.localhost:${sitePort}`
  const service2 = `http://${two.slug}.localhost:${sitePort}`
  check('each Photographer site is at <slug>.localhost on the one app\'s port', one.publicUrl === service1 && two.publicUrl === service2, `${one.publicUrl} ${two.publicUrl}`)
  const basicPort = Number(new URL(bas.publicUrl).port)
  const serviceB = `http://${bas.slug}.localhost:${basicPort}`
  check('the Basic site is at <slug>.localhost on the Basic app\'s own port', bas.publicUrl === serviceB && basicPort !== sitePort, `${bas.publicUrl} (the one app on ${sitePort})`)

  // ── 1 · the directory in Postgres ──
  log('1 · one process serves both Photographer sites and another the Basic site; both read the table, each only its own rows')
  const app = appFile()
  const pid = app.pid
  const procs = await templateProcesses()
  check('one process listens on the one app\'s port, the one app.json names, with the app folder\'s marker', (await listeners(sitePort)).join() === String(pid) && procs.length === 1 && procs[0].pid === pid, `listening ${(await listeners(sitePort)).join(',')}; app.json ${pid}; processes ${procs.map((p) => p.pid)}`)
  const basicApp = appFile(basicDir)
  const basicProcs = await basicProcesses()
  check('the Basic site is served by another process, on another port, with its own folder and marker', basicProcs.length === 1 && basicProcs[0].pid === basicApp.pid && basicApp.pid !== pid && (await listeners(basicPort)).join() === String(basicApp.pid) && basicApp.port === basicPort, `${basicApp.pid}:${basicApp.port}`)
  check('both Photographer sites answer ready from the one app\'s process, each with its database migrated, and the Basic site from its own', (await Promise.all([service1, service2, serviceB].map(ready))).every((r) => r?.ok === true && r.migrations === 'done'))
  const stored = await tableRows()
  check('the table holds a row for each of the three sites; the column `template` holds the app\'s id: `templates` for Photographer sites, `basic` for the Basic site', Object.keys(stored).sort().join() === [one.id, two.id, bas.id].sort().join() && stored[one.id].template === APP && stored[two.id].template === APP && stored[bas.id].template === 'basic', JSON.stringify(Object.values(stored).map((r) => [r.id, r.template])))
  check('the rows of the kit\'s sites carry their template as `model`, the Basic site\'s row has none', stored[one.id].row.model === TEMPLATE && stored[two.id].row.model === TEMPLATE && !('model' in stored[bas.id].row), JSON.stringify(Object.values(stored).map((r) => [r.id, r.row.model])))
  check('there is no directory file in either app\'s folder', !existsSync(join(templateDir, 'sites.json')) && !existsSync(join(basicDir, 'sites.json')), `${readdirSync(templateDir).join(' ')} | ${readdirSync(basicDir).join(' ')}`)
  const row1 = openRow(stored[one.id].row), row2 = openRow(stored[two.id].row), rowB = openRow(stored[bas.id].row)
  const secrets = [...secretsOf(row1), ...secretsOf(row2), ...secretsOf(rowB)]
  check('every secret of a row is stored encrypted: the database address, the site\'s secret, its setup code, its status token, its client secret',
    [stored[one.id].row, stored[two.id].row, stored[bas.id].row].every((r) => [r.databaseUrl, r.secret, r.config.auth.setupToken, r.config.status.token, r.config.auth.account.clientSecret].every((v) => String(v).startsWith('enc:v1:'))))
  check('decrypted with the directory key they are fifteen secrets, all different', secrets.length === 15 && new Set(secrets).size === 15 && secrets.every((x) => x.length >= 24))
  const tableText = (await cloudQuery('select string_agg(row::text, \' \') as text from tenant_sites'))[0].text
  check('the table holds no password and no secret in plain text', !secrets.some((x) => tableText.includes(x)) && !/postgres(ql)?:\/\//.test(tableText))
  const who = await Promise.all([row1, row2, rowB].map((r) => query(r.databaseUrl, 'select current_user as u, current_database() as d, (select count(*)::int from cms_users) as people')))
  check('the decrypted address opens each site\'s own database as the site\'s own user', who.every((w, i) => w[0].u === `${PREFIX}_${[one, two, bas][i].id.replace(/-/g, '_')}` && w[0].d === w[0].u && w[0].people >= 2), JSON.stringify(who))
  const kept = (await cloudQuery('select driver_state::text as state, secrets from sites')).map((r) => `${r.state} ${r.secrets}`).join(' ')
  check('the cloud keeps the sites\' secrets encrypted too', kept.includes('"databasePassword": "v1.') && !secrets.some((x) => kept.includes(x)))
  const sent = JSON.stringify([first, second, basicMade]) + JSON.stringify((await api.get('/api/sites')).body)
  check('no secret is sent to the owner\'s browser', !secrets.some((x) => sent.includes(x)) && !/databaseUrl|databasePassword|driverState/.test(sent))
  // The processes' own environment (ps shows it for one's own processes).
  const environment = (await run('ps', ['eww', '-o', 'command=', '-p', String(pid)])).stdout
  const environmentB = (await run('ps', ['eww', '-o', 'command=', '-p', String(basicApp.pid)])).stdout
  check('ps shows the process\'s environment: multi-tenant mode, the table\'s address, the app\'s id (NUXT_CMS_TENANCY_TEMPLATE=templates; the Basic app\'s says basic)',
    environment.includes('NUXT_CMS_TENANCY_MODE=multi') && environment.includes('NUXT_CMS_TENANCY_DATABASE_URL=') && environment.includes(`NUXT_CMS_TENANCY_TEMPLATE=${APP}`) && environmentB.includes('NUXT_CMS_TENANCY_TEMPLATE=basic') && !environment.includes('NUXT_CMS_TENANCY_TEMPLATE=basic'), 'ps did not show the environment')
  check('their command lines and environments hold no secret of a site', !secrets.some((x) => environment.includes(x) || environmentB.includes(x)), 'a secret of a site is in it')
  check('and name no directory file', !environment.includes('NUXT_CMS_TENANCY_FILE') && !environment.includes('sites.json') && !environmentB.includes('NUXT_CMS_TENANCY_FILE'))
  const readerUrl = environment.match(/NUXT_CMS_TENANCY_DATABASE_URL=(\S+)/)?.[1] ?? ''
  const reader = new URL(readerUrl)
  const readerUrlB = environmentB.match(/NUXT_CMS_TENANCY_DATABASE_URL=(\S+)/)?.[1] ?? ''
  const readerB = new URL(readerUrlB)
  check('each process reads the table as a reader of its own app, a role of its own, in the cloud\'s database', reader.username === READER && readerB.username === READER_BASIC && reader.pathname === `/${DB}` && readerB.pathname === `/${DB}` && reader.password.length >= 24 && readerB.password.length >= 24 && reader.password !== readerB.password && reader.username !== new URL(PG_URL).username, `${reader.username} ${readerB.username} ${reader.pathname}`)
  const administrator = new URL(PG_URL)
  check('what the process holds of its own: the directory key and the reader\'s password, and no administrator\'s address', environment.includes(`NUXT_CMS_TENANCY_KEY=${KEY}`) && !environment.includes(`${administrator.username}:${administrator.password}@`) && !environment.includes('NUXT_DATABASE_URL') && !/(^|\s)DATABASE_URL=/.test(environment))
  check('the cloud keeps the reader\'s password and the process\'s operator token encrypted in app.json', app.reader?.role === READER && String(app.reader.password).startsWith('v1.') && String(app.operator).startsWith('v1.') && !JSON.stringify(app).includes(reader.password) && mode(join(templateDir, 'app.json')) === '600' && basicApp.reader?.role === READER_BASIC && String(basicApp.reader.password).startsWith('v1.'), JSON.stringify(Object.keys(app)))
  const facts = (await withPg((c) => c.query('select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication from pg_roles where rolname = any($1) order by 1', [[READER, READER_BASIC]]))).rows
  check('the readers are plain logins', facts.length === 2 && facts.every((f) => f.rolcanlogin === true && !f.rolsuper && !f.rolcreatedb && !f.rolcreaterole && !f.rolreplication), JSON.stringify(facts))
  // The grant is on the whole table: a reader can read every app's rows (their secrets are encrypted), and its process asks only for its own app's.
  check('each reader can read the table', (await query(readerUrl, 'select count(*)::int as n from tenant_sites'))[0].n === 3 && (await query(readerUrlB, 'select count(*)::int as n from tenant_sites'))[0].n === 3)
  check('the table has no row level security and no policy', (await cloudQuery('select relrowsecurity from pg_class where relname = \'tenant_sites\''))[0].relrowsecurity === false && (await cloudQuery('select count(*)::int as n from pg_policies where tablename = \'tenant_sites\''))[0].n === 0)
  const granted = await query(readerUrl, 'select table_name, privilege_type from information_schema.table_privileges where grantee = current_user order by 1, 2')
  check('its only right on a table is SELECT on tenant_sites', JSON.stringify(granted) === JSON.stringify([{ table_name: 'tenant_sites', privilege_type: 'SELECT' }]), JSON.stringify(granted))
  const others = await Promise.all(['sites', 'users', 'account_clients', 'site_domains'].map((table) => refusal(readerUrl, `select 1 from ${table} limit 1`)))
  check('it can read no other table of the cloud (the sites, the accounts, the clients, the domains)', others.every((code) => code === '42501'), others.join(' '))
  const writes = await Promise.all([
    refusal(readerUrl, `insert into tenant_sites (id, template, row) values ('x', 'x', '{}')`),
    refusal(readerUrl, `update tenant_sites set template = 'x'`),
    refusal(readerUrl, 'delete from tenant_sites'),
    refusal(readerUrl, 'truncate tenant_sites'),
    refusal(readerUrl, 'create table reader_was_here (x int)'),
  ])
  check('it cannot write the table (insert, update, delete, truncate) nor make one', writes.every((code) => code === '42501'), writes.join(' '))
  const db1 = new URL(row1.databaseUrl).pathname.slice(1), db2 = new URL(row2.databaseUrl).pathname.slice(1)
  check('it is refused on the sites\' databases', (await Promise.all([db1, db2].map((name) => refusal(onDatabase(readerUrl, name))))).every((code) => code === '42501'))
  check('a site\'s own user is refused on the cloud\'s database, table and all', await refusal(onDatabase(row1.databaseUrl, DB)) === '42501')

  // ── 2 · a change of the table reaches the process ──
  log('2 · a change in the table reaches the process within about a second')
  // The cloud has no "pause" for an owner: the row is changed as the driver writes one (the state, and updated_at).
  const pausedAt = Date.now()
  await cloudQuery(`update tenant_sites set row = row || '{"state":"paused"}'::jsonb, updated_at = clock_timestamp() where id = $1`, [two.id])
  await waitFor(async () => (await page(service2)).status === 503, { timeout: 10_000, every: 50, what: 'the paused site to answer 503' })
  measures.pauseMs = Date.now() - pausedAt
  const paused = await page(service2)
  check(`a paused row: the site answers 503 (${measures.pauseMs} ms after the write)`, paused.status === 503 && paused.text.includes('paused') && measures.pauseMs < 2500, `${paused.status} after ${measures.pauseMs} ms`)
  check('the other site is served meanwhile', (await page(service1)).status === 200)
  // The cloud sees to a site whenever it needs it (a fresh invitation asks for that): the row is written again from what the cloud keeps.
  const healed = await api.post(`/api/sites/${two.id}/invite`)
  check('the cloud puts a row right that was changed behind its back: the site is served again', healed.status === 200 && (await page(service2)).status === 200 && !('state' in (await tableRows())[two.id].row), `${healed.status} ${healed.text.slice(0, 200)}`)
  // Removing a site, through the cloud's own API: a third site, made for it.
  const extra = await api.post('/api/sites', { name: 'Na chvíli', slug: `ops-chvile-${stamp}`, template: TEMPLATE, look: 'atelier' })
  const third = (await untilReady(extra.body.site.id, 'the third site')).site
  check('a third site is made and served by the same process', (await page(third.publicUrl)).status === 200 && (await templateProcesses()).map((p) => p.pid).join() === String(pid))
  const leftTable = (async () => { const t0 = Date.now(); await waitFor(async () => !(third.id in await tableRows()), { timeout: 20_000, every: 25, what: 'the row to leave the table' }); return Date.now() - t0 })()
  const answered404 = (async () => { const t0 = Date.now(); await waitFor(async () => (await page(third.publicUrl)).status === 404, { timeout: 20_000, every: 25, what: 'the removed site to answer 404' }); return Date.now() - t0 })()
  check('its removal is accepted', (await api.post(`/api/sites/${third.id}/remove`, { confirm: third.slug })).status === 200)
  const [rowGoneMs, goneMs] = await Promise.all([leftTable, answered404])
  measures.removeMs = Math.max(0, goneMs - rowGoneMs)
  check(`a removed row: the site answers 404 (${measures.removeMs} ms after its row left the table)`, measures.removeMs < 2500, `${measures.removeMs} ms`)
  await waitFor(async () => (await cloudQuery('select status from sites where id = $1', [third.id]))[0]?.status === 'removed', { timeout: 30_000, what: 'the third site to be removed' })
  check('its database and user are gone, the other sites keep answering from their processes', !(await siteDatabases()).some((n) => n.includes(third.id.replace(/-/g, '_'))) && !(await siteRoles()).some((n) => n.includes(third.id.replace(/-/g, '_'))) && (await page(service1)).status === 200 && (await page(service2)).status === 200 && (await page(serviceB)).status === 200 && (await templateProcesses()).map((p) => p.pid).join() === String(pid) && (await basicProcesses()).map((p) => p.pid).join() === String(basicApp.pid) && Object.keys(await tableRows()).sort().join() === [one.id, two.id, bas.id].sort().join())

  // ── 3 · a domain of the owner's own ──
  log('3 · a domain of the owner\'s own for site 1')
  const D = `www.kavarna-${stamp}.localhost`
  const D2 = `m.kavarna-${stamp}.localhost`
  const W = `www.tinyzoo-ops-${stamp}.example.org`
  const domainUrl = `http://${D}:${sitePort}`
  const before = await api.get(`/api/sites/${one.id}/domains`)
  check('the site starts with no domain; its page data names what a domain must lead to', before.status === 200 && before.body.domains.length === 0 && before.body.target.ips.join() === '127.0.0.1' && before.body.serviceUrl === service1, before.text.slice(0, 200))
  for (const [bad, why] of [['http://kavarna.cz', 'an address'], ['kavarna.cz/kontakt', 'a path'], ['kavarna.cz:8080', 'a port'], ['kavarna', 'one label'], ['192.168.1.20', 'an IP address'], ['kavarna.local', 'a name that is not public'], [`${two.slug}.localhost`, 'another site\'s service address'], ['localhost', 'the machine']]) {
    const refused = await api.post(`/api/sites/${one.id}/domains`, { host: bad })
    check(`refused: ${why} (${bad})`, refused.status === 422 && String(refused.body?.data?.code).startsWith('domain.'), `${refused.status} ${refused.text.slice(0, 120)}`)
  }
  const added = await api.post(`/api/sites/${one.id}/domains`, { host: `  WWW.Kavarna-${stamp}.LOCALHOST. ` })
  check('a name is added lower-cased and tidied, and counts as verified at once (the local rule for *.localhost)', added.status === 201 && added.body.domain.host === D && added.body.domain.verified === true && added.body.domain.main === false, `${added.status} ${added.text.slice(0, 200)}`)
  const asAlias = await page(`http://${D}:${sitePort}`, '/galerie?x=1')
  check('verified and not main: the name redirects to the site\'s address', asAlias.status === 308 && asAlias.location === `${service1}/galerie?x=1`, `${asAlias.status} ${asAlias.location}`)
  check('the site\'s address has not changed', (await api.get(`/api/sites/${one.id}`)).body.site.publicUrl === service1)
  check('the same name cannot be added to site 2: a domain belongs to one website', await (async () => { const r = await api.post(`/api/sites/${two.id}/domains`, { host: D }); return r.status === 409 && r.body?.data?.code === 'domain.taken' })())
  check('nor twice to the same site', (await api.post(`/api/sites/${one.id}/domains`, { host: D })).body?.data?.code === 'domain.exists')
  check('another person cannot touch the site\'s domains', (await other.get(`/api/sites/${one.id}/domains`)).status === 404 && (await other.post(`/api/sites/${one.id}/domains`, { host: `x.kavarna-${stamp}.localhost` })).status === 404)

  // A name whose DNS does not lead to the service.
  const waiting = await api.post(`/api/sites/${one.id}/domains`, { host: W })
  check('a name that does not resolve to the target is added as waiting, with why', waiting.status === 201 && waiting.body.domain.verified === false && ['unresolved', 'elsewhere'].includes(waiting.body.domain.wait), `${waiting.status} ${waiting.text.slice(0, 200)}`)
  const again = await api.post(`/api/sites/${one.id}/domains/${waiting.body.domain.id}/check`)
  check('"Check again" leaves it waiting', again.status === 200 && again.body.domain.verified === false, `${again.status} ${again.text.slice(0, 200)}`)
  check('a waiting name cannot be made the main address', (await api.post(`/api/sites/${one.id}/domains/${waiting.body.domain.id}/main`, { main: true })).body?.data?.code === 'domain.waiting')
  check('nothing about the site changes for a waiting name: it is in no row', !JSON.stringify((await tableRows())[one.id].row).includes(W))

  // The main address.
  const mainSet = await api.post(`/api/sites/${one.id}/domains/${added.body.domain.id}/main`, { main: true })
  check('the verified name is made the main address', mainSet.status === 200 && mainSet.body.domain.main === true, `${mainSet.status} ${mainSet.text.slice(0, 200)}`)
  one = (await api.get(`/api/sites/${one.id}?runtime=1`)).body.site
  const rowMain = (await tableRows())[one.id].row
  check('the row: hosts start with the domain, the service address is served as well, the public address is the domain', JSON.stringify(rowMain.hosts) === JSON.stringify([D]) && JSON.stringify(rowMain.alsoHosts) === JSON.stringify([`${one.slug}.localhost`]) && rowMain.publicUrl === domainUrl, JSON.stringify([rowMain.hosts, rowMain.alsoHosts, rowMain.publicUrl]))
  check('the cloud shows the domain as the site\'s address, and still reaches the site at its service address', one.publicUrl === domainUrl && (await cloudQuery('select internal_url from sites where id = $1', [one.id]))[0].internal_url === service1, one.publicUrl)
  const atDomain = await page(domainUrl)
  check('the site answers at the domain', atDomain.status === 200 && atDomain.text.includes('Ateliér Světlo'), `${atDomain.status}`)
  const atService = await page(service1)
  check('the service address still answers as the site, without a redirect', atService.status === 200 && atService.text.includes('Ateliér Světlo') && (await ready(service1))?.migrations === 'done', `${atService.status} ${atService.location}`)
  const viaCloud = await waitFor(async () => { const now = (await api.get(`/api/sites/${one.id}?runtime=1`)).body; return now.storage ? now : null }, { timeout: 15_000, every: 300, what: 'the cloud to read the site\'s storage' })
  check('the cloud\'s own calls to the site work (it runs; its storage is read)', viaCloud.runtime?.running === true && viaCloud.storage?.usedBytes > 0, JSON.stringify([viaCloud.runtime, viaCloud.storage]))
  const second2 = await api.post(`/api/sites/${one.id}/domains`, { host: D2 })
  const redirected = await page(`http://${D2}:${sitePort}`, '/galerie?x=1')
  check('another name of the site redirects to the domain', second2.status === 201 && second2.body.domain.verified && redirected.status === 308 && redirected.location === `${domainUrl}/galerie?x=1`, `${redirected.status} ${redirected.location}`)
  const sitemap = await page(domainUrl, '/sitemap.xml')
  check('the sitemap\'s addresses use the domain, at the domain and at the service address alike', sitemap.status === 200 && sitemap.text.includes(`<loc>${domainUrl}/`) && !sitemap.text.includes(`${one.slug}.localhost`) && (await page(service1, '/sitemap.xml')).text.includes(`<loc>${domainUrl}/`), `${sitemap.status} ${sitemap.text.slice(0, 300)}`)
  const invite = await api.post(`/api/sites/${one.id}/invite`)
  check('the link of an invitation the site makes (the one its invitation e-mail carries) leads to the domain', invite.status === 200 && String(invite.body.site.inviteUrl).startsWith(`${domainUrl}/admin/invite/`), `${invite.status} ${invite.body?.site?.inviteUrl}`)

  // The certificate question.
  const ask = (host) => fetch(`${cloud.url}/api/domains/ask?domain=${encodeURIComponent(host)}`, { redirect: 'manual' }).then(async (res) => ({ status: res.status, text: await res.text(), cookie: res.headers.getSetCookie().length }))
  const asked = { domain: await ask(D), alias: await ask(D2), service: await ask(`${two.slug}.localhost`), unknown: await ask(`nikde-${stamp}.example.com`), waiting: await ask(W), removed: await ask(`${third.slug}.localhost`), nothing: await ask('') }
  check('"may I issue a certificate?": yes for the domain, for the site\'s other verified name and for a site\'s service address', asked.domain.status === 200 && asked.alias.status === 200 && asked.service.status === 200, JSON.stringify(asked))
  check('no for an unknown name, for a waiting one, for a deleted site\'s address and for no name', asked.unknown.status === 404 && asked.waiting.status === 404 && asked.removed.status === 404 && asked.nothing.status === 404, JSON.stringify(asked))
  check('it is asked without a session and answers nothing else', Object.values(asked).every((a) => a.text === '' && a.cookie === 0))

  // The account service follows the address.
  const clientOf = async (id) => (await cloudQuery('select id, url, revoked_at from account_clients where site_id = $1', [id]))[0]
  check('the site\'s client at the account service has the domain as its address', (await clientOf(one.id)).url === domainUrl, (await clientOf(one.id)).url)
  const browser = new Http(domainUrl)
  const startSignIn = await browser.get('/api/cms/_auth/account/start?next=/admin')
  const authorize = new URL(startSignIn.location ?? 'http://none')
  check('"Open the admin" at the domain sends the browser to the account, to come back to the domain', one.adminUrl === `${domainUrl}/api/cms/_auth/account/start?next=/admin` && startSignIn.status === 302 && authorize.origin === cloud.url && authorize.searchParams.get('redirect_uri') === `${domainUrl}/api/cms/_auth/account/callback`, `${startSignIn.status} ${startSignIn.location}`)
  const granted2 = await api.get(authorize.toString())
  const back = new URL(granted2.location ?? 'http://none')
  check('the account knows the owner and sends them straight back to the domain with a code', granted2.status === 302 && back.origin === domainUrl && back.pathname === '/api/cms/_auth/account/callback' && !!back.searchParams.get('code'), `${granted2.status} ${granted2.location} ${granted2.text.slice(0, 200)}`)
  const landed = await browser.get(back.pathname + back.search)
  const me = await browser.get('/api/cms/_auth/me')
  check('the site opens its own session for the owner: sign-in through the account works at the domain', [302, 303].includes(landed.status) && String(landed.location).endsWith('/admin') && me.status === 200 && me.body?.user?.email === owner.email, `${landed.status} ${landed.location} | ${me.status} ${me.text.slice(0, 200)}`)
  const stale = new URL(authorize)
  stale.searchParams.set('redirect_uri', `${service1}/api/cms/_auth/account/callback`)
  const refusedBack = await api.get(stale.toString())
  check('a sign-in that would come back to the old address is refused by the account, with a page and no redirect', refusedBack.status >= 400 && !refusedBack.location, `${refusedBack.status} ${refusedBack.location}`)
  const admin1 = browser

  // ── 4 · the plan's limits ──
  log('4 · the limits of the plan')
  check('the row carries the plan\'s limits: 20 MB an upload, 1 GB in all', rowMain.config.storage.maxSizeMb === 20 && rowMain.config.storage.maxBytes === 1024 * 1024 * 1024 && one.plan === 'basic', JSON.stringify(rowMain.config.storage))
  const upload = async (client, bytes, name) => { const form = new FormData(); form.append('file', new Blob([bytes], { type: 'image/png' }), name); return client.request('POST', '/api/cms/_media', { form }) }
  const big = await upload(admin1, Buffer.concat([PNG, Buffer.alloc(20.5 * 1024 * 1024)]), `big-${stamp}.png`)
  check('an upload over the plan\'s size (20.5 MB against 20) is refused by the site, which names the limit', big.status === 413 && big.body?.data?.code === 'file_too_large' && big.body.data.maxMb === 20, `${big.status} ${big.text.slice(0, 200)}`)
  const bigger = await upload(admin1, Buffer.concat([PNG, Buffer.alloc(25 * 1024 * 1024)]), `bigger-${stamp}.png`)
  check('a much larger one (25 MB) is refused before it is read', bigger.status === 413, `${bigger.status} ${bigger.text.slice(0, 200)}`)
  const small = await upload(admin1, PNG, `e2e-${stamp}.png`)
  const media = small.body?.media ?? small.body?.row ?? small.body
  check('a small one is taken', small.status >= 200 && small.status < 300 && typeof media?.key === 'string', `${small.status} ${small.text.slice(0, 200)}`)
  const usage = await waitFor(async () => { const now = (await api.get(`/api/sites/${one.id}?runtime=1`)).body.storage; return now && now.usedBytes > viaCloud.storage.usedBytes ? now : null }, { timeout: 20_000, every: 1000, what: 'the cloud to see the new file in the site\'s storage' })
  check('the site page\'s data reports the storage used against the plan\'s total, as the site says it', usage.limitBytes === 1024 * 1024 * 1024 && usage.maxUploadMb === 20 && usage.usedBytes > 0, JSON.stringify(usage))
  const sitePage = await api.get(`/sites/${one.id}`, { headers: { accept: 'text/html' } })
  check('the site\'s page shows the storage, the domains and the quiet way to move the website', sitePage.status === 200 && sitePage.text.includes(`data-storage-limit="${1024 * 1024 * 1024}"`) && sitePage.text.includes(`data-domain="${D}"`) && sitePage.text.includes('data-domain-state="main"') && sitePage.text.includes('data-domain-state="waiting"') && sitePage.text.includes('data-move-open'), `${sitePage.status}`)

  // The main domain goes: back to the service address.
  const unmain = await api.post(`/api/sites/${one.id}/domains/${added.body.domain.id}/main`, { main: false })
  const viaD = await page(domainUrl, '/galerie')
  check('"go back to the service address": the domain redirects to it again', unmain.status === 200 && viaD.status === 308 && viaD.location === `${service1}/galerie` && (await api.get(`/api/sites/${one.id}`)).body.site.publicUrl === service1, `${unmain.status} ${viaD.status} ${viaD.location}`)
  check('the domain is made main once more', (await api.post(`/api/sites/${one.id}/domains/${added.body.domain.id}/main`, { main: true })).status === 200 && (await page(domainUrl)).status === 200)
  const removedMain = await api.post(`/api/sites/${one.id}/domains/${added.body.domain.id}/remove`)
  one = (await api.get(`/api/sites/${one.id}`)).body.site
  const rowBack = (await tableRows())[one.id].row
  check('removing the main domain restores the service address: in the row, in the cloud, at the account service', removedMain.status === 200 && one.publicUrl === service1 && rowBack.publicUrl === service1 && rowBack.hosts[0] === `${one.slug}.localhost` && !('alsoHosts' in rowBack) && (await clientOf(one.id)).url === service1, JSON.stringify([one.publicUrl, rowBack.hosts, rowBack.publicUrl]))
  const goneDomain = await page(domainUrl)
  check('the removed name answers 404, and the site\'s other name redirects to the service address', goneDomain.status === 404 && (await page(`http://${D2}:${sitePort}`, '/galerie')).location === `${service1}/galerie`, `${goneDomain.status}`)
  check('the removed name is free: site 2 can add it now', await (async () => { const r = await api.post(`/api/sites/${two.id}/domains`, { host: D }); const ok = r.status === 201; if (ok) await api.post(`/api/sites/${two.id}/domains/${r.body.domain.id}/remove`); return ok })())
  check('"may I issue a certificate?" says no for it now', (await ask(D)).status === 404)
  check('the session made at the domain is the site\'s own: it works at the service address', (await new Http(service1).get('/api/cms/_auth/me', { cookie: admin1.cookie })).status === 200)
  const site1 = new Http(service1)
  for (const [k, v] of admin1.cookies) site1.cookies.set(k, v)

  // ── 5 · out and in ──
  log('5 · moving site 1 out: its archive')
  const entry = { name: `Jen na prvním webu ${stamp}`, slug: `jen-na-prvnim-${stamp}` }
  const created = await site1.post('/api/cms/category', entry)
  check('an entry is made on site 1 (the content that must travel)', created.status >= 200 && created.status < 300 && !!created.body?.row?.id, `${created.status} ${created.text.slice(0, 200)}`)
  // A second person of the site, with a password of the site's own.
  const editor = { email: `editor-${stamp}@example.com`, name: 'Eva Editorka', password: 'heslo-editorky-na-webu-1' }
  const invited = await site1.post('/api/cms/_users', { email: editor.email, name: editor.name, role: 'editor' })
  const editor1 = new Http(service1)
  check('an editor is invited to site 1 and chooses a password there', invited.status >= 200 && invited.status < 300 && (await editor1.post('/api/cms/_auth/accept', { token: String(invited.body.inviteUrl).split('/').pop(), name: editor.name, password: editor.password })).status === 200, `${invited.status} ${invited.text.slice(0, 200)}`)
  check('the editor\'s session works on site 1 (a session from before the move)', (await editor1.get('/api/cms/_auth/me')).body?.user?.email === editor.email)
  const filePath = new URL(media.url, service1).pathname
  const people1 = (await query(row1.databaseUrl, 'select email, role, status from cms_users order by email')).map((r) => `${r.email}:${r.role}:${r.status}`).join(',')

  check('another person cannot ask for the site\'s archive', (await other.post(`/api/sites/${one.id}/export`)).status === 404)
  check('there is no archive to download yet', (await api.get(`/api/sites/${one.id}/export/download`)).status === 404)
  const asked5 = await api.post(`/api/sites/${one.id}/export`)
  check('the export is accepted and runs in the background', asked5.status === 200 && ['pending', 'running'].includes(asked5.body.site.export?.state), `${asked5.status} ${asked5.text.slice(0, 300)}`)
  // While the backup runs the site is read-only: a write is refused, a read works.
  const during = await waitFor(async () => {
    const view = (await api.get(`/api/sites/${one.id}`)).body.site
    if (view.export?.state === 'done' || view.export?.state === 'failed') throw new Error(`the export ended (${view.export.state}) before its backup step was seen running`)
    if (view.export?.steps[1].state !== 'running') return null
    const [write, read, rows] = await Promise.all([site1.post('/api/cms/category', {}), new Http(service1).get('/api/content/category'), tableRows()])
    const after = (await api.get(`/api/sites/${one.id}`)).body.site
    // Looked at from both sides of the two requests: the backup was running throughout.
    return after.export?.steps[1].state === 'running' ? { write, read, view: after, row: rows[one.id].row } : null
  }, { timeout: 60_000, every: 40, what: 'the backup step to be running' })
  check('while the backup runs a write is refused: 503, "read-only for a moment"', during.write.status === 503 && during.write.text.includes('read-only'), `${during.write.status} ${during.write.text.slice(0, 100)}`)
  check('a read works meanwhile', during.read.status === 200 && during.read.text.includes(entry.slug), `${during.read.status}`)
  check('the row says read-only, the cloud says so too, and shows the steps as they stand', during.row.state === 'read-only' && during.view.hostState === 'read-only' && during.view.export.steps.map((s) => `${s.id}:${s.state}`).join() === 'readonly:done,backup:running,reopen:pending', JSON.stringify([during.row.state, during.view.hostState, during.view.export]))
  const exported = await waitFor(async () => {
    const now = (await api.get(`/api/sites/${one.id}`)).body.site
    if (now.export?.state === 'failed') throw new Error(`the export failed: ${JSON.stringify(now.export)} ${now.errorDetail ?? ''}`)
    return now.export?.state === 'done' ? now : null
  }, { timeout: 180_000, every: 300, what: 'the export to finish' })
  check('the three steps are written down as done, and the archive is there', exported.export.steps.every((s) => s.state === 'done') && exported.export.ready === true && exported.export.bytes > 100_000 && exported.hostState === 'active', JSON.stringify(exported.export))
  check('the site is served as before: its row has no state, and a write works again', !('state' in (await tableRows())[one.id].row) && [400, 422].includes((await site1.post('/api/cms/category', {})).status))
  const folder1 = join(templateDir, 'sites', one.id)
  const onDisk = filesUnder(join(folder1, 'exports'))
  check('the archive lies in the site\'s own folder, beside its uploads and not among them, readable by its owner only', onDisk.length === 1 && /\/exports\/tinyzoo-[a-z0-9-]+-\d{8}-\d{6}\.tar$/.test(onDisk[0]) && mode(onDisk[0]) === '600' && statSync(onDisk[0]).size === exported.export.bytes, onDisk.join(' '))
  const archiveName = onDisk[0].split('/').pop()
  const reach = await Promise.all([`/exports/${archiveName}`, `/api/cms/_media/raw/../exports/${archiveName}`, `/api/cms/_media/raw/exports/${archiveName}`, `/${archiveName}`].map(async (path) => (await page(service1, path)).status))
  check('it has no public address: the site does not serve it', reach.every((status) => status === 404 || status === 400), reach.join(' '))
  const archive = join(workDir, archiveName)
  const download = await fetch(`${cloud.url}/api/sites/${one.id}/export/download`, { headers: { cookie: api.cookie }, redirect: 'manual' })
  await pipeline(Readable.fromWeb(download.body), createWriteStream(archive, { mode: 0o600 }))
  check('its owner downloads it: a tar attachment, never cached, the same bytes as on the disk', download.status === 200 && download.headers.get('content-type') === 'application/x-tar' && String(download.headers.get('content-disposition')).includes(`attachment; filename="${archiveName}"`) && String(download.headers.get('cache-control')).includes('no-store') && sha(readFileSync(archive)) === sha(readFileSync(onDisk[0])), `${download.status} ${download.headers.get('content-type')} ${download.headers.get('content-disposition')}`)
  const asOther = await other.get(`/api/sites/${one.id}/export/download`, { raw: true })
  const asNobody = await new Http(cloud.url).get(`/api/sites/${one.id}/export/download`, { raw: true })
  check('another person gets 404 and no byte of it; nobody signed in gets 401', asOther.status === 404 && asNobody.status === 401 && asOther.bytes.length < 2000 && asNobody.bytes.length < 2000, `${asOther.status} ${asNobody.status}`)
  const listing = (await run('tar', ['-tf', archive])).stdout.split('\n').filter(Boolean)
  check('the archive holds the database dump, the manifest, every media file and site.json', listing.includes('manifest.json') && listing.includes('database.dump') && listing.includes('site.json') && listing.includes(`media/${media.key}`) && listing.filter((n) => n.startsWith('media/') && !n.endsWith('/')).length > 5, listing.slice(0, 8).join(' '))
  const siteJson = JSON.parse((await run('tar', ['-xOf', archive, 'site.json'])).stdout)
  const manifest = JSON.parse((await run('tar', ['-xOf', archive, 'manifest.json'], { maxBuffer: 64 * 1024 * 1024 })).stdout)
  check('site.json carries the site\'s secret, its status token, its addresses, its template and the tinyzoo it ran on', siteJson.secret === row1.secret && siteJson.statusToken === row1.config.status.token && siteJson.publicUrl === service1 && JSON.stringify(siteJson.hosts) === JSON.stringify([`${one.slug}.localhost`, D2]) && siteJson.template === TEMPLATE && siteJson.tinyzooVersion === manifest.tinyzooVersion && /^\d+\.\d+\.\d+/.test(siteJson.tinyzooVersion) && siteJson.name === 'Ateliér Světlo', JSON.stringify({ ...siteJson, secret: '…', statusToken: '…' }))
  check('and the id of its client at the account service, never the client\'s secret, nor the database password, nor the setup code', siteJson.account?.clientId === row1.config.auth.account.clientId && siteJson.account.issuer === cloud.url && ![row1.config.auth.account.clientSecret, new URL(row1.databaseUrl).password, row1.config.auth.setupToken].some((x) => JSON.stringify(siteJson).includes(x)))
  check('the export did not leak the site\'s secrets into the cloud\'s log', !secrets.some((x) => readFileSync(logFile, 'utf8').includes(x)))

  log('5 · moving it in, as a new site under another address')
  const newSlug = `ops-nove-${stamp}`
  const sendArchive = (client, file, slug, extra = {}) => client.request('POST', `/api/sites/import?slug=${slug}`, { body: createReadStream(file), type: 'application/x-tar', ...extra })
  check('nobody signed in cannot bring an archive', (await sendArchive(new Http(cloud.url), archive, newSlug)).status === 401)
  const taken = await sendArchive(api, archive, two.slug)
  check('refused: the address is taken', taken.status === 409 && taken.body?.data?.code === 'slug.taken', `${taken.status} ${taken.text.slice(0, 200)}`)
  const junk = join(workDir, 'junk.tar')
  writeFileSync(junk, randomBytes(4096))
  const notOne = await sendArchive(api, junk, newSlug)
  check('refused: a file that is not an archive of a website', notOne.status === 422 && notOne.body?.data?.code === 'import.archive', `${notOne.status} ${notOne.text.slice(0, 200)}`)
  const unknownTemplate = await sendArchive(api, await alteredArchive(archive, 'unknown-template', 'site.json', (s) => ({ ...s, template: 'zverinec' })), newSlug)
  check('refused: the archive\'s template is not known here', unknownTemplate.status === 422 && unknownTemplate.body?.data?.code === 'import.template', `${unknownTemplate.status} ${unknownTemplate.text.slice(0, 200)}`)
  const planned = await sendArchive(api, await alteredArchive(archive, 'planned-template', 'site.json', (s) => ({ ...s, template: 'bakery' })), newSlug)
  check('refused: a template that is not ready', planned.status === 422 && ['import.template'].includes(planned.body?.data?.code), `${planned.status} ${planned.text.slice(0, 200)}`)
  const newer = await sendArchive(api, await alteredArchive(archive, 'newer', 'manifest.json', (m) => ({ ...m, tinyzooVersion: '99.0.0' })), newSlug)
  check('refused: an archive of a newer tinyzoo than the template\'s build', newer.status === 422 && newer.body?.data?.code === 'import.newer' && newer.body.data.theirs === '99.0.0' && newer.body.data.ours === manifest.tinyzooVersion, `${newer.status} ${newer.text.slice(0, 200)}`)
  const tooBig = await api.request('POST', `/api/sites/import?slug=${newSlug}`, { body: Buffer.alloc(49 * 1024 * 1024), type: 'application/x-tar' })
  check('refused: an upload over the size limit (49 MB against 48)', tooBig.status === 413 && tooBig.body?.data?.code === 'import.large', `${tooBig.status} ${tooBig.text.slice(0, 200)}`)
  const asForm = new FormData()
  asForm.append('file', new Blob([randomBytes(64)]), 'x.tar')
  check('refused: a form another website could make a browser send (multipart)', (await api.request('POST', `/api/sites/import?slug=${newSlug}`, { form: asForm })).status === 415)
  check('no upload that was refused is left on the disk', filesUnder(join(dataDir, '_imports')).length === 0, filesUnder(join(dataDir, '_imports')).join(' '))
  check('and no site was made by any of them', (await api.get('/api/sites')).body.sites.length === 3)

  const imported = await sendArchive(api, archive, newSlug)
  check('the archive is taken in: a new site is being made', imported.status === 201 && imported.body.site.slug === newSlug && imported.body.site.imported === true && imported.body.site.template === TEMPLATE && imported.body.site.name === 'Ateliér Světlo', `${imported.status} ${imported.text.slice(0, 300)}`)
  const fresh = (await untilReady(imported.body.site.id, 'the imported site')).site
  const serviceNew = `http://${newSlug}.localhost:${sitePort}`
  check('it went through the four steps, each once, and is ready at its own address', fresh.steps.map((s) => `${s.id}:${s.state}:${s.attempts}`).join(' ') === 'database:done:1 start:done:1 content:done:1 account:done:1' && fresh.publicUrl === serviceNew && fresh.hostState === 'active', JSON.stringify(fresh.steps.map((s) => [s.id, s.state, s.attempts, s.message])))
  check('the uploaded archive is gone from the cloud\'s folder once it was restored', filesUnder(join(dataDir, '_imports')).length === 0)
  const rowNew = openRow((await tableRows())[fresh.id].row)
  const dbNew = new URL(rowNew.databaseUrl).pathname.slice(1)
  check('it has a database and a user of its own, named by its own id', dbNew === `${PREFIX}_${fresh.id.replace(/-/g, '_')}` && new URL(rowNew.databaseUrl).username === dbNew && dbNew !== db1 && new URL(rowNew.databaseUrl).password !== new URL(row1.databaseUrl).password)
  check('each of the two users is refused on the other\'s database', await refusal(onDatabase(row1.databaseUrl, dbNew)) === '42501' && await refusal(onDatabase(rowNew.databaseUrl, db1)) === '42501')
  const homeNew = await page(serviceNew)
  const listNew = await new Http(serviceNew).get('/api/content/category')
  check('the same content: its name, its look, and the entry made before the move', homeNew.status === 200 && homeNew.text.includes('Ateliér Světlo') && homeNew.text.includes('data-look="negativ"') && listNew.text.includes(entry.slug), `${homeNew.status}`)
  const peopleNew = (await query(rowNew.databaseUrl, 'select email, role, status from cms_users order by email')).map((r) => `${r.email}:${r.role}:${r.status}`).join(',')
  check('the same people, with their roles', peopleNew === people1 && peopleNew.includes(`${editor.email}:editor:active`) && peopleNew.includes(`${owner.email}:admin:active`), `${peopleNew} | ${people1}`)
  const editorNew = new Http(serviceNew)
  check('the editor signs in on the new site with the password chosen on the old one', (await editorNew.post('/api/cms/_auth/login', { email: editor.email, password: editor.password })).status === 200 && (await editorNew.get('/api/cms/_auth/me')).body?.user?.email === editor.email)
  check('a session of the old site is not one of the new site', (await new Http(serviceNew).get('/api/cms/_auth/me', { cookie: editor1.cookie })).status === 401)
  const [fileOld, fileNew] = await Promise.all([fetch(service1 + filePath), fetch(serviceNew + filePath)])
  const [bytesOld, bytesNew] = [Buffer.from(await fileOld.arrayBuffer()), Buffer.from(await fileNew.arrayBuffer())]
  check('the same media: the uploaded file is served by the new site, byte for byte', fileNew.status === 200 && bytesNew.equals(PNG) && bytesOld.equals(PNG), `${fileOld.status} ${fileNew.status}`)
  const folderNew = join(templateDir, 'sites', fresh.id)
  const fileName = media.key.split('/').pop()
  const mediaCount = async (row) => (await query(row.databaseUrl, 'select count(*)::int as n from cms_media'))[0].n
  check('its files are in its own folder, every one the database names', filesUnder(join(folderNew, 'uploads')).some((f) => f.endsWith(`/${fileName}`)) && rowNew.config.storage.local.dir === join(folderNew, 'uploads') && filesUnder(join(folderNew, 'uploads')).length >= await mediaCount(rowNew) && await mediaCount(rowNew) === await mediaCount(row1), `${filesUnder(join(folderNew, 'uploads')).length} files`)
  check('it keeps the secret its sessions were bound to and the token its status is asked with; its other secrets are new', rowNew.secret === row1.secret && rowNew.config.status.token === row1.config.status.token && rowNew.config.auth.setupToken !== row1.config.auth.setupToken && rowNew.config.auth.account.clientId !== row1.config.auth.account.clientId && (await siteStatus(serviceNew, row1.config.status.token)).status === 200)
  check('who brought it owns it in the cloud; another person does not see it', (await api.get('/api/sites')).body.sites.some((s) => s.id === fresh.id) && (await other.get(`/api/sites/${fresh.id}`)).status === 404)
  const serviceEmail = 'cloud@tinyzoo.invalid'
  const freshInvite = await api.post(`/api/sites/${fresh.id}/invite`)
  check('the cloud\'s service account is on it and the cloud signs in with it; the owner was on the site already', peopleNew.includes(`${serviceEmail}:admin:active`) && freshInvite.status === 200 && freshInvite.body.site.ownerAccepted === true, `${freshInvite.status} ${freshInvite.text.slice(0, 200)}`)
  const signInNew = await (async () => {
    const b = new Http(serviceNew)
    const s = await b.get('/api/cms/_auth/account/start?next=/admin')
    const g = await api.get(String(s.location))
    const cb = new URL(String(g.location))
    await b.get(cb.pathname + cb.search)
    return (await b.get('/api/cms/_auth/me')).body?.user?.email
  })()
  check('the owner gets into its admin through the account (its client is a new one)', signInNew === owner.email, String(signInNew))
  const serviceGone = await (async () => {
    // An archive of a site that has no service account: the cloud makes one.
    const row = (await query(rowNew.databaseUrl, 'select count(*)::int as n from cms_users where email = $1', [serviceEmail]))[0].n
    return row === 1
  })()
  check('the service account exists exactly once', serviceGone)
  check('the original still works: its page, its entry, its session, its file', (await page(service1)).status === 200 && (await new Http(service1).get('/api/content/category')).text.includes(entry.slug) && (await site1.get('/api/cms/_auth/me')).status === 200 && bytesOld.equals(PNG))
  const onlyNew = { name: `Jen na novém webu ${stamp}`, slug: `jen-na-novem-${stamp}` }
  check('the two are separate from now on: an entry made on the new site is not on the old one', (await editorNew.post('/api/cms/category', onlyNew)).status < 300 && (await new Http(serviceNew).get('/api/content/category')).text.includes(onlyNew.slug) && !(await new Http(service1).get('/api/content/category')).text.includes(onlyNew.slug))

  log('5 · the original moved: its address sends everybody on; then its data is deleted here')
  check('"it lives elsewhere now" needs a real address, and not the site\'s own', (await api.post(`/api/sites/${one.id}/moved`, { url: 'not an address' })).body?.data?.code === 'move.address' && (await api.post(`/api/sites/${one.id}/moved`, { url: service1 })).body?.data?.code === 'move.same')
  check('a site with no archive made cannot be marked as moved', (await api.post(`/api/sites/${two.id}/moved`, { url: serviceNew })).body?.data?.code === 'move.exportFirst')
  check('another person cannot mark it', (await other.post(`/api/sites/${one.id}/moved`, { url: serviceNew })).status === 404)
  const movedAt = Date.now()
  const moved = await api.post(`/api/sites/${one.id}/moved`, { url: serviceNew })
  check('the original is marked as moved to the new address', moved.status === 200 && moved.body.site.hostState === 'moved' && moved.body.site.movedTo === serviceNew && moved.body.site.adminUrl === null, `${moved.status} ${moved.text.slice(0, 300)}`)
  measures.movedMs = Date.now() - movedAt
  const rowMoved = (await tableRows())[one.id].row
  check('its row says moved, with where to, and holds its service address only', rowMoved.state === 'moved' && rowMoved.movedTo === serviceNew && JSON.stringify(rowMoved.hosts) === JSON.stringify([`${one.slug}.localhost`]), JSON.stringify([rowMoved.state, rowMoved.movedTo, rowMoved.hosts]))
  const hops = await Promise.all([
    page(service1, '/'), page(service1, '/galerie?x=1'), page(service1, '/api/health/ready'), page(service1, '/admin'), page(service1, filePath),
    page(service1, '/api/cms/_auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }),
  ])
  check('every request to the old address is redirected to the same place at the new one (pages, the API, the admin, files, a POST)',
    hops.every((h) => h.status === 308) && hops.map((h) => h.location).join(' ') === ['/', '/galerie?x=1', '/api/health/ready', '/admin', filePath, '/api/cms/_auth/login'].map((p) => serviceNew + p).join(' '), hops.map((h) => `${h.status} ${h.location}`).join(' | '))
  check('its other name went with it: it leads nowhere here now', (await page(`http://${D2}:${sitePort}`)).status === 404 && (await api.get(`/api/sites/${one.id}/domains`)).body.domains.length === 0)
  check('nobody signs in to it here through the account any more: its client is revoked', !!(await clientOf(one.id)).revoked_at)
  check('"may I issue a certificate?" still says yes for the old address (it redirects)', (await ask(`${one.slug}.localhost`)).status === 200)
  const movedPage = await api.get(`/sites/${one.id}`, { headers: { accept: 'text/html' } })
  check('the cloud\'s page says where the website moved, and offers to delete the data it left here', movedPage.status === 200 && movedPage.text.includes('data-moved-data="here"') && movedPage.text.includes('data-moved-delete') && !movedPage.text.includes('data-open-admin'), `${movedPage.status}`)
  check('before: the original\'s database, user and folder are still here', (await siteDatabases()).includes(db1) && (await siteRoles()).includes(db1) && existsSync(folder1))
  check('deleting the data asks for the address typed out', (await api.post(`/api/sites/${one.id}/moved-data`, { confirm: 'something else' })).status === 422 && (await api.post(`/api/sites/${two.id}/moved-data`, { confirm: two.slug })).body?.data?.code === 'move.notMoved')
  const wiped = await api.post(`/api/sites/${one.id}/moved-data`, { confirm: one.slug })
  check('the original\'s data is deleted here', wiped.status === 200 && wiped.body.site.dataRemoved === true && wiped.body.site.export?.ready === false, `${wiped.status} ${wiped.text.slice(0, 300)}`)
  check('its database is gone', !(await siteDatabases()).includes(db1))
  check('its database user is gone', !(await siteRoles()).includes(db1))
  await sleep(1500)
  check('its folder is gone, uploads and archive with it, and stays gone', !existsSync(folder1))
  check('its archive can no longer be downloaded', (await api.get(`/api/sites/${one.id}/export/download`)).status === 404)
  check('the old address keeps redirecting', (await page(service1, '/galerie')).location === `${serviceNew}/galerie`)
  check('the new site is untouched: its page, both entries, its file, its sessions, its database and folder', (await page(serviceNew)).status === 200 && (await new Http(serviceNew).get('/api/content/category')).text.includes(entry.slug) && (await new Http(serviceNew).get('/api/content/category')).text.includes(onlyNew.slug) && Buffer.from(await (await fetch(serviceNew + filePath)).arrayBuffer()).equals(PNG) && (await editorNew.get('/api/cms/_auth/me')).status === 200 && (await siteDatabases()).includes(dbNew) && existsSync(folderNew))
  check('site 2 is untouched, and the process is the same one as at the start', (await page(service2)).text.includes('Foto Zápisník') && (await templateProcesses()).map((p) => p.pid).join() === String(pid))
  const restarted = await api.post(`/api/sites/${two.id}/invite`)
  check('the cloud still sees to its sites with a moved one among them', restarted.status === 200, `${restarted.status} ${restarted.text.slice(0, 200)}`)
  const removal = await api.post(`/api/sites/${one.id}/remove`, { confirm: one.slug })
  await waitFor(async () => (await cloudQuery('select status from sites where id = $1', [one.id]))[0]?.status === 'removed', { timeout: 30_000, what: 'the moved site to be deleted' })
  check('deleting the moved website ends the redirect too: its address answers 404 and is free', removal.status === 200 && (await page(service1)).status === 404 && (await api.get(`/api/slug?slug=${one.slug}`)).body?.ok === true)

  // ── 6 · out to a server of its own ──
  log('6 · moving out to a server of its own: the one app as a process of its own for the one site, restored from the archive')
  mkdirSync(join(singleDir, 'uploads'), { recursive: true })
  await withPg(async (c) => { await c.query(`drop database if exists ${own(SINGLE_DB)} with (force)`); await c.query(`create database ${own(SINGLE_DB)}`) })
  const singleDb = dbUrl(SINGLE_DB)
  const restored = await tinyzoo(['restore', archive, '--yes'], { databaseUrl: singleDb, uploadsDir: join(singleDir, 'uploads'), cwd: singleDir })
  check('`tinyzoo restore` puts the archive into a new, empty database and folder (site.json in the archive does not disturb it)', restored.stdout.includes('✓ restored') && (await query(singleDb, 'select count(*)::int as n from cms_users'))[0].n === people1.split(',').length && filesUnder(join(singleDir, 'uploads')).some((f) => f.endsWith(`/${fileName}`)), restored.stdout.slice(-300))
  const singlePort = PORTS.to
  if (!(await portFree(singlePort))) throw new Error(`port ${singlePort} is in use`)
  const singleUrl = `http://127.0.0.1:${singlePort}`
  const cookieName = [...editor1.cookies.keys()][0]
  // The one app has no single-site mode: the restored site runs on it in multi-tenant mode, from a site directory
  // file that holds this one site, as the cloud's local driver runs any site. The row is made as that driver makes one
  // (`localSiteRow`): the site's own id and model, its database, the secret site.json carries, its address and its folder.
  const movedRow = {
    id: one.id, hosts: ['127.0.0.1'], publicUrl: singleUrl, databaseUrl: singleDb, secret: siteJson.secret, model: siteJson.template,
    config: { auth: { setupToken: randomBytes(24).toString('base64url') }, status: { token: siteJson.statusToken }, storage: { driver: 'local', local: { dir: join(singleDir, 'uploads') } } },
  }
  // First with what site.json carries: the site's own secret as the process's app secret.
  single = await startSingle(singlePort, { row: movedRow, appSecret: siteJson.secret, cookieName })
  const homeSingle = await page(singleUrl)
  check('the site runs as a process of its own (the one app, one site in its directory) with the same content and the same design', (await ready(singleUrl))?.migrations === 'done' && homeSingle.status === 200 && homeSingle.text.includes('Ateliér Světlo') && homeSingle.text.includes('data-look="negativ"') && /<html\b[^>]*data-design="photographer"/.test(homeSingle.text) && (await new Http(singleUrl).get('/api/content/category')).text.includes(entry.slug) && !(await new Http(singleUrl).get('/api/content/category')).text.includes(onlyNew.slug), `${homeSingle.status}`)
  check('it is a process of its own: another pid and port than the shared app\'s, with the marker of this step', single.pid !== pid && (await ownProcesses()).some((p) => p.single && p.pid === single.pid) && (await templateProcesses()).map((p) => p.pid).join() === String(pid))
  check('the same media, byte for byte', Buffer.from(await (await fetch(singleUrl + filePath)).arrayBuffer()).equals(PNG))
  check('the status token carried in site.json opens its status: monitoring keeps working', (await siteStatus(singleUrl, siteJson.statusToken)).body?.people?.active === people1.split(',').filter((p) => p.endsWith(':active')).length)
  const editorSingle = new Http(singleUrl)
  check('people sign in with the passwords they had', (await editorSingle.post('/api/cms/_auth/login', { email: editor.email, password: editor.password })).status === 200 && (await editorSingle.get('/api/cms/_auth/me')).body?.user?.email === editor.email)
  const withSiteSecret = (await new Http(singleUrl).get('/api/cms/_auth/me', { cookie: editor1.cookie })).status
  check('with the site\'s own secret as the app secret, a session from before the move is NOT accepted (401): shared hosting seals the cookie with the secret of the app\'s process, which no archive carries', withSiteSecret === 401, String(withSiteSecret))
  // Then with the secret the cookie was sealed with: the app process's own (app.json), which only whoever runs the service has.
  await stopProcesses((p) => p.single)
  single = await startSingle(singlePort, { row: movedRow, appSecret: app.secret, cookieName })
  const survived = await new Http(singleUrl).get('/api/cms/_auth/me', { cookie: editor1.cookie })
  check('with the secret of the shared process as the app secret (and the same cookie name and database), the same session works: 200, the same person', survived.status === 200 && survived.body?.user?.email === editor.email, `${survived.status} ${survived.text.slice(0, 200)}`)
  check('the owner\'s session from before the move works there too', (await new Http(singleUrl).get('/api/cms/_auth/me', { cookie: site1.cookie })).body?.user?.email === owner.email)
  await stopProcesses((p) => p.single)
  single = null

  // ── 8 · the same sites, the directory in a file ──
  log('8 · the setting is changed to the file (the key stays): the cloud is started again')
  await cloud.stop()
  cloud = await startCloud({ port, logFile, env: { ...cloudEnv, NUXT_HOSTING_SHARED_DIRECTORY: 'file' } })
  check('the owner signs in to the restarted cloud', (await api.post('/api/auth/login', { email: owner.email, password: owner.password })).status === 200)
  const pidBefore = (await templateProcesses()).map((p) => p.pid).join()
  const basicPidBefore = (await basicProcesses()).map((p) => p.pid).join()
  const refusedSwitch = await api.post(`/api/sites/${two.id}/invite`)
  const said = () => readFileSync(logFile, 'utf8')
  check('the running process still reads the table: the cloud does not stop it, it says what to do', refusedSwitch.status === 502 && pidBefore === String(pid) && /reads its site directory from the database, and NUXT_HOSTING_SHARED_DIRECTORY now says file\. Stop that process/.test(said()), `${refusedSwitch.status} ${refusedSwitch.text.slice(0, 200)}`)
  check('the sites are served meanwhile, by that process', (await page(service2)).status === 200 && (await page(serviceNew)).status === 200 && !existsSync(join(templateDir, 'sites.json')))
  check('the script stops the one app\'s process by its marker, and only that one: the Basic app\'s keeps running and serving', (await stopProcesses((p) => p.app === APP)).map((p) => p.pid).join() === String(pid) && !(await alive(pid)) && (await basicProcesses()).map((p) => p.pid).join() === basicPidBefore && (await page(serviceB)).status === 200)
  const switched = await api.post(`/api/sites/${two.id}/invite`)
  check('the cloud starts the one app\'s process again, now with the file', switched.status === 200 && (await templateProcesses()).length === 1 && (await templateProcesses())[0].pid !== pid && appFile().port === sitePort, `${switched.status} ${switched.text.slice(0, 200)}`)
  const fileText = readFileSync(join(templateDir, 'sites.json'), 'utf8')
  const fileRows = JSON.parse(fileText).sites
  check('the file holds the rows of every site of the one app, written again from what the cloud keeps, readable by its owner only', fileRows.map((r) => r.id).sort().join() === [two.id, fresh.id].sort().join() && mode(join(templateDir, 'sites.json')) === '600', fileRows.map((r) => r.id).join())
  const fileSecrets = fileRows.flatMap((r) => secretsOf(openRow(r)))
  check('with the key set the file holds no password and no secret in plain text either', fileRows.every((r) => [r.databaseUrl, r.secret, r.config.auth.setupToken, r.config.status.token, r.config.auth.account.clientSecret].every((v) => String(v).startsWith('enc:v1:'))) && fileSecrets.length === 10 && !fileSecrets.some((x) => fileText.includes(x)) && !/postgres(ql)?:\/\//.test(fileText))
  const environment8 = (await run('ps', ['eww', '-o', 'command=', '-p', String(appFile().pid)])).stdout
  check('the new process is told the file and the key, no database of a directory, and no secret of a site', environment8.includes(`NUXT_CMS_TENANCY_FILE=${join(templateDir, 'sites.json')}`) && environment8.includes(`NUXT_CMS_TENANCY_KEY=${KEY}`) && !environment8.includes('NUXT_CMS_TENANCY_DATABASE_URL') && !fileSecrets.some((x) => environment8.includes(x)), 'ps did not show what was expected')
  check('both sites answer from it with their content, and a session from before still counts', (await page(service2)).text.includes('Foto Zápisník') && (await new Http(serviceNew).get('/api/content/category')).text.includes(onlyNew.slug) && (await editorNew.get('/api/cms/_auth/me')).body?.user?.email === editor.email)
  check('the Basic site\'s row stays in the table (its app still reads it there): the file holds nothing of it', !fileRows.some((r) => r.id === bas.id) && (await tableRows())[bas.id]?.template === 'basic' && !('model' in (await tableRows())[bas.id].row) && (await page(serviceB)).text.includes('Pekárna U Mostu'))

  // ── 7 · closing a Postgres server to the sites' users ──
  if (!CLOSE_URL) {
    log('7 · postgres:close — LEFT OUT: no server of its own was named (E2E_OPS_CLOSE_URL)')
    measures.closeSkipped = true
    return
  }
  log(`7 · postgres:close, on the Postgres at ${new URL(CLOSE_URL).host} (a server of this run's own)`)
  const close = (text, params) => query(CLOSE_URL, text, params)
  const pass = 'heslo-webu-na-zkousku'
  for (const name of ['tzclose_site', 'tzclose_other']) await close(`drop database if exists ${name} with (force)`)
  for (const name of ['tzclose_site', 'tzclose_owner']) await close(`drop role if exists ${name}`)
  // The server is this run's own: it is put as a new server is (every role may connect everywhere), so the run can be repeated on it.
  for (const { name } of await close('select datname as name from pg_database')) await close(`grant connect on database "${name.replace(/"/g, '""')}" to public`)
  // A site's database and user, made the way the shared driver makes them; and somebody else's database.
  await close(`create role tzclose_site login password '${pass}' nosuperuser nocreatedb nocreaterole`)
  await close('create database tzclose_site owner tzclose_site')
  await close('revoke connect on database tzclose_site from public')
  await close(`create role tzclose_owner login password '${pass}' nosuperuser nocreatedb nocreaterole`)
  await close('create database tzclose_other owner tzclose_owner')
  const asSite = (database) => asUser(CLOSE_URL, 'tzclose_site', pass, database)
  const elsewhere = ['postgres', 'template1', 'tzclose_other']
  const beforeClose = await Promise.all(elsewhere.map((name) => refusal(asSite(name))))
  check('before: a site\'s own database user can connect to postgres, template1 and somebody else\'s database', beforeClose.every((code) => code === 'allowed'), beforeClose.join(' '))
  const script = join(cloudDir, 'scripts', 'postgres-close.mjs')
  const unnamed = await run(process.execPath, [script], { env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' } }).then(() => ({ code: 0, out: '' }), (err) => ({ code: err.code, out: `${err.stdout}${err.stderr}` }))
  check('the script does nothing without a server named on purpose', unnamed.code === 2 && unnamed.out.includes('Nothing was changed'), `${unnamed.code} ${unnamed.out.slice(0, 200)}`)
  const dry = await run(process.execPath, [script, '--url', CLOSE_URL])
  note(dry.stdout.trim().split('\n').join('\n     '))
  check('without --yes it lists every database and what it would run, and changes nothing', dry.stdout.includes('REVOKE CONNECT ON DATABASE "postgres" FROM PUBLIC') && dry.stdout.includes('"template1"') && dry.stdout.includes('"tzclose_other"') && dry.stdout.includes('Nothing was changed') && (await Promise.all(elsewhere.map((name) => refusal(asSite(name))))).every((code) => code === 'allowed'))
  const done = await run(process.execPath, [script, '--url', CLOSE_URL, '--yes'])
  note(done.stdout.trim().split('\n').join('\n     '))
  check('with --yes it closes every database of the server and says which', ['postgres', 'template0', 'template1', 'tzclose_other'].every((name) => done.stdout.includes(`closed  ${name}`)) && done.stdout.includes('Open to every role now: none'), done.stdout.slice(-400))
  const afterClose = await Promise.all(elsewhere.map((name) => refusal(asSite(name))))
  check('after: the site\'s user is refused on postgres, on template1 and on the other database (42501)', afterClose.every((code) => code === '42501'), afterClose.join(' '))
  check('it still opens its own database', (await query(asSite('tzclose_site'), 'select current_user as u, current_database() as d'))[0].d === 'tzclose_site')
  check('the owner of the other database still opens it, and is refused on the site\'s', (await query(asUser(CLOSE_URL, 'tzclose_owner', pass, 'tzclose_other'), 'select current_user as u'))[0].u === 'tzclose_owner' && await refusal(asUser(CLOSE_URL, 'tzclose_owner', pass, 'tzclose_site')) === '42501')
  const superuser = await Promise.all(['postgres', 'template1', 'tzclose_other', 'tzclose_site'].map((name) => refusal(onDatabase(CLOSE_URL, name))))
  check('a superuser still opens every one of them', superuser.every((code) => code === 'allowed'), superuser.join(' '))
  const once = await run(process.execPath, [script, '--url', CLOSE_URL, '--yes'])
  check('run again it finds nothing to do', once.stdout.includes('Every database is closed already'))
  for (const name of ['tzclose_site', 'tzclose_other']) await close(`drop database if exists ${name} with (force)`)
  for (const name of ['tzclose_site', 'tzclose_owner']) await close(`drop role if exists ${name}`)
}

let failed = null
try {
  await main()
}
catch (err) {
  failed = err
  console.error('\n' + (err?.stack ?? err))
}
finally {
  const missed = results.filter((r) => !r.ok)
  if (!failed && missed.length) failed = new Error(`failed: ${missed.map((r) => r.name).join('; ')}`)
  if (failed && existsSync(join(templateDir, 'server.log'))) console.error('--- last lines of the one app process\'s log ---\n' + templateLog().split('\n').slice(-25).join('\n'))
  if (failed && existsSync(join(singleDir, 'server.log'))) console.error('--- last lines of the moved-out site\'s process log ---\n' + readFileSync(join(singleDir, 'server.log'), 'utf8').split('\n').slice(-15).join('\n'))
  await cloud?.stop().catch(() => {})
  if (keep) {
    const procs = await ownProcesses().catch(() => [])
    log(`kept: ${procs.map((p) => `pid ${p.pid}`).join(', ') || 'no process'}, the databases ${PREFIX}_… and ${DB}, and ${dataDir}`)
  }
  else {
    const cleaned = await cleanUp().catch((e) => { console.error('cleanup:', e.message); return null })
    if (cleaned) log(`cleaned up: stopped ${cleaned.processes.length} process(es) (${cleaned.processes.join(', ') || 'none'}), dropped ${DB}, ${cleaned.databases} other database(s) and ${cleaned.roles} user(s), removed ${dataDir}`)
  }
  const seconds = Math.round((Date.now() - startedAt) / 1000)
  const summary = { at: new Date().toISOString(), ok: !failed, checks: results.length, seconds, failedAt: failed ? String(failed.message) : null, measures, results }
  writeFileSync(join(preview, 'e2e-ops-result.json'), JSON.stringify(summary, null, 2))
  log(failed ? `FAILED: ${missed.length} of ${results.length} checks, ${seconds} s${missed.length ? ` (${missed.map((r) => r.name).join('; ')})` : ''}` : `all ${results.length} checks passed in ${seconds} s${measures.closeSkipped ? ' (postgres:close was left out: no server named)' : ''}`)
  if (measures.pauseMs != null) log(`a change of the table reached the process in ${measures.pauseMs} ms (pause) and ${measures.removeMs} ms (removal)`)
  if (failed && existsSync(logFile)) console.error('--- last lines of the cloud app log ---\n' + readFileSync(logFile, 'utf8').split('\n').slice(-30).join('\n'))
}
process.exit(failed ? 1 : 0)
