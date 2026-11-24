import { execFile, spawn } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { siteUrlFor, siteUrlPattern } from '../../shared/address'
import { parsePortRange, pickPort } from '../../shared/ports'
import { assertSlug, DATABASE_PREFIX, databaseNameFor, quoteIdent } from '../../shared/slug'
import { HostingError, type HostedSite, type HostingDriver, type OnStep, type Provisioned, type SiteSpec } from './types'

// The local driver: every website is a process on this machine.
//
//  - The template is built once (`pnpm --filter tinyzoo-cloud templates:build`); one build
//    serves any number of sites, since everything per site comes from the environment.
//  - A site gets a database `tzc_<slug>` on the cloud's own Postgres server, a port from a
//    range, and a folder `<data>/<slug>/` (its uploads, its log, `site.json` with its port and pid).
//  - It runs detached, so it outlives the cloud app: `node <template>/.output/server/index.mjs
//    --site-dir=<folder>`. The extra argument means nothing to the server; it is how the driver
//    recognises a process as this site's before it stops it. A pid alone is never trusted.
//  - Address: http://<slug>.localhost:<port> (browsers resolve *.localhost to this machine, and
//    each site keeps its own cookies); the cloud itself talks to http://127.0.0.1:<port>.
//    NUXT_HOSTING_LOCAL_PUBLIC_URL gives the sites another public address (a pattern such as
//    https://{slug}.pushbase.app, see shared/address.ts): what people see and what the site
//    itself is told changes, where it runs does not. Something in front must then lead those
//    names to the sites' ports.

const run = promisify(execFile)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface LocalConfig { root: string; dataDir: string; portFrom: number; portTo: number; databasePrefix: string; publicUrl: string }
interface SiteFile { port: number; pid: number | null; startedAt: string | null }

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

function config(): LocalConfig {
  const c = ((useRuntimeConfig().hosting as any)?.local ?? {}) as Record<string, unknown>
  const root = c.root ? resolve(String(c.root)) : findRoot(process.cwd())
  const range = parsePortRange(c.portFrom, c.portTo)
  return { root, dataDir: c.dataDir ? resolve(String(c.dataDir)) : join(root, 'cloud', '.data', 'sites'), portFrom: range.from, portTo: range.to, databasePrefix: String(c.databasePrefix || DATABASE_PREFIX), publicUrl: siteUrlPattern(c.publicUrl) }
}

/** The pattern of the sites' public addresses (shared/address.ts). */
export const localPublicUrlPattern = (): string => config().publicUrl

/** The site's folder. The slug is checked again here: it becomes a path. */
function siteDir(slug: string): string {
  const base = config().dataDir
  const dir = join(base, assertSlug(slug))
  if (!dir.startsWith(base + sep)) throw new HostingError('start_failed', `refusing a folder outside ${base}`)
  return dir
}

const siteFile = (dir: string) => join(dir, 'site.json')

function readSiteFile(dir: string): SiteFile | null {
  try {
    const raw = JSON.parse(readFileSync(siteFile(dir), 'utf8'))
    const port = Number(raw?.port)
    if (!Number.isInteger(port)) return null
    return { port, pid: Number.isInteger(raw.pid) ? raw.pid : null, startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : null }
  }
  catch {
    return null
  }
}

function writeSiteFile(dir: string, file: SiteFile): void {
  writeFileSync(siteFile(dir), `${JSON.stringify(file, null, 2)}\n`)
}

/** The ports held by every site that has a folder, running or not. */
function heldPorts(except?: string): number[] {
  const base = config().dataDir
  if (!existsSync(base)) return []
  return readdirSync(base)
    .filter((name) => name !== except)
    .map((name) => readSiteFile(join(base, name))?.port)
    .filter((p): p is number => typeof p === 'number')
}

function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((done) => {
    const server = net.createServer()
    server.once('error', () => done(false))
    server.listen({ port, host, exclusive: true }, () => server.close(() => done(true)))
  })
}

function answers(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    const end = (v: boolean) => { socket.destroy(); done(v) }
    socket.setTimeout(500, () => end(false))
    socket.once('connect', () => end(true))
    socket.once('error', () => end(false))
  })
}

/** Nothing listens on the port, on this machine's own address or on all of them. */
export async function portIsFree(port: number): Promise<boolean> {
  if (await answers(port)) return false
  return (await canListen(port, '127.0.0.1')) && (await canListen(port, '0.0.0.0'))
}

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

const marker = (dir: string) => `--site-dir=${dir}`

/** Whether `pid` is this site's process: its command line names the site's folder. */
async function isOurs(pid: number | null | undefined, dir: string): Promise<boolean> {
  if (!pid || pid <= 1) return false
  const command = await commandOf(pid)
  return !!command && command.split(/\s+/).includes(marker(dir))
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

async function ready(internalUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${internalUrl}/api/health/ready`, { signal: AbortSignal.timeout(3000), redirect: 'manual' })
    return res.status === 200
  }
  catch {
    return false
  }
}

function logTail(dir: string, bytes = 1500): string {
  try {
    const text = readFileSync(join(dir, 'site.log'), 'utf8')
    return text.slice(-bytes).trim()
  }
  catch {
    return ''
  }
}

const urls = (slug: string, port: number) => ({ publicUrl: siteUrlFor(config().publicUrl, slug, port), internalUrl: `http://127.0.0.1:${port}` })

/** The template's server entry, or a clear word that it has not been built. */
function entryOf(spec: SiteSpec): string {
  if (!spec.template.sourceDir) throw new HostingError('template_not_built', `template "${spec.template.id}" has no source folder`)
  const entry = join(config().root, spec.template.sourceDir, '.output', 'server', 'index.mjs')
  if (!existsSync(entry)) {
    throw new HostingError('template_not_built', `${entry} is missing. Build the template first: pnpm --filter tinyzoo-cloud templates:build`)
  }
  return entry
}

const databaseOf = (slug: string) => databaseNameFor(slug, config().databasePrefix)

/** The site's database address: the cloud's own server, another database. */
function databaseUrlFor(slug: string): string {
  const url = new URL(databaseUrl())
  url.pathname = `/${databaseOf(slug)}`
  return url.toString()
}

/**
 * The site's database. `resuming`: this site was started here before, so a database that
 * exists is its own and is kept. A new site never adopts a database that is already there
 * (it would be somebody else's data under the same name).
 */
async function createDatabase(slug: string, resuming: boolean): Promise<void> {
  const name = databaseOf(slug)
  const pool = usePool()
  let exists = false
  try {
    exists = !!(await pool.query('select 1 from pg_database where datname = $1', [name])).rowCount
    if (!exists) await pool.query(`create database ${quoteIdent(name)}`)
  }
  catch (err: any) {
    throw new HostingError('database_failed', String(err?.message ?? err))
  }
  if (exists && !resuming) throw new HostingError('database_failed', `a database named ${name} already exists and is not this site's`)
}

async function dropDatabase(slug: string): Promise<void> {
  await usePool().query(`drop database if exists ${quoteIdent(databaseOf(slug))} with (force)`)
}

// One port is picked at a time, and written down before the next pick: two sites made at the
// same moment never get the same one.
let picking: Promise<unknown> = Promise.resolve()
function pickPortFor(slug: string, dir: string): Promise<number> {
  const next = picking.then(async () => {
    const existing = readSiteFile(dir)
    if (existing) return existing.port
    const c = config()
    const port = await pickPort({ from: c.portFrom, to: c.portTo }, heldPorts(slug), portIsFree)
    if (port == null) throw new HostingError('no_free_port', `every port from ${c.portFrom} to ${c.portTo} is in use`)
    writeSiteFile(dir, { port, pid: null, startedAt: null })
    return port
  })
  picking = next.catch(() => {})
  return next
}

/** Start the site's process, detached, with a clean environment (nothing of the cloud's own leaks into it). */
function start(spec: SiteSpec, dir: string, port: number): number {
  const entry = entryOf(spec)
  const { publicUrl } = urls(spec.slug, port)
  const out = openSync(join(dir, 'site.log'), 'a')
  try {
    const child = spawn(process.execPath, [entry, marker(dir)], {
      cwd: dir,
      detached: true,
      stdio: ['ignore', out, out],
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
        ...spec.env,
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: String(port),
        DATABASE_URL: databaseUrlFor(spec.slug),
        NUXT_CMS_PUBLIC_URL: publicUrl,
        NUXT_CMS_STORAGE_LOCAL_DIR: join(dir, 'uploads'),
      },
    })
    child.unref()
    if (!child.pid) throw new HostingError('start_failed', 'the site process did not start')
    writeSiteFile(dir, { port, pid: child.pid, startedAt: new Date().toISOString() })
    return child.pid
  }
  finally {
    closeSync(out)
  }
}

async function waitUntilReady(dir: string, pid: number, internalUrl: string, timeoutMs = 120_000): Promise<void> {
  const until = Date.now() + timeoutMs
  for (;;) {
    if (await ready(internalUrl)) return
    if (!(await isOurs(pid, dir))) throw new HostingError('start_failed', `the site stopped while starting:\n${logTail(dir)}`)
    if (Date.now() > until) throw new HostingError('start_timeout', `the site did not answer within ${Math.round(timeoutMs / 1000)} s:\n${logTail(dir)}`)
    await sleep(300)
  }
}

/** Bring the site's process up on its port, unless it already answers. */
async function up(spec: SiteSpec, dir: string, port: number): Promise<void> {
  const { internalUrl } = urls(spec.slug, port)
  const known = readSiteFile(dir)
  const ours = await isOurs(known?.pid, dir)
  if (ours && await ready(internalUrl)) return
  if (ours) {
    // Ours and alive but not answering yet: it may still be starting.
    await waitUntilReady(dir, known!.pid!, internalUrl, 60_000)
    return
  }
  if (!(await portIsFree(port))) {
    // Something holds the port. If it is this site's own process (site.json was lost), keep it.
    for (const pid of await listeners(port)) {
      if (await isOurs(pid, dir)) {
        writeSiteFile(dir, { port, pid, startedAt: known?.startedAt ?? null })
        await waitUntilReady(dir, pid, internalUrl, 60_000)
        return
      }
    }
    throw new HostingError('port_taken', `port ${port} is used by another program`)
  }
  const pid = start(spec, dir, port)
  await waitUntilReady(dir, pid, internalUrl)
}

async function alive(pid: number): Promise<boolean> {
  return (await commandOf(pid)) !== null
}

/** Stop this site's process: ask, wait, then insist. Only a process whose command line names the site's folder. */
async function stop(dir: string, port: number | null): Promise<void> {
  const known = readSiteFile(dir)
  const candidates = new Set<number>()
  if (known?.pid) candidates.add(known.pid)
  if (port ?? known?.port) for (const pid of await listeners((port ?? known?.port)!)) candidates.add(pid)
  for (const pid of candidates) {
    if (!(await isOurs(pid, dir))) continue
    try { process.kill(pid, 'SIGTERM') } catch { continue }
    for (let i = 0; i < 40 && await alive(pid); i++) await sleep(250)
    if (await isOurs(pid, dir)) {
      try { process.kill(pid, 'SIGKILL') } catch { /* gone */ }
      for (let i = 0; i < 20 && await alive(pid); i++) await sleep(100)
    }
  }
}

export function localDriver(): HostingDriver {
  return {
    name: 'local',

    async provision(spec: SiteSpec, onStep: OnStep): Promise<Provisioned> {
      entryOf(spec)
      await onStep('database', 'running')
      const dir = siteDir(spec.slug)
      // site.json is written before the database is made: finding it means this site was
      // started here before, and what exists under its name is its own.
      const resuming = readSiteFile(dir) !== null
      mkdirSync(dir, { recursive: true })
      const port = await pickPortFor(spec.slug, dir)
      await createDatabase(spec.slug, resuming)
      await onStep('database', 'done')

      await onStep('start', 'running')
      await up(spec, dir, port)
      await onStep('start', 'done')
      return { ...urls(spec.slug, port), state: { port, dir, database: databaseOf(spec.slug) } }
    },

    async ensureRunning(site: HostedSite): Promise<void> {
      const dir = siteDir(site.slug)
      const port = Number(site.state?.port ?? readSiteFile(dir)?.port)
      if (!Number.isInteger(port)) throw new HostingError('start_failed', `no port is known for ${site.slug}`)
      mkdirSync(dir, { recursive: true })
      if (!readSiteFile(dir)) writeSiteFile(dir, { port, pid: null, startedAt: null })
      await up(site, dir, port)
    },

    async remove(site: HostedSite): Promise<void> {
      const dir = siteDir(site.slug)
      const port = Number.isInteger(Number(site.state?.port)) ? Number(site.state!.port) : null
      await stop(dir, port)
      await dropDatabase(site.slug)
      if (existsSync(dir) && statSync(dir).isDirectory()) rmSync(dir, { recursive: true, force: true })
    },

    async describe(site: HostedSite) {
      const dir = siteDir(site.slug)
      const pid = readSiteFile(dir)?.pid
      if (!(await isOurs(pid, dir))) return { running: false }
      try {
        const { stdout } = await run('ps', ['-o', 'rss=', '-p', String(pid)])
        const kb = Number(stdout.trim())
        return { running: true, memoryBytes: Number.isFinite(kb) ? kb * 1024 : undefined }
      }
      catch {
        return { running: true }
      }
    },
  }
}
