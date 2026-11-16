import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { anonymous, type Client, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'

// What the media routes accept and what they serve: only what the CMS itself stored,
// pictures within the pixel limit, files that look like what they claim to be.
const db = testDb()
let admin: Client
const raw = (path: string) => fetch(inject('baseURL') + '/api/cms/_media/raw/' + path)
const upload = (c: Client, name: string, type: string, data: Uint8Array) => c.upload('/api/cms/_media', { name, type, data })

/** A PNG that only claims its size: a valid signature and IHDR, nothing to decode. */
function pngClaiming(width: number, height: number): Uint8Array {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const chunk = Buffer.concat([Buffer.from([0, 0, 0, 13]), Buffer.from('IHDR'), ihdr, Buffer.alloc(4)])
  return Uint8Array.from(Buffer.concat([PNG_1x1.subarray(0, 8), chunk, Buffer.alloc(64)]))
}
const PDF = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const MP4 = Uint8Array.from([0, 0, 0, 24, ...Buffer.from('ftypisom'), 0, 0, 2, 0, ...Buffer.from('isomiso2')])
const WEBM = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, ...Buffer.from('webm')])
const MP3 = Uint8Array.from([...Buffer.from('ID3'), 3, 0, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x00])

beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

describe('what the raw route serves', () => {
  it('serves a file the CMS stored, and refuses one that merely sits in the same folder', async () => {
    const m = (await upload(admin, 'a.png', 'image/png', PNG_1x1)).body
    expect((await raw(m.key)).status).toBe(200)
    // Another tool's object in the shared bucket / folder: no media row, no answer.
    const stray = join(inject('uploadsDir'), 'other-tool/secret.png')
    mkdirSync(dirname(stray), { recursive: true })
    writeFileSync(stray, PNG_1x1)
    expect((await raw('other-tool/secret.png')).status).toBe(404)
    expect((await raw('2026/01/00000000-0000-4000-8000-000000000000.png')).status).toBe(404)
  })

  it('serves the resized copies of a stored picture, not those of an unknown one', async () => {
    const m = (await upload(admin, 'a.png', 'image/png', PNG_1x1)).body
    expect((await fetch(`${inject('baseURL')}/api/cms/_media/img/${m.id}/320.webp`)).status).toBe(200)
    const copy = await raw(`_w/320/${m.key}.webp`)
    expect(copy.status).toBe(200)
    expect(copy.headers.get('content-type')).toBe('image/webp')
    // A key shaped like a copy, but of nothing we stored.
    const stray = join(inject('uploadsDir'), '_w/320/other-tool/x.png.webp')
    mkdirSync(dirname(stray), { recursive: true })
    writeFileSync(stray, PNG_1x1)
    expect((await raw('_w/320/other-tool/x.png.webp')).status).toBe(404)
    expect((await raw(`_w/333/${m.key}.webp`)).status).toBe(404) // not one of the sizes
  })

  it('stops serving a file once it is deleted', async () => {
    const m = (await upload(admin, 'a.png', 'image/png', PNG_1x1)).body
    expect((await raw(m.key)).status).toBe(200)
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBeLessThan(300)
    expect((await raw(m.key)).status).toBe(404)
  })

  it('names a PDF by its file name, and leaves other files inline', async () => {
    const pdf = (await upload(admin, 'Zpráva č. 3 (final).pdf', 'application/pdf', PDF)).body
    const disposition = (await raw(pdf.key)).headers.get('content-disposition')!
    expect(disposition).toMatch(/^inline; filename="Zprava c\. 3 \(final\)\.pdf"; filename\*=UTF-8''/)
    expect(decodeURIComponent(disposition.split("filename*=UTF-8''")[1]!)).toBe('Zpráva č. 3 (final).pdf')
    const png = (await upload(admin, 'a.png', 'image/png', PNG_1x1)).body
    expect((await raw(png.key)).headers.get('content-disposition')).toBe('inline')
  })
})

describe('pictures over the pixel limit', () => {
  it('refuses a 12000 × 12000 picture at upload and says the limit; 8000 × 8000 is fine', async () => {
    const big = await upload(admin, 'huge.png', 'image/png', pngClaiming(12000, 12000))
    expect(big.status).toBe(422)
    expect(big.body.data).toMatchObject({ code: 'image_too_many_pixels', maxMegapixels: 80 })
    expect(big.body.statusMessage).toMatch(/80 megapixels/)
    expect((await db.query('select 1 from cms_media')).rowCount).toBe(0)
    expect((await upload(admin, 'ok.png', 'image/png', pngClaiming(8000, 8000))).status).toBe(201)
  })

  it('sends the original for a resize request of a picture that is already stored over the limit, instead of failing', async () => {
    const data = pngClaiming(12000, 12000)
    const key = '2026/01/11111111-1111-4111-8111-111111111111.png'
    const file = join(inject('uploadsDir'), key)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, data)
    const { rows } = await db.query(
      `insert into cms_media (url, key, mime, size, width, height) values ($1, $2, 'image/png', $3, 12000, 12000) returning id`,
      ['/api/cms/_media/raw/' + key, key, data.length],
    )
    const res = await fetch(`${inject('baseURL')}/api/cms/_media/img/${rows[0].id}/640.webp`, { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/api/cms/_media/raw/' + key)
    // A picture that lies about its size in the database is caught by the decoder too.
    const { rows: liar } = await db.query(
      `insert into cms_media (url, key, mime, size, width, height) values ($1, $2, 'image/png', $3, 100, 100) returning id`,
      ['/api/cms/_media/raw/' + key, key, data.length],
    )
    const res2 = await fetch(`${inject('baseURL')}/api/cms/_media/img/${liar[0].id}/640.webp`, { redirect: 'manual' })
    expect(res2.status).toBe(302)
  })
})

describe('files must look like what they say', () => {
  it.each([
    ['application/pdf', 'x.pdf', PDF],
    ['video/mp4', 'x.mp4', MP4],
    ['video/webm', 'x.webm', WEBM],
    ['audio/mpeg', 'x.mp3', MP3],
  ])('accepts a real %s', async (type, name, data) => {
    expect((await upload(admin, name, type, data)).status).toBe(201)
  })

  it.each([
    ['application/pdf', 'x.pdf'],
    ['video/mp4', 'x.mp4'],
    ['video/webm', 'x.webm'],
    ['audio/mpeg', 'x.mp3'],
  ])('refuses random bytes called %s with 415', async (type, name) => {
    const junk = new TextEncoder().encode('this is not a media file, just a sentence of text that is long enough')
    const res = await upload(admin, name, type, junk)
    expect(res.status).toBe(415)
    expect((await db.query('select 1 from cms_media')).rowCount).toBe(0)
  })

  it('still needs a signed-in user', async () => {
    expect((await upload(anonymous(), 'x.pdf', 'application/pdf', PDF)).status).toBe(401)
  })
})

describe("a field's accept is enforced by the server", () => {
  it('refuses a video in a picture field, a picture in a PDF field and a PDF in a gallery; takes the right types', async () => {
    const { createAuthor, createPost } = await import('../helpers/fixtures')
    const video = (await upload(admin, 'x.mp4', 'video/mp4', MP4)).body
    const picture = (await upload(admin, 'a.png', 'image/png', PNG_1x1)).body
    const pdf = (await upload(admin, 'x.pdf', 'application/pdf', PDF)).body
    const author = await createAuthor(admin)

    const base = { title: 'Accept', slug: 'accept', author: author.id, body: { type: 'doc', content: [] } }
    const bad = await admin.post('/api/cms/post', { ...base, hero: video.id })
    expect(bad.status).toBe(422)
    expect(bad.body.data[0]).toMatchObject({ path: ['hero'], message: expect.stringContaining('image/*') })
    expect((await admin.post('/api/cms/post', { ...base, gallery: [{ mediaId: picture.id }, { mediaId: pdf.id }] })).status).toBe(422)

    const post = await createPost(admin, { author: author.id, hero: picture.id, gallery: [{ mediaId: picture.id }] })
    expect((await admin.patch(`/api/cms/post/${post.id}`, { hero: video.id })).status).toBe(422)
    expect((await admin.patch(`/api/cms/post/${post.id}`, { hero: null })).status).toBe(200)

    expect((await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Web', rules: picture.id })).status).toBe(422)
    expect((await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Web', rules: pdf.id })).status).toBe(200)
  })
})
