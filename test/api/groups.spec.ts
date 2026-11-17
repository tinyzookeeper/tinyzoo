import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

const db = testDb()
let admin: Client
beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const upload = async () => (await admin.upload('/api/cms/_media', { name: 'p.png', type: 'image/png', data: PNG_1x1 })).body
const mediaExists = async (id: string) => (await db.query('select 1 from cms_media where id = $1', [id])).rowCount === 1
const media = (m: any) => ({ id: m.id, url: m.url, width: 1, height: 1, alt: null, mime: 'image/png', focal: null })
const settings = (body: Record<string, unknown>) => admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Sokolovna', ...body })
const publicSettings = async (query = '') => (await anonymous().get(`/api/content/_global/siteSettings${query}`)).body.item

describe('a group on a global', () => {
  it('stores the whole object in one column and returns it with every field, nulls included', async () => {
    const res = await settings({ contact: { phone: '+420 123', address: { street: 'Dlouhá 1', city: 'Tábor' } } })
    expect(res.status).toBe(200)
    expect(res.body.row.contact).toEqual({ phone: '+420 123', address: { street: 'Dlouhá 1', city: 'Tábor' } })
    const stored = (await db.query('select contact from site_settings')).rows[0].contact
    expect(stored).toEqual({ phone: '+420 123', address: { street: 'Dlouhá 1', city: 'Tábor' } })
    expect((await publicSettings()).contact).toEqual({
      phone: '+420 123', email: null, photo: null,
      address: { street: 'Dlouhá 1', city: 'Tábor', zip: null },
    })
    // The admin gets it back as stored, to put into the form.
    expect((await admin.get('/api/cms/_singleton/siteSettings')).body.row.contact).toEqual(stored)
  })

  it('checks each field and points the error at it', async () => {
    const missing = await settings({ contact: { address: { street: 'Dlouhá 1', city: '' } } })
    expect(missing.status).toBe(422)
    expect(missing.body.data[0].path).toEqual(['contact', 'address', 'city'])
    const email = await settings({ contact: { email: 'not-an-email', address: { street: 's', city: 'c' } } })
    expect(email.status).toBe(422)
    expect(email.body.data[0].path).toEqual(['contact', 'email'])
    expect((await settings({ contact: 'Tábor' })).status).toBe(422)
    expect((await settings({ contact: { address: { street: 's', city: 'c' }, photo: 'nope' } })).status).toBe(422)
  })

  it('may be left out or emptied when optional', async () => {
    expect((await settings({})).status).toBe(200)
    expect((await publicSettings()).contact).toBeNull()
    await settings({ contact: { address: { street: 'a', city: 'b' } } })
    expect((await settings({ contact: null })).status).toBe(200)
    expect((await publicSettings()).contact).toBeNull()
  })

  it('resolves media inside the group, and keeps the file only while the group uses it', async () => {
    const m = await upload()
    await settings({ contact: { address: { street: 'a', city: 'b' }, photo: m.id } })
    expect((await publicSettings()).contact.photo).toEqual(media(m))
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBe(409)
    await settings({ contact: { address: { street: 'a', city: 'b' } } })
    expect(await mediaExists(m.id)).toBe(false)
  })

  it('drops keys the group does not have', async () => {
    const res = await settings({ contact: { address: { street: 'a', city: 'b', country: 'CZ' }, fax: '1' } })
    expect(res.body.row.contact).toEqual({ address: { street: 'a', city: 'b' } })
  })
})

describe('a translated group', () => {
  const location = (place: string, note?: string) => ({ place, ...(note ? { note } : {}) })
  const en = (id: string, body: Record<string, unknown>) => admin.request('PATCH', `/api/cms/post/${id}?locale=en`, { json: body })

  it('has its own whole group per language, falling back to the default language', async () => {
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id, status: 'published', location: location('Sokolovna', 'vchod z ulice') })
    expect(post.location).toEqual(location('Sokolovna', 'vchod z ulice'))
    expect((await anonymous().get(`/api/content/post/${post.slug}`)).body.item.location).toEqual({ place: 'Sokolovna', note: 'vchod z ulice' })
    // Untranslated: the default language's group.
    expect((await anonymous().get(`/api/content/post/${post.slug}?locale=en`)).body.item.location).toEqual({ place: 'Sokolovna', note: 'vchod z ulice' })

    // `status: null`: this first translation of a live post follows it (posts publish each language on their own; otherwise it is being translated).
    expect((await en(post.id, { location: location('Gym'), status: null })).status).toBe(200)
    const trans = (await admin.request('GET', `/api/cms/post/${post.id}?locale=en`)).body.row
    expect(trans.location).toEqual({ place: 'Gym' })
    expect(trans.__defaults.location).toEqual(location('Sokolovna', 'vchod z ulice'))
    expect((await anonymous().get(`/api/content/post/${post.slug}?locale=en`)).body.item.location).toEqual({ place: 'Gym', note: null })
    expect((await anonymous().get(`/api/content/post/${post.slug}`)).body.item.location).toEqual({ place: 'Sokolovna', note: 'vchod z ulice' })
  })

  it('checks the translated group too, and an emptied one falls back', async () => {
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id, status: 'published', location: location('Sokolovna') })
    const bad = await en(post.id, { location: { place: '' } })
    expect(bad.status).toBe(422)
    expect(bad.body.data[0].path).toEqual(['location', 'place'])
    await en(post.id, { location: location('Gym') })
    expect((await en(post.id, { location: null })).status).toBe(200)
    expect((await anonymous().get(`/api/content/post/${post.slug}?locale=en`)).body.item.location).toEqual({ place: 'Sokolovna', note: null })
  })

  it('is found by the website search, in the language it is written in', async () => {
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id, status: 'published', location: location('Sokolovna Tábor') })
    await en(post.id, { location: location('Gymnasium Tabor') })
    const cs = (await anonymous().get('/api/content/_search?q=sokolovna')).body
    expect(cs.items.map((i: any) => i.id)).toEqual([post.id])
    expect((await anonymous().get('/api/content/_search?q=gymnasium&locale=en')).body.total).toBe(1)
    expect((await anonymous().get('/api/content/_search?q=gymnasium')).body.total).toBe(0)
  })
})

describe('a group inside a block', () => {
  const contact = (address: Record<string, unknown>) => [{ id: 'c1', type: 'contact', heading: 'Kde nás najdete', address }]
  const page = async (sections: unknown[]) => {
    const res = await admin.post('/api/cms/page', { title: 'Kontakt', slug: `kontakt-${Date.now()}`, status: 'published', sections })
    if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`)
    return res.body.row
  }

  it('is stored in the block, returned as an object with media resolved, and checked field by field', async () => {
    const m = await upload()
    const p = await page(contact({ street: 'Dlouhá 1', photo: m.id }))
    const item = (await anonymous().get(`/api/content/page/${p.slug}`)).body.item
    expect(item.sections).toEqual([{ id: 'c1', type: 'contact', heading: 'Kde nás najdete', address: { street: 'Dlouhá 1', city: null, photo: media(m) } }])

    const bad = await admin.post('/api/cms/page', { title: 'X', slug: 'x', sections: contact({ street: '' }) })
    expect(bad.status).toBe(422)
    expect(bad.body.data[0].path).toEqual(['sections', 0, 'address', 'street'])
  })

  it('keeps its media while the block uses it, and cleans up when the block goes', async () => {
    const m = await upload()
    const p = await page(contact({ street: 'a', photo: m.id }))
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBe(409)
    await admin.patch(`/api/cms/page/${p.id}`, { sections: [] })
    expect(await mediaExists(m.id)).toBe(false)
  })
})
