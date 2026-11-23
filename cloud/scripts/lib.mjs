// Shared by scripts/e2e.mjs and scripts/walkthrough.mjs: starting a cloud app of their own
// (own database, own folder of sites, own ports, so nothing of the developer's is touched),
// and finding and stopping the site processes those runs made. (What the walkthrough is
// filmed with is in film.mjs.)
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import pg from 'pg'

const run = promisify(execFile)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const cloudDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const repoRoot = resolve(cloudDir, '..')
// A hosted template (templates/<id>, package tinyzoo-template-<id>): what its demo content is
// called in its pictures, where it writes the site's name (`wordmark`: what the wizard's typed
// name replaces) and what else of the name to leave out of that picture (`hide`: a monogram).
const hosted = (id, demoName, { wordmark = 'header [data-wordmark]', hide = null } = {}) =>
  ({ id, pkg: `tinyzoo-template-${id}`, dir: `templates/${id}`, demoName, wordmark, hide })

/**
 * The ready templates of shared/templates.ts, in its order: what `templates:build` builds,
 * what `pictures --real` photographs and what `e2e` makes sites from. A template's looks are
 * read from its own looks.ts (`looksOf`).
 */
export const BUILT_TEMPLATES = [
  { id: 'basic', pkg: 'tinyzoo-starter', dir: 'packages/cms/starter', demoName: 'Pekárna Na Růžku', wordmark: 'header .site-header > a > span', hide: null },
  hosted('photographer', 'Johana Loudová'),
  // The names open the page, large: the wizard writes the typed ones there; the header's monogram is left out.
  hosted('wedding', 'Anežka a Šimon', { wordmark: 'main [data-wordmark]', hide: 'header [data-monogram]' }),
]
/** The built server of each ready template (scripts/build-templates.mjs makes them). */
export const templateEntries = Object.fromEntries(BUILT_TEMPLATES.map((t) => [t.id, join(repoRoot, t.dir, '.output/server/index.mjs')]))
export const templateEntry = templateEntries.basic

/** A template's looks as its own looks.ts lists them (`{ ids, all }`); null for a template with one unnamed design. */
export async function looksOf(template) {
  const file = join(repoRoot, template.dir, 'looks.ts')
  return existsSync(file) ? (await import(file)).looks : null
}

export const PG_URL = process.env.CLOUD_PG_URL || 'postgres://cms:cms@localhost:5434/postgres'

// A second checkout of the repository on the same machine (a git worktree) runs these scripts
// beside the first: `CLOUD_RUN_TAG=tpl` gives its runs databases of their own (tz_cloud_e2e_tpl,
// tzc_e2etpl_…), `CLOUD_PORT_SHIFT=200` ports of their own.
const runTag = (process.env.CLOUD_RUN_TAG || '').toLowerCase().replace(/[^a-z0-9]/g, '')
/** "tz_cloud_e2e" → "tz_cloud_e2e_tpl" with CLOUD_RUN_TAG=tpl. */
export const runDb = (name) => (runTag ? `${name}_${runTag}` : name)
/** "tzc_e2e_" → "tzc_e2etpl_" with CLOUD_RUN_TAG=tpl (one word after tzc_: the cloud's own rule for a prefix). */
export const runPrefix = (prefix) => (runTag ? `${prefix.replace(/_$/, '')}${runTag}_` : prefix)
/** 4350 → 4550 with CLOUD_PORT_SHIFT=200. */
export const runPort = (port) => port + (Number(process.env.CLOUD_PORT_SHIFT) || 0)

export function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const next = process.argv[i + 1]
  return next && !next.startsWith('--') ? next : true
}

export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

export function portFree(port) {
  return new Promise((done) => {
    const server = net.createServer()
    server.once('error', () => done(false))
    server.listen({ port, host: '127.0.0.1' }, () => server.close(() => done(true)))
  })
}

export async function freePortFrom(start) {
  for (let p = start; p < start + 50; p++) if (await portFree(p)) return p
  throw new Error(`no free port from ${start}`)
}

// ── Postgres ──

export async function withPg(fn, url = PG_URL) {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try { return await fn(client) }
  finally { await client.end() }
}

export const dbUrl = (name) => { const u = new URL(PG_URL); u.pathname = `/${name}`; return u.toString() }

/** Only databases these scripts own: the cloud's (tz_cloud…) and the sites' (tzc_…). */
function own(name) {
  if (!/^(tz_cloud|tzc_)[a-z0-9_]*$/.test(name)) throw new Error(`refusing to touch database ${name}`)
  return `"${name}"`
}
export const dropDatabase = (name) => withPg((c) => c.query(`drop database if exists ${own(name)} with (force)`))
export async function recreateDatabase(name) {
  await dropDatabase(name)
  await withPg((c) => c.query(`create database ${own(name)}`))
}
export const databaseExists = (name) => withPg(async (c) => (await c.query('select 1 from pg_database where datname = $1', [name])).rowCount > 0)
/** Drop every site database whose name starts with `prefix` (e.g. "tzc_e2e_"). */
export async function dropSiteDatabases(prefix) {
  if (!/^tzc_[a-z0-9_]+$/.test(prefix)) throw new Error(`refusing prefix ${prefix}`)
  const rows = await withPg(async (c) => (await c.query('select datname from pg_database where datname like $1', [`${prefix.replace(/_/g, '\\_')}%`])).rows)
  for (const r of rows) await dropDatabase(r.datname)
  return rows.length
}

// ── the site processes of one data folder ──

/** The processes started for sites under `dataDir`: recognised by the `--site-dir=<folder>` argument the local driver gives them. */
export async function siteProcesses(dataDir) {
  const { stdout } = await run('ps', ['-axo', 'pid=,rss=,command='])
  const marker = `--site-dir=${resolve(dataDir)}/`
  return stdout.split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .filter((m) => m[3].includes(marker))
    .map((m) => ({ pid: Number(m[1]), rssBytes: Number(m[2]) * 1024, slug: m[3].split(marker)[1].split(/\s/)[0], command: m[3] }))
}

export async function alive(pid) {
  try { return (await run('ps', ['-o', 'pid=', '-p', String(pid)])).stdout.trim() !== '' }
  catch { return false }
}

/** Stop the site processes of `dataDir` (only those: each pid's command line names a folder under it). */
export async function stopSiteProcesses(dataDir, only = null) {
  const procs = (await siteProcesses(dataDir)).filter((p) => !only || only.includes(p.slug))
  for (const p of procs) { try { process.kill(p.pid, 'SIGTERM') } catch { /* gone */ } }
  for (let i = 0; i < 40; i++) {
    if (!(await Promise.all(procs.map((p) => alive(p.pid)))).some(Boolean)) break
    await sleep(250)
  }
  return procs
}

/** Remove everything a run left behind: its site processes, its site databases, its folder. */
export async function cleanSites(dataDir, dbPrefix) {
  await stopSiteProcesses(dataDir)
  await dropSiteDatabases(dbPrefix)
  if (existsSync(dataDir) && resolve(dataDir).startsWith(join(cloudDir, '.data') + '/')) rmSync(dataDir, { recursive: true, force: true })
}

export const siteFolders = (dataDir) => (existsSync(dataDir) ? readdirSync(dataDir) : [])

// ── a cloud app of the script's own ──

/**
 * Start `nuxt dev` for the cloud in its own process group, with its own settings, and wait
 * until it answers. `stop()` ends that group (the script's own processes, nothing else).
 */
export async function startCloud({ port, env = {}, logFile }) {
  if (!(await portFree(port))) throw new Error(`port ${port} is in use`)
  mkdirSync(dirname(logFile), { recursive: true })
  const out = openSync(logFile, 'a')
  const child = spawn('pnpm', ['exec', 'nuxt', 'dev', '--port', String(port)], {
    cwd: cloudDir, detached: true, stdio: ['ignore', out, out],
    // A second dev server in this folder, beside the developer's: its own build folder, and
    // past Nuxt's one-server-per-folder check.
    env: { ...process.env, NUXT_PUBLIC_URL: `http://localhost:${port}`, CLOUD_BUILD_DIR: '.nuxt-scripts', NUXT_IGNORE_LOCK: '1', ...env },
  })
  const url = `http://localhost:${port}`
  let exited = false
  child.on('exit', () => { exited = true })
  const until = Date.now() + 180_000
  for (;;) {
    if (exited) throw new Error(`the cloud app exited while starting; see ${logFile}`)
    try { if ((await fetch(`${url}/api/account`, { signal: AbortSignal.timeout(3000) })).ok) break } catch { /* not up yet */ }
    if (Date.now() > until) throw new Error(`the cloud app did not answer; see ${logFile}`)
    await sleep(500)
  }
  // The first page render compiles the client bundle: do it once here, so the browser does not wait on it.
  await fetch(url, { signal: AbortSignal.timeout(120_000) }).catch(() => {})
  return {
    url, pid: child.pid,
    async stop() {
      if (exited) return
      try { process.kill(-child.pid, 'SIGTERM') } catch { /* gone */ }
      for (let i = 0; i < 40 && !exited; i++) await sleep(250)
      if (!exited) { try { process.kill(-child.pid, 'SIGKILL') } catch { /* gone */ } }
      for (let i = 0; i < 40 && !(await portFree(port)); i++) await sleep(250)
    },
  }
}

/** Open an address and wait until the app there is interactive (app/plugins/ready.client.ts). */
export async function open(page, url) {
  await page.goto(url)
  await page.waitForSelector('html[data-app-ready]', { timeout: 60_000 })
}

/** Wait until `fn()` is truthy. */
export async function waitFor(fn, { timeout = 30_000, every = 250, what = 'condition' } = {}) {
  const until = Date.now() + timeout
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`)
    await sleep(every)
  }
}
