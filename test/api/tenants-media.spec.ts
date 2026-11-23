import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Client, PNG_1x1 } from '../helpers/api'
import { expectNoSiteErrors, filesUnder, siteClient, siteQuery, startTenants, type Tenants, type TenantSite, tenantGet, until } from '../helpers/tenants'
import { CMS_IMAGE_WIDTHS } from '../../packages/cms/shared/image-widths'

// Two sites in one process: files. Each site has its own upload folder; the raw route, the
// sized-picture route and the background worker that makes the smaller copies must stay in it.
//
// The hard case: one picture was uploaded to site A BEFORE its database was copied to site
// B. Site B therefore has that picture's row (the same id and the same storage key) and
// answers "yes, this key is one of mine" from its own database, but its folder has no such
// file. Only the storage being rooted per site keeps B from serving A's file.
const sharp = createRequire(join(process.cwd(), 'packages/cms/package.json'))('sharp')
/** A JPEG with noise in it: as costly to decode and encode as a photo. */
const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).jpeg({ quality: 80 }).toBuffer() as Promise<Buffer>

let t: Tenants
let adminA: Client
let adminB: Client
/** The picture both sites have a row for (uploaded to A before the copy). */
let shared: { id: string; key: string; url: string }

beforeAll(async () => {
  t = await startTenants('media', {}, {
    async seed({ admin, query }) {
      const res = await admin.upload('/api/cms/_media', { name: 'shared.jpg', type: 'image/jpeg', data: new Uint8Array(await photo(900, 600)) })
      if (res.status !== 201) throw new Error(`seed upload: ${res.status} ${JSON.stringify(res.body)}`)
      // Its smaller copies are made before the copy of the database: both sites then have the row "done".
      await until('the seeded picture\'s copies', () => query('select state from cms_media_sizes where media_id = $1', [res.body.id]), (r) => r[0]?.state === 'done', 30_000)
    },
  })
  adminA = siteClient(t.a, 'admin')
  adminB = siteClient(t.b, 'admin')
  const [row] = await siteQuery(t.a, 'select id, key from cms_media')
  shared = { id: row.id, key: row.key, url: `/api/cms/_media/raw/${row.key}` }
  expect(await siteQuery(t.b, 'select id, key from cms_media')).toEqual([{ id: row.id, key: row.key }])
}, 120_000)
afterAll(async () => {
  try { expectNoSiteErrors(t) }
  finally { await t?.stop() }
})

const upload = (c: Client, name: string, data: Uint8Array = PNG_1x1, type = 'image/png') => c.upload('/api/cms/_media', { name, type, data })
const jpeg = async (c: Client, name: string, width: number, height: number) => {
  const res = await upload(c, name, new Uint8Array(await photo(width, height)), 'image/jpeg')
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body as { id: string; key: string; url: string }
}
const pathOf = (url: string) => new URL(url, 'http://x').pathname
const status = async (site: TenantSite, path: string) => (await fetch(site.url + path)).status
const variant = (site: TenantSite, key: string, w: number) => join(site.uploadsDir, `_w/${w}/${key}.webp`)
const sizesRow = async (site: TenantSite, id: string) => (await siteQuery(site, 'select state, widths from cms_media_sizes where media_id = $1', [id]))[0]
const sizesDone = (site: TenantSite, id: string) => until(`the smaller copies of ${id}`, () => sizesRow(site, id), (r) => r?.state === 'done' && r.widths === CMS_IMAGE_WIDTHS.join(','), 30_000)
/** The originals in a site's folder (without the smaller copies under _w/). */
const originals = (site: TenantSite) => filesUnder(site.uploadsDir).filter((f) => !f.startsWith('_w/'))

describe('a file belongs to the site it was uploaded to', () => {
  it('is served by its site and is 404 on the other under the same address: the raw route, HEAD and the sized-picture route', async () => {
    const a = await jpeg(adminA, 'on-a.jpg', 700, 400)
    const raw = pathOf(a.url)
    expect(raw).toBe(`/api/cms/_media/raw/${a.key}`)
    expect(await status(t.a, raw)).toBe(200)
    expect(await status(t.b, raw)).toBe(404)
    expect((await fetch(t.a.url + raw, { method: 'HEAD' })).status).toBe(200)
    expect((await fetch(t.b.url + raw, { method: 'HEAD' })).status).toBe(404)
    // A size made on the spot for a visitor of A; on B there is no such picture.
    expect(await status(t.a, `/api/cms/_media/img/${a.id}/480.webp`)).toBe(200)
    expect(await status(t.b, `/api/cms/_media/img/${a.id}/480.webp`)).toBe(404)
    expect(await status(t.b, `/api/cms/_media/raw/_w/480/${a.key}.webp`)).toBe(404)
    // Signed in on B: still not there (the library, the row, its usage).
    expect((await adminB.get(`/api/cms/_media/${a.id}`)).status).toBe(404)
    expect((await adminB.get(`/api/cms/_media/${a.id}/usage`)).status).toBe(404)
    expect(JSON.stringify((await adminB.get('/api/cms/_media')).body)).not.toContain(a.id)
    expect(JSON.stringify((await adminA.get('/api/cms/_media')).body)).toContain(a.id)
    // Asked again on B right after A served it (B must not have learnt the key from A).
    expect(await status(t.a, raw)).toBe(200)
    expect(await status(t.b, raw)).toBe(404)
  })

  it('a picture whose row both sites have is served only where its file is', async () => {
    // B's database says "this key is mine" (the row was copied); B's folder has no such file.
    expect(await status(t.a, shared.url)).toBe(200)
    expect(await status(t.b, shared.url)).toBe(404)
    expect(await status(t.a, `/api/cms/_media/img/${shared.id}/640.webp`)).toBe(200)
    expect(await status(t.b, `/api/cms/_media/img/${shared.id}/640.webp`)).toBe(404)
    // Asked in turn inside the minute each site remembers "is this key mine".
    for (let i = 0; i < 3; i++) {
      expect(await status(t.b, shared.url)).toBe(404)
      expect(await status(t.a, shared.url)).toBe(200)
    }
    expect(existsSync(join(t.a.uploadsDir, shared.key))).toBe(true)
    expect(existsSync(join(t.b.uploadsDir, shared.key))).toBe(false)
  })

  it('the same key cannot be reached on the other site by a path that leaves the folder', async () => {
    const up = `/api/cms/_media/raw/..%2F${t.a.uploadsDir.split('/').pop()}%2F${shared.key.replaceAll('/', '%2F')}`
    expect(await status(t.b, up)).toBeGreaterThanOrEqual(400)
    expect(await status(t.b, `/api/cms/_media/raw/${encodeURIComponent(join(t.a.uploadsDir, shared.key))}`)).toBeGreaterThanOrEqual(400)
  })

  it('each site\'s folder holds its own uploads only', async () => {
    const a = (await upload(adminA, 'folder-a.png')).body
    const b = (await upload(adminB, 'folder-b.png')).body
    const keysOf = async (site: TenantSite) => (await siteQuery(site, 'select key from cms_media')).map((r) => r.key).sort()
    const inA = originals(t.a)
    const inB = originals(t.b)
    expect(inA).toContain(a.key)
    expect(inA).not.toContain(b.key)
    expect(inB).toContain(b.key)
    expect(inB).not.toContain(a.key)
    // Every original in A's folder is a row of A's database, and nothing else is there.
    expect(inA).toEqual(await keysOf(t.a))
    // B's folder holds B's uploads; the copied row's file was never there.
    expect(inB).toEqual((await keysOf(t.b)).filter((k) => k !== shared.key))
    expect(await status(t.a, pathOf(a.url))).toBe(200)
    expect(await status(t.b, pathOf(b.url))).toBe(200)
    expect(await status(t.a, pathOf(b.url))).toBe(404)
  })
})

describe('the smaller copies of a picture', () => {
  it('are made in the background in the folder of the site that got the upload, and recorded in its database', async () => {
    const m = await jpeg(adminA, 'big-a.jpg', 1000, 600)
    await sizesDone(t.a, m.id)
    const below = CMS_IMAGE_WIDTHS.filter((w) => w < 1000)
    for (const w of below) {
      expect(existsSync(variant(t.a, m.key, w)), `A ${w} px`).toBe(true)
      expect(existsSync(variant(t.b, m.key, w)), `B ${w} px`).toBe(false)
    }
    expect(await sizesRow(t.b, m.id)).toBeUndefined()
    expect(filesUnder(t.b.uploadsDir).filter((f) => f.includes(m.key))).toEqual([])
  })

  it('pictures uploaded to both sites at the same moment: the one queue makes each copy in its own site', async () => {
    // The picture queue is one for the process and starts each job from the end of the one
    // before: a job that ran in the site of its predecessor would write into the wrong folder.
    const names = ['q1', 'q2', 'q3']
    const [inA, inB] = await Promise.all([
      Promise.all(names.map((n) => jpeg(adminA, `${n}-a.jpg`, 900, 500))),
      Promise.all(names.map((n) => jpeg(adminB, `${n}-b.jpg`, 900, 500))),
    ])
    await Promise.all([...inA.map((m) => sizesDone(t.a, m.id)), ...inB.map((m) => sizesDone(t.b, m.id))])
    const below = CMS_IMAGE_WIDTHS.filter((w) => w < 900)
    for (const m of inA) for (const w of below) {
      expect(existsSync(variant(t.a, m.key, w)), `A's ${m.key} at ${w}`).toBe(true)
      expect(existsSync(variant(t.b, m.key, w)), `A's ${m.key} at ${w} in B's folder`).toBe(false)
    }
    for (const m of inB) for (const w of below) {
      expect(existsSync(variant(t.b, m.key, w)), `B's ${m.key} at ${w}`).toBe(true)
      expect(existsSync(variant(t.a, m.key, w)), `B's ${m.key} at ${w} in A's folder`).toBe(false)
    }
    // Each site's rows are its own.
    const ids = async (site: TenantSite) => (await siteQuery(site, 'select media_id from cms_media_sizes')).map((r) => r.media_id)
    for (const m of inA) expect(await ids(t.b)).not.toContain(m.id)
    for (const m of inB) expect(await ids(t.a)).not.toContain(m.id)
  }, 60_000)

  it('visitors of both sites asking for sizes at once each get their own picture', async () => {
    const a = await jpeg(adminA, 'ask-a.jpg', 800, 400)
    const b = await jpeg(adminB, 'ask-b.jpg', 800, 800)
    const ask = (site: TenantSite, id: string, w: number) => fetch(`${site.url}/api/cms/_media/img/${id}/${w}.webp`).then(async (r) => ({ status: r.status, body: Buffer.from(await r.arrayBuffer()) }))
    const answers = await Promise.all([ask(t.a, a.id, 320), ask(t.b, b.id, 320), ask(t.a, a.id, 480), ask(t.b, b.id, 480), ask(t.b, a.id, 320), ask(t.a, b.id, 320)])
    expect(answers.map((r) => r.status)).toEqual([200, 200, 200, 200, 404, 404])
    const shape = async (buf: Buffer) => { const meta = await sharp(buf).metadata(); return [meta.width, meta.height] }
    expect(await shape(answers[0]!.body)).toEqual([320, 160]) // A's is twice as wide as high
    expect(await shape(answers[1]!.body)).toEqual([320, 320]) // B's is square
    expect(await shape(answers[2]!.body)).toEqual([480, 240])
    expect(await shape(answers[3]!.body)).toEqual([480, 480])
  })

  it('the copied row on B, whose file B never had, does not make B\'s worker reach into A\'s folder', async () => {
    await sizesDone(t.a, shared.id)
    // As B has it after the copy, but with its sizes still to make: B's worker takes the row,
    // looks for the original in B's own folder and does not find it. (An upload starts the worker.)
    await siteQuery(t.b, 'delete from cms_media_sizes where media_id = $1', [shared.id])
    const kick = await jpeg(adminB, 'kick-b.jpg', 400, 300)
    await sizesDone(t.b, kick.id)
    // The row is back, so B's worker did take the picture. (A picture whose original is missing has nothing to make: its row ends "done", as on a single site.)
    await until('B\'s worker to have dealt with the copied row', () => sizesRow(t.b, shared.id), (r) => !!r && (r.state === 'failed' || r.state === 'done'), 30_000)
    expect(filesUnder(t.b.uploadsDir).filter((f) => f.includes(shared.key))).toEqual([])
    // A's copies of it are A's alone, and still all there.
    for (const w of CMS_IMAGE_WIDTHS.filter((w) => w < 900)) expect(existsSync(variant(t.a, shared.key, w)), `A ${w} px`).toBe(true)
    expect((await sizesRow(t.a, shared.id)).state).toBe('done')
  }, 60_000)
})

describe('deleting', () => {
  it('deleting on B the row both sites have removes B\'s row and leaves A\'s file, its copies and its row', async () => {
    await sizesDone(t.a, shared.id)
    const before = filesUnder(t.a.uploadsDir).filter((f) => f.includes(shared.key))
    expect(before.length).toBeGreaterThan(3)
    expect((await adminB.delete(`/api/cms/_media/${shared.id}`)).status).toBeLessThan(300)
    expect(await siteQuery(t.b, 'select 1 from cms_media where id = $1', [shared.id])).toEqual([])
    // A: the row, the file and every smaller copy are where they were, and still served.
    expect(await siteQuery(t.a, 'select 1 from cms_media where id = $1', [shared.id])).toHaveLength(1)
    expect(filesUnder(t.a.uploadsDir).filter((f) => f.includes(shared.key))).toEqual(before)
    expect(await status(t.a, shared.url)).toBe(200)
    expect(await status(t.a, `/api/cms/_media/img/${shared.id}/480.webp`)).toBe(200)
    expect((await sizesRow(t.a, shared.id)).state).toBe('done')
  }, 60_000)

  it('a file of A cannot be deleted from B by its id, and A\'s own delete removes it from A\'s folder only', async () => {
    const a = (await upload(adminA, 'gone-a.png')).body
    const b = (await upload(adminB, 'stays-b.png')).body
    expect((await adminB.delete(`/api/cms/_media/${a.id}`)).status).toBe(404)
    expect(existsSync(join(t.a.uploadsDir, a.key))).toBe(true)
    expect((await adminA.delete(`/api/cms/_media/${a.id}`)).status).toBeLessThan(300)
    expect(existsSync(join(t.a.uploadsDir, a.key))).toBe(false)
    expect(existsSync(join(t.b.uploadsDir, b.key))).toBe(true)
    expect(await status(t.b, pathOf(b.url))).toBe(200)
  })

  it('the status of each site counts its own pictures', async () => {
    const of = async (site: TenantSite) => (await tenantGet(site.url, '/api/health/status', '', { 'x-api-key': site.statusToken })).body
    const [a, b] = [await of(t.a), await of(t.b)]
    const count = async (site: TenantSite) => (await siteQuery(site, 'select count(*)::int as n from cms_media'))[0].n
    expect(a.media.files).toBe(await count(t.a))
    expect(b.media.files).toBe(await count(t.b))
    expect(a.site.publicUrl).toBe(t.a.url)
    expect(b.site.publicUrl).toBe(t.b.url)
  })
})
