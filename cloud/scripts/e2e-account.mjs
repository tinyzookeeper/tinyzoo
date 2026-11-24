// The account service for real, locally: the cloud app as the issuer of sign-in for websites
// (docs/multi-tenant-plan.md, 2.15).
//
//   pnpm --filter tinyzoo-cloud e2e:account     # needs the template built: pnpm --filter tinyzoo-cloud templates:build photographer
//   pnpm --filter tinyzoo-cloud e2e:account --protocol-only   # the protocol alone, no real site (no template needed)
//
// It starts a cloud app of its own with the shared driver (database tz_cloud_account_e2e, data
// under .data/account-e2e, template ports 4520–4539, site databases and users tzacct_e2e_…, the
// app on 3295 or the next free port, its own build folder) and removes everything it made at
// the end (--keep leaves it). The names and ports can be set from the environment:
// E2E_ACCOUNT_DB, E2E_ACCOUNT_SITE_PREFIX, E2E_ACCOUNT_PORT, E2E_ACCOUNT_SITE_PORTS ("4520-4539"),
// E2E_ACCOUNT_DATA (the folder's name under .data); the Postgres server from CLOUD_PG_URL.
//
// No browser. The script plays the WEBSITE's side of the protocol itself, over HTTP: a
// stand-in client that sends a person's "browser" (a cookie jar) to /oauth/authorize and
// exchanges the code server to server. The websites it connects exist nowhere; only their
// addresses matter to the issuer. What it proves is printed check by check.
//
// The second part makes one real Photographer site with the shared driver and checks that the
// site is handed its client (`config.auth.account` in its row of the site directory), that the
// issuer accepts that client, and what the site's page says about the way into the admin. The
// site's own account routes are the site's side of the contract and are not tested here.
import { execFile } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import pg from 'pg'
import { alive, arg, cloudDir, dbUrl, freePortFrom, log, sleep, startCloud, templateEntries, waitFor, withPg } from './lib.mjs'

const run = promisify(execFile)
const keep = arg('keep', false) === true
const protocolOnly = arg('protocol-only', false) === true
const DB = process.env.E2E_ACCOUNT_DB || 'tz_cloud_account_e2e'
const PREFIX = process.env.E2E_ACCOUNT_SITE_PREFIX || 'tzacct_e2e'
const [portFrom, portTo] = (process.env.E2E_ACCOUNT_SITE_PORTS || '4520-4539').split('-').map(Number)
const PORTS = { from: portFrom, to: portTo }
const APP_PORT = Number(process.env.E2E_ACCOUNT_PORT) || 3295
const dataDir = join(cloudDir, '.data', process.env.E2E_ACCOUNT_DATA || 'account-e2e')
const templateDir = join(dataDir, 'photographer')
const preview = join(cloudDir, '.preview')
const logFile = join(preview, 'e2e-account-cloud.log')
const CODE_TTL = 3
const CALLBACK = '/api/cms/_auth/account/callback'
const stamp = Date.now().toString(36).slice(-5)
const startedAt = Date.now()
const results = []

if (!/^[a-z][a-z0-9_]*_e2e$/.test(DB)) { console.error(`E2E_ACCOUNT_DB must be a database of this script's own, named …_e2e (it is dropped): ${DB}`); process.exit(2) }
if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(PREFIX)) { console.error(`E2E_ACCOUNT_SITE_PREFIX is not a usable prefix: ${PREFIX}`); process.exit(2) }
if (!Number.isInteger(PORTS.from) || !Number.isInteger(PORTS.to) || PORTS.to < PORTS.from) { console.error('E2E_ACCOUNT_SITE_PORTS must be "from-to"'); process.exit(2) }
if (!protocolOnly && !existsSync(templateEntries.photographer)) {
  console.error(`The template "photographer" is not built (${templateEntries.photographer}).\nRun: pnpm --filter tinyzoo-cloud templates:build photographer\n(or pass --protocol-only for the protocol's checks alone)`)
  process.exit(2)
}

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: ok ? '' : String(detail) })
  log(ok ? '  ✓' : '  ✗', name, detail && !ok ? `— ${detail}` : '')
  if (!ok) throw new Error(`failed: ${name}${detail ? ` (${detail})` : ''}`)
}

// ── what must never leak ──
// Every client secret and every one-time code this run sees, and every answer the cloud gave
// to a "browser" (a request that carried a person's cookie, or no credential at all).
const secrets = new Set()
const codes = new Set()
const browserAnswers = []

// ── a person's browser: a cookie jar over the cloud's pages and API ──

class Browser {
  constructor(base, who) { this.base = base; this.who = who; this.cookies = new Map() }
  get cookie() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
  /** `once`: the answer is one the person is shown a secret in, once, on purpose (kept out of the leak check). */
  async request(method, path, { json, headers = {}, html = false, once = false } = {}) {
    const sent = { accept: html ? 'text/html' : 'application/json' }
    if (this.cookie) sent.cookie = this.cookie
    Object.assign(sent, headers)
    let body
    if (json !== undefined) { sent['content-type'] = 'application/json'; body = JSON.stringify(json) }
    const res = await fetch(this.base + path, { method, headers: sent, body, redirect: 'manual', signal: AbortSignal.timeout(60_000) })
    for (const c of res.headers.getSetCookie()) { const [pair] = c.split(';'); const at = pair.indexOf('='); this.cookies.set(pair.slice(0, at), pair.slice(at + 1)) }
    const text = await res.text()
    const location = res.headers.get('location')
    if (!once) browserAnswers.push({ who: this.who, at: `${method} ${path.split('?')[0]}`, status: res.status, text, location })
    let parsed = null
    try { parsed = text ? JSON.parse(text) : null } catch { /* not JSON */ }
    return { status: res.status, body: parsed, text, location, headers: res.headers }
  }
  get(path, opts) { return this.request('GET', path, opts) }
  page(path, opts) { return this.request('GET', path, { html: true, ...opts }) }
  post(path, json, opts) { return this.request('POST', path, { json, ...opts }) }
}

// ── the website's side: a stand-in client ──

const callbackOf = (address) => `${address}${CALLBACK}`
const basic = (id, secret) => `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
function pkce() {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

let cloud = null

/** A request of a website's server to the issuer: no cookie, JSON. */
async function server(path, { json, headers = {} } = {}) {
  const res = await fetch(cloud.url + path, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', ...headers }, body: JSON.stringify(json ?? {}), redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { /* not JSON */ }
  return { status: res.status, body, text }
}

/** The website sends the person's browser to the issuer. `over` changes or removes (undefined) parameters. */
async function authorize(browser, client, over = {}) {
  const proof = pkce()
  const state = randomBytes(12).toString('base64url')
  const params = { response_type: 'code', client_id: client.clientId, redirect_uri: callbackOf(client.url), state, code_challenge: proof.challenge, code_challenge_method: 'S256', ...over }
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined)).toString()
  const res = await browser.page(`/oauth/authorize?${query}`)
  const back = res.location && res.location.startsWith('http') ? new URL(res.location) : null
  const code = back?.searchParams.get('code') ?? null
  if (code) codes.add(code)
  return { ...res, path: `/oauth/authorize?${query}`, back, code, state, verifier: proof.verifier, backState: back?.searchParams.get('state') ?? null, error: back?.searchParams.get('error') ?? null }
}

/** The website's server exchanges the code. `over` changes or removes fields. */
const token = (client, asked, over = {}, headers = {}) => server('/oauth/token', {
  headers,
  json: { grant_type: 'authorization_code', code: asked.code, redirect_uri: callbackOf(client.url), client_id: client.clientId, client_secret: client.clientSecret, code_verifier: asked.verifier, ...over },
})

/** The whole round trip for a signed-in person; the person the issuer names, or the refusal. */
async function signInThrough(browser, client) {
  const asked = await authorize(browser, client)
  if (!asked.code) return { asked, status: asked.status, body: null }
  return { asked, ...(await token(client, asked)) }
}

const sitesOf = (client, sub, secret = client.clientSecret) => server('/oauth/sites', { json: { sub }, headers: { authorization: basic(client.clientId, secret) } })
const membership = (client, json) => server('/oauth/membership', { json, headers: { authorization: basic(client.clientId, client.clientSecret) } })

/** An error page of the issuer: the status, no redirect, and which refusal the page names. */
const refusedWithPage = (res, code) => res.status === 400 && !res.location && res.text.includes(`data-error="${code}"`)
const about = (res) => `${res.status} ${res.location ?? ''} ${res.text.replace(/\s+/g, ' ').slice(0, 160)}`

// ── Postgres: only what this run made ──

const OWN_NAME = new RegExp(`^${PREFIX}_[0-9a-f]{8}(_[0-9a-f]{4}){3}_[0-9a-f]{12}$`)
const own = (name) => {
  if (!OWN_NAME.test(name) && name !== DB) throw new Error(`refusing to touch ${name}`)
  return `"${name}"`
}
const like = `${PREFIX.replace(/_/g, '\\_')}\\_%`
const siteDatabases = () => withPg(async (c) => (await c.query('select datname as name from pg_database where datname like $1 order by 1', [like])).rows.map((r) => r.name).filter((n) => OWN_NAME.test(n)))
const siteRoles = () => withPg(async (c) => (await c.query('select rolname as name from pg_roles where rolname like $1 order by 1', [like])).rows.map((r) => r.name).filter((n) => OWN_NAME.test(n)))
const dropCloudDatabase = () => withPg((c) => c.query(`drop database if exists ${own(DB)} with (force)`))

async function query(text, params = []) {
  const client = new pg.Client({ connectionString: dbUrl(DB), connectionTimeoutMillis: 8000 })
  await client.connect()
  try { return (await client.query(text, params)).rows }
  finally { await client.end().catch(() => {}) }
}
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

// ── the processes of this run's data folder ──

async function templateProcesses() {
  const { stdout } = await run('ps', ['-axo', 'pid=,rss=,command='])
  const marker = `--template-dir=${resolve(dataDir)}/`
  return stdout.split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .filter((m) => m[3].split(/\s+/).some((word) => word.startsWith(marker)))
    .map((m) => ({ pid: Number(m[1]), template: m[3].split(marker)[1].split(/\s/)[0] }))
}

/** Stop them: only pids whose command line names a folder under this run's data folder. */
async function stopTemplateProcesses() {
  const procs = await templateProcesses()
  for (const p of procs) { try { process.kill(p.pid, 'SIGTERM') } catch { /* gone */ } }
  for (let i = 0; i < 40; i++) {
    if (!(await Promise.all(procs.map((p) => alive(p.pid)))).some(Boolean)) break
    await sleep(250)
  }
  for (const p of await templateProcesses()) {
    if (procs.some((was) => was.pid === p.pid)) { try { process.kill(p.pid, 'SIGKILL') } catch { /* gone */ } }
  }
  return procs
}

async function cleanUp() {
  const stopped = await stopTemplateProcesses()
  const databases = await siteDatabases()
  const roles = await siteRoles()
  await withPg(async (c) => {
    for (const name of databases) await c.query(`drop database if exists ${own(name)} with (force)`)
    for (const name of roles) await c.query(`drop role if exists ${own(name)}`)
  })
  if (existsSync(dataDir) && resolve(dataDir).startsWith(join(cloudDir, '.data') + '/')) rmSync(dataDir, { recursive: true, force: true })
  return { processes: stopped.map((p) => p.pid), databases: databases.length, roles: roles.length }
}

// ── people ──

/** A new account, signed in. `confirm`: open the confirmation link (the page shows it in development). */
async function person(name, slug, { confirm = true } = {}) {
  const browser = new Browser(cloud.url, slug)
  const login = { name, email: `${slug}-${stamp}@example.com`, password: `dlouhe-heslo-${slug}-1` }
  const made = await browser.post('/api/auth/signup', login)
  if (made.status !== 201) throw new Error(`the account of ${name} was not made: ${made.status} ${made.text.slice(0, 200)}`)
  const verifyUrl = made.body.devVerifyUrl
  if (confirm) await confirmEmail(browser, verifyUrl)
  const me = (await browser.get('/api/account')).body.user
  return { browser, ...login, id: me.id, verifyUrl }
}
async function confirmEmail(browser, verifyUrl) {
  const res = await browser.post('/api/auth/verify', { token: String(verifyUrl).split('/').pop() })
  if (res.status !== 200) throw new Error(`the e-mail was not confirmed: ${res.status} ${res.text.slice(0, 200)}`)
}

/** Connect a website somebody runs themselves: the stand-in client, with the secret the page shows once. */
async function connect(owner, name, url) {
  const res = await owner.browser.post('/api/clients', { name, url }, { once: true })
  if (res.status !== 201) throw new Error(`${name} was not connected: ${res.status} ${res.text.slice(0, 200)}`)
  secrets.add(res.body.credentials.clientSecret)
  return { name, url: res.body.client.url, clientId: res.body.credentials.clientId, clientSecret: res.body.credentials.clientSecret, issuer: res.body.credentials.issuer, view: res.body.client }
}

mkdirSync(preview, { recursive: true })

async function main() {
  log('preparing: nothing of an earlier run is left, a clean database for the cloud')
  const left = await cleanUp()
  if (left.processes.length || left.databases || left.roles) log(`    removed what an earlier run left: ${left.processes.length} process(es), ${left.databases} database(s), ${left.roles} user(s)`)
  await dropCloudDatabase()
  await withPg((c) => c.query(`create database ${own(DB)}`))
  if (existsSync(logFile)) rmSync(logFile)
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
      // One website per account: connected websites must not count against it.
      NUXT_MAX_SITES_PER_USER: '1',
      NUXT_REQUIRE_VERIFIED_EMAIL: 'false',
      NUXT_MAIL_TRANSPORT: 'log',
      // A code works for a minute; here for three seconds, so "too old" need not be waited for.
      NUXT_ACCOUNT_CODE_TTL_SECONDS: String(CODE_TTL),
      CLOUD_BUILD_DIR: '.nuxt-scripts-account',
    },
  })
  log(`cloud app up at ${cloud.url} (the issuer)`)
  const nobody = new Browser(cloud.url, 'nobody')

  // ── 1 · discovery ──
  log('1 · the discovery document')
  const found = await nobody.get('/.well-known/tinyzoo-account')
  check('GET /.well-known/tinyzoo-account names the issuer and its four endpoints', found.status === 200 && JSON.stringify(found.body) === JSON.stringify({
    issuer: cloud.url, authorization_endpoint: `${cloud.url}/oauth/authorize`, token_endpoint: `${cloud.url}/oauth/token`,
    sites_endpoint: `${cloud.url}/oauth/sites`, membership_endpoint: `${cloud.url}/oauth/membership`,
  }), found.text.slice(0, 300))

  // ── people and their websites ──
  log('2 · two owners, three connected websites, a member, a person whose e-mail is not confirmed')
  const alena = await person('Alena Dvořáková', 'alena')
  const bohdan = await person('Bohdan Král', 'bohdan')
  const marta = await person('Marta Veselá', 'marta')
  const ota = await person('Ota Nový', 'ota', { confirm: false })
  check('four accounts are made; three confirmed their e-mail', [alena, bohdan, marta, ota].every((p) => /^[0-9a-f-]{36}$/.test(p.id)))
  const a1 = await connect(alena, 'Studio Grand', `https://grand-${stamp}.example.cz`)
  const a2 = await connect(alena, '6dance', `https://dance-${stamp}.example.cz`)
  const b1 = await connect(bohdan, 'Pekárna Král', `https://pekarna-${stamp}.example.cz`)
  check('connecting a website answers with the issuer, a client id and a secret', [a1, a2, b1].every((c) => c.issuer === cloud.url && /^[0-9a-f-]{36}$/.test(c.clientId) && c.clientSecret.length >= 40))
  const stored = await query('select id, secret_hash, url, owner_id, site_id from account_clients order by created_at')
  check('the issuer keeps each client with its owner, its address and the SHA-256 of its secret', stored.length === 3 && stored.every((r) => {
    const c = [a1, a2, b1].find((x) => x.clientId === r.id)
    return c && r.secret_hash === sha256(c.clientSecret) && r.url === c.url && r.site_id === null && r.owner_id === (c === b1 ? bohdan.id : alena.id)
  }), JSON.stringify(stored))
  const dump = JSON.stringify(await query('select * from account_clients'))
  check('no secret is in the database in plain text', ![a1, a2, b1].some((c) => dump.includes(c.clientSecret)))

  // ── 3 · the round trip ──
  log('3 · authorize → token for a signed-in person, with PKCE')
  const asked = await authorize(marta.browser, a1)
  check('a signed-in person is sent back at once: 302 to the website\'s callback with a code and the state', asked.status === 302 && asked.back?.origin === a1.url && asked.back.pathname === CALLBACK && !!asked.code && asked.backState === asked.state && [...asked.back.searchParams.keys()].sort().join() === 'code,state', about(asked))
  check('the answer is not to be cached and names no referrer', asked.headers.get('cache-control') === 'no-store' && asked.headers.get('referrer-policy') === 'no-referrer')
  const kept = await query('select code_hash, redirect_uri, code_challenge, user_id, client_id, extract(epoch from expires_at - created_at)::float as ttl, used_at from account_codes')
  check('the code is kept as its SHA-256, bound to the client, the address, the challenge and the person', kept.length === 1 && kept[0].code_hash === sha256(asked.code) && kept[0].redirect_uri === callbackOf(a1.url) && kept[0].client_id === a1.clientId && kept[0].user_id === marta.id && kept[0].code_challenge === createHash('sha256').update(asked.verifier).digest('base64url') && kept[0].used_at === null, JSON.stringify(kept))
  check(`its lifetime is the one that is set (${CODE_TTL} s here; a minute without the setting)`, Math.abs(kept[0].ttl - CODE_TTL) < 0.5, String(kept[0].ttl))
  const exchanged = await token(a1, asked)
  check('the website\'s server exchanges it for the person: sub, email, email_verified, name, locale', exchanged.status === 200 && JSON.stringify(exchanged.body) === JSON.stringify({ user: { sub: marta.id, email: marta.email, email_verified: true, name: marta.name, locale: 'cs' } }), exchanged.text.slice(0, 300))
  check('the exchange works with no cookie and from another origin: the CSRF guard of the cloud\'s own API does not apply to it', (await (async () => {
    const again = await authorize(marta.browser, a1)
    return token(a1, again, {}, { origin: a1.url, 'sec-fetch-site': 'cross-site' })
  })()).status === 200)
  check('while that guard still refuses a cross-site request to the cookie API', (await marta.browser.post('/api/clients', { name: 'x', url: 'https://x.example.cz' }, { headers: { 'sec-fetch-site': 'cross-site' } })).status === 403)
  const unconfirmed = await signInThrough(ota.browser, a1)
  check('email_verified is the account\'s own truth: false for a person who has not confirmed', unconfirmed.status === 200 && unconfirmed.body.user.sub === ota.id && unconfirmed.body.user.email_verified === false, unconfirmed.text?.slice(0, 200))

  // ── 4 · authorize refuses ──
  log('4 · what authorize refuses')
  const unknown = await authorize(marta.browser, { ...a1, clientId: randomUUID() })
  check('an unknown client gets an error page (400), never a redirect', refusedWithPage(unknown, 'oauth.client'), about(unknown))
  check('so does a client id that is no id at all', refusedWithPage(await authorize(marta.browser, { ...a1, clientId: '\' or 1=1 --' }), 'oauth.client'))
  check('and a request with no client', refusedWithPage(await authorize(marta.browser, a1, { client_id: undefined }), 'oauth.client'))
  check('the page is the app\'s own, in the person\'s language: Czech by default', unknown.text.includes('Přihlášení přes účet se nepodařilo') && unknown.text.includes('Tento web není připojený k účtu tinyzoo'))
  check('and English for a visitor who chose it', (await nobody.page(unknown.path, { headers: { cookie: 'tz-cloud-locale=en' } })).text.includes('Signing in through the account didn’t work'))
  const elsewhere = await authorize(marta.browser, a1, { redirect_uri: callbackOf('https://evil.example.com') })
  check('another website\'s address as redirect_uri gets an error page, never a redirect', refusedWithPage(elsewhere, 'oauth.redirect'), about(elsewhere))
  const host = new URL(a1.url).host
  const lookAlikes = {
    'the host as a subdomain of another': `https://${host}.evil.example.com${CALLBACK}`,
    'the host with something in front': `https://evil-${host}${CALLBACK}`,
    'the host as a login of another': `https://${host}@evil.example.com${CALLBACK}`,
    'http instead of https': `http://${host}${CALLBACK}`,
    'another port': `https://${host}:8443${CALLBACK}`,
    'the default port written out': `https://${host}:443${CALLBACK}`,
    'a trailing slash': `${callbackOf(a1.url)}/`,
    'a query': `${callbackOf(a1.url)}?next=https://evil.example.com`,
    'a fragment': `${callbackOf(a1.url)}#x`,
    'another path of the website': `${a1.url}/api/cms/_auth/account/callback/../../login`,
    'the path in other letters': `${a1.url}${CALLBACK.toUpperCase()}`,
    'a doubled slash': `${a1.url}/${CALLBACK}`,
    'the host in capitals': `https://${host.toUpperCase()}${CALLBACK}`,
    'a dot after the host': `https://${host}.${CALLBACK}`,
    'the address of the owner\'s other website': callbackOf(a2.url),
    'no address': undefined,
  }
  for (const [what, uri] of Object.entries(lookAlikes)) {
    const res = await authorize(marta.browser, a1, { redirect_uri: uri })
    check(`a look-alike redirect address is refused with the page: ${what}`, refusedWithPage(res, 'oauth.redirect'), about(res))
  }
  const noChallenge = await authorize(marta.browser, a1, { code_challenge: undefined })
  check('no PKCE challenge: back to the website with error=invalid_request and the state, no code', noChallenge.status === 302 && noChallenge.back?.pathname === CALLBACK && noChallenge.error === 'invalid_request' && noChallenge.backState === noChallenge.state && !noChallenge.code, about(noChallenge))
  for (const [what, over] of Object.entries({
    'the plain method': { code_challenge_method: 'plain' },
    'no method': { code_challenge_method: undefined },
    'a challenge that is not a SHA-256': { code_challenge: 'too-short' },
  })) {
    const res = await authorize(marta.browser, a1, over)
    check(`PKCE S256 is required: ${what} → error=invalid_request`, res.status === 302 && res.error === 'invalid_request' && !res.code, about(res))
  }
  const implicit = await authorize(marta.browser, a1, { response_type: 'token' })
  check('another response_type → error=unsupported_response_type', implicit.status === 302 && implicit.error === 'unsupported_response_type' && !implicit.code, about(implicit))
  const stateless = await authorize(marta.browser, a1, { state: undefined })
  check('no state → error=invalid_request', stateless.status === 302 && stateless.error === 'invalid_request' && !stateless.code, about(stateless))

  // ── 5 · nobody signed in ──
  log('5 · a person who is not signed in')
  const silent = await authorize(nobody, a1, { prompt: 'none' })
  check('prompt=none without a session: back to the website with error=login_required and the state', silent.status === 302 && silent.back?.origin === a1.url && silent.back.pathname === CALLBACK && silent.error === 'login_required' && silent.backState === silent.state && !silent.code, about(silent))
  const silentIn = await authorize(marta.browser, a1, { prompt: 'none' })
  check('prompt=none with a session: a code, as without it', silentIn.status === 302 && !!silentIn.code && !silentIn.error, about(silentIn))
  const visitor = new Browser(cloud.url, 'visitor')
  const sent = await authorize(visitor, a1)
  check('without prompt=none: 302 to the cloud\'s sign-in page, which is told to come back to this very address', sent.status === 302 && sent.location === `/login?next=${encodeURIComponent(sent.path)}`, about(sent))
  const signInPage = await visitor.page(sent.location)
  check('the sign-in page answers and says which website the person is going to', signInPage.status === 200 && signInPage.text.includes(`data-continue-to="${host}"`) && signInPage.text.includes('Studio Grand'), `${signInPage.status}`)
  check('it offers an account alone (not a new website) to somebody who came from a website', signInPage.text.includes('data-signup') && signInPage.text.includes('/signup?next='))
  check('signing in there works', (await visitor.post('/api/auth/login', { email: bohdan.email, password: bohdan.password })).status === 200)
  const returned = await visitor.page(sent.path)
  check('and the same authorize address now answers with a code for that person', returned.status === 302 && new URL(returned.location).searchParams.get('state') === sent.state && !!new URL(returned.location).searchParams.get('code'), about(returned))
  const theirCode = new URL(returned.location).searchParams.get('code')
  codes.add(theirCode)
  const theirs = await token(a1, { code: theirCode, verifier: sent.verifier })
  check('the code names the person who signed in', theirs.status === 200 && theirs.body.user.sub === bohdan.id, theirs.text.slice(0, 200))
  // The sign-in page, asked for by somebody already signed in, leads on at once: the server decides where.
  const goes = async (next) => (await bohdan.browser.page(`/login?next=${encodeURIComponent(next)}`)).location
  check('the sign-in page comes back to an authorize address of this app', await goes(sent.path) === sent.path)
  const outside = ['https://evil.example.com/', '//evil.example.com', '/\\evil.example.com', '/\t/evil.example.com', 'javascript:alert(1)', `${a1.url}/admin`, 'evil.example.com']
  const went = await Promise.all(outside.map(goes))
  check('and never to an address outside this app (an open redirect): every such "next" leads to My websites', went.every((l) => l === '/sites'), JSON.stringify(went))
  // The same for a new account: the page that makes one waits for the confirmation, then goes on.
  const newcomer = new Browser(cloud.url, 'newcomer')
  const signupPath = `/signup?next=${encodeURIComponent(sent.path)}`
  check('the page that makes an account answers, for the same website', (await newcomer.page(signupPath)).text.includes('Studio Grand'))
  const made = await newcomer.post('/api/auth/signup', { name: 'Nela Nová', email: `nela-${stamp}@example.com`, password: 'dlouhe-heslo-nely-1' })
  const waitingPage = await newcomer.page(signupPath)
  check('a new account stays on that page until its e-mail is confirmed', made.status === 201 && waitingPage.status === 200 && waitingPage.text.includes('data-signup-confirm'), `${made.status} ${waitingPage.status} ${waitingPage.location}`)
  await confirmEmail(newcomer, made.body.devVerifyUrl)
  check('once confirmed, the page leads back to the authorize address', (await newcomer.page(signupPath)).location === sent.path)

  // ── 6 · token refuses ──
  log('6 · what token refuses')
  const fresh = () => authorize(marta.browser, a1)
  let c = await fresh()
  const wrongSecret = await token(a1, c, { client_secret: a2.clientSecret })
  check('a wrong secret (another client\'s) → 401 invalid_client', wrongSecret.status === 401 && wrongSecret.body?.error === 'invalid_client', wrongSecret.text)
  check('an unknown client → 401 invalid_client', (await token(a1, c, { client_id: randomUUID() })).body?.error === 'invalid_client')
  check('no secret → 401 invalid_client', (await token(a1, c, { client_secret: undefined })).status === 401)
  check('a try with a wrong secret does not spend the code: the website itself still exchanges it', (await token(a1, c)).status === 200)
  const second = await token(a1, c)
  check('a code works once: the second exchange → 400 invalid_grant', second.status === 400 && second.body?.error === 'invalid_grant', second.text)
  c = await fresh()
  check('another client cannot exchange it, even with its own right secret → 400 invalid_grant', (await token(a2, c, { redirect_uri: callbackOf(a1.url) })).body?.error === 'invalid_grant')
  check('and that does not spend it for the client it was made for', (await token(a1, c)).status === 200)
  for (const [what, over] of Object.entries({
    'a wrong PKCE verifier': { code_verifier: pkce().verifier },
    'no PKCE verifier': { code_verifier: undefined },
    'the challenge sent as the verifier': null,
    'a wrong redirect address': { redirect_uri: callbackOf(a2.url) },
    'no redirect address': { redirect_uri: undefined },
  })) {
    c = await fresh()
    const res = await token(a1, c, over ?? { code_verifier: createHash('sha256').update(c.verifier).digest('base64url') })
    check(`${what} → 400 invalid_grant`, res.status === 400 && res.body?.error === 'invalid_grant', res.text)
    check(`  and the code is spent by that try: the right exchange is refused too`, (await token(a1, c)).body?.error === 'invalid_grant')
  }
  check('a code that never was → 400 invalid_grant', (await token(a1, { code: randomBytes(32).toString('base64url'), verifier: pkce().verifier })).body?.error === 'invalid_grant')
  check('no code → 400 invalid_grant', (await token(a1, { code: undefined, verifier: pkce().verifier })).body?.error === 'invalid_grant')
  check('another grant type → 400 unsupported_grant_type', (await token(a1, await fresh(), { grant_type: 'client_credentials' })).body?.error === 'unsupported_grant_type')
  check('something that is not JSON → 400 invalid_request', (await fetch(`${cloud.url}/oauth/token`, { method: 'POST', body: 'not json' })).status === 400)
  c = await fresh()
  await sleep(CODE_TTL * 1000 + 400)
  const old = await token(a1, c)
  check(`a code older than its lifetime (${CODE_TTL} s here) → 400 invalid_grant`, old.status === 400 && old.body?.error === 'invalid_grant', old.text)
  check('every refusal is plain JSON, not to be cached', old.text.replace(/\s/g, '') === '{"error":"invalid_grant"}')

  // ── 7 · sites: the same owner only ──
  log('7 · sites: only the websites of the asking website\'s owner')
  // Marta has signed in to A1 above. Now also to B1 (another owner's).
  check('Marta signs in to Bohdan\'s website too', (await signInThrough(marta.browser, b1)).status === 200)
  const viaA1 = await sitesOf(a1, marta.id)
  check('asked by A1 about Marta: A1 alone, marked current, with the address of "My websites"', viaA1.status === 200 && JSON.stringify(viaA1.body) === JSON.stringify({ sites: [{ id: a1.clientId, name: 'Studio Grand', url: a1.url, role: null, current: true }], account: `${cloud.url}/sites` }), viaA1.text)
  const viaB1 = await sitesOf(b1, marta.id)
  check('asked by B1: B1 alone. Neither website learns of the other owner\'s', JSON.stringify(viaB1.body?.sites.map((s) => [s.id, s.current])) === JSON.stringify([[b1.clientId, true]]) && !viaA1.text.includes(b1.clientId) && !viaB1.text.includes(a1.clientId), viaB1.text)
  check('Marta signs in to Alena\'s second website', (await signInThrough(marta.browser, a2)).status === 200)
  check('a sign-in alone lists a website nowhere else: the issuer does not know yet whether the website let her in', JSON.stringify((await sitesOf(a1, marta.id)).body.sites.map((s) => s.id)) === JSON.stringify([a1.clientId]) && (await marta.browser.get('/api/sites')).body.member.length === 0)
  check('A2 says it lets her in (membership, with her role)', (await membership(a2, { sub: marta.id, role: 'admin', active: true })).status === 200)
  const both = (await sitesOf(a1, marta.id)).body.sites
  check('now A1 lists both of Alena\'s websites for her, itself marked current', JSON.stringify(both.map((s) => [s.id, s.current, s.role])) === JSON.stringify([[a1.clientId, true, null], [a2.clientId, false, 'admin']]), JSON.stringify(both))
  check('asked by A2 before A1 confirmed her: A2 alone', JSON.stringify((await sitesOf(a2, marta.id)).body.sites.map((s) => [s.id, s.current])) === JSON.stringify([[a2.clientId, true]]))
  const forOwner = (await sitesOf(a1, alena.id)).body.sites
  check('the owner is listed all her websites without ever having signed in to them', JSON.stringify(forOwner.map((s) => s.id)) === JSON.stringify([a1.clientId, a2.clientId]) && !JSON.stringify(forOwner).includes(b1.clientId))
  check('a person who never signed in to the asking website gets an empty list, also the other owner', (await sitesOf(a1, randomUUID())).body.sites.length === 0 && (await sitesOf(a2, bohdan.id)).body.sites.length === 0 && (await sitesOf(b1, alena.id)).body.sites.length === 0)
  check('a wrong secret → 401 invalid_client; no sub → 400', (await sitesOf(a1, marta.id, b1.clientSecret)).body?.error === 'invalid_client' && (await server('/oauth/sites', { json: { sub: marta.id } })).status === 401 && (await sitesOf(a1, 'somebody')).status === 400)

  // ── 8 · membership ──
  log('8 · membership: the website says the role, or that it no longer lets the person in')
  const reported = await membership(a1, { sub: marta.id, role: 'editor', active: true })
  check('a role is reported → { ok: true }', reported.status === 200 && JSON.stringify(reported.body) === '{"ok":true}', reported.text)
  check('the switcher\'s list carries the roles as last reported, from either website', JSON.stringify((await sitesOf(a1, marta.id)).body.sites.map((s) => [s.id, s.role, s.current])) === JSON.stringify([[a1.clientId, 'editor', true], [a2.clientId, 'admin', false]])
    && JSON.stringify((await sitesOf(a2, marta.id)).body.sites.map((s) => [s.id, s.role, s.current])) === JSON.stringify([[a1.clientId, 'editor', false], [a2.clientId, 'admin', true]]))
  check('"My websites" lists the two that confirmed her; Bohdan\'s, where she only signed in, not yet', JSON.stringify((await marta.browser.get('/api/sites')).body.member.map((m) => m.id)) === JSON.stringify([a1.clientId, a2.clientId]))
  check('Bohdan\'s website confirms her too', (await membership(b1, { sub: marta.id, role: 'viewer', active: true })).status === 200)
  const mine = (await marta.browser.get('/api/sites')).body
  check('"My websites" lists the three websites Marta works on, apart from her own (she has none), with her roles', mine.sites.length === 0 && mine.connected.length === 0 && JSON.stringify(mine.member.map((m) => [m.id, m.role])) === JSON.stringify([[a1.clientId, 'editor'], [b1.clientId, 'viewer'], [a2.clientId, 'admin']]), JSON.stringify(mine.member))
  check('a person a website never confirmed (it turned them away, say) is listed as nobody\'s member: Ota signed in to A1 and has no such website', (await ota.browser.get('/api/sites')).body.member.length === 0 && !(await ota.browser.page('/sites')).text.includes('data-member-sites'))
  check('each with the way into its admin through the account, and nothing else to do with it', mine.member.every((m) => m.adminUrl === `${m.url}/api/cms/_auth/account/start?next=/admin` && Object.keys(m).sort().join() === 'adminUrl,id,name,role,url'))
  const minePage = await marta.browser.page('/sites')
  check('the page shows them as websites she works on, with the role in words', minePage.status === 200 && minePage.text.includes('data-member-sites') && minePage.text.includes(`data-member-site="${a1.clientId}"`) && minePage.text.includes('Vaše role: editor') && !minePage.text.includes('data-connected-sites'), `${minePage.status}`)
  check('the role changes when the website says so', (await membership(a1, { sub: marta.id, role: 'admin', active: true })).status === 200 && (await marta.browser.get('/api/sites')).body.member.find((m) => m.id === a1.clientId).role === 'admin')
  check('active: false → { ok: true }', (await membership(a1, { sub: marta.id, active: false })).status === 200)
  const after = (await marta.browser.get('/api/sites')).body.member
  check('and the website leaves the person\'s list', JSON.stringify(after.map((m) => m.id)) === JSON.stringify([b1.clientId, a2.clientId]), JSON.stringify(after))
  check('the owner\'s other website no longer lists it for her, and the website itself gets nothing for her', JSON.stringify((await sitesOf(a2, marta.id)).body.sites.map((s) => s.id)) === JSON.stringify([a2.clientId]) && (await sitesOf(a1, marta.id)).body.sites.length === 0)
  check('signing in again does not put her back: that is for the website to say', (await signInThrough(marta.browser, a1)).status === 200 && !(await marta.browser.get('/api/sites')).body.member.some((m) => m.id === a1.clientId))
  check('the website lets her in again → she is back, with the role', (await membership(a1, { sub: marta.id, role: 'editor', active: true })).status === 200 && (await marta.browser.get('/api/sites')).body.member.find((m) => m.id === a1.clientId)?.role === 'editor')
  const stranger = await membership(b1, { sub: alena.id, role: 'admin', active: true })
  check('a website cannot report a person who never signed in to it → 404, and it does not appear in their list', stranger.status === 404 && stranger.body?.error === 'not_found' && !(await alena.browser.get('/api/sites')).body.member.some((m) => m.id === b1.clientId), stranger.text)
  check('a wrong secret → 401; a body that is not a report → 400', (await server('/oauth/membership', { json: { sub: marta.id, role: 'admin' }, headers: { authorization: basic(a1.clientId, a2.clientSecret) } })).status === 401 && (await membership(a1, { sub: 'x' })).status === 400 && (await membership(a1, { sub: marta.id, active: 'no' })).status === 400)

  // ── 9 · connected websites ──
  log('9 · connecting a website you already run')
  const listed = await alena.browser.get('/api/clients')
  check('the connected websites are listed with their name and address, and no secret', listed.status === 200 && JSON.stringify(listed.body.clients.map((x) => [x.id, x.name, x.url])) === JSON.stringify([[a1.clientId, 'Studio Grand', a1.url], [a2.clientId, '6dance', a2.url]]) && !/secret/i.test(listed.text), listed.text.slice(0, 300))
  const alenas = (await alena.browser.get('/api/sites')).body
  check('"My websites" shows them as connected websites: name, address, the admin through the account', JSON.stringify(alenas.connected.map((x) => x.id)) === JSON.stringify([a1.clientId, a2.clientId]) && alenas.connected.every((x) => x.adminUrl === `${x.url}/api/cms/_auth/account/start?next=/admin`) && alenas.member.length === 0)
  const connectPage = await alena.browser.page('/sites/connect')
  check('the page lists them, and shows no secret of a website connected earlier', connectPage.status === 200 && connectPage.text.includes(`data-client="${a1.clientId}"`) && !connectPage.text.includes('data-credentials') && !connectPage.text.includes('NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET'), `${connectPage.status}`)
  for (const [what, url] of Object.entries({
    'http for a website that is not on this machine': 'http://www.example.cz',
    'another scheme': 'ftp://www.example.cz',
    'a script': 'javascript:alert(1)',
    'an address with a path': 'https://www.example.cz/web',
    'an address with a login': 'https://user:pass@www.example.cz',
    'a single word': 'web',
  })) {
    const res = await alena.browser.post('/api/clients', { name: 'Nový web', url })
    check(`the address must be the website's own, over https: ${what} is refused`, res.status === 422 && res.body?.data?.code === 'client.address', `${res.status} ${res.text.slice(0, 160)}`)
  }
  check('the same website is not connected twice', (await alena.browser.post('/api/clients', { name: 'Znovu', url: `${a1.url.toUpperCase().replace('HTTPS', 'https')}/` })).status === 409)
  const local = await connect(alena, 'Na mém počítači', 'http://localhost:4999/')
  check('http is accepted for a website on this machine; the address is kept as scheme, host and port', local.url === 'http://localhost:4999' && (await signInThrough(alena.browser, local)).status === 200)
  const outsider = await bohdan.browser.post(`/api/clients/${local.clientId}/secret`)
  check('another person can neither renew nor disconnect it (404, as if it were not there)', outsider.status === 404 && (await bohdan.browser.post(`/api/clients/${local.clientId}/remove`)).status === 404 && (await nobody.post(`/api/clients/${local.clientId}/secret`)).status === 401)
  const renewed = await alena.browser.post(`/api/clients/${local.clientId}/secret`, undefined, { once: true })
  const newSecret = renewed.body?.credentials?.clientSecret
  secrets.add(newSecret)
  check('a new secret is made and shown once', renewed.status === 200 && typeof newSecret === 'string' && newSecret !== local.clientSecret && renewed.body.credentials.clientId === local.clientId, renewed.text.slice(0, 200))
  const withOld = await signInThrough(alena.browser, local)
  check('the old secret stops working at once → 401 invalid_client', withOld.status === 401 && withOld.body?.error === 'invalid_client' && (await sitesOf(local, alena.id)).status === 401, withOld.text)
  const renewedClient = { ...local, clientSecret: newSecret }
  check('the new one works', (await signInThrough(alena.browser, renewedClient)).status === 200 && (await sitesOf(renewedClient, alena.id)).status === 200)
  check('nothing shows the secret again: not the list, not the page, not "My websites"', ![await alena.browser.get('/api/clients'), await alena.browser.page('/sites/connect'), await alena.browser.get('/api/sites')].some((r) => r.text.includes(newSecret) || r.text.includes(local.clientSecret)))
  // A code on its way when the website is disconnected dies with it.
  const onTheWay = await authorize(alena.browser, renewedClient)
  const gone = await alena.browser.post(`/api/clients/${local.clientId}/remove`)
  check('disconnecting it is accepted', gone.status === 200, gone.text)
  const dead = await token(renewedClient, onTheWay)
  check('a revoked client: token → 401 invalid_client, also for a code that was on its way', dead.status === 401 && dead.body?.error === 'invalid_client', dead.text)
  check('a revoked client: authorize → the error page, never a redirect', refusedWithPage(await authorize(alena.browser, renewedClient), 'oauth.client'))
  check('a revoked client: sites and membership → 401', (await sitesOf(renewedClient, alena.id)).status === 401 && (await membership(renewedClient, { sub: alena.id, role: 'admin', active: true })).status === 401)
  check('it left the owner\'s lists, and its sister websites\' switcher', !(await alena.browser.get('/api/clients')).text.includes(local.clientId) && !(await alena.browser.get('/api/sites')).text.includes(local.clientId) && !(await sitesOf(a1, alena.id)).text.includes(local.clientId))

  // ── 10 · limits ──
  log('10 · the limits of the server-to-server routes')
  const flood = { 'x-forwarded-for': '203.0.113.77' }
  let limited = 0
  for (let i = 0; i < 50; i++) limited += (await token(a1, { code: 'x', verifier: 'x' }, { client_secret: 'wrong' }, flood)).status === 429 ? 1 : 0
  const blocked = await sitesOf(a1, alena.id).then(() => server('/oauth/sites', { json: { sub: alena.id }, headers: { ...flood, authorization: basic(a1.clientId, a1.clientSecret) } }))
  check('after fifty failed tries from one address within ten minutes, that address is refused (429) even with the right secret', limited === 0 && blocked.status === 429 && blocked.body?.error === 'too_many_requests', `${limited} ${blocked.status}`)
  check('the website they named is not locked out: from its own address it goes on', (await sitesOf(a1, alena.id)).status === 200 && (await signInThrough(marta.browser, a1)).status === 200)
  const throwaway = await connect(bohdan, 'Na zkoušku', `https://zkouska-${stamp}.example.cz`)
  const guesser = { 'x-forwarded-for': '203.0.113.78' }
  let guesses = 0
  for (let i = 0; i < 30; i++) guesses += (await token(throwaway, { code: randomBytes(32).toString('base64url'), verifier: pkce().verifier }, {}, guesser)).status === 400 ? 1 : 0
  const guessing = await token(throwaway, { code: randomBytes(32).toString('base64url'), verifier: pkce().verifier })
  check('thirty bad codes sent with a client\'s right secret: that client\'s exchanges are refused for a while (429), from any address', guesses === 30 && guessing.status === 429, `${guesses} ${guessing.status}`)

  if (!protocolOnly) await realSite({ alena, marta, ota, a1 })

  // ── nothing leaked ──
  log(`${protocolOnly ? 11 : 13} · secrets and codes`)
  const holds = (a, x) => a.text.includes(x) || !!a.location?.includes(x)
  const withSecret = browserAnswers.find((a) => [...secrets].some((x) => holds(a, x)))
  check(`no client secret is in any of the ${browserAnswers.length} answers to a browser (only in the one answer that shows it, once)`, secrets.size >= 5 && !withSecret, withSecret ? `a secret is in ${withSecret.at}` : `${secrets.size} secrets`)
  const withCode = browserAnswers.filter((a) => [...codes].some((x) => holds(a, x)))
  const astray = withCode.find((a) => !(a.at === 'GET /oauth/authorize' && a.status === 302 && new URL(a.location).pathname === CALLBACK))
  check(`a code is sent to a browser only as the redirect to its website's callback, and in no other answer (${codes.size} codes)`, codes.size > 20 && withCode.length === codes.size && !astray, astray ? `a code is in ${astray.at}` : `${withCode.length} answers for ${codes.size} codes`)
  const serverLog = readFileSync(logFile, 'utf8')
  check('the server log holds no client secret and no code', serverLog.length > 200 && ![...secrets, ...codes].some((x) => serverLog.includes(x)))
  const everything = JSON.stringify(await query('select (select json_agg(c) from account_clients c) as clients, (select json_agg(k) from account_codes k) as codes, (select json_agg(s.driver_state) from sites s) as states'))
  check('the database holds no client secret and no code in plain text', ![...secrets, ...codes].some((x) => everything.includes(x)))
}

// ── the second part: one real site of the shared driver ──

async function realSite({ alena, marta, ota, a1 }) {
  log('11 · a real Photographer site (the shared driver) is handed its client')
  const directory = () => JSON.parse(readFileSync(join(templateDir, 'sites.json'), 'utf8')).sites
  const siteOf = async (browser, id) => (await browser.get(`/api/sites/${id}`)).body?.site
  const untilReady = (browser, id) => waitFor(async () => {
    const now = await siteOf(browser, id)
    if (now?.status === 'failed') throw new Error(`the site failed: ${JSON.stringify(now.steps)} ${now.errorDetail ?? ''}`)
    return now?.status === 'ready' ? now : null
  }, { timeout: 300_000, every: 500, what: 'the site to be ready' })

  // Alena has two connected websites and the limit is one website per account.
  const wanted = await alena.browser.post('/api/sites', { name: 'Ateliér Alena', slug: `acct-alena-${stamp}`, template: 'photographer', look: 'atelier' })
  check('connected websites do not count against the limit of websites: with two connected and a limit of one, a website is made', wanted.status === 201, `${wanted.status} ${wanted.text.slice(0, 200)}`)
  check('and the second one is refused by the limit', (await alena.browser.post('/api/sites', { name: 'Druhý', slug: `acct-druhy-${stamp}`, template: 'photographer' })).body?.data?.code === 'sites.limit')
  const site = await untilReady(alena.browser, wanted.body.site.id)
  check('the site is ready', site.status === 'ready' && !!site.publicUrl, JSON.stringify(site.steps))
  const row = directory().find((r) => r.id === site.id)
  const account = row?.config?.auth?.account
  check('its row in the site directory carries config.auth.account: the issuer, a client id and a secret', !!account && account.issuer === cloud.url && /^[0-9a-f-]{36}$/.test(account.clientId) && typeof account.clientSecret === 'string' && account.clientSecret.length >= 40 && Object.keys(account).sort().join() === 'clientId,clientSecret,issuer', JSON.stringify(row?.config?.auth ? Object.keys(row.config.auth) : row))
  secrets.add(account.clientSecret)
  const client = { name: site.name, url: site.publicUrl, clientId: account.clientId, clientSecret: account.clientSecret }
  const [kept] = await query('select id, owner_id, site_id, name, url, secret_hash, revoked_at from account_clients where site_id = $1', [site.id])
  check('the issuer keeps that client for the site: its owner, the site\'s address, the hash of that secret', kept?.id === account.clientId && kept.owner_id === alena.id && kept.url === site.publicUrl && kept.secret_hash === sha256(account.clientSecret) && kept.revoked_at === null, JSON.stringify(kept))
  const [siteRow] = await query('select secrets, driver_state::text as state from sites where id = $1', [site.id])
  check('the cloud keeps the secret with the site\'s other secrets, encrypted', siteRow.secrets.startsWith('v1.') && !siteRow.secrets.includes(account.clientSecret) && !siteRow.state.includes(account.clientSecret))
  const procs = await templateProcesses()
  const environment = (await run('ps', ['eww', '-o', 'command=', '-p', String(procs[0].pid)])).stdout
  check('the secret is the site\'s own setting: the environment of the process that serves every site does not hold it', procs.length === 1 && environment.includes('NUXT_CMS_TENANCY_MODE=multi') && !environment.includes(account.clientSecret) && !environment.includes('NUXT_CMS_AUTH_ACCOUNT'), environment.includes('NUXT_CMS_TENANCY_MODE=multi') ? 'it is there' : 'ps did not show the environment')

  const entered = await signInThrough(alena.browser, client)
  check('the issuer accepts that client: a sign-in that comes back to the site\'s own callback names its owner, e-mail confirmed', entered.asked.back?.origin === site.publicUrl && entered.asked.back.pathname === CALLBACK && entered.status === 200 && entered.body.user.sub === alena.id && entered.body.user.email_verified === true, `${about(entered.asked)} | ${entered.text?.slice(0, 200)}`)
  const switcher = await sitesOf(client, alena.id)
  check('its switcher lists the site with the owner\'s connected websites, the site marked current', switcher.status === 200 && JSON.stringify(switcher.body.sites.map((s) => [s.name, s.current])) === JSON.stringify([['Studio Grand', false], ['6dance', false], ['Ateliér Alena', true]]), switcher.text)
  check('and a connected website\'s switcher lists the site made here', (await sitesOf(a1, alena.id)).body.sites.some((s) => s.id === client.clientId && s.url === site.publicUrl))
  const again = await alena.browser.post(`/api/sites/${site.id}/invite`)
  check('seeing to the site again hands over the same client, not a new one', again.status === 200 && JSON.stringify(directory().find((r) => r.id === site.id).config.auth.account) === JSON.stringify(account), `${again.status}`)

  log('12 · into the admin through the account')
  const view = await siteOf(alena.browser, site.id)
  check('"Open the admin" leads to the site\'s own start of a sign-in through the account', view.adminUrl === `${site.publicUrl}/api/cms/_auth/account/start?next=/admin`, view.adminUrl)
  check('the owner is still invited to the site as before (the site needs a row for them); the link stays as the second way', typeof view.inviteUrl === 'string' && view.inviteUrl.startsWith(`${site.publicUrl}/admin/invite/`) && view.inviteExpired === false && view.ownerAccepted === false)
  const sitePage = await alena.browser.page(`/sites/${site.id}`)
  check('the site\'s page leads with "Open the admin" through the account, for an owner whose e-mail is confirmed', sitePage.status === 200 && sitePage.text.includes('data-admin-way="account"') && sitePage.text.includes('data-open-admin') && sitePage.text.includes(`${site.publicUrl}/api/cms/_auth/account/start?next=/admin`), `${sitePage.status}`)
  check('the password of the site\'s own admin is a quiet second way, not the lead', sitePage.text.includes('data-second-way') && sitePage.text.includes('data-invite') && !sitePage.text.includes('Nastavte si heslo do administrace') && sitePage.text.indexOf('data-open-admin') < sitePage.text.indexOf('data-invite'))
  const cards = await alena.browser.page('/sites')
  check('the card in "My websites" opens the admin the same way; the connected websites are listed apart', cards.text.includes(`data-card-admin="${site.slug}"`) && cards.text.includes('data-connected-sites') && cards.text.includes(`data-connected-site="${a1.clientId}"`))
  // Ota has not confirmed his e-mail: the site would not link him, so the page says so.
  const otas = await ota.browser.post('/api/sites', { name: 'Foto Ota', slug: `acct-ota-${stamp}`, template: 'photographer', look: 'negativ' })
  check('a person whose e-mail is not confirmed makes a website too', otas.status === 201, `${otas.status} ${otas.text.slice(0, 200)}`)
  const otaSite = await untilReady(ota.browser, otas.body.site.id)
  const otaPage = await ota.browser.page(`/sites/${otaSite.id}`)
  check('their page says in plain words that the e-mail must be confirmed first, with the way to send the link again', otaPage.text.includes('data-admin-way="confirm"') && otaPage.text.includes('data-confirm-first') && otaPage.text.includes('Nejdřív potvrďte e-mail') && otaPage.text.includes('data-resend') && !otaPage.text.includes('data-open-admin'), `${otaPage.status}`)
  check('and keeps the invitation link as the way in meanwhile', otaPage.text.includes('data-invite') && otaPage.text.includes(`${otaSite.publicUrl}/admin/invite/`) && !(await ota.browser.page('/sites')).text.includes('data-card-admin'))
  check('sending the confirmation again works', (await ota.browser.post('/api/auth/verify-resend')).status === 200)
  await confirmEmail(ota.browser, (await ota.browser.get('/api/account')).body.devVerifyUrl)
  check('once confirmed, the same page leads with "Open the admin"', (await ota.browser.page(`/sites/${otaSite.id}`)).text.includes('data-admin-way="account"'))
  secrets.add(directory().find((r) => r.id === otaSite.id).config.auth.account.clientSecret)
  check('each site has a client of its own', directory().find((r) => r.id === otaSite.id).config.auth.account.clientId !== account.clientId && directory().find((r) => r.id === otaSite.id).config.auth.account.clientSecret !== account.clientSecret)

  // A member of somebody else's cloud-made site.
  check('Marta signs in to Alena\'s site through the account, and the site reports her role', (await signInThrough(marta.browser, client)).status === 200 && (await membership(client, { sub: marta.id, role: 'editor', active: true })).status === 200)
  const martas = (await marta.browser.get('/api/sites')).body
  check('it is in Marta\'s "My websites" among the websites she works on, not among her own', martas.sites.length === 0 && martas.member.some((m) => m.id === client.clientId && m.name === 'Ateliér Alena' && m.role === 'editor' && m.url === site.publicUrl), JSON.stringify(martas.member))
  check('she cannot open its page, delete it or ask for its invitation: only its owner can', (await marta.browser.get(`/api/sites/${site.id}`)).status === 404 && (await marta.browser.post(`/api/sites/${site.id}/remove`, { confirm: site.slug })).status === 404 && (await marta.browser.post(`/api/sites/${site.id}/invite`)).status === 404)

  log('    deleting the site through the cloud')
  const waiting = await authorize(marta.browser, client)
  const removal = await alena.browser.post(`/api/sites/${site.id}/remove`, { confirm: site.slug })
  check('the removal is accepted', removal.status === 200, removal.text)
  const [revoked] = await query('select revoked_at from account_clients where id = $1', [client.clientId])
  check('deleting a cloud site revokes its client at once', revoked.revoked_at !== null)
  check('its secret is refused from then on (401), also for a code that was on its way', (await token(client, waiting)).status === 401 && (await sitesOf(client, alena.id)).status === 401)
  check('authorize for it shows the error page', refusedWithPage(await authorize(alena.browser, client), 'oauth.client'))
  await waitFor(async () => (await query('select status from sites where id = $1', [site.id]))[0]?.status === 'removed', { timeout: 30_000, what: 'the site to be removed' })
  check('it left Marta\'s list and the switcher of the owner\'s other websites', !(await marta.browser.get('/api/sites')).body.member.some((m) => m.id === client.clientId) && !(await sitesOf(a1, alena.id)).text.includes(client.clientId))
  check('the other site keeps its client', (await query('select revoked_at from account_clients where site_id = $1', [otaSite.id]))[0].revoked_at === null)
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
    await dropCloudDatabase().catch((e) => console.error('cleanup:', e.message))
    if (cleaned) log(`cleaned up: stopped ${cleaned.processes.length} process(es) (${cleaned.processes.join(', ') || 'none'}), dropped ${cleaned.databases} site database(s), ${cleaned.roles} user(s) and ${DB}, removed ${dataDir}`)
  }
  const seconds = Math.round((Date.now() - startedAt) / 1000)
  writeFileSync(join(preview, 'e2e-account-result.json'), JSON.stringify({ at: new Date().toISOString(), ok: !failed, checks: results.length, seconds, failedAt: failed ? String(failed.message) : null, results }, null, 2))
  log(failed ? `FAILED: ${missed.length} of ${results.length} checks, ${seconds} s${missed.length ? ` (${missed.map((r) => r.name).join('; ')})` : ''}` : `all ${results.length} checks passed in ${seconds} s`)
  if (failed && existsSync(logFile)) console.error('--- last lines of the cloud app log ---\n' + readFileSync(logFile, 'utf8').split('\n').slice(-25).join('\n'))
}
process.exit(failed ? 1 : 0)
