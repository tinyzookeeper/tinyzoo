import { mkdtempSync, rmSync, writeFileSync, renameSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { playgroundDir, testDatabaseUrl } from '../setup/database'
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
  stop(): Promise<void>
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
export async function startTenants(suffix: string, env: Record<string, string> = {}): Promise<Tenants> {
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
    for (const site of ['a', 'b']) {
      await c.query(`drop database if exists ${ident(dbName(site))} with (force)`)
      await c.query(`drop role if exists ${ident(roleName(site))}`)
    }
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
  const hooks = { a: await webhookReceiver(), b: await webhookReceiver() }
  const siteRow = (site: 'a' | 'b', port: number) => ({
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
    async stop() {
      await server.stop()
      await hooks.a.close(); await hooks.b.close()
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
export async function siteQuery<T = any>(site: TenantSite, text: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: site.databaseUrl })
  await c.connect()
  try { return (await c.query(text, params)).rows as T[] }
  finally { await c.end() }
}
