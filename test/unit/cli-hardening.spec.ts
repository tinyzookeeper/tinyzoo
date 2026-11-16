import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, linkSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pgEnv, settingsFrom } from '../../packages/cms/cli/backup'
import { archiveLimit, extractTar, extractTarGz, MAX_HEADER_BODY, writeTarGz } from '../../packages/cms/cli/tar'
import { hostSettings, storageFromEnv, storageFromSettings } from '../../packages/cms/cli/transfer'

// What the backup / export / import commands do with hostile or oversized input, and how they find settings.

let dir: string
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'tinyzoo-hardening-')) })
afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

// ── a hand-made tar, for headers `tar` would never write ───────────────────────

function block(name: string, type: string, size: number): Buffer {
  const h = Buffer.alloc(512)
  h.write(name, 0, 100, 'utf8')
  h.write('0000644\0', 100, 8, 'ascii')
  h.write('0000000\0', 108, 8, 'ascii')
  h.write('0000000\0', 116, 8, 'ascii')
  h.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii')
  h.write('00000000000\0', 136, 12, 'ascii')
  h.fill(0x20, 148, 156)
  h.write(type, 156, 1, 'ascii')
  h.write('ustar\0', 257, 6, 'ascii')
  h.write('00', 263, 2, 'ascii')
  let sum = 0
  for (const b of h) sum += b
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')
  return h
}
const padTo = (n: number) => Buffer.alloc((512 - (n % 512)) % 512)
function entry(name: string, type: string, body: Buffer): Buffer {
  return Buffer.concat([block(name, type, body.length), body, padTo(body.length)])
}
const end = Buffer.alloc(1024)
const rawTarGz = (name: string, ...parts: Buffer[]) => { const f = join(dir, name); writeFileSync(f, gzipSync(Buffer.concat([...parts, end]))); return f }

describe('tar reader limits', () => {
  it('refuses a pax or GNU long-name header over 64 KiB instead of buffering it', async () => {
    const huge = Buffer.alloc(MAX_HEADER_BODY + 1, 0x61)
    for (const type of ['x', 'L']) {
      const file = rawTarGz(`meta-${type}.tar.gz`, entry('meta', type, huge), entry('a.txt', '0', Buffer.from('hi')))
      await expect(extractTarGz(file, join(dir, `out-meta-${type}`))).rejects.toThrow(/header of 65537 bytes; the limit is 64 KiB/)
    }
    // Well within the limit: a long path in a pax header still works.
    const long = 'd/'.repeat(80) + 'file.txt'
    const rec = `path=${long}\n`
    const pax = `${String(rec.length + 4)} ${rec}`
    const file = rawTarGz('pax-ok.tar.gz', entry('meta', 'x', Buffer.from(pax)), entry('short', '0', Buffer.from('hi')))
    expect(await extractTarGz(file, join(dir, 'out-pax-ok'))).toEqual([long])
  })

  it('stops an archive that would unpack to more than the limit, at its header, before writing', async () => {
    const file = rawTarGz('bomb.tar.gz', entry('a.bin', '0', Buffer.alloc(3000)), entry('b.bin', '0', Buffer.alloc(3000)))
    const out = join(dir, 'out-bomb')
    await expect(extractTarGz(file, out, { maxBytes: 5000 })).rejects.toThrow(/would unpack to more than .*TINYZOO_MAX_ARCHIVE_BYTES=<bytes>/)
    expect(existsSync(join(out, 'b.bin'))).toBe(false) // refused at its header
    // A single declared size that is huge is refused even though no body follows (a truncated bomb).
    const lying = join(dir, 'lying.tar.gz')
    writeFileSync(lying, gzipSync(Buffer.concat([block('big.bin', '0', 50 * 1024 ** 3)])))
    await expect(extractTarGz(lying, join(dir, 'out-lying'))).rejects.toThrow(/would unpack to more than 20 GiB/)
    // Under the limit it is fine; the default is 20 GiB and the environment can change it.
    expect(await extractTarGz(file, join(dir, 'out-bomb-ok'), { maxBytes: 6000 })).toEqual(['a.bin', 'b.bin'])
    expect(archiveLimit({})).toBe(20 * 1024 ** 3)
    expect(archiveLimit({ TINYZOO_MAX_ARCHIVE_BYTES: '1048576' })).toBe(1048576)
    expect(archiveLimit({ TINYZOO_MAX_ARCHIVE_BYTES: 'lots' })).toBe(20 * 1024 ** 3)
  })

  it('never creates a link; a strict read (backups) refuses an archive that holds one', async () => {
    const src = join(dir, 'links')
    mkdirSync(src)
    writeFileSync(join(src, 'real.txt'), 'real')
    const secret = join(dir, 'secret.txt')
    writeFileSync(secret, 'TOP SECRET')
    symlinkSync(secret, join(src, 'sym.txt'))
    linkSync(join(src, 'real.txt'), join(src, 'hard.txt'))
    const tarFile = join(dir, 'links.tar')
    expect(spawnSync('tar', ['-cf', tarFile, '-C', src, 'real.txt', 'sym.txt', 'hard.txt']).status).toBe(0)

    const lenient = join(dir, 'out-links')
    const names = await extractTar(tarFile, lenient)
    expect(names.filter((n) => !n.startsWith('._'))).toEqual(['real.txt']) // (macOS tar adds ._ files for extended attributes) // the link and the hard link were skipped, not followed or created
    expect(existsSync(join(lenient, 'sym.txt'))).toBe(false)
    expect(existsSync(join(lenient, 'hard.txt'))).toBe(false)

    await expect(extractTar(tarFile, join(dir, 'out-links-strict'), { strict: true })).rejects.toThrow(/contains (a symbolic link|a hard link)/)
    const sym = join(dir, 'sym-only.tar')
    expect(spawnSync('tar', ['-cf', sym, '-C', src, 'sym.txt']).status).toBe(0)
    await expect(extractTar(sym, join(dir, 'out-sym-strict'), { strict: true })).rejects.toThrow(/symbolic link \("sym.txt"\)/)
  })

  it('honours a pax size record (members over 8 GiB, as bsdtar writes them)', async () => {
    const rec = 'size=5\n'
    const pax = `${String(rec.length + 3)} ${rec}`
    const body = Buffer.from('hello')
    const file = rawTarGz('pax-size.tar.gz', entry('meta', 'x', Buffer.from(pax)), Buffer.concat([block('big.bin', '0', 0), body, padTo(5)]), entry('after.txt', '0', Buffer.from('ok')))
    const out = join(dir, 'out-pax-size')
    expect(await extractTarGz(file, out)).toEqual(['big.bin', 'after.txt'])
    expect(readFileSync(join(out, 'big.bin'), 'utf8')).toBe('hello')
    await expect(extractTarGz(file, join(dir, 'out-pax-size2'), { maxBytes: 4 })).rejects.toThrow(/would unpack to more than/)
  })

  it('reads GNU base-256 sizes and refuses a name listed twice', async () => {
    const big = block('huge.bin', '0', 0)
    big[124] = 0x80
    big.fill(0, 125, 136)
    big.writeUInt32BE(4_000_000_000, 132) // 4 GB, as base-256
    big.fill(0x20, 148, 156)
    let sum = 0
    for (const b of big) sum += b
    big.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')
    const f = join(dir, 'base256.tar.gz')
    writeFileSync(f, gzipSync(big))
    await expect(extractTarGz(f, join(dir, 'out-b256'), { maxBytes: 1000 })).rejects.toThrow(/would unpack to more than/)

    const twice = rawTarGz('twice.tar.gz', entry('x.txt', '0', Buffer.from('1')), entry('x.txt', '0', Buffer.from('2')))
    await expect(extractTarGz(twice, join(dir, 'out-twice'))).rejects.toThrow(/lists "x.txt" more than once/)
  })

  it('writes archives readable by their owner only, from the first byte (whatever the umask)', async () => {
    const out = join(dir, 'private.tar.gz')
    // Stale file with wide permissions: it is replaced, not reopened.
    writeFileSync(out, 'old', { mode: 0o644 })
    const before = process.umask(0)
    try {
      let seen = ''
      const entries = {
        *[Symbol.iterator]() {
          yield { name: 'a.txt', data: Buffer.from('hello') }
          // Pulled while the archive is being written. The file is created by a worker thread
          // (the stream's open), which may not have run yet when the next entry is asked for
          // (under load it often has not): wait for it to appear, then look at it at once.
          const until = Date.now() + 5000
          while (!existsSync(out) && Date.now() < until) { /* the open does not need this thread */ }
          seen = (statSync(out).mode & 0o777).toString(8)
          yield { name: 'b.txt', data: Buffer.from('world') }
        },
      }
      await writeTarGz(out, entries)
      expect(seen).toBe('600')
      expect(lstatSync(out).mode & 0o777).toBe(0o600)
      expect(await extractTarGz(out, join(dir, 'out-private'))).toEqual(['a.txt', 'b.txt'])
    }
    finally { process.umask(before) }
  })
})

// ── TLS for pg_dump / pg_restore ───────────────────────────────────────────────

describe('pg_dump / pg_restore TLS matches what the app does', () => {
  const env = (url: string, inherited: NodeJS.ProcessEnv = {}) => {
    const e = pgEnv(url, inherited)
    return Object.fromEntries(Object.entries(e).filter(([k]) => k.startsWith('PGSSL'))) as Record<string, string>
  }
  const base = 'postgres://u:p@db.example.com:5432/site'

  it('maps sslmode like node-postgres: anything but disable / no-verify verifies the certificate AND the host name', () => {
    expect(env(base)).toEqual({})
    expect(env(`${base}?sslmode=disable`)).toEqual({ PGSSLMODE: 'disable' })
    // libpq's own "require" would accept any certificate; node-postgres (pg-connection-string 2.x) verifies fully.
    for (const mode of ['require', 'prefer', 'verify-ca', 'verify-full']) expect(env(`${base}?sslmode=${mode}`)).toEqual({ PGSSLMODE: 'verify-full' })
    expect(env(`${base}?sslmode=no-verify`)).toEqual({ PGSSLMODE: 'require' })
    expect(env(`${base}?ssl=true`)).toEqual({ PGSSLMODE: 'verify-full' })
    expect(env(`${base}?ssl=1`)).toEqual({ PGSSLMODE: 'verify-full' })
    expect(env(`${base}?ssl=0`)).toEqual({ PGSSLMODE: 'disable' })
  })

  it('passes certificate files through and treats them as a request for verified TLS', () => {
    expect(env(`${base}?sslrootcert=/etc/ca.pem&sslcert=/etc/c.pem&sslkey=/etc/k.pem`)).toEqual({
      PGSSLMODE: 'verify-full', PGSSLROOTCERT: '/etc/ca.pem', PGSSLCERT: '/etc/c.pem', PGSSLKEY: '/etc/k.pem',
    })
    expect(env(`${base}?sslmode=no-verify&sslrootcert=/etc/ca.pem`)).toEqual({ PGSSLMODE: 'require', PGSSLROOTCERT: '/etc/ca.pem' })
  })

  it('keeps the shell\'s PGSSL* settings, drops its other PG* ones, and lets the URL win', () => {
    const shell = { PGSSLMODE: 'verify-full', PGSSLROOTCERT: '/shell/ca.pem', PGHOST: 'elsewhere', PGDATABASE: 'other', PGPASSWORD: 'shell' }
    const e = pgEnv(base, shell)
    expect(e).toMatchObject({ PGSSLMODE: 'verify-full', PGSSLROOTCERT: '/shell/ca.pem', PGHOST: 'db.example.com', PGDATABASE: 'site', PGPASSWORD: 'p' })
    expect(pgEnv(`${base}?sslmode=disable`, shell).PGSSLMODE).toBe('disable')
  })

  it('uselibpqcompat=true passes libpq\'s own meanings through', () => {
    expect(env(`${base}?uselibpqcompat=true&sslmode=require`)).toEqual({ PGSSLMODE: 'require' })
    expect(env(`${base}?uselibpqcompat=true&sslmode=verify-ca&sslrootcert=/ca.pem`)).toEqual({ PGSSLMODE: 'verify-ca', PGSSLROOTCERT: '/ca.pem' })
  })
})

// ── settings: nuxt.config counts, for backup, export and import alike ──────────

describe('storage settings come from nuxt.config too', () => {
  it('resolves the environment first, then cms.storage, as the server does', () => {
    const cms = { storage: { driver: 's3', local: { dir: 'cfg-dir', publicBase: '/cfg-media' }, s3: { endpoint: 'https://s3.example.com', bucket: 'cfg-bucket', accessKeyId: 'k', secretAccessKey: 's', publicBaseUrl: 'https://cdn.example.com' } } }
    const fromConfig = settingsFrom('/site', {}, cms).storage
    expect(fromConfig).toMatchObject({ driver: 's3', localDir: '/site/cfg-dir', localPublicBase: '/cfg-media', s3: { bucket: 'cfg-bucket', publicBaseUrl: 'https://cdn.example.com' } })
    const s3 = storageFromSettings(fromConfig)
    expect(s3.describe).toBe('the bucket cfg-bucket')
    expect(s3.url('a/b.png')).toBe('https://cdn.example.com/a/b.png')
    // The environment wins.
    expect(settingsFrom('/site', { NUXT_CMS_STORAGE_S3_BUCKET: 'env-bucket' }, cms).storage.s3.bucket).toBe('env-bucket')
    const local = storageFromEnv('/site', {}, {}, { storage: { local: { dir: 'cfg-dir', publicBase: '/cfg-media' } } })
    expect(local.describe).toBe('the folder /site/cfg-dir')
    expect(local.url('x.png')).toBe('/cfg-media/x.png')
    // Missing S3 settings are named, wherever they could be set.
    expect(() => storageFromEnv('/site', { NUXT_CMS_STORAGE_DRIVER: 's3' })).toThrow(/missing endpoint, bucket, accessKeyId, secretAccessKey.*nuxt\.config/)
  })

  it('reads the host\'s nuxt.config.ts (export and import used to look at the environment only)', async () => {
    const host = join(dir, 'host')
    mkdirSync(host)
    writeFileSync(join(host, 'nuxt.config.ts'), `export default { cms: { databaseUrl: 'postgres://cfg/db', storage: { local: { dir: 'uploads-from-config' } } } }\n`)
    const settings = await hostSettings(host, {})
    expect(settings.databaseUrl).toBe('postgres://cfg/db')
    expect(storageFromSettings(settings.storage).describe).toBe(`the folder ${join(host, 'uploads-from-config')}`)
    // --uploads still wins over the config.
    expect(storageFromSettings(settings.storage, { dir: 'other', cwd: host }).describe).toBe(`the folder ${join(host, 'other')}`)
  })
})
