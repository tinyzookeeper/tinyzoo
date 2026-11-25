// Sites for a built website server, made by hand: each a database of its own, filled with its
// template's demo content (the template's seed) and set to one look. One server process serves
// them all in multi-tenant mode, from a site directory file, as the cloud's shared hosting does.
// Used by scripts/dev.mjs (one site for the development server), scripts/shots.mjs (pictures of
// every look) and scripts/measure.mjs (what a visitor downloads, the memory of a process).
//
// A site is `{ template, look }`; its address is http://<template>-<look>.localhost:<port>
// (browsers and Node resolve *.localhost to this machine; the host name chooses the site).
// Databases are named `<prefix><template>_<look>` (each `-` as `_`) on the Postgres server given;
// only names with that prefix are ever dropped.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

export const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const repoRoot = resolve(appDir, '..', '..')
const require = createRequire(join(appDir, 'package.json'))
const pg = require('pg')

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

/** `--name value` from the command line; `true` for a flag without a value. */
export function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const next = process.argv[i + 1]
  return next && !next.startsWith('--') ? next : true
}

export const SERVICE = { email: 'service@tinyzoo.test', password: 'service-password-of-the-sites-1', name: 'tinyzoo' }
const APP_SECRET = 'one-app-sites-secret-at-least-32-characters-long'

export function portFree(port) {
  return new Promise((done) => {
    const server = net.createServer()
    server.once('error', () => done(false))
    server.listen({ port, host: '127.0.0.1' }, () => server.close(() => done(true)))
  })
}

export async function freePortFrom(start) {
  for (let p = start; p < start + 100; p++) if (await portFree(p)) return p
  throw new Error(`no free port from ${start}`)
}

/** A template's looks, read from its looks.ts (Node strips the types). */
export async function looksOf(templatesDir, template) {
  return (await import(join(templatesDir, template, 'looks.ts'))).looks
}

/** The template's entry pages (app/utils/site.ts `ENTRY_PAGES`): `[{ prefix, entity }]`. */
export function entryPagesOf(templatesDir, template) {
  const text = readFileSync(join(templatesDir, template, 'app/utils/site.ts'), 'utf8')
  const block = /export const ENTRY_PAGES[^=]*=\s*\[([\s\S]*?)\n\]/.exec(text)?.[1] ?? ''
  return [...block.matchAll(/\{[^}]*prefix:\s*'([^']+)'[^}]*entity:\s*'([^']+)'[^}]*\}/g)].map((m) => ({ prefix: m[1], entity: m[2] }))
}

const ident = (name) => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error(`odd database name: ${name}`)
  return `"${name}"`
}

async function withPg(pgUrl, fn) {
  const client = new pg.Client({ connectionString: pgUrl })
  await client.connect()
  try { return await fn(client) }
  finally { await client.end() }
}

/**
 * The sites' rows for the directory, and a database for each (made anew unless `keep`).
 * `model`: write the template as the row's content model (the one app); without it the row
 * has no model (a template's own build, whose model is its `default`).
 */
export async function makeSites({ pgUrl, prefix, dataDir, port, sites, model = false, keep = false }) {
  if (!/^[a-z][a-z0-9_]*_$/.test(prefix)) throw new Error(`a database prefix is lower-case words ending in _: ${prefix}`)
  const rows = []
  for (const s of sites) {
    const slug = `${s.template}-${s.look}`
    const database = `${prefix}${s.template.replace(/-/g, '_')}_${s.look.replace(/-/g, '_')}`
    const exists = await withPg(pgUrl, async (c) => (await c.query('select 1 from pg_database where datname = $1', [database])).rowCount > 0)
    if (exists && !keep) await withPg(pgUrl, (c) => c.query(`drop database ${ident(database)} with (force)`))
    if (!exists || !keep) await withPg(pgUrl, (c) => c.query(`create database ${ident(database)}`))
    const url = new URL(pgUrl)
    url.pathname = `/${database}`
    const dir = join(dataDir, slug)
    mkdirSync(dir, { recursive: true })
    rows.push({
      id: slug,
      ...(model ? { model: s.template } : {}),
      hosts: [`${slug}.localhost`],
      publicUrl: `http://${slug}.localhost:${port}`,
      databaseUrl: url.toString(),
      secret: `secret-of-${slug}-at-least-32-characters-long`,
      config: {
        auth: { setupToken: `setup-${slug}` },
        status: { token: `status-token-of-${slug}-0123456789` },
        storage: { driver: 'local', local: { dir: join(dir, 'uploads') } },
        mail: { file: { dir: join(dir, 'mail') } },
      },
      // What the scripts need, not the server.
      _site: { ...s, slug, database, url: `http://${slug}.localhost:${port}` },
    })
  }
  return rows
}

/** Drop the sites' databases (only those this prefix names). */
export async function dropSites({ pgUrl, rows }) {
  for (const r of rows) await withPg(pgUrl, (c) => c.query(`drop database if exists ${ident(r._site.database)} with (force)`))
}

export function writeDirectory(file, rows) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify({ sites: rows.map(({ _site, ...row }) => row) }, null, 2))
  renameSync(tmp, file)
}

/**
 * Start a built server (`.output/server/index.mjs`) in multi-tenant mode for the sites of a
 * directory file. Its own process group; `stop()` ends it and only it.
 */
export async function startServer({ entry, directoryFile, port, logFile, env = {} }) {
  if (!(await portFree(port))) throw new Error(`port ${port} is in use`)
  mkdirSync(dirname(logFile), { recursive: true })
  const out = openSync(logFile, 'a')
  const startedAt = performance.now()
  const child = spawn(process.execPath, [resolve(entry)], {
    cwd: dirname(logFile), detached: true, stdio: ['ignore', out, out],
    env: {
      PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '',
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      NUXT_CMS_TENANCY_MODE: 'multi', NUXT_CMS_TENANCY_FILE: directoryFile, NUXT_CMS_TENANCY_IDLE_MINUTES: '0',
      NUXT_APP_SECRET: APP_SECRET, NUXT_CMS_MIGRATIONS_ON_START: 'true', NUXT_CMS_MAIL_TRANSPORT: 'file',
      NUXT_CMS_STORAGE_UPLOAD_RATE_PER_MIN: '1000',
      ...env,
    },
  })
  let exited = false
  child.on('exit', () => { exited = true })
  const until = Date.now() + 120_000
  for (;;) {
    if (exited) throw new Error(`the server exited while starting; see ${logFile}`)
    try { if ((await fetch(`http://127.0.0.1:${port}/api/health/live`, { signal: AbortSignal.timeout(2000) })).ok) break } catch { /* not up yet */ }
    if (Date.now() > until) throw new Error(`the server did not answer; see ${logFile}`)
    await sleep(100)
  }
  return {
    pid: child.pid, port, readyMs: performance.now() - startedAt,
    async stop() {
      if (exited) return
      try { process.kill(-child.pid, 'SIGTERM') } catch { /* gone */ }
      for (let i = 0; i < 60 && !exited; i++) await sleep(250)
      if (!exited) { try { process.kill(-child.pid, 'SIGKILL') } catch { /* gone */ } }
    },
  }
}

/** What a template's seed reads from its environment, for one site. Shared by seedSite and seedSiteAsync. */
function seedEnv(row) {
  const s = row._site
  return {
    PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '',
    SEED_URL: s.url, SEED_EMAIL: SERVICE.email, SEED_PASSWORD: SERVICE.password, SEED_NAME: SERVICE.name,
    SEED_SETUP_CODE: row.config.auth.setupToken, SEED_LOOK: s.look,
  }
}

/** Run the template's seed (`pnpm seed` in its folder) against a site: its first account and the demo content worded for its look. */
export function seedSite(row, templatesDir) {
  const s = row._site
  const res = spawnSync('pnpm', ['seed'], {
    cwd: join(templatesDir, s.template), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: seedEnv(row),
  })
  if (res.status !== 0) throw new Error(`the seed of ${s.slug} failed:\n${(res.stdout + res.stderr).slice(-3000)}`)
}

/** The same seed without blocking, so several sites can be seeded at once. */
export function seedSiteAsync(row, templatesDir) {
  const s = row._site
  return new Promise((done, fail) => {
    const child = spawn('pnpm', ['seed'], { cwd: join(templatesDir, s.template), env: seedEnv(row), stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const keep = (d) => { output = (output + d).slice(-6000) }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    child.on('error', fail)
    child.on('close', (code) => (code === 0 ? done() : fail(new Error(`the seed of ${s.slug} failed:\n${output.slice(-3000)}`))))
  })
}

/** An admin session on a site (the service account the seed made). */
export async function signIn(base) {
  const res = await fetch(`${base}/api/cms/_auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: base },
    body: JSON.stringify({ email: SERVICE.email, password: SERVICE.password }),
  })
  if (!res.ok) throw new Error(`sign-in on ${base}: ${res.status} ${await res.text()}`)
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
}

const META = new Set(['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'])
/** A singleton's row as its PUT takes it back (the cloud's own rule, cloud/server/utils/provision.ts). */
function writableRow(row) {
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    if (META.has(key) || key.endsWith('__media')) continue
    if (key.endsWith('Id') && key.slice(0, -2) in row) continue
    out[key] = value
  }
  return out
}

/** Set the site's look and colours (Site settings), as the cloud does when it hands a site over. `own`, when given, also sets the own colour (`#rrggbb`, or null to clear it). */
export async function chooseLook(base, cookie, look, colors, own) {
  const headers = { 'content-type': 'application/json', accept: 'application/json', origin: base, cookie }
  const got = await (await fetch(`${base}/api/cms/_singleton/siteSettings`, { headers })).json()
  const res = await fetch(`${base}/api/cms/_singleton/siteSettings`, {
    method: 'PUT', headers, body: JSON.stringify({ ...(got.row ? writableRow(got.row) : {}), look, colors, ...(own === undefined ? {} : { ownColor: own }) }),
  })
  if (!res.ok) throw new Error(`settings on ${base}: ${res.status} ${await res.text()}`)
}

/** The first published entry of a collection (its slug), for an entry page's address. */
export async function firstSlug(base, entity) {
  const res = await fetch(`${base}/api/content/${entity}?limit=1`, { headers: { accept: 'application/json' } })
  const body = await res.json()
  return body.items?.[0]?.slug ?? null
}

/** Every site of the given templates, one per look. */
export async function sitesFor(templatesDir, templates) {
  const out = []
  for (const template of templates) {
    const looks = await looksOf(templatesDir, template)
    for (const look of looks.all) out.push({ template, look: look.id, presets: look.presets.map((p) => p.id) })
  }
  return out
}

/** Remove a folder of this script's own data. */
export function clean(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}
