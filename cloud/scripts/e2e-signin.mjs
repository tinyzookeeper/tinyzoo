// Sign-in with the tinyzoo account for real, locally, in a real browser: the cloud app as the
// issuer and real tinyzoo sites as its clients (docs/multi-tenant-plan.md, 2.15).
//
//   pnpm --filter tinyzoo-cloud e2e:signin     # needs the template built: pnpm --filter tinyzoo-cloud templates:build photographer
//
// It starts a cloud app of its own with the shared driver (database tz_cloud_signin_e2e, data
// under .data/signin-e2e, template ports 4540–4559, site databases and users tzsi_e2e_…, the app
// on 3285 or the next free port, its own build folder), and two single-site processes of the
// built Photographer template (ports 4560 and 4561, databases tzsi_e2e_own_a and _b) for the
// websites somebody runs themselves. It removes everything it made at the end (--keep leaves
// it; --headed shows the browser). The names and ports can be set from the environment:
// E2E_SIGNIN_DB, E2E_SIGNIN_SITE_PREFIX, E2E_SIGNIN_PORT, E2E_SIGNIN_SITE_PORTS ("4540-4559"),
// E2E_SIGNIN_OWN_PORTS ("4560-4561"), E2E_SIGNIN_DATA (the folder's name under .data); the
// Postgres server from CLOUD_PG_URL.
//
// e2e:account plays the website's side by hand and e2e:shared never signs in through the
// account: here the two real halves meet. A browser (Chromium, as e2e.mjs launches it) does
// what a person does where clicking matters: "Open the admin", the switcher, the buttons of the
// sign-in pages, making an account. Everything else goes over HTTP with the same cookies, and
// the databases of both sides are read to see what was really kept. Every check is printed.
//
// Screenshots (desktop and phone width) are saved to cloud/.preview/signin/.
import { execFile, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import pg from 'pg'
import { chromium, firefox, webkit } from 'playwright'
import { alive, arg, cloudDir, dbUrl, freePortFrom, log, portFree, sleep, startCloud, templateEntries, waitFor, withPg } from './lib.mjs'

const run = promisify(execFile)
const keep = arg('keep', false) === true
const headed = arg('headed', false) === true
const DB = process.env.E2E_SIGNIN_DB || 'tz_cloud_signin_e2e'
const PREFIX = process.env.E2E_SIGNIN_SITE_PREFIX || 'tzsi_e2e'
const [portFrom, portTo] = (process.env.E2E_SIGNIN_SITE_PORTS || '4540-4559').split('-').map(Number)
const PORTS = { from: portFrom, to: portTo }
const [ownFrom, ownTo] = (process.env.E2E_SIGNIN_OWN_PORTS || '4560-4561').split('-').map(Number)
const APP_PORT = Number(process.env.E2E_SIGNIN_PORT) || 3285
const dataDir = join(cloudDir, '.data', process.env.E2E_SIGNIN_DATA || 'signin-e2e')
const templateDir = join(dataDir, 'photographer')
const ownDir = join(dataDir, 'own')
const preview = join(cloudDir, '.preview')
const shots = join(preview, 'signin')
const logFile = join(preview, 'e2e-signin-cloud.log')
const HOST_COOKIE = '__Host-tinyzoo'
const stamp = Date.now().toString(36).slice(-5)
const startedAt = Date.now()
const results = []
const findings = { hostCookie: {} }

if (!/^[a-z][a-z0-9_]*_e2e$/.test(DB)) { console.error(`E2E_SIGNIN_DB must be a database of this script's own, named …_e2e (it is dropped): ${DB}`); process.exit(2) }
if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(PREFIX)) { console.error(`E2E_SIGNIN_SITE_PREFIX is not a usable prefix: ${PREFIX}`); process.exit(2) }
if (!Number.isInteger(PORTS.from) || !Number.isInteger(PORTS.to) || PORTS.to < PORTS.from) { console.error('E2E_SIGNIN_SITE_PORTS must be "from-to"'); process.exit(2) }
if (!Number.isInteger(ownFrom) || !Number.isInteger(ownTo) || ownTo < ownFrom + 1) { console.error('E2E_SIGNIN_OWN_PORTS must be "from-to" with at least two ports'); process.exit(2) }
if (!existsSync(templateEntries.photographer)) {
  console.error(`The template "photographer" is not built (${templateEntries.photographer}).\nRun: pnpm --filter tinyzoo-cloud templates:build photographer`)
  process.exit(2)
}

/** `go`: a failure is counted and the run goes on. */
function check(name, ok, detail = '', { go = false } = {}) {
  results.push({ name, ok: !!ok, detail: ok ? '' : String(detail) })
  log(ok ? '  ✓' : '  ✗', name, detail && !ok ? `— ${detail}` : '')
  if (!ok && !go) throw new Error(`failed: ${name}${detail ? ` (${detail})` : ''}`)
}
/** Something found out, not a pass or a fail: printed, and kept for the result file. */
const note = (text) => log('    ·', text)

// ── a small client that keeps its cookies (a site's admin API, the cloud's API) ──

class Http {
  constructor(base) { this.base = base.replace(/\/+$/, ''); this.cookies = new Map() }
  get cookie() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
  async request(method, path, { json } = {}) {
    const headers = { accept: 'application/json', origin: this.base }
    if (this.cookie) headers.cookie = this.cookie
    let body
    if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json) }
    const res = await fetch(this.base + path, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(60_000) })
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';').map((x) => x.trim())
      const at = pair.indexOf('=')
      if (!pair.slice(at + 1) || attrs.some((a) => /^max-age=0$/i.test(a))) this.cookies.delete(pair.slice(0, at))
      else this.cookies.set(pair.slice(0, at), pair.slice(at + 1))
    }
    const text = await res.text()
    let parsed = null
    try { parsed = text ? JSON.parse(text) : null } catch { /* not JSON */ }
    return { status: res.status, body: parsed, text, location: res.headers.get('location') }
  }
  get(path) { return this.request('GET', path) }
  post(path, json) { return this.request('POST', path, { json }) }
  patch(path, json) { return this.request('PATCH', path, { json }) }
}

// ── Postgres: only what this run made ──

const SHARED_NAME = new RegExp(`^${PREFIX}_[0-9a-f]{8}(_[0-9a-f]{4}){3}_[0-9a-f]{12}$`)
const OWN_NAME = new RegExp(`^${PREFIX}_own_[ab]$`)
const own = (name) => {
  if (!SHARED_NAME.test(name) && !OWN_NAME.test(name) && name !== DB) throw new Error(`refusing to touch ${name}`)
  return `"${name}"`
}
const like = `${PREFIX.replace(/_/g, '\\_')}\\_%`
const ours = (n) => SHARED_NAME.test(n) || OWN_NAME.test(n)
const siteDatabases = () => withPg(async (c) => (await c.query('select datname as name from pg_database where datname like $1 order by 1', [like])).rows.map((r) => r.name).filter(ours))
const siteRoles = () => withPg(async (c) => (await c.query('select rolname as name from pg_roles where rolname like $1 order by 1', [like])).rows.map((r) => r.name).filter((n) => SHARED_NAME.test(n)))
const dropCloudDatabase = () => withPg((c) => c.query(`drop database if exists ${own(DB)} with (force)`))

async function query(url, text, params = []) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 8000 })
  await client.connect()
  try { return (await client.query(text, params)).rows }
  finally { await client.end().catch(() => {}) }
}
/** The cloud's own database. */
const cloudDb = (text, params) => query(dbUrl(DB), text, params)

// ── the processes of this run's data folder ──

async function processesWith(marker) {
  const { stdout } = await run('ps', ['-axo', 'pid=,command='])
  return stdout.split('\n').map((l) => l.trim().match(/^(\d+)\s+(.*)$/)).filter(Boolean)
    .filter((m) => m[2].split(/\s+/).some((word) => word.startsWith(marker)))
    .map((m) => ({ pid: Number(m[1]), name: m[2].split(marker)[1].split(/\s/)[0] }))
}
/** The template's process the shared driver started under this run's folder (`--template-dir=<folder>`). */
const templateProcesses = () => processesWith(`--template-dir=${resolve(dataDir)}/`)
/** The single-site processes this script started (`--site-dir=<folder>`, as the local driver marks its own). */
const ownProcesses = () => processesWith(`--site-dir=${resolve(ownDir)}/`)

/** Stop them: only pids whose command line names a folder under this run's data folder; asked first, then insisted on. */
async function stopProcesses(list) {
  const procs = await list()
  for (const p of procs) { try { process.kill(p.pid, 'SIGTERM') } catch { /* gone */ } }
  for (let i = 0; i < 40; i++) {
    if (!(await Promise.all(procs.map((p) => alive(p.pid)))).some(Boolean)) break
    await sleep(250)
  }
  for (const p of await list()) {
    if (procs.some((was) => was.pid === p.pid)) { try { process.kill(p.pid, 'SIGKILL') } catch { /* gone */ } }
  }
  return procs
}

async function cleanUp() {
  const stopped = [...await stopProcesses(templateProcesses), ...await stopProcesses(ownProcesses)]
  const databases = await siteDatabases()
  const roles = await siteRoles()
  await withPg(async (c) => {
    for (const name of databases) await c.query(`drop database if exists ${own(name)} with (force)`)
    for (const name of roles) await c.query(`drop role if exists ${own(name)}`)
  })
  if (existsSync(dataDir) && resolve(dataDir).startsWith(join(cloudDir, '.data') + '/')) rmSync(dataDir, { recursive: true, force: true })
  return { processes: stopped.map((p) => p.pid), databases: databases.length, roles: roles.length }
}

// ── the cloud app ──

let cloud = null
let cloudPort = 0
const sessionPassword = randomBytes(32).toString('hex')
const cloudEnv = (extra = {}) => ({
  NUXT_DATABASE_URL: dbUrl(DB),
  // The cloud's own session survives a restart of the app (the script stops and starts it).
  NUXT_SESSION_PASSWORD: sessionPassword,
  NUXT_HOSTING_DRIVER: 'shared',
  NUXT_HOSTING_SHARED_DATA_DIR: dataDir,
  NUXT_HOSTING_SHARED_DATABASE_PREFIX: PREFIX,
  NUXT_HOSTING_SHARED_PORT_FROM: String(PORTS.from),
  NUXT_HOSTING_SHARED_PORT_TO: String(PORTS.to),
  NUXT_MAX_SITES_PER_USER: '3',
  NUXT_REQUIRE_VERIFIED_EMAIL: 'false',
  NUXT_MAIL_TRANSPORT: 'log',
  CLOUD_BUILD_DIR: '.nuxt-scripts-signin',
  ...extra,
})
async function startCloudApp(extra = {}) {
  cloud = await startCloud({ port: cloudPort, logFile, env: cloudEnv(extra) })
  return cloud
}

/** The site directory of the shared driver: one row per cloud-made site. */
const directory = () => JSON.parse(readFileSync(join(templateDir, 'sites.json'), 'utf8')).sites
const rowOf = (siteId) => directory().find((r) => r.id === siteId)
/** A cloud-made site's own database (as the site's own user). */
const siteDb = (siteId, text, params) => query(rowOf(siteId).databaseUrl, text, params)
const usersOf = (siteId) => siteDb(siteId, 'select id, email, role, status, (password_hash is not null) as has_password from cms_users order by created_at')
const userOf = async (siteId, email) => (await usersOf(siteId)).find((u) => u.email === email)
const linksOf = (siteId) => siteDb(siteId, `select key, value from cms_state where key like 'account:%' or key like 'account-of:%' order by key`)
/** What the issuer keeps about a person at a client. */
const memberAt = async (clientId, userId) => (await cloudDb('select role, active, confirmed_at is not null as confirmed from account_members where client_id = $1 and user_id = $2', [clientId, userId]))[0] ?? null

// ── the browser ──

let browser = null
const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const newContext = (opts = {}) => browser.newContext({ viewport: DESKTOP, locale: 'cs-CZ', ...opts })

/** Every address the page's main frame asked for (redirects included), oldest first. */
function follow(page) {
  const hops = []
  page.on('request', (req) => { if (req.isNavigationRequest() && req.frame() === page.mainFrame()) hops.push(req.url()) })
  return hops
}
const pathsOf = (hops, origin) => hops.filter((u) => u.startsWith(origin)).map((u) => new URL(u).pathname)

/** The cloud's pages say when they are interactive (app/plugins/ready.client.ts). */
async function openCloud(page, path) {
  await page.goto(cloud.url + path)
  await page.waitForSelector('html[data-app-ready]', { timeout: 60_000 })
}

/** Wait until the page is a site's admin (not its sign-in page), and drawn. */
async function untilAdmin(page, site, timeout = 30_000) {
  await page.waitForURL((u) => u.origin === site && /^\/admin\/?$/.test(u.pathname), { timeout })
  await page.waitForSelector('.cms-sidebar', { timeout })
}

/** A request of the page itself (its cookies, its origin): the site's or the cloud's JSON API. */
const api = (page, method, path, body) => page.evaluate(async ({ method, path, body }) => {
  const res = await fetch(path, { method, headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let parsed = null
  try { parsed = text ? JSON.parse(text) : null } catch { /* not JSON */ }
  return { status: res.status, body: parsed }
}, { method, path, body })
const meOf = (page) => api(page, 'GET', '/api/cms/_auth/me')

/** Open the switcher (the site's name at the top of the menu) and read it. On a phone the menu is behind its button. */
async function openSwitcher(page) {
  const button = page.locator('[data-cms-site-switch]:visible')
  if (!(await button.count())) {
    const toggle = page.locator('button[data-sidebar-toggle], [data-slot="sidebar-toggle"], button[aria-label="Open sidebar"], button[aria-label="Otevřít postranní panel"]').first()
    if (await toggle.count()) await toggle.click()
  }
  await button.first().waitFor({ timeout: 20_000 })
  await button.first().click()
  await page.locator('[role=menu]').first().waitFor()
  const sites = await page.locator('[role=menuitemcheckbox]').evaluateAll((items) => items.map((el) => ({
    text: el.innerText.replace(/\s+/g, ' ').trim(), checked: el.getAttribute('aria-checked') === 'true' || el.getAttribute('data-state') === 'checked',
  })))
  const others = await page.locator('[role=menu] [role=menuitem]').evaluateAll((items) => items.map((el) => el.innerText.replace(/\s+/g, ' ').trim()))
  return { sites, others }
}
/** A website's row in the open switcher, by its name (the list is in the order the websites were made). */
const row = (menu, name) => menu.sites.find((s) => s.text === name || s.text.startsWith(`${name} `)) ?? { text: '', checked: false }
const closeMenu = async (page) => { await page.keyboard.press('Escape'); await page.locator('[role=menu]').first().waitFor({ state: 'detached' }).catch(() => {}) }
const chooseSite = (page, name) => page.locator('[role=menuitemcheckbox]', { hasText: name }).first().click()

/** A picture at desktop width from `page`, and one at phone width from a browser with the same cookies at the same address. */
async function picture(name, page, { prepare = null, fullPage = false } = {}) {
  await sleep(450) // a menu that is opening has finished
  await page.screenshot({ path: join(shots, `${name}-desktop.png`), fullPage })
  const state = await page.context().storageState()
  const ctx = await browser.newContext({ viewport: PHONE, locale: 'cs-CZ', deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: state })
  try {
    const phone = await ctx.newPage()
    await phone.goto(page.url(), { waitUntil: 'networkidle' })
    if (prepare) await prepare(phone)
    await sleep(400)
    await phone.screenshot({ path: join(shots, `${name}-phone.png`), fullPage })
  }
  finally {
    await ctx.close()
  }
  findings.screenshots = [...(findings.screenshots ?? []), join(shots, `${name}-desktop.png`), join(shots, `${name}-phone.png`)]
}

// ── people at the cloud ──

/** Make an account through the cloud's own page, in a browser of its own; `confirm` opens the confirmation link the page shows in development. */
async function signUp(name, slug, { confirm = true } = {}) {
  const ctx = await newContext()
  const page = await ctx.newPage()
  const person = { name, email: `${slug}-${stamp}@example.com`, password: `dlouhe-heslo-${slug}-1`, ctx, page }
  await openCloud(page, '/signup')
  await page.locator('[data-field-name]').fill(person.name)
  await page.locator('[data-field-email]').fill(person.email)
  await page.locator('[data-field-password]').fill(person.password)
  await page.locator('[data-submit]').click()
  await page.waitForURL('**/sites')
  if (confirm) await confirmEmail(person)
  person.id = (await (await ctx.request.get(`${cloud.url}/api/account`)).json()).user.id
  return person
}
/** Open the link of the confirmation e-mail (the development pages show it; here it is asked from the account). */
async function confirmEmail(person) {
  const account = await (await person.ctx.request.get(`${cloud.url}/api/account`)).json()
  if (!account.devVerifyUrl) throw new Error(`no confirmation link for ${person.email}`)
  const tab = await person.ctx.newPage()
  await tab.goto(account.devVerifyUrl)
  await tab.waitForSelector('[data-verify=done]', { timeout: 30_000 })
  await tab.close()
}
const accountOf = async (person) => (await (await person.ctx.request.get(`${cloud.url}/api/account`)).json())
const mySites = async (person) => (await (await person.ctx.request.get(`${cloud.url}/api/sites`)).json())

/** Make Photographer sites for a person (the cloud's API with the browser's own cookies) and wait until they are ready. */
async function makeSites(person, wanted) {
  const made = await Promise.all(wanted.map((w) => person.ctx.request.post(`${cloud.url}/api/sites`, { data: { template: 'photographer', ...w } })))
  const bad = made.find((r) => r.status() !== 201)
  if (bad) throw new Error(`a site was not accepted: ${bad.status()} ${(await bad.text()).slice(0, 200)}`)
  const ids = await Promise.all(made.map(async (r) => (await r.json()).site.id))
  return waitFor(async () => {
    const now = await Promise.all(ids.map(async (id) => (await (await person.ctx.request.get(`${cloud.url}/api/sites/${id}`)).json()).site))
    const failed = now.find((s) => s.status === 'failed')
    if (failed) throw new Error(`a site failed: ${JSON.stringify(failed.steps)} ${failed.errorDetail ?? ''}`)
    return now.every((s) => s.status === 'ready') ? now : null
  }, { timeout: 300_000, every: 500, what: 'the sites to be ready' })
}
const clientIdOf = (siteId) => rowOf(siteId).config.auth.account.clientId

// ── a website somebody runs themselves: the built template as an ordinary single-site process ──

/** Start one; `publicUrl` is what the site is TOLD its address is (it may be typed in any form). */
async function startOwnSite({ key, port, publicUrl, envLines }) {
  if (!(await portFree(port))) throw new Error(`port ${port} is in use`)
  const dir = join(ownDir, key)
  mkdirSync(join(dir, 'mail'), { recursive: true })
  const database = `${PREFIX}_own_${key}`
  await withPg((c) => c.query(`create database ${own(database)}`))
  const out = openSync(join(dir, 'site.log'), 'a')
  const setupToken = randomBytes(18).toString('base64url')
  // The three lines the cloud's "Connect a website you already run" page gave, as they are.
  const account = Object.fromEntries(envLines.split('\n').map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]))
  const child = spawn(process.execPath, [templateEntries.photographer, `--site-dir=${dir}`], {
    cwd: dir, detached: true, stdio: ['ignore', out, out],
    env: {
      PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      DATABASE_URL: dbUrl(database),
      NUXT_APP_SECRET: randomBytes(36).toString('base64url'),
      NUXT_CMS_PUBLIC_URL: publicUrl,
      NUXT_CMS_AUTH_SETUP_TOKEN: setupToken,
      NUXT_CMS_MIGRATIONS_ON_START: 'true',
      NUXT_CMS_STORAGE_LOCAL_DIR: join(dir, 'uploads'),
      // This website's e-mails are written to files, so the invitation can be read as its reader gets it.
      NUXT_CMS_MAIL_TRANSPORT: 'file', NUXT_CMS_MAIL_FILE_DIR: join(dir, 'mail'),
      ...account,
    },
  })
  child.unref()
  const url = new URL(publicUrl).origin
  await waitFor(async () => {
    if (!(await alive(child.pid))) throw new Error(`the site ${key} stopped while starting; see ${join(dir, 'site.log')}`)
    try { return (await fetch(`${url}/api/health/ready`, { signal: AbortSignal.timeout(3000) })).status === 200 } catch { return false }
  }, { timeout: 120_000, every: 400, what: `the site ${key} to answer` })
  return { key, url, port, pid: child.pid, dir, database, setupToken, clientId: account.NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID, db: (text, params) => query(dbUrl(database), text, params), mail: () => readdirSync(join(dir, 'mail')).map((f) => JSON.parse(readFileSync(join(dir, 'mail', f), 'utf8'))) }
}

let failed = null
mkdirSync(shots, { recursive: true })

async function main() {
  log('preparing: nothing of an earlier run is left, a clean database for the cloud')
  const left = await cleanUp()
  if (left.processes.length || left.databases || left.roles) log(`    removed what an earlier run left: ${left.processes.length} process(es), ${left.databases} database(s), ${left.roles} user(s)`)
  await dropCloudDatabase()
  await withPg((c) => c.query(`create database ${own(DB)}`))
  if (existsSync(logFile)) rmSync(logFile)
  cloudPort = await freePortFrom(APP_PORT)
  await startCloudApp()
  log(`cloud app up at ${cloud.url} (the issuer, shared driver)`)
  browser = await chromium.launch({ headless: !headed })

  // ════ 1 · the owner: no password anywhere but the account ════
  log('1 · the owner: an account, a confirmed e-mail, two Photographer sites, "Open the admin"')
  const owner = await signUp('Jana Nováková', 'jana')
  check('the owner makes an account on the cloud\'s page and confirms the e-mail with the link', (await accountOf(owner)).user.emailVerified === true)
  const [one, two] = await makeSites(owner, [
    { name: 'Ateliér Světlo', slug: `si-svetlo-${stamp}`, look: 'atelier' },
    { name: 'Foto Zápisník', slug: `si-zapisnik-${stamp}`, look: 'zapisnik' },
  ])
  check('two Photographer sites are ready, served by one process, each a client of the account service', new URL(one.publicUrl).port === new URL(two.publicUrl).port && (await templateProcesses()).length === 1 && clientIdOf(one.id) !== clientIdOf(two.id), `${one.publicUrl} ${two.publicUrl}`)
  const before = await userOf(one.id, owner.email)
  check('site 1 holds the owner as an INVITED administrator with no password', before?.status === 'invited' && before.role === 'admin' && before.has_password === false, JSON.stringify(before))
  await openCloud(owner.page, `/sites/${one.id}`)
  await owner.page.waitForSelector('[data-open-admin]')
  check('the cloud\'s page of site 1 leads with "Open the admin" and says the owner has not been in yet', await owner.page.locator('[data-admin=first][data-admin-way=account]').count() === 1 && (await owner.page.locator('[data-open-admin]').getAttribute('href')) === `${one.publicUrl}/api/cms/_auth/account/start?next=/admin`)
  await picture('cloud-site-page', owner.page)

  const [admin1] = await Promise.all([owner.ctx.waitForEvent('page'), owner.page.locator('[data-open-admin]').click()])
  const hops1 = follow(admin1)
  await untilAdmin(admin1, one.publicUrl)
  const me1 = await meOf(admin1)
  check('clicking it lands in site 1\'s admin, signed in as the owner, an administrator', me1.status === 200 && me1.body.user.email === owner.email && me1.body.user.role === 'admin', JSON.stringify(me1.body?.user))
  check('no password was typed for the site: the only form the owner ever filled is the cloud\'s sign-up', !admin1.url().includes('/login') && me1.body.noPassword === true)
  const after = await userOf(one.id, owner.email)
  check('the site\'s user row turned from invited to active, still without a password', after?.status === 'active' && after.has_password === false && after.id === before.id, JSON.stringify(after))
  const links1 = await linksOf(one.id)
  check('the site linked that user to the account (two rows of cms_state, issuer and sub)', links1.length === 2 && links1.every((r) => r.value.issuer === cloud.url && r.value.sub === owner.id) && links1.some((r) => r.value.userId === after.id), JSON.stringify(links1))
  // Difference 1: the site reports before it sends the browser on, so nothing here waits.
  const member1 = await memberAt(clientIdOf(one.id), owner.id)
  check('the issuer already has the site\'s report: the owner is let in there as admin (membership, in order after the code)', member1?.active === true && member1.confirmed === true && member1.role === 'admin', JSON.stringify(member1))
  await owner.page.bringToFront()
  await owner.page.waitForSelector('[data-admin=open]', { timeout: 20_000 })
  const seen = (await (await owner.ctx.request.get(`${cloud.url}/api/sites/${one.id}`)).json()).site
  check('the cloud\'s page then shows the owner as in, and the invitation link is gone from it', seen.ownerAccepted === true && seen.inviteUrl === null && await owner.page.locator('[data-invite]').count() === 0)
  const stillWaiting = (await (await owner.ctx.request.get(`${cloud.url}/api/sites/${two.id}`)).json()).site
  check('site 2, where the owner has not been, still shows them as not in', stillWaiting.ownerAccepted === false && typeof stillWaiting.inviteUrl === 'string')

  // ════ 2 · the switcher ════
  log('2 · the switcher: both sites with the role, the silent round trip, "All my websites"')
  await admin1.bringToFront()
  let menu = await openSwitcher(admin1)
  check('in site 1\'s admin the site\'s name is a menu listing both sites, site 1 checked', menu.sites.length === 2 && row(menu, 'Ateliér Světlo').checked && !!row(menu, 'Foto Zápisník').text && !row(menu, 'Foto Zápisník').checked, JSON.stringify(menu))
  check('it shows the role where the site has said one (site 1: administrator) and only the name where it has not yet (site 2)', row(menu, 'Ateliér Světlo').text === 'Ateliér Světlo Administrátor' && row(menu, 'Foto Zápisník').text === 'Foto Zápisník', JSON.stringify(menu.sites))
  check('"All my websites" is the menu\'s last entry', menu.others.length === 1 && menu.others[0] === 'Všechny moje weby', JSON.stringify(menu.others))
  await picture('switcher-first-visit', admin1, { prepare: async (phone) => { await openSwitcher(phone) } })
  hops1.length = 0
  await chooseSite(admin1, 'Foto Zápisník')
  await untilAdmin(admin1, two.publicUrl)
  const me2 = await meOf(admin1)
  check('choosing site 2 lands in site 2\'s admin, signed in', me2.status === 200 && me2.body.user.email === owner.email && me2.body.user.role === 'admin')
  const viaCloud = pathsOf(hops1, cloud.url)
  check('without a form: the site asked the account silently and the account answered at once (two redirects)', JSON.stringify(viaCloud) === '["/oauth/authorize"]' && hops1.some((u) => u.includes('prompt=none')) && JSON.stringify(pathsOf(hops1, two.publicUrl)) === '["/api/cms/_auth/account/start","/api/cms/_auth/account/callback","/admin"]', JSON.stringify(hops1.map((u) => u.split('?')[0])))
  check('site 2 accepted the owner\'s invitation the same way (active, no password)', (await userOf(two.id, owner.email))?.status === 'active' && (await userOf(two.id, owner.email)).has_password === false)
  menu = await openSwitcher(admin1)
  check('site 2\'s switcher lists both sites with the role in each, site 2 checked', menu.sites.length === 2 && row(menu, 'Ateliér Světlo').text === 'Ateliér Světlo Administrátor' && !row(menu, 'Ateliér Světlo').checked && row(menu, 'Foto Zápisník').text === 'Foto Zápisník Administrátor' && row(menu, 'Foto Zápisník').checked, JSON.stringify(menu.sites))
  await picture('switcher', admin1, { prepare: async (phone) => { await openSwitcher(phone) } })
  hops1.length = 0
  await chooseSite(admin1, 'Ateliér Světlo')
  await untilAdmin(admin1, one.publicUrl)
  check('back the same way: site 1 knows the browser already and asks the account nothing', (await meOf(admin1)).status === 200 && pathsOf(hops1, cloud.url).length === 0, JSON.stringify(hops1.map((u) => u.split('?')[0])))
  menu = await openSwitcher(admin1)
  check('and site 1\'s list, asked for anew on arrival, now carries the role of both', row(menu, 'Ateliér Světlo').text === 'Ateliér Světlo Administrátor' && row(menu, 'Ateliér Světlo').checked && row(menu, 'Foto Zápisník').text === 'Foto Zápisník Administrátor', JSON.stringify(menu.sites))
  await admin1.locator('[role=menu] [role=menuitem]').first().click()
  await admin1.waitForURL(`${cloud.url}/sites`)
  await admin1.waitForSelector('[data-site]')
  check('"All my websites" leads to the cloud\'s list, with both sites', await admin1.locator('[data-site]').count() === 2)

  // ════ 3 · an invited colleague, with no account yet ════
  log('3 · an invited colleague: no account yet, makes one, enters through it')
  await admin1.goto(`${one.publicUrl}/admin`)
  await untilAdmin(admin1, one.publicUrl)
  const colleagueEmail = `kolega-${stamp}@example.com`
  const invited = await api(admin1, 'POST', '/api/cms/_users', { email: colleagueEmail, role: 'editor' })
  check('the owner invites an e-mail address as an editor in site 1\'s admin', invited.status === 201 && typeof invited.body.inviteUrl === 'string' && invited.body.inviteUrl.startsWith(`${one.publicUrl}/admin/invite/`), `${invited.status} ${JSON.stringify(invited.body)}`)
  note('a cloud-made site only prints its e-mails (the cloud hands links over itself), so the admin gives the owner the invitation link to pass on; the e-mail\'s own wording is read in part 7, on a site that writes e-mails to files')
  const colleague = { name: 'Karel Kolega', email: colleagueEmail, password: 'dlouhe-heslo-kolegy-1', ctx: await newContext() }
  colleague.page = await colleague.ctx.newPage()
  const hopsC = follow(colleague.page)
  await colleague.page.goto(invited.body.inviteUrl, { waitUntil: 'networkidle' })
  check('the invitation page says the tinyzoo account of that address works too, with the way to it', await colleague.page.locator('[data-cms-invite-account]').count() === 1 && (await colleague.page.locator('[data-cms-invite-account]').innerText()).includes('tinyzoo účet'))
  await colleague.page.locator('[data-cms-invite-account] a').click()
  await colleague.page.waitForURL((u) => u.origin === cloud.url && u.pathname === '/login')
  await colleague.page.waitForSelector('html[data-app-ready]')
  check('the site sends the person to the cloud\'s sign-in page, which says which website they are going to', (await colleague.page.locator('[data-continue-to]').getAttribute('data-continue-to')) === new URL(one.publicUrl).host && (await colleague.page.locator('[data-continue-to]').innerText()).includes('Ateliér Světlo'))
  await colleague.page.locator('[data-signup]').click()
  await colleague.page.waitForURL((u) => u.pathname === '/signup')
  await colleague.page.locator('[data-field-name]').fill(colleague.name)
  await colleague.page.locator('[data-field-email]').fill(colleague.email)
  await colleague.page.locator('[data-field-password]').fill(colleague.password)
  await colleague.page.locator('[data-submit]').click()
  await colleague.page.waitForSelector('[data-signup-confirm]')
  check('with no account they make one there (/signup), and the page waits for the e-mail to be confirmed before it goes back', new URL(colleague.page.url()).pathname === '/signup' && (await userOf(one.id, colleague.email))?.status === 'invited')
  await confirmEmail(colleague)
  await colleague.page.locator('[data-continue]').click()
  await untilAdmin(colleague.page, one.publicUrl)
  colleague.id = (await accountOf(colleague)).user.id
  const meC = await meOf(colleague.page)
  check('once confirmed they land in site 1\'s admin, accepted as an editor, with the account\'s name', meC.status === 200 && meC.body.user.email === colleague.email && meC.body.user.role === 'editor' && meC.body.user.name === colleague.name, JSON.stringify(meC.body?.user))
  const rowC = await userOf(one.id, colleague.email)
  check('with no password on the site, and the invitation link used up', rowC.status === 'active' && rowC.has_password === false && meC.body.noPassword === true && (await fetch(`${one.publicUrl}/api/cms/_auth/invite/${invited.body.inviteUrl.split('/').pop()}`)).status === 410, JSON.stringify(rowC))
  check('the way there: the site, the cloud\'s sign-in and sign-up pages, the account\'s answer, the site', hopsC.some((u) => u.startsWith(`${cloud.url}/oauth/authorize`)) && hopsC.some((u) => u.startsWith(`${one.publicUrl}/api/cms/_auth/account/callback`)), JSON.stringify(hopsC.map((u) => u.split('?')[0])))
  await openCloud(colleague.page, '/sites')
  await colleague.page.waitForSelector('[data-member-sites]')
  const card = colleague.page.locator(`[data-member-site="${clientIdOf(one.id)}"]`)
  check('their "My websites" shows site 1 as a website they work on, with the role', await card.count() === 1 && (await card.innerText()).includes('Ateliér Světlo') && (await card.locator('[data-role]').innerText()).trim() === 'Vaše role: editor' && await colleague.page.locator('[data-site]').count() === 0, await card.count() ? await card.innerText() : 'no card')
  await picture('my-websites-member', colleague.page, { fullPage: true })
  const theirs = await mySites(colleague)
  check('and nothing else: no website of their own, and not site 2', theirs.sites.length === 0 && theirs.member.length === 1 && theirs.member[0].role === 'editor')
  const [adminC] = await Promise.all([colleague.ctx.waitForEvent('page'), card.locator('a').click()])
  await untilAdmin(adminC, one.publicUrl)
  const listC = await waitFor(async () => { const r = await api(adminC, 'GET', '/api/cms/_auth/account/sites'); return r.status === 200 ? r.body : null }, { what: 'the colleague\'s list of websites' })
  check('their switcher in site 1 does not list site 2: they are no member there', listC.linked === true && listC.sites.length === 1 && listC.sites[0].name === 'Ateliér Světlo' && listC.sites[0].role === 'editor' && listC.sites[0].current === true, JSON.stringify(listC))
  await sleep(600)
  check('so the site\'s name stays what it always was, not a menu', await adminC.locator('[data-cms-site-switch]').count() === 0)
  check('the issuer knows them at site 1 only', (await memberAt(clientIdOf(one.id), colleague.id))?.role === 'editor' && (await memberAt(clientIdOf(two.id), colleague.id)) === null)

  // ════ 4 · turned away ════
  log('4 · turned away: an account with no invitation; an owner whose e-mail is not confirmed')
  const stranger = await signUp('Cizí Člověk', 'cizi')
  const hopsS = follow(stranger.page)
  await stranger.page.goto(`${one.publicUrl}/admin/login`, { waitUntil: 'networkidle' })
  check('site 1\'s sign-in page has the account button above the password form', await stranger.page.locator('[data-cms-account-sign-in]').count() === 1 && await stranger.page.locator('input[autocomplete="current-password"]').count() === 1)
  await picture('site-sign-in', stranger.page)
  await stranger.page.locator('[data-cms-account-sign-in]').click()
  await stranger.page.waitForURL((u) => u.origin === one.publicUrl && u.pathname === '/admin/login' && u.searchParams.get('account') === 'no-access')
  await stranger.page.locator('[data-cms-account-notice]').waitFor()
  check('a person with an account but no invitation gets the no-access notice on the site', (await stranger.page.locator('[data-cms-account-notice]').innerText()).includes('Tento účet nemá k tomuto webu přístup') && (await meOf(stranger.page)).status === 401 && hopsS.some((u) => u.startsWith(`${cloud.url}/oauth/authorize`)))
  await picture('no-access', stranger.page)
  // Difference 2: the real exchange. The site said `{ sub, role: "", active: false }` about them.
  const turned = await memberAt(clientIdOf(one.id), stranger.id)
  check('the issuer took the site\'s report about them (the code they exchanged made them known): not let in, never confirmed, no role', turned !== null && turned.active === false && turned.confirmed === false && turned.role === null, JSON.stringify(turned))
  const strangers = await mySites(stranger)
  check('and they are listed nowhere: not on the site, not in "My websites", not in anybody\'s switcher', !(await userOf(one.id, stranger.email)) && strangers.member.length === 0 && !(await linksOf(one.id)).some((r) => r.value.sub === stranger.id))
  const told = await new Http(cloud.url).request('POST', '/oauth/membership', { json: { sub: owner.id, role: 'admin', active: true } })
  check('(a report without the site\'s secret is refused by the issuer: 401)', told.status === 401)
  const basic = (id, secret) => `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
  const about = async (siteId, json) => {
    const account = rowOf(siteId).config.auth.account
    const res = await fetch(`${cloud.url}/oauth/membership`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: basic(account.clientId, account.clientSecret) }, body: JSON.stringify(json) })
    return { status: res.status, body: await res.json().catch(() => null) }
  }
  const never = await about(two.id, { sub: stranger.id, role: 'admin', active: true })
  check('with its own secret, a site still cannot speak about a person who never exchanged a code there: 404 not_found', never.status === 404 && never.body?.error === 'not_found' && (await memberAt(clientIdOf(two.id), stranger.id)) === null, JSON.stringify(never))
  const kept = await about(one.id, { sub: colleague.id, active: true })
  check('and a report that leaves the role out, or sends one that cannot be used, keeps the role the issuer had', kept.status === 200 && (await about(one.id, { sub: colleague.id, role: '<b>x</b>', active: true })).status === 200 && (await memberAt(clientIdOf(one.id), colleague.id)).role === 'editor')

  const ota = await signUp('Ota Nový', 'ota', { confirm: false })
  const [otaSite] = await makeSites(ota, [{ name: 'Foto Ota', slug: `si-ota-${stamp}`, look: 'negativ' }])
  await openCloud(ota.page, `/sites/${otaSite.id}`)
  await ota.page.waitForSelector('[data-confirm-first]')
  check('an owner whose e-mail is NOT confirmed is told on the cloud\'s page to confirm it first, in place of "Open the admin"', await ota.page.locator('[data-admin-way=confirm]').count() === 1 && await ota.page.locator('[data-open-admin]').count() === 0 && (await ota.page.locator('[data-confirm-first]').innerText()).includes(ota.email))
  // They go to the site's own sign-in page and press the account button anyway.
  const otaTab = await ota.ctx.newPage()
  await otaTab.goto(`${otaSite.publicUrl}/admin/login`, { waitUntil: 'networkidle' })
  await otaTab.locator('[data-cms-account-sign-in]').click()
  await otaTab.waitForURL((u) => u.origin === otaSite.publicUrl && u.searchParams.get('account') === 'unverified')
  await otaTab.locator('[data-cms-account-notice]').waitFor()
  check('the site does not link an unverified e-mail: its sign-in page says to confirm the account\'s e-mail first', (await otaTab.locator('[data-cms-account-notice]').innerText()).includes('Nejdřív potvrďte e-mail svého tinyzoo účtu') && (await meOf(otaTab)).status === 401)
  const otaRow = await userOf(otaSite.id, ota.email)
  check('their user on the site stays invited, and nothing is linked', otaRow.status === 'invited' && (await linksOf(otaSite.id)).length === 0 && (await memberAt(clientIdOf(otaSite.id), ota.id))?.confirmed === false, JSON.stringify(otaRow))
  await picture('unverified', otaTab)

  // ════ 5 · an invitation older than its link ════
  log('5 · an invitation older than its link (aged in the site\'s database: 8 days)')
  const otaInvite = (await (await ota.ctx.request.get(`${cloud.url}/api/sites/${otaSite.id}`)).json()).site.inviteUrl
  const aged = await siteDb(otaSite.id, `update cms_tokens set created_at = now() - interval '8 days', expires_at = now() - interval '1 day' where kind = 'invite' and used_at is null returning id`)
  await cloudDb(`update sites set invite_sent_at = now() - interval '8 days' where id = $1`, [otaSite.id])
  await otaTab.goto(otaInvite, { waitUntil: 'networkidle' })
  check('the invitation\'s link no longer works; its page says so and offers the account', aged.length === 1 && (await fetch(`${otaSite.publicUrl}/api/cms/_auth/invite/${otaInvite.split('/').pop()}`)).status === 410 && await otaTab.locator('[data-cms-invite-expired-account]').count() === 1 && await otaTab.locator('input[type=password]').count() === 0)
  await confirmEmail(ota)
  await ota.page.bringToFront()
  await ota.page.reload()
  await ota.page.waitForSelector('[data-open-admin]', { timeout: 20_000 })
  check('once the e-mail is confirmed the cloud\'s page leads with "Open the admin", and says that the old link ran out', await ota.page.locator('[data-admin-way=account]').count() === 1 && await ota.page.locator('[data-second-way] [data-invite]').count() === 0 && await ota.page.locator('[data-second-way] [data-fresh-link]').count() === 1)
  const [otaAdmin] = await Promise.all([ota.ctx.waitForEvent('page'), ota.page.locator('[data-open-admin]').click()])
  await untilAdmin(otaAdmin, otaSite.publicUrl)
  const otaIn = await userOf(otaSite.id, ota.email)
  check('the invited owner still gets in through the account, eight days later: the proof is the confirmed e-mail, not the link', (await meOf(otaAdmin)).body?.user?.email === ota.email && otaIn.status === 'active' && otaIn.has_password === false, JSON.stringify(otaIn))
  check('the old link is used up for good', (await siteDb(otaSite.id, `select count(*)::int as n from cms_tokens where kind = 'invite' and used_at is null`))[0].n === 0)

  // ════ 6 · roles stay on the site ════
  log('6 · roles stay on the site: a new role, then disabled')
  const changed = await api(admin1, 'PATCH', `/api/cms/_users/${rowC.id}`, { role: 'author' })
  check('the owner changes the colleague\'s role in site 1\'s admin', changed.status === 200 && changed.body.user.role === 'author', JSON.stringify(changed))
  const nowAuthor = await waitFor(async () => ((await mySites(colleague)).member[0]?.role === 'author'), { timeout: 10_000, what: 'the new role at the cloud' }).catch(() => false)
  check('the site reports a role change at once: "My websites" shows the new role without a new sign-in', nowAuthor === true, JSON.stringify((await mySites(colleague)).member))
  check('the change ended the colleague\'s open session on the site, as a role change always does', (await meOf(adminC)).status === 401)
  await openCloud(colleague.page, '/sites')
  const [adminC2] = await Promise.all([colleague.ctx.waitForEvent('page'), colleague.page.locator(`[data-member-site="${clientIdOf(one.id)}"] a`).click()])
  await untilAdmin(adminC2, one.publicUrl)
  const againC = await meOf(adminC2)
  const listC2 = (await api(adminC2, 'GET', '/api/cms/_auth/account/sites')).body
  check('their next sign-in through the account gives the new role on the site and in its list', againC.body?.user?.role === 'author' && listC2.sites[0].role === 'author', JSON.stringify([againC.body?.user, listC2]))
  const disabled = await api(admin1, 'PATCH', `/api/cms/_users/${rowC.id}`, { status: 'disabled' })
  check('the owner disables the colleague in site 1', disabled.status === 200 && disabled.body.user.status === 'disabled')
  check('that signs them out there', (await meOf(adminC2)).status === 401)
  const gone = await waitFor(async () => ((await mySites(colleague)).member.length === 0), { timeout: 10_000, what: 'site 1 to leave the colleague\'s list' }).catch(() => false)
  check('and takes site 1 out of their list at the cloud', gone === true && (await memberAt(clientIdOf(one.id), colleague.id)).active === false)
  await openCloud(colleague.page, '/sites')
  check('the account still works for the cloud itself: signed in, "My websites" opens, with nothing in it', (await accountOf(colleague)).user?.email === colleague.email && await colleague.page.locator('[data-member-sites]').count() === 0)
  await adminC2.goto(`${one.publicUrl}/api/cms/_auth/account/start?next=/admin`)
  await adminC2.waitForURL((u) => u.searchParams.get('account') === 'no-access')
  check('going to the site through the account now ends on its no-access notice', (await meOf(adminC2)).status === 401)

  // ════ 7 · two websites the person runs themselves ════
  log('7 · two websites somebody runs themselves, connected to their account')
  const klara = await signUp('Klára Dvořáková', 'klara')
  const addresses = { a: `http://alfa-${stamp}.localhost:${ownFrom}`, b: `http://beta-${stamp}.localhost:${ownFrom + 1}` }
  const lines = {}
  for (const [key, name] of [['a', 'Studio Alfa'], ['b', 'Studio Beta']]) {
    await openCloud(klara.page, '/sites/connect')
    await klara.page.locator('[data-field-name]').fill(name)
    // Typed as people type: capitals and a slash at the end. The issuer keeps the normal form.
    await klara.page.locator('[data-field-url]').fill(key === 'b' ? `http://BETA-${stamp}.Localhost:${ownFrom + 1}/` : addresses[key])
    await klara.page.locator('[data-submit]').click()
    await klara.page.waitForSelector('[data-env-lines]')
    lines[key] = (await klara.page.locator('[data-env-lines]').innerText()).trim()
    await klara.page.locator('[data-done]').click()
  }
  check('the cloud\'s "Connect a website you already run" page gives three lines for each', Object.values(lines).every((text) => /^NUXT_CMS_AUTH_ACCOUNT_ISSUER=.+\nNUXT_CMS_AUTH_ACCOUNT_CLIENT_ID=[0-9a-f-]{36}\nNUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET=.{40,}$/.test(text)) && lines.a.includes(`NUXT_CMS_AUTH_ACCOUNT_ISSUER=${cloud.url}\n`))
  const kept2 = await cloudDb('select name, url from account_clients where owner_id = $1 and site_id is null order by created_at', [klara.id])
  check('the issuer keeps each address in its normal form (lower-case host, no trailing slash)', JSON.stringify(kept2.map((r) => r.url)) === JSON.stringify([addresses.a, addresses.b]), JSON.stringify(kept2))
  // Site B is TOLD its public address the way it was typed (capitals, a trailing slash): difference 5.
  const [alfa, beta] = await Promise.all([
    startOwnSite({ key: 'a', port: ownFrom, publicUrl: addresses.a, envLines: lines.a }),
    startOwnSite({ key: 'b', port: ownFrom + 1, publicUrl: `HTTP://BETA-${stamp}.Localhost:${ownFrom + 1}/`, envLines: lines.b }),
  ])
  check('two single-site processes of the built Photographer template run, each with its own database and those three lines', (await ownProcesses()).length === 2 && (await alfa.db('select count(*)::int as n from cms_users'))[0].n === 0 && (await beta.db('select count(*)::int as n from cms_users'))[0].n === 0)
  // Each website has an administrator of its own, with a password (the first account, made with the setup code).
  const local = { email: `spravce-${stamp}@example.com`, password: 'heslo-mistniho-spravce-1' }
  const roles = { a: 'admin', b: 'editor' }
  for (const site of [alfa, beta]) {
    site.admin = new Http(site.url)
    const made = await site.admin.post('/api/cms/_auth/setup', { name: 'Místní Správce', email: local.email, password: local.password, token: site.setupToken })
    if (made.status !== 201) throw new Error(`setup of ${site.key}: ${made.status} ${made.text.slice(0, 200)}`)
    const inv = await site.admin.post('/api/cms/_users', { email: klara.email, role: roles[site.key] })
    if (inv.status !== 201) throw new Error(`invite on ${site.key}: ${inv.status} ${inv.text.slice(0, 200)}`)
    site.invite = inv.body
  }
  check('the person is invited as an administrator on one and as an editor on the other', alfa.invite.user.role === 'admin' && beta.invite.user.role === 'editor' && alfa.invite.emailed === true)
  const mail = await waitFor(() => beta.mail().find((m) => m.to === klara.email), { timeout: 10_000, what: 'the invitation e-mail' })
  check('the invitation e-mail (as the site sends it) carries the link and says that the tinyzoo account of that address works too', mail.text.includes(beta.invite.inviteUrl) && /tinyzoo (účet s touto e-mailovou adresou|account uses this email address)/.test(mail.text), mail.text.slice(0, 400))
  check('links in site B\'s e-mails use its public address as it was set', beta.invite.inviteUrl.startsWith(`HTTP://BETA-${stamp}.Localhost:${ownFrom + 1}/admin/invite/`), beta.invite.inviteUrl)

  await openCloud(klara.page, '/sites')
  await klara.page.waitForSelector('[data-connected-sites]')
  check('"My websites" lists the two as connected websites', await klara.page.locator('[data-connected-site]').count() === 2)
  const [adminK] = await Promise.all([klara.ctx.waitForEvent('page'), klara.page.locator(`[data-connected-site="${alfa.clientId}"] a`).click()])
  const hopsK = follow(adminK)
  await untilAdmin(adminK, alfa.url)
  const meA = await meOf(adminK)
  check('"Open the admin" signs in to the first through the account: an administrator there, without a password', meA.body?.user?.email === klara.email && meA.body.user.role === 'admin' && meA.body.noPassword === true, JSON.stringify(meA.body?.user))
  menu = await openSwitcher(adminK)
  check('its switcher lists both websites by the names given at the cloud; the second has no role yet', menu.sites.length === 2 && row(menu, 'Studio Alfa').text === 'Studio Alfa Administrátor' && row(menu, 'Studio Alfa').checked && row(menu, 'Studio Beta').text === 'Studio Beta', JSON.stringify(menu.sites))
  hopsK.length = 0
  await chooseSite(adminK, 'Studio Beta')
  await untilAdmin(adminK, beta.url)
  const meB = await meOf(adminK)
  check('the switcher leads to the second, signed in as an editor there', meB.body?.user?.email === klara.email && meB.body.user.role === 'editor', JSON.stringify(meB.body?.user))
  const authorize = hopsK.find((u) => u.startsWith(`${cloud.url}/oauth/authorize`))
  check('the second site was told its address in capitals with a slash; the return address it sent is the normal form, and the issuer accepted it', new URL(authorize).searchParams.get('redirect_uri') === `${beta.url}/api/cms/_auth/account/callback` && hopsK.includes(authorize) && !hopsK.some((u) => /oauth\.redirect/.test(u)), authorize)
  menu = await openSwitcher(adminK)
  check('a person who is an administrator on one and an editor on the other sees both roles', row(menu, 'Studio Alfa').text === 'Studio Alfa Administrátor' && row(menu, 'Studio Beta').text === 'Studio Beta Editor' && row(menu, 'Studio Beta').checked, JSON.stringify(menu.sites))
  await picture('switcher-own-sites', adminK, { prepare: async (phone) => { await openSwitcher(phone) } })
  await chooseSite(adminK, 'Studio Alfa')
  await untilAdmin(adminK, alfa.url)
  menu = await openSwitcher(adminK)
  check('and back, with both roles there too', (await meOf(adminK)).body?.user?.role === 'admin' && row(menu, 'Studio Alfa').text === 'Studio Alfa Administrátor' && row(menu, 'Studio Beta').text === 'Studio Beta Editor', JSON.stringify(menu.sites))
  await closeMenu(adminK)
  check('each website keeps its own user and link; the issuer keeps the two roles', (await alfa.db(`select status, role from cms_users where email = $1`, [klara.email]))[0].role === 'admin' && (await beta.db(`select status, role from cms_users where email = $1`, [klara.email]))[0].status === 'active' && (await memberAt(alfa.clientId, klara.id)).role === 'admin' && (await memberAt(beta.clientId, klara.id)).role === 'editor')

  // Difference 6: the account page of somebody who has no password on the site.
  await adminK.goto(`${alfa.url}/admin/account`, { waitUntil: 'networkidle' })
  await adminK.waitForSelector('[data-cms-no-password]')
  check('the account page says they sign in with their account, and shows no form that asks for a current password', await adminK.locator('[data-cms-no-password-email]').count() === 1 && await adminK.locator('input[autocomplete="current-password"]').count() === 0 && (await adminK.locator('#account-password').locator('xpath=ancestor::section').innerText()).includes('Přihlašujete se tinyzoo účtem'))
  await picture('account-no-password', adminK, { fullPage: true })
  await adminK.locator('[data-cms-password-link]').click()
  await adminK.waitForSelector('[data-cms-password-link-sent]')
  const reset = await waitFor(() => alfa.mail().find((m) => m.to === klara.email && /\/admin\/reset\//.test(m.text)), { timeout: 10_000, what: 'the e-mail with the link to set a password' })
  const resetUrl = /https?:\/\/\S+\/admin\/reset\/[\w-]+/i.exec(reset.text)[0]
  const setter = await newContext()
  const setPage = await setter.newPage()
  await setPage.goto(resetUrl, { waitUntil: 'networkidle' })
  await setPage.locator('input[type=password]').first().fill('heslo-klary-pro-alfu-1')
  await setPage.locator('button[type=submit]').first().click()
  await untilAdmin(setPage, alfa.url)
  const withPassword = await new Http(alfa.url).post('/api/cms/_auth/login', { email: klara.email, password: 'heslo-klary-pro-alfu-1' })
  check('"set a password for this website" sends the forgotten-password e-mail; its link sets one, and it signs in', withPassword.status === 200 && (await meOf(setPage)).body.noPassword === undefined && (await alfa.db(`select password_hash is not null as has from cms_users where email = $1`, [klara.email]))[0].has === true)
  await setter.close()
  // Choosing a password signed the other sessions out (a reset always does): back in through the account.
  await adminK.goto(`${alfa.url}/api/cms/_auth/account/start?next=/admin`)
  await untilAdmin(adminK, alfa.url)
  check('the account keeps working beside the new password', (await meOf(adminK)).status === 200)

  // Difference 8: erasing a person tells the issuer.
  const erasable = await signUp('Emil Dočasný', 'emil')
  await alfa.admin.post('/api/cms/_users', { email: erasable.email, role: 'author' })
  await erasable.page.goto(`${alfa.url}/api/cms/_auth/account/start?next=/admin`)
  await untilAdmin(erasable.page, alfa.url)
  check('(somebody else works on the first website too, through the account)', (await memberAt(alfa.clientId, erasable.id)).active === true && (await mySites(erasable)).member.length === 1)
  const erased = await alfa.admin.post('/api/cms/_privacy/delete', { email: erasable.email })
  const told2 = await waitFor(async () => ((await memberAt(alfa.clientId, erasable.id)).active === false), { timeout: 10_000, what: 'the issuer to hear of the erasure' }).catch(() => false)
  check('erasing that person with the privacy tool removes the link and tells the issuer: the website leaves their list', erased.status === 200 && erased.body.account === true && told2 === true && (await mySites(erasable)).member.length === 0 && (await alfa.db(`select count(*)::int as n from cms_state where key like 'account%' and value->>'sub' = $1`, [erasable.id]))[0].n === 0, JSON.stringify(erased.body))
  await erasable.ctx.close()

  // ════ 8 · sign-out and sessions ════
  log('8 · sign-out and sessions')
  const tabB = await klara.ctx.newPage()
  await tabB.goto(`${beta.url}/admin`)
  await untilAdmin(tabB, beta.url)
  const out = await api(adminK, 'POST', '/api/cms/_auth/logout')
  check('signing out of one website ends that website\'s session only', out.status === 200 && (await meOf(adminK)).status === 401 && (await meOf(tabB)).status === 200 && (await accountOf(klara)).user?.email === klara.email)
  await openCloud(klara.page, '/account')
  await klara.page.locator('[data-account-menu]').click()
  await klara.page.getByRole('menuitem', { name: 'Odhlásit se' }).click()
  await klara.page.waitForURL(cloud.url + '/')
  check('signing out of the cloud does not end a website session that is open', (await accountOf(klara)).user === null && (await meOf(tabB)).status === 200 && (await api(tabB, 'GET', '/api/cms/page')).status === 200)
  const hopsB = follow(tabB)
  await tabB.reload()
  await untilAdmin(tabB, beta.url)
  await openSwitcher(tabB)
  await chooseSite(tabB, 'Studio Alfa')
  await tabB.waitForURL((u) => u.origin === alfa.url && u.pathname === '/admin/login')
  await tabB.waitForSelector('[data-cms-account-sign-in]')
  await sleep(1500)
  const loops = hopsB.filter((u) => u.startsWith(`${cloud.url}/oauth/authorize`)).length
  check('the next silent switch then shows the other website\'s sign-in page: one question to the account, no loop, no error', loops === 1 && new URL(tabB.url()).searchParams.get('account') === 'signin' && await tabB.locator('[data-cms-account-notice]').count() === 0 && await tabB.locator('input[autocomplete="current-password"]').count() === 1, `${loops} ${tabB.url()}`)
  await tabB.locator('[data-cms-account-sign-in]').click()
  await tabB.waitForURL((u) => u.origin === cloud.url && u.pathname === '/login')
  await tabB.waitForSelector('html[data-app-ready]')
  check('and its button leads to the cloud\'s sign-in form, which names the website', (await tabB.locator('[data-continue-to]').innerText()).includes('Studio Alfa'))
  await tabB.locator('[data-field-email]').fill(klara.email)
  await tabB.locator('[data-field-password]').fill(klara.password)
  await tabB.locator('[data-submit]').click()
  await untilAdmin(tabB, alfa.url)
  check('signing in there lands in that website\'s admin', (await meOf(tabB)).body?.user?.role === 'admin')

  // ════ 9 · the account service down ════
  log('9 · the account service is down (the cloud app is stopped)')
  const ownerTab = await owner.ctx.newPage()
  await ownerTab.goto(`${one.publicUrl}/admin`)
  await untilAdmin(ownerTab, one.publicUrl)
  await cloud.stop()
  check('the cloud app no longer answers', await fetch(`${cloud.url}/api/account`, { signal: AbortSignal.timeout(3000) }).then(() => false, () => true))
  await tabB.reload()
  await untilAdmin(tabB, alfa.url)
  await ownerTab.reload()
  await untilAdmin(ownerTab, one.publicUrl)
  const pageList = await api(tabB, 'GET', '/api/cms/page')
  check('open website sessions keep working, on a website of one\'s own and on a cloud-made one', (await meOf(tabB)).status === 200 && pageList.status === 200 && (await meOf(ownerTab)).status === 200, `${pageList.status}`)
  const lists = await api(ownerTab, 'GET', '/api/cms/_auth/account/sites')
  check('the list of websites comes back empty rather than as an error, and the site\'s name is drawn as before', lists.status === 200 && Array.isArray(lists.body.sites) && await ownerTab.locator('.cms-sidebar').count() === 1, JSON.stringify(lists))
  const visitor = await newContext()
  const signIn = await visitor.newPage()
  await signIn.goto(`${alfa.url}/admin/login`, { waitUntil: 'networkidle' })
  await signIn.locator('[data-cms-account-sign-in]').click()
  await signIn.waitForURL((u) => u.origin === alfa.url && u.searchParams.get('account') === 'unavailable')
  await signIn.locator('[data-cms-account-notice]').waitFor()
  check('the website\'s sign-in page says the account service did not answer (the browser never leaves the website)', (await signIn.locator('[data-cms-account-notice]').innerText()).includes('Služba účtů neodpověděla'))
  await picture('account-service-down', signIn)
  await signIn.locator('input[autocomplete="username"]').fill(local.email)
  await signIn.locator('input[autocomplete="current-password"]').fill(local.password)
  await signIn.locator('button[type=submit]').click()
  await untilAdmin(signIn, alfa.url)
  check('password sign-in still works for a user who has a password', (await meOf(signIn)).body?.user?.email === local.email)
  await visitor.close()

  // ════ 10 · the __Host- cookie ════
  log(`10 · a ${HOST_COOKIE} session cookie on http://<slug>.localhost (the template's process started with NUXT_SESSION_NAME)`)
  const stoppedTemplate = await stopProcesses(templateProcesses)
  await startCloudApp({ NUXT_HOSTING_SHARED_SESSION_COOKIE: HOST_COOKIE })
  await waitFor(async () => { try { return (await fetch(`${one.publicUrl}/api/health/ready`, { signal: AbortSignal.timeout(3000) })).status === 200 } catch { return false } }, { timeout: 120_000, every: 500, what: 'the template\'s process to come back' })
  const again = await templateProcesses()
  const environment = (await run('ps', ['eww', '-o', 'command=', '-p', String(again[0].pid)])).stdout
  check('the cloud app is back and started the template\'s process again, with the session cookie\'s name from the one setting', stoppedTemplate.length === 1 && again.length === 1 && again[0].pid !== stoppedTemplate[0].pid && environment.includes(`NUXT_SESSION_NAME=${HOST_COOKIE}`), environment.includes('NUXT_SESSION_NAME') ? '' : 'NUXT_SESSION_NAME is not in the process\'s environment')
  for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
    if (!existsSync(type.executablePath())) {
      findings.hostCookie[name] = { installed: false }
      note(`${name}: not installed for this Playwright (${type.executablePath()}); not tried`)
      continue
    }
    const engine = name === 'chromium' ? browser : await type.launch({ headless: !headed })
    const ctx = await engine.newContext({ viewport: DESKTOP, locale: 'cs-CZ' })
    try {
      const page = await ctx.newPage()
      // What the sites answer, watched on every page of this browser from before the first click.
      const setCookies = []
      ctx.on('response', async (res) => {
        if (!res.url().startsWith(one.publicUrl) && !res.url().startsWith(two.publicUrl)) return
        for (const h of await res.headersArray().catch(() => [])) if (h.name.toLowerCase() === 'set-cookie' && h.value.startsWith(`${HOST_COOKIE}=`)) setCookies.push(h.value.replace(/=[^;]*/, '=…'))
      })
      // The owner signs in at the cloud with the form, then "Open the admin" (parts 1 and 2 once more).
      await page.goto(`${cloud.url}/login?next=${encodeURIComponent(`/sites/${one.id}`)}`)
      await page.waitForSelector('html[data-app-ready]')
      await page.locator('[data-field-email]').fill(owner.email)
      await page.locator('[data-field-password]').fill(owner.password)
      await page.locator('[data-submit]').click()
      await page.waitForSelector('[data-open-admin]', { timeout: 30_000 })
      const [admin] = await Promise.all([ctx.waitForEvent('page'), page.locator('[data-open-admin]').click()])
      await admin.waitForURL((u) => u.origin === one.publicUrl && u.pathname.startsWith('/admin'), { timeout: 30_000 })
      await admin.waitForLoadState('networkidle')
      const stored = (await ctx.cookies(one.publicUrl)).filter((c) => c.name === HOST_COOKIE).map((c) => ({ name: c.name, domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite }))
      const me = await meOf(admin)
      const found = { installed: true, version: engine.version(), setCookie: setCookies[0] ?? null, stored: stored[0] ?? null, sent: me.status === 200, landed: new URL(admin.url()).pathname + new URL(admin.url()).search }
      findings.hostCookie[name] = found
      note(`${name} ${found.version}: the site answered Set-Cookie ${found.setCookie ?? '(none seen)'}; the browser ${found.stored ? `kept it (${JSON.stringify(found.stored)})` : 'did NOT keep it'} and ${found.sent ? 'sent it back (signed in)' : `did not send it (landed on ${found.landed})`}`)
      if (name === 'chromium') check(`Chromium accepts a ${HOST_COOKIE} cookie on http://<slug>.localhost and sends it back`, !!found.stored && found.stored.secure === true && found.stored.path === '/' && found.sent, JSON.stringify(found))
      if (found.stored && found.sent) {
        await untilAdmin(admin, one.publicUrl)
        const first = await openSwitcher(admin)
        await chooseSite(admin, 'Foto Zápisník')
        await untilAdmin(admin, two.publicUrl)
        const there = await meOf(admin)
        const second = await openSwitcher(admin)
        await chooseSite(admin, 'Ateliér Světlo')
        await untilAdmin(admin, one.publicUrl)
        const names = (await ctx.cookies([one.publicUrl, two.publicUrl])).map((c) => c.name)
        const ok = first.sites.length === 2 && there.body?.user?.email === owner.email && row(second, 'Foto Zápisník').checked && (await meOf(admin)).status === 200 && names.filter((n) => n === HOST_COOKIE).length === 2 && !names.includes('nuxt-auth-session')
        found.partsOneAndTwo = ok
        check(`${name}: with it, "Open the admin" and the switcher work as before (parts 1 and 2 once more), each site with its own ${HOST_COOKIE} cookie`, ok, JSON.stringify({ first, second, names }), { go: name !== 'chromium' })
      }
    }
    catch (err) {
      findings.hostCookie[name] = { ...(findings.hostCookie[name] ?? { installed: true }), error: String(err?.message ?? err).split('\n')[0] }
      if (name === 'chromium') throw err
      note(`${name}: ${findings.hostCookie[name].error}`)
    }
    finally {
      await ctx.close().catch(() => {})
      if (engine !== browser) await engine.close().catch(() => {})
    }
  }
}

try {
  await main()
}
catch (err) {
  failed = err
  console.error('\n' + (err?.stack ?? err))
  // What the browsers showed when it stopped.
  try {
    let n = 0
    for (const ctx of browser?.contexts() ?? []) for (const page of ctx.pages()) {
      if (page.url() === 'about:blank') continue
      const file = join(shots, `failed-${++n}.png`)
      await page.screenshot({ path: file }).catch(() => {})
      console.error(`    a page was at ${page.url()} (${file})`)
    }
  }
  catch { /* the browser is gone */ }
}
finally {
  const missed = results.filter((r) => !r.ok)
  if (!failed && missed.length) failed = new Error(`failed: ${missed.map((r) => r.name).join('; ')}`)
  if (failed) {
    for (const file of [join(templateDir, 'server.log'), join(ownDir, 'a', 'site.log'), join(ownDir, 'b', 'site.log')]) {
      if (existsSync(file)) console.error(`--- last lines of ${file} ---\n` + readFileSync(file, 'utf8').split('\n').slice(-15).join('\n'))
    }
  }
  await browser?.close().catch(() => {})
  await cloud?.stop().catch(() => {})
  if (keep) {
    const procs = [...await templateProcesses().catch(() => []), ...await ownProcesses().catch(() => [])]
    log(`kept: ${procs.map((p) => `pid ${p.pid} (${p.name})`).join(', ') || 'no process'}, the databases ${PREFIX}_… and ${DB}, and ${dataDir}`)
  }
  else {
    const cleaned = await cleanUp().catch((e) => { console.error('cleanup:', e.message); return null })
    await dropCloudDatabase().catch((e) => console.error('cleanup:', e.message))
    if (cleaned) log(`cleaned up: stopped ${cleaned.processes.length} process(es) (${cleaned.processes.join(', ') || 'none'}), dropped ${cleaned.databases} site database(s), ${cleaned.roles} user(s) and ${DB}, removed ${dataDir}`)
  }
  const seconds = Math.round((Date.now() - startedAt) / 1000)
  writeFileSync(join(preview, 'e2e-signin-result.json'), JSON.stringify({ at: new Date().toISOString(), ok: !failed, checks: results.length, seconds, failedAt: failed ? String(failed.message) : null, findings, results }, null, 2))
  log(failed ? `FAILED: ${missed.length} of ${results.length} checks, ${seconds} s${missed.length ? ` (${missed.map((r) => r.name).join('; ')})` : ''}` : `all ${results.length} checks passed in ${seconds} s`)
  for (const [name, f] of Object.entries(findings.hostCookie)) log(`${HOST_COOKIE} in ${name}: ${!f.installed ? 'not installed, not tried' : f.error ? `could not be tried (${f.error})` : `${f.stored ? 'accepted' : 'NOT accepted'}, ${f.sent ? 'sent back' : 'not sent back'}`}`)
  if (findings.screenshots?.length) log(`screenshots: ${shots}`)
  if (failed && existsSync(logFile)) console.error('--- last lines of the cloud app log ---\n' + readFileSync(logFile, 'utf8').split('\n').slice(-25).join('\n'))
}
process.exit(failed ? 1 : 0)
