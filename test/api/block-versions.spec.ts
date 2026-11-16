import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { getTableName } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { buildRegistry, snake } from 'tinyzoo'
import * as config from '../../playground/cms.config'
import { formatReport, migrateContent } from '../../packages/cms/cli/content-migrate'
import { anonymous, type Client, PNG_1x1, signIn, testDb, truncateAll } from '../helpers/api'
import { envWithout, siteFolderWithEnvFile } from '../helpers/siteFolder'

// Stored JSON outlives the code that wrote it: a block saved at an older version is
// brought up to date wherever it is read (the playground's `cta` block is at version 2:
// a button's label and link are tidied, an empty one becomes null), a block whose type
// is gone is kept, and `content:migrate` rewrites what is stored.
const db = testDb()
const reg = buildRegistry(config)
const Page = config.Page
const pageTable = getTableName(Page.table as any)
const localesTable = getTableName(Page.localesTable as any)
const sectionsCol = snake('sections')

let admin: Client
beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const OLD_CTA = { id: 'c1', type: 'cta', text: 'Objednejte', buttonLabel: '  ', buttonUrl: ' /kontakt ', highlighted: true }
const GONE = { id: 'old', type: 'video', url: 'https://example.com/v.mp4', caption: 'Zmizelý blok' }

/** A published page, then its stored blocks replaced by `sections` exactly as given (an older save). */
async function storedPage(sections: unknown[], over: Record<string, unknown> = {}) {
  const res = await admin.post('/api/cms/page', { title: 'Domů', slug: `home-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, status: 'published', sections: [], ...over })
  if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`)
  const row = res.body.row
  await db.query(`update "${pageTable}" set "${sectionsCol}" = $1::jsonb where id = $2`, [JSON.stringify(sections), row.id])
  return row
}
const stored = async (id: string) => (await db.query(`select "${sectionsCol}" as sections, updated_at from "${pageTable}" where id = $1`, [id])).rows[0]
const upload = async () => (await admin.upload('/api/cms/_media', { name: 'p.png', type: 'image/png', data: PNG_1x1 })).body
const mediaExists = async (id: string) => (await db.query('select 1 from cms_media where id = $1', [id])).rowCount === 1

const UPGRADED_CTA = { id: 'c1', type: 'cta', text: 'Objednejte', buttonLabel: null, buttonUrl: '/kontakt', highlighted: true }

describe('a block stored at an older version', () => {
  it('is served upgraded by the content API, and the stored copy is left as it is', async () => {
    const p = await storedPage([OLD_CTA])
    const item = (await anonymous().get(`/api/content/page/${p.slug}`)).body.item
    expect(item.sections).toEqual([UPGRADED_CTA]) // the API carries no `v`
    expect((await stored(p.id)).sections).toEqual([OLD_CTA])
  })

  it('is shown to the editor upgraded and stamped, and saving it stores the current version', async () => {
    const p = await storedPage([OLD_CTA])
    const row = (await admin.get(`/api/cms/page/${p.id}`)).body.row
    expect(row.sections).toEqual([{ ...UPGRADED_CTA, v: 2 }])
    // The editor sends back what it loaded.
    expect((await admin.patch(`/api/cms/page/${p.id}`, { title: 'Nový název', sections: row.sections })).status).toBe(200)
    expect((await stored(p.id)).sections).toEqual([{ ...UPGRADED_CTA, v: 2 }])
  })

  it('is upgraded on write when it says it is behind and is stored that way, and new blocks are stored at the current version', async () => {
    const p = await storedPage([OLD_CTA])
    const res = await admin.patch(`/api/cms/page/${p.id}`, {
      sections: [{ ...OLD_CTA, v: 1 }, { id: 'n', type: 'cta', text: 'Nové', buttonUrl: '/ahoj' }, { id: 't', type: 'text', heading: 'Nadpis' }],
    })
    expect(res.status).toBe(200)
    expect((await stored(p.id)).sections).toEqual([
      { ...UPGRADED_CTA, v: 2 },
      { id: 'n', type: 'cta', text: 'Nové', buttonUrl: '/ahoj', highlighted: false, v: 2 },
      { id: 't', type: 'text', heading: 'Nadpis' }, // version 1: no v
    ])
  })

  it('refuses a block saved by a newer version of the site', async () => {
    const res = await admin.post('/api/cms/page', { title: 'X', slug: 'x', sections: [{ id: 'n', type: 'cta', text: 'T', v: 9 }] })
    expect(res.status).toBe(422)
    expect(res.body.data[0].path).toEqual(['sections', 0, 'v'])
  })

  it('is read in its current shape in saved versions (history), including the comparison', async () => {
    const p = await storedPage([])
    await admin.patch(`/api/cms/page/${p.id}`, { sections: [{ id: 'c1', type: 'cta', text: 'Nové' }] })
    const [rev] = (await admin.get(`/api/cms/page/${p.id}/revisions`)).body.revisions
    await db.query('update cms_revisions set data = jsonb_set(data, \'{sections}\', $1::jsonb) where id = $2', [JSON.stringify([OLD_CTA]), rev.id])
    const snapshot = (await admin.get(`/api/cms/page/${p.id}/revisions/${rev.id}`)).body.revision
    expect(snapshot.data.sections).toEqual([{ ...UPGRADED_CTA, v: 2 }])
  })

  it('is read in its current shape in a translation', async () => {
    const p = await storedPage([])
    await admin.patch(`/api/cms/page/${p.id}?locale=en`, { title: 'Home', slug: `home-${p.id.slice(0, 6)}`, sections: [{ id: 'c1', type: 'cta', text: 'Order' }] })
    await db.query(`update "${localesTable}" set "${sectionsCol}" = $1::jsonb where parent_id = $2 and locale = 'en'`, [JSON.stringify([{ ...OLD_CTA, text: 'Order' }]), p.id])
    const row = (await admin.get(`/api/cms/page/${p.id}?locale=en`)).body.row
    expect(row.sections).toEqual([{ ...UPGRADED_CTA, text: 'Order', v: 2 }])
    const [slug] = (await db.query(`select slug from "${localesTable}" where parent_id = $1 and locale = 'en'`, [p.id])).rows
    const item = (await anonymous().get(`/api/content/page/${slug.slug}?locale=en`)).body.item
    expect(item.sections).toEqual([{ ...UPGRADED_CTA, text: 'Order' }])
  })

  it('is indexed for search from its upgraded form (an unknown block is not indexed at all)', async () => {
    const p = await storedPage([{ id: 'c1', type: 'cta', text: 'Objednejte', buttonLabel: '  Koupit nyní  ', buttonUrl: ' /x ' }, GONE], { title: 'Obchod' })
    // A save that leaves the blocks alone indexes the entry from what is stored.
    await admin.patch(`/api/cms/page/${p.id}`, { title: 'Obchod online' })
    expect((await anonymous().get('/api/content/_search?q=koupit')).body.total).toBe(1)
    expect((await anonymous().get('/api/content/_search?q=Zmizelý')).body.total).toBe(0)
  })
})

describe('a block whose type no longer exists', () => {
  it('is kept: shown to the editor as it is, left out of the content API and search, and still there after a save', async () => {
    const p = await storedPage([{ id: 'h', type: 'hero', heading: 'Vítejte' }, GONE, { ...OLD_CTA, id: 'c2' }])
    const item = (await anonymous().get(`/api/content/page/${p.slug}`)).body.item
    expect(item.sections.map((b: any) => b.type)).toEqual(['hero', 'cta'])
    expect((await anonymous().get('/api/content/_search?q=Zmizelý')).body.total).toBe(0)

    const row = (await admin.get(`/api/cms/page/${p.id}`)).body.row
    expect(row.sections[1]).toEqual(GONE)
    // Saving the form (here: a new title) keeps the block untouched, and in its place.
    expect((await admin.patch(`/api/cms/page/${p.id}`, { title: 'Jiný název', sections: row.sections })).status).toBe(200)
    const after = (await stored(p.id)).sections
    expect(after.map((b: any) => b.type)).toEqual(['hero', 'video', 'cta'])
    expect(after[1]).toEqual(GONE)
    // The editor removes it: gone.
    await admin.patch(`/api/cms/page/${p.id}`, { sections: row.sections.filter((b: any) => b.type !== 'video') })
    expect((await stored(p.id)).sections.map((b: any) => b.type)).toEqual(['hero', 'cta'])
  })

  it('still has a type and an id, or the save is refused', async () => {
    expect((await admin.post('/api/cms/page', { title: 'X', slug: 'x', sections: [{ type: 'video' }] })).status).toBe(422)
    expect((await admin.post('/api/cms/page', { title: 'X', slug: 'y', sections: [{ id: 'v' }] })).status).toBe(422)
  })

  it('keeps its media: the files are not deleted while it stays, and are cleaned up once it is removed', async () => {
    const m = await upload()
    const p = await storedPage([{ id: 'v', type: 'video', poster: m.id }])
    expect((await admin.delete(`/api/cms/_media/${m.id}`)).status).toBe(409)
    const row = (await admin.get(`/api/cms/page/${p.id}`)).body.row
    await admin.patch(`/api/cms/page/${p.id}`, { title: 'Bez změny', sections: row.sections })
    expect(await mediaExists(m.id)).toBe(true)
    await admin.patch(`/api/cms/page/${p.id}`, { sections: [] })
    expect(await mediaExists(m.id)).toBe(false)
  })
})

// ── the server does not take the client's word for what it stores ──────────────

describe('a block that says it is behind', () => {
  const patch = (id: string, sections: unknown[], query = '') => admin.patch(`/api/cms/page/${id}${query}`, { sections })
  const paths = (res: any) => (res.body.data as { path: (string | number)[] }[]).map((i) => i.path)
  const STALE_ELSEWHERE = { id: 'x1', type: 'cta', v: 1, text: 'Zvenčí', buttonUrl: 'javascript:alert(1)' }

  it('is refused on create: nothing is stored, so nothing is stored at that version', async () => {
    const res = await admin.post('/api/cms/page', { title: 'X', slug: 'x', sections: [{ ...OLD_CTA, v: 1 }] })
    expect(res.status).toBe(422)
    expect(paths(res)).toEqual([['sections', 0, 'v']])
  })

  it('is accepted for a block stored at that version, and refused under another id, or when stored at another version', async () => {
    const p = await storedPage([OLD_CTA])
    // another id: the client's claim cannot be checked against anything stored
    const other = await patch(p.id, [{ ...STALE_ELSEWHERE }])
    expect(other.status).toBe(422)
    expect(paths(other)).toEqual([['sections', 0, 'v']])
    expect((await stored(p.id)).sections).toEqual([OLD_CTA])
    // the block stored at version 2 is not stored "at version 1"
    const q = await storedPage([{ ...UPGRADED_CTA, v: 2 }])
    expect((await patch(q.id, [{ ...OLD_CTA, v: 1 }])).status).toBe(422)
    // the stored one itself: upgraded, validated and stored at the current version
    expect((await patch(p.id, [{ ...OLD_CTA, v: 1 }])).status).toBe(200)
    expect((await stored(p.id)).sections).toEqual([{ ...UPGRADED_CTA, v: 2 }])
  })

  it('is checked in a translation against the translation (not the entry)', async () => {
    const p = await storedPage([OLD_CTA])
    // Only the default language stores c1: the English translation has no such block.
    const res = await patch(p.id, [{ ...OLD_CTA, v: 1, text: 'Order' }], '?locale=en')
    expect(res.status).toBe(422)
    expect(paths(res)).toEqual([['sections', 0, 'v']])
    // …until the translation has it, at that version
    await patch(p.id, [{ id: 'other', type: 'cta', text: 'x' }], '?locale=en')
    await db.query(`update "${localesTable}" set "${sectionsCol}" = $1::jsonb where parent_id = $2 and locale = 'en'`, [JSON.stringify([{ ...OLD_CTA, text: 'Order' }]), p.id])
    expect((await patch(p.id, [{ ...OLD_CTA, v: 1, text: 'Order' }], '?locale=en')).status).toBe(200)
    const [tr] = (await db.query(`select "${sectionsCol}" as sections from "${localesTable}" where parent_id = $1 and locale = 'en'`, [p.id])).rows
    expect(tr.sections).toEqual([{ ...UPGRADED_CTA, text: 'Order', v: 2 }])
  })
})

describe('a block sent without v', () => {
  const patch = (id: string, sections: unknown[], query = '') => admin.patch(`/api/cms/page/${id}${query}`, { sections })

  it('is stored when it fits the current shape, and never loses a key it does not know', async () => {
    const p = await storedPage([])
    expect((await patch(p.id, [{ id: 't', type: 'text', heading: 'Nadpis' }])).status).toBe(200)
    const bad = await patch(p.id, [{ id: 't', type: 'text', heading: 'Nadpis', legacyTitle: 'Starý nadpis' }])
    expect(bad.status).toBe(422)
    expect(bad.body.data[0].message).toMatch(/legacyTitle/)
    expect(bad.body.data[0].message).toMatch(/reload/)
    expect((await stored(p.id)).sections).toEqual([{ id: 't', type: 'text', heading: 'Nadpis' }])
    // a block of a version above 1 is taken as version 1 and upgraded when it does not fit: its extra key is a refusal, not a silent loss
    const cta = await patch(p.id, [{ id: 'c', type: 'cta', text: 'T', legacyLabel: 'x' }])
    expect(cta.status).toBe(422)
  })

  it('the same for the items of a list inside a block, and in a translation', async () => {
    const p = await storedPage([])
    const cards = (extra: object) => [{ id: 'k', type: 'cards', heading: 'H', items: [{ id: 'i', type: 'item', title: 'T', ...extra }] }]
    expect((await patch(p.id, cards({}))).status).toBe(200)
    const bad = await patch(p.id, cards({ legacyText: 'x' }))
    expect(bad.status).toBe(422)
    expect(bad.body.data[0].path).toEqual(['sections', 0, 'items', 0])
    expect(bad.body.data[0].message).toMatch(/legacyText/)
    const tr = await patch(p.id, [{ id: 't', type: 'text', legacyTitle: 'x' }], '?locale=en')
    expect(tr.status).toBe(422)
  })

  it('in a global (PUT), the items of a list too', async () => {
    const res = await admin.put('/api/cms/_singleton/formSettings', { notifyTo: [{ id: 'a', type: 'item', email: 'a@example.com', oldAddress: 'x' }] })
    expect(res.status).toBe(422)
    expect(res.body.data[0].message).toMatch(/oldAddress/)
    expect((await admin.put('/api/cms/_singleton/formSettings', { notifyTo: [{ id: 'a', type: 'item', email: 'a@example.com' }] })).status).toBe(200)
  })
})

describe('what the editor reads carries v on every block and list item', () => {
  it('in the form, in a translation, in the list and in a saved version — also at version 1', async () => {
    const p = await storedPage([{ id: 'h', type: 'hero', heading: 'Vítejte' }, { id: 'k', type: 'cards', heading: 'H', items: [{ id: 'i', type: 'item', title: 'T' }] }, GONE])
    const stamped = [
      { id: 'h', type: 'hero', heading: 'Vítejte', v: 1 },
      { id: 'k', type: 'cards', heading: 'H', items: [{ id: 'i', type: 'item', title: 'T', v: 1 }], v: 1 },
      GONE, // a type we cannot read is left as it is
    ]
    expect((await admin.get(`/api/cms/page/${p.id}`)).body.row.sections).toEqual(stamped)
    expect((await admin.get('/api/cms/page')).body.rows.find((r: any) => r.id === p.id).sections).toEqual(stamped)
    // What the editor sends back is stored without the stamp at version 1: the stored copy is as before.
    const row = (await admin.get(`/api/cms/page/${p.id}`)).body.row
    expect((await admin.patch(`/api/cms/page/${p.id}`, { title: 'Nový název', sections: row.sections })).status).toBe(200)
    expect((await stored(p.id)).sections).toEqual([
      { id: 'h', type: 'hero', heading: 'Vítejte' },
      { id: 'k', type: 'cards', heading: 'H', items: [{ id: 'i', type: 'item', title: 'T' }] },
      GONE,
    ])
    // A translation: the same.
    await db.query(`insert into "${localesTable}" (parent_id, locale, "${sectionsCol}") values ($1, 'en', $2::jsonb)`, [p.id, JSON.stringify([{ id: 'h', type: 'hero', heading: 'Welcome' }])])
    expect((await admin.get(`/api/cms/page/${p.id}?locale=en`)).body.row.sections).toEqual([{ id: 'h', type: 'hero', heading: 'Welcome', v: 1 }])
    // A global's list.
    await admin.put('/api/cms/_singleton/formSettings', { notifyTo: [{ id: 'a', type: 'item', email: 'a@example.com' }] })
    expect((await admin.get('/api/cms/_singleton/formSettings')).body.row.notifyTo).toEqual([{ id: 'a', type: 'item', email: 'a@example.com', v: 1 }])
  })

  it('the list in the admin is brought up to date, like every other read (it showed the stored shape)', async () => {
    const p = await storedPage([OLD_CTA])
    const row = (await admin.get('/api/cms/page')).body.rows.find((r: any) => r.id === p.id)
    expect(row.sections).toEqual([{ ...UPGRADED_CTA, v: 2 }])
    expect((await stored(p.id)).sections).toEqual([OLD_CTA])
  })
})

describe('an unknown block type', () => {
  const formSettingsTable = getTableName(config.FormSettings.table as any)
  const patch = (id: string, sections: unknown[], query = '') => admin.patch(`/api/cms/page/${id}${query}`, { sections })

  it('cannot be added: only a block that is already stored may stay', async () => {
    const p = await storedPage([GONE])
    const res = await patch(p.id, [GONE, { id: 'new', type: 'video', url: 'javascript:alert(1)' }])
    expect(res.status).toBe(422)
    expect(res.body.data[0].path).toEqual(['sections', 1])
    expect((await admin.post('/api/cms/page', { title: 'X', slug: 'x', sections: [GONE] })).status).toBe(422)
    // a stored one cannot be changed either: it is kept as it is or removed
    expect((await patch(p.id, [{ ...GONE, url: 'javascript:alert(1)' }])).status).toBe(422)
    expect((await patch(p.id, [GONE])).status).toBe(200)
    expect((await stored(p.id)).sections).toEqual([GONE])
  })

  it('cannot go by a name that is drawn as a known type', async () => {
    const p = await storedPage([])
    for (const type of ['Hero', '_hero', '-hero', 'hero_', 'he-ro', 'CTA']) {
      const res = await patch(p.id, [{ id: 'g', type, anything: 1 }])
      expect(res.status, type).toBe(422)
      expect(res.body.data[0].path).toEqual(['sections', 0, 'type'])
    }
    expect((await stored(p.id)).sections).toEqual([])
  })

  it('is kept in a translation when stored there, and refused when new', async () => {
    const p = await storedPage([])
    await patch(p.id, [{ id: 'h', type: 'hero', heading: 'Welcome' }], '?locale=en')
    await db.query(`update "${localesTable}" set "${sectionsCol}" = $1::jsonb where parent_id = $2 and locale = 'en'`, [JSON.stringify([GONE]), p.id])
    expect((await patch(p.id, [GONE], '?locale=en')).status).toBe(200)
    expect((await patch(p.id, [GONE, { ...GONE, id: 'new' }], '?locale=en')).status).toBe(422)
  })

  it('is kept in a global when stored there, and refused when new', async () => {
    await admin.put('/api/cms/_singleton/formSettings', { notifyTo: [] })
    const ghost = { id: 'g', type: 'person', name: 'Zmizelý' }
    await db.query(`update "${formSettingsTable}" set "${snake('notifyTo')}" = $1::jsonb`, [JSON.stringify([ghost])])
    expect((await admin.put('/api/cms/_singleton/formSettings', { notifyTo: [ghost] })).status).toBe(200)
    expect((await db.query(`select "${snake('notifyTo')}" as n from "${formSettingsTable}"`)).rows[0].n).toEqual([ghost])
    expect((await admin.put('/api/cms/_singleton/formSettings', { notifyTo: [ghost, { ...ghost, id: 'new' }] })).status).toBe(422)
  })
})

describe('tinyzoo content:migrate', () => {
  const pool = () => drizzle(db as any, { schema: reg.schema })
  const arrange = async () => {
    const withTranslation = await storedPage([OLD_CTA, GONE, { id: 'cur', type: 'cta', text: 'Aktuální', v: 2 }])
    const plain = await storedPage([{ id: 'h', type: 'hero', heading: 'Bez změny' }])
    await admin.patch(`/api/cms/page/${withTranslation.id}?locale=en`, { title: 'Home', slug: `home-${withTranslation.id.slice(0, 6)}`, sections: [{ id: 'c1', type: 'cta', text: 'Order' }] })
    await db.query(`update "${localesTable}" set "${sectionsCol}" = $1::jsonb where parent_id = $2 and locale = 'en'`, [JSON.stringify([{ ...OLD_CTA, text: 'Order' }]), withTranslation.id])
    // An older saved version: made at the current shape by the API, then put back to the old one.
    const [rev] = (await db.query('select id from cms_revisions where record_id = $1 and locale is null order by created_at desc limit 1', [withTranslation.id])).rows
    await db.query('update cms_revisions set data = jsonb_set(data, \'{sections}\', $1::jsonb) where id = $2', [JSON.stringify([OLD_CTA]), rev.id])
    return { withTranslation, plain, revisionId: rev.id as string }
  }
  const revisionSections = async (id: string) => (await db.query('select data -> \'sections\' as s from cms_revisions where id = $1', [id])).rows[0].s

  it('--dry-run reports what is behind and writes nothing', async () => {
    const { withTranslation, revisionId } = await arrange()
    const before = await stored(withTranslation.id)
    const report = await migrateContent(pool(), reg, { dryRun: true })
    expect(report.dryRun).toBe(true)
    expect(report.failures).toEqual([])
    const row = (source: string) => report.fields.find((f) => f.entity === 'page' && f.field === 'sections' && f.source === source)!
    expect(row('entries')).toMatchObject({ upgraded: 1, blocks: 1 })
    expect(row('translations')).toMatchObject({ scanned: 1, upgraded: 1, blocks: 1 })
    expect(row('revisions').upgraded).toBeGreaterThanOrEqual(1)
    expect(report.rowsUpgraded).toBeGreaterThanOrEqual(3)
    expect(formatReport(report).join('\n')).toMatch(/would be rewritten/)
    // Nothing changed.
    expect(await stored(withTranslation.id)).toEqual(before)
    expect(await revisionSections(revisionId)).toEqual([OLD_CTA])
  })

  it('rewrites entries, translations and saved versions to the current version, and a second run finds nothing', async () => {
    const { withTranslation, plain, revisionId } = await arrange()
    const before = await stored(withTranslation.id)
    const report = await migrateContent(pool(), reg, { batchSize: 1 }) // one row per transaction: batches walk on
    expect(report.failures).toEqual([])
    expect(report.rowsUpgraded).toBeGreaterThanOrEqual(3)

    const after = await stored(withTranslation.id)
    expect(after.sections).toEqual([{ ...UPGRADED_CTA, v: 2 }, GONE, { id: 'cur', type: 'cta', text: 'Aktuální', v: 2 }]) // unknown block untouched
    expect(after.updated_at).toEqual(before.updated_at) // not an edit
    expect((await stored(plain.id)).sections).toEqual([{ id: 'h', type: 'hero', heading: 'Bez změny' }])
    const [tr] = (await db.query(`select "${sectionsCol}" as sections from "${localesTable}" where parent_id = $1 and locale = 'en'`, [withTranslation.id])).rows
    expect(tr.sections).toEqual([{ ...UPGRADED_CTA, text: 'Order', v: 2 }])
    expect(await revisionSections(revisionId)).toEqual([{ ...UPGRADED_CTA, v: 2 }])

    const again = await migrateContent(pool(), reg)
    expect(again.rowsUpgraded).toBe(0)
    expect(formatReport(again).join('\n')).toContain('already at the current versions')
  })

  it('reports a block it could not upgrade and leaves it as stored', async () => {
    const p = await storedPage([OLD_CTA, { id: 'c9', type: 'cta', text: 'Druhý', buttonUrl: ' /x ' }])
    const cta = (Page.fields.sections as any).blocks.cta
    const real = cta.upgrade
    cta.upgrade = (data: any) => { if (data.id === 'c1') throw new Error('cannot tidy this one'); return real(data, 1) }
    try {
      const report = await migrateContent(pool(), reg)
      expect(report.failures).toHaveLength(1)
      expect(report.failures[0]).toMatchObject({ entity: 'page', source: 'entries', recordId: p.id, field: 'sections', path: [0], type: 'cta', blockId: 'c1', from: 1, to: 2, message: 'cannot tidy this one' })
      expect(formatReport(report).join('\n')).toMatch(/Could not upgrade 1 block.*cannot tidy this one/s)
    }
    finally { cta.upgrade = real }
    // The one that failed is as it was; the other was upgraded.
    expect((await stored(p.id)).sections).toEqual([OLD_CTA, { id: 'c9', type: 'cta', text: 'Druhý', buttonLabel: null, buttonUrl: '/x', v: 2 }])
  })

  it('runs as a command (dry run) against DATABASE_URL, from the site\'s folder', async () => {
    const p = await storedPage([OLD_CTA])
    const out = execFileSync('pnpm', ['exec', 'tsx', join(import.meta.dirname, '../../packages/cms/cli/index.ts'), 'content:migrate', '--dry-run'], {
      cwd: join(import.meta.dirname, '../../playground'),
      env: { ...process.env, DATABASE_URL: inject('databaseUrl') },
      encoding: 'utf8',
    })
    expect(out).toMatch(/page\.sections\s+entries\s+1 of\s+1 would be rewritten/)
    expect(out).toMatch(/dry run: nothing was written/)
    expect((await stored(p.id)).sections).toEqual([OLD_CTA])
  })

  it('finds DATABASE_URL in the site\'s .env, as `tinyzoo up` does', async () => {
    await storedPage([OLD_CTA])
    const site = siteFolderWithEnvFile(inject('databaseUrl'))
    try {
      const out = execFileSync(join(import.meta.dirname, '../../playground/node_modules/.bin/tsx'), [join(import.meta.dirname, '../../packages/cms/cli/index.ts'), 'content:migrate', '--dry-run'], {
        cwd: site.dir, env: envWithout(), encoding: 'utf8',
      })
      expect(out).toMatch(/page\.sections\s+entries\s+1 of\s+1 would be rewritten/)
    }
    finally { site.remove() }
  })
})
