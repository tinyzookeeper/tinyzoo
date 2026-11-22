import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { Client, signIn, testDb, truncateAll } from '../helpers/api'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'
import { STATUS_TOKEN } from '../setup/server'
import { CMS_IMAGE_WIDTHS } from '../../packages/cms/shared/image-widths'

// The smaller copies of pictures are made after the upload, in the background, one picture at
// a time (server/utils/cmsImageSizes.ts, cmsImageQueue.ts): no visitor waits for a resize, and a
// page of new photos never decodes them all at once — which is what took a 256 MB site down.
const sharp = createRequire(join(process.cwd(), 'packages/cms/package.json'))('sharp')
const db = testDb()
let admin: Client
const blob = (key: string) => join(inject('uploadsDir'), key)
const variant = (key: string, w: number) => blob(`_w/${w}/${key}.webp`)

/** A JPEG of `width` × `height` with noise in it: as costly to decode and encode as a photo. */
const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).jpeg({ quality: 80 }).toBuffer() as Promise<Buffer>

async function waitFor<T>(what: string, check: () => Promise<T | undefined | false> | T | undefined | false, timeoutMs = 30_000): Promise<T> {
  const until = Date.now() + timeoutMs
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() > until) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 100))
  }
}

const sizesRow = async (id: string) => (await db.query('select state, widths, attempts from cms_media_sizes where media_id = $1', [id])).rows[0]

describe('smaller copies made after the upload', () => {
  beforeAll(async () => { admin = await signIn('admin') })
  beforeEach(() => truncateAll(db))
  afterAll(() => db.end())

  it('makes every width smaller than the picture in the background, and records it', async () => {
    const m = (await admin.upload('/api/cms/_media', { name: 'big.jpg', type: 'image/jpeg', data: new Uint8Array(await photo(1000, 600)) })).body
    const below = CMS_IMAGE_WIDTHS.filter((w) => w < 1000)
    await waitFor('the copies', async () => (await sizesRow(m.id))?.state === 'done')
    for (const w of below) expect(existsSync(variant(m.key, w)), `${w} px`).toBe(true)
    // None at the picture's own width or above: the original is the largest candidate.
    for (const w of CMS_IMAGE_WIDTHS.filter((w) => w >= 1000)) expect(existsSync(variant(m.key, w)), `${w} px`).toBe(false)
    expect((await sizesRow(m.id)).widths).toBe(CMS_IMAGE_WIDTHS.join(','))
    const meta = await sharp(variant(m.key, 480)).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 480, 288])
  })

  it('catches up a picture uploaded before copies were made at upload, starting from a visitor asking for one', async () => {
    const m = (await admin.upload('/api/cms/_media', { name: 'old.jpg', type: 'image/jpeg', data: new Uint8Array(await photo(900, 600)) })).body
    await waitFor('the copies', async () => (await sizesRow(m.id))?.state === 'done')
    // As a site from before 1.10 has it: no row, no copies.
    await db.query('delete from cms_media_sizes where media_id = $1', [m.id])
    rmSync(blob(`_w`), { recursive: true, force: true })
    const res = await fetch(`${admin.baseURL}/api/cms/_media/img/${m.id}/640.webp`)
    expect(res.status).toBe(200) // made on the spot
    await waitFor('the other copies', async () => (await sizesRow(m.id))?.state === 'done')
    for (const w of CMS_IMAGE_WIDTHS.filter((w) => w < 900)) expect(existsSync(variant(m.key, w)), `${w} px`).toBe(true)
  })

  it('makes only the widths added since, keeping the ones a picture has', async () => {
    const m = (await admin.upload('/api/cms/_media', { name: 'a.jpg', type: 'image/jpeg', data: new Uint8Array(await photo(1000, 500)) })).body
    await waitFor('the copies', async () => (await sizesRow(m.id))?.state === 'done')
    // As if it was done when the list was 1.0's: 480, 750 and 828 are new since.
    await db.query(`update cms_media_sizes set widths = '320,640,960,1280,1920' where media_id = $1`, [m.id])
    for (const w of [480, 750, 828]) rmSync(variant(m.key, w))
    const before = statSync(variant(m.key, 640)).mtimeMs
    // A visitor asks for one of them: made on the spot, and the worker started for the rest.
    expect((await fetch(`${admin.baseURL}/api/cms/_media/img/${m.id}/480.webp`)).status).toBe(200)
    await waitFor('the new widths', async () => (await sizesRow(m.id))?.widths === CMS_IMAGE_WIDTHS.join(','))
    for (const w of [480, 750, 828]) expect(existsSync(variant(m.key, w)), `${w} px`).toBe(true)
    expect(statSync(variant(m.key, 640)).mtimeMs).toBe(before) // not made again
  })

  it('leaves no copy behind when the picture is deleted while its copies are being made', async () => {
    const m = (await admin.upload('/api/cms/_media', { name: 'gone.jpg', type: 'image/jpeg', data: new Uint8Array(await photo(3000, 2000)) })).body
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBeLessThan(300)
    await new Promise((r) => setTimeout(r, 1500))
    for (const w of CMS_IMAGE_WIDTHS) expect(existsSync(variant(m.key, w)), `${w} px`).toBe(false)
    expect(await sizesRow(m.id)).toBeUndefined()
  })

  it('says in the status how many pictures have their copies', async () => {
    const m = (await admin.upload('/api/cms/_media', { name: 's.jpg', type: 'image/jpeg', data: new Uint8Array(await photo(700, 400)) })).body
    await waitFor('the copies', async () => (await sizesRow(m.id))?.state === 'done')
    const status = await (await fetch(`${admin.baseURL}/api/health/status`, { headers: { 'x-api-key': STATUS_TOKEN } })).json()
    expect(status.media.sizes).toEqual({ done: 1, waiting: 0, failed: 0 })
    // and the memory of the instance that answered
    expect(status.instance.memory.rss).toBeGreaterThan(10 * 1024 * 1024)
  })
})

// ── memory ───────────────────────────────────────────────────────────────────────────

const rssMb = (pid: number) => Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim()) / 1024

describe('memory: a page full of new photos', () => {
  const SETUP = 'sizes-setup'
  let scratch: Awaited<ReturnType<typeof scratchDatabase>>
  let server: SpawnedServer
  let client: Client

  beforeAll(async () => {
    scratch = await scratchDatabase('sizes')
    server = await startServer(scratch.url, { NUXT_CMS_AUTH_SETUP_TOKEN: SETUP, NUXT_CMS_STORAGE_UPLOAD_RATE_PER_MIN: '1000' })
    client = new Client(server.baseURL)
    expect((await client.post('/api/cms/_auth/setup', { name: 'Ada', email: 'ada@example.com', password: 'correct horse battery', token: SETUP })).status).toBe(201)
  }, 120_000)

  afterAll(async () => {
    await server?.stop()
    await scratch?.drop()
  })

  it('stays within what one picture costs while a dozen 12-megapixel photos are uploaded and all their sizes asked for at once', async () => {
    const data = await photo(4000, 3000)
    await new Promise((r) => setTimeout(r, 500))
    const before = rssMb(server.pid)
    let peak = before
    const sampler = setInterval(() => { peak = Math.max(peak, rssMb(server.pid)) }, 25)
    try {
      // Twelve different files (one pixel changed), as a gallery upload is.
      const ids: string[] = []
      for (let i = 0; i < 12; i++) {
        const copy = Buffer.from(data)
        copy[copy.length - 3] = i
        const res = await client.upload('/api/cms/_media', { name: `p${i}.jpg`, type: 'image/jpeg', data: new Uint8Array(copy) })
        expect(res.status).toBe(201)
        ids.push(res.body.id)
      }
      // A page that shows them all, on a phone and on a big screen, before any copy exists.
      const urls = ids.flatMap((id) => [640, 1280, 1920].map((w) => `${server.baseURL}/api/cms/_media/img/${id}/${w}.webp`))
      const answers = await Promise.all(urls.map((u) => fetch(u).then((r) => r.status)))
      expect(answers.every((s) => s === 200)).toBe(true)
    }
    finally { clearInterval(sampler) }
    // The copies of the uploads are made meanwhile too (the background lane), as on a real site.
    for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 500)); peak = Math.max(peak, rssMb(server.pid)) }
    const growth = peak - before
    // One 12-megapixel photo decoded is 36 MB of pixels. Resized side by side (tinyzoo 1.9), this
    // grew the server by about 450 MB; in turns, about 190 MB, most of which is the allocator
    // keeping what it freed (a plain loop of the same resizes, one at a time, grows as much
    // before it levels off).
    expect(growth, `rss grew ${growth.toFixed(0)} MB`).toBeLessThan(300)
  }, 240_000)
})
