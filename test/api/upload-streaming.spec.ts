import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client, PNG_1x1 } from '../helpers/api'
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'

// Uploads are streamed: the server's memory stays flat whatever the size of the file, and
// the size cap counts the bytes that actually arrive (a chunked body has no Content-Length).
// Own servers (not the shared one) so their process id — and so their memory — is known.
const person = { name: 'Ada Admin', email: 'ada@example.com', password: 'correct horse battery' }
const SETUP = 'streaming-setup'
const MB = 1024 * 1024

let db: Awaited<ReturnType<typeof scratchDatabase>>
let s3: FakeS3
let local: SpawnedServer
let remote: SpawnedServer
let adminLocal: Client
let adminRemote: Client
const rssMb = (pid: number) => Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim()) / 1024

/** A valid PNG header followed by `size - header` bytes of filler: readable by the size sniffer, `size` bytes long. */
function png(size: number): Buffer {
  const filler = Buffer.alloc(size - PNG_1x1.length)
  for (let i = 0; i < filler.length; i += 1024) filler[i] = (i / 1024) % 251
  return Buffer.concat([PNG_1x1, filler])
}

/** Peak growth of the server's resident memory (MB) while `run` goes on, after a settle. */
async function growthWhile(pid: number, run: () => Promise<unknown>): Promise<number> {
  await new Promise((r) => setTimeout(r, 300))
  const before = rssMb(pid)
  let peak = before
  const sampler = setInterval(() => { peak = Math.max(peak, rssMb(pid)) }, 25)
  try { await run() }
  finally { clearInterval(sampler) }
  peak = Math.max(peak, rssMb(pid))
  return peak - before
}

/** POST a multipart body with `Transfer-Encoding: chunked` (no Content-Length), `total` bytes of file in 64 KB pieces. */
function chunkedUpload(baseURL: string, cookie: string, total: number): Promise<{ status: number; body: string; sent: number }> {
  return new Promise((resolve, reject) => {
    const boundary = '----streamtest' + Math.random().toString(16).slice(2)
    const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.png"\r\nContent-Type: image/png\r\n\r\n`)
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
    const req = httpRequest(baseURL + '/api/cms/_media', {
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'transfer-encoding': 'chunked', cookie, 'x-forwarded-for': '198.51.100.7' },
    })
    let sent = 0 // body bytes written so far
    let fileBytes = 0
    let answered = false
    req.on('response', (res) => {
      answered = true
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => resolve({ status: res.statusCode!, body, sent }))
      // The server may stop reading: do not keep pushing megabytes it ignores.
      if (res.statusCode! >= 400) req.destroy()
    })
    req.on('error', (err) => { if (!answered) reject(err) })
    const chunk = Buffer.alloc(64 * 1024, 7)
    let first = true
    const pump = () => {
      while (!answered) {
        let piece: Buffer
        if (first) { first = false; piece = Buffer.concat([head, PNG_1x1]); fileBytes = PNG_1x1.length }
        else if (fileBytes >= total) { sent += tail.length; req.end(tail); return }
        else { piece = chunk.subarray(0, Math.min(chunk.length, total - fileBytes)); fileBytes += piece.length }
        sent += piece.length
        if (!req.write(piece)) { req.once('drain', pump); return }
      }
    }
    pump()
  })
}

beforeAll(async () => {
  db = await scratchDatabase('streaming')
  s3 = await startFakeS3()
  local = await startServer(db.url, { NUXT_CMS_AUTH_SETUP_TOKEN: SETUP })
  remote = await startServer(db.url, {
    NUXT_CMS_STORAGE_DRIVER: 's3',
    NUXT_CMS_STORAGE_S3_ENDPOINT: s3.endpoint,
    NUXT_CMS_STORAGE_S3_REGION: s3.region,
    NUXT_CMS_STORAGE_S3_BUCKET: s3.bucket,
    NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID: s3.accessKeyId,
    NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY: s3.secretAccessKey,
    // Room for a file that would not fit in a 256 MiB pod if it were held in memory.
    NUXT_CMS_STORAGE_MAX_SIZE_MB: '120',
  })
  adminLocal = new Client(local.baseURL)
  expect((await adminLocal.post('/api/cms/_auth/setup', { ...person, token: SETUP })).status).toBe(201)
  adminRemote = new Client(remote.baseURL)
  adminRemote.cookie = adminLocal.cookie
}, 120_000)

afterAll(async () => {
  await Promise.all([local?.stop(), remote?.stop()])
  await s3?.close()
  await db?.drop()
})

const upload = (c: Client, data: Uint8Array, name = 'a.png', type = 'image/png') => c.upload('/api/cms/_media', { name, type, data })

describe('memory', () => {
  it('a 9.5 MB upload to disk grows the server by a small fraction of its size', async () => {
    await upload(adminLocal, PNG_1x1) // warm up (lazy imports, connection pool)
    const data = png(Math.round(9.5 * MB))
    let res: Awaited<ReturnType<typeof upload>> | undefined
    const growth = await growthWhile(local.pid, async () => { res = await upload(adminLocal, data) })
    expect(res!.status).toBe(201)
    expect(res!.body.size).toBe(data.length)
    expect(growth, `rss grew ${growth.toFixed(0)} MB for a 9.5 MB file`).toBeLessThan(40)
  })

  it('a 100 MB upload to a bucket grows the server by less than the file, and the bucket gets every byte', async () => {
    await upload(adminRemote, png(20 * MB)) // warm up (lazy imports, the signing client, the first big buffers)
    const data = png(100 * MB)
    let res: Awaited<ReturnType<typeof upload>> | undefined
    const growth = await growthWhile(remote.pid, async () => { res = await upload(adminRemote, data) })
    expect(res!.status).toBe(201)
    const stored = s3.objects.get(res!.body.key)!
    expect(stored.size).toBe(data.length)
    expect(createHash('sha256').update(stored.body!).digest('hex')).toBe(createHash('sha256').update(data).digest('hex'))
    expect(s3.requests.filter((r) => !r.ok)).toEqual([])
    // Node leaves the short-lived buffers of a fast stream for a later collection, so some
    // growth is normal (and does not follow the size: 20–75 MB from 10 to 150 MB files).
    // Reading the file into memory took 4 to 33 times its size.
    expect(growth, `rss grew ${growth.toFixed(0)} MB for a 100 MB file`).toBeLessThan(100)
  }, 60_000)
})

describe('the size cap counts the bytes that arrive', () => {
  it('a chunked body over the limit gets 413 and the server does not grow', async () => {
    await upload(adminLocal, PNG_1x1)
    let result: Awaited<ReturnType<typeof chunkedUpload>> | undefined
    const growth = await growthWhile(local.pid, async () => { result = await chunkedUpload(local.baseURL, adminLocal.cookie, 100 * MB) })
    expect(result!.status).toBe(413)
    // It said no early: nowhere near the whole 100 MB went in.
    expect(result!.sent).toBeLessThan(40 * MB)
    expect(growth, `rss grew ${growth.toFixed(0)} MB`).toBeLessThan(40)
  })

  it('a chunked body within the limit is stored whole', async () => {
    const result = await chunkedUpload(local.baseURL, adminLocal.cookie, 3 * MB)
    expect(result.status).toBe(201)
    expect(JSON.parse(result.body).size).toBe(3 * MB)
  })

  it('a file just over the limit is 413 and leaves nothing behind', async () => {
    const before = (await adminLocal.get('/api/cms/_media')).body.items.length
    const res = await upload(adminLocal, png(10 * MB + 1))
    expect(res.status).toBe(413)
    expect((await adminLocal.get('/api/cms/_media')).body.items.length).toBe(before)
  })
})
