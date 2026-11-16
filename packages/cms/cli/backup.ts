/**
 * `tinyzoo backup [file]` and `tinyzoo restore <file>`.
 *
 * One archive holds everything a site needs to come back:
 *
 *   tinyzoo-backup-<database>-<time>.tar
 *     manifest.json     what is inside: tinyzoo version, time, the media list
 *     database.dump     `pg_dump --format=custom` of DATABASE_URL
 *     media/<key>       every file `cms_media` points at (the local upload folder or the S3 bucket)
 *
 * A plain tar (the system's `tar`), so it can be listed and unpacked without tinyzoo.
 * It holds password hashes, form messages and every upload: keep it as private as the
 * database (the file is created readable by its owner only, before the first byte).
 *
 * Restore puts the archive into a CLEAN database, all or nothing: `pg_restore -f -` turns
 * the dump into a SQL stream, a filter leaves out the session settings the target server
 * does not know (a dump made by pg_dump 17+ starts with `SET transaction_timeout`, which a
 * 16 server rejects), and `psql` runs it inside ONE transaction that first drops and
 * recreates the `public` and `drizzle` schemas. A restore that fails for any reason
 * rolls back and leaves the database as it was; it is never left empty or half old, half
 * new. Restoring over a database that has tables needs `--force`.
 *
 * Tool versions: `pg_dump` must be the server's major version or newer; `pg_restore` must
 * be at least as new as the pg_dump that made the dump (checked before anything is
 * touched); `psql` can be any current version. Set TINYZOO_PG_DUMP / TINYZOO_PG_RESTORE /
 * TINYZOO_PSQL to use a particular binary or a wrapper script (e.g. one that runs them
 * inside a Docker container).
 *
 * Settings are the ones the running app uses: NUXT_CMS_DATABASE_URL / DATABASE_URL,
 * NUXT_CMS_STORAGE_* (from the environment, `.env` in the app folder, then the
 * `cms:` options of nuxt.config), so run it from the site's folder.
 */
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { Transform } from 'node:stream'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { extractTar } from './tar'

// ── settings ───────────────────────────────────────────────────────────────────

export interface S3Settings { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl?: string; delivery?: string }
export interface StorageSettings {
  driver: 'local' | 's3' | 'r2'
  localDir: string
  /** Where the local folder is served from (`/api/cms/_media/raw`). */
  localPublicBase?: string
  s3: S3Settings
}
export interface BackupSettings { databaseUrl: string; storage: StorageSettings }

/** The database and media settings the app itself would use, read from the site's folder. */
export async function loadSettings(cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<BackupSettings> {
  try { (process as any).loadEnvFile?.(join(cwd, '.env')) }
  catch { /* no .env */ }
  let cms: any = {}
  try {
    const { loadNuxtConfig } = await import('@nuxt/kit')
    cms = ((await loadNuxtConfig({ cwd })) as any)?.cms ?? {}
  }
  catch { /* no nuxt config readable: environment only */ }
  return settingsFrom(cwd, env, cms)
}

/** Environment first, then the module options, then the defaults (same precedence as the server). */
export function settingsFrom(cwd: string, env: NodeJS.ProcessEnv, cms: any): BackupSettings {
  const s = cms?.storage ?? {}
  const driver = (env.NUXT_CMS_STORAGE_DRIVER || s.driver || 'local') as StorageSettings['driver']
  const s3 = s.s3 ?? {}
  return {
    databaseUrl: env.NUXT_CMS_DATABASE_URL || env.DATABASE_URL || cms?.databaseUrl || '',
    storage: {
      driver,
      localDir: resolve(cwd, env.NUXT_CMS_STORAGE_LOCAL_DIR || s.local?.dir || '.cms-uploads'),
      localPublicBase: env.NUXT_CMS_STORAGE_LOCAL_PUBLIC_BASE || s.local?.publicBase || '/api/cms/_media/raw',
      s3: {
        endpoint: env.NUXT_CMS_STORAGE_S3_ENDPOINT || s3.endpoint || '',
        region: env.NUXT_CMS_STORAGE_S3_REGION || s3.region || (driver === 'r2' ? 'auto' : 'us-east-1'),
        bucket: env.NUXT_CMS_STORAGE_S3_BUCKET || s3.bucket || '',
        accessKeyId: env.NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID || s3.accessKeyId || '',
        secretAccessKey: env.NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY || s3.secretAccessKey || '',
        publicBaseUrl: env.NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL || s3.publicBaseUrl || '',
        delivery: env.NUXT_CMS_STORAGE_S3_DELIVERY || s3.delivery || '',
      },
    },
  }
}

class CliError extends Error {}
const fail = (message: string): never => { throw new CliError(message) }

// ── Postgres tools ─────────────────────────────────────────────────────────────

/**
 * How a connection string's TLS settings become libpq's — the same protection the app
 * gets from node-postgres (pg-connection-string 2.x, which `new pg.Client` uses):
 *
 *   sslmode=disable                          no TLS
 *   sslmode=prefer|require|verify-ca|verify-full,
 *   ssl=true|1, or any of sslrootcert / sslcert / sslkey
 *                                            TLS, certificate AND host name verified
 *                                            → libpq `verify-full` (libpq's own `require`
 *                                            would accept any certificate)
 *   sslmode=no-verify                        TLS, certificate not checked → `require`
 *   uselibpqcompat=true                      libpq's own meanings, passed through
 *
 * `sslrootcert`, `sslcert` and `sslkey` are passed on as PGSSLROOTCERT / PGSSLCERT /
 * PGSSLKEY, and PGSSL* variables of the shell stay (node-postgres reads PGSSLMODE too).
 * Nothing in the URL means whatever the environment says, as for the app.
 */
export function sslEnv(u: URL): Record<string, string> {
  const q = (k: string) => u.searchParams.get(k)
  const out: Record<string, string> = {}
  const mode = q('sslmode')
  const flag = q('ssl')
  const files = { sslrootcert: 'PGSSLROOTCERT', sslcert: 'PGSSLCERT', sslkey: 'PGSSLKEY' } as const
  for (const [param, name] of Object.entries(files)) if (q(param)) out[name] = q(param)!
  const hasFiles = Object.keys(out).length > 0
  if (q('uselibpqcompat') === 'true') {
    if (mode) out.PGSSLMODE = mode === 'no-verify' ? 'require' : mode
    else if (flag === 'true' || flag === '1' || hasFiles) out.PGSSLMODE = 'verify-full'
    return out
  }
  if (mode === 'disable' || (!mode && flag === '0')) out.PGSSLMODE = 'disable'
  else if (mode === 'no-verify') out.PGSSLMODE = 'require'
  else if (mode || flag === 'true' || flag === '1' || hasFiles) out.PGSSLMODE = 'verify-full'
  return out
}

/** libpq environment for a connection string: the password never appears in the process list. */
export function pgEnv(databaseUrl: string, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  let u: URL
  try { u = new URL(databaseUrl) }
  catch { return fail('DATABASE_URL is not a valid connection string (postgres://user:password@host:5432/database).') }
  const env: NodeJS.ProcessEnv = { ...inherited }
  // A stray PG* variable of the shell must not send the dump to another database
  // (but its TLS settings, PGSSL*, keep protecting the connection).
  for (const k of Object.keys(env)) if (k.startsWith('PG') && !k.startsWith('PGSSL')) delete env[k]
  env.PGHOST = decodeURIComponent(u.hostname) || 'localhost'
  if (u.port) env.PGPORT = u.port
  if (u.username) env.PGUSER = decodeURIComponent(u.username)
  if (u.password) env.PGPASSWORD = decodeURIComponent(u.password)
  env.PGDATABASE = decodeURIComponent(u.pathname.replace(/^\//, ''))
  Object.assign(env, sslEnv(u))
  return env
}

const databaseName = (databaseUrl: string) => decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''))
const targetLabel = (databaseUrl: string) => { const u = new URL(databaseUrl); return `${databaseName(databaseUrl)} on ${u.hostname}${u.port ? ':' + u.port : ''}` }

type PgTool = 'pg_dump' | 'pg_restore' | 'psql'
const TOOL_ENV: Record<PgTool, string> = { pg_dump: 'TINYZOO_PG_DUMP', pg_restore: 'TINYZOO_PG_RESTORE', psql: 'TINYZOO_PSQL' }
const TOOL_VERSION_RULE: Record<PgTool, string> = {
  pg_dump: 'the same major version as the database server, or newer',
  pg_restore: 'at least as new as the pg_dump that made the backup',
  psql: 'any current version',
}

function toolCommand(tool: PgTool): string {
  return process.env[TOOL_ENV[tool]] || tool
}

const missingToolHelp = (tool: PgTool, databaseUrl: string) => `${tool} was not found.
  Install the PostgreSQL client tools (${tool}: ${TOOL_VERSION_RULE[tool]}):
    macOS:   brew install libpq && brew link --force libpq
    Debian:  sudo apt install postgresql-client
  or point ${TOOL_ENV[tool]} at a ${tool} binary or wrapper script.
  No client tools at all? ${tool === 'pg_dump'
    ? `Take the database dump inside the database's own container:
    docker exec <container> pg_dump --format=custom -U <user> ${databaseName(databaseUrl) || '<database>'} > database.dump
  and keep it with a copy of the media`
    : `Restore the dump inside the database's own container (empty the schemas first):
    docker exec -i <container> pg_restore --single-transaction --exit-on-error --no-owner --no-acl -U <user> -d ${databaseName(databaseUrl) || '<database>'} < database.dump
  and copy the media back`} (docs/deploying.md, "Backups and restore").`

const MAX_CAPTURE = 64 * 1024
/** Collect a stream as text, keeping the first part of a very long one. */
const collect = (stream: NodeJS.ReadableStream | null): (() => string) => {
  let text = ''
  stream?.on('data', (d) => { if (text.length < MAX_CAPTURE) text += String(d) })
  return () => text
}

/** How a tool that is missing or cannot start is reported. */
const spawnFailure = (tool: PgTool, err: NodeJS.ErrnoException, databaseUrl: string) =>
  new CliError(err.code === 'ENOENT' ? missingToolHelp(tool, databaseUrl) : `${tool} could not start: ${err.message}`)

/**
 * Run a Postgres tool, with stdin/stdout wired to files (or stdout captured as text).
 * Resolves with what it printed; rejects when it is missing or exits non-zero.
 */
function runTool(tool: PgTool, args: string[], env: NodeJS.ProcessEnv, io: { stdin?: string; stdout?: string; capture?: boolean }, databaseUrl: string): Promise<{ stdout: string; stderr: string }> {
  const cmd = toolCommand(tool)
  const inFd = io.stdin ? openSync(io.stdin, 'r') : null
  const outFd = io.stdout ? openSync(io.stdout, 'w', 0o600) : null
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { env, stdio: [inFd ?? 'ignore', outFd ?? (io.capture ? 'pipe' : 'ignore'), 'pipe'] })
    const stdout = collect(child.stdout)
    const stderr = collect(child.stderr)
    let closed = false // an 'error' (tool missing) is followed by 'close': release the files once
    const close = () => {
      if (closed) return
      closed = true
      if (inFd !== null) closeSync(inFd)
      if (outFd !== null) closeSync(outFd)
    }
    child.on('error', (err: NodeJS.ErrnoException) => {
      close()
      reject(spawnFailure(tool, err, databaseUrl))
    })
    child.on('close', (code) => {
      close()
      if (code === 0) return resolvePromise({ stdout: stdout(), stderr: stderr() })
      const mismatch = /version mismatch|server version/i.test(stderr())
        ? `\n  The ${tool} on this machine is older than the database server: install a newer PostgreSQL client.` : ''
      reject(new CliError(`${tool} failed (exit ${code}):\n${stderr().trim()}${mismatch}`))
    })
  })
}

// ── versions and the dump's preamble ───────────────────────────────────────────

/** `pg_restore (PostgreSQL) 17.9 (Debian 17.9-1)` → 17 (also `18beta1`, `19devel`). */
export function toolMajor(versionOutput: string): number | null {
  const m = /\(PostgreSQL\)\s+(\d+)/.exec(versionOutput)
  return m ? Number(m[1]) : null
}

/** The major version of the pg_dump that made a dump, from `pg_restore --list` (`;     Dumped by pg_dump version: 17.9`). */
export function dumpedByMajor(listing: string): number | null {
  const m = /^;\s*Dumped by pg_dump version:\s*(\d+)/m.exec(listing)
  return m ? Number(m[1]) : null
}

/**
 * Leaves out of the dump's opening lines the `SET name = …;` of a session setting the target
 * server does not have. pg_dump 17 began its script with `SET transaction_timeout = 0;`,
 * which a 16 server answers with "unrecognized configuration parameter": the settings are
 * housekeeping (timeouts off, encoding, search path), so a server that lacks one loses
 * nothing. `known` says whether the server has a setting (from its `pg_settings`).
 *
 * Only the preamble is touched: from the first line that is not blank, a comment, a psql
 * `\restrict`, a `SET` or the `set_config` call, everything is passed on byte for byte, so
 * the table data after it can never be altered, and nothing is buffered beyond one line.
 * Settings with a dot (`app.setting`) are the extension's and always kept.
 */
export function preambleFilter(known: (setting: string) => boolean): Transform & { dropped: string[] } {
  let preamble = true
  let pending: Buffer = Buffer.alloc(0)
  const dropped: string[] = []
  const isPreamble = (line: string) => /^(\s*|--.*|\\restrict\s.*|SET\s.*|SELECT pg_catalog\.set_config\(.*)$/i.test(line)
  const settingOf = (line: string) => /^SET\s+(?:SESSION\s+|LOCAL\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|TO)\s/i.exec(line)?.[1]?.toLowerCase()
  const filter = new Transform({
    transform(chunk: Buffer, _enc, done) {
      if (!preamble) return done(null, chunk)
      pending = Buffer.concat([pending, chunk])
      let nl: number
      while (preamble && (nl = pending.indexOf(0x0a)) >= 0) {
        const line = pending.subarray(0, nl + 1)
        pending = pending.subarray(nl + 1)
        const text = line.toString('latin1').replace(/\r?\n$/, '')
        if (!isPreamble(text)) { preamble = false; this.push(line); break }
        const name = settingOf(text)
        if (name && !known(name)) dropped.push(name)
        else this.push(line)
      }
      if (!preamble) { this.push(pending); pending = Buffer.alloc(0) }
      done()
    },
    flush(done) { if (pending.length) this.push(pending); done() },
  })
  return Object.assign(filter, { dropped })
}

/** What the target server is: its major version and the settings it knows. */
async function serverInfo(databaseUrl: string): Promise<{ major: number; settings: Set<string> }> {
  return withClient(databaseUrl, async (c) => {
    const num = Number((await c.query('show server_version_num')).rows[0]?.server_version_num)
    const settings = new Set((await c.query('select name from pg_settings')).rows.map((r) => String(r.name).toLowerCase()))
    return { major: Math.floor(num / 10000), settings }
  })
}

/**
 * Empty the database of tinyzoo's schemas, then the restore, in ONE transaction: `drizzle`
 * (the migration journal) and `public` go, `public` is created again (pg_dump never writes
 * the CREATE of `public`, so the restore needs it to be there). Extensions that live in
 * `public` (pg_trgm) go with it and come back with the dump, which carries `CREATE
 * EXTENSION`. Dropping everything — and not just what the dump contains — is what makes a
 * restore over a newer database come out exactly as the backup was, instead of leaving the
 * newer tables and journal beside the old ones. The dump's own `SET lock_timeout = 0`
 * follows the drops, so the 15 s limit applies to waiting for the lock only.
 */
const RESET_SCHEMAS_SQL = `BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL client_min_messages = warning;
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO PUBLIC;
`

/**
 * `pg_restore -f -` → preamble filter → `psql`, with the reset and the dump in one
 * transaction. Streamed: a large dump is never held in memory. The transaction is opened
 * and committed by us (not `psql --single-transaction`): psql commits at the end of its
 * input, so a pg_restore that died half way would have a truncated script COMMITTED. Here
 * `COMMIT` is only written once pg_restore has exited 0; any other end of the input, or an
 * error in psql (ON_ERROR_STOP), leaves the transaction to roll back.
 */
function streamRestore(dump: string, databaseUrl: string, known: Set<string>): Promise<{ dropped: string[]; notes: string }> {
  const env = pgEnv(databaseUrl)
  const filter = preambleFilter((name) => known.has(name))
  const inFd = openSync(dump, 'r')
  type Exit = { code: number | null; error?: NodeJS.ErrnoException }
  return new Promise((resolvePromise, reject) => {
    const rst = spawn(toolCommand('pg_restore'), ['-f', '-', '--no-owner', '--no-acl', '--no-comments'], { env, stdio: [inFd, 'pipe', 'pipe'] })
    const sql = spawn(toolCommand('psql'), ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { env, stdio: ['pipe', 'ignore', 'pipe'] })
    closeSync(inFd) // the child has its own copy
    const rstErr = collect(rst.stderr)
    const sqlErr = collect(sql.stderr)
    let rstRunning = true
    let killedRst = false // stopped by us because psql went first: its failure is the one to report
    const exit = (child: typeof rst) => new Promise<Exit>((r) => {
      child.on('error', (error: NodeJS.ErrnoException) => r({ code: null, error }))
      child.on('close', (code) => r({ code }))
    })
    const rstExit = exit(rst).then((x) => { rstRunning = false; return x })
    const sqlExit = exit(sql)
    // psql stopped early (an error): pg_restore must not wait for a reader that is gone.
    void sqlExit.then((x) => { if (x.code !== 0 && rstRunning) { killedRst = true; rst.kill() } })
    void rstExit.then((x) => { if (x.error) sql.kill() })

    sql.stdin!.on('error', () => { /* EPIPE: psql is gone, its exit says why */ })
    sql.stdin!.write(RESET_SCHEMAS_SQL)
    rst.stdout!.pipe(filter).pipe(sql.stdin!, { end: false })
    const inputDone = new Promise<void>((r) => filter.on('end', () => r()))
    void Promise.all([inputDone, rstExit]).then(([, x]) => {
      try { if (x.code === 0 && !x.error) sql.stdin!.end('COMMIT;\n'); else sql.stdin!.end() }
      catch { /* psql already ended */ }
    })

    void Promise.all([rstExit, sqlExit]).then(([r, s]) => {
      if (r.error) return reject(spawnFailure('pg_restore', r.error, databaseUrl))
      if (s.error) return reject(spawnFailure('psql', s.error, databaseUrl))
      if (r.code !== 0 && !killedRst) return reject(new CliError(`pg_restore failed (exit ${r.code}):\n${rstErr().trim()}`))
      if (s.code !== 0) return reject(new CliError(`psql failed (exit ${s.code}):\n${sqlErr().trim()}`))
      resolvePromise({ dropped: filter.dropped, notes: [rstErr(), sqlErr()].map((t) => t.trim()).filter(Boolean).join('\n') })
    })
  })
}

// ── media stores ───────────────────────────────────────────────────────────────

export interface MediaStore {
  read(key: string): Promise<{ body: Buffer; contentType: string } | null>
  write(key: string, body: Buffer, contentType: string): Promise<void>
}

/** A storage key is `2026/11/<uuid>.png`: never a path that leaves the folder. */
export function safeKey(key: string): boolean {
  return !!key && key.length <= 500 && !key.startsWith('/') && !key.includes('\\') && !key.includes('\0')
    && key.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
}

function insideDir(dir: string, key: string): string {
  const abs = resolve(dir, key)
  if (!safeKey(key) || (abs !== dir && !abs.startsWith(dir + sep))) fail(`Refusing the unsafe storage key "${key}".`)
  return abs
}

export function localStore(dir: string): MediaStore {
  return {
    async read(key) {
      const abs = insideDir(dir, key)
      return existsSync(abs) && statSync(abs).isFile() ? { body: readFileSync(abs), contentType: '' } : null
    },
    async write(key, body) {
      const abs = insideDir(dir, key)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, body)
    },
  }
}

export function s3Store(cfg: S3Settings): MediaStore {
  const missing = (['endpoint', 'bucket', 'accessKeyId', 'secretAccessKey'] as const).filter((k) => !cfg[k])
  if (missing.length) fail(`The S3 storage is missing ${missing.join(', ')} (NUXT_CMS_STORAGE_S3_*).`)
  let client: Promise<any> | undefined
  const aws = () => client ??= import('aws4fetch').then(({ AwsClient }) => new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region, service: 's3' }))
  // The same path-style address the app's own S3 driver uses.
  const urlOf = (key: string) => `${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
  return {
    async read(key) {
      if (!safeKey(key)) fail(`Refusing the unsafe storage key "${key}".`)
      const res = await (await aws()).fetch(urlOf(key))
      if (res.status === 404) return null
      if (!res.ok) fail(`S3 download of ${key} failed (${res.status} ${res.statusText}).`)
      return { body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || '' }
    },
    async write(key, body, contentType) {
      if (!safeKey(key)) fail(`Refusing the unsafe storage key "${key}".`)
      const res = await (await aws()).fetch(urlOf(key), { method: 'PUT', body: new Uint8Array(body), headers: { 'content-type': contentType || 'application/octet-stream' } })
      if (!res.ok) fail(`S3 upload of ${key} failed (${res.status} ${res.statusText}).`)
    },
  }
}

export function mediaStore(storage: StorageSettings): MediaStore {
  if (storage.driver === 'local') return localStore(storage.localDir)
  if (storage.driver === 's3' || storage.driver === 'r2') return s3Store(storage.s3)
  return fail(`Storage driver "${storage.driver}" is not supported (local, s3, r2).`)
}

/** Run `fn` over `items` with a few at a time. */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]!)
  }))
}

// ── the archive ────────────────────────────────────────────────────────────────

export interface BackupManifest {
  format: 'tinyzoo-backup'
  version: 1
  tinyzooVersion: string
  createdAt: string
  database: string
  storageDriver: string
  media: { key: string; mime: string; size: number }[]
  /** Referenced by the database but not found in storage when the backup was taken. */
  missingMedia: string[]
}

const packageVersion = (): string => {
  try { return JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')).version }
  catch { return 'unknown' }
}

function tar(args: string[]): string {
  const res = spawnSync('tar', args, { encoding: 'utf8' })
  if (res.error) return fail('tar was not found: backups are tar archives, install tar (it ships with macOS, Linux and Windows 10+).')
  if (res.status !== 0) return fail(`tar failed: ${res.stderr.trim()}`)
  return res.stdout
}

async function withClient<T>(databaseUrl: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: databaseUrl })
  try { await client.connect() }
  catch (err) { return fail(`Cannot connect to the database (${targetLabel(databaseUrl)}): ${(err as Error).message}`) }
  try { return await fn(client) }
  finally { await client.end().catch(() => {}) }
}

export interface RunIo { log: (line: string) => void }

/** Make the archive. Returns the manifest. */
export async function runBackup(settings: BackupSettings, outFile: string, io: RunIo = { log: console.log }): Promise<BackupManifest> {
  if (!settings.databaseUrl) fail('No database: set DATABASE_URL (or NUXT_CMS_DATABASE_URL), here or in .env.')
  if (existsSync(outFile)) fail(`${outFile} already exists; choose another name.`)
  const env = pgEnv(settings.databaseUrl)
  const store = mediaStore(settings.storage)
  const staging = mkdtempSync(join(tmpdir(), 'tinyzoo-backup-'))
  // Created readable by its owner only BEFORE anything is written to it (tar keeps the
  // mode of a file it overwrites); `wx` also refuses to follow a link someone left there.
  mkdirSync(dirname(resolve(outFile)), { recursive: true })
  try { closeSync(openSync(outFile, 'wx', 0o600)) }
  catch (err) { rmSync(staging, { recursive: true, force: true }); return fail((err as NodeJS.ErrnoException).code === 'EEXIST' ? `${outFile} already exists; choose another name.` : `Cannot create ${outFile}: ${(err as Error).message}`) }
  try {
    io.log(`Database ${targetLabel(settings.databaseUrl)}: dumping…`)
    await runTool('pg_dump', ['--format=custom'], env, { stdout: join(staging, 'database.dump') }, settings.databaseUrl)

    const rows = await withClient(settings.databaseUrl, async (c) => {
      const exists = (await c.query(`select to_regclass('public.cms_media') as t`)).rows[0]?.t
      return exists ? (await c.query('select key, mime, size from cms_media order by created_at')).rows as { key: string; mime: string; size: number }[] : []
    })
    const manifest: BackupManifest = {
      format: 'tinyzoo-backup', version: 1, tinyzooVersion: packageVersion(), createdAt: new Date().toISOString(),
      database: databaseName(settings.databaseUrl), storageDriver: settings.storage.driver, media: [], missingMedia: [],
    }
    io.log(`Media (${settings.storage.driver}): ${rows.length} file(s)…`)
    await pool(rows, 4, async (row) => {
      if (!safeKey(row.key)) { manifest.missingMedia.push(row.key); return }
      const obj = await store.read(row.key)
      if (!obj) { manifest.missingMedia.push(row.key); return }
      const dest = insideDir(join(staging, 'media'), row.key)
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, obj.body)
      manifest.media.push({ key: row.key, mime: row.mime, size: obj.body.length })
    })
    manifest.media.sort((a, b) => a.key.localeCompare(b.key))
    manifest.missingMedia.sort()
    writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

    tar(['-cf', resolve(outFile), '-C', staging, 'manifest.json', 'database.dump', ...(manifest.media.length ? ['media'] : [])])
    chmodSync(outFile, 0o600)
    const mb = (statSync(outFile).size / 1024 / 1024).toFixed(1)
    io.log(`✓ ${outFile} (${mb} MB): database and ${manifest.media.length} media file(s).`)
    if (manifest.missingMedia.length) io.log(`! ${manifest.missingMedia.length} file(s) the database refers to are missing from storage: ${manifest.missingMedia.slice(0, 5).join(', ')}${manifest.missingMedia.length > 5 ? ', …' : ''}`)
    return manifest
  }
  catch (err) {
    rmSync(outFile, { force: true }) // never leave a half-written archive that looks like a backup
    throw err
  }
  finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

export interface RestoreOptions {
  /** Skip the question (scripts). */
  yes?: boolean
  /** Restore over a database that already has tables (everything in it is replaced). */
  force?: boolean
  /** Ask a yes/no question; the default reads the terminal. */
  confirm?: (question: string, expected: string) => Promise<boolean>
}

async function askInTerminal(question: string, expected: string): Promise<boolean> {
  if (!process.stdin.isTTY) return fail('This asks for confirmation and there is no terminal: add --yes to go ahead without asking.')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try { return (await rl.question(`${question}\nType ${expected} to continue: `)).trim() === expected }
  finally { rl.close() }
}

/** What the target database already holds: tables, applied migrations, accounts. */
export interface TargetState { tables: number; migrations: number; accounts: number }

export async function inspectTarget(databaseUrl: string): Promise<TargetState> {
  return withClient(databaseUrl, async (c) => {
    const one = async (text: string) => Number((await c.query(text)).rows[0]?.n ?? 0)
    // Any table, view or materialized view in `public` (the extension's own functions do not count).
    const tables = await one(`select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')`)
    const migrations = (await c.query(`select to_regclass('drizzle.__drizzle_migrations') as t`)).rows[0]?.t
      ? await one('select count(*)::int as n from drizzle.__drizzle_migrations') : 0
    const accounts = (await c.query(`select to_regclass('public.cms_users') as t`)).rows[0]?.t
      ? await one('select count(*)::int as n from public.cms_users') : 0
    return { tables, migrations, accounts }
  })
}

/**
 * Everything about the tools that can be known without touching the database: psql is
 * there, pg_restore is there and can read the dump, and is not older than the pg_dump that
 * made it. Returns the major version of that pg_dump (null if the dump does not say).
 */
async function checkRestoreTools(dump: string, databaseUrl: string): Promise<number | null> {
  const env = pgEnv(databaseUrl)
  await runTool('psql', ['--version'], env, { capture: true }, databaseUrl)
  const restoreMajor = toolMajor((await runTool('pg_restore', ['--version'], env, { capture: true }, databaseUrl)).stdout)
  let listing: string
  try { listing = (await runTool('pg_restore', ['--list'], env, { stdin: dump, capture: true }, databaseUrl)).stdout }
  catch (err) {
    if (!(err instanceof CliError) || /was not found|could not start/.test(err.message)) throw err
    // An older pg_restore does not understand a newer archive format at all.
    const newer = /unsupported version \(([\d.]+)\) in file header/.exec(err.message)
    if (newer) return fail(`database.dump in the archive was made by a newer pg_dump (archive format ${newer[1]}) than this pg_restore${restoreMajor ? ` (${restoreMajor})` : ''}, which cannot read it; nothing was changed.\n  Use a pg_restore of the same version as the pg_dump that made the backup, or newer: ${newerToolsHelp}`)
    return fail(`database.dump in the archive is not a readable pg_dump archive; nothing was changed.\n${err.message}`)
  }
  const dumpMajor = dumpedByMajor(listing)
  if (dumpMajor && restoreMajor && dumpMajor > restoreMajor) {
    fail(`database.dump in the archive was made by pg_dump ${dumpMajor}, newer than this pg_restore (${restoreMajor}), which cannot restore it; nothing was changed.\n  Use a pg_restore of version ${dumpMajor} or newer: ${newerToolsHelp}`)
  }
  return dumpMajor
}

const newerToolsHelp = `install newer PostgreSQL client tools, or point ${TOOL_ENV.pg_restore} (and ${TOOL_ENV.psql}) at them.`

/** A failed restore: what went wrong, and that the database is exactly as it was. */
function restoreFailure(err: Error, dumpMajor: number | null, serverMajor: number, target: string): CliError {
  const hints: string[] = []
  if (/lock timeout/i.test(err.message)) hints.push('Something is still using the database: stop the site first.')
  if (/invalid command \\(un)?restrict/i.test(err.message)) hints.push(`This psql is older than the pg_restore that wrote the script (it does not know \\restrict, added in the August 2025 security releases): use the psql that comes with the pg_restore, or set ${TOOL_ENV.psql}.`)
  if (dumpMajor && dumpMajor > serverMajor && err.message.startsWith('psql failed')) hints.push(`The dump was made by pg_dump ${dumpMajor} but the server is PostgreSQL ${serverMajor}; if the cause above is syntax this server lacks, take the backup with a pg_dump of version ${serverMajor}.`)
  return new CliError(`${err.message}${hints.map((h) => `\n  ${h}`).join('')}\n  Nothing was changed: the old schemas are dropped and the backup loaded in ONE transaction, which was rolled back, so ${target} is exactly as it was. Fix the cause above and run the restore again; the archive is unchanged.`)
}

/** Put an archive back: the database (replaced as a whole), then the media. */
export async function runRestore(settings: BackupSettings, file: string, opts: RestoreOptions = {}, io: RunIo = { log: console.log }): Promise<BackupManifest> {
  if (!settings.databaseUrl) fail('No database: set DATABASE_URL (or NUXT_CMS_DATABASE_URL), here or in .env.')
  if (!existsSync(file)) fail(`${file} does not exist.`)
  const staging = mkdtempSync(join(tmpdir(), 'tinyzoo-restore-'))
  try {
    // tinyzoo's own reader: plain files only. A link in the archive is refused (a link
    // to ~/.ssh/id_rsa would otherwise be copied into the public media folder), sizes
    // are checked against a cap before anything is written.
    try { await extractTar(resolve(file), staging, { strict: true }) }
    catch (err) { return fail(`${file} cannot be read as a tinyzoo backup: ${(err as Error).message}`) }
    if (!existsSync(join(staging, 'manifest.json')) || !existsSync(join(staging, 'database.dump'))) fail(`${file} is not a tinyzoo backup (no manifest.json and database.dump).`)
    let manifest: BackupManifest
    try { manifest = JSON.parse(readFileSync(join(staging, 'manifest.json'), 'utf8')) }
    catch { return fail('manifest.json in the archive is unreadable.') }
    if (manifest.format !== 'tinyzoo-backup' || manifest.version !== 1) fail('This archive was made by a different tinyzoo backup format.')
    // Everything the archive claims to hold is checked before anything is changed.
    const mediaDir = join(staging, 'media')
    for (const m of manifest.media ?? []) {
      if (!safeKey(m.key)) fail(`The archive lists the unsafe storage key "${m.key}"; nothing was changed.`)
      const abs = insideDir(mediaDir, m.key)
      if (!existsSync(abs)) fail(`The archive lists ${m.key} but does not contain it; nothing was changed.`)
      if (!lstatSync(abs).isFile()) fail(`${m.key} in the archive is not a plain file; nothing was changed.`)
    }
    // The tools and the dump are checked before the database is touched: a restore that
    // cannot work must be found out now, not after the old data is gone.
    const dumpMajor = await checkRestoreTools(join(staging, 'database.dump'), settings.databaseUrl)

    const server = await serverInfo(settings.databaseUrl)
    const state = await inspectTarget(settings.databaseUrl)
    if ((state.tables > 0 || state.migrations > 0) && !opts.force) {
      const parts = [`${state.tables} table(s)`, state.migrations ? `${state.migrations} applied migration(s)` : '', state.accounts ? `${state.accounts} account(s)` : ''].filter(Boolean)
      fail(`${targetLabel(settings.databaseUrl)} is not empty (${parts.join(', ')}). A restore REPLACES everything in it: restore into an empty database, or add --force if that is what you want.`)
    }
    io.log(`Backup of ${manifest.database} from ${manifest.createdAt} (tinyzoo ${manifest.tinyzooVersion}): database and ${manifest.media.length} media file(s).`)
    if (!opts.yes) {
      const ok = await (opts.confirm ?? askInTerminal)(`This REPLACES the data in ${targetLabel(settings.databaseUrl)}: its public and drizzle schemas are dropped and recreated from the backup (and the media are written into ${settings.storage.driver === 'local' ? settings.storage.localDir : 'the bucket ' + settings.storage.s3.bucket}).`, databaseName(settings.databaseUrl))
      if (!ok) fail('Not confirmed; nothing was changed.')
    }

    // Open the media first (a bad bucket config must not come after the database is replaced).
    const store = mediaStore(settings.storage)
    if (dumpMajor && dumpMajor > server.major) io.log(`The dump was made by pg_dump ${dumpMajor}, the server is PostgreSQL ${server.major}: settings the server does not know are left out of it.`)
    io.log('Restoring the database…')
    try {
      const { dropped, notes } = await streamRestore(join(staging, 'database.dump'), settings.databaseUrl, server.settings)
      if (dropped.length) io.log(`Left out for this server: ${[...new Set(dropped)].map((n) => `SET ${n}`).join(', ')}.`)
      if (notes) io.log(notes)
    }
    catch (err) {
      throw restoreFailure(err as Error, dumpMajor, server.major, targetLabel(settings.databaseUrl))
    }

    io.log(`Restoring ${manifest.media.length} media file(s)…`)
    await pool(manifest.media, 4, async (m) => {
      await store.write(m.key, readFileSync(insideDir(mediaDir, m.key)), m.mime)
    })
    io.log(`✓ restored. Start the site; it applies any newer migrations itself, or run \`tinyzoo up\`.`)
    return manifest
  }
  finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

// ── command line ───────────────────────────────────────────────────────────────

const stamp = () => new Date().toISOString().replace(/\.\d+Z$/, '').replace(/[-:]/g, '').replace('T', '-')

function flags(args: string[]): { positional: string[]; yes: boolean; force: boolean } {
  return { positional: args.filter((a) => !a.startsWith('-')), yes: args.includes('--yes') || args.includes('-y'), force: args.includes('--force') }
}

function report(err: unknown): never {
  console.error(err instanceof CliError ? `✗ ${err.message}` : `✗ ${(err as Error)?.stack ?? err}`)
  process.exit(1)
}

export async function backup(args: string[]): Promise<void> {
  try {
    const settings = await loadSettings(process.cwd())
    const { positional } = flags(args)
    const out = positional[0] ?? `tinyzoo-backup-${settings.databaseUrl ? databaseName(settings.databaseUrl) : 'site'}-${stamp()}.tar`
    await runBackup(settings, resolve(process.cwd(), out))
  }
  catch (err) { report(err) }
}

export async function restore(args: string[]): Promise<void> {
  try {
    const { positional, yes, force } = flags(args)
    if (!positional[0]) fail('usage: tinyzoo restore <file> [--yes] [--force]')
    const settings = await loadSettings(process.cwd())
    await runRestore(settings, resolve(process.cwd(), positional[0]!), { yes, force })
  }
  catch (err) { report(err) }
}
