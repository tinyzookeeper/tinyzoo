import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { Client } from '../helpers/api'
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'

// How much a site may store in all: cms.storage.maxBytes (NUXT_CMS_STORAGE_MAX_BYTES), the sum of
// the sizes of its media rows. One server per setting, one database; the rows are emptied between
// the tests that need a clean count.
const person = { name: 'Ada Admin', email: 'ada@example.com', password: 'correct horse battery' }
const SETUP = 'k1-setup'
const STATUS = 'status-token-for-the-limits-spec-0123456789'

/** A PDF of exactly `size` bytes: the type check wants only its first bytes. */
const pdf = (size: number) => new Uint8Array(Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size - 9, 0x20)]))
const upload = (c: Client, size: number, name = 'f.pdf') => c.upload('/api/cms/_media', { name, type: 'application/pdf', data: pdf(size) })

let db: Awaited<ReturnType<typeof scratchDatabase>>
let pool: pg.Pool
let s3: FakeS3
let dir: string
const servers: SpawnedServer[] = []
let admin: Client

const launch = async (extra: Record<string, string> = {}) => {
  const s = await startServer(db.url, {
    NUXT_CMS_AUTH_SETUP_TOKEN: SETUP,
    NUXT_CMS_STATUS_TOKEN: STATUS,
    NUXT_CMS_STORAGE_UPLOAD_RATE_PER_MIN: '1000',
    NUXT_CMS_STORAGE_LOCAL_DIR: join(dir, 'uploads'),
    ...extra,
  })
  servers.push(s)
  return s
}
const clientOf = (server: SpawnedServer) => { const c = new Client(server.baseURL); c.cookie = admin.cookie; return c }
const used = async () => Number((await pool.query('select coalesce(sum(size), 0)::bigint as n from cms_media')).rows[0].n)
const count = async () => Number((await pool.query('select count(*)::int as n from cms_media')).rows[0].n)
const empty = () => pool.query('delete from cms_media')
const filesOnDisk = () => { try { return readdirSync(join(dir, 'uploads'), { recursive: true, withFileTypes: true }).filter((e) => e.isFile() && !e.parentPath.endsWith('.incoming')).length } catch { return 0 } }
const statusOf = async (server: SpawnedServer) => (await fetch(server.baseURL + '/api/health/status', { headers: { 'x-api-key': STATUS } })).json() as Promise<any>

beforeAll(async () => {
  db = await scratchDatabase('storagelimits')
  pool = new pg.Pool({ connectionString: db.url })
  s3 = await startFakeS3()
  dir = mkdtempSync(join(tmpdir(), 'cms-limits-'))
}, 60_000)
afterAll(async () => {
  await Promise.all(servers.map((s) => s.stop()))
  await s3?.close()
  await pool?.end()
  await db?.drop()
  rmSync(dir, { recursive: true, force: true })
})

describe('without a limit', () => {
  it('takes uploads as before, and the status has no limit', async () => {
    const server = await launch()
    admin = new Client(server.baseURL)
    expect((await admin.post('/api/cms/_auth/setup', { ...person, token: SETUP })).status).toBe(201)
    for (let i = 0; i < 3; i++) expect((await upload(admin, 5000)).status).toBe(201)
    const status = await statusOf(server)
    expect(status.media).toMatchObject({ files: 3, bytes: 15000 })
    expect(status.media).not.toHaveProperty('limitBytes')
    await empty()
  })

  it('0 is no limit too', async () => {
    const server = await launch({ NUXT_CMS_STORAGE_MAX_BYTES: '0' })
    expect((await upload(clientOf(server), 5000)).status).toBe(201)
    expect(await statusOf(server)).toMatchObject({ media: { files: 1 } })
    await empty()
  })
})

describe('a limit for the whole site (NUXT_CMS_STORAGE_MAX_BYTES)', () => {
  const LIMIT = 3500
  let server: SpawnedServer
  let c: Client
  beforeAll(async () => {
    server = await launch({ NUXT_CMS_STORAGE_MAX_BYTES: String(LIMIT) })
    c = clientOf(server)
  })

  it('refuses the upload that would go over, allows the ones that fit (up to the limit itself), and says why in plain words', async () => {
    await empty()
    for (const n of [1, 2, 3]) expect((await upload(c, 1000, `f${n}.pdf`)).status, `file ${n}`).toBe(201)
    expect(await used()).toBe(3000)
    // 500 more fits exactly (3500 = the limit); 501 would not.
    const over = await upload(c, 501)
    expect(over.status).toBe(413)
    expect(over.body.statusMessage).toBe('There is not enough storage space left for this file.')
    expect(over.body.data).toEqual({ code: 'storage_full', limitBytes: LIMIT, usedBytes: 3000 })
    expect(await count()).toBe(3)
    expect((await upload(c, 500)).status).toBe(201)
    expect(await used()).toBe(LIMIT)
    // The site is full: even a file of one byte more.
    expect((await upload(c, 1000)).status).toBe(413)
    expect(await count()).toBe(4)
  })

  it('stores nothing for a refused file', async () => {
    await empty()
    const before = filesOnDisk()
    expect((await upload(c, 4000)).status).toBe(413) // larger than the whole limit
    expect(filesOnDisk()).toBe(before)
    expect(await count()).toBe(0)
  })

  it('frees room at once when media is deleted', async () => {
    await empty()
    const ids: string[] = []
    for (let i = 0; i < 3; i++) ids.push((await upload(c, 1000)).body.id)
    expect((await upload(c, 1000)).status).toBe(413)
    expect((await c.delete(`/api/cms/_media/${ids[0]}`)).status).toBeLessThan(300)
    expect((await upload(c, 1000)).status).toBe(201)
    expect((await upload(c, 1000)).status).toBe(413)
  })

  it('reports the limit next to the bytes the status already has', async () => {
    await empty()
    expect((await upload(c, 1200)).status).toBe(201)
    expect((await statusOf(server)).media).toMatchObject({ files: 1, bytes: 1200, limitBytes: LIMIT })
  })

  it('does not count the smaller copies of a picture (they are derived)', async () => {
    await empty()
    const { createRequire } = await import('node:module')
    const sharp = createRequire(new URL('../../packages/cms/package.json', import.meta.url))('sharp')
    const small = new Uint8Array(await sharp({ create: { width: 400, height: 300, channels: 3, background: '#fe9b76' } }).jpeg({ quality: 50 }).toBuffer())
    expect(small.length).toBeLessThan(LIMIT)
    const m = (await c.upload('/api/cms/_media', { name: 's.jpg', type: 'image/jpeg', data: small })).body
    expect(await used()).toBe(small.length)
    expect((await fetch(`${server.baseURL}/api/cms/_media/img/${m.id}/320.webp`)).status).toBe(200) // a copy is made
    expect(await used()).toBe(small.length)
    expect((await statusOf(server)).media.bytes).toBe(small.length)
  })
})

describe('under many uploads at once', () => {
  it('ten uploads that arrive together: only as many as fit are stored, however they interleave', async () => {
    // Files in a bucket (with a prefix), to also see that the ones refused after they were stored are removed again.
    const server = await launch({
      NUXT_CMS_STORAGE_MAX_BYTES: '3500',
      NUXT_CMS_STORAGE_DRIVER: 's3',
      NUXT_CMS_STORAGE_S3_ENDPOINT: s3.endpoint, NUXT_CMS_STORAGE_S3_REGION: s3.region, NUXT_CMS_STORAGE_S3_BUCKET: s3.bucket,
      NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID: s3.accessKeyId, NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY: s3.secretAccessKey,
      NUXT_CMS_STORAGE_S3_PREFIX: 'sites/limits',
    })
    const c = clientOf(server)
    for (let round = 0; round < 3; round++) {
      await empty()
      s3.objects.clear()
      const answers = await Promise.all(Array.from({ length: 10 }, (_, i) => upload(c, 1000, `p${i}.pdf`)))
      const ok = answers.filter((a) => a.status === 201)
      const refused = answers.filter((a) => a.status === 413)
      expect(ok.length, `round ${round}`).toBe(3)
      expect(refused.length + ok.length).toBe(10)
      expect(refused.every((a) => a.body.data?.code === 'storage_full')).toBe(true)
      expect(await count()).toBe(3)
      expect(await used()).toBe(3000)
      // The bucket holds the three stored files and nothing else: a file refused at the lock was removed again.
      await new Promise((r) => setTimeout(r, 200))
      expect(s3.objects.size).toBe(3)
      expect([...s3.objects.keys()].every((k) => k.startsWith('sites/limits/'))).toBe(true)
    }
  }, 60_000)

  it('uploads of different sizes together never take the site over its limit', async () => {
    const server = await launch({ NUXT_CMS_STORAGE_MAX_BYTES: '5000' })
    const c = clientOf(server)
    await empty()
    const sizes = [900, 1700, 400, 2600, 1100, 800, 3000, 650, 1900, 300, 2200, 500]
    const answers = await Promise.all(sizes.map((n, i) => upload(c, n, `m${i}.pdf`)))
    expect(answers.map((a) => a.status).every((s) => s === 201 || s === 413)).toBe(true)
    const stored = await used()
    expect(stored).toBeLessThanOrEqual(5000)
    expect(stored).toBe(answers.reduce((sum, a, i) => sum + (a.status === 201 ? sizes[i]! : 0), 0))
    expect(await count()).toBe(answers.filter((a) => a.status === 201).length)
  }, 60_000)
})

describe('the quota of one person (NUXT_CMS_STORAGE_MAX_BYTES_PER_USER)', () => {
  it('still refuses, with its own message, and holds under uploads that arrive together', async () => {
    const server = await launch({ NUXT_CMS_STORAGE_MAX_BYTES_PER_USER: '2500' })
    const c = clientOf(server)
    await empty()
    const answers = await Promise.all(Array.from({ length: 8 }, (_, i) => upload(c, 1000, `u${i}.pdf`)))
    expect(answers.filter((a) => a.status === 201)).toHaveLength(2)
    const refused = answers.find((a) => a.status === 413)!
    expect(refused.body.statusMessage).toBe('Storage quota exceeded.')
    expect(await used()).toBe(2000)
    expect(await count()).toBe(2)
  }, 60_000)
})
