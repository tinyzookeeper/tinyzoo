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
 * Restore puts the archive into a CLEAN database: the `public` and `drizzle` schemas
 * are dropped and recreated in one transaction, then `pg_restore --single-transaction`
 * fills them (it is all or nothing: a failed restore leaves the database empty, never
 * half old and half new), then the media are written. Restoring over a database that
 * has tables needs `--force`.
 *
 * Needs `pg_dump` / `pg_restore` of the server's major version or newer. Set
 * TINYZOO_PG_DUMP / TINYZOO_PG_RESTORE to use a particular binary or a wrapper script
 * (e.g. one that runs them inside the database's Docker container).
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
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { extractTar } from './tar'

// ── settings ───────────────────────────────────────────────────────────────────

export interface S3Settings { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl?: string }
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

function toolCommand(tool: 'pg_dump' | 'pg_restore'): string {
  return process.env[tool === 'pg_dump' ? 'TINYZOO_PG_DUMP' : 'TINYZOO_PG_RESTORE'] || tool
}

const missingToolHelp = (tool: string, databaseUrl: string) => `${tool} was not found.
  Install the PostgreSQL client tools (the same major version as the server, or newer):
    macOS:   brew install libpq && brew link --force libpq
    Debian:  sudo apt install postgresql-client
  or point ${tool === 'pg_dump' ? 'TINYZOO_PG_DUMP' : 'TINYZOO_PG_RESTORE'} at a ${tool} binary or wrapper script.
  No client tools at all? Take the database dump inside the database's own container:
    docker exec <container> pg_dump --format=custom -U <user> ${databaseName(databaseUrl) || '<database>'} > database.dump
  and keep it with a copy of the media (docs/deploying.md, "Backups and restore").`

/** Run a Postgres tool, with stdin/stdout wired to files. Returns its stderr. */
function runTool(tool: 'pg_dump' | 'pg_restore', args: string[], env: NodeJS.ProcessEnv, io: { stdin?: string; stdout?: string }, databaseUrl: string): Promise<string> {
  const cmd = toolCommand(tool)
  const inFd = io.stdin ? openSync(io.stdin, 'r') : null
  const outFd = io.stdout ? openSync(io.stdout, 'w', 0o600) : null
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { env, stdio: [inFd ?? 'ignore', outFd ?? 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr!.on('data', (d) => { stderr += String(d) })
    let closed = false // an 'error' (tool missing) is followed by 'close': release the files once
    const close = () => {
      if (closed) return
      closed = true
      if (inFd !== null) closeSync(inFd)
      if (outFd !== null) closeSync(outFd)
    }
    child.on('error', (err: NodeJS.ErrnoException) => {
      close()
      reject(new CliError(err.code === 'ENOENT' ? missingToolHelp(tool, databaseUrl) : `${tool} could not start: ${err.message}`))
    })
    child.on('close', (code) => {
      close()
      if (code === 0) return resolvePromise(stderr)
      const mismatch = /version mismatch|server version/i.test(stderr)
        ? `\n  The ${tool} on this machine is older than the database server: install a newer PostgreSQL client.` : ''
      reject(new CliError(`${tool} failed (exit ${code}):\n${stderr.trim()}${mismatch}`))
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
 * Empty the database of tinyzoo's schemas in ONE transaction: `drizzle` (the migration
 * journal) and `public` go, `public` is created again (pg_dump never writes the
 * CREATE of `public`, so the restore needs it to be there). Extensions that live in `public` (pg_trgm) go with it and come back with the
 * dump, which carries `CREATE EXTENSION`. Dropping everything — and not just what the
 * dump contains — is what makes a restore over a newer database come out exactly as the
 * backup was, instead of leaving the newer tables and journal beside the old ones.
 */
async function resetSchemas(databaseUrl: string): Promise<void> {
  await withClient(databaseUrl, async (c) => {
    try {
      await c.query('begin')
      await c.query(`set local lock_timeout = '15s'`)
      await c.query('drop schema if exists drizzle cascade')
      await c.query('drop schema if exists public cascade')
      await c.query('create schema public')
      await c.query('grant usage on schema public to public')
      await c.query('commit')
    }
    catch (err) {
      await c.query('rollback').catch(() => {})
      const e = err as { message?: string; code?: string }
      fail(`Could not empty ${targetLabel(databaseUrl)} before restoring (nothing was changed): ${e.message}${e.code === '55P03' ? '\n  Something is still using the database: stop the site first.' : ''}`)
    }
  })
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
    // The dump must be readable before the database is touched.
    await runTool('pg_restore', ['--list'], pgEnv(settings.databaseUrl), { stdin: join(staging, 'database.dump') }, settings.databaseUrl)
      .catch((err) => { throw err instanceof CliError && !/was not found|could not start/.test(err.message) ? new CliError(`database.dump in the archive is not a readable pg_dump archive; nothing was changed.\n${err.message}`) : err })

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
    io.log('Restoring the database…')
    await resetSchemas(settings.databaseUrl)
    try {
      const warnings = await runTool('pg_restore', ['--single-transaction', '--exit-on-error', '--no-owner', '--no-acl', '--no-comments', '--dbname', databaseName(settings.databaseUrl)], pgEnv(settings.databaseUrl), { stdin: join(staging, 'database.dump') }, settings.databaseUrl)
      if (warnings.trim()) io.log(warnings.trim())
    }
    catch (err) {
      throw new CliError(`${(err as Error).message}\n  The restore is all or nothing, and the database was emptied first: ${targetLabel(settings.databaseUrl)} is now EMPTY (nothing is half restored). Fix the cause above and run the restore again; the archive is unchanged.`)
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
