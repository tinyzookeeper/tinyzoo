import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, signIn, testDb, truncateAll } from '../helpers/api'

const db = testDb()
let admin: Client

beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

describe('globals (singletons)', () => {
  it('starts empty, creates on first save and updates the same row afterwards', async () => {
    expect((await admin.get('/api/cms/_singleton/siteSettings')).body.row).toBeNull()

    const first = await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'My site' })
    expect(first.status).toBe(200)
    const second = await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Renamed', tagline: 'Hi' })
    expect(second.body.row.id).toBe(first.body.row.id)

    const { rows } = await db.query('select site_name, tagline from "siteSettings"')
    expect(rows).toEqual([{ site_name: 'Renamed', tagline: 'Hi' }])
  })

  it('validates like any other write', async () => {
    expect((await admin.put('/api/cms/_singleton/siteSettings', { tagline: 'no name' })).status).toBe(422)
  })

  it('cannot be written through the collection routes (keeps it a single row)', async () => {
    expect((await admin.post('/api/cms/siteSettings', { siteName: 'Second' })).status).toBe(404)
    const created = (await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Only' })).body.row
    expect((await admin.patch(`/api/cms/siteSettings/${created.id}`, { siteName: 'x' })).status).toBe(404)
    expect((await admin.delete(`/api/cms/siteSettings/${created.id}`)).status).toBe(404)
  })

  it('answers 404 for a collection on the global routes', async () => {
    expect((await admin.get('/api/cms/_singleton/post')).status).toBe(404)
    expect((await anonymous().get('/api/content/_global/post')).status).toBe(404)
  })

  it('is delivered publicly as one object', async () => {
    expect((await anonymous().get('/api/content/_global/siteSettings')).body.item).toBeNull()
    await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'My site' })
    const res = await anonymous().get('/api/content/_global/siteSettings')
    expect(res.body.item).toMatchObject({ siteName: 'My site', tagline: null, logo: null })
  })

  it('requires sign-in to edit', async () => {
    expect((await anonymous().put('/api/cms/_singleton/siteSettings', { siteName: 'x' })).status).toBe(401)
  })
})
