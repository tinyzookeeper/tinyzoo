import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CORE_UPGRADE_STEPS, runUpgrade } from '../../packages/cms/src/index'
import { type BackupSettings, runBackup, runRestore, type StorageSettings } from '../../packages/cms/cli/backup'
import { diskSource, withDatabase } from '../../packages/cms/cli/db'
import { playgroundDir, testDatabaseUrl } from '../setup/database'
import { scratchDatabase } from '../helpers/server'

// `tinyzoo backup` / `tinyzoo restore` against real databases (two scratch ones) and,
// for S3, a small S3-style server in this process. Needs pg_dump and pg_restore (or
// TINYZOO_PG_DUMP / TINYZOO_PG_RESTORE / TINYZOO_PSQL pointing at them); skipped where they
// are missing, except where TINYZOO_REQUIRE_PG_TOOLS=1 (the `backup` jobs of
// .github/workflows/heavy.yml, which install the tools of each version), where a runner
// without them must fail instead of quietly skipping the whole restore story.
const has = (cmd: string) => !spawnSync(cmd, ['--version']).error
const tools = has(process.env.TINYZOO_PG_DUMP || 'pg_dump') && has(process.env.TINYZOO_PG_RESTORE || 'pg_restore') && has(process.env.TINYZOO_PSQL || 'psql')
const skip = !tools && process.env.TINYZOO_REQUIRE_PG_TOOLS !== '1'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const silent = { log: () => {} }

/** A database with nothing in it (not even the migrations): what a restore is meant for. */
async function bareDatabase(suffix: string): Promise<{ url: string; drop: () => Promise<void> }> {
  const base = new URL(testDatabaseUrl())
  const url = new URL(base)
  url.pathname = `/${base.pathname.replace(/^\//, '')}_${suffix}`
  const name = url.pathname.slice(1)
  const admin = new URL(url); admin.pathname = '/postgres'
  const run = async (sql: string) => { const c = new pg.Client({ connectionString: admin.toString() }); await c.connect(); try { await c.query(sql) } finally { await c.end() } }
  await run(`drop database if exists "${name}" with (force)`)
  await run(`create database "${name}"`)
  return { url: url.toString(), drop: () => run(`drop database if exists "${name}" with (force)`) }
}

async function query<T = any>(url: string, text: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: url })
  await c.connect()
  try { return (await c.query(text, params)).rows }
  finally { await c.end() }
}

/** A tiny path-style S3: PUT/GET /<bucket>/<key>, remembers content types and that requests were signed. */
function s3Server() {
  const objects = new Map<string, { body: Buffer; type: string }>()
  const unsigned: string[] = []
  const server: Server = createServer((req, res) => {
    const key = decodeURIComponent((req.url ?? '').split('?')[0]!.replace(/^\/bucket\//, ''))
    if (!String(req.headers.authorization ?? '').startsWith('AWS4-HMAC-SHA256')) unsigned.push(`${req.method} ${req.url}`)
    if (req.method === 'PUT') {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => { objects.set(key, { body: Buffer.concat(chunks), type: String(req.headers['content-type'] ?? '') }); res.end() })
      return
    }
    const obj = objects.get(key)
    if (!obj) { res.statusCode = 404; res.end(); return }
    res.setHeader('content-type', obj.type)
    res.end(obj.body)
  })
  return {
    objects, unsigned,
    start: () => new Promise<string>((r) => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${(server.address() as any).port}`))),
    stop: () => new Promise<void>((r) => server.close(() => r())),
  }
}

describe.skipIf(skip)('backup and restore', () => {
  let src: Awaited<ReturnType<typeof scratchDatabase>>
  let dst: Awaited<ReturnType<typeof bareDatabase>>
  let dir: string
  const local = (name: string): StorageSettings => ({ driver: 'local', localDir: join(dir, name), s3: { endpoint: '', region: '', bucket: '', accessKeyId: '', secretAccessKey: '' } })
  const s3 = (endpoint: string): StorageSettings => ({ driver: 's3', localDir: '', s3: { endpoint, region: 'us-east-1', bucket: 'bucket', accessKeyId: 'AKIATEST', secretAccessKey: 'secret' } })
  const settings = (databaseUrl: string, storage: StorageSettings): BackupSettings => ({ databaseUrl, storage })

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'cms-backup-'))
    src = await scratchDatabase('bkp_src')
    dst = await bareDatabase('bkp_dst')
    await query(src.url, `insert into cms_users (email, name, role, status) values ('boss@example.com', 'Boss', 'admin', 'active')`)
    await query(src.url, `insert into cms_audit (action) values ('test.backup')`)
    await query(src.url, `insert into cms_media (url, key, mime, size) values ('/u/a', '2026/11/a.png', 'image/png', $1), ('/u/b', '2026/11/b.txt', 'text/plain', 5), ('/u/gone', '2026/11/gone.png', 'image/png', 1)`, [png.length])
    mkdirSync(join(dir, 'src-uploads/2026/11'), { recursive: true })
    writeFileSync(join(dir, 'src-uploads/2026/11/a.png'), png)
    writeFileSync(join(dir, 'src-uploads/2026/11/b.txt'), 'hello')
    mkdirSync(join(dir, 'src-uploads/_w/320/2026/11'), { recursive: true }) // a derived copy: not part of a backup
    writeFileSync(join(dir, 'src-uploads/_w/320/2026/11/a.png.webp'), 'derived')
  })
  afterAll(async () => {
    rmSync(dir, { recursive: true, force: true })
    await src?.drop()
    await dst?.drop()
  })

  it('makes one private tar of the database and the media the database refers to', async () => {
    const file = join(dir, 'backup.tar')
    const manifest = await runBackup(settings(src.url, local('src-uploads')), file, silent)
    expect(manifest.media.map((m) => m.key)).toEqual(['2026/11/a.png', '2026/11/b.txt'])
    expect(manifest.missingMedia).toEqual(['2026/11/gone.png'])
    expect(manifest).toMatchObject({ format: 'tinyzoo-backup', version: 1, storageDriver: 'local' })
    expect(statSync(file).mode & 0o777).toBe(0o600)
    const listing = spawnSync('tar', ['-tf', file], { encoding: 'utf8' }).stdout.split('\n').map((l) => l.replace(/^\.\//, ''))
    expect(listing).toEqual(expect.arrayContaining(['manifest.json', 'database.dump', 'media/2026/11/a.png', 'media/2026/11/b.txt']))
    expect(listing.some((l) => l.includes('_w/'))).toBe(false)
    // It never overwrites an earlier backup.
    await expect(runBackup(settings(src.url, local('src-uploads')), file, silent)).rejects.toThrow(/already exists/)
  })

  it('restores the database and the media into an empty database', async () => {
    const file = join(dir, 'restore-me.tar')
    await runBackup(settings(src.url, local('src-uploads')), file, silent)
    await runRestore(settings(dst.url, local('dst-uploads')), file, { yes: true }, silent)
    expect((await query(dst.url, 'select email, role from cms_users')).map((r) => `${r.email}/${r.role}`)).toEqual(['boss@example.com/admin'])
    expect((await query(dst.url, `select count(*)::int as n from cms_audit where action = 'test.backup'`))[0].n).toBe(1)
    expect((await query(dst.url, 'select count(*)::int as n from cms_media'))[0].n).toBe(3)
    expect(readFileSync(join(dir, 'dst-uploads/2026/11/a.png')).equals(png)).toBe(true)
    expect(readFileSync(join(dir, 'dst-uploads/2026/11/b.txt'), 'utf8')).toBe('hello')
    // The trigram indexes and the migration journal came along: the app can start on it.
    expect((await query(dst.url, `select count(*)::int as n from drizzle.__drizzle_migrations`))[0].n).toBeGreaterThan(0)
  })

  it('refuses a database that is not empty, unless forced; and asks first', async () => {
    const file = join(dir, 'again.tar')
    await runBackup(settings(src.url, local('src-uploads')), file, silent)
    await expect(runRestore(settings(dst.url, local('dst-2')), file, { yes: true }, silent)).rejects.toThrow(/is not empty \(\d+ table\(s\), \d+ applied migration\(s\), 1 account\(s\)\).*--force/s)
    expect(existsSync(join(dir, 'dst-2'))).toBe(false)

    // --force still asks, and a "no" changes nothing.
    await query(dst.url, `update cms_users set name = 'Changed after backup'`)
    let asked = ''
    await expect(runRestore(settings(dst.url, local('dst-2')), file, { force: true, confirm: async (q, expected) => { asked = `${q}|${expected}`; return false } }, silent)).rejects.toThrow(/Not confirmed/)
    expect(asked).toContain(new URL(dst.url).pathname.slice(1))
    expect((await query(dst.url, 'select name from cms_users'))[0].name).toBe('Changed after backup')
    expect(existsSync(join(dir, 'dst-2'))).toBe(false)

    // Confirmed: the data is the backup's again.
    await runRestore(settings(dst.url, local('dst-2')), file, { force: true, confirm: async () => true }, silent)
    expect((await query(dst.url, 'select name from cms_users'))[0].name).toBe('Boss')
    expect(existsSync(join(dir, 'dst-2/2026/11/a.png'))).toBe(true)
  })

  it('refuses a file that is not a backup, and an archive with a path that leaves the media folder', async () => {
    const junk = join(dir, 'junk.tar')
    writeFileSync(join(dir, 'x.txt'), 'x')
    spawnSync('tar', ['-cf', junk, '-C', dir, 'x.txt'])
    await expect(runRestore(settings(dst.url, local('nope')), junk, { yes: true, force: true }, silent)).rejects.toThrow(/not a tinyzoo backup/)
    await expect(runRestore(settings(dst.url, local('nope')), join(dir, 'missing.tar'), { yes: true }, silent)).rejects.toThrow(/does not exist/)

    const evil = join(dir, 'evil')
    mkdirSync(evil)
    writeFileSync(join(evil, 'database.dump'), 'not even a dump')
    writeFileSync(join(evil, 'manifest.json'), JSON.stringify({ format: 'tinyzoo-backup', version: 1, tinyzooVersion: 'x', createdAt: '', database: 'x', storageDriver: 'local', media: [{ key: '../../escaped.txt', mime: 'text/plain', size: 1 }], missingMedia: [] }))
    const evilTar = join(dir, 'evil.tar')
    spawnSync('tar', ['-cf', evilTar, '-C', evil, 'manifest.json', 'database.dump'])
    await expect(runRestore(settings(dst.url, local('nope')), evilTar, { yes: true, force: true }, silent)).rejects.toThrow(/unsafe storage key/)
    expect(existsSync(join(dir, 'escaped.txt'))).toBe(false)
  })

  it('backs up from an S3 bucket with signed requests, and restores into one', async () => {
    const bucket = s3Server()
    const endpoint = await bucket.start()
    try {
      bucket.objects.set('2026/11/a.png', { body: png, type: 'image/png' })
      bucket.objects.set('2026/11/b.txt', { body: Buffer.from('from the bucket'), type: 'text/plain' })
      const file = join(dir, 's3.tar')
      const manifest = await runBackup(settings(src.url, s3(endpoint)), file, silent)
      expect(manifest).toMatchObject({ storageDriver: 's3', missingMedia: ['2026/11/gone.png'] })
      expect(manifest.media).toHaveLength(2)

      const target = s3Server()
      const targetUrl = await target.start()
      try {
        const scratch = await bareDatabase('bkp_s3')
        try {
          await runRestore(settings(scratch.url, s3(targetUrl)), file, { yes: true }, silent)
          expect(target.objects.get('2026/11/b.txt')).toMatchObject({ type: 'text/plain' })
          expect(target.objects.get('2026/11/b.txt')!.body.toString()).toBe('from the bucket')
          expect(target.objects.get('2026/11/a.png')!.type).toBe('image/png')
          expect(target.unsigned).toEqual([])
        }
        finally { await scratch.drop() }
      }
      finally { await target.stop() }
      expect(bucket.unsigned).toEqual([])
    }
    finally { await bucket.stop() }
  })

  it('says what to do when pg_dump is missing', async () => {
    const before = process.env.TINYZOO_PG_DUMP
    process.env.TINYZOO_PG_DUMP = '/nonexistent/pg_dump'
    try {
      await expect(runBackup(settings(src.url, local('src-uploads')), join(dir, 'no-tool.tar'), silent)).rejects.toThrow(/pg_dump was not found[\s\S]*docker exec/)
      expect(existsSync(join(dir, 'no-tool.tar'))).toBe(false)
    }
    finally {
      if (before === undefined) delete process.env.TINYZOO_PG_DUMP
      else process.env.TINYZOO_PG_DUMP = before
    }
  })
})

// ── restoring over a database that is not empty ─────────────────────────────────

describe.skipIf(skip)('restore replaces the whole database', () => {
  let dir: string
  const created: { drop: () => Promise<void> }[] = []
  const local = (name: string): StorageSettings => ({ driver: 'local', localDir: join(dir, name), s3: { endpoint: '', region: '', bucket: '', accessKeyId: '', secretAccessKey: '' } })
  const settings = (databaseUrl: string, name: string): BackupSettings => ({ databaseUrl, storage: local(name) })
  const tablesIn = async (url: string) => (await query(url, `select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`))[0].n as number
  const withEnv = async (vars: Record<string, string>, fn: () => Promise<void>) => {
    const before = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]))
    Object.assign(process.env, vars)
    try { await fn() }
    finally { for (const [k, v] of Object.entries(before)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
  }
  /** The playground's migrations as they were before `0018_snake_case_tables` (the table renames). */
  const migrationsBeforeRename = () => {
    const to = join(dir, 'old-migrations')
    cpSync(join(playgroundDir, 'server/db/migrations'), to, { recursive: true })
    const journalFile = join(to, 'meta/_journal.json')
    const journal = JSON.parse(readFileSync(journalFile, 'utf8'))
    const cut = journal.entries.findIndex((e: any) => e.tag === '0018_snake_case_tables')
    if (cut < 0) throw new Error('the playground has no 0018_snake_case_tables migration any more: pick another migration to stop at')
    const after = journal.entries.slice(cut).map((e: any) => e.tag as string)
    journal.entries = journal.entries.slice(0, cut)
    writeFileSync(journalFile, JSON.stringify(journal))
    return { dir: to, applied: cut, after }
  }
  const fresh = async (suffix: string) => { const d = await scratchDatabase(suffix); created.push(d); return d }
  const bare = async (suffix: string) => { const d = await bareDatabase(suffix); created.push(d); return d }

  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'cms-restore-')) })
  afterAll(async () => {
    rmSync(dir, { recursive: true, force: true })
    for (const d of created) await d.drop()
  })

  it('an older backup restored over an upgraded database leaves exactly the backup, and the new version starts on it', async () => {
    // The site as the older version left it: tables named siteSettings…, a journal up to 0017.
    const old = migrationsBeforeRename()
    const oldDb = await bare('rst_old')
    const oldPool = new pg.Pool({ connectionString: oldDb.url })
    await migrate(drizzle(oldPool), { migrationsFolder: old.dir })
    await oldPool.end()
    expect(await query(oldDb.url, `select to_regclass('public."siteSettings"') as t`)).toEqual([{ t: '"siteSettings"' }])
    await query(oldDb.url, `insert into "siteSettings" (site_name) values ('Old name')`)
    await query(oldDb.url, `insert into cms_users (email, name, role, status) values ('boss@example.com', 'Boss', 'admin', 'active')`)
    await query(oldDb.url, `insert into cms_media (url, key, mime, size) values ('/u/old', '2026/11/old.png', 'image/png', $1)`, [png.length])
    mkdirSync(join(dir, 'old-uploads/2026/11'), { recursive: true })
    writeFileSync(join(dir, 'old-uploads/2026/11/old.png'), png)
    const file = join(dir, 'old-version.tar')
    await runBackup(settings(oldDb.url, 'old-uploads'), file, silent)

    // The site after upgrading: renamed tables, a newer journal, content of its own.
    const head = await fresh('rst_head')
    await query(head.url, `insert into site_settings (site_name) values ('New name')`)
    await query(head.url, `insert into cms_users (email, name, role, status) values ('newer@example.com', 'Newer', 'admin', 'active')`)
    expect((await query(head.url, `select count(*)::int as n from drizzle.__drizzle_migrations`))[0].n).toBe(old.applied + old.after.length)

    await runRestore(settings(head.url, 'head-uploads'), file, { yes: true, force: true }, silent)

    // Exactly the backup: the old table name, the old journal, no trace of the newer schema.
    expect((await query(head.url, `select to_regclass('public."siteSettings"') as a, to_regclass('public.site_settings') as b`))[0]).toEqual({ a: '"siteSettings"', b: null })
    expect((await query(head.url, `select count(*)::int as n from drizzle.__drizzle_migrations`))[0].n).toBe(old.applied)
    expect((await query(head.url, `select email from cms_users`)).map((r) => r.email)).toEqual(['boss@example.com'])
    // The extension that lives in public went with the schema and came back with the dump.
    expect((await query(head.url, `select extname from pg_extension where extname = 'pg_trgm'`)).length).toBe(1)
    expect((await query(head.url, `select indexdef from pg_indexes where schemaname = 'public' and indexdef ilike '%gin_trgm_ops%'`)).length).toBeGreaterThan(0)
    expect(readFileSync(join(dir, 'head-uploads/2026/11/old.png')).equals(png)).toBe(true)

    // The current version's runner applies what the backup lacks (the rename) and starts cleanly.
    const result = await withDatabase(head.url, ({ transaction }) => runUpgrade(diskSource(playgroundDir), transaction, CORE_UPGRADE_STEPS))
    expect(result.migrations).toEqual(old.after) // the rename and everything since
    expect((await query(head.url, `select site_name from site_settings`)).map((r) => r.site_name)).toEqual(['Old name'])
    expect((await query(head.url, `select to_regclass('public."siteSettings"') as t`))[0].t).toBeNull()
    const again = await withDatabase(head.url, ({ transaction }) => runUpgrade(diskSource(playgroundDir), transaction, CORE_UPGRADE_STEPS))
    expect(again.migrations).toEqual([])
  })

  it('refuses a target with any table or an applied migration, with no accounts needed, unless forced', async () => {
    const src = await fresh('rst_src2')
    const target = await fresh('rst_target2') // migrated, no rows at all: cms_users is empty (think external sign-in)
    const file = join(dir, 'plain.tar')
    await runBackup(settings(src.url, 'src2-uploads'), file, silent)
    expect((await query(target.url, 'select count(*)::int as n from cms_users'))[0].n).toBe(0)
    await expect(runRestore(settings(target.url, 'x'), file, { yes: true }, silent)).rejects.toThrow(/is not empty \(\d+ table\(s\), \d+ applied migration\(s\)\)/)
    expect(await tablesIn(target.url)).toBeGreaterThan(0)

    // Only the migration journal left: still not empty.
    await query(target.url, 'drop schema public cascade; create schema public')
    await expect(runRestore(settings(target.url, 'x'), file, { yes: true }, silent)).rejects.toThrow(/is not empty \(0 table\(s\), \d+ applied migration\(s\)\)/)
    expect(await tablesIn(target.url)).toBe(0)
    await runRestore(settings(target.url, 'target2-uploads'), file, { yes: true, force: true }, silent)
    expect(await tablesIn(target.url)).toBeGreaterThan(0)
  })

  /** A pg_restore that behaves as the real one for everything but the script it writes (`-f -`), which goes through `script`. */
  const restoreShim = (name: string, script: string) => {
    const real = process.env.TINYZOO_PG_RESTORE || 'pg_restore'
    const shim = join(dir, name)
    writeFileSync(shim, `#!/bin/sh\ncase "$*" in *"-f -"*) ;; *) exec "${real}" "$@";; esac\n${script.replaceAll('REAL', `"${real}"`)}\n`)
    chmodSync(shim, 0o755)
    return shim
  }
  const snapshot = async (url: string) => ({
    tables: await tablesIn(url),
    users: (await query(url, 'select email from cms_users order by email')).map((r) => r.email),
    journal: (await query(url, 'select count(*)::int as n from drizzle.__drizzle_migrations'))[0].n as number,
  })

  it('is all or nothing: when pg_restore fails the database is exactly as it was, and the message says so', async () => {
    const src = await fresh('rst_src3')
    const target = await fresh('rst_target3')
    await query(target.url, `insert into cms_users (email, name, role, status) values ('keep@example.com', 'Keep', 'admin', 'active')`)
    const file = join(dir, 'fails.tar')
    await runBackup(settings(src.url, 'src3-uploads'), file, silent)
    const before = await snapshot(target.url)
    const shim = restoreShim('failing-pg_restore', 'echo "pg_restore: error: boom" >&2\nexit 1')
    await withEnv({ TINYZOO_PG_RESTORE: shim }, async () => {
      await expect(runRestore(settings(target.url, 'target3-uploads'), file, { yes: true, force: true }, silent)).rejects.toThrow(/boom[\s\S]*Nothing was changed[\s\S]*exactly as it was[\s\S]*run the restore again/)
    })
    expect(await snapshot(target.url)).toEqual(before)
    expect(existsSync(join(dir, 'target3-uploads'))).toBe(false)
    // …and the same archive restores fine once the cause is gone.
    await runRestore(settings(target.url, 'target3-uploads'), file, { yes: true, force: true }, silent)
    expect((await query(target.url, 'select count(*)::int as n from cms_users'))[0].n).toBe(0)
  })

  it('never commits a script that pg_restore only half wrote', async () => {
    const src = await fresh('rst_src8')
    const target = await fresh('rst_target8')
    await query(target.url, `insert into cms_users (email, name, role, status) values ('keep@example.com', 'Keep', 'admin', 'active')`)
    const file = join(dir, 'truncated.tar')
    await runBackup(settings(src.url, 'src8-uploads'), file, silent)
    const before = await snapshot(target.url)
    // A good script cut cleanly after the last CREATE, before the first row of data: every statement is
    // whole and valid, so psql would run to the end of its input without an error — and a restore that
    // committed at the end of its input would have the schemas dropped and recreated, empty.
    const shim = restoreShim('dying-pg_restore', `REAL "$@" | awk '/^COPY /{exit} {print}'\nexit 1`)
    await withEnv({ TINYZOO_PG_RESTORE: shim }, async () => {
      await expect(runRestore(settings(target.url, 'target8-uploads'), file, { yes: true, force: true }, silent)).rejects.toThrow(/pg_restore failed[\s\S]*exactly as it was/)
    })
    expect(await snapshot(target.url)).toEqual(before)
  })

  it('a script the server cannot apply rolls back too: the old data stays', async () => {
    const src = await fresh('rst_src9')
    const target = await fresh('rst_target9')
    const file = join(dir, 'bad-sql.tar')
    await runBackup(settings(src.url, 'src9-uploads'), file, silent)
    await query(target.url, `insert into cms_users (email, name, role, status) values ('keep@example.com', 'Keep', 'admin', 'active')`)
    const before = await snapshot(target.url)
    // A whole, valid-looking script with one statement the server rejects near the end (pg_restore itself exits 0).
    const shim = restoreShim('bad-sql-pg_restore', 'REAL "$@"\necho "CREATE TABLE public.tinyzoo_needs_a_newer_server (a tinyzoo_no_such_type);"')
    await withEnv({ TINYZOO_PG_RESTORE: shim }, async () => {
      await expect(runRestore(settings(target.url, 'target9-uploads'), file, { yes: true, force: true }, silent)).rejects.toThrow(/psql failed[\s\S]*tinyzoo_no_such_type[\s\S]*exactly as it was/)
    })
    expect(await snapshot(target.url)).toEqual(before)
  })

  it('leaves out a setting the server does not know, and says so (a dump from a newer pg_dump than the server)', async () => {
    const src = await fresh('rst_src10')
    const target = await bare('rst_target10')
    const file = join(dir, 'newer-settings.tar')
    await runBackup(settings(src.url, 'src10-uploads'), file, silent)
    // What pg_dump 17 does to a 16 server's dump, whichever versions this machine has.
    const shim = restoreShim('settings-pg_restore', `REAL "$@" | awk '{ print } /^SET statement_timeout = 0;$/ { print "SET tinyzoo_future_setting = 0;" }'`)
    const lines: string[] = []
    await withEnv({ TINYZOO_PG_RESTORE: shim }, async () => {
      await runRestore(settings(target.url, 'target10-uploads'), file, { yes: true }, { log: (l) => lines.push(l) })
    })
    expect(lines.join('\n')).toContain('Left out for this server: SET tinyzoo_future_setting')
    expect(await tablesIn(target.url)).toBeGreaterThan(0)
  })

  it('refuses a dump made by a newer pg_dump than the pg_restore, before touching anything', async () => {
    const src = await fresh('rst_src11')
    const target = await fresh('rst_target11')
    const file = join(dir, 'too-new.tar')
    await runBackup(settings(src.url, 'src11-uploads'), file, silent)
    const before = await snapshot(target.url)
    const real = process.env.TINYZOO_PG_RESTORE || 'pg_restore'

    // 1. a pg_restore that can read the archive but is older than the pg_dump (the version it reports is what counts).
    const old = join(dir, 'old-pg_restore')
    writeFileSync(old, `#!/bin/sh\ncase "$*" in *--version*) echo "pg_restore (PostgreSQL) 9.6.24";; *) exec "${real}" "$@";; esac\n`)
    chmodSync(old, 0o755)
    await withEnv({ TINYZOO_PG_RESTORE: old }, async () => {
      await expect(runRestore(settings(target.url, 'x'), file, { yes: true, force: true }, silent)).rejects.toThrow(/made by pg_dump \d+, newer than this pg_restore \(9\)[\s\S]*nothing was changed[\s\S]*TINYZOO_PG_RESTORE/)
    })
    expect(await snapshot(target.url)).toEqual(before)

    // 2. a real older pg_restore cannot even open a newer archive format: it says "unsupported version".
    const blind = join(dir, 'blind-pg_restore')
    writeFileSync(blind, `#!/bin/sh\ncase "$*" in *--version*) exec "${real}" "$@";; *) echo "pg_restore: error: unsupported version (1.99) in file header" >&2; exit 1;; esac\n`)
    chmodSync(blind, 0o755)
    await withEnv({ TINYZOO_PG_RESTORE: blind }, async () => {
      await expect(runRestore(settings(target.url, 'x'), file, { yes: true, force: true }, silent)).rejects.toThrow(/newer pg_dump \(archive format 1\.99\)[\s\S]*cannot read it; nothing was changed/)
    })
    expect(await snapshot(target.url)).toEqual(before)
  })

  it('reports a missing psql before it empties anything, and says what to do', async () => {
    const src = await fresh('rst_src12')
    const target = await fresh('rst_target12')
    const file = join(dir, 'no-psql.tar')
    await runBackup(settings(src.url, 'src12-uploads'), file, silent)
    const before = await snapshot(target.url)
    await withEnv({ TINYZOO_PSQL: '/nonexistent/psql' }, async () => {
      await expect(runRestore(settings(target.url, 'x'), file, { yes: true, force: true }, silent)).rejects.toThrow(/psql was not found[\s\S]*TINYZOO_PSQL/)
    })
    expect(await snapshot(target.url)).toEqual(before)
    expect(existsSync(join(dir, 'x'))).toBe(false)
  })

  it('checks the dump can be read before it empties anything', async () => {
    const target = await fresh('rst_target4')
    const evil = join(dir, 'unreadable')
    mkdirSync(evil)
    writeFileSync(join(evil, 'database.dump'), 'not a dump at all')
    writeFileSync(join(evil, 'manifest.json'), JSON.stringify({ format: 'tinyzoo-backup', version: 1, tinyzooVersion: 'x', createdAt: '', database: 'x', storageDriver: 'local', media: [], missingMedia: [] }))
    const file = join(dir, 'unreadable.tar')
    spawnSync('tar', ['-cf', file, '-C', evil, 'manifest.json', 'database.dump'])
    const before = await tablesIn(target.url)
    await expect(runRestore(settings(target.url, 'x'), file, { yes: true, force: true }, silent)).rejects.toThrow(/not a readable pg_dump archive; nothing was changed/)
    expect(await tablesIn(target.url)).toBe(before)
    expect(before).toBeGreaterThan(0)
  })

  it('does not follow a symbolic link in the archive into the media (no copying ~/.ssh/id_rsa into public files)', async () => {
    const target = await bare('rst_target5')
    const secret = join(dir, 'secret.txt')
    writeFileSync(secret, 'TOP SECRET')
    const evil = join(dir, 'linked')
    mkdirSync(join(evil, 'media/2026/11'), { recursive: true })
    writeFileSync(join(evil, 'database.dump'), 'irrelevant')
    symlinkSync(secret, join(evil, 'media/2026/11/a.png'))
    writeFileSync(join(evil, 'manifest.json'), JSON.stringify({ format: 'tinyzoo-backup', version: 1, tinyzooVersion: 'x', createdAt: '', database: 'x', storageDriver: 'local', media: [{ key: '2026/11/a.png', mime: 'image/png', size: 10 }], missingMedia: [] }))
    const file = join(dir, 'linked.tar')
    expect(spawnSync('tar', ['-cf', file, '-C', evil, 'manifest.json', 'database.dump', 'media']).status).toBe(0)
    await expect(runRestore(settings(target.url, 'target5-uploads'), file, { yes: true }, silent)).rejects.toThrow(/symbolic link/)
    expect(existsSync(join(dir, 'target5-uploads'))).toBe(false)
    expect(await tablesIn(target.url)).toBe(0)
  })

  it('refuses an archive that would unpack to more than the limit, before changing anything', async () => {
    const src = await fresh('rst_src6')
    const target = await bare('rst_target6')
    const file = join(dir, 'big.tar')
    await runBackup(settings(src.url, 'src6-uploads'), file, silent)
    await withEnv({ TINYZOO_MAX_ARCHIVE_BYTES: '2000' }, async () => {
      await expect(runRestore(settings(target.url, 'x'), file, { yes: true }, silent)).rejects.toThrow(/would unpack to more than .*TINYZOO_MAX_ARCHIVE_BYTES/)
    })
    expect(await tablesIn(target.url)).toBe(0)
  })

  it('creates the backup file readable by its owner only BEFORE tar writes a byte', async () => {
    const src = await fresh('rst_src7')
    const real = spawnSync('which', ['tar'], { encoding: 'utf8' }).stdout.trim()
    const bin = join(dir, 'bin')
    mkdirSync(bin)
    const spy = join(dir, 'tar-saw-mode')
    // A tar that looks at the output file's permissions the moment it is started.
    writeFileSync(join(bin, 'tar'), `#!/usr/bin/env node
const fs = require('fs'), cp = require('child_process')
const out = process.argv[3]
fs.writeFileSync(process.env.TAR_SPY, fs.existsSync(out) ? (fs.statSync(out).mode & 0o777).toString(8) : 'missing')
process.exit(cp.spawnSync(process.env.REAL_TAR, process.argv.slice(2), { stdio: 'inherit' }).status ?? 1)
`)
    chmodSync(join(bin, 'tar'), 0o755)
    const file = join(dir, 'private.tar')
    await withEnv({ PATH: `${bin}:${process.env.PATH}`, TAR_SPY: spy, REAL_TAR: real }, async () => {
      await runBackup(settings(src.url, 'src7-uploads'), file, silent)
    })
    expect(readFileSync(spy, 'utf8')).toBe('600')
    expect(lstatSync(file).mode & 0o777).toBe(0o600)
  })
})
