import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, renameSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { playgroundDir, testDatabaseUrl } from '../setup/database'
import { Client, type ReceivedHook } from './api'
import { startServer, type SpawnedServer } from './server'

/**
 * Two sites served by ONE process in multi-tenant mode (packages/cms/server/utils/cmsSite.ts),
 * for the isolation suite (test/api/tenants-*.spec.ts).
 *
 * Each site has its own database, its own database user (which may open that database
 * only), its own upload folder, mail folder, tokens and webhook receiver. Site B's database
 * is a COPY of site A's, made after A got its accounts and first content: both hold the
 * same user ids, password hashes, session versions and entry ids. That is the hardest case
 * (a hosted site made from a template database looks like this), so a session, a token or
 * an id of A always "exists" on B, and only the site's own separation can refuse it.
 *
 * Addresses: http://site-a.localhost:<port> and http://site-b.localhost:<port>. Node and
 * browsers resolve *.localhost to this machine; the Host header is what chooses the site
 * (Node's fetch does not let a test set Host itself).
 */
export const TENANT_PASSWORD = 'correct horse battery'
const APP_SECRET = 'test-app-secret-at-least-32-characters-long'

export interface TenantSite {
  id: string
  /** http://site-a.localhost:<port> */
  url: string
  host: string
  databaseUrl: string
  /** The site's own database user and database. */
  role: string
  database: string
  uploadsDir: string
  mailDir: string
  hooksDir: string
  statusToken: string
  setupToken: string
  contentToken: string
  webhookSecret: string
  /** Sessions of the three accounts (the same people on both sites, signed in on each). */
  cookies: { admin: string; editor: string; author: string }
  /** The same ids on both sites. */
  users: { admin: string; editor: string; author: string }
}

export interface Tenants {
  server: SpawnedServer
  port: number
  a: TenantSite
  b: TenantSite
  /** An address of this server that belongs to no site. */
  unknownUrl: string
  /** The server reached by IP (no site). */
  ipUrl: string
  directoryFile: string
  /** Rewrite the site directory (the server rereads it within a second). */
  writeDirectory(sites: unknown[]): Promise<void>
  /** The directory rows as written at start. */
  rows: any[]
  /** A connection as the cluster's administrator (for assertions on databases and roles). */
  adminUrl: string
  /**
   * A third site, made while the server runs: its own database user and an empty, migrated
   * database of its own (no accounts: it is before its first-run setup). Returns its
   * directory row (write it with `writeDirectory([...t.rows, row])`) and the site as the
   * tests see it. Its database and user are dropped by `stop()`; asked for again, the third
   * site is made anew (empty).
   */
  makeThirdSite(): Promise<{ row: any; site: Omit<TenantSite, 'cookies' | 'users'> }>
  stop(): Promise<void>
}

export interface TenantsOptions {
  /**
   * Content made on site A BEFORE its database is copied to site B: both sites then hold
   * these entries under the same ids (and the same media rows, redirects, tokens…). Called
   * with a client signed in as A's administrator while only A exists; `query` asks A's
   * database (as A's own user), for work that must be finished before the copy is made
   * (the server is stopped right after: what a background worker left half done stays so).
   */
  seed?: (a: { url: string; admin: Client; query: <T = any>(text: string, params?: unknown[]) => Promise<T[]> }) => Promise<void>
  /**
   * More settings for a site's directory row, laid over the `config` this helper writes (one
   * level deep: `{ auth: { account: … } }` keeps the row's `auth.setupToken`). Called for
   * every row written, with the site's public address: sign-in with the account gives each
   * site its own client this way (tenants-account.spec.ts).
   */
  siteConfig?: (site: 'a' | 'b' | 'c', publicUrl: string) => Record<string, Record<string, unknown>>
}

function adminClient(db = 'postgres'): pg.Client {
  const url = new URL(testDatabaseUrl())
  url.pathname = `/${db}`
  return new pg.Client({ connectionString: url.toString() })
}

async function asAdmin<T>(db: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = adminClient(db)
  await c.connect()
  try { return await fn(c) }
  finally { await c.end() }
}

const ident = (name: string) => {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`odd identifier: ${name}`)
  return `"${name}"`
}

/** POST JSON to a site; returns the status, the body and the cookie the response set. */
export async function tenantPost(base: string, path: string, body: unknown, cookie = '', headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', origin: base, ...(cookie ? { cookie } : {}), ...headers },
    body: JSON.stringify(body),
  })
  const setCookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }
  return { status: res.status, body: json, text, cookie: setCookie }
}

export async function tenantGet(base: string, path: string, cookie = '', headers: Record<string, string> = {}) {
  const res = await fetch(base + path, { headers: { accept: 'application/json', ...(cookie ? { cookie } : {}), ...headers }, redirect: 'manual' })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }
  return { status: res.status, body: json, text, headers: res.headers }
}

async function webhookReceiver(): Promise<{ url: string; dir: string; close: () => Promise<void> }> {
  const dir = mkdtempSync(join(tmpdir(), 'cms-tenant-hooks-'))
  let seq = 0
  const server = createHttpServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      writeFileSync(join(dir, `${String(++seq).padStart(6, '0')}.json`), JSON.stringify({ path: req.url, headers: req.headers, body }))
      res.statusCode = 200
      res.end()
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as { port: number }
  return { url: `http://127.0.0.1:${port}`, dir, close: async () => { await new Promise((r) => server.close(r)); rmSync(dir, { recursive: true, force: true }) } }
}

/**
 * Start the two sites. `suffix` keeps one spec file's databases and roles apart from
 * another's (`<test db>_<suffix>_a`). `env` goes to the server process.
 */
export async function startTenants(suffix: string, env: Record<string, string> = {}, options: TenantsOptions = {}): Promise<Tenants> {
  if (!/^[a-z0-9]+$/.test(suffix)) throw new Error(`odd suffix: ${suffix}`)
  const base = new URL(testDatabaseUrl())
  const testDb = base.pathname.replace(/^\//, '')
  if (!/(^|_)test(_|$)/.test(testDb)) throw new Error(`the test database name must contain "test", got ${testDb}`)
  const dbName = (site: string) => `${testDb}_${suffix}_${site}`
  // A role per site: a login that may connect to its own database and nothing else.
  const roleName = (site: string) => `${testDb}_${suffix}_${site}_user`
  const password = (site: string) => `pw_${suffix}_${site}`
  const urlFor = (site: string) => {
    const u = new URL(base)
    u.username = roleName(site); u.password = password(site); u.pathname = `/${dbName(site)}`
    return u.toString()
  }

  const dropAll = () => asAdmin('postgres', async (c) => {
    // Both databases first: B's copy still names A's user in places (the extension's owner, grants).
    for (const site of ['a', 'b', 'c']) await c.query(`drop database if exists ${ident(dbName(site))} with (force)`)
    for (const site of ['a', 'b', 'c']) await c.query(`drop role if exists ${ident(roleName(site))}`)
  })
  await dropAll()

  // Site A: a role, a database it owns, nobody else may connect; migrated as that role.
  await asAdmin('postgres', async (c) => {
    for (const site of ['a', 'b']) await c.query(`create role ${ident(roleName(site))} login password '${password(site)}' nosuperuser nocreatedb nocreaterole`)
    await c.query(`create database ${ident(dbName('a'))} owner ${ident(roleName('a'))}`)
    await c.query(`revoke connect on database ${ident(dbName('a'))} from public`)
  })
  {
    const pool = new pg.Pool({ connectionString: urlFor('a') })
    try { await migrate(drizzle(pool), { migrationsFolder: join(playgroundDir, 'server/db/migrations') }) }
    finally { await pool.end() }
  }

  const dirs = mkdtempSync(join(tmpdir(), 'cms-tenants-'))
  const directoryFile = join(dirs, 'sites.json')
  const hooks = { a: await webhookReceiver(), b: await webhookReceiver(), c: await webhookReceiver() }
  const withSiteConfig = <T extends { publicUrl: string; config: Record<string, any> }>(site: 'a' | 'b' | 'c', row: T): T => {
    for (const [key, value] of Object.entries(options.siteConfig?.(site, row.publicUrl) ?? {})) row.config[key] = { ...row.config[key], ...value }
    return row
  }
  const siteRow = (site: 'a' | 'b' | 'c', port: number) => withSiteConfig(site, {
    id: `site-${site}`,
    hosts: [`site-${site}.localhost`, `www.site-${site}.localhost`],
    publicUrl: `http://site-${site}.localhost:${port}`,
    databaseUrl: urlFor(site),
    secret: `secret-of-site-${site}-at-least-32-characters`,
    config: {
      auth: { setupToken: `setup-code-${site}` },
      status: { token: `status-token-of-site-${site}-0123456789` },
      webhooks: { urls: `${hooks[site].url}/hook`, secret: `webhook-secret-${site}` },
      storage: { driver: 'local', local: { dir: join(dirs, `uploads-${site}`) } },
      mail: { file: { dir: join(dirs, `mail-${site}`) } },
      forms: { notifyTo: `owner@site-${site}.test` },
    },
  })
  const write = async (sites: unknown[]) => {
    const tmp = `${directoryFile}.tmp`
    writeFileSync(tmp, JSON.stringify({ sites }, null, 2))
    renameSync(tmp, directoryFile)
    await new Promise((r) => setTimeout(r, 700)) // the server looks at the file at most twice a second
  }

  const serverEnv = (extra: Record<string, string> = {}) => ({
    DATABASE_URL: '', NUXT_CMS_DATABASE_URL: '', NUXT_CMS_PUBLIC_URL: '',
    NUXT_CMS_TENANCY_MODE: 'multi', NUXT_CMS_TENANCY_FILE: directoryFile,
    NUXT_APP_SECRET: APP_SECRET,
    NUXT_CMS_MAIL_TRANSPORT: 'file',
    NUXT_CMS_STORAGE_UPLOAD_RATE_PER_MIN: '1000',
    ...env, ...extra,
  })

  // 1. Only site A: its accounts and nothing else. The port is not known before the server
  //    starts and the directory needs it for the public address, so start on a fixed free port.
  const port = await freePort()
  writeFileSync(directoryFile, JSON.stringify({ sites: [siteRow('a', port)] }))
  let server = await startServer('', serverEnv({ PORT: String(port) }))
  const aUrl = `http://site-a.localhost:${port}`
  const bUrl = `http://site-b.localhost:${port}`
  let users: TenantSite['users']
  try {
    const admin = await tenantPost(aUrl, '/api/cms/_auth/setup', { name: 'Ada Admin', email: 'admin@test.local', password: TENANT_PASSWORD, token: 'setup-code-a' })
    if (admin.status !== 201) throw new Error(`setup on site A: ${admin.status} ${admin.text}\n${server.logs.join('')}`)
    users = { admin: admin.body.user.id, editor: '', author: '' }
    for (const [role, name] of [['editor', 'Eda Editor'], ['author', 'Alma Author']] as const) {
      const invited = await tenantPost(aUrl, '/api/cms/_users', { email: `${role}@test.local`, role }, admin.cookie)
      if (invited.status !== 201) throw new Error(`invite ${role}: ${invited.status} ${invited.text}`)
      const token = String(invited.body.inviteUrl).split('/').pop()
      const accepted = await tenantPost(aUrl, '/api/cms/_auth/accept', { token, name, password: TENANT_PASSWORD })
      if (accepted.status !== 200) throw new Error(`accept ${role}: ${accepted.status} ${accepted.text}`)
      users[role] = accepted.body.user.id
    }
    if (options.seed) {
      const client = new Client(aUrl)
      client.cookie = admin.cookie
      await options.seed({ url: aUrl, admin: client, query: (text, params) => siteQuery({ databaseUrl: urlFor('a') }, text, params) })
    }
  }
  catch (err) {
    throw new Error(`${(err as Error).message}\n${server.logs.join('')}`)
  }
  finally {
    await server.stop()
  }

  // 2. Site B = a copy of A's database (same ids everywhere), handed to B's own user.
  await asAdmin('postgres', async (c) => {
    await c.query(`create database ${ident(dbName('b'))} template ${ident(dbName('a'))} owner ${ident(roleName('b'))}`)
    await c.query(`revoke connect on database ${ident(dbName('b'))} from public`)
  })
  await asAdmin(dbName('b'), async (c) => {
    // Object by object: REASSIGN OWNED would also hand over database A itself (a database is a shared object).
    const from = roleName('a'); const to = ident(roleName('b'))
    const stmts: string[] = []
    for (const r of (await c.query(`select format('alter table %I.%I owner to ${to}', schemaname, tablename) q from pg_tables where tableowner = $1`, [from])).rows) stmts.push(r.q)
    for (const r of (await c.query(`select format('alter sequence %I.%I owner to ${to}', schemaname, sequencename) q from pg_sequences where sequenceowner = $1`, [from])).rows) stmts.push(r.q)
    for (const r of (await c.query(`select format('alter view %I.%I owner to ${to}', schemaname, viewname) q from pg_views where viewowner = $1`, [from])).rows) stmts.push(r.q)
    for (const r of (await c.query(`select format('alter type %I.%I owner to ${to}', n.nspname, t.typname) q from pg_type t join pg_namespace n on n.oid = t.typnamespace join pg_roles o on o.oid = t.typowner where o.rolname = $1 and t.typtype in ('e', 'd')`, [from])).rows) stmts.push(r.q)
    for (const r of (await c.query(`select format('alter schema %I owner to ${to}', nspname) q from pg_namespace n join pg_roles o on o.oid = n.nspowner where o.rolname = $1`, [from])).rows) stmts.push(r.q)
    for (const q of stmts) await c.query(q)
    const left = await c.query(`select count(*)::int n from pg_class c join pg_roles o on o.oid = c.relowner where o.rolname = $1`, [from])
    if (left.rows[0].n) throw new Error(`site B's copy still has ${left.rows[0].n} objects owned by site A's user`)
  })

  // 3. Both sites, one process.
  const rows = [siteRow('a', port), siteRow('b', port)]
  writeFileSync(directoryFile, JSON.stringify({ sites: rows }))
  server = await startServer('', serverEnv({ PORT: String(port) }))

  const signIn = async (url: string) => {
    const cookies = {} as TenantSite['cookies']
    for (const role of ['admin', 'editor', 'author'] as const) {
      const res = await tenantPost(url, '/api/cms/_auth/login', { email: `${role}@test.local`, password: TENANT_PASSWORD })
      if (res.status !== 200) { await server.stop(); throw new Error(`sign in ${role} on ${url}: ${res.status} ${res.text}\n${server.logs.join('')}`) }
      cookies[role] = res.cookie
    }
    return cookies
  }
  const site = async (s: 'a' | 'b'): Promise<TenantSite> => {
    const row = siteRow(s, port)
    const url = s === 'a' ? aUrl : bUrl
    return {
      id: row.id, url, host: `site-${s}.localhost`, databaseUrl: row.databaseUrl, role: roleName(s), database: dbName(s),
      uploadsDir: row.config.storage.local.dir, mailDir: row.config.mail.file.dir, hooksDir: hooks[s].dir,
      statusToken: row.config.status.token, setupToken: row.config.auth.setupToken, contentToken: '', webhookSecret: row.config.webhooks.secret,
      cookies: await signIn(url), users: { ...users },
    }
  }

  const adminUrl = (() => { const u = new URL(base); u.pathname = '/postgres'; return u.toString() })()
  return {
    server, port, a: await site('a'), b: await site('b'),
    unknownUrl: `http://nobody.localhost:${port}`, ipUrl: `http://127.0.0.1:${port}`,
    directoryFile, writeDirectory: write, rows, adminUrl,
    async makeThirdSite() {
      await asAdmin('postgres', async (c) => {
        // Asked for again (another test of the same file): a new, empty one.
        await c.query(`drop database if exists ${ident(dbName('c'))} with (force)`)
        await c.query(`drop role if exists ${ident(roleName('c'))}`)
        await c.query(`create role ${ident(roleName('c'))} login password '${password('c')}' nosuperuser nocreatedb nocreaterole`)
        await c.query(`create database ${ident(dbName('c'))} owner ${ident(roleName('c'))}`)
        await c.query(`revoke connect on database ${ident(dbName('c'))} from public`)
      })
      const pool = new pg.Pool({ connectionString: urlFor('c') })
      try { await migrate(drizzle(pool), { migrationsFolder: join(playgroundDir, 'server/db/migrations') }) }
      finally { await pool.end() }
      const row = siteRow('c', port)
      return {
        row,
        site: {
          id: row.id, url: `http://site-c.localhost:${port}`, host: 'site-c.localhost', databaseUrl: row.databaseUrl, role: roleName('c'), database: dbName('c'),
          uploadsDir: row.config.storage.local.dir, mailDir: row.config.mail.file.dir, hooksDir: hooks.c.dir,
          statusToken: row.config.status.token, setupToken: row.config.auth.setupToken, contentToken: '', webhookSecret: row.config.webhooks.secret,
        },
      }
    },
    async stop() {
      await server.stop()
      await hooks.a.close(); await hooks.b.close(); await hooks.c.close()
      rmSync(dirs, { recursive: true, force: true })
      await dropAll()
    },
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createHttpServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address() as { port: number }; srv.close(() => resolve(port)) })
  })
}

/** A query against a site's database, as that site's own user. */
export async function siteQuery<T = any>(site: Pick<TenantSite, 'databaseUrl'>, text: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: site.databaseUrl })
  await c.connect()
  try { return (await c.query(text, params)).rows as T[] }
  finally { await c.end() }
}

// ── what the single-site helpers of test/helpers/api.ts do, for one site of the two ──

/** A browser on `site`: anonymous, or with one of its three sessions (or any cookie: another site's, to show it is refused). */
export function siteClient(site: { url: string; cookies?: TenantSite['cookies'] }, as?: 'admin' | 'editor' | 'author' | { cookie: string }): Client {
  const c = new Client(site.url)
  if (typeof as === 'string') c.cookie = site.cookies![as]
  else if (as) c.cookie = as.cookie
  return c
}

/** Sign in on `site` with e-mail and password: a session of its own (for tests that end it). */
export async function siteLogin(site: { url: string }, email: string, password = TENANT_PASSWORD): Promise<Client> {
  const c = new Client(site.url)
  const res = await c.post('/api/cms/_auth/login', { email, password })
  if (res.status !== 200) throw new Error(`login ${email} on ${site.url} failed: ${res.status} ${JSON.stringify(res.body)}`)
  return c
}

export interface SiteMail { to: string; from?: string; subject: string; text: string; html: string; replyTo?: string }

/** E-mails the server wrote into `site`'s own mail folder (file transport), newest first, optionally only to `to`. */
export function siteMail(site: { mailDir: string }, to?: string): SiteMail[] {
  if (!existsSync(site.mailDir)) return []
  return readdirSync(site.mailDir).sort().reverse()
    .map((f) => {
      // A file the server is still writing reads as cut-off JSON: it is not there yet.
      try { return JSON.parse(readFileSync(join(site.mailDir, f), 'utf8')) }
      catch { return null }
    })
    .filter((m) => m && (!to || m.to === to))
}

/** Wait for an e-mail to `to` in `site`'s mail folder (some are sent after the response). */
export async function waitForSiteMail(site: { mailDir: string }, to: string, match: (m: SiteMail) => boolean = () => true, timeoutMs = 5000): Promise<SiteMail> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const mail = siteMail(site, to).find(match)
    if (mail) return mail
    if (Date.now() > deadline) throw new Error(`no email to ${to} in ${site.mailDir} within ${timeoutMs}ms`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

/** Webhooks `site`'s own receiver got (oldest first), after `since` (a file name from `siteHooksMark`). */
export function siteHooks(site: { hooksDir: string }, since = ''): ReceivedHook[] {
  return readdirSync(site.hooksDir).sort().filter((f) => f > since).flatMap((file) => {
    try {
      const h = JSON.parse(readFileSync(join(site.hooksDir, file), 'utf8'))
      return [{ file, failed: false, ...h, json: JSON.parse(h.body) }]
    }
    catch { return [] } // still being written
  })
}

export const siteHooksMark = (site: { hooksDir: string }) => siteHooks(site).at(-1)?.file ?? ''

export async function waitForSiteHooks(site: { hooksDir: string }, since: string, match: (hooks: ReceivedHook[]) => boolean, timeoutMs = 10_000): Promise<ReceivedHook[]> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hooks = siteHooks(site, since)
    if (match(hooks)) return hooks
    if (Date.now() > deadline) throw new Error(`webhooks did not arrive at ${site.hooksDir} within ${timeoutMs}ms: ${JSON.stringify(hooks.map((h) => [h.path, h.json.type, h.json.entity]))}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

/** Poll `read` until `ok` holds; throws with `what` when it does not within the time. */
export async function until<T>(what: string, read: () => Promise<T> | T, ok: (value: T) => boolean, timeoutMs = 8000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await read()
    if (ok(value)) return value
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}; last: ${JSON.stringify(value)?.slice(0, 500)}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

/** Every file under a folder, as paths relative to it (a missing folder has none). */
export function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  return (readdirSync(dir, { recursive: true, withFileTypes: true }) as any[])
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath ?? e.path, e.name).slice(dir.length + 1))
    .sort()
}

/**
 * Work that ran with no site says so in the log (`CmsNoSiteError`, "No site for …"): a timer,
 * a hook or a task that was started without naming its site. Each spec file checks, at its
 * end, that its server never logged one; the lines themselves are in the failure.
 */
export function noSiteErrorLines(t: Pick<Tenants, 'server'>): string[] {
  return t.server.logs.join('').split('\n').filter((line) => /CmsNoSiteError|No site for /.test(line))
}

export function expectNoSiteErrors(t: Pick<Tenants, 'server'> | undefined): void {
  if (!t) return
  expect(noSiteErrorLines(t), 'work that ran without a site (see the lines)').toEqual([])
}
