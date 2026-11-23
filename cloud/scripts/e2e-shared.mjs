// The shared hosting driver for real, locally: two websites of one template, served by ONE
// process, each with a database and a database user of its own.
//
//   pnpm --filter tinyzoo-cloud e2e:shared     # needs the template built: pnpm --filter tinyzoo-cloud templates:build photographer
//
// It starts a cloud app of its own with NUXT_HOSTING_DRIVER=shared (database tz_cloud_mt_e2e,
// data under .data/mt-e2e, template ports 4500–4519, site databases and users tzmt_e2e_…, the
// app on 3290 or the next free port, its own build folder), so neither the developer's data
// nor a run of scripts/e2e.mjs is touched, and removes everything it made at the end
// (--keep leaves the sites and their process). The names and ports can be set from the
// environment: E2E_SHARED_DB, E2E_SHARED_SITE_PREFIX, E2E_SHARED_PORT, E2E_SHARED_SITE_PORTS
// ("4500-4519"), E2E_SHARED_DATA (the folder's name under .data); the Postgres server from CLOUD_PG_URL.
//
// Everything goes through the sign-up app's real API and the sites' own addresses; no browser.
// What it proves: both sites come from one process; each has its own database and database
// user, refused everywhere else; each shows its own name, look and content; a session, a file
// and an entry of one site do not exist on the other; an unknown host gets nothing; deleting
// one site removes its row, database, user and folder while the other keeps answering from the
// same process. It prints the process's memory with two sites. Then what the cloud does when
// things go wrong: the template's process is gone (it is started again on the same port), a
// step fails ("Try again" goes on, keeping the database of the first try), the site directory
// or app.json is lost (written again from what the cloud keeps).
import { execFile } from 'node:child_process'
import net from 'node:net'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import pg from 'pg'
import { alive, arg, cloudDir, dbUrl, freePortFrom, log, sleep, startCloud, templateEntries, waitFor, withPg } from './lib.mjs'

const run = promisify(execFile)
const keep = arg('keep', false) === true
const DB = process.env.E2E_SHARED_DB || 'tz_cloud_mt_e2e'
const PREFIX = process.env.E2E_SHARED_SITE_PREFIX || 'tzmt_e2e'
const [portFrom, portTo] = (process.env.E2E_SHARED_SITE_PORTS || '4500-4519').split('-').map(Number)
const PORTS = { from: portFrom, to: portTo }
const APP_PORT = Number(process.env.E2E_SHARED_PORT) || 3290
const dataDir = join(cloudDir, '.data', process.env.E2E_SHARED_DATA || 'mt-e2e')
if (!/^[a-z][a-z0-9_]*_e2e$/.test(DB)) { console.error(`E2E_SHARED_DB must be a database of this script's own, named …_e2e (it is dropped): ${DB}`); process.exit(2) }
if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(PREFIX)) { console.error(`E2E_SHARED_SITE_PREFIX is not a usable prefix: ${PREFIX}`); process.exit(2) }
if (!Number.isInteger(PORTS.from) || !Number.isInteger(PORTS.to) || PORTS.to < PORTS.from) { console.error('E2E_SHARED_SITE_PORTS must be "from-to"'); process.exit(2) }
const templateDir = join(dataDir, 'photographer')
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

if (!existsSync(templateEntries.photographer)) {
  console.error(`The template "photographer" is not built (${templateEntries.photographer}).\nRun: pnpm --filter tinyzoo-cloud templates:build photographer`)
  process.exit(2)
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

/** The template processes started under `dataDir`: recognised by the `--template-dir=<folder>` argument the shared driver gives them. */
async function templateProcesses() {
  const { stdout } = await run('ps', ['-axo', 'pid=,rss=,command='])
  const marker = `--template-dir=${resolve(dataDir)}/`
  return stdout.split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .filter((m) => m[3].split(/\s+/).some((word) => word.startsWith(marker)))
    .map((m) => ({ pid: Number(m[1]), rssBytes: Number(m[2]) * 1024, template: m[3].split(marker)[1].split(/\s/)[0], command: m[3] }))
}

/** Stop them: only pids whose command line names a folder under this run's data folder, asked first, then insisted on. */
async function stopTemplateProcesses() {
  const procs = await templateProcesses()
  for (const p of procs) { try { process.kill(p.pid, 'SIGTERM') } catch { /* gone */ } }
  for (let i = 0; i < 40; i++) {
    if (!(await Promise.all(procs.map((p) => alive(p.pid)))).some(Boolean)) break
    await sleep(250)
  }
  // Still there after ten seconds: looked up again (the pid must still carry the marker), then killed.
  for (const p of await templateProcesses()) {
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

/** Remove everything a run made: its template processes, its site databases and users, its folder. */
async function cleanUp() {
  const stopped = await stopTemplateProcesses()
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
const directory = () => JSON.parse(readFileSync(join(templateDir, 'sites.json'), 'utf8')).sites
const appFile = () => JSON.parse(readFileSync(join(templateDir, 'app.json'), 'utf8'))

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
      NUXT_MAX_SITES_PER_USER: '3',
      NUXT_REQUIRE_VERIFIED_EMAIL: 'false',
      NUXT_MAIL_TRANSPORT: 'log',
      // A build folder of its own: scripts/e2e.mjs may run beside this one.
      CLOUD_BUILD_DIR: '.nuxt-scripts-shared',
    },
  })
  log(`cloud app up at ${cloud.url} (shared driver)`)

  // ── one account, two Photographer sites made at the same moment ──
  log('0 · one account, two Photographer sites at the same moment')
  const api = new Http(cloud.url)
  const owner = { name: 'Johana Loudová', email: `johana-${stamp}@example.com`, password: 'dlouhe-heslo-johany-1' }
  check('an account is made', (await api.post('/api/auth/signup', owner)).status === 201)
  const wanted = [
    { name: 'Ateliér Světlo', slug: `mt-svetlo-${stamp}`, template: 'photographer', look: 'negativ' },
    { name: 'Foto Zápisník', slug: `mt-zapisnik-${stamp}`, template: 'photographer', look: 'zapisnik' },
  ]
  const t0 = Date.now()
  const made = await Promise.all(wanted.map((w) => api.post('/api/sites', w)))
  check('both sites are accepted', made.every((r) => r.status === 201), made.map((r) => `${r.status} ${r.text.slice(0, 200)}`).join(' | '))
  const ids = made.map((r) => r.body.site.id)
  const sites = await waitFor(async () => {
    const now = await Promise.all(ids.map(async (id) => (await api.get(`/api/sites/${id}?runtime=1`)).body))
    const failed = now.find((s) => s?.site.status === 'failed')
    if (failed) throw new Error(`a site failed: ${JSON.stringify(failed.site.steps)} ${failed.site.errorDetail ?? ''}`)
    return now.every((s) => s?.site.status === 'ready') ? now : null
  }, { timeout: 300_000, every: 500, what: 'both sites to be ready' })
  const [one, two] = sites.map((s) => s.site)
  const tookMs = (site) => Object.fromEntries(site.steps.map((s) => [s.id, Date.parse(s.finishedAt) - Date.parse(s.startedAt)]))
  measures.creation = [one, two].map((s) => ({ site: s.slug, serverMs: Date.parse(s.readyAt) - Date.parse(s.createdAt), steps: tookMs(s) }))
  check('both sites are ready', true)
  for (const c of measures.creation) log(`    ${c.site} made in ${c.serverMs} ms (${JSON.stringify(c.steps)}); both ready ${Date.now() - t0} ms after they were asked for`)
  check('each has the look chosen for it', one.look === 'negativ' && two.look === 'zapisnik', `${one.look} ${two.look}`)

  // ── 1 · one process ──
  log('1 · both sites are served by one process')
  const [u1, u2] = [new URL(one.publicUrl), new URL(two.publicUrl)]
  const sitePort = Number(u1.port)
  check('each address is <slug>.localhost on the template\'s port', u1.hostname === `${one.slug}.localhost` && u2.hostname === `${two.slug}.localhost`, `${one.publicUrl} ${two.publicUrl}`)
  check('the two addresses share one port, from the shared range', u1.port === u2.port && sitePort >= PORTS.from && sitePort <= PORTS.to, `${u1.port} ${u2.port}`)
  const listening = await listeners(sitePort)
  const app = appFile()
  check('one process listens on that port, the one app.json names', listening.length === 1 && listening[0] === app.pid && app.port === sitePort, `listening ${listening.join(',')}; app.json ${app.pid}:${app.port}`)
  const procs = await templateProcesses()
  check('exactly one process carries the template folder\'s marker', procs.length === 1 && procs[0].pid === app.pid && procs[0].template === 'photographer', JSON.stringify(procs.map((p) => [p.pid, p.template])))
  const pid = app.pid
  check('both sites answer ready from it, each with its database migrated', (await Promise.all([one, two].map((s) => ready(s.publicUrl)))).every((r) => r?.ok === true && r.migrations === 'done'))
  check('the cloud reports both as running, with the memory of the one process', sites.every((s) => s.runtime?.running === true && s.runtime.memoryBytes > 0), JSON.stringify(sites.map((s) => s.runtime)))
  check('the site directory and app.json are readable by their owner only', mode(join(templateDir, 'sites.json')) === '600' && mode(join(templateDir, 'app.json')) === '600', `${mode(join(templateDir, 'sites.json'))} ${mode(join(templateDir, 'app.json'))}`)

  // ── 2 · a database and a database user per site ──
  log('2 · each site has its own database and its own database user')
  const rows = directory()
  const row1 = rows.find((r) => r.id === one.id), row2 = rows.find((r) => r.id === two.id)
  check('the directory holds a row for each site, and nothing else', rows.length === 2 && !!row1 && !!row2, JSON.stringify(rows.map((r) => r.id)))
  const [d1, d2] = [new URL(row1.databaseUrl), new URL(row2.databaseUrl)]
  const [db1, db2] = [d1.pathname.slice(1), d2.pathname.slice(1)]
  check('the two database addresses differ in database, user and password', db1 !== db2 && d1.username !== d2.username && d1.password !== d2.password)
  const nameOf = (id) => `${PREFIX}_${id.replace(/-/g, '_')}`
  check('database and user are named by the site\'s id, never by its address', db1 === nameOf(one.id) && d1.username === db1 && db2 === nameOf(two.id) && d2.username === db2 && ![db1, db2].some((n) => n.includes('svetlo') || n.includes('zapisnik')), `${db1} ${db2}`)
  const facts = await withPg(async (c) => (await c.query(
    `select d.datname as name, r.rolname as owner, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolcanlogin, has_database_privilege('public', d.datname, 'connect') as open
       from pg_database d join pg_roles r on r.oid = d.datdba where d.datname = any($1) order by 1`, [[db1, db2]])).rows)
  check('each database is owned by its site\'s user, a plain login, and closed to everybody else',
    facts.length === 2 && facts.every((f) => f.owner === f.name && f.rolcanlogin && !f.rolsuper && !f.rolcreatedb && !f.rolcreaterole && f.open === false), JSON.stringify(facts))
  const who1 = await query(row1.databaseUrl, 'select current_user as u, current_database() as d, (select count(*)::int from cms_users) as people')
  const who2 = await query(row2.databaseUrl, 'select current_user as u, current_database() as d, (select count(*)::int from cms_users) as people')
  check('each user can read its own database', who1[0].u === db1 && who1[0].d === db1 && who1[0].people >= 2 && who2[0].u === db2 && who2[0].d === db2 && who2[0].people >= 2, JSON.stringify([who1, who2]))
  const tables = await query(row1.databaseUrl, 'select count(*)::int as n, count(*) filter (where tableowner = current_user)::int as mine from pg_tables where schemaname = \'public\'')
  check('the site\'s own app migrated the database, as the site\'s user', tables[0].n > 10 && tables[0].mine === tables[0].n, JSON.stringify(tables))
  const crossed = [await refusal(onDatabase(row1.databaseUrl, db2)), await refusal(onDatabase(row2.databaseUrl, db1))]
  check('each user is refused on the other site\'s database', crossed.every((code) => code === '42501'), crossed.join(' '))
  const onCloud = [await refusal(onDatabase(row1.databaseUrl, DB)), await refusal(onDatabase(row2.databaseUrl, DB))]
  check('each user is refused on the cloud\'s own database', onCloud.every((code) => code === '42501'), onCloud.join(' '))
  const reach = [await refusal(row1.databaseUrl, `create database ${PREFIX}_x`), await refusal(row1.databaseUrl, `create role ${PREFIX}_x`)]
  check('a site\'s user can make neither a database nor a user', reach.every((code) => code === '42501'), reach.join(' '))
  const secrets = [row1, row2].flatMap((r) => [new URL(r.databaseUrl).password, r.secret, r.config.auth.setupToken, r.config.status.token])
  check('the directory holds every secret of both sites', secrets.length === 8 && secrets.every((x) => typeof x === 'string' && x.length >= 24))
  const kept = (await query(dbUrl(DB), 'select driver_state::text as state from sites')).map((r) => r.state).join(' ')
  check('the cloud keeps the database password encrypted, not in plain text', kept.includes('"databasePassword": "v1.') && !secrets.some((x) => kept.includes(x)))
  const sent = JSON.stringify(sites) + JSON.stringify((await api.get('/api/sites')).body)
  check('no secret is sent to the owner\'s browser', !secrets.some((x) => sent.includes(x)) && !/databaseUrl|databasePassword|driverState/.test(sent))
  // The process's own environment (ps shows it for one's own processes): what is the same for every site, and no site's secret.
  const environment = (await run('ps', ['eww', '-o', 'command=', '-p', String(pid)])).stdout
  check('the process\'s environment and command line carry no secret of a site', environment.includes('NUXT_CMS_TENANCY_MODE=multi') && environment.includes(`NUXT_CMS_TENANCY_FILE=${join(templateDir, 'sites.json')}`) && !secrets.some((x) => environment.includes(x)) && !environment.includes('DATABASE_URL'), environment.includes('NUXT_CMS_TENANCY_MODE=multi') ? 'a secret is in it' : 'ps did not show the environment')

  // ── 3 · its own name, look and content ──
  log('3 · each site shows its own name, look and content')
  const [home1, home2] = [await page(one.publicUrl), await page(two.publicUrl)]
  check('both home pages answer', home1.status === 200 && home2.status === 200, `${home1.status} ${home2.status}`)
  check('each home page carries the name the wizard wrote, and not the other\'s', home1.text.includes('Ateliér Světlo') && !home1.text.includes('Foto Zápisník') && home2.text.includes('Foto Zápisník') && !home2.text.includes('Ateliér Světlo'))
  check('each is drawn in its own look', home1.text.includes('data-look="negativ"') && home2.text.includes('data-look="zapisnik"'))
  const [set1, set2] = await Promise.all([one, two].map(async (s) => (await new Http(s.publicUrl).get('/api/content/_global/siteSettings')).body?.item))
  check('each site\'s settings hold its own name and look', set1?.siteName === 'Ateliér Světlo' && set1.look === 'negativ' && set2?.siteName === 'Foto Zápisník' && set2.look === 'zapisnik', JSON.stringify([set1?.siteName, set1?.look, set2?.siteName, set2?.look]))

  // The owner goes into each admin through the invitation the cloud keeps for them.
  const enter = async (site, password) => {
    const client = new Http(site.publicUrl)
    const token = String(site.inviteUrl ?? '').split('/').pop()
    const res = await client.post('/api/cms/_auth/accept', { token, name: owner.name, password })
    if (res.status !== 200) throw new Error(`the invitation of ${site.slug} was not accepted: ${res.status} ${res.text.slice(0, 300)}`)
    return client
  }
  check('each invitation leads to its own site\'s admin', String(one.inviteUrl).startsWith(`${one.publicUrl}/admin/invite/`) && String(two.inviteUrl).startsWith(`${two.publicUrl}/admin/invite/`), `${one.inviteUrl} ${two.inviteUrl}`)
  const admin1 = await enter(one, 'heslo-do-administrace-1')
  const admin2 = await enter(two, 'heslo-do-administrace-2')
  const entry = { name: `Jen na prvním webu ${stamp}`, slug: `jen-na-prvnim-${stamp}` }
  const created = await admin1.post('/api/cms/category', entry)
  check('an entry is created in site 1\'s admin', created.status >= 200 && created.status < 300 && !!created.body?.row?.id, `${created.status} ${created.text.slice(0, 300)}`)
  const [list1, list2] = [await new Http(one.publicUrl).get('/api/content/category'), await new Http(two.publicUrl).get('/api/content/category')]
  check('it is in site 1\'s content API', list1.status === 200 && list1.text.includes(entry.slug), `${list1.status}`)
  check('it is not in site 2\'s content API', list2.status === 200 && !list2.text.includes(entry.slug) && list2.text.includes('"slug"'), `${list2.status}`)
  const inDb = async (row) => (await query(row.databaseUrl, 'select count(*)::int as n from category where slug = $1', [entry.slug]))[0].n
  check('it is in site 1\'s database and not in site 2\'s', await inDb(row1) === 1 && await inDb(row2) === 0)
  check('site 2\'s admin does not know it', (await admin2.get(`/api/cms/category/${created.body.row.id}`)).status === 404 && (await admin1.get(`/api/cms/category/${created.body.row.id}`)).status === 200)

  // ── 4 · sessions ──
  log('4 · a session of one site is refused on the other')
  const samePeople = await Promise.all([row1, row2].map(async (row) => (await query(row.databaseUrl, 'select email from cms_users order by email')).map((r) => r.email).join(',')))
  check('both databases were seeded the same way: the same two people are on both sites', samePeople[0] === samePeople[1] && samePeople[0].includes(owner.email), samePeople.join(' | '))
  check('site 1\'s session works on site 1', (await admin1.get('/api/cms/_auth/me')).status === 200)
  const stolen = await Promise.all(['/api/cms/_auth/me', '/api/cms/category', '/api/cms/_users'].map(async (path) => (await new Http(two.publicUrl).get(path, { cookie: admin1.cookie })).status))
  check('site 1\'s session is refused on site 2 (401)', stolen.every((status) => status === 401), stolen.join(' '))
  check('site 2\'s own session works', (await admin2.get('/api/cms/_auth/me')).status === 200)
  check('and is refused on site 1 (401)', (await new Http(one.publicUrl).get('/api/cms/_auth/me', { cookie: admin2.cookie })).status === 401)
  const status = (url, token) => fetch(`${url}/api/health/status`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }))
  const [own1, cross] = [await status(one.publicUrl, row1.config.status.token), await status(two.publicUrl, row1.config.status.token)]
  check('site 1\'s status token opens site 1\'s status and is refused on site 2', own1.status === 200 && own1.body?.people?.active === 2 && cross.status === 401, `${own1.status} ${JSON.stringify(own1.body?.people)} ${cross.status}`)
  // The cloud asks each site, with that site's token, whether its owner has gone in (at most every few seconds).
  const noted = await waitFor(async () => {
    const now = await Promise.all([one, two].map(async (s) => (await api.get(`/api/sites/${s.id}`)).body?.site))
    return now.every((s) => s?.ownerAccepted === true && s.inviteUrl === null) ? now : null
  }, { timeout: 20_000, every: 1000, what: 'the cloud to learn that the owner went into both admins' })
  check('the cloud learns from each site itself that its owner went in', noted.length === 2)

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
  const held = filesUnder(dataDir).filter((f) => f.endsWith(`/${fileName}`))
  check('it lies only under site 1\'s folder', held.length === 1 && held[0].startsWith(join(folder1, 'uploads') + '/') && !filesUnder(folder2).some((f) => f.includes(fileName)), held.join(' '))
  check('each site keeps its own uploads in its own folder', filesUnder(join(folder1, 'uploads')).length > 1 && filesUnder(join(folder2, 'uploads')).length > 0 && row1.config.storage.local.dir === join(folder1, 'uploads') && row2.config.storage.local.dir === join(folder2, 'uploads'))

  // ── 6 · an unknown host ──
  log('6 · an unknown host on that port')
  const nobody = await page(`http://nikdo-${stamp}.localhost:${sitePort}`)
  check('an unknown host gets 404 and no page', nobody.status === 404 && nobody.text.includes('No website at this address'), `${nobody.status} ${nobody.text.slice(0, 80)}`)
  const byIp = await page(`http://127.0.0.1:${sitePort}`)
  check('so does the bare IP address', byIp.status === 404, `${byIp.status}`)
  check('a site\'s session opens nothing there either', (await new Http(`http://nikdo-${stamp}.localhost:${sitePort}`).get('/api/cms/_auth/me', { cookie: admin1.cookie })).status === 404)

  // ── 8 · memory, with both sites loaded (before one is deleted) ──
  for (const s of [one, two]) for (const path of ['/', '/galerie', '/cenik', '/kontakt']) await page(s.publicUrl, path)
  const withTwo = (await templateProcesses())[0]
  measures.memory = { withTwoSitesMB: Math.round(withTwo.rssBytes / 1048576) }

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
  check('its row left the directory, and site 2\'s stayed as it was', JSON.stringify(directory()) === JSON.stringify([row2]))
  check('its database is gone', !(await siteDatabases()).includes(db1))
  check('its database user is gone', !(await siteRoles()).includes(db1))
  const gone = await page(one.publicUrl)
  check('its address answers 404 now', gone.status === 404 && gone.text.includes('No website at this address'), `${gone.status}`)
  const still = await page(two.publicUrl)
  check('site 2 keeps answering, with its content', (await ready(two.publicUrl))?.migrations === 'done' && still.status === 200 && still.text.includes('Foto Zápisník'), `${still.status}`)
  check('site 2\'s session still works, and its database is there', (await admin2.get('/api/cms/_auth/me')).status === 200 && (await siteDatabases()).join() === db2 && (await siteRoles()).join() === db2)
  const after = await templateProcesses()
  check('the process is the same one as before', after.length === 1 && after[0].pid === pid && (await listeners(sitePort)).join() === String(pid), `${after.map((p) => p.pid).join(',')} was ${pid}`)
  check('the address of the deleted site is free again', (await api.get(`/api/slug?slug=${one.slug}`)).body?.ok === true)

  // ── 8 · memory ──
  log('8 · memory of the one process')
  measures.memory.withOneSiteMB = Math.round(after[0].rssBytes / 1048576)
  log(`    RSS with two sites: ${measures.memory.withTwoSitesMB} MB; after site 1 was deleted: ${measures.memory.withOneSiteMB} MB (pid ${pid})`)
  check('the memory was measured', measures.memory.withTwoSitesMB > 0)

  // ── 7, looked at again: the deleted site's folder ──
  // Not asked the moment the removal ends: what the template's process still had in work for
  // the site would not show yet.
  log('7 · the deleted site\'s folder, a few seconds after the removal')
  await sleep(Math.max(0, 5000 - (Date.now() - removedAt)))
  const back = filesUnder(folder1)
  const said = readFileSync(join(templateDir, 'server.log'), 'utf8').split('\n').find((line) => line.includes('smaller copies of a picture')) ?? ''
  check('its folder is gone, and stays gone', !existsSync(folder1),
    `the driver removed it and the cloud marked the site removed; ${Math.round((Date.now() - removedAt) / 1000)} s later the folder is there again with ${back.length} file(s), written by the template's process, which went on with a picture of the site after the site left the directory: ${back.slice(0, 3).map((f) => f.slice(folder1.length + 1)).join(', ')}${said ? `; its log: ${said.slice(0, 200)}` : ''}`, { go: true })

  // ── 9 · the template's process is gone ──
  log('9 · the template\'s process stops (as after a reboot): the cloud starts it again')
  check('the script stops the one process it knows by its marker', (await stopTemplateProcesses()).map((p) => p.pid).join() === String(pid) && !(await alive(pid)) && (await ready(two.publicUrl)) === null)
  const again = await api.post(`/api/sites/${two.id}/invite`)
  check('the cloud reaches the site again', again.status === 200, `${again.status} ${again.text.slice(0, 200)}`)
  const restarted = await templateProcesses()
  check('one new process serves it, on the same port', restarted.length === 1 && restarted[0].pid !== pid && appFile().pid === restarted[0].pid && appFile().port === sitePort && (await listeners(sitePort)).join() === String(restarted[0].pid), JSON.stringify(restarted.map((p) => p.pid)))
  const home = await page(two.publicUrl)
  check('site 2 is back with its content and its session', home.status === 200 && home.text.includes('Foto Zápisník') && (await admin2.get('/api/cms/_auth/me')).status === 200, `${home.status}`)
  check('the deleted site did not come back with it', (await page(one.publicUrl)).status === 404 && JSON.stringify(directory()) === JSON.stringify([row2]))
  // app.json is lost while the process runs: the port comes back from what the cloud keeps
  // about the site, the pid from the process that listens there and carries the folder's marker.
  // (Its app secret is made anew: after the next restart people sign in to the sites again.)
  rmSync(join(templateDir, 'app.json'))
  const found = await api.post(`/api/sites/${two.id}/invite`)
  check('app.json is lost: it is written again with the same port and the running process\'s pid', found.status === 200 && appFile().port === sitePort && appFile().pid === restarted[0].pid && mode(join(templateDir, 'app.json')) === '600' && (await templateProcesses()).map((p) => p.pid).join() === String(restarted[0].pid), `${found.status} ${JSON.stringify([appFile().port, appFile().pid])}`)

  // ── 10 · a step fails, "Try again" goes on ──
  log('10 · the start step fails (another program holds the template\'s port); "Try again" goes on from it')
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
  check('it answers with its name and look, from the template\'s one process', home3.status === 200 && home3.text.includes('Třetí web') && home3.text.includes('data-look="atelier"') && new URL(retried.publicUrl).port === String(sitePort) && (await templateProcesses()).length === 1, `${home3.status}`)
  check('site 2 came back with it', (await page(two.publicUrl)).text.includes('Foto Zápisník') && directory().map((r) => r.id).join() === [two.id, third.id].join())

  // ── 11 · the directory file is lost ──
  log('11 · the site directory is lost: the cloud writes every row of the template again from what it keeps')
  const byId = (list) => JSON.stringify([...list].sort((a, b) => a.id.localeCompare(b.id)))
  const before = directory()
  const pidNow = appFile().pid
  rmSync(join(templateDir, 'sites.json'))
  // Asking for a fresh invitation makes the cloud see to that one site first (ensureRunning).
  const asked = await api.post(`/api/sites/${two.id}/invite`)
  check('the cloud still reaches the site it was asked about', asked.status === 200 && asked.body?.site?.ownerAccepted === true, `${asked.status} ${asked.text.slice(0, 200)}`)
  check('the directory is back with the rows of both sites as they were, readable by its owner only', before.length === 2 && byId(directory()) === byId(before) && mode(join(templateDir, 'sites.json')) === '600', directory().map((r) => r.id).join())
  const both = await Promise.all([two, retried].map((s) => page(s.publicUrl)))
  check('both sites answer from the same process', both.every((r) => r.status === 200) && both[0].text.includes('Foto Zápisník') && both[1].text.includes('Třetí web') && (await templateProcesses()).map((p) => p.pid).join() === String(pidNow), both.map((r) => r.status).join(' '))
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
  if (failed && existsSync(join(templateDir, 'server.log'))) console.error('--- last lines of the template process\'s log ---\n' + readFileSync(join(templateDir, 'server.log'), 'utf8').split('\n').slice(-25).join('\n'))
  await cloud?.stop().catch(() => {})
  if (keep) {
    const procs = await templateProcesses().catch(() => [])
    log(`kept: ${procs.map((p) => `the ${p.template} process (pid ${p.pid})`).join(', ') || 'no process'}, the databases ${PREFIX}_… and ${DB}, and ${dataDir}`)
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
  if (measures.memory) log(`memory of the one process: ${measures.memory.withTwoSitesMB} MB with two sites`)
  if (failed && existsSync(logFile)) console.error('--- last lines of the cloud app log ---\n' + readFileSync(logFile, 'utf8').split('\n').slice(-25).join('\n'))
}
process.exit(failed ? 1 : 0)
