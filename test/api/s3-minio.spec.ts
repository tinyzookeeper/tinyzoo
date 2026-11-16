import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client, PNG_1x1 } from '../helpers/api'
import { AwsClient } from '../helpers/fakeS3'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'
import { storageFromEnv } from '../../packages/cms/cli/transfer'

// The same two modes against a real MinIO — what the fake S3 cannot prove: that a
// presigned address and the signed reads are accepted by an actual S3 implementation, and
// that a bucket without a policy (private, like Pushbase's) refuses anonymous reads.
//
// Runs when TEST_S3_ENDPOINT is set (CI starts MinIO; locally:
//   docker run -d --name tinyzoo-minio-test -p 9190:9000 -e MINIO_ROOT_USER=minio -e MINIO_ROOT_PASSWORD=minio12345 minio/minio server /data
//   TEST_S3_ENDPOINT=http://localhost:9190 TEST_S3_ACCESS_KEY=minio TEST_S3_SECRET_KEY=minio12345 pnpm test:api …).
// It makes its own bucket and removes only that.
const endpoint = process.env.TEST_S3_ENDPOINT
const accessKeyId = process.env.TEST_S3_ACCESS_KEY ?? 'minio'
const secretAccessKey = process.env.TEST_S3_SECRET_KEY ?? 'minio12345'
const bucket = `tinyzoo-test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
const API = '/api/cms/_media/raw/'
const person = { name: 'Ada Admin', email: 'ada@example.com', password: 'correct horse battery' }

const bytes = async (res: Response) => new Uint8Array(await res.arrayBuffer())

describe.skipIf(!endpoint)('MinIO, private bucket', () => {
  let db: Awaited<ReturnType<typeof scratchDatabase>>
  let proxy: SpawnedServer
  let redirect: SpawnedServer
  let admin: Client
  let adminRedirect: Client
  const aws = () => new AwsClient({ accessKeyId, secretAccessKey, region: 'us-east-1', service: 's3' })
  const env = (extra: Record<string, string>) => ({
    NUXT_CMS_STORAGE_DRIVER: 's3', NUXT_CMS_STORAGE_S3_ENDPOINT: endpoint!, NUXT_CMS_STORAGE_S3_REGION: 'us-east-1', NUXT_CMS_STORAGE_S3_BUCKET: bucket,
    NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID: accessKeyId, NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY: secretAccessKey, NUXT_CMS_STORAGE_S3_FORCE_PATH_STYLE: 'true',
    NUXT_CMS_AUTH_SETUP_TOKEN: 'minio-setup', ...extra,
  })
  const upload = (c: Client, name: string, type: string, data: Uint8Array) => c.upload('/api/cms/_media', { name, type, data })
  const head = async (key: string) => (await aws().fetch(`${endpoint}/${bucket}/${key}`, { method: 'HEAD' })).status

  beforeAll(async () => {
    const made = await aws().fetch(`${endpoint}/${bucket}`, { method: 'PUT' })
    expect(made.status, 'creating the bucket').toBe(200)
    db = await scratchDatabase('s3minio')
    proxy = await startServer(db.url, env({}))
    redirect = await startServer(db.url, env({ NUXT_CMS_STORAGE_S3_DELIVERY: 'redirect' }))
    admin = new Client(proxy.baseURL)
    expect((await admin.post('/api/cms/_auth/setup', { ...person, token: 'minio-setup' })).status).toBe(201)
    adminRedirect = new Client(redirect.baseURL)
    adminRedirect.cookie = admin.cookie
  }, 120_000)

  afterAll(async () => {
    await Promise.all([proxy?.stop(), redirect?.stop()])
    await db?.drop()
    // Only the bucket this run made: its objects, then the bucket.
    const listed = await (await aws().fetch(`${endpoint}/${bucket}?list-type=2`)).text()
    for (const [, key] of listed.matchAll(/<Key>([^<]+)<\/Key>/g)) await aws().fetch(`${endpoint}/${bucket}/${key}`, { method: 'DELETE' })
    await aws().fetch(`${endpoint}/${bucket}`, { method: 'DELETE' })
  })

  it('the bucket refuses anonymous reads, so the app has to serve (or sign) every file', async () => {
    const video = new Uint8Array(4000).map((_, i) => i % 251)
    const m = (await upload(admin, 'clip.mp4', 'video/mp4', video)).body
    expect(m.url).toBe(API + m.key)
    expect((await fetch(`${endpoint}/${bucket}/${m.key}`)).status).toBe(403)
    expect(await head(m.key)).toBe(200)
  })

  it('proxy: whole file, ranges (206 with Content-Range), 416, 304 and 404', async () => {
    const video = new Uint8Array(4000).map((_, i) => (i * 7) % 251)
    const m = (await upload(admin, 'clip.mp4', 'video/mp4', video)).body
    const url = proxy.baseURL + m.url
    const whole = await fetch(url)
    expect([whole.status, whole.headers.get('content-type'), whole.headers.get('content-length'), whole.headers.get('accept-ranges')]).toEqual([200, 'video/mp4', '4000', 'bytes'])
    expect([...await bytes(whole)]).toEqual([...video])

    const part = await fetch(url, { headers: { range: 'bytes=1000-1999' } })
    expect([part.status, part.headers.get('content-range'), part.headers.get('content-length')]).toEqual([206, 'bytes 1000-1999/4000', '1000'])
    expect([...await bytes(part)]).toEqual([...video.slice(1000, 2000)])
    expect([...await bytes(await fetch(url, { headers: { range: 'bytes=-10' } }))]).toEqual([...video.slice(-10)])

    const outside = await fetch(url, { headers: { range: 'bytes=9000-' } })
    expect([outside.status, outside.headers.get('content-range')]).toEqual([416, 'bytes */4000'])
    await outside.arrayBuffer()

    const etag = whole.headers.get('etag')!
    expect(etag).toBeTruthy()
    expect((await fetch(url, { headers: { 'if-none-match': etag } })).status).toBe(304)
    expect((await fetch(`${proxy.baseURL}${API}2026/01/00000000-0000-4000-8000-000000000000.mp4`)).status).toBe(404)
  })

  it('redirect: 302 to a presigned address MinIO accepts, that expires in five minutes and serves ranges', async () => {
    const data = new Uint8Array(3000).map((_, i) => (i * 3) % 251)
    const m = (await upload(adminRedirect, 'clip.mp4', 'video/mp4', data)).body
    expect(m.url).toBe(API + m.key)
    const res = await fetch(redirect.baseURL + m.url, { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('cache-control')).toBe('private, max-age=240')
    const location = res.headers.get('location')!
    expect(new URL(location).searchParams.get('X-Amz-Expires')).toBe('300')
    const direct = await fetch(location)
    expect(direct.status).toBe(200)
    expect([...await bytes(direct)]).toEqual([...data])
    const ranged = await fetch(location, { headers: { range: 'bytes=5-14' } })
    expect([ranged.status, ranged.headers.get('content-range')]).toEqual([206, 'bytes 5-14/3000'])
    // A forged address is refused by MinIO.
    expect((await fetch(location.replace(m.key, m.key.replace(/.$/, 'x')))).status).toBe(403)
    // The same through the app, where the browser follows by itself.
    expect([...await bytes(await fetch(redirect.baseURL + m.url))]).toEqual([...data])
  })

  it('smaller copies of a picture are made from and kept in the private bucket, and removed with it', async () => {
    const sharp = createRequire(new URL('../../packages/cms/package.json', import.meta.url))('sharp')
    const big = await sharp({ create: { width: 1500, height: 900, channels: 3, background: '#7a9' } }).jpeg().toBuffer()
    const m = (await upload(admin, 'photo.jpg', 'image/jpeg', new Uint8Array(big))).body
    const res = await fetch(`${proxy.baseURL}/api/cms/_media/img/${m.id}/640.webp`)
    expect([res.status, res.headers.get('content-type')]).toEqual([200, 'image/webp'])
    await res.arrayBuffer()
    expect(await head(`_w/640/${m.key}.webp`)).toBe(200)
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBeLessThan(300)
    expect(await head(m.key)).toBe(404)
    expect(await head(`_w/640/${m.key}.webp`)).toBe(404)
  })

  it('the command line reads and writes the private bucket, and stores the app path for new files', async () => {
    const cli = storageFromEnv(tmpdir(), env({}))
    await cli.put('cli/a.png', Buffer.from(PNG_1x1), 'image/png')
    expect([...(await cli.get('cli/a.png'))!]).toEqual([...PNG_1x1])
    expect(await cli.get('cli/missing.png')).toBeNull()
    expect(cli.url('cli/a.png')).toBe(API + 'cli/a.png')
    expect(await head('cli/a.png')).toBe(200)
  })
})
