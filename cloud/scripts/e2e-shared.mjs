// The shared hosting driver for real, locally: websites of two different templates (Photographer
// and Wedding) served by ONE process of the one app, a Basic website served by the process of its
// own app, each site with a database and a database user of its own.
//
//   pnpm --filter tinyzoo-cloud e2e:shared     # needs both apps built: pnpm --filter tinyzoo-cloud templates:build
//
// It starts a cloud app of its own with NUXT_HOSTING_DRIVER=shared (database tz_cloud_mt_e2e,
// data under .data/mt-e2e, app ports 4500–4519, site databases and users tzmt_e2e_…, the
// cloud on 3290 or the next free port, its own build folder), so neither the developer's data
// nor a run of scripts/e2e.mjs is touched, and removes everything it made at the end
// (--keep leaves the sites and their processes). The names and ports can be set from the
// environment: E2E_SHARED_DB, E2E_SHARED_SITE_PREFIX, E2E_SHARED_PORT, E2E_SHARED_SITE_PORTS
// ("4500-4519"), E2E_SHARED_DATA (the folder's name under .data); the Postgres server from
// CLOUD_PG_URL. Unless those are set, CLOUD_RUN_TAG and CLOUD_PORT_SHIFT give the run names
// and ports of its own, as for scripts/e2e.mjs (lib.mjs `runDb`, `runSitePrefix`, `runPort`),
// so a second checkout can run it beside the first.
//
// Everything goes through the sign-up app's real API and the sites' own addresses; no browser.
// What it proves: sites of two templates come from one process (the one app's, same port and
// pid), and a Basic website from another (the Basic app's); each site has its own database and
// database user, refused everywhere else, migrated with the migrations of its own template's
// model; each shows its own name, design, look and content, and a collection or a route of one
// template does not exist on a site of the other; a session, a file and an entry of one site do
// not exist on another; a Photographer site without an own colour carries its preset exactly,
// with one its owner saved it carries `data-own` and the palette `looks.resolve` gives (and the
// same look stylesheet), a value that is not `#rrggbb` is refused, and clearing it brings the
// preset back; an unknown host gets nothing; deleting one site removes its row, database, user
// and folder while the others keep answering from the same process. It prints
// the process's memory with three sites. Then what the cloud does when things go wrong: the
// app's process is gone (it is started again on the same port), a step fails ("Try again" goes
// on, keeping the database of the first try), the site directory or app.json is lost (written
// again from what the cloud keeps, for every site of the app).
//
// With CLOUD_CUSTOM_TYPES=on (experimental) it also checks a content type of a site's own: the
// owner of a Photographer site makes one with a page and three fields through the admin API, adds
// two entries and an Entries block on the home page; the home page, the entry's page and the
// sitemap show them; the Wedding site in the same process has no route, no table and the same
// home page; a field the block shows cannot be removed. Without the setting that part is skipped
// and nothing else changes.
import { execFile } from 'node:child_process'
import net from 'node:net'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import pg from 'pg'
import { presetStyle } from '../../templates/kit/looks.ts'
import { alive, appEntries, arg, cloudDir, dbUrl, freePortFrom, log, looksOf, repoRoot, runDb, runPort, runSitePrefix, sleep, startCloud, waitFor, withPg } from './lib.mjs'

const run = promisify(execFile)
const keep = arg('keep', false) === true
// CLOUD_CUSTOM_TYPES=on (as the cloud reads it): the cloud app of the run gets it from this environment, and section 3c runs.
const CUSTOM_TYPES = String(process.env.CLOUD_CUSTOM_TYPES ?? '').trim() === 'on'
const DB = process.env.E2E_SHARED_DB || runDb('tz_cloud_mt_e2e')
const PREFIX = process.env.E2E_SHARED_SITE_PREFIX || runSitePrefix('tzmt_e2e')
const [portFrom, portTo] = (process.env.E2E_SHARED_SITE_PORTS || `${runPort(4500)}-${runPort(4519)}`).split('-').map(Number)
const PORTS = { from: portFrom, to: portTo }
const APP_PORT = Number(process.env.E2E_SHARED_PORT) || runPort(3290)
const dataDir = join(cloudDir, '.data', process.env.E2E_SHARED_DATA || runDb('mt-e2e'))
// The database is dropped at the end, so only one that is this script's own: named …_e2e, or …_e2e_<run tag>.
if (!/^[a-z][a-z0-9_]*_e2e(_[a-z0-9]+)?$/.test(DB)) { console.error(`E2E_SHARED_DB must be a database of this script's own, named …_e2e (it is dropped): ${DB}`); process.exit(2) }
if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(PREFIX)) { console.error(`E2E_SHARED_SITE_PREFIX is not a usable prefix: ${PREFIX}`); process.exit(2) }
if (!Number.isInteger(PORTS.from) || !Number.isInteger(PORTS.to) || PORTS.to < PORTS.from) { console.error('E2E_SHARED_SITE_PORTS must be "from-to"'); process.exit(2) }
// One folder per app (`<data>/<app id>/`): the one app's holds the Photographer and Wedding sites, the Basic app's the Basic site.
const appDir = (id) => join(dataDir, id)
const templateDir = appDir('templates')
const basicDir = appDir('basic')
const preview = join(cloudDir, '.preview')
const logFile = join(preview, 'e2e-shared-cloud.log')
const stamp = Date.now().toString(36).slice(-5)
const startedAt = Date.now()
const results = []
const measures = {}

/** `go`: a failure is counted and the run goes on (for the one check that looks back at the end). */
function check(name, ok, detail = '', { go = false } = {}) {
  results.push({ name, ok: !!ok, detail: ok ? '' : String(detail) })
  log(ok ? '  ✓' : '  ✗', name, detail && !ok ? `— ${detail}` : '')
  if (!ok && !go) throw new Error(`failed: ${name}${detail ? ` (${detail})` : ''}`)
}

for (const id of ['templates', 'basic']) {
  if (!existsSync(appEntries[id])) {
    console.error(`The app "${id}" is not built (${appEntries[id]}).\nRun: pnpm --filter tinyzoo-cloud templates:build`)
    process.exit(2)
  }
}

// ── a small client that keeps its cookies (the cloud's API, a site's admin API) ──

class Http {
  constructor(base) { this.base = base.replace(/\/+$/, ''); this.cookies = new Map() }
  get cookie() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
  /** `cookie`: send this one instead of the client's own (another site's session, say). */
  async request(method, path, { json, form, cookie } = {}) {
    const headers = { accept: 'application/json', origin: this.base }
    const sent = cookie ?? this.cookie
    if (sent) headers.cookie = sent
    let body
    if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json) }
    if (form) body = form
    const res = await fetch(this.base + path, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(60_000) })
    if (cookie === undefined) for (const c of res.headers.getSetCookie()) { const [pair] = c.split(';'); const at = pair.indexOf('='); this.cookies.set(pair.slice(0, at), pair.slice(at + 1)) }
    const text = await res.text()
    let parsed = null
    try { parsed = text ? JSON.parse(text) : null } catch { /* not JSON */ }
    return { status: res.status, body: parsed, text }
  }
  get(path, opts) { return this.request('GET', path, opts) }
  post(path, json, opts) { return this.request('POST', path, { json, ...opts }) }
}

// ── Postgres: only what this run made (the cloud's database, <prefix>_<site id>) ──

/** The cloud's own database of this run, and no other. */
const dropDatabase = (name) => {
  if (name !== DB) throw new Error(`refusing to touch database ${name}`)
  return withPg((c) => c.query(`drop database if exists "${DB}" with (force)`))
}
async function recreateDatabase(name) {
  await dropDatabase(name)
  await withPg((c) => c.query(`create database "${DB}"`))
}

const OWN_NAME = new RegExp(`^${PREFIX}_[0-9a-f]{8}(_[0-9a-f]{4}){3}_[0-9a-f]{12}$`)
const own = (name) => {
  if (!OWN_NAME.test(name)) throw new Error(`refusing to touch ${name}`)
  return `"${name}"`
}
const like = `${PREFIX.replace(/_/g, '\\_')}\\_%`
const siteDatabases = () => withPg(async (c) => (await c.query('select datname as name from pg_database where datname like $1 order by 1', [like])).rows.map((r) => r.name).filter((n) => OWN_NAME.test(n)))
const siteRoles = () => withPg(async (c) => (await c.query('select rolname as name from pg_roles where rolname like $1 order by 1', [like])).rows.map((r) => r.name).filter((n) => OWN_NAME.test(n)))

/** Drop the databases first, then the users that owned them. */
async function dropSiteDatabasesAndRoles() {
  const databases = await siteDatabases()
  const roles = await siteRoles()
  await withPg(async (c) => {
    for (const name of databases) await c.query(`drop database if exists ${own(name)} with (force)`)
    for (const name of roles) await c.query(`drop role if exists ${own(name)}`)
  })
  return { databases: databases.length, roles: roles.length }
}

/** Run one query over a connection of its own; resolves to its rows, or throws what Postgres said. */
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

/** `url` with another database: the same user and password asking for somebody else's data. */
const onDatabase = (url, name) => { const u = new URL(url); u.pathname = `/${name}`; return u.toString() }

// ── the processes of this run's data folder ──

/** The app processes started under `dataDir`: recognised by the `--app-dir=<folder>` argument the shared driver gives them. */
async function appProcesses() {
  const { stdout } = await run('ps', ['-axo', 'pid=,rss=,command='])
  const marker = `--app-dir=${resolve(dataDir)}/`
  return stdout.split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .filter((m) => m[3].split(/\s+/).some((word) => word.startsWith(marker)))
    .map((m) => ({ pid: Number(m[1]), rssBytes: Number(m[2]) * 1024, app: m[3].split(marker)[1].split(/\s/)[0], command: m[3] }))
}
/** The one app's processes (the Photographer and Wedding sites) and the Basic app's. */
const templateProcesses = async () => (await appProcesses()).filter((p) => p.app === 'templates')
const basicProcesses = async () => (await appProcesses()).filter((p) => p.app === 'basic')

/** Stop them: only pids whose command line names a folder under this run's data folder, asked first, then insisted on. `which` picks the apps. */
async function stopAppProcesses(which = () => true) {
  const procs = (await appProcesses()).filter(which)
  for (const p of procs) { try { process.kill(p.pid, 'SIGTERM') } catch { /* gone */ } }
  for (let i = 0; i < 40; i++) {
    if (!(await Promise.all(procs.map((p) => alive(p.pid)))).some(Boolean)) break
    await sleep(250)
  }
  // Still there after ten seconds: looked up again (the pid must still carry the marker), then killed.
  for (const p of (await appProcesses()).filter(which)) {
    if (procs.some((was) => was.pid === p.pid)) { try { process.kill(p.pid, 'SIGKILL') } catch { /* gone */ } }
  }
  return procs
}
const stopTemplateProcesses = () => stopAppProcesses((p) => p.app === 'templates')

async function listeners(port) {
  try {
    const { stdout } = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    return [...new Set(stdout.split('\n').map((l) => Number(l.trim())).filter((n) => Number.isInteger(n) && n > 1))]
  }
  catch { return [] }
}

/** Remove everything a run made: its app processes, its site databases and users, its folder. */
async function cleanUp() {
  const stopped = await stopAppProcesses()
  const dropped = await dropSiteDatabasesAndRoles()
  if (existsSync(dataDir) && resolve(dataDir).startsWith(join(cloudDir, '.data') + '/')) rmSync(dataDir, { recursive: true, force: true })
  return { processes: stopped.map((p) => p.pid), ...dropped }
}

// ── files ──

/** Every file under a folder, as paths from it. */
function filesUnder(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath ?? e.path, e.name))
}
const mode = (file) => (statSync(file).mode & 0o777).toString(8)
const directory = (dir = templateDir) => JSON.parse(readFileSync(join(dir, 'sites.json'), 'utf8')).sites
const appFile = (dir = templateDir) => JSON.parse(readFileSync(join(dir, 'app.json'), 'utf8'))
const byId = (list) => JSON.stringify([...list].sort((a, b) => a.id.localeCompare(b.id)))

// A 1 × 1 PNG, and a few bytes after its end so every run uploads another file.
const PNG = Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'), Buffer.from(`e2e-shared-${stamp}`)])

const ready = async (url) => {
  try {
    const res = await fetch(`${url}/api/health/ready`, { signal: AbortSignal.timeout(4000), redirect: 'manual' })
    return res.status === 200 ? await res.json() : null
  }
  catch { return null }
}
const page = async (url, path = '/') => {
  const res = await fetch(url + path, { signal: AbortSignal.timeout(30_000), redirect: 'manual', headers: { accept: 'text/html' } })
  return { status: res.status, text: await res.text() }
}

let cloud = null
mkdirSync(preview, { recursive: true })

async function main() {
  log('preparing: nothing of an earlier run is left, a clean database for the cloud')
  const left = await cleanUp()
  if (left.processes.length || left.databases || left.roles) log(`    removed what an earlier run left: ${left.processes.length} process(es), ${left.databases} database(s), ${left.roles} user(s)`)
  await recreateDatabase(DB)
  rmSync(logFile, { force: true })
  const port = await freePortFrom(APP_PORT)
  cloud = await startCloud({
    port, logFile,
    env: {
      NUXT_DATABASE_URL: dbUrl(DB),
      NUXT_HOSTING_DRIVER: 'shared',
      NUXT_HOSTING_SHARED_DATA_DIR: dataDir,
      NUXT_HOSTING_SHARED_DATABASE_PREFIX: PREFIX,
      NUXT_HOSTING_SHARED_PORT_FROM: String(PORTS.from),
      NUXT_HOSTING_SHARED_PORT_TO: String(PORTS.to),
      NUXT_MAX_SITES_PER_USER: '6',
      NUXT_REQUIRE_VERIFIED_EMAIL: 'false',
      NUXT_MAIL_TRANSPORT: 'log',
      // A build folder of its own: scripts/e2e.mjs may run beside this one.
      CLOUD_BUILD_DIR: '.nuxt-scripts-shared',
    },
  })
  // Nuxt moves to another port by itself when its own is taken in the moment between the check and the start
  // (another script of a second run); the answer on `port` would then be somebody else's cloud.
  if (!readFileSync(logFile, 'utf8').includes(`Local:    http://localhost:${port}/`)) throw new Error(`the cloud app did not start on port ${port} (it was taken a moment before): ${logFile}`)
  log(`cloud app up at ${cloud.url} (shared driver)`)

  // ── one account; two Photographer sites, a Wedding site and a Basic site made at the same moment ──
  log('0 · one account; two Photographer sites, a Wedding site and a Basic site at the same moment')
  const api = new Http(cloud.url)
  const owner = { name: 'Johana Loudová', email: `johana-${stamp}@example.com`, password: 'dlouhe-heslo-johany-1' }
  check('an account is made', (await api.post('/api/auth/signup', owner)).status === 201)
  const wanted = [
    { name: 'Ateliér Světlo', slug: `mt-svetlo-${stamp}`, template: 'photographer', look: 'negativ' },
    { name: 'Foto Zápisník', slug: `mt-zapisnik-${stamp}`, template: 'photographer', look: 'zapisnik' },
    { name: 'Kristýna a Matěj', slug: `mt-svatba-${stamp}`, template: 'wedding', look: 'vecer' },
    { name: 'Pekárna U Mostu', slug: `mt-pekarna-${stamp}`, template: 'basic' },
  ]
  const t0 = Date.now()
  const made = await Promise.all(wanted.map((w) => api.post('/api/sites', w)))
  check('all four sites are accepted', made.every((r) => r.status === 201), made.map((r) => `${r.status} ${r.text.slice(0, 200)}`).join(' | '))
  const ids = made.map((r) => r.body.site.id)
  const sites = await waitFor(async () => {
    const now = await Promise.all(ids.map(async (id) => (await api.get(`/api/sites/${id}?runtime=1`)).body))
    const failed = now.find((s) => s?.site.status === 'failed')
    if (failed) throw new Error(`a site failed: ${JSON.stringify(failed.site.steps)} ${failed.site.errorDetail ?? ''}`)
    return now.every((s) => s?.site.status === 'ready') ? now : null
  }, { timeout: 300_000, every: 500, what: 'all four sites to be ready' })
  const [one, two, wed, bas] = sites.map((s) => s.site)
  const tookMs = (site) => Object.fromEntries(site.steps.map((s) => [s.id, Date.parse(s.finishedAt) - Date.parse(s.startedAt)]))
  measures.creation = [one, two, wed, bas].map((s) => ({ site: s.slug, serverMs: Date.parse(s.readyAt) - Date.parse(s.createdAt), steps: tookMs(s) }))
  check('all four sites are ready', true)
  for (const c of measures.creation) log(`    ${c.site} made in ${c.serverMs} ms (${JSON.stringify(c.steps)}); all ready ${Date.now() - t0} ms after they were asked for`)
  check('each has the look chosen for it', one.look === 'negativ' && two.look === 'zapisnik' && wed.look === 'vecer', `${one.look} ${two.look} ${wed.look}`)

  // ── 1 · one process per app ──
  log('1 · the Photographer and Wedding sites are served by one process, the Basic site by another')
  const [u1, u2, uw] = [new URL(one.publicUrl), new URL(two.publicUrl), new URL(wed.publicUrl)]
  const sitePort = Number(u1.port)
  check('each address is <slug>.localhost on its app\'s port', u1.hostname === `${one.slug}.localhost` && u2.hostname === `${two.slug}.localhost` && uw.hostname === `${wed.slug}.localhost` && new URL(bas.publicUrl).hostname === `${bas.slug}.localhost`, `${one.publicUrl} ${two.publicUrl} ${wed.publicUrl} ${bas.publicUrl}`)
  check('the three sites of two templates share one port, from the shared range', u1.port === u2.port && u1.port === uw.port && sitePort >= PORTS.from && sitePort <= PORTS.to, `${u1.port} ${u2.port} ${uw.port}`)
  const listening = await listeners(sitePort)
  const app = appFile()
  check('one process listens on that port, the one app.json names', listening.length === 1 && listening[0] === app.pid && app.port === sitePort, `listening ${listening.join(',')}; app.json ${app.pid}:${app.port}`)
  const procs = await templateProcesses()
  check('exactly one process carries the marker of app "templates", the one that listens', procs.length === 1 && procs[0].pid === app.pid && procs[0].app === 'templates', JSON.stringify(procs.map((p) => [p.pid, p.app])))
  const pid = app.pid
  check('the process runs the one app\'s build', procs[0].command.includes(appEntries.templates), procs[0].command)
  check('the Photographer sites and the Wedding site all answer ready from it, each with its database migrated', (await Promise.all([one, two, wed].map((s) => ready(s.publicUrl)))).every((r) => r?.ok === true && r.migrations === 'done'))
  check('the cloud reports them as running, with the memory of the one process', [sites[0], sites[1], sites[2]].every((s) => s.runtime?.running === true && s.runtime.memoryBytes > 0), JSON.stringify(sites.map((s) => s.runtime)))
  check('the site directory and app.json are readable by their owner only', mode(join(templateDir, 'sites.json')) === '600' && mode(join(templateDir, 'app.json')) === '600', `${mode(join(templateDir, 'sites.json'))} ${mode(join(templateDir, 'app.json'))}`)
  check('the data folder of the one app is <data>/templates, with a folder per site', existsSync(join(templateDir, 'sites', one.id)) && existsSync(join(templateDir, 'sites', two.id)) && existsSync(join(templateDir, 'sites', wed.id)) && !existsSync(join(dataDir, 'photographer')) && !existsSync(join(dataDir, 'wedding')), readdirSync(dataDir).join(' '))

  // The Basic website is another app: another process, port, folder and marker.
  const basicApp = appFile(basicDir)
  const basicPort = Number(new URL(bas.publicUrl).port)
  const basicProcs = await basicProcesses()
  check('the Basic site is served by another process: another port and another pid, its own marker', basicProcs.length === 1 && basicProcs[0].pid === basicApp.pid && basicApp.pid !== pid && basicApp.port === basicPort && basicPort !== sitePort && basicPort >= PORTS.from && basicPort <= PORTS.to && (await listeners(basicPort)).join() === String(basicApp.pid), `basic ${basicApp.pid}:${basicApp.port}; templates ${pid}:${sitePort}; ${JSON.stringify(basicProcs.map((p) => p.pid))}`)
  check('that process runs the Basic app\'s build, from the folder <data>/basic', basicProcs[0].command.includes(appEntries.basic) && basicProcs[0].command.includes(`--app-dir=${resolve(basicDir)}`) && existsSync(join(basicDir, 'sites', bas.id)) && existsSync(join(basicDir, 'sites.json')), basicProcs[0].command)
  check('in all there are two app processes of this run', (await appProcesses()).length === 2)
  check('the Basic site answers from its own process, with its name, and is ready', (await ready(bas.publicUrl))?.migrations === 'done' && (await page(bas.publicUrl)).text.includes('Pekárna U Mostu'))
  check('a site of the other app is unknown to it: the Photographer site\'s host on the Basic port gets 404, and the Basic site\'s host on the one app\'s port too',
    (await page(`http://${one.slug}.localhost:${basicPort}`)).status === 404 && (await page(`http://${bas.slug}.localhost:${sitePort}`)).status === 404)
  check('the Basic app\'s directory holds the Basic site\'s row, and nothing else', JSON.stringify(directory(basicDir).map((r) => r.id)) === JSON.stringify([bas.id]), JSON.stringify(directory(basicDir).map((r) => r.id)))

  // ── 2 · a database and a database user per site ──
  log('2 · each site has its own database and its own database user')
  const rows = directory()
  const row1 = rows.find((r) => r.id === one.id), row2 = rows.find((r) => r.id === two.id), rowW = rows.find((r) => r.id === wed.id)
  const rowB = directory(basicDir).find((r) => r.id === bas.id)
  check('the one app\'s directory holds a row for each of its three sites, and nothing else', rows.length === 3 && !!row1 && !!row2 && !!rowW, JSON.stringify(rows.map((r) => r.id)))
  check('the rows of the kit\'s sites carry their template as `model`; the Basic site\'s row has none', row1.model === 'photographer' && row2.model === 'photographer' && rowW.model === 'wedding' && !!rowB && !('model' in rowB), JSON.stringify([row1.model, row2.model, rowW.model, rowB?.model]))
  const [d1, d2, dW, dB] = [row1, row2, rowW, rowB].map((r) => new URL(r.databaseUrl))
  const [db1, db2, dbW, dbB] = [d1, d2, dW, dB].map((u) => u.pathname.slice(1))
  const urls = [row1.databaseUrl, row2.databaseUrl, rowW.databaseUrl, rowB.databaseUrl]
  const dbs = [db1, db2, dbW, dbB]
  check('the four database addresses differ in database, user and password', new Set(dbs).size === 4 && new Set([d1, d2, dW, dB].map((u) => u.username)).size === 4 && new Set([d1, d2, dW, dB].map((u) => u.password)).size === 4)
  const nameOf = (id) => `${PREFIX}_${id.replace(/-/g, '_')}`
  check('database and user are named by the site\'s id, never by its address', db1 === nameOf(one.id) && d1.username === db1 && db2 === nameOf(two.id) && d2.username === db2 && dbW === nameOf(wed.id) && dW.username === dbW && dbB === nameOf(bas.id) && dB.username === dbB && !dbs.some((n) => ['svetlo', 'zapisnik', 'svatba', 'pekarna'].some((w) => n.includes(w))), dbs.join(' '))
  const facts = await withPg(async (c) => (await c.query(
    `select d.datname as name, r.rolname as owner, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolcanlogin, has_database_privilege('public', d.datname, 'connect') as open
       from pg_database d join pg_roles r on r.oid = d.datdba where d.datname = any($1) order by 1`, [dbs])).rows)
  check('each database is owned by its site\'s user, a plain login, and closed to everybody else',
    facts.length === 4 && facts.every((f) => f.owner === f.name && f.rolcanlogin && !f.rolsuper && !f.rolcreatedb && !f.rolcreaterole && f.open === false), JSON.stringify(facts))
  const whos = await Promise.all(urls.map((u) => query(u, 'select current_user as u, current_database() as d, (select count(*)::int from cms_users) as people')))
  check('each user can read its own database', whos.every((w, i) => w[0].u === dbs[i] && w[0].d === dbs[i] && w[0].people >= 2), JSON.stringify(whos))
  const tablesOf = async (url) => (await query(url, 'select tablename as name, tableowner = current_user as mine from pg_tables where schemaname = \'public\' order by 1'))
  const [t1, tW] = [await tablesOf(row1.databaseUrl), await tablesOf(rowW.databaseUrl)]
  check('the one app migrated each database, as the site\'s user', t1.length > 10 && t1.every((t) => t.mine) && tW.length > 10 && tW.every((t) => t.mine), JSON.stringify([t1.length, tW.length]))

  // Each database holds the tables of its OWN template's model (what that template's migrations make), and not the other's.
  const modelFiles = (id) => {
    const folder = join(repoRoot, 'templates', id, 'server', 'db', 'migrations')
    const tags = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')).entries.map((e) => e.tag)
    const sql = tags.map((tag) => readFileSync(join(folder, `${tag}.sql`), 'utf8'))
    // drizzle's own bookkeeping: the hash of each migration's text, in order (`drizzle.__drizzle_migrations`).
    return { hashes: sql.map((text) => createHash('sha256').update(text).digest('hex')), tables: new Set(sql.flatMap((text) => [...text.matchAll(/CREATE TABLE "([a-z_0-9]+)"/g)].map((m) => m[1]))) }
  }
  const [modelP, modelW] = [modelFiles('photographer'), modelFiles('wedding')]
  const onlyP = [...modelP.tables].filter((t) => !modelW.tables.has(t)), onlyW = [...modelW.tables].filter((t) => !modelP.tables.has(t))
  check('the two models really differ: Photographer has albums and Wedding has gifts', onlyP.includes('album') && onlyW.includes('gift') && onlyP.length >= 3 && onlyW.length >= 3, JSON.stringify([onlyP, onlyW]))
  const names1 = t1.map((t) => t.name), namesW = tW.map((t) => t.name)
  check('a Photographer site\'s database has the tables of Photographer\'s model, and none of Wedding\'s', onlyP.every((t) => names1.includes(t)) && !onlyW.some((t) => names1.includes(t)) && [...modelP.tables].every((t) => names1.includes(t)), JSON.stringify(names1))
  check('a Wedding site\'s database has the tables of Wedding\'s model, and none of Photographer\'s', onlyW.every((t) => namesW.includes(t)) && !onlyP.some((t) => namesW.includes(t)) && [...modelW.tables].every((t) => namesW.includes(t)), JSON.stringify(namesW))
  const names2 = (await tablesOf(row2.databaseUrl)).map((t) => t.name)
  check('the second Photographer site has the same tables as the first (the same model)', JSON.stringify(names2) === JSON.stringify(names1))
  const namesB = (await tablesOf(rowB.databaseUrl)).map((t) => t.name)
  check('the Basic site\'s database has neither Photographer\'s nor Wedding\'s own tables', namesB.length > 10 && !onlyP.some((t) => namesB.includes(t)) && !onlyW.some((t) => namesB.includes(t)), namesB.join(' '))
  const applied = async (url) => (await query(url, 'select hash from drizzle.__drizzle_migrations order by id')).map((r) => r.hash)
  const [mig1, mig2, migW] = [await applied(row1.databaseUrl), await applied(row2.databaseUrl), await applied(rowW.databaseUrl)]
  check('each database was migrated with its own model\'s migrations: Photographer\'s hashes on both Photographer sites, Wedding\'s on the Wedding site', JSON.stringify(mig1) === JSON.stringify(modelP.hashes) && JSON.stringify(mig2) === JSON.stringify(modelP.hashes) && JSON.stringify(migW) === JSON.stringify(modelW.hashes) && JSON.stringify(mig1) !== JSON.stringify(migW), JSON.stringify([mig1, mig2, migW].map((m) => m.map((h) => h.slice(0, 8)))))

  const crossed = []
  for (const [i, url] of urls.entries()) for (const [j, name] of dbs.entries()) if (i !== j) crossed.push(await refusal(onDatabase(url, name)))
  check('each of the four users is refused on each of the other three sites\' databases (12 pairs)', crossed.length === 12 && crossed.every((code) => code === '42501'), crossed.join(' '))
  const onCloud = await Promise.all(urls.map((u) => refusal(onDatabase(u, DB))))
  check('each user is refused on the cloud\'s own database', onCloud.every((code) => code === '42501'), onCloud.join(' '))
  const reach = [await refusal(row1.databaseUrl, `create database ${PREFIX}_x`), await refusal(row1.databaseUrl, `create role ${PREFIX}_x`)]
  check('a site\'s user can make neither a database nor a user', reach.every((code) => code === '42501'), reach.join(' '))
  const secrets = [row1, row2, rowW, rowB].flatMap((r) => [new URL(r.databaseUrl).password, r.secret, r.config.auth.setupToken, r.config.status.token])
  check('the directories hold every secret of the four sites', secrets.length === 16 && new Set(secrets).size === 16 && secrets.every((x) => typeof x === 'string' && x.length >= 24))
  const kept = (await query(dbUrl(DB), 'select driver_state::text as state from sites')).map((r) => r.state).join(' ')
  check('the cloud keeps the database password encrypted, not in plain text', kept.includes('"databasePassword": "v1.') && !secrets.some((x) => kept.includes(x)))
  const sent = JSON.stringify(sites) + JSON.stringify((await api.get('/api/sites')).body)
  check('no secret is sent to the owner\'s browser', !secrets.some((x) => sent.includes(x)) && !/databaseUrl|databasePassword|driverState/.test(sent))
  // The process's own environment (ps shows it for one's own processes): what is the same for every site, and no site's secret.
  const environment = (await run('ps', ['eww', '-o', 'command=', '-p', String(pid)])).stdout
  check('the process\'s environment and command line carry no secret of a site', environment.includes('NUXT_CMS_TENANCY_MODE=multi') && environment.includes(`NUXT_CMS_TENANCY_FILE=${join(templateDir, 'sites.json')}`) && !secrets.some((x) => environment.includes(x)) && !environment.includes('DATABASE_URL'), environment.includes('NUXT_CMS_TENANCY_MODE=multi') ? 'a secret is in it' : 'ps did not show the environment')
  // (With the directory in a file the process is not told its app: NUXT_CMS_TENANCY_TEMPLATE is for the table's rows, which e2e:ops looks at.)

  // ── 3 · its own name, look and content ──
  log('3 · each site shows its own name, look and content')
  const [home1, home2, homeW] = [await page(one.publicUrl), await page(two.publicUrl), await page(wed.publicUrl)]
  check('all three home pages answer', home1.status === 200 && home2.status === 200 && homeW.status === 200, `${home1.status} ${home2.status} ${homeW.status}`)
  check('each home page carries the name the wizard wrote, and not the others\'', home1.text.includes('Ateliér Světlo') && !home1.text.includes('Foto Zápisník') && !home1.text.includes('Kristýna') && home2.text.includes('Foto Zápisník') && !home2.text.includes('Ateliér Světlo') && homeW.text.includes('Kristýna') && !homeW.text.includes('Ateliér Světlo') && !homeW.text.includes('Foto Zápisník'))
  check('each is drawn in its own look', home1.text.includes('data-look="negativ"') && home2.text.includes('data-look="zapisnik"') && homeW.text.includes('data-look="vecer"'))
  // In the one app the design is on <html>: data-design is the site's template, whatever else the app carries.
  const htmlTag = (text) => /<html\b[^>]*>/.exec(text)?.[0] ?? ''
  check('each home page\'s <html> names the design of its own template', htmlTag(home1.text).includes('data-design="photographer"') && htmlTag(home2.text).includes('data-design="photographer"') && htmlTag(homeW.text).includes('data-design="wedding"') && !htmlTag(homeW.text).includes('data-design="photographer"') && !htmlTag(home1.text).includes('data-design="wedding"'), `${htmlTag(home1.text)} | ${htmlTag(homeW.text)}`)
  // The rule for telling a look's stylesheet from the main one: the kit links a look's file only on that look's pages (templates/kit/app/composables/useLookHead.ts),
  // after the main stylesheet. A built file is named <name>.<hash>.css; the main one is `entry.<hash>.css`, a look's is named by the look's id
  // (the ids of both templates' looks.ts). So: the stylesheets named by a look id of either template are the look's; exactly one, the site's own, comes after `entry`.
  const lookIds = new Set([...(await looksOf({ dir: 'templates/photographer' })).ids, ...(await looksOf({ dir: 'templates/wedding' })).ids])
  const sheets = (text) => [...text.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).filter((tag) => /\brel="stylesheet"/.test(tag)).map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1]).filter(Boolean).map((href) => ({ href, name: href.split('/').pop().split('.')[0] }))
  const looksOn = (text) => { const list = sheets(text); const main = list.findIndex((x) => x.name === 'entry'); return { main, looks: list.map((x, i) => ({ ...x, i })).filter((x) => lookIds.has(x.name)) } }
  const [lk1, lk2, lkW] = [home1, home2, homeW].map((h) => looksOn(h.text))
  check('each home page links exactly one look stylesheet, after the main one, the site\'s own look', lk1.main >= 0 && lk1.looks.length === 1 && lk1.looks[0].name === 'negativ' && lk1.looks[0].i > lk1.main && lk2.main >= 0 && lk2.looks.length === 1 && lk2.looks[0].name === 'zapisnik' && lk2.looks[0].i > lk2.main && lkW.main >= 0 && lkW.looks.length === 1 && lkW.looks[0].name === 'vecer' && lkW.looks[0].i > lkW.main, JSON.stringify([lk1, lk2, lkW]))
  const lookFiles = await Promise.all([[lk1, one], [lkW, wed]].map(async ([lk, s]) => fetch(new URL(lk.looks[0].href, s.publicUrl))))
  check('and each look\'s file is served, as CSS', lookFiles.every((r) => r.status === 200 && String(r.headers.get('content-type')).includes('text/css')), lookFiles.map((r) => `${r.status} ${r.headers.get('content-type')}`).join(' '))
  const [set1, set2, setW] = await Promise.all([one, two, wed].map(async (s) => (await new Http(s.publicUrl).get('/api/content/_global/siteSettings')).body?.item))
  check('each site\'s settings hold its own name and look', set1?.siteName === 'Ateliér Světlo' && set1.look === 'negativ' && set2?.siteName === 'Foto Zápisník' && set2.look === 'zapisnik' && setW?.siteName === 'Kristýna a Matěj' && setW.look === 'vecer', JSON.stringify([set1?.siteName, set1?.look, set2?.siteName, set2?.look, setW?.siteName, setW?.look]))
  const homeB = await page(bas.publicUrl)
  check('the Basic site draws its own page: its name, and no design of the one app on it', homeB.status === 200 && homeB.text.includes('Pekárna U Mostu') && !/data-design="/.test(htmlTag(homeB.text)), `${homeB.status} ${htmlTag(homeB.text)}`)

  // The owner goes into each admin through the invitation the cloud keeps for them.
  const enter = async (site, password) => {
    const client = new Http(site.publicUrl)
    const token = String(site.inviteUrl ?? '').split('/').pop()
    const res = await client.post('/api/cms/_auth/accept', { token, name: owner.name, password })
    if (res.status !== 200) throw new Error(`the invitation of ${site.slug} was not accepted: ${res.status} ${res.text.slice(0, 300)}`)
    return client
  }
  check('each invitation leads to its own site\'s admin', [one, two, wed].every((s) => String(s.inviteUrl).startsWith(`${s.publicUrl}/admin/invite/`)), `${one.inviteUrl} ${two.inviteUrl} ${wed.inviteUrl}`)
  const admin1 = await enter(one, 'heslo-do-administrace-1')
  const admin2 = await enter(two, 'heslo-do-administrace-2')
  const adminW = await enter(wed, 'heslo-do-administrace-3')
  const entry = { name: `Jen na prvním webu ${stamp}`, slug: `jen-na-prvnim-${stamp}` }
  const created = await admin1.post('/api/cms/category', entry)
  check('an entry is created in site 1\'s admin', created.status >= 200 && created.status < 300 && !!created.body?.row?.id, `${created.status} ${created.text.slice(0, 300)}`)
  const [list1, list2] = [await new Http(one.publicUrl).get('/api/content/category'), await new Http(two.publicUrl).get('/api/content/category')]
  check('it is in site 1\'s content API', list1.status === 200 && list1.text.includes(entry.slug), `${list1.status}`)
  check('it is not in site 2\'s content API', list2.status === 200 && !list2.text.includes(entry.slug) && list2.text.includes('"slug"'), `${list2.status}`)
  const inDb = async (row) => (await query(row.databaseUrl, 'select count(*)::int as n from category where slug = $1', [entry.slug]))[0].n
  check('it is in site 1\'s database and not in site 2\'s', await inDb(row1) === 1 && await inDb(row2) === 0)
  check('site 2\'s admin does not know it', (await admin2.get(`/api/cms/category/${created.body.row.id}`)).status === 404 && (await admin1.get(`/api/cms/category/${created.body.row.id}`)).status === 200)

  // ── 3b · a collection of one template does not exist on a site of the other ──
  // `album` is Photographer's and `gift` is Wedding's (cms.config.ts of each). The one app has both
  // models in it; a site answers only for its own.
  log('3 · a collection of one template is 404 on a site of the other; Wedding\'s gift route answers only on Wedding sites')
  const anon = (site) => new Http(site.publicUrl)
  const contentStatus = async (site, type) => (await anon(site).get(`/api/content/${type}`)).status
  check('Photographer\'s collection (album) answers on both Photographer sites and is 404 on the Wedding site', await contentStatus(one, 'album') === 200 && await contentStatus(two, 'album') === 200 && await contentStatus(wed, 'album') === 404, `${await contentStatus(one, 'album')} ${await contentStatus(wed, 'album')}`)
  check('Wedding\'s collection (gift) answers on the Wedding site and is 404 on both Photographer sites', await contentStatus(wed, 'gift') === 200 && await contentStatus(one, 'gift') === 404 && await contentStatus(two, 'gift') === 404, `${await contentStatus(wed, 'gift')} ${await contentStatus(one, 'gift')}`)
  const gifts = (await anon(wed).get('/api/content/gift')).body
  check('the Wedding site\'s gifts are its own demo content', JSON.stringify(gifts).includes('"id"') && (gifts?.items ?? gifts?.rows ?? []).length > 0, JSON.stringify(gifts)?.slice(0, 200))
  check('Photographer\'s other collections are 404 on the Wedding site too (pack, testimonial), and Wedding\'s (lodging, programItem) on a Photographer site', (await Promise.all(['pack', 'testimonial'].map((t) => contentStatus(wed, t)))).every((c) => c === 404) && (await Promise.all(['lodging', 'programItem'].map((t) => contentStatus(one, t)))).every((c) => c === 404))
  check('the admin route follows: Photographer\'s admin lists albums (200) and has no gift (404); Wedding\'s admin the other way round', (await admin1.get('/api/cms/album')).status === 200 && (await admin1.get('/api/cms/gift')).status === 404 && (await adminW.get('/api/cms/gift')).status === 200 && (await adminW.get('/api/cms/album')).status === 404, `${(await admin1.get('/api/cms/album')).status} ${(await admin1.get('/api/cms/gift')).status} ${(await adminW.get('/api/cms/gift')).status} ${(await adminW.get('/api/cms/album')).status}`)
  check('a collection\'s write is refused the same way: no gift can be made on a Photographer site, no album on the Wedding site', (await admin1.post('/api/cms/gift', { name: 'x' })).status === 404 && (await adminW.post('/api/cms/album', { name: 'x' })).status === 404)
  // POST /api/gift/<id>/reserve is a server route of the Wedding template (templates/wedding/server/api/gift/[id]/reserve.post.ts).
  const [gift] = await query(rowW.databaseUrl, 'select id from gift where "open" = false and reserved = false limit 1')
  check('the Wedding site has a gift that can be reserved', typeof gift?.id === 'string')
  const reserve = (site) => anon(site).post(`/api/gift/${gift.id}/reserve`, {})
  const onPhotographer = [await reserve(one), await reserve(two)]
  check('reserving that gift on a Photographer site answers 404: the route does not exist there', onPhotographer.every((r) => r.status === 404), onPhotographer.map((r) => `${r.status} ${r.text.slice(0, 80)}`).join(' | '))
  check('and it changed nothing on the Wedding site: the gift is still free', (await query(rowW.databaseUrl, 'select reserved from gift where id = $1', [gift.id]))[0].reserved === false)
  const onWedding = await reserve(wed)
  check('on the Wedding site the route answers (not 404): the gift is reserved', onWedding.status === 200 && onWedding.body?.reserved === true && (await query(rowW.databaseUrl, 'select reserved from gift where id = $1', [gift.id]))[0].reserved === true, `${onWedding.status} ${onWedding.text.slice(0, 120)}`)
  check('the same request with an id that is no gift is 404 there (the route is found, the gift is not)', (await anon(wed).post('/api/gift/00000000-0000-4000-8000-000000000000/reserve', {})).status === 404)
  check('and the Basic site has no such route either', (await anon(bas).post(`/api/gift/${gift.id}/reserve`, {})).status === 404)

  // ── 3c · a site's own content type (only with CLOUD_CUSTOM_TYPES=on) ──
  if (CUSTOM_TYPES) await customTypes({ one, wed, row1, rowW, rowB, admin1, adminW, home: homeW, pid, basicPid: basicApp.pid, htmlTag, looksOn })

  // ── 3d · the owner's own colour (Site settings, `ownColor`) ──
  // A site without one is drawn exactly as its preset says; with one, <html> carries `data-own` and the palette
  // `looks.resolve` gives, and the look's stylesheet is the same. The API refuses what is not `#rrggbb`.
  log('3 · the owner\'s own colour on a Photographer site: none, saved, refused when it is not #rrggbb, cleared')
  const photoLooks = await looksOf({ dir: 'templates/photographer' })
  const attrOf = (text, name) => {
    const raw = new RegExp(`\\s${name}="([^"]*)"`).exec(htmlTag(text))?.[1]
    return raw === undefined ? null : raw.replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  }
  const settingsOf = async () => (await new Http(one.publicUrl).get('/api/content/_global/siteSettings')).body?.item
  // The owner saves Site settings: the row is read and sent back whole, with the change (templates/app/scripts/sites.mjs `writableRow`).
  const saveSettings = async (change) => {
    const { body } = await admin1.get('/api/cms/_singleton/siteSettings')
    const row = {}
    for (const [key, value] of Object.entries(body?.row ?? {})) {
      if (['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'].includes(key) || key.endsWith('__media')) continue
      if (key.endsWith('Id') && key.slice(0, -2) in body.row) continue
      row[key] = value
    }
    return admin1.request('PUT', '/api/cms/_singleton/siteSettings', { json: { ...row, ...change } })
  }
  const OWN = '#2f6f4f'
  const ownSet0 = await settingsOf()
  const ownHome0 = await page(one.publicUrl)
  const ownPlain = photoLooks.resolve(ownSet0?.look, ownSet0?.colors)
  const ownPlainStyle = presetStyle(ownPlain.preset)
  check('without an own colour the settings hold none, <html> has no data-own and its style is exactly the preset\'s', ownSet0?.ownColor === null && attrOf(ownHome0.text, 'data-own') === null && attrOf(ownHome0.text, 'style') === ownPlainStyle && ownPlainStyle !== '', `ownColor ${JSON.stringify(ownSet0?.ownColor)} | data-own ${attrOf(ownHome0.text, 'data-own')} | style ${attrOf(ownHome0.text, 'style')} | preset ${ownPlainStyle}`)
  const ownSaved = await saveSettings({ ownColor: OWN })
  const ownSet1 = await settingsOf()
  const ownHome1 = await page(one.publicUrl)
  const ownMine = photoLooks.resolve(ownSet1?.look, ownSet1?.colors, { color: OWN })
  check('the owner saves an own colour through the admin API: 200, and the content API gives it back', ownSaved.status === 200 && ownSet1?.ownColor === OWN, `${ownSaved.status} ${ownSaved.text.slice(0, 200)} | ${JSON.stringify(ownSet1?.ownColor)}`)
  check('the home page\'s <html> carries data-own and the palette looks.resolve gives, which is not the preset\'s', ownMine.own !== null && attrOf(ownHome1.text, 'data-own') === ownMine.own.shown && attrOf(ownHome1.text, 'style') === ownMine.style && ownMine.style !== ownPlainStyle, `data-own ${attrOf(ownHome1.text, 'data-own')} (${ownMine.own?.shown}) | style ${attrOf(ownHome1.text, 'style')} | wanted ${ownMine.style}`)
  const hrefs = (text) => looksOn(text).looks.map((x) => x.href).join(' ')
  check('its look and colours are as before, and so is its look stylesheet', attrOf(ownHome1.text, 'data-look') === attrOf(ownHome0.text, 'data-look') && attrOf(ownHome1.text, 'data-colors') === attrOf(ownHome0.text, 'data-colors') && attrOf(ownHome0.text, 'data-look') === ownSet0?.look && hrefs(ownHome0.text) !== '' && hrefs(ownHome1.text) === hrefs(ownHome0.text), `${attrOf(ownHome0.text, 'data-look')}/${attrOf(ownHome0.text, 'data-colors')} -> ${attrOf(ownHome1.text, 'data-look')}/${attrOf(ownHome1.text, 'data-colors')} | ${hrefs(ownHome0.text)} -> ${hrefs(ownHome1.text)}`)
  const notHex = ['red', '#2f6f4', '#2f6f4fzz', '#2f6f4f;background:url(x)']
  const ownRefused = []
  for (const value of notHex) ownRefused.push((await saveSettings({ ownColor: value })).status)
  check('what is not #rrggbb is refused by the API (422), and the saved colour stays', ownRefused.every((s) => s === 422) && (await settingsOf())?.ownColor === OWN, `${notHex.map((v, i) => `${v} ${ownRefused[i]}`).join(' | ')} | ${JSON.stringify((await settingsOf())?.ownColor)}`)
  const ownCleared = await saveSettings({ ownColor: null })
  const ownSet2 = await settingsOf()
  const ownHome2 = await page(one.publicUrl)
  check('the owner clears it: 200, none in the content API, no data-own, and the preset\'s style again, the same as at first', ownCleared.status === 200 && ownSet2?.ownColor === null && attrOf(ownHome2.text, 'data-own') === null && attrOf(ownHome2.text, 'style') === ownPlainStyle && attrOf(ownHome2.text, 'style') === attrOf(ownHome0.text, 'style'), `${ownCleared.status} ${ownCleared.text.slice(0, 200)} | ${JSON.stringify(ownSet2?.ownColor)} | data-own ${attrOf(ownHome2.text, 'data-own')} | style ${attrOf(ownHome2.text, 'style')}`)

  // ── 4 · sessions ──
  log('4 · a session of one site is refused on the other')
  const samePeople = await Promise.all([row1, row2].map(async (row) => (await query(row.databaseUrl, 'select email from cms_users order by email')).map((r) => r.email).join(',')))
  check('both databases were seeded the same way: the same two people are on both sites', samePeople[0] === samePeople[1] && samePeople[0].includes(owner.email), samePeople.join(' | '))
  check('site 1\'s session works on site 1', (await admin1.get('/api/cms/_auth/me')).status === 200)
  const stolen = await Promise.all(['/api/cms/_auth/me', '/api/cms/category', '/api/cms/_users'].map(async (path) => (await new Http(two.publicUrl).get(path, { cookie: admin1.cookie })).status))
  check('site 1\'s session is refused on site 2 (401)', stolen.every((status) => status === 401), stolen.join(' '))
  check('site 2\'s own session works', (await admin2.get('/api/cms/_auth/me')).status === 200)
  check('and is refused on site 1 (401)', (await new Http(one.publicUrl).get('/api/cms/_auth/me', { cookie: admin2.cookie })).status === 401)
  const wedCrossed = await Promise.all([[one, adminW], [two, adminW], [wed, admin1], [wed, admin2]].map(async ([site, admin]) => (await new Http(site.publicUrl).get('/api/cms/_auth/me', { cookie: admin.cookie })).status))
  check('a session of the Wedding site is refused on both Photographer sites, and theirs on the Wedding site (401): the same process, three sites', wedCrossed.every((c) => c === 401) && (await adminW.get('/api/cms/_auth/me')).status === 200, wedCrossed.join(' '))
  const status = (url, token) => fetch(`${url}/api/health/status`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }))
  const [own1, cross] = [await status(one.publicUrl, row1.config.status.token), await status(two.publicUrl, row1.config.status.token)]
  check('site 1\'s status token opens site 1\'s status and is refused on site 2', own1.status === 200 && own1.body?.people?.active === 2 && cross.status === 401, `${own1.status} ${JSON.stringify(own1.body?.people)} ${cross.status}`)
  // The cloud asks each site, with that site's token, whether its owner has gone in (at most every few seconds).
  const noted = await waitFor(async () => {
    const now = await Promise.all([one, two, wed].map(async (s) => (await api.get(`/api/sites/${s.id}`)).body?.site))
    return now.every((s) => s?.ownerAccepted === true && s.inviteUrl === null) ? now : null
  }, { timeout: 20_000, every: 1000, what: 'the cloud to learn that the owner went into the three admins' })
  check('the cloud learns from each site itself that its owner went in', noted.length === 3)

  // ── 5 · files ──
  log('5 · a file of one site does not exist on the other')
  const form = new FormData()
  form.append('file', new Blob([PNG], { type: 'image/png' }), `e2e-${stamp}.png`)
  const uploaded = await admin1.request('POST', '/api/cms/_media', { form })
  const media = uploaded.body?.media ?? uploaded.body?.row ?? uploaded.body
  check('a file is uploaded on site 1', uploaded.status >= 200 && uploaded.status < 300 && typeof media?.url === 'string' && typeof media?.key === 'string', `${uploaded.status} ${uploaded.text.slice(0, 300)}`)
  const filePath = new URL(media.url, one.publicUrl).pathname
  const [file1, file2] = [await fetch(one.publicUrl + filePath), await fetch(two.publicUrl + filePath)]
  const got = Buffer.from(await file1.arrayBuffer())
  await file2.arrayBuffer()
  check('site 1 serves it', file1.status === 200 && got.equals(PNG), `${file1.status}`)
  check('the same address is 404 on site 2', file2.status === 404, `${file2.status}`)
  const fileName = media.key.split('/').pop()
  const [folder1, folder2] = [join(templateDir, 'sites', one.id), join(templateDir, 'sites', two.id)]
  const folderW = join(templateDir, 'sites', wed.id)
  const held = filesUnder(dataDir).filter((f) => f.endsWith(`/${fileName}`))
  check('it lies only under site 1\'s folder', held.length === 1 && held[0].startsWith(join(folder1, 'uploads') + '/') && !filesUnder(folder2).some((f) => f.includes(fileName)), held.join(' '))
  check('the same address is 404 on the Wedding site too', (await fetch(wed.publicUrl + filePath)).status === 404 && !filesUnder(folderW).some((f) => f.includes(fileName)))
  check('each site keeps its own uploads in its own folder', filesUnder(join(folder1, 'uploads')).length > 1 && filesUnder(join(folder2, 'uploads')).length > 0 && row1.config.storage.local.dir === join(folder1, 'uploads') && row2.config.storage.local.dir === join(folder2, 'uploads') && rowW.config.storage.local.dir === join(folderW, 'uploads'))

  // ── 6 · an unknown host ──
  log('6 · an unknown host on that port')
  const nobody = await page(`http://nikdo-${stamp}.localhost:${sitePort}`)
  check('an unknown host gets 404 and no page', nobody.status === 404 && nobody.text.includes('No website at this address'), `${nobody.status} ${nobody.text.slice(0, 80)}`)
  const byIp = await page(`http://127.0.0.1:${sitePort}`)
  check('so does the bare IP address', byIp.status === 404, `${byIp.status}`)
  check('a site\'s session opens nothing there either', (await new Http(`http://nikdo-${stamp}.localhost:${sitePort}`).get('/api/cms/_auth/me', { cookie: admin1.cookie })).status === 404)

  // ── 8 · memory, with both sites loaded (before one is deleted) ──
  for (const s of [one, two]) for (const path of ['/', '/galerie', '/cenik', '/kontakt']) await page(s.publicUrl, path)
  await page(wed.publicUrl, '/')
  const withThree = (await templateProcesses())[0]
  measures.memory = { withThreeSitesMB: Math.round(withThree.rssBytes / 1048576), basicProcessMB: Math.round((await basicProcesses())[0].rssBytes / 1048576) }
  const rowsBefore = directory()
  const basicRowBefore = JSON.stringify(directory(basicDir))

  // ── 7 · delete site 1 through the cloud ──
  log('7 · deleting site 1 through the cloud')
  check('before: its row, database, user and folder exist', directory().some((r) => r.id === one.id) && (await siteDatabases()).includes(db1) && (await siteRoles()).includes(db1) && existsSync(folder1))
  const removal = await api.post(`/api/sites/${one.id}/remove`, { confirm: one.slug })
  check('the removal is accepted', removal.status === 200, `${removal.status} ${removal.text.slice(0, 200)}`)
  const state = await waitFor(async () => {
    const now = await query(dbUrl(DB), 'select status, error from sites where id = $1', [one.id])
    return now[0]?.status === 'removed' || now[0]?.error ? now : null
  }, { timeout: 30_000, what: 'site 1 to be removed' })
  const removedAt = Date.now()
  check('the cloud no longer shows it to its owner', (await api.get(`/api/sites/${one.id}`)).status === 404)
  check('the cloud marks it removed, without an error', state[0]?.status === 'removed' && !state[0].error, JSON.stringify(state))
  check('its row left the directory, and the rows of site 2 and of the Wedding site stayed exactly as they were', byId(directory()) === byId(rowsBefore.filter((r) => r.id !== one.id)) && directory().length === 2 && JSON.stringify(directory().find((r) => r.id === two.id)) === JSON.stringify(row2) && JSON.stringify(directory().find((r) => r.id === wed.id)) === JSON.stringify(rowW))
  check('its database is gone', !(await siteDatabases()).includes(db1))
  check('its database user is gone', !(await siteRoles()).includes(db1))
  const gone = await page(one.publicUrl)
  check('its address answers 404 now', gone.status === 404 && gone.text.includes('No website at this address'), `${gone.status}`)
  const still = await page(two.publicUrl)
  check('site 2 keeps answering, with its content', (await ready(two.publicUrl))?.migrations === 'done' && still.status === 200 && still.text.includes('Foto Zápisník'), `${still.status}`)
  check('site 2\'s session still works, and its database is there', (await admin2.get('/api/cms/_auth/me')).status === 200 && (await siteDatabases()).includes(db2) && (await siteRoles()).includes(db2))
  const stillW = await page(wed.publicUrl)
  check('the Wedding site keeps answering too, with its content, its session and its reserved gift', (await ready(wed.publicUrl))?.migrations === 'done' && stillW.status === 200 && stillW.text.includes('Kristýna') && htmlTag(stillW.text).includes('data-design="wedding"') && (await adminW.get('/api/cms/_auth/me')).status === 200 && (await contentStatus(wed, 'gift')) === 200 && (await query(rowW.databaseUrl, 'select reserved from gift where id = $1', [gift.id]))[0].reserved === true, `${stillW.status}`)
  check('the other sites\' databases and users are all there, and only the deleted site\'s are gone', JSON.stringify([...await siteDatabases()].sort()) === JSON.stringify([db2, dbW, dbB].sort()) && JSON.stringify([...await siteRoles()].sort()) === JSON.stringify([db2, dbW, dbB].sort()))
  check('the Basic site is untouched: its row, its process and its page', JSON.stringify(directory(basicDir)) === basicRowBefore && (await page(bas.publicUrl)).text.includes('Pekárna U Mostu') && (await basicProcesses()).map((p) => p.pid).join() === String(basicApp.pid))
  const after = await templateProcesses()
  check('the process is the same one as before', after.length === 1 && after[0].pid === pid && (await listeners(sitePort)).join() === String(pid), `${after.map((p) => p.pid).join(',')} was ${pid}`)
  check('the address of the deleted site is free again', (await api.get(`/api/slug?slug=${one.slug}`)).body?.ok === true)

  // ── 8 · memory ──
  log('8 · memory of the one process')
  measures.memory.withOneSiteMB = Math.round(after[0].rssBytes / 1048576)
  log(`    RSS of the one app's process with three sites: ${measures.memory.withThreeSitesMB} MB; after site 1 was deleted: ${measures.memory.withOneSiteMB} MB (pid ${pid}); the Basic app's process with one site: ${measures.memory.basicProcessMB} MB`)
  check('the memory was measured', measures.memory.withThreeSitesMB > 0 && measures.memory.basicProcessMB > 0)

  // ── 7, looked at again: the deleted site's folder ──
  // Not asked the moment the removal ends: what the app's process still had in work for
  // the site would not show yet.
  log('7 · the deleted site\'s folder, a few seconds after the removal')
  await sleep(Math.max(0, 5000 - (Date.now() - removedAt)))
  const back = filesUnder(folder1)
  const said = readFileSync(join(templateDir, 'server.log'), 'utf8').split('\n').find((line) => line.includes('smaller copies of a picture')) ?? ''
  check('its folder is gone, and stays gone', !existsSync(folder1),
    `the driver removed it and the cloud marked the site removed; ${Math.round((Date.now() - removedAt) / 1000)} s later the folder is there again with ${back.length} file(s), written by the app's process, which went on with a picture of the site after the site left the directory: ${back.slice(0, 3).map((f) => f.slice(folder1.length + 1)).join(', ')}${said ? `; its log: ${said.slice(0, 200)}` : ''}`, { go: true })

  // ── 9 · the one app's process is gone ──
  log('9 · the one app\'s process stops (as after a reboot): the cloud starts it again; the Basic app\'s keeps running')
  check('the script stops the one app\'s process by its marker, and only that one', (await stopTemplateProcesses()).map((p) => p.pid).join() === String(pid) && !(await alive(pid)) && (await ready(two.publicUrl)) === null && (await ready(wed.publicUrl)) === null && (await ready(bas.publicUrl))?.migrations === 'done' && (await basicProcesses()).map((p) => p.pid).join() === String(basicApp.pid))
  const again = await api.post(`/api/sites/${two.id}/invite`)
  check('the cloud reaches the site again', again.status === 200, `${again.status} ${again.text.slice(0, 200)}`)
  const restarted = await templateProcesses()
  check('one new process serves it, on the same port', restarted.length === 1 && restarted[0].pid !== pid && appFile().pid === restarted[0].pid && appFile().port === sitePort && (await listeners(sitePort)).join() === String(restarted[0].pid), JSON.stringify(restarted.map((p) => p.pid)))
  const home = await page(two.publicUrl)
  check('site 2 is back with its content and its session', home.status === 200 && home.text.includes('Foto Zápisník') && (await admin2.get('/api/cms/_auth/me')).status === 200, `${home.status}`)
  const homeW2 = await page(wed.publicUrl)
  check('so is the Wedding site, from the same new process, in its own design', homeW2.status === 200 && homeW2.text.includes('Kristýna') && htmlTag(homeW2.text).includes('data-design="wedding"') && (await adminW.get('/api/cms/_auth/me')).status === 200 && new URL(wed.publicUrl).port === String(sitePort))
  check('the deleted site did not come back with it', (await page(one.publicUrl)).status === 404 && byId(directory()) === byId([row2, rowW]))
  // app.json is lost while the process runs: the port comes back from what the cloud keeps
  // about the site, the pid from the process that listens there and carries the folder's marker.
  // (Its app secret is made anew: after the next restart people sign in to the sites again.)
  rmSync(join(templateDir, 'app.json'))
  const found = await api.post(`/api/sites/${two.id}/invite`)
  check('app.json is lost: it is written again with the same port and the running process\'s pid', found.status === 200 && appFile().port === sitePort && appFile().pid === restarted[0].pid && mode(join(templateDir, 'app.json')) === '600' && (await templateProcesses()).map((p) => p.pid).join() === String(restarted[0].pid), `${found.status} ${JSON.stringify([appFile().port, appFile().pid])}`)

  // ── 10 · a step fails, "Try again" goes on ──
  log('10 · the start step fails (another program holds the one app\'s port); "Try again" goes on from it')
  await stopTemplateProcesses()
  const squatter = net.createServer((socket) => socket.destroy())
  await new Promise((done, fail) => { squatter.once('error', fail); squatter.listen({ port: sitePort, host: '127.0.0.1' }, done) })
  let third
  try {
    const asked3 = await api.post('/api/sites', { name: 'Třetí web', slug: `mt-treti-${stamp}`, template: 'photographer', look: 'atelier' })
    check('a third site is accepted', asked3.status === 201, `${asked3.status} ${asked3.text.slice(0, 200)}`)
    third = await waitFor(async () => {
      const now = (await api.get(`/api/sites/${asked3.body.site.id}`)).body?.site
      return now?.status === 'failed' || now?.status === 'ready' ? now : null
    }, { timeout: 60_000, what: 'the third site to fail' })
  }
  finally {
    await new Promise((done) => squatter.close(done))
  }
  const stepsOf = (site) => site.steps.map((x) => `${x.id}:${x.state}:${x.attempts}${x.message ? `:${x.message}` : ''}`).join(' ')
  check('it failed at the start step, and says why', third.status === 'failed' && stepsOf(third) === 'database:done:1 start:failed:1:port_taken content:pending:0 account:pending:0', stepsOf(third))
  const db3 = nameOf(third.id)
  const oid = async () => (await withPg(async (c) => (await c.query('select d.oid::int as oid, r.rolname as owner from pg_database d join pg_roles r on r.oid = d.datdba where d.datname = $1', [db3])).rows))[0]
  const first3 = await oid()
  check('the first try made its database and user, and no row yet', first3?.owner === db3 && !directory().some((r) => r.id === third.id), JSON.stringify(first3))
  check('"Try again" is accepted', (await api.post(`/api/sites/${third.id}/retry`)).status === 200)
  const retried = await waitFor(async () => {
    const now = (await api.get(`/api/sites/${third.id}`)).body?.site
    if (now?.status === 'failed') throw new Error(`the third site failed again: ${stepsOf(now)} ${now.errorDetail ?? ''}`)
    return now?.status === 'ready' ? now : null
  }, { timeout: 120_000, what: 'the third site to be ready' })
  check('the site is ready: the failed step was tried twice, the others once', stepsOf(retried) === 'database:done:1 start:done:2 content:done:1 account:done:1', stepsOf(retried))
  const row3 = directory().find((r) => r.id === third.id)
  const second3 = await oid()
  check('the database of the first try was kept, not made again', second3.oid === first3.oid && second3.owner === db3, `${first3.oid} ${second3.oid}`)
  check('the password in the directory is the one its user has now', (await query(row3.databaseUrl, 'select current_user as u'))[0].u === db3)
  const home3 = await page(retried.publicUrl)
  check('it answers with its name and look, from the one app\'s one process', home3.status === 200 && home3.text.includes('Třetí web') && home3.text.includes('data-look="atelier"') && new URL(retried.publicUrl).port === String(sitePort) && (await templateProcesses()).length === 1, `${home3.status}`)
  check('site 2 and the Wedding site came back with it, and the directory holds the three rows of the app', (await page(two.publicUrl)).text.includes('Foto Zápisník') && (await page(wed.publicUrl)).text.includes('Kristýna') && byId(directory()) === byId([row2, rowW, row3]), directory().map((r) => r.id).join())

  // ── 11 · the directory file is lost ──
  log('11 · the site directory is lost: the cloud writes every row of the app again, of both templates, from what it keeps')
  const before = directory()
  const pidNow = appFile().pid
  const basicDirectoryBefore = JSON.stringify(directory(basicDir))
  rmSync(join(templateDir, 'sites.json'))
  // Asking for a fresh invitation makes the cloud see to that one site first (ensureRunning).
  const asked = await api.post(`/api/sites/${two.id}/invite`)
  check('the cloud still reaches the site it was asked about', asked.status === 200 && asked.body?.site?.ownerAccepted === true, `${asked.status} ${asked.text.slice(0, 200)}`)
  check('the directory is back with the rows of all three sites of the app, of both templates, as they were, readable by its owner only', before.length === 3 && byId(directory()) === byId(before) && directory().map((r) => r.model).sort().join() === 'photographer,photographer,wedding' && mode(join(templateDir, 'sites.json')) === '600', directory().map((r) => `${r.id}:${r.model}`).join())
  const both = await Promise.all([two, retried, wed].map((s) => page(s.publicUrl)))
  check('all three sites answer from the same process, each in its own design', both.every((r) => r.status === 200) && both[0].text.includes('Foto Zápisník') && both[1].text.includes('Třetí web') && both[2].text.includes('Kristýna') && htmlTag(both[2].text).includes('data-design="wedding"') && htmlTag(both[0].text).includes('data-design="photographer"') && (await templateProcesses()).map((p) => p.pid).join() === String(pidNow), both.map((r) => r.status).join(' '))
  check('the Basic app\'s directory was not touched, and the Basic site still answers from its own process', JSON.stringify(directory(basicDir)) === basicDirectoryBefore && (await page(bas.publicUrl)).text.includes('Pekárna U Mostu') && (await basicProcesses()).map((p) => p.pid).join() === String(basicApp.pid))
  // The Basic app's own directory lost: its one row comes back, written again for the Basic app only.
  rmSync(join(basicDir, 'sites.json'))
  const askedBasic = await api.post(`/api/sites/${bas.id}/invite`)
  check('the Basic app\'s directory is lost: the cloud writes its one row again, and nothing of the one app is in it', askedBasic.status === 200 && JSON.stringify(directory(basicDir).map((r) => r.id)) === JSON.stringify([bas.id]) && !('model' in directory(basicDir)[0]) && byId(directory()) === byId(before), `${askedBasic.status} ${askedBasic.text.slice(0, 200)}`)
}

/**
 * With CLOUD_CUSTOM_TYPES=on: the owner of a Photographer site makes a content type of the site's
 * own through its admin API, fills it, and shows it on the home page with the Entries block. The
 * Wedding site, served by the same process, has nothing of it: no route, no table, the same page.
 */
async function customTypes({ one, wed, row1, rowW, rowB, admin1, adminW, home, pid, basicPid, htmlTag, looksOn }) {
  const anon = (site) => new Http(site.publicUrl)
  log('3c · a content type of the Photographer site\'s own, made in its admin and shown on its home page; nothing of it on the Wedding site')
  const environment = async (p) => (await run('ps', ['eww', '-o', 'command=', '-p', String(p)])).stdout
  check('the one app\'s process runs with NUXT_CMS_CUSTOM_TYPES=on, the Basic app\'s without it', (await environment(pid)).includes('NUXT_CMS_CUSTOM_TYPES=on') && !(await environment(basicPid)).includes('NUXT_CMS_CUSTOM_TYPES'))
  check('the kit sites\' rows carry the plan\'s limits as config.customTypes; the Basic site\'s row says nothing of them', JSON.stringify(row1.config.customTypes) === '{"types":12,"fields":30}' && JSON.stringify(rowW.config.customTypes) === '{"types":12,"fields":30}' && !('customTypes' in rowB.config), JSON.stringify([row1.config.customTypes, rowW.config.customTypes, rowB.config.customTypes]))

  // The type: a page per entry under /kurzy, drafts and publishing, and three fields beside the title.
  const label = (en, cs) => ({ cs, en })
  const change = async (admin, ops) => {
    const m = (await admin.get('/api/cms/_model')).body
    return admin.post('/api/cms/_model', { baseVersion: m?.version, ops })
  }
  const made = await change(admin1, [
    { op: 'type.add', name: 'custom_course', label: label('Courses', 'Kurzy'), labelSingular: label('Course', 'Kurz'), page: { prefix: 'kurzy' }, publish: true },
    { op: 'field.add', type: 'custom_course', field: { key: 'perex', type: 'text', long: true, label: label('Summary', 'Krátký popis') } },
    { op: 'field.add', type: 'custom_course', field: { key: 'startsAt', type: 'datetime', label: label('Starts', 'Začátek') } },
    { op: 'field.add', type: 'custom_course', field: { key: 'place', type: 'text', label: label('Place', 'Místo') } },
  ])
  check('the owner makes a type with a page and three fields through the admin API', made.status === 200, `${made.status} ${made.text.slice(0, 300)}`)
  const titles = [`Kurz světla ${stamp}`, `Kurz portrétu ${stamp}`]
  const slugs = [`kurz-svetla-${stamp}`, `kurz-portretu-${stamp}`]
  const entries = []
  for (const [i, title] of titles.entries()) {
    const res = await admin1.post('/api/cms/custom_course', { title, slug: slugs[i], perex: `Krátce o kurzu ${i + 1}.`, startsAt: `2027-0${i + 3}-01T09:00:00.000Z`, place: 'Praha', status: 'published' })
    entries.push(res)
  }
  check('two published entries are added', entries.every((r, i) => r.status === 201 && r.body?.row?.slug === slugs[i]), entries.map((r) => `${r.status} ${JSON.stringify(r.body?.data ?? r.body).slice(0, 300)}`).join(' | '))

  // The Entries block on the home page, after what is there.
  const homeEntry = (await anon(one).get('/api/content/page/home')).body?.item
  const homeRow = (await admin1.get(`/api/cms/page/${homeEntry?.id}`)).body?.row
  const block = { id: `custom-courses-${stamp}`, type: 'custom_entries', heading: 'Kurzy', text: '', layout: 'cards', source: { type: 'custom_course', show: { text: 'perex', date: 'startsAt' }, order: { by: 'startsAt', dir: 'asc' }, limit: 6 } }
  const put = await admin1.request('PATCH', `/api/cms/page/${homeRow?.id}`, { json: { sections: [...(homeRow?.sections ?? []), block] } })
  check('an Entries block of the type is put on the home page', put.status === 200 && Array.isArray(homeRow?.sections), `${put.status} ${put.text.slice(0, 300)}`)

  const homeNow = await page(one.publicUrl)
  check('the home page\'s HTML holds both entries\' titles', homeNow.status === 200 && titles.every((t) => homeNow.text.includes(t)), `${homeNow.status} ${titles.map((t) => homeNow.text.includes(t)).join(' ')}`)
  const own = await page(one.publicUrl, `/kurzy/${slugs[0]}`)
  const h1 = [...own.text.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim())
  check('the entry\'s own address answers 200 with its title in an h1', own.status === 200 && h1.includes(titles[0]), `${own.status} ${JSON.stringify(h1)}`)
  const sitemap = await page(one.publicUrl, '/sitemap.xml')
  check('the sitemap lists that address', sitemap.status === 200 && sitemap.text.includes(`/kurzy/${slugs[0]}</loc>`) && sitemap.text.includes(`/kurzy/${slugs[1]}</loc>`), `${sitemap.status} ${sitemap.text.slice(0, 200)}`)
  const tables1 = await query(row1.databaseUrl, `select tablename as name from pg_tables where schemaname = 'public' and (tablename = 'cms_model' or tablename like 'custom\\_%') order by 1`)
  check('the Photographer site\'s own database holds the type\'s table and its model', JSON.stringify(tables1.map((t) => t.name)) === '["cms_model","custom_course"]', JSON.stringify(tables1))

  // The Wedding site: the same process, nothing of it.
  const weddingRoutes = [(await adminW.get('/api/cms/custom_course')).status, (await anon(wed).get('/api/content/custom_course')).status, (await anon(wed).get(`/api/content/custom_course/${slugs[0]}`)).status, (await adminW.post('/api/cms/custom_course', { title: 'x' })).status]
  check('on the Wedding site the type\'s admin and content routes answer 404', weddingRoutes.every((s) => s === 404), weddingRoutes.join(' '))
  const typesW = await anon(wed).get('/api/content/_types')
  check('its list of the site\'s own types is empty', typesW.status === 200 && JSON.stringify(typesW.body) === '{"types":[]}', `${typesW.status} ${typesW.text.slice(0, 200)}`)
  const homeW = await page(wed.publicUrl)
  check('its home page is as before: its name, its design, its look, nothing of the type', homeW.status === 200 && homeW.text.includes('Kristýna') && htmlTag(homeW.text) === htmlTag(home.text) && JSON.stringify(looksOn(homeW.text)) === JSON.stringify(looksOn(home.text)) && !titles.some((t) => homeW.text.includes(t)) && !homeW.text.includes('/kurzy/'), `${homeW.status} ${htmlTag(homeW.text)}`)
  const pageW = await page(wed.publicUrl, `/kurzy/${slugs[0]}`)
  check('and the entry\'s address is not a page there', pageW.status === 404 && !pageW.text.includes(titles[0]), `${pageW.status}`)
  const tablesW = await query(rowW.databaseUrl, `select tablename as name from pg_tables where schemaname = 'public' and (tablename = 'cms_model' or tablename like 'custom\\_%')`)
  check('its database has no cms_model table and no custom_ table', tablesW.length === 0, JSON.stringify(tablesW))

  // The guard: a field the block shows cannot go while the block shows it.
  const refused = await change(admin1, [{ op: 'field.remove', type: 'custom_course', key: 'perex' }])
  const places = refused.body?.data?.places ?? []
  check('removing a field the block shows is refused (409), with the home page named', refused.status === 409 && refused.body?.data?.code === 'in-use' && places.length === 1 && places[0].entity === 'page' && places[0].id === homeRow.id && places[0].title === homeRow.title && places[0].block?.id === block.id, `${refused.status} ${refused.text.slice(0, 300)}`)
  const still = (await admin1.get('/api/cms/_model')).body
  check('and the field is still there', JSON.stringify(still?.doc?.types?.find((t) => t.name === 'custom_course')?.fields?.map((x) => [x.key, x.removedAt ?? null])).includes('["perex",null]'), JSON.stringify(still?.doc?.types?.[0]?.fields))
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
  if (failed && existsSync(join(templateDir, 'server.log'))) console.error('--- last lines of the one app process\'s log ---\n' + readFileSync(join(templateDir, 'server.log'), 'utf8').split('\n').slice(-25).join('\n'))
  await cloud?.stop().catch(() => {})
  if (keep) {
    const procs = await appProcesses().catch(() => [])
    log(`kept: ${procs.map((p) => `the ${p.app} process (pid ${p.pid})`).join(', ') || 'no process'}, the databases ${PREFIX}_… and ${DB}, and ${dataDir}`)
  }
  else {
    const cleaned = await cleanUp().catch((e) => { console.error('cleanup:', e.message); return null })
    await dropDatabase(DB).catch((e) => console.error('cleanup:', e.message))
    if (cleaned) log(`cleaned up: stopped ${cleaned.processes.length} process(es) (${cleaned.processes.join(', ') || 'none'}), dropped ${cleaned.databases} site database(s), ${cleaned.roles} user(s) and ${DB}, removed ${dataDir}`)
  }
  const seconds = Math.round((Date.now() - startedAt) / 1000)
  const summary = { at: new Date().toISOString(), ok: !failed, checks: results.length, seconds, failedAt: failed ? String(failed.message) : null, measures, results }
  writeFileSync(join(preview, 'e2e-shared-result.json'), JSON.stringify(summary, null, 2))
  log(failed ? `FAILED: ${missed.length} of ${results.length} checks, ${seconds} s${missed.length ? ` (${missed.map((r) => r.name).join('; ')})` : ''}` : `all ${results.length} checks passed in ${seconds} s`)
  if (measures.creation) log('creation (server):', measures.creation.map((c) => `${c.serverMs} ms`).join(', '))
  if (measures.memory) log(`memory of the one app's process: ${measures.memory.withThreeSitesMB} MB with three sites (Photographer ×2, Wedding); the Basic app's process: ${measures.memory.basicProcessMB} MB`)
  if (failed && existsSync(logFile)) console.error('--- last lines of the cloud app log ---\n' + readFileSync(logFile, 'utf8').split('\n').slice(-25).join('\n'))
}
process.exit(failed ? 1 : 0)
