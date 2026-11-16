import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, doc, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'

const db = testDb()
let admin: Client
beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const upload = async () => (await admin.upload('/api/cms/_media', { name: 'p.png', type: 'image/png', data: PNG_1x1 })).body
const mediaExists = async (id: string) => (await db.query('select 1 from cms_media where id = $1', [id])).rowCount === 1
async function page(sections: unknown[], over: Record<string, unknown> = {}) {
  const res = await admin.post('/api/cms/page', { title: 'Domů', slug: `home-${Date.now()}`, status: 'published', sections, ...over })
  if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`)
  return res.body.row
}

describe('blocks through the admin API', () => {
  it('stores ordered blocks and defaults to an empty list', async () => {
    const empty = await page([], { sections: undefined })
    expect(empty.sections).toEqual([])
    const p = await page([{ id: 'b1', type: 'text', heading: 'O nás' }, { id: 'b2', type: 'cta', text: 'Objednejte' }])
    expect(p.sections.map((b: any) => b.type)).toEqual(['text', 'cta'])
  })

  it('points a validation error at the block and field', async () => {
    const res = await admin.post('/api/cms/page', { title: 'X', slug: 'x', sections: [{ id: 'h', type: 'hero', heading: '' }] })
    expect(res.status).toBe(422)
    expect(res.body.data[0].path).toEqual(['sections', 0, 'heading'])
  })
})

describe('blocks on the public content API', () => {
  it('resolves media inside blocks and returns every field of the block type', async () => {
    const m = await upload()
    const p = await page([{ id: 'h', type: 'hero', heading: 'Vítejte', image: m.id }, { id: 't', type: 'text', body: doc('Ahoj') }])
    const item = (await anonymous().get(`/api/content/page/${p.slug}`)).body.item
    expect(item.sections).toEqual([
      { id: 'h', type: 'hero', heading: 'Vítejte', lead: null, image: { id: m.id, url: m.url, width: 1, height: 1, alt: null, mime: 'image/png', focal: null }, buttonLabel: null, buttonUrl: null },
      { id: 't', type: 'text', heading: null, body: doc('Ahoj') },
    ])
  })
})

describe('a list inside a block', () => {
  it('stores the items, returns them on the content API with media resolved, and an empty list as []', async () => {
    const m = await upload()
    const p = await page([
      { id: 'c', type: 'cards', heading: 'Proč my', items: [{ id: 'k1', type: 'item', title: 'Rychle', image: m.id }, { id: 'k2', type: 'item', title: 'Levně' }] },
      { id: 'e', type: 'cards', heading: 'Prázdné' },
    ])
    const item = (await anonymous().get(`/api/content/page/${p.slug}`)).body.item
    expect(item.sections[0].items).toEqual([
      { id: 'k1', type: 'item', title: 'Rychle', text: null, image: { id: m.id, url: m.url, width: 1, height: 1, alt: null, mime: 'image/png', focal: null } },
      { id: 'k2', type: 'item', title: 'Levně', text: null, image: null },
    ])
    expect(item.sections[1].items).toEqual([])
  })

  it('points a validation error at the item, and keeps or cleans up media inside the list', async () => {
    const bad = await admin.post('/api/cms/page', { title: 'X', slug: 'x', sections: [{ id: 'c', type: 'cards', items: [{ id: 'k', type: 'item', title: '' }] }] })
    expect(bad.status).toBe(422)
    expect(bad.body.data[0].path).toEqual(['sections', 0, 'items', 0, 'title'])
    const m = await upload()
    const p = await page([{ id: 'c', type: 'cards', items: [{ id: 'k', type: 'item', title: 'S fotkou', image: m.id }] }])
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBe(409)
    await admin.patch(`/api/cms/page/${p.id}`, { sections: [{ id: 'c', type: 'cards', items: [] }] })
    expect(await mediaExists(m.id)).toBe(false)
  })
})

describe('media used in blocks', () => {
  it('is protected from manual deletion and cleaned up when the block is removed', async () => {
    const m = await upload()
    const p = await page([{ id: 'i', type: 'image', image: m.id }])
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBe(409)
    await admin.patch(`/api/cms/page/${p.id}`, { sections: [] })
    expect(await mediaExists(m.id)).toBe(false)
  })

  it('counts images inside rich text in a block, and cleans up when the page is deleted', async () => {
    const m = await upload()
    const p = await page([{ id: 't', type: 'text', body: doc('x', { mediaId: m.id, src: m.url }) }])
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBe(409)
    await admin.delete(`/api/cms/page/${p.id}`)
    expect(await mediaExists(m.id)).toBe(false)
  })
})
