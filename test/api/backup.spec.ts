import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type BackupSettings, runBackup, runRestore, type StorageSettings } from '../../packages/cms/cli/backup'
import { scratchDatabase } from '../helpers/server'

// `tinyzoo backup` / `tinyzoo restore` against real databases (two scratch ones) and,
// for S3, a small S3-style server in this process. Needs pg_dump and pg_restore (or
// TINYZOO_PG_DUMP / TINYZOO_PG_RESTORE pointing at them); skipped where they are missing.
const has = (cmd: string) => !spawnSync(cmd, ['--version']).error
const tools = has(process.env.TINYZOO_PG_DUMP || 'pg_dump') && has(process.env.TINYZOO_PG_RESTORE || 'pg_restore')

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const silent = { log: () => {} }

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

describe.skipIf(!tools)('backup and restore', () => {
  let src: Awaited<ReturnType<typeof scratchDatabase>>
  let dst: Awaited<ReturnType<typeof scratchDatabase>>
  let dir: string
  const local = (name: string): StorageSettings => ({ driver: 'local', localDir: join(dir, name), s3: { endpoint: '', region: '', bucket: '', accessKeyId: '', secretAccessKey: '' } })
  const s3 = (endpoint: string): StorageSettings => ({ driver: 's3', localDir: '', s3: { endpoint, region: 'us-east-1', bucket: 'bucket', accessKeyId: 'AKIATEST', secretAccessKey: 'secret' } })
  const settings = (databaseUrl: string, storage: StorageSettings): BackupSettings => ({ databaseUrl, storage })

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'cms-backup-'))
    src = await scratchDatabase('bkp_src')
    dst = await scratchDatabase('bkp_dst')
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

  it('refuses a database that has accounts, unless forced; and asks first', async () => {
    const file = join(dir, 'again.tar')
    await runBackup(settings(src.url, local('src-uploads')), file, silent)
    await expect(runRestore(settings(dst.url, local('dst-2')), file, { yes: true }, silent)).rejects.toThrow(/already has 1 account/)
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
        const scratch = await scratchDatabase('bkp_s3')
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
