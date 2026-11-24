import { createRequire } from 'node:module'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Client, PNG_1x1 } from '../helpers/api'
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3'
import { expectNoSiteErrors, siteClient, siteQuery, startTenants, type Tenants, type TenantSite, tenantGet, until } from '../helpers/tenants'
import { CMS_IMAGE_WIDTHS } from '../../packages/cms/shared/image-widths'

// Two sites in one process that share ONE bucket, each in a place of its own: the site
// directory gives site A the prefix `sites/a` and site B `sites/b`, with the same endpoint,
// bucket and credentials. (Telling two sites apart is the directory's job: two rows with the
// same bucket and prefix would share files, and nothing in the app checks that.)
// A serves its files by redirect (a signed address), B through the app (proxy). Also what each site may store: A has a total limit and a small file limit, B has neither.
const sharp = createRequire(join(process.cwd(), 'packages/cms/package.json'))('sharp')
/** A plain picture: small, so site A's total limit is not what these tests are about. */
const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#fe9b76' } }).jpeg({ quality: 80 }).toBuffer() as Promise<Buffer>
/** A PDF of exactly `size` bytes. */
const pdf = (size: number) => new Uint8Array(Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size - 9, 0x20)]))

const LIMIT_A = 100_000
const PART = 40_000 // two fit, a third does not; half a part more does

let s3: FakeS3
let t: Tenants
let adminA: Client
let adminB: Client
/** The picture both sites have a row for (uploaded to A before the copy). */
let shared: { id: string; key: string }

beforeAll(async () => {
  s3 = await startFakeS3()
  const bucket = { endpoint: s3.endpoint, region: s3.region, bucket: s3.bucket, accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey }
  t = await startTenants('s3prefix', {}, {
    config: {
      a: { storage: { driver: 's3', s3: { ...bucket, prefix: 'sites/a/', delivery: 'redirect' }, maxBytes: LIMIT_A, maxSizeMb: 1 } },
      b: { storage: { driver: 's3', s3: { ...bucket, prefix: 'sites/b' }, maxSizeMb: 2 } },
    },
    async seed({ admin, query }) {
      const res = await admin.upload('/api/cms/_media', { name: 'shared.jpg', type: 'image/jpeg', data: new Uint8Array(await photo(900, 600)) })
      if (res.status !== 201) throw new Error(`seed upload: ${res.status} ${JSON.stringify(res.body)}`)
      await until('the seeded picture\'s copies', () => query('select state from cms_media_sizes where media_id = $1', [res.body.id]), (r) => r[0]?.state === 'done', 30_000)
    },
  })
  adminA = siteClient(t.a, 'admin')
  adminB = siteClient(t.b, 'admin')
  const [row] = await siteQuery(t.a, 'select id, key from cms_media')
  shared = { id: row.id, key: row.key }
}, 120_000)
afterAll(async () => {
  try { expectNoSiteErrors(t) }
  finally {
    await t?.stop()
    await s3?.close()
  }
})

const upload = (c: Client, name = 'a.png', type = 'image/png', data: Uint8Array = PNG_1x1) => c.upload('/api/cms/_media', { name, type, data })
const uploadPdf = (c: Client, size: number, name = 'f.pdf') => upload(c, name, 'application/pdf', pdf(size))
const keys = () => [...s3.objects.keys()].sort()
const under = (prefix: string) => keys().filter((k) => k.startsWith(prefix + '/'))
const status = async (site: TenantSite, path: string) => (await fetch(site.url + path)).status
const sizesDone = (site: TenantSite, id: string) => until(`the smaller copies of ${id}`, () => siteQuery(site, 'select state, widths from cms_media_sizes where media_id = $1', [id]), (r) => r[0]?.state === 'done' && r[0].widths === CMS_IMAGE_WIDTHS.join(','), 30_000)
const used = async (site: TenantSite) => Number((await siteQuery(site, 'select coalesce(sum(size), 0)::bigint as n from cms_media'))[0].n)
const emptyLibrary = (site: TenantSite) => siteQuery(site, 'delete from cms_media')

describe('two sites in one bucket, each in its own prefix', () => {
  it('the seeded file was stored in A\'s place, and nothing is outside the two prefixes', () => {
    expect(s3.objects.has(`sites/a/${shared.key}`)).toBe(true)
    expect(keys().filter((k) => !k.startsWith('sites/a/') && !k.startsWith('sites/b/'))).toEqual([])
  })

  it('each site\'s uploads are under its own prefix, with the key the site stores unprefixed', async () => {
    const a = (await upload(adminA, 'on-a.png')).body
    const b = (await upload(adminB, 'on-b.png')).body
    expect(a.url).toBe(`/api/cms/_media/raw/${a.key}`)
    expect(b.url).toBe(`/api/cms/_media/raw/${b.key}`)
    expect(a.key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/)
    expect(s3.objects.has(`sites/a/${a.key}`)).toBe(true)
    expect(s3.objects.has(`sites/b/${b.key}`)).toBe(true)
    expect(s3.objects.has(`sites/b/${a.key}`)).toBe(false)
    expect(s3.objects.has(`sites/a/${b.key}`)).toBe(false)
    expect(s3.objects.has(a.key) || s3.objects.has(b.key)).toBe(false)
    expect((await siteQuery(t.a, 'select key from cms_media where id = $1', [a.id]))[0].key).toBe(a.key)
    expect(keys().filter((k) => !k.startsWith('sites/a/') && !k.startsWith('sites/b/'))).toEqual([])
  })

  it('a file of A is served by A and is 404 on B under the same address, raw and sized', async () => {
    const a = (await upload(adminA, 'serve-a.png')).body
    expect(await status(t.a, a.url)).toBe(200)
    expect(await status(t.b, a.url)).toBe(404)
    expect((await fetch(t.b.url + a.url, { method: 'HEAD' })).status).toBe(404)
    const picture = (await upload(adminA, 'pic-a.jpg', 'image/jpeg', new Uint8Array(await photo(700, 400)))).body
    expect(await status(t.a, `/api/cms/_media/img/${picture.id}/480.webp`)).toBe(200)
    expect(await status(t.b, `/api/cms/_media/img/${picture.id}/480.webp`)).toBe(404)
    expect(await status(t.b, `/api/cms/_media/raw/_w/480/${picture.key}.webp`)).toBe(404)
    // A's copy was made under A's prefix, and B has none.
    expect(s3.objects.has(`sites/a/_w/480/${picture.key}.webp`)).toBe(true)
    expect(under('sites/b').filter((k) => k.includes(picture.key))).toEqual([])
  })

  it('the row both sites have: B has the row but not the file, and does not reach A\'s', async () => {
    // B's database says "this key is mine" (the row was copied); its place has no such object.
    const url = `/api/cms/_media/raw/${shared.key}`
    expect(await status(t.a, url)).toBe(200)
    expect(await status(t.b, url)).toBe(404)
    expect(await status(t.a, `/api/cms/_media/img/${shared.id}/640.webp`)).toBe(200)
    expect(await status(t.b, `/api/cms/_media/img/${shared.id}/640.webp`)).toBe(404)
    for (let i = 0; i < 3; i++) {
      expect(await status(t.b, url)).toBe(404)
      expect(await status(t.a, url)).toBe(200)
    }
    expect(under('sites/b').filter((k) => k.includes(shared.key))).toEqual([])
  })

  it('A (redirect) signs an address for its own prefix; B (proxy) streams from its own', async () => {
    const a = (await upload(adminA, 'redirect-a.png')).body
    const res = await fetch(t.a.url + a.url, { redirect: 'manual' })
    expect(res.status).toBe(302)
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe(`/${s3.bucket}/sites/a/${a.key}`)
    expect((await fetch(location)).status).toBe(200)
    // The same address on B is a 404, not a signature for B's prefix.
    expect((await fetch(t.b.url + a.url, { redirect: 'manual' })).status).toBe(404)
    const b = (await upload(adminB, 'proxy-b.png')).body
    const streamed = await fetch(t.b.url + b.url, { redirect: 'manual' })
    expect([streamed.status, [...new Uint8Array(await streamed.arrayBuffer())]]).toEqual([200, [...PNG_1x1]])
    expect(s3.requests.filter((r) => !r.ok)).toEqual([])
  })

  it('deleting on B the row both sites have leaves A\'s objects, its copies and its row', async () => {
    await sizesDone(t.a, shared.id)
    const before = under('sites/a').filter((k) => k.includes(shared.key))
    expect(before.length).toBeGreaterThan(3)
    expect((await adminB.delete(`/api/cms/_media/${shared.id}`)).status).toBeLessThan(300)
    expect(await siteQuery(t.b, 'select 1 from cms_media where id = $1', [shared.id])).toEqual([])
    expect(await siteQuery(t.a, 'select 1 from cms_media where id = $1', [shared.id])).toHaveLength(1)
    expect(under('sites/a').filter((k) => k.includes(shared.key))).toEqual(before)
    expect(await status(t.a, `/api/cms/_media/raw/${shared.key}`)).toBe(200)
  }, 60_000)

  it('a file of A cannot be deleted from B by its id, and A\'s own delete takes it from A\'s prefix only', async () => {
    const a = (await upload(adminA, 'gone-a.png')).body
    const b = (await upload(adminB, 'stays-b.png')).body
    expect((await adminB.delete(`/api/cms/_media/${a.id}`)).status).toBe(404)
    expect(s3.objects.has(`sites/a/${a.key}`)).toBe(true)
    expect((await adminA.delete(`/api/cms/_media/${a.id}`)).status).toBeLessThan(300)
    expect(s3.objects.has(`sites/a/${a.key}`)).toBe(false)
    expect(s3.objects.has(`sites/b/${b.key}`)).toBe(true)
    expect(await status(t.b, b.url)).toBe(200)
  })
})

describe('limits per site', () => {
  it('the largest single file is each site\'s own: 1 MB for A, 2 MB for B', async () => {
    const big = 1.5 * 1024 * 1024
    const refused = await uploadPdf(adminA, big)
    expect(refused.status).toBe(413)
    expect(refused.body.data).toMatchObject({ code: 'file_too_large', maxMb: 1 })
    const taken = await uploadPdf(adminB, big)
    expect(taken.status).toBe(201)
    expect(s3.objects.get(`sites/b/${taken.body.key}`)!.size).toBe(big)
    // Over B's 2 MB too.
    const over = await uploadPdf(adminB, 2.5 * 1024 * 1024)
    expect(over.status).toBe(413)
    expect(over.body.data).toMatchObject({ code: 'file_too_large', maxMb: 2 })
    expect(await siteQuery(t.a, `select 1 from cms_media where name = 'f.pdf'`)).toEqual([])
  })

  it('A, at its total limit, refuses what would go over; B, with none, takes it', async () => {
    await emptyLibrary(t.a)
    s3.objects.forEach((_, k) => { if (k.startsWith('sites/a/')) s3.objects.delete(k) })
    expect((await uploadPdf(adminA, PART)).status).toBe(201)
    expect((await uploadPdf(adminA, PART)).status).toBe(201)
    const full = await uploadPdf(adminA, PART)
    expect(full.status).toBe(413)
    expect(full.body.data).toEqual({ code: 'storage_full', limitBytes: LIMIT_A, usedBytes: 2 * PART })
    expect((await uploadPdf(adminA, PART / 2)).status).toBe(201) // exactly the limit
    expect(await used(t.a)).toBe(LIMIT_A)
    expect((await uploadPdf(adminA, 100)).status).toBe(413)
    // B has no limit: the same upload fits however much it holds.
    const before = await used(t.b)
    expect((await uploadPdf(adminB, PART)).status).toBe(201)
    expect(await used(t.b)).toBe(before + PART)
    // A frees room by deleting, and only A's.
    const [row] = await siteQuery(t.a, 'select id from cms_media where size = $1', [PART])
    expect((await adminA.delete(`/api/cms/_media/${row.id}`)).status).toBeLessThan(300)
    expect((await uploadPdf(adminA, PART)).status).toBe(201)
    expect((await uploadPdf(adminA, 100)).status).toBe(413)
  })

  it('the status of each site tells its own limit', async () => {
    const of = async (site: TenantSite) => (await tenantGet(site.url, '/api/health/status', '', { 'x-api-key': site.statusToken })).body
    const [a, b] = [await of(t.a), await of(t.b)]
    expect(a.media).toMatchObject({ files: (await siteQuery(t.a, 'select count(*)::int as n from cms_media'))[0].n, bytes: await used(t.a), limitBytes: LIMIT_A })
    expect(b.media).not.toHaveProperty('limitBytes')
  })

  it('ten uploads at once to A: as many as fit are stored in A\'s prefix, and B is not affected', async () => {
    await emptyLibrary(t.a)
    s3.objects.forEach((_, k) => { if (k.startsWith('sites/a/')) s3.objects.delete(k) })
    const bBefore = { rows: (await siteQuery(t.b, 'select count(*)::int as n from cms_media'))[0].n, objects: under('sites/b').length }
    const answers = await Promise.all([
      ...Array.from({ length: 10 }, (_, i) => uploadPdf(adminA, PART, `a${i}.pdf`)),
      // B uploads at the same time: its own count, its own place.
      ...Array.from({ length: 4 }, (_, i) => uploadPdf(adminB, PART, `b${i}.pdf`)),
    ])
    const fromA = answers.slice(0, 10)
    const fromB = answers.slice(10)
    expect(fromA.filter((a) => a.status === 201)).toHaveLength(2)
    expect(fromA.filter((a) => a.status === 413).every((a) => a.body.data?.code === 'storage_full')).toBe(true)
    expect(fromB.map((a) => a.status)).toEqual([201, 201, 201, 201])
    expect(await used(t.a)).toBe(2 * PART)
    await new Promise((r) => setTimeout(r, 200))
    expect(under('sites/a')).toHaveLength(2)
    expect(under('sites/b')).toHaveLength(bBefore.objects + 4)
    expect((await siteQuery(t.b, 'select count(*)::int as n from cms_media'))[0].n).toBe(bBefore.rows + 4)
  }, 60_000)
})
