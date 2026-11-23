import { createRequire } from 'node:module'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { Client, PNG_1x1 } from '../helpers/api'
import { AwsClient, startFakeS3, type FakeS3 } from '../helpers/fakeS3'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'

// One bucket shared by several sites, each in a place of its own: cms.storage.s3.prefix
// (NUXT_CMS_STORAGE_S3_PREFIX). Everything the app writes is `<prefix>/<key>` in the bucket; the
// key in the database and the address of the app (`/api/cms/_media/raw/<key>`) are the same as
// without a prefix. One server per delivery mode against one fake bucket and one database.
//
// The prefix is given with a trailing slash on purpose: the app takes it as without.
const PREFIX = 'sites/7f3a'
const person = { name: 'Ada Admin', email: 'ada@example.com', password: 'correct horse battery' }
const SETUP = 'k1-setup'
const API = '/api/cms/_media/raw/'
const sharp = createRequire(new URL('../../packages/cms/package.json', import.meta.url))('sharp')

let db: Awaited<ReturnType<typeof scratchDatabase>>
let pool: pg.Pool
let s3: FakeS3
let proxy: SpawnedServer
let redirect: SpawnedServer
let publicMode: SpawnedServer
let noPrefix: SpawnedServer
let admin: Client
let adminRedirect: Client
let adminPublic: Client
const servers: SpawnedServer[] = []

const s3Env = (extra: Record<string, string> = {}) => ({
  NUXT_CMS_STORAGE_DRIVER: 's3',
  NUXT_CMS_STORAGE_S3_ENDPOINT: s3.endpoint,
  NUXT_CMS_STORAGE_S3_REGION: s3.region,
  NUXT_CMS_STORAGE_S3_BUCKET: s3.bucket,
  NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID: s3.accessKeyId,
  NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY: s3.secretAccessKey,
  NUXT_CMS_AUTH_SETUP_TOKEN: SETUP,
  NUXT_CMS_STORAGE_UPLOAD_RATE_PER_MIN: '1000',
  ...extra,
})
const launch = async (extra: Record<string, string> = {}) => {
  const s = await startServer(db.url, s3Env(extra))
  servers.push(s)
  return s
}
const upload = (c: Client, name = 'a.png', type = 'image/png', data: Uint8Array = PNG_1x1) => c.upload('/api/cms/_media', { name, type, data })
const rows = async (text: string) => (await pool.query(text)).rows
const keys = () => [...s3.objects.keys()].sort()
/** Objects of the bucket that are not in the prefix. */
const outside = () => keys().filter((k) => !k.startsWith(PREFIX + '/'))
const KEY = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(png|jpg|pdf)$/

beforeAll(async () => {
  db = await scratchDatabase('s3prefix')
  pool = new pg.Pool({ connectionString: db.url })
  s3 = await startFakeS3()
  proxy = await launch({ NUXT_CMS_STORAGE_S3_PREFIX: PREFIX + '/' })
  redirect = await launch({ NUXT_CMS_STORAGE_S3_PREFIX: PREFIX, NUXT_CMS_STORAGE_S3_DELIVERY: 'redirect' })
  publicMode = await launch({ NUXT_CMS_STORAGE_S3_PREFIX: PREFIX, NUXT_CMS_STORAGE_S3_DELIVERY: 'public' })
  noPrefix = await launch()
  admin = new Client(proxy.baseURL)
  expect((await admin.post('/api/cms/_auth/setup', { ...person, token: SETUP })).status).toBe(201)
  for (const [name, server] of [['redirect', redirect], ['public', publicMode], ['none', noPrefix]] as const) {
    const c = new Client(server.baseURL)
    c.cookie = admin.cookie
    if (name === 'redirect') adminRedirect = c
    if (name === 'public') adminPublic = c
  }
}, 120_000)

afterAll(async () => {
  await Promise.all(servers.map((s) => s.stop()))
  await s3?.close()
  await pool?.end()
  await db?.drop()
})

describe('proxy delivery with a prefix (the default for a private bucket)', () => {
  it('stores the file under the prefix, and the same key and app path as without one in the database and in every address', async () => {
    const before = keys().length
    const m = (await upload(admin)).body
    expect(m.key).toMatch(KEY)
    expect(m.url).toBe(API + m.key)
    expect((await rows(`select key, url from cms_media where id = '${m.id}'`))[0]).toEqual({ key: m.key, url: API + m.key })
    expect(keys().length).toBe(before + 1)
    expect(s3.objects.get(`${PREFIX}/${m.key}`)).toMatchObject({ type: 'image/png', size: PNG_1x1.length })
    expect(s3.objects.has(m.key)).toBe(false)
    expect(outside()).toEqual([])
    expect((await admin.get('/api/cms/_media')).body.items.find((x: any) => x.id === m.id).url).toBe(API + m.key)
  })

  it('serves it through the app: the whole file, a range, 304, HEAD', async () => {
    const m = (await upload(admin)).body
    const url = proxy.baseURL + m.url
    const res = await fetch(url)
    expect([res.status, res.headers.get('content-type')]).toEqual([200, 'image/png'])
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([...PNG_1x1])
    const etag = res.headers.get('etag')!
    expect((await fetch(url, { headers: { 'if-none-match': etag } })).status).toBe(304)
    const part = await fetch(url, { headers: { range: 'bytes=0-3' } })
    expect([part.status, part.headers.get('content-range')]).toEqual([206, `bytes 0-3/${PNG_1x1.length}`])
    await part.arrayBuffer()
    expect((await fetch(url, { method: 'HEAD' })).status).toBe(200)
    // Every request to the bucket was signed and for an object under the prefix.
    expect(s3.requests.filter((r) => !r.ok)).toEqual([])
    expect(s3.requests.filter((r) => !r.path.startsWith(`/${s3.bucket}/${PREFIX}/`))).toEqual([])
  })

  it('serves only files that are in its own place: the same key at the root or in another prefix is a 404', async () => {
    const m = (await upload(admin)).body
    // Another site's file and an unrelated object, both under this site's key but not in its place.
    const other = { body: Buffer.from('not mine'), size: 8, type: 'image/png', etag: '"x"' }
    s3.objects.delete(`${PREFIX}/${m.key}`)
    s3.objects.set(m.key, other)
    s3.objects.set(`sites/other/${m.key}`, other)
    try {
      expect((await fetch(proxy.baseURL + m.url)).status).toBe(404)
      expect((await fetch(redirect.baseURL + m.url, { redirect: 'manual' })).status).toBe(302) // the signature is only made; the bucket then says 404
      const signed = (await fetch(redirect.baseURL + m.url, { redirect: 'manual' })).headers.get('location')!
      expect(new URL(signed).pathname).toBe(`/${s3.bucket}/${PREFIX}/${m.key}`)
      expect((await fetch(signed)).status).toBe(404)
    }
    finally {
      s3.objects.delete(m.key)
      s3.objects.delete(`sites/other/${m.key}`)
    }
  })

  it('refuses a key that climbs out of the prefix, before the bucket is asked', async () => {
    const before = s3.requests.length
    for (const key of ['..%2Fother%2F2026%2F01%2Fx.png', '%2e%2e/other/x.png', '2026/../../other/x.png', '2026//x.png']) {
      const status = (await fetch(proxy.baseURL + API + key)).status
      expect(status, key).toBeGreaterThanOrEqual(400)
      expect(status, key).toBeLessThan(500)
    }
    expect(s3.requests.slice(before)).toEqual([])
  })

  it('makes the sized pictures under the prefix too, and the delete takes the file and its copies, and only those', async () => {
    const big = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#fe9b76' } }).jpeg().toBuffer()
    const m = (await upload(admin, 'big.jpg', 'image/jpeg', new Uint8Array(big))).body
    expect(m.key).toMatch(KEY)
    const res = await fetch(`${proxy.baseURL}/api/cms/_media/img/${m.id}/640.webp`)
    expect(res.status).toBe(200)
    expect((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).width).toBe(640)
    expect(s3.objects.has(`${PREFIX}/${m.key}`)).toBe(true)
    expect(s3.objects.has(`${PREFIX}/_w/640/${m.key}.webp`)).toBe(true)
    expect(s3.objects.has(`_w/640/${m.key}.webp`)).toBe(false)
    expect(outside()).toEqual([])

    // A file with the same key at the root, which a site without a prefix would own, is not touched.
    s3.objects.set(m.key, { body: Buffer.from('the root\'s'), size: 10, type: 'image/jpeg', etag: '"r"' })
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBeLessThan(300)
    expect(keys().filter((k) => k.includes(m.key))).toEqual([m.key])
    s3.objects.delete(m.key)
  })

  it('keeps the whole bucket tidy: nothing was written outside the prefix', () => {
    expect(outside()).toEqual([])
    expect(s3.requests.filter((r) => r.method !== 'GET' && r.method !== 'HEAD' && !r.path.startsWith(`/${s3.bucket}/${PREFIX}/`))).toEqual([])
  })
})

describe('redirect delivery with a prefix', () => {
  it('stores the app path, and signs the prefixed object', async () => {
    const m = (await upload(adminRedirect)).body
    expect(m.url).toBe(API + m.key)
    expect(s3.objects.has(`${PREFIX}/${m.key}`)).toBe(true)
    const res = await fetch(redirect.baseURL + m.url, { redirect: 'manual' })
    expect(res.status).toBe(302)
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe(`/${s3.bucket}/${PREFIX}/${m.key}`)
    expect(location.searchParams.get('X-Amz-Expires')).toBe('300')
    const followed = await fetch(location)
    expect(followed.status).toBe(200)
    expect([...new Uint8Array(await followed.arrayBuffer())]).toEqual([...PNG_1x1])
    expect((await rows(`select url from cms_media where id = '${m.id}'`))[0].url).toBe(API + m.key)
  })

  it('serves a file the proxy server stored: they share one place', async () => {
    const m = (await upload(admin)).body // stored by the proxy server (prefix with a trailing slash)
    const res = await fetch(redirect.baseURL + m.url, { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect((await fetch(res.headers.get('location')!)).status).toBe(200)
  })

  it('still serves sizes, and removes files and their copies', async () => {
    const m = (await upload(adminRedirect)).body
    expect((await fetch(`${redirect.baseURL}/api/cms/_media/img/${m.id}/320.webp`)).status).toBe(200)
    expect((await adminRedirect.delete(`/api/cms/_media/${m.id}`)).status).toBeLessThan(300)
    expect(keys().filter((k) => k.includes(m.key))).toEqual([])
    expect(outside()).toEqual([])
  })
})

describe('public delivery with a prefix', () => {
  it('stores the bucket\'s own address with the prefix in it, and the same key', async () => {
    const m = (await upload(adminPublic)).body
    expect(m.key).toMatch(KEY)
    expect(m.url).toBe(`${s3.endpoint}/${s3.bucket}/${PREFIX}/${m.key}`)
    expect(s3.objects.has(`${PREFIX}/${m.key}`)).toBe(true)
    expect((await rows(`select key, url from cms_media where id = '${m.id}'`))[0]).toEqual({ key: m.key, url: m.url })
    // That address is what a browser asks the bucket for: with credentials (the fake bucket is private) the object is there.
    const signer = new AwsClient({ accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey, region: s3.region, service: 's3' })
    const res = await signer.fetch(m.url)
    expect(res.status).toBe(200)
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([...PNG_1x1])
    expect(outside()).toEqual([])
  })
})

describe('without a prefix', () => {
  it('stores the key at the bucket\'s root, as before', async () => {
    const c = new Client(noPrefix.baseURL)
    c.cookie = admin.cookie
    const m = (await upload(c)).body
    expect(m.url).toBe(API + m.key)
    expect(s3.objects.has(m.key)).toBe(true)
    expect(s3.objects.has(`${PREFIX}/${m.key}`)).toBe(false)
    expect((await c.delete(`/api/cms/_media/${m.id}`)).status).toBeLessThan(300)
    expect(s3.objects.has(m.key)).toBe(false)
  })
})

describe('a prefix that is not clean', () => {
  it('stops the upload with a plain error that names the setting, and writes nothing', async () => {
    const bad = await launch({ NUXT_CMS_STORAGE_S3_PREFIX: '/sites/../other' })
    const c = new Client(bad.baseURL)
    c.cookie = admin.cookie
    const before = keys()
    const res = await upload(c)
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).toMatch(/cms\.storage\.s3\.prefix/)
    expect(JSON.stringify(res.body)).not.toContain(s3.secretAccessKey)
    expect(keys()).toEqual(before)
  })
})
