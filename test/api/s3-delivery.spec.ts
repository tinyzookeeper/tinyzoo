import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { Client, doc, PNG_1x1 } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'

// S3 storage in a private bucket: the built playground against a fake S3 that answers 403
// to anything without a valid signature. One server per delivery mode, one database.
//   proxy    — no setting at all (the default without a public address): the app streams
//   redirect — the app answers 302 with a signed address
//   public   — today's behaviour; here the bucket is private, so the app only warns
const person = { name: 'Ada Admin', email: 'ada@example.com', password: 'correct horse battery' }
const SETUP = 'k1-setup'
const API = '/api/cms/_media/raw/'

let db: Awaited<ReturnType<typeof scratchDatabase>>
let s3: FakeS3
let proxy: SpawnedServer
let redirect: SpawnedServer
let publicMode: SpawnedServer
let admin: Client // on the proxy server
let adminRedirect: Client
let adminPublic: Client
const servers: SpawnedServer[] = []

const s3Env = () => ({
  NUXT_CMS_STORAGE_DRIVER: 's3',
  NUXT_CMS_STORAGE_S3_ENDPOINT: s3.endpoint,
  NUXT_CMS_STORAGE_S3_REGION: s3.region,
  NUXT_CMS_STORAGE_S3_BUCKET: s3.bucket,
  NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID: s3.accessKeyId,
  NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY: s3.secretAccessKey,
  // What Pushbase injects next to the others; harmless.
  NUXT_CMS_STORAGE_S3_FORCE_PATH_STYLE: 'true',
  NUXT_CMS_AUTH_SETUP_TOKEN: SETUP,
})
const launch = async (extra: Record<string, string> = {}) => {
  const s = await startServer(db.url, { ...s3Env(), ...extra })
  servers.push(s)
  return s
}
// A server that sat idle may have closed the keep-alive connection fetch is about to reuse (EPIPE): once more.
const upload = async (c: Client, name = 'a.png', type = 'image/png', data: Uint8Array = PNG_1x1) => {
  try { return await c.upload('/api/cms/_media', { name, type, data }) }
  catch (err) {
    if (!(err instanceof TypeError)) throw err
    return c.upload('/api/cms/_media', { name, type, data })
  }
}
const bytes = async (res: Response) => new Uint8Array(await res.arrayBuffer())
/** `n` bytes where byte i is i % 251 — except the 'ftyp' that makes it an MP4 to the upload check. */
const pattern = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i >= 4 && i < 8 ? 'ftyp'.charCodeAt(i - 4) : i % 251))
const rssMb = (pid: number) => Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim()) / 1024

beforeAll(async () => {
  db = await scratchDatabase('s3delivery')
  s3 = await startFakeS3()
  proxy = await launch()
  redirect = await launch({ NUXT_CMS_STORAGE_S3_DELIVERY: 'redirect' })
  publicMode = await launch({ NUXT_CMS_STORAGE_S3_DELIVERY: 'public' })
  admin = new Client(proxy.baseURL)
  const setup = await admin.post('/api/cms/_auth/setup', { ...person, token: SETUP })
  expect(setup.status).toBe(201)
  // The session cookie is sealed with the same password on every server.
  adminRedirect = new Client(redirect.baseURL)
  adminRedirect.cookie = admin.cookie
  adminPublic = new Client(publicMode.baseURL)
  adminPublic.cookie = admin.cookie
}, 120_000)

afterAll(async () => {
  await Promise.all(servers.map((s) => s.stop()))
  await s3?.close()
  await db?.drop()
})

describe('proxy delivery (the default for a private bucket)', () => {
  it('stores the app path — in the media row and in every API that returns it — not an address that can expire', async () => {
    const m = (await upload(admin)).body
    expect(m.url).toBe(API + m.key)
    expect(s3.objects.get(m.key)).toMatchObject({ type: 'image/png', size: PNG_1x1.length })
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id, status: 'published', hero: m.id, body: doc('with image', { mediaId: m.id, src: m.url }) })
    const content = (await new Client(proxy.baseURL).get('/api/content/post')).body.items.find((i: any) => i.slug === post.slug)
    expect(content.hero.url).toBe(API + m.key)
    expect((await admin.get('/api/cms/_media')).body.items.find((x: any) => x.id === m.id).url).toBe(API + m.key)
    expect(JSON.stringify(content)).not.toMatch(/X-Amz|127\.0\.0\.1|AKIA/)
  })

  it('streams the whole file with the safety headers and a type from the bucket', async () => {
    const m = (await upload(admin)).body
    const res = await fetch(proxy.baseURL + m.url)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox")
    expect(res.headers.get('content-disposition')).toBe('inline')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    expect(res.headers.get('content-length')).toBe(String(PNG_1x1.length))
    expect(res.headers.get('etag')).toMatch(/^"[0-9a-f]{32}"$/)
    expect([...await bytes(res)]).toEqual([...PNG_1x1])
    // Every request the app made carried a valid signature (the bucket refuses the rest).
    expect(s3.requests.filter((r) => !r.ok)).toEqual([])
  })

  it('answers ranges the way Safari needs them: 206, Content-Range, Content-Length, Accept-Ranges', async () => {
    const data = pattern(5000)
    const m = (await upload(admin, 'clip.mp4', 'video/mp4', data)).body
    const url = proxy.baseURL + m.url

    const part = await fetch(url, { headers: { range: 'bytes=100-199' } })
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe('bytes 100-199/5000')
    expect(part.headers.get('content-length')).toBe('100')
    expect(part.headers.get('accept-ranges')).toBe('bytes')
    expect(part.headers.get('content-type')).toBe('video/mp4')
    expect([...await bytes(part)]).toEqual([...data.slice(100, 200)])
    expect(s3.requests.at(-1)).toMatchObject({ range: 'bytes=100-199', ok: true }) // the bucket sent only that part

    expect([...await bytes(await fetch(url, { headers: { range: 'bytes=-5' } }))]).toEqual([...data.slice(-5)])
    const open = await fetch(url, { headers: { range: 'bytes=4990-' } })
    expect(open.headers.get('content-range')).toBe('bytes 4990-4999/5000')
    await open.arrayBuffer()
    // Safari's first request.
    const probe = await fetch(url, { headers: { range: 'bytes=0-1' } })
    expect([probe.status, probe.headers.get('content-range')]).toEqual([206, 'bytes 0-1/5000'])
    await probe.arrayBuffer()

    const outside = await fetch(url, { headers: { range: 'bytes=9000-' } })
    expect(outside.status).toBe(416)
    expect(outside.headers.get('content-range')).toBe('bytes */5000')
    await outside.arrayBuffer()
    // Several ranges: the whole file.
    const several = await fetch(url, { headers: { range: 'bytes=0-1,10-11' } })
    expect([several.status, (await bytes(several)).length]).toEqual([200, 5000])
  })

  it('answers 304 for the tag it sent, and HEAD without a body', async () => {
    const m = (await upload(admin)).body
    const url = proxy.baseURL + m.url
    const etag = (await fetch(url)).headers.get('etag')!
    const again = await fetch(url, { headers: { 'if-none-match': etag } })
    expect(again.status).toBe(304)
    expect(again.headers.get('etag')).toBe(etag)
    expect(await again.text()).toBe('')
    const head = await fetch(url, { method: 'HEAD' })
    expect([head.status, head.headers.get('content-length'), head.headers.get('content-type')]).toEqual([200, String(PNG_1x1.length), 'image/png'])
    expect(await head.text()).toBe('')
  })

  it('answers 404 for a file that is not in the bucket, and refuses keys that leave it', async () => {
    expect((await fetch(`${proxy.baseURL}${API}2026/01/00000000-0000-4000-8000-000000000000.png`)).status).toBe(404)
    const before = s3.requests.length
    for (const key of ['..%2F..%2Fother%2Fx.png', '%2e%2e/%2e%2e/other/x.png', '2026//x.png']) {
      const status = (await fetch(proxy.baseURL + API + key)).status
      expect(status, key).toBeGreaterThanOrEqual(400)
      expect(status, key).toBeLessThan(500)
    }
    expect(s3.requests.slice(before).filter((r) => !r.path.startsWith(`/${s3.bucket}/`))).toEqual([])
  })

  it('serves only objects that belong to a media row: another tool\'s object in the same bucket is a 404', async () => {
    s3.putGenerated('other-tool/customers.csv', 200, 'text/csv')
    const before = s3.requests.length
    for (const server of [proxy, redirect]) {
      const res = await fetch(server.baseURL + API + 'other-tool/customers.csv', { redirect: 'manual' })
      expect([server === proxy ? 'proxy' : 'redirect', res.status, res.headers.get('location')]).toEqual([server === proxy ? 'proxy' : 'redirect', 404, null])
    }
    // The app did not even ask the bucket, let alone sign an address for it.
    expect(s3.requests.slice(before)).toEqual([])
    s3.objects.delete('other-tool/customers.csv')
  })

  it('answers 502 when the bucket fails, without its address or the credentials — in the response and in the log', async () => {
    const m = (await upload(admin)).body
    s3.failWith(500)
    try {
      for (const range of [undefined, 'bytes=0-3']) {
        const res = await fetch(proxy.baseURL + m.url + '?token=hunter2', { headers: range ? { range } : {} })
        expect(res.status).toBe(502)
        const body = await res.text()
        for (const leak of [s3.endpoint, s3.accessKeyId, s3.secretAccessKey, '127.0.0.1:' + new URL(s3.endpoint).port, '/media/' + m.key]) expect(body).not.toContain(leak)
      }
      await proxy.waitForLog(/"status":502/)
    }
    finally { s3.failWith(0) }
    const log = proxy.logs.join('')
    for (const leak of [s3.endpoint, s3.accessKeyId, s3.secretAccessKey, 'hunter2']) expect(log).not.toContain(leak)
    // And it recovers.
    expect((await fetch(proxy.baseURL + m.url)).status).toBe(200)
  })

  it('serves smaller copies of pictures, made from the private bucket', async () => {
    const { createRequire } = await import('node:module')
    const sharp = createRequire(new URL('../../packages/cms/package.json', import.meta.url))('sharp')
    const big = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#fe9b76' } }).jpeg().toBuffer()
    const m = (await upload(admin, 'big.jpg', 'image/jpeg', new Uint8Array(big))).body
    const res = await fetch(`${proxy.baseURL}/api/cms/_media/img/${m.id}/640.webp`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect([meta.format, meta.width]).toEqual(['webp', 640])
    expect(s3.objects.has(`_w/640/${m.key}.webp`)).toBe(true)
    // …and the file's delete takes the copies with it.
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBeLessThan(300)
    expect(s3.objects.has(m.key)).toBe(false)
    expect(s3.objects.has(`_w/640/${m.key}.webp`)).toBe(false)
  })

  it('removes the file from the bucket when its last use goes', async () => {
    const m = (await upload(admin)).body
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id, hero: m.id })
    expect(s3.objects.has(m.key)).toBe(true)
    await admin.delete(`/api/cms/post/${post.id}`)
    expect(s3.objects.has(m.key)).toBe(false)
  })

  it('streams a 600 MB video without holding it: memory does not follow the size, a slow reader slows the bucket down, a reader that leaves cancels the read', async () => {
    const SIZE = 600 * 1024 * 1024
    s3.putGenerated('big/film.mp4', SIZE, 'video/mp4')
    // Served only as a media row's file (see cmsMediaKeys).
    await pgRows(`insert into cms_media (url, key, mime, size) values ('${API}big/film.mp4', 'big/film.mp4', 'video/mp4', ${SIZE})`)
    const url = proxy.baseURL + API + 'big/film.mp4'
    // Warm up (module loading, the signing client), then measure.
    await (await fetch(proxy.baseURL + (await upload(admin)).body.url)).arrayBuffer()
    const before = rssMb(proxy.pid)

    // 1. A reader that waits: the bucket may send what the sockets and stream buffers hold, not the file.
    const sentBefore = s3.bytesSent()
    const slow = await fetch(url)
    expect(slow.headers.get('content-length')).toBe(String(SIZE))
    const reader = slow.body!.getReader()
    await reader.read()
    await new Promise((r) => setTimeout(r, 1500))
    const sentWhileWaiting = s3.bytesSent() - sentBefore
    expect(sentWhileWaiting, 'bytes the bucket sent while nobody read').toBeLessThan(64 * 1024 * 1024)
    // 2. The reader leaves: the read from the bucket is cancelled.
    await reader.cancel()
    await vi_waitFor(() => s3.inFlight() === 0)

    // 3. The whole file, read as fast as it comes: memory does not follow the file size.
    let peak = before
    const sampler = setInterval(() => { peak = Math.max(peak, rssMb(proxy.pid)) }, 100)
    const full = await fetch(url)
    let seen = 0
    let first = -1
    for await (const chunk of full.body as any as AsyncIterable<Uint8Array>) {
      if (seen === 0) first = chunk[0]!
      seen += chunk.length
    }
    clearInterval(sampler)
    expect(seen).toBe(SIZE)
    expect(first).toBe(0)
    const growth = peak - before
    // Node lets the short-lived buffers of a fast stream pile up before it collects them
    // (a bare proxy of 20 lines does the same: 65–125 MB, whatever the size). A route that
    // held the file would grow by 600 MB.
    expect(growth, `rss grew ${growth.toFixed(0)} MB (from ${before.toFixed(0)} to ${peak.toFixed(0)})`).toBeLessThan(300)

    // A range from the middle of it is cheap too.
    const mid = await fetch(url, { headers: { range: 'bytes=150000000-150000009' } })
    expect([...await bytes(mid)]).toEqual(Array.from({ length: 10 }, (_, i) => (150000000 + i) % 251))
    s3.objects.delete('big/film.mp4')
  }, 120_000)
})

describe('redirect delivery', () => {
  it('stores the same app path and answers the raw address with a 302 to a signed address that lives five minutes', async () => {
    const m = (await upload(adminRedirect)).body
    expect(m.url).toBe(API + m.key)
    const before = s3.requests.length
    const res = await fetch(redirect.baseURL + m.url, { redirect: 'manual' })
    expect(res.status).toBe(302)
    // The browser may keep it for less than the address lives.
    expect(res.headers.get('cache-control')).toBe('private, max-age=240')
    const location = new URL(res.headers.get('location')!)
    expect(location.origin).toBe(s3.endpoint)
    expect(location.pathname).toBe(`/${s3.bucket}/${m.key}`)
    expect(location.searchParams.get('X-Amz-Expires')).toBe('300')
    expect(location.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
    expect(location.searchParams.get('X-Amz-Credential')).not.toContain(s3.secretAccessKey)
    expect(JSON.stringify([...location.searchParams.keys()])).not.toContain('secret')
    expect(s3.requests.length).toBe(before) // the app did not touch the bucket to answer

    // The address works without credentials, and is what the browser follows.
    const followed = await fetch(location)
    expect(followed.status).toBe(200)
    expect([...await bytes(followed)]).toEqual([...PNG_1x1])
    expect(s3.requests.at(-1)).toMatchObject({ query: true, ok: true })
    // Nothing of it is stored.
    const rows = await pgRows(`select url from cms_media where id = '${m.id}'`)
    expect(rows[0].url).toBe(API + m.key)
  })

  it('names a PDF in the signed address, so the store sends its file name', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.4\n%%EOF\n')
    const m = (await upload(adminRedirect, 'Nabídka.pdf', 'application/pdf', pdf)).body
    const res = await fetch(redirect.baseURL + m.url, { redirect: 'manual' })
    const location = new URL(res.headers.get('location')!)
    expect(location.searchParams.get('response-content-disposition')).toContain("filename*=UTF-8''Nab%C3%ADdka.pdf")
    expect((await fetch(location)).status).toBe(200) // the signature covers it
  })

  it('keeps ranges working through the redirect (the browser repeats its Range header there)', async () => {
    const data = pattern(3000)
    const m = (await upload(adminRedirect, 'clip.mp4', 'video/mp4', data)).body
    const res = await fetch(redirect.baseURL + m.url, { headers: { range: 'bytes=10-19' } }) // follows the redirect
    expect(res.status).toBe(206)
    expect([...await bytes(res)]).toEqual([...data.slice(10, 20)])
  })

  it('still serves pictures sizes and removes files', async () => {
    const m = (await upload(adminRedirect)).body
    expect((await fetch(`${redirect.baseURL}/api/cms/_media/img/${m.id}/320.webp`)).status).toBe(200)
    expect((await adminRedirect.delete(`/api/cms/_media/${m.id}`)).status).toBeLessThan(300)
    expect(s3.objects.has(m.key)).toBe(false)
  })
})

describe('public delivery', () => {
  it('keeps storing the bucket\'s own address, as before', async () => {
    const m = (await upload(adminPublic)).body
    expect(m.url).toBe(`${s3.endpoint}/${s3.bucket}/${m.key}`)
  })

  it('says in the log, once, that the bucket is private', async () => {
    await publicMode.waitForLog(/storage delivery is 'public'.* 403 .*NUXT_CMS_STORAGE_S3_DELIVERY=proxy/)
    await upload(adminPublic)
    await new Promise((r) => setTimeout(r, 300))
    expect(publicMode.logs.join('').match(/storage delivery is 'public'/g)).toHaveLength(1)
  })

  it('still serves the app paths of rows made before a switch (a site that moved from local storage)', async () => {
    const m = (await upload(admin)).body
    const res = await fetch(publicMode.baseURL + API + m.key)
    expect(res.status).toBe(200)
    expect([...await bytes(res)]).toEqual([...PNG_1x1])
  })
})

describe('a bad delivery setting', () => {
  it('fails the first request that needs storage, saying what the choices are', async () => {
    const srv = await startServer(db.url, { ...s3Env(), NUXT_CMS_STORAGE_S3_DELIVERY: 'cdn' })
    try {
      const c = new Client(srv.baseURL)
      c.cookie = admin.cookie
      const res = await upload(c)
      expect(res.status).toBe(500)
      expect(JSON.stringify(res.body)).toContain("'public', 'proxy' or 'redirect'")
    }
    finally { await srv.stop() }
  })
})

async function pgRows(text: string): Promise<any[]> {
  const c = new pg.Client({ connectionString: db.url })
  await c.connect()
  try { return (await c.query(text)).rows }
  finally { await c.end() }
}

async function vi_waitFor(check: () => boolean, timeoutMs = 10_000) {
  const until = Date.now() + timeoutMs
  while (!check()) {
    if (Date.now() > until) throw new Error('condition not met in time')
    await new Promise((r) => setTimeout(r, 50))
  }
}
