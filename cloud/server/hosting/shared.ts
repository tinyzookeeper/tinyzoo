import { execFile, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { and, asc, eq, inArray, isNotNull, notInArray } from 'drizzle-orm'
import { directoryKey } from '../../shared/directorySecret'
import { planById } from '../../shared/plans'
import { parsePortRange, pickPort } from '../../shared/ports'
import {
  assertSiteId, assertTemplateId, passwordOfDatabaseUrl, SHARED_PORT_RANGE, sharedDatabaseNameFor, sharedDatabasePrefix,
  sharedDatabaseUrl, sharedSiteRow, sharedSiteUrl, splitSiteEnv, sqlLiteral, withoutSharedSite, withSharedSite,
  type SharedSiteDomains, type SharedSiteRow, type SharedSiteState,
} from '../../shared/sharedHosting'
import { quoteIdent } from '../../shared/slug'
import type { TemplateDef } from '../../shared/templates'
import type { SiteRow } from '../db/schema'
import { siteDirectory, writePrivate, type DirectoryKind, type DirectoryReader, type SiteDirectory } from './directory'
import { portIsFree } from './local'
import { HostingError, type HostedSite, type HostingDriver, type OnStep, type Provisioned, type SiteAccess, type SiteSpec } from './types'

// The shared driver: one process per TEMPLATE serves every site made from it (tinyzoo's
// multi-tenant mode, packages/cms/server/utils/cmsSite.ts). A new site is a database, a folder
// and a row in its template's site directory. Nothing is built and no process is started per site.
//
// Per template, in `<data>/<template id>/`, made the first time a site of it is made or must run:
//  - `sites.json`  the site directory: one row per site (its host name, database address,
//                  secrets, upload folder). The process rereads it when it changes.
//  - `app.json`    the process's port, pid, start time and its own app secret (made once).
//  - `server.log`  what the process prints.
//  - one detached process, `node <template>/.output/server/index.mjs --template-dir=<folder>`,
//    with a clean environment. The extra argument means nothing to the server; it is how the
//    driver recognises a process as this folder's. A pid alone is never trusted.
//
// Per site:
//  - a Postgres role and an empty database owned by it, both named `<prefix>_<the site's id>`
//    (never the slug: every role of a server can list the names). Nobody else may connect to
//    the database. The site's own app migrates it, as that role, the first time it is used.
//  - a folder `<data>/<template id>/sites/<site id>/` with its uploads;
//  - its row in `sites.json`.
//
// Address: http://<slug>.localhost:<the template's port>, for people and for the cloud alike.
// The host name is what chooses the site, so the cloud cannot talk to 127.0.0.1 here as it does
// with the local driver; Node resolves *.localhost to this machine, as browsers do.
//
// The database password is kept in `sites.json` (plain text, readable by the owner only) and,
// encrypted, in the site's `driver_state`. When `sites.json` or `app.json` is lost, the driver
// writes it again from what the cloud's database keeps: the rows of every site of the
// template (not only of the one that was asked for), and the template's port.
//
// The driver never stops a template's process: it serves the other sites.
//
// Where the site directory is kept is a setting (NUXT_HOSTING_SHARED_DIRECTORY): the file above,
// or the table `tenant_sites` in the cloud's own database, read by the template's process with a
// role that may read that table and nothing else (./directory.ts has both). With a directory key
// (NUXT_HOSTING_SHARED_DIRECTORY_KEY) no password and no secret is stored in plain text in either.
//
// What a row says besides the site's secrets comes from what the cloud keeps about the site
// (its `sites` row and its domains): its state (served, paused, read-only, moved), its own
// domains, and the limits of its plan. A change of any of them is `refresh`.

const run = promisify(execFile)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface SharedConfig { root: string; dataDir: string; portFrom: number; portTo: number; databasePrefix: string; directory: DirectoryKind; directoryKey: string }
/**
 * `app.json`: what is known about a template's process. `reader` is the Postgres role the
 * process reads the directory table with, `operator` the token of its own status route
 * (GET /api/health/sites); the reader's password and the token are kept encrypted.
 */
interface AppFile { port: number; pid: number | null; startedAt: string | null; secret: string; reader?: DirectoryReader; operator?: string }
/** `sites/<site id>/site.json`: written before the site's database is made, so finding it means the database under this name is the site's own. */
interface SiteFile { database: string; role: string; createdAt: string }

/** The repository's root: the nearest folder upwards with a pnpm-workspace.yaml. */
function findRoot(from: string): string {
  let dir = resolve(from)
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const up = dirname(dir)
    if (up === dir) return resolve(from, '..')
    dir = up
  }
}

function config(): SharedConfig {
  const c = ((useRuntimeConfig().hosting as any)?.shared ?? {}) as Record<string, unknown>
  const root = c.root ? resolve(String(c.root)) : findRoot(process.cwd())
  const range = parsePortRange(c.portFrom, c.portTo, SHARED_PORT_RANGE)
  return {
    root,
    dataDir: c.dataDir ? resolve(String(c.dataDir)) : join(root, 'cloud', '.data', 'shared'),
    portFrom: range.from,
    portTo: range.to,
    databasePrefix: sharedDatabasePrefix(c.databasePrefix),
    directory: directoryKind(c.directory),
    directoryKey: directoryKey(c.directoryKey),
  }
}

function directoryKind(value: unknown): DirectoryKind {
  const kind = String(value ?? '').trim() || 'file'
  if (kind !== 'file' && kind !== 'postgres') throw new Error(`NUXT_HOSTING_SHARED_DIRECTORY must be "file" or "postgres", got ${JSON.stringify(kind)}`)
  return kind
}

/** The repository's root as the shared driver is told (NUXT_HOSTING_SHARED_ROOT), for the seed of a site it made. */
export const sharedRoot = (): string => config().root

/** Where the shared driver keeps its folders (NUXT_HOSTING_SHARED_DATA_DIR): archives that are uploaded wait in a folder of their own there. */
export const sharedDataDir = (): string => config().dataDir

// ── folders and files ───────────────────────────────────────────────────────────

/** A template's folder. The id is checked again here: it becomes a path. */
function templateDir(template: TemplateDef): string {
  const base = config().dataDir
  const dir = join(base, assertTemplateId(template.id))
  if (!dir.startsWith(base + sep)) throw new HostingError('start_failed', `refusing a folder outside ${base}`)
  return dir
}

/** A site's folder inside its template's. */
function siteDirOf(tdir: string, siteId: string): string {
  const base = join(tdir, 'sites')
  const dir = join(base, assertSiteId(siteId))
  if (!dir.startsWith(base + sep)) throw new HostingError('start_failed', `refusing a folder outside ${base}`)
  return dir
}

const appFile = (tdir: string) => join(tdir, 'app.json')
const siteFile = (sdir: string) => join(sdir, 'site.json')

/** A template's site directory: the file in its folder, or the table (./directory.ts). */
function directoryOf(template: TemplateDef, tdir: string): SiteDirectory {
  const c = config()
  return siteDirectory({ kind: c.directory, key: c.directoryKey, templateId: template.id, templateDir: tdir, databasePrefix: c.databasePrefix })
}

function readAppFile(tdir: string): AppFile | null {
  try {
    const raw = JSON.parse(readFileSync(appFile(tdir), 'utf8'))
    const port = Number(raw?.port)
    if (!Number.isInteger(port) || typeof raw.secret !== 'string' || raw.secret.length < 32) return null
    const reader = typeof raw.reader?.role === 'string' && typeof raw.reader.password === 'string' ? { role: raw.reader.role, password: raw.reader.password } : undefined
    return {
      port, pid: Number.isInteger(raw.pid) ? raw.pid : null, startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : null, secret: raw.secret,
      ...(reader ? { reader } : {}), ...(typeof raw.operator === 'string' ? { operator: raw.operator } : {}),
    }
  }
  catch {
    return null
  }
}

const writeAppFile = (tdir: string, file: AppFile): void => writePrivate(appFile(tdir), `${JSON.stringify(file, null, 2)}\n`)

function readSiteFile(sdir: string): SiteFile | null {
  try {
    const raw = JSON.parse(readFileSync(siteFile(sdir), 'utf8'))
    return typeof raw?.database === 'string' && typeof raw.role === 'string' ? { database: raw.database, role: raw.role, createdAt: String(raw.createdAt ?? '') } : null
  }
  catch {
    return null
  }
}

// ── the template's process ──────────────────────────────────────────────────────

const marker = (tdir: string) => `--template-dir=${tdir}`

/** A process's command line, or null when there is no such process. */
async function commandOf(pid: number): Promise<string | null> {
  try {
    const { stdout } = await run('ps', ['-o', 'command=', '-p', String(pid)])
    return stdout.trim() || null
  }
  catch {
    return null
  }
}

/** Whether `pid` is this template folder's process: its command line names the folder. */
async function isOurs(pid: number | null | undefined, tdir: string): Promise<boolean> {
  if (!pid || pid <= 1) return false
  const command = await commandOf(pid)
  return !!command && command.split(/\s+/).includes(marker(tdir))
}

/** The processes listening on a port. */
async function listeners(port: number): Promise<number[]> {
  try {
    const { stdout } = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    return stdout.split('\n').map((l) => Number(l.trim())).filter((n) => Number.isInteger(n) && n > 1)
  }
  catch {
    return []
  }
}

/** The process answers for itself (asked by IP, with no site). */
async function processAnswers(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health/ready`, { signal: AbortSignal.timeout(3000), redirect: 'manual' })
    return res.status === 200
  }
  catch {
    return false
  }
}

/**
 * Where the running process reads its site directory from, as its own environment says (`ps`
 * shows it for one's own processes); null when that cannot be seen.
 */
async function directoryKindOf(pid: number): Promise<DirectoryKind | null> {
  try {
    const { stdout } = await run('ps', ['eww', '-o', 'command=', '-p', String(pid)])
    if (stdout.includes('NUXT_CMS_TENANCY_DATABASE_URL=')) return 'postgres'
    return stdout.includes('NUXT_CMS_TENANCY_FILE=') ? 'file' : null
  }
  catch {
    return null
  }
}

/** What the process itself says about its sites (its operator's route), or null when it cannot be asked. */
async function processSites(app: AppFile): Promise<{ id: string; hosts: string[]; alsoHosts: string[]; state: string }[] | null> {
  const token = decryptSecret(app.operator)
  if (!token) return null
  try {
    const res = await fetch(`http://127.0.0.1:${app.port}/api/health/sites`, { signal: AbortSignal.timeout(3000), redirect: 'manual', headers: { authorization: `Bearer ${token}`, accept: 'application/json' } })
    if (res.status !== 200) return null
    const body = await res.json() as { sites?: unknown }
    return Array.isArray(body.sites) ? body.sites as { id: string; hosts: string[]; alsoHosts: string[]; state: string }[] : null
  }
  catch {
    return null
  }
}

/**
 * Wait until the process has taken a change of the directory up: it serves the site as `row`
 * says (its hosts, its state), or no longer knows it (`row` null). A process that cannot be
 * asked (started before it had an operator's token) is given a moment instead; it looks at a
 * file at most twice a second, when something asks it, and at the table every second.
 */
async function waitUntilTaken(app: AppFile, siteId: string, row: SharedSiteRow | null, timeoutMs = 15_000): Promise<void> {
  const until = Date.now() + timeoutMs
  for (;;) {
    const sites = await processSites(app)
    if (!sites) {
      await sleep(700)
      await processAnswers(app.port)
      await sleep(800)
      return
    }
    const seen = sites.find((s) => s.id === siteId)
    if (!row && !seen) return
    if (row && seen && seen.state === (row.state ?? 'active') && JSON.stringify(seen.hosts) === JSON.stringify(row.hosts) && JSON.stringify(seen.alsoHosts) === JSON.stringify(row.alsoHosts ?? [])) return
    if (Date.now() > until) throw new HostingError('start_timeout', `the template's process did not take the change of ${siteId} up within ${Math.round(timeoutMs / 1000)} s`)
    await sleep(150)
  }
}

/** A site answers on its own host name, with its database migrated. */
async function siteAnswers(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health/ready`, { signal: AbortSignal.timeout(3000), redirect: 'manual', headers: { accept: 'application/json' } })
    if (res.status !== 200) return false
    const body = await res.json().catch(() => null) as { ok?: boolean; migrations?: string } | null
    return body?.ok === true && body.migrations === 'done'
  }
  catch {
    return false
  }
}

function logTail(tdir: string, bytes = 1500): string {
  try {
    return readFileSync(join(tdir, 'server.log'), 'utf8').slice(-bytes).trim()
  }
  catch {
    return ''
  }
}

/** The template's server entry, or a clear word that it has not been built. */
function entryOf(template: TemplateDef): string {
  if (!template.sourceDir) throw new HostingError('template_not_built', `template "${template.id}" has no source folder`)
  const entry = join(config().root, template.sourceDir, '.output', 'server', 'index.mjs')
  if (!existsSync(entry)) {
    throw new HostingError('template_not_built', `${entry} is missing. Build the template first: pnpm --filter tinyzoo-cloud templates:build`)
  }
  return entry
}

/** The ports held by every template that has a folder, running or not. */
function heldPorts(except: string): number[] {
  const base = config().dataDir
  if (!existsSync(base)) return []
  return readdirSync(base)
    .map((name) => join(base, name))
    .filter((dir) => dir !== except)
    .map((dir) => readAppFile(dir)?.port)
    .filter((p): p is number => typeof p === 'number')
}

// One port is picked at a time, and written down (with the process's secret) before the next
// pick: two templates started at the same moment never get the same one. `known` is the port
// the cloud's database remembers for a site of this template: when `app.json` was lost, the
// template comes back on it, since every address of its sites contains it.
let picking: Promise<unknown> = Promise.resolve()
function appFor(tdir: string, known?: number): Promise<AppFile> {
  const next = picking.then(async () => {
    const existing = readAppFile(tdir)
    if (existing) return existing
    const c = config()
    const port = known ?? await pickPort({ from: c.portFrom, to: c.portTo }, heldPorts(tdir), portIsFree)
    if (port == null) throw new HostingError('no_free_port', `every port from ${c.portFrom} to ${c.portTo} is in use`)
    const app: AppFile = { port, pid: null, startedAt: null, secret: randomBytes(36).toString('base64url') }
    writeAppFile(tdir, app)
    return app
  })
  picking = next.catch(() => {})
  return next
}

/**
 * Start the template's process, detached, with a clean environment (nothing of the cloud's
 * own leaks into it). `settings` is the part of a site's environment that is the same for
 * every site (the mail transport, migrations at start); the sites' own secrets are in the directory.
 */
function start(template: TemplateDef, tdir: string, app: AppFile, settings: Record<string, string>, directoryEnv: Record<string, string>, operator: string): number {
  const entry = entryOf(template)
  const out = openSync(join(tdir, 'server.log'), 'a', 0o600)
  try {
    const child = spawn(process.execPath, [entry, marker(tdir)], {
      cwd: tdir,
      detached: true,
      stdio: ['ignore', out, out],
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
        ...settings,
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: String(app.port),
        NUXT_CMS_TENANCY_MODE: 'multi',
        // Where the site directory is: the file, or the table with the reader's address (and the directory key).
        ...directoryEnv,
        NUXT_APP_SECRET: app.secret,
        NUXT_CMS_MIGRATIONS_ON_START: 'true',
        // The process's own status route (GET /api/health/sites): the driver asks it what the process serves.
        NUXT_CMS_TENANCY_OPERATOR_TOKEN: operator,
      },
    })
    child.on('error', () => { /* reported by the wait that follows: the process is not there */ })
    child.unref()
    if (!child.pid) throw new HostingError('start_failed', 'the template\'s process did not start')
    writeAppFile(tdir, { ...app, pid: child.pid, startedAt: new Date().toISOString() })
    return child.pid
  }
  finally {
    closeSync(out)
  }
}

async function waitUntilUp(tdir: string, pid: number, port: number, timeoutMs = 120_000): Promise<void> {
  const until = Date.now() + timeoutMs
  for (;;) {
    if (await processAnswers(port)) return
    if (!(await isOurs(pid, tdir))) throw new HostingError('start_failed', `the template's process stopped while starting:\n${logTail(tdir)}`)
    if (Date.now() > until) throw new HostingError('start_timeout', `the template's process did not answer within ${Math.round(timeoutMs / 1000)} s:\n${logTail(tdir)}`)
    await sleep(300)
  }
}

/** Bring the template's process up on its port, unless it already answers. */
async function up(template: TemplateDef, tdir: string, settings: Record<string, string>, known?: number): Promise<AppFile> {
  mkdirSync(tdir, { recursive: true, mode: 0o700 })
  const app = await appFor(tdir, known)
  const directory = directoryOf(template, tdir)
  const ours = await isOurs(app.pid, tdir)
  // A process started before the setting changed reads the other directory: it would never
  // see what is written now. The driver does not stop it (it serves sites); it says so.
  const wrongDirectory = async (pid: number) => {
    const reads = await directoryKindOf(pid)
    if (reads && reads !== directory.kind) {
      throw new HostingError('start_failed', `the template's process (pid ${pid}) reads its site directory from the ${reads === 'file' ? 'file' : 'database'}, and NUXT_HOSTING_SHARED_DIRECTORY now says ${directory.kind}. Stop that process; it is started again with the new setting.`)
    }
  }
  if (ours) await wrongDirectory(app.pid!)
  if (ours && await processAnswers(app.port)) return app
  if (ours) {
    // Ours and alive but not answering yet: it may still be starting.
    await waitUntilUp(tdir, app.pid!, app.port, 60_000)
    return app
  }
  if (!(await portIsFree(app.port))) {
    // Something holds the port. If it is this folder's own process (app.json lost its pid), keep it.
    for (const pid of await listeners(app.port)) {
      if (await isOurs(pid, tdir)) {
        await wrongDirectory(pid)
        const kept = { ...app, pid }
        writeAppFile(tdir, kept)
        await waitUntilUp(tdir, pid, app.port, 60_000)
        return kept
      }
    }
    throw new HostingError('port_taken', `port ${app.port} is used by another program`)
  }
  // The process reads the directory when it starts: it must exist, if only empty, and with the
  // table so must the role the process reads it with. What is new is written down before the start.
  const prepared = await directory.prepare(app.reader)
  const operator = decryptSecret(app.operator) ?? randomBytes(32).toString('base64url')
  const next: AppFile = { ...app, ...(prepared.reader ? { reader: prepared.reader } : {}), operator: decryptSecret(app.operator) ? app.operator! : encryptSecret(operator) }
  writeAppFile(tdir, next)
  const pid = start(template, tdir, next, settings, prepared.env, operator)
  await waitUntilUp(tdir, pid, next.port)
  return { ...next, pid }
}

// One start per template at a time: two sites of a template made at the same moment find one process.
const starting = new Map<string, Promise<unknown>>()
function ensureProcess(template: TemplateDef, settings: Record<string, string>, known?: number): Promise<AppFile> {
  const tdir = templateDir(template)
  const next = (starting.get(tdir) ?? Promise.resolve()).then(() => up(template, tdir, settings, known))
  starting.set(tdir, next.catch(() => {}))
  return next
}

async function waitUntilSiteAnswers(tdir: string, pid: number | null, url: string, timeoutMs: number): Promise<void> {
  const until = Date.now() + timeoutMs
  for (;;) {
    if (await siteAnswers(url)) return
    if (!(await isOurs(pid, tdir))) throw new HostingError('start_failed', `the template's process stopped:\n${logTail(tdir)}`)
    if (Date.now() > until) throw new HostingError('start_timeout', `${url} did not answer within ${Math.round(timeoutMs / 1000)} s:\n${logTail(tdir)}`)
    await sleep(300)
  }
}

// ── the site's database ─────────────────────────────────────────────────────────

const databaseOf = (siteId: string) => sharedDatabaseNameFor(siteId, config().databasePrefix)

// Once per run of the cloud app: the cloud's own database (every site's secrets are in it)
// closes to everybody but its owner. A new role may otherwise connect to any database of the
// server, even where it can read nothing.
let closed: Promise<void> | undefined
function closeOwnDatabase(): Promise<void> {
  if (closed) return closed
  const work = (async () => {
    const pool = usePool()
    const { rows } = await pool.query<{ name: string }>('select current_database() as name')
    await pool.query(`revoke connect on database "${rows[0]!.name.replace(/"/g, '""')}" from public`)
  })()
  closed = work
  // A failure is tried again with the next site.
  work.catch(() => { if (closed === work) closed = undefined })
  return work
}

/**
 * The site's database user and its database: empty, owned by that user, closed to everybody
 * else. `resuming`: this site was started here before, so what exists under its name is its
 * own and is kept; the user's password is set again, so the one about to be written into the
 * directory is right. A new site never adopts a database or a user that is already there.
 */
async function createDatabase(name: string, password: string, resuming: boolean): Promise<void> {
  const pool = usePool()
  const ident = quoteIdent(name)
  // A role takes no parameters: the password goes in as a literal.
  const rights = `login password ${sqlLiteral(password)} nosuperuser nocreatedb nocreaterole`
  let found = ''
  try {
    await closeOwnDatabase()
    const role = !!(await pool.query('select 1 from pg_roles where rolname = $1', [name])).rowCount
    const database = !!(await pool.query('select 1 from pg_database where datname = $1', [name])).rowCount
    if ((role || database) && !resuming) found = [role ? 'a user' : '', database ? 'a database' : ''].filter(Boolean).join(' and ')
    else {
      await pool.query(`${role ? 'alter' : 'create'} role ${ident} ${rights}`)
      if (!database) await pool.query(`create database ${ident} owner ${ident}`)
      await pool.query(`revoke connect on database ${ident} from public`)
    }
  }
  catch (err: any) {
    throw new HostingError('database_failed', String(err?.message ?? err))
  }
  if (found) throw new HostingError('database_failed', `the name ${name} is taken (${found}) by something that is not this site's`)
}

async function dropDatabase(name: string): Promise<void> {
  const ident = quoteIdent(name)
  await usePool().query(`drop database if exists ${ident} with (force)`)
  await usePool().query(`drop role if exists ${ident}`)
}

// ── the driver ──────────────────────────────────────────────────────────────────

/** What the cloud keeps about a site besides its secrets, and the directory row says: its state, its domains, its plan. */
interface Kept { state: SharedSiteState; movedTo: string | null; plan: string; dataRemoved: boolean; domains: SharedSiteDomains }
const NOTHING_KEPT: Kept = { state: 'active', movedTo: null, plan: '', dataRemoved: false, domains: { main: null, others: [] } }

/** That, for several sites at once, from the cloud's own database (`sites` and `site_domains`). */
async function keptOf(siteIds: string[]): Promise<Map<string, Kept>> {
  const out = new Map<string, Kept>()
  if (!siteIds.length) return out
  const db = useDb()
  const rows = await db.select({ id: schema.sites.id, state: schema.sites.hostState, movedTo: schema.sites.movedTo, plan: schema.sites.plan, dataRemovedAt: schema.sites.dataRemovedAt })
    .from(schema.sites).where(inArray(schema.sites.id, siteIds))
  for (const r of rows) out.set(r.id, { state: r.state, movedTo: r.movedTo, plan: r.plan, dataRemoved: !!r.dataRemovedAt, domains: { main: null, others: [] } })
  // Only domains whose DNS was seen to lead here are in a row; in the order they were added.
  const domains = await db.select({ siteId: schema.siteDomains.siteId, host: schema.siteDomains.host, main: schema.siteDomains.main })
    .from(schema.siteDomains).where(and(inArray(schema.siteDomains.siteId, siteIds), isNotNull(schema.siteDomains.verifiedAt)))
    .orderBy(asc(schema.siteDomains.createdAt), asc(schema.siteDomains.host))
  for (const d of domains) {
    const kept = out.get(d.siteId)
    if (!kept) continue
    if (d.main && !kept.domains.main) kept.domains.main = d.host
    else kept.domains.others.push(d.host)
  }
  return out
}

/** The site's row, as the directory holds it. */
function rowOf(site: SiteSpec, tdir: string, port: number, password: string, kept: Kept = NOTHING_KEPT): SharedSiteRow {
  const name = databaseOf(site.siteId)
  return sharedSiteRow({
    siteId: site.siteId, slug: site.slug, port, env: site.env,
    databaseUrl: sharedDatabaseUrl(databaseUrl(), name, password),
    siteDir: siteDirOf(tdir, site.siteId),
    // A site that moved away answers at its service address only: its domains went with it.
    domains: kept.state === 'moved' ? undefined : kept.domains,
    state: kept.state,
    movedTo: kept.movedTo,
    limits: planById(kept.plan).storage,
  })
}

/** The sites of a template that got as far as a database, as the cloud's own database keeps them. */
async function sitesOfTemplate(template: TemplateDef): Promise<SiteRow[]> {
  const rows = await useDb().select().from(schema.sites)
    .where(and(eq(schema.sites.driver, 'shared'), eq(schema.sites.template, template.id), notInArray(schema.sites.status, ['waiting', 'removing', 'removed'])))
  return rows.filter((r) => typeof r.driverState?.databasePassword === 'string')
}

const portOf = (state: Record<string, unknown> | null | undefined): number | undefined => {
  const port = Number(state?.port)
  return Number.isInteger(port) && port > 0 ? port : undefined
}

/**
 * The port a template is known to have when `app.json` does not say (it was lost): the one
 * in what the cloud keeps about the site at hand, else about any site of the template. Every
 * address of the template's sites contains it, so it must not change.
 */
async function knownPort(template: TemplateDef, tdir: string, state?: Record<string, unknown> | null): Promise<number | undefined> {
  if (readAppFile(tdir)) return undefined
  return portOf(state) ?? (await sitesOfTemplate(template)).map((s) => portOf(s.driverState)).find((p) => p !== undefined)
}

/**
 * Put a site's row into its template's directory. `lost`: the directory was not there (a new
 * template, or the file was lost, or the table holds nothing of the template). Then the other
 * sites of the template are written again too, from what the cloud keeps: with this row
 * alone in a file, the process would stop serving them.
 */
async function putRow(template: TemplateDef, tdir: string, port: number, row: SharedSiteRow, lost: boolean): Promise<void> {
  const others: SharedSiteRow[] = []
  if (lost) {
    const sites = (await sitesOfTemplate(template)).filter((other) => other.id !== row.id)
    const kept = await keptOf(sites.map((other) => other.id))
    for (const other of sites) {
      const password = decryptSecret(other.driverState!.databasePassword as string)
      // A site whose secrets cannot be read is left out: its own next start says why.
      try { if (password) others.push(rowOf(hostedSite(other), tdir, port, password, kept.get(other.id))) }
      catch { /* left out */ }
    }
  }
  await directoryOf(template, tdir).change((rows) => {
    let changed = false
    for (const r of [...others, row]) {
      const next = withSharedSite(rows, r)
      rows = next.rows
      changed ||= next.changed
    }
    return { rows, changed }
  })
}

/** After a row was written: the site answers as the row says. A site that is served answers ready; one that is paused or moved is only seen by the process. */
async function settle(tdir: string, app: AppFile, site: SiteSpec, row: SharedSiteRow, timeoutMs: number): Promise<void> {
  if (!row.state || row.state === 'read-only') {
    // The process serves the site as this row says (its hosts, its state), not as an earlier one did…
    await waitUntilTaken(app, row.id, row)
    // …and the site answers, its database checked. The cloud asks at the service address: the site
    // answers there whatever its own domain is. (After a row changed the site is loaded anew.)
    await waitUntilSiteAnswers(tdir, app.pid, sharedSiteUrl(site.slug, app.port), timeoutMs)
    return
  }
  await waitUntilTaken(app, row.id, row)
}

/** The password of the site's database user: what the cloud keeps, else what its row holds. */
async function passwordOf(site: HostedSite, directory: SiteDirectory): Promise<string> {
  const password = decryptSecret(typeof site.state?.databasePassword === 'string' ? site.state.databasePassword : null)
    ?? passwordOfDatabaseUrl((await directory.rows()).find((r) => r.id === site.siteId)?.databaseUrl)
  if (!password) throw new HostingError('start_failed', `the database password of ${site.slug} is not known`)
  return password
}

/**
 * Bring a site in line with what the cloud keeps about it: the template's process runs, the
 * site's row is as it should be (written again when it is not), and the site answers as the
 * row says. Returns the row.
 */
async function bring(site: HostedSite, timeoutMs: number): Promise<SharedSiteRow> {
  const tdir = templateDir(site.template)
  const directory = directoryOf(site.template, tdir)
  const lost = !(await directory.present())
  const app = await ensureProcess(site.template, splitSiteEnv(site.env).process, await knownPort(site.template, tdir, site.state))
  const kept = (await keptOf([site.siteId])).get(site.siteId) ?? NOTHING_KEPT
  const password = await passwordOf(site, directory)
  // A moved site whose data was deleted here has no folder any more, and gets none.
  if (!kept.dataRemoved) mkdirSync(siteDirOf(tdir, site.siteId), { recursive: true, mode: 0o700 })
  const row = rowOf(site, tdir, app.port, password, kept)
  await putRow(site.template, tdir, app.port, row, lost)
  await settle(tdir, app, site, row, timeoutMs)
  return row
}

/** The tinyzoo a template's build runs on (the version of the package its source folder resolves). */
function buildVersionOf(template: TemplateDef): string {
  try {
    return String(JSON.parse(readFileSync(join(config().root, template.sourceDir!, 'node_modules', 'tinyzoo', 'package.json'), 'utf8')).version ?? '')
  }
  catch {
    return ''
  }
}

/** The tinyzoo version a template's sites run on with the shared driver, or '' when the template is not built here. */
export function sharedBuildVersion(template: TemplateDef): string {
  try { entryOf(template) }
  catch { return '' }
  return buildVersionOf(template)
}

export function sharedDriver(): HostingDriver {
  return {
    name: 'shared',

    async provision(spec: SiteSpec, onStep: OnStep): Promise<Provisioned> {
      entryOf(spec.template)
      const settings = splitSiteEnv(spec.env).process
      const tdir = templateDir(spec.template)
      const sdir = siteDirOf(tdir, spec.siteId)
      const name = databaseOf(spec.siteId)
      const directory = directoryOf(spec.template, tdir)

      await onStep('database', 'running')
      // site.json is written before the database is made: finding it means this site was
      // started here before, and what exists under its name is its own.
      const resuming = readSiteFile(sdir) !== null
      mkdirSync(sdir, { recursive: true, mode: 0o700 })
      if (!resuming) writePrivate(siteFile(sdir), `${JSON.stringify({ database: name, role: name, createdAt: new Date().toISOString() } satisfies SiteFile, null, 2)}\n`)
      // The password the directory already holds for this site stays (its row does not change,
      // so a site that runs is not disturbed); otherwise a new one.
      const password = passwordOfDatabaseUrl((await directory.rows()).find((r) => r.id === spec.siteId)?.databaseUrl) ?? randomBytes(24).toString('base64url')
      await createDatabase(name, password, resuming)
      await onStep('database', 'done')

      await onStep('start', 'running')
      const lost = !(await directory.present())
      const app = await ensureProcess(spec.template, settings, await knownPort(spec.template, tdir))
      // A site that comes in as an archive starts paused: nothing touches its empty database before the archive is in it.
      const row = rowOf(spec, tdir, app.port, password, (await keptOf([spec.siteId])).get(spec.siteId))
      await putRow(spec.template, tdir, app.port, row, lost)
      await settle(tdir, app, spec, row, 120_000)
      await onStep('start', 'done')
      return {
        publicUrl: row.publicUrl,
        // The cloud itself always talks to the site at its service address.
        internalUrl: sharedSiteUrl(spec.slug, app.port),
        state: { template: spec.template.id, port: app.port, dir: sdir, database: name, role: name, databasePassword: encryptSecret(password) },
      }
    },

    async ensureRunning(site: HostedSite): Promise<void> {
      await bring(site, 60_000)
    },

    async refresh(site: HostedSite): Promise<{ publicUrl: string }> {
      return { publicUrl: (await bring(site, 60_000)).publicUrl }
    },

    async access(site: HostedSite): Promise<SiteAccess> {
      const tdir = templateDir(site.template)
      const sdir = siteDirOf(tdir, site.siteId)
      const password = await passwordOf(site, directoryOf(site.template, tdir))
      if (!site.template.sourceDir) throw new HostingError('template_not_built', `template "${site.template.id}" has no source folder`)
      return {
        databaseUrl: sharedDatabaseUrl(databaseUrl(), databaseOf(site.siteId), password),
        uploadsDir: join(sdir, 'uploads'),
        dir: sdir,
        sourceDir: join(config().root, site.template.sourceDir),
        tinyzooVersion: buildVersionOf(site.template),
      }
    },

    async removeData(site: HostedSite): Promise<void> {
      const sdir = siteDirOf(templateDir(site.template), site.siteId)
      await dropDatabase(databaseOf(site.siteId))
      if (existsSync(sdir) && statSync(sdir).isDirectory()) rmSync(sdir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    },

    async remove(site: HostedSite): Promise<void> {
      const tdir = templateDir(site.template)
      const sdir = siteDirOf(tdir, site.siteId)
      const directory = directoryOf(site.template, tdir)
      const removed = await directory.present() && await directory.change((rows) => withoutSharedSite(rows, site.siteId))
      if (removed) {
        // Wait until the process no longer serves the site, and give it a moment to close the
        // site's database connections.
        const app = readAppFile(tdir)
        if (app && await isOurs(app.pid, tdir)) await waitUntilTaken(app, site.siteId, null)
        else await sleep(600)
        await sleep(400)
      }
      await dropDatabase(databaseOf(site.siteId))
      if (existsSync(sdir) && statSync(sdir).isDirectory()) rmSync(sdir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    },

    async describe(site: HostedSite) {
      const tdir = templateDir(site.template)
      const app = readAppFile(tdir)
      if (!app || !(await isOurs(app.pid, tdir))) return { running: false }
      const running = await siteAnswers(sharedSiteUrl(site.slug, app.port))
      try {
        // The memory of the template's process: every site of the template shares it. There is no figure per site.
        const { stdout } = await run('ps', ['-o', 'rss=', '-p', String(app.pid)])
        const kb = Number(stdout.trim())
        return { running, memoryBytes: Number.isFinite(kb) ? kb * 1024 : undefined }
      }
      catch {
        return { running }
      }
    },
  }
}
