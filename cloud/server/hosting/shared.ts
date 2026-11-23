import { execFile, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { and, eq, notInArray } from 'drizzle-orm'
import { parsePortRange, pickPort } from '../../shared/ports'
import {
  assertSiteId, assertTemplateId, parseSharedDirectory, passwordOfDatabaseUrl, SHARED_PORT_RANGE, sharedDatabaseNameFor, sharedDatabasePrefix,
  sharedDatabaseUrl, sharedDirectoryText, sharedSiteRow, sharedSiteUrl, splitSiteEnv, sqlLiteral, withoutSharedSite, withSharedSite, type SharedSiteRow,
} from '../../shared/sharedHosting'
import { quoteIdent } from '../../shared/slug'
import type { TemplateDef } from '../../shared/templates'
import type { SiteRow } from '../db/schema'
import { portIsFree } from './local'
import { HostingError, type HostedSite, type HostingDriver, type OnStep, type Provisioned, type SiteSpec } from './types'

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

const run = promisify(execFile)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface SharedConfig { root: string; dataDir: string; portFrom: number; portTo: number; databasePrefix: string }
/** `app.json`: what is known about a template's process. */
interface AppFile { port: number; pid: number | null; startedAt: string | null; secret: string }
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
  }
}

/** The repository's root as the shared driver is told (NUXT_HOSTING_SHARED_ROOT), for the seed of a site it made. */
export const sharedRoot = (): string => config().root

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
const directoryFile = (tdir: string) => join(tdir, 'sites.json')
const siteFile = (sdir: string) => join(sdir, 'site.json')

/** Write a file that only its owner may read, in one move: a temporary file beside it, then a rename. */
function writePrivate(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, text, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, file)
}

function readAppFile(tdir: string): AppFile | null {
  try {
    const raw = JSON.parse(readFileSync(appFile(tdir), 'utf8'))
    const port = Number(raw?.port)
    if (!Number.isInteger(port) || typeof raw.secret !== 'string' || raw.secret.length < 32) return null
    return { port, pid: Number.isInteger(raw.pid) ? raw.pid : null, startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : null, secret: raw.secret }
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

/** The site directory as it is on the disk now (no rows when the file is missing). */
function readDirectory(tdir: string): SharedSiteRow[] {
  try {
    return parseSharedDirectory(readFileSync(directoryFile(tdir), 'utf8'))
  }
  catch {
    return []
  }
}

// One writer of a site directory at a time, and the file is read again inside the turn: two
// sites made at the same moment never lose each other's row. (One chain for all templates:
// a turn is a read and a write.)
let writing: Promise<unknown> = Promise.resolve()
function changeDirectory(tdir: string, change: (rows: SharedSiteRow[]) => { rows: SharedSiteRow[]; changed: boolean }): Promise<boolean> {
  const next = writing.then(() => {
    const missing = !existsSync(directoryFile(tdir))
    const { rows, changed } = change(readDirectory(tdir))
    if (changed || missing) writePrivate(directoryFile(tdir), sharedDirectoryText(rows))
    return changed
  })
  writing = next.catch(() => {})
  return next
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
function start(template: TemplateDef, tdir: string, app: AppFile, settings: Record<string, string>): number {
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
        NUXT_CMS_TENANCY_FILE: directoryFile(tdir),
        NUXT_APP_SECRET: app.secret,
        NUXT_CMS_MIGRATIONS_ON_START: 'true',
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
  const ours = await isOurs(app.pid, tdir)
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
        const kept = { ...app, pid }
        writeAppFile(tdir, kept)
        await waitUntilUp(tdir, pid, app.port, 60_000)
        return kept
      }
    }
    throw new HostingError('port_taken', `port ${app.port} is used by another program`)
  }
  // The process reads the directory when it starts: it must exist, if only empty. (Not written
  // for a process that runs: an empty directory would make it drop every site for a moment.)
  await changeDirectory(tdir, (rows) => ({ rows, changed: false }))
  const pid = start(template, tdir, app, settings)
  await waitUntilUp(tdir, pid, app.port)
  return { ...app, pid }
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

/** The site's row, as the directory holds it. */
function rowOf(site: SiteSpec, tdir: string, port: number, password: string): SharedSiteRow {
  const name = databaseOf(site.siteId)
  return sharedSiteRow({
    siteId: site.siteId, slug: site.slug, port, env: site.env,
    databaseUrl: sharedDatabaseUrl(databaseUrl(), name, password),
    siteDir: siteDirOf(tdir, site.siteId),
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
 * Put a site's row into its template's directory. `lost`: the directory's file was not there
 * (a new template, or the file was lost). Then the other sites of the template are written
 * again too, from what the cloud keeps: with this row alone in the file, the process would
 * stop serving them.
 */
async function putRow(template: TemplateDef, tdir: string, port: number, row: SharedSiteRow, lost: boolean): Promise<void> {
  const others: SharedSiteRow[] = []
  if (lost) {
    for (const other of await sitesOfTemplate(template)) {
      if (other.id === row.id) continue
      const password = decryptSecret(other.driverState!.databasePassword as string)
      // A site whose secrets cannot be read is left out: its own next start says why.
      try { if (password) others.push(rowOf(hostedSite(other), tdir, port, password)) }
      catch { /* left out */ }
    }
  }
  await changeDirectory(tdir, (rows) => {
    let changed = false
    for (const r of [...others, row]) {
      const next = withSharedSite(rows, r)
      rows = next.rows
      changed ||= next.changed
    }
    return { rows, changed }
  })
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

      await onStep('database', 'running')
      // site.json is written before the database is made: finding it means this site was
      // started here before, and what exists under its name is its own.
      const resuming = readSiteFile(sdir) !== null
      mkdirSync(sdir, { recursive: true, mode: 0o700 })
      if (!resuming) writePrivate(siteFile(sdir), `${JSON.stringify({ database: name, role: name, createdAt: new Date().toISOString() } satisfies SiteFile, null, 2)}\n`)
      // The password the directory already holds for this site stays (its row does not change,
      // so a site that runs is not disturbed); otherwise a new one.
      const password = passwordOfDatabaseUrl(readDirectory(tdir).find((r) => r.id === spec.siteId)?.databaseUrl) ?? randomBytes(24).toString('base64url')
      await createDatabase(name, password, resuming)
      await onStep('database', 'done')

      await onStep('start', 'running')
      const lost = !existsSync(directoryFile(tdir))
      const app = await ensureProcess(spec.template, settings, await knownPort(spec.template, tdir))
      const row = rowOf(spec, tdir, app.port, password)
      await putRow(spec.template, tdir, app.port, row, lost)
      await waitUntilSiteAnswers(tdir, app.pid, row.publicUrl, 120_000)
      await onStep('start', 'done')
      return {
        publicUrl: row.publicUrl,
        internalUrl: row.publicUrl,
        state: { template: spec.template.id, port: app.port, dir: sdir, database: name, role: name, databasePassword: encryptSecret(password) },
      }
    },

    async ensureRunning(site: HostedSite): Promise<void> {
      const tdir = templateDir(site.template)
      const lost = !existsSync(directoryFile(tdir))
      const app = await ensureProcess(site.template, splitSiteEnv(site.env).process, await knownPort(site.template, tdir, site.state))
      // The row: as it is in the directory, or written again from what the cloud keeps.
      const existing = readDirectory(tdir).find((r) => r.id === site.siteId)
      const password = decryptSecret(typeof site.state?.databasePassword === 'string' ? site.state.databasePassword : null) ?? passwordOfDatabaseUrl(existing?.databaseUrl)
      if (!password) throw new HostingError('start_failed', `the database password of ${site.slug} is not known`)
      mkdirSync(siteDirOf(tdir, site.siteId), { recursive: true, mode: 0o700 })
      const row = rowOf(site, tdir, app.port, password)
      await putRow(site.template, tdir, app.port, row, lost)
      await waitUntilSiteAnswers(tdir, app.pid, row.publicUrl, 60_000)
    },

    async remove(site: HostedSite): Promise<void> {
      const tdir = templateDir(site.template)
      const sdir = siteDirOf(tdir, site.siteId)
      const removed = existsSync(directoryFile(tdir)) && await changeDirectory(tdir, (rows) => withoutSharedSite(rows, site.siteId))
      if (removed) {
        // The process looks at the directory at most twice a second, when something asks it:
        // wait, ask, and give it a moment to close the site's database connections.
        const app = readAppFile(tdir)
        await sleep(600)
        if (app && await isOurs(app.pid, tdir)) await processAnswers(app.port)
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
