import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, doc, hooksMark, newAccount, receivedHooks, type ReceivedHook, signIn, testDb, truncateAll, waitForHooks } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

// A translation that has never been published is "being translated" (post.publish.perLocale in the playground).
// Czech is live and English follows it: visitors on /en read the Czech text. Someone starts the English translation:
// it is a draft of its own that was never on the website, so visitors keep reading exactly what they read before
// (Czech, through fallback) until an editor publishes it. Who may not publish (the playground's `translator`) may
// start and write it; once it is live, or after an editor took it off, it is the editors' again.
const db = testDb()
let admin: Client
let editor: Client
let translator: Client
let proofreader: Client
let byline: any
beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
  translator = (await newAccount('translator')).client
  proofreader = (await newAccount('proofreader')).client
})
beforeEach(async () => {
  await truncateAll(db)
  byline = await createAuthor(admin)
})
afterAll(() => db.end())

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString()
const patchEn = (c: Client, id: string, body: Record<string, unknown>) => c.request('PATCH', `/api/cms/post/${id}?locale=en`, { json: body })
const english = { title: 'Christmas cookies', slug: 'christmas-cookies', body: doc('In English') }
const single = (slug: string, locale: string) => anonymous().get(`/api/content/post/${slug}?locale=${locale}`)
const stored = async () => (await db.query('select locale, published, first_live_at is not null as "wasLive" from post_locales')).rows
const states = async (id: string) => (await admin.get(`/api/cms/post/${id}`)).body.row.__states

/** A live Czech article with no English translation (English follows it: visitors read Czech on /en). */
async function liveCzech() {
  const mark = hooksMark()
  const p = await createPost(admin, { author: byline.id, status: 'published', title: 'Vánoční cukroví', slug: 'vanocni-cukrovi', body: doc('Česky') })
  // Its own webhook first, so none of it lands after a later mark.
  await waitForHooks(mark, (h) => h.some((x) => x.path === '/ok' && x.json.id === p.id))
  return p
}

/** Everything a visitor can read about the article in English (and in Czech), as `what → answer`. */
async function website(id: string) {
  const out: Record<string, unknown> = {}
  for (const slug of ['vanocni-cukrovi', 'christmas-cookies']) {
    for (const locale of ['cs', 'en']) {
      const res = await single(slug, locale)
      out[`${locale}:${slug}`] = [res.status, res.status === 200 ? res.body : null]
    }
  }
  for (const locale of ['cs', 'en']) out[`list:${locale}`] = (await anonymous().get(`/api/content/post?locale=${locale}`)).body
  for (const q of ['christmas', 'english', 'cukrovi']) out[`search:${q}`] = (await anonymous().get(`/api/content/_search?q=${q}&locale=en`)).body
  out.list = (await anonymous().get(`/api/content/post?locale=en&title=Christmas cookies`)).body
  out.sitemap = (await anonymous().get('/api/content/_sitemap')).body
  // Where a link to it leads, and whether it is live (the admin's link chip; its title is the editor's business).
  const ref = `cms:post/${id}`
  const link = (await admin.post('/api/cms/_links/resolve', { refs: [ref], locale: 'en' })).body.items[ref]
  out.link = { path: link.path, state: link.state }
  return out
}

/** Webhooks about this entry in English since `mark`, after giving any of them time to arrive. */
async function englishHooks(id: string, mark: string, settle = 700): Promise<ReceivedHook[]> {
  await new Promise((r) => setTimeout(r, settle))
  return receivedHooks(mark).filter((h) => h.path === '/ok' && h.json.id === id && h.json.locale === 'en')
}
const hookOf = (id: string, type: string) => (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.id === id && x.json.type === type && x.json.locale === 'en')

describe('starting the translation of a live article', () => {
  it('a translator may: 200, and /en still serves the Czech text, exactly as before', async () => {
    const p = await liveCzech()
    const before = await website(p.id)
    expect((before['en:vanocni-cukrovi'] as any)[1].item).toMatchObject({ title: 'Vánoční cukroví', locale: 'en' })

    // The editor opens English for them, not read-only; the save agrees.
    expect((await translator.get(`/api/cms/post/${p.id}?locale=en`)).body.can).toEqual({ update: true })
    const mark = hooksMark()
    const res = await patchEn(translator, p.id, english)
    expect(res.status).toBe(200)
    expect(res.body.row).toMatchObject({ title: 'Christmas cookies', status: 'draft', __stateOwn: true, __translated: true })
    expect(res.body.row.__states.en).toEqual({ state: 'draft', own: true, date: null, translating: true })
    expect(await stored()).toEqual([{ locale: 'en', published: false, wasLive: false }])

    // Nothing a visitor reads changed: the item by either address, the lists, a filter, the search, the sitemap, a link to it.
    expect(await website(p.id)).toEqual(before)
    // …and they were not told anything changed.
    expect(await englishHooks(p.id, mark)).toEqual([])

    // Writing on: the same.
    const mark2 = hooksMark()
    expect((await patchEn(translator, p.id, { body: doc('In English, more') })).status).toBe(200)
    expect(await website(p.id)).toEqual(before)
    expect(await englishHooks(p.id, mark2)).toEqual([])
  })

  it('so may anyone else: an editor\'s first translation is being translated too (sent with `status: null` it follows the default language)', async () => {
    const p = await liveCzech()
    expect((await patchEn(editor, p.id, english)).body.row.__states.en).toMatchObject({ state: 'draft', translating: true })
    expect((await single('christmas-cookies', 'en')).status).toBe(404)
    await db.query('delete from post_locales')
    expect((await patchEn(editor, p.id, { ...english, status: null })).body.row.__states.en).toEqual({ state: 'published', own: false, date: expect.any(String) })
    expect((await single('christmas-cookies', 'en')).body.item.title).toBe('Christmas cookies')
  })

  it('shows the draft translation to an editor\'s preview', async () => {
    const p = await liveCzech()
    await patchEn(translator, p.id, english)
    for (const c of [admin, translator]) {
      const preview = await c.get('/api/content/post/christmas-cookies?locale=en&preview')
      expect(preview.status).toBe(200)
      expect(preview.body).toMatchObject({ preview: true, item: { title: 'Christmas cookies', status: 'draft', locales: ['cs', 'en'], paths: { en: '/en/blog/christmas-cookies' } } })
      expect((await c.get('/api/content/post/vanocni-cukrovi?locale=en&preview')).body.item.title).toBe('Christmas cookies')
    }
    // Not to a visitor who only asks for it.
    expect((await anonymous().get('/api/content/post/christmas-cookies?locale=en&preview')).status).toBe(404)
    expect((await anonymous().get('/api/content/post/vanocni-cukrovi?locale=en&preview')).body.item.title).toBe('Vánoční cukroví')
  })

  it('says so in the admin: the language\'s state, the list, the search and the home page', async () => {
    const p = await liveCzech()
    // The editor created the article, so the home page's drafts list it for them.
    const mine = await createPost(editor, { author: byline.id, status: 'published', title: 'Perník', slug: 'pernik' })
    await patchEn(translator, p.id, english)
    await patchEn(editor, mine.id, { title: 'Gingerbread' })
    expect((await states(p.id)).en).toMatchObject({ state: 'draft', own: true, translating: true })
    expect((await states(p.id)).cs).toMatchObject({ state: 'published', own: true })
    expect((await translator.get(`/api/cms/post/${p.id}?locale=en`)).body.row.__states.en.translating).toBe(true)
    const listed = (await admin.get('/api/cms/post')).body.rows.find((r: any) => r.id === p.id)
    expect(listed.__states.en.translating).toBe(true)
    const hit = (await admin.get('/api/cms/_search?q=christmas')).body.items.find((i: any) => i.id === p.id)
    expect(hit).toMatchObject({ status: 'translating', locale: 'en' })
    const drafts = (await editor.get('/api/cms/_overview')).body.drafts
    expect(drafts.find((d: any) => d.id === mine.id && d.locale === 'en')).toMatchObject({ published: false, translating: true })
  })
})

describe('publishing it', () => {
  it('puts the English text on /en, and announces it with the language and its addresses', async () => {
    const p = await liveCzech()
    await patchEn(translator, p.id, english)
    // The translator cannot: publishing, scheduling and following the default language are state changes.
    for (const body of [{ status: 'published' }, { status: 'published', publishedAt: inSeconds(60) }, { status: null }]) {
      expect((await patchEn(translator, p.id, body)).status).toBe(403)
    }
    const mark = hooksMark()
    const res = await patchEn(editor, p.id, { status: 'published' })
    expect(res.status).toBe(200)
    expect(res.body.row.__states.en).toMatchObject({ state: 'published', own: true })
    expect(res.body.row.__states.en).not.toHaveProperty('translating')
    expect(await stored()).toEqual([{ locale: 'en', published: true, wasLive: true }])

    const pub = hookOf(p.id, 'entry.published')
    const json = pub(await waitForHooks(mark, (h) => !!pub(h)))!.json
    // Its own address, and the one visitors were served the Czech text at until now.
    expect(json).toMatchObject({ type: 'entry.published', locale: 'en', public: true })
    expect([...json.paths].sort()).toEqual(['/en/blog/christmas-cookies', '/en/blog/vanocni-cukrovi'])

    expect((await single('christmas-cookies', 'en')).body.item).toMatchObject({ title: 'Christmas cookies', locales: ['cs', 'en'] })
    expect((await single('vanocni-cukrovi', 'en')).body.item.title).toBe('Christmas cookies')
    expect((await single('vanocni-cukrovi', 'cs')).body.item.title).toBe('Vánoční cukroví')
    expect((await anonymous().get('/api/content/_search?q=christmas&locale=en')).body.total).toBe(1)
  })

  it('on a date: visitors keep the Czech text until it comes, then read English, and it is announced', async () => {
    const p = await liveCzech()
    await patchEn(translator, p.id, english)
    const res = await patchEn(editor, p.id, { status: 'published', publishedAt: inSeconds(40) })
    expect(res.body.row.__states.en).toMatchObject({ state: 'scheduled', own: true })
    // Until then: still the Czech text in English, not a 404.
    expect((await single('vanocni-cukrovi', 'en')).body.item.title).toBe('Vánoční cukroví')
    expect((await single('christmas-cookies', 'en')).status).toBe(404)

    // The scheduler's first run on a fresh database starts from "now"; wait for it.
    const deadline = Date.now() + 5000
    while (!(await db.query(`select 1 from cms_state where key = 'scheduler.lastRun'`)).rowCount && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
    const mark = hooksMark()
    await db.query(`update post_locales set published_at = now(), first_live_at = now(), updated_at = now() - interval '1 minute' where parent_id = $1`, [p.id])
    expect((await single('christmas-cookies', 'en')).body.item.title).toBe('Christmas cookies')
    const pub = hookOf(p.id, 'entry.published')
    expect(pub(await waitForHooks(mark, (h) => !!pub(h), 10_000))!.json).toMatchObject({ locale: 'en', public: true, paths: ['/en/blog/christmas-cookies'] })
  }, 25_000)

  it('cancelling a first date makes it being translated again', async () => {
    const p = await liveCzech()
    await patchEn(translator, p.id, english)
    await patchEn(editor, p.id, { status: 'published', publishedAt: inSeconds(3600) })
    expect((await patchEn(editor, p.id, { status: 'draft' })).body.row.__states.en).toMatchObject({ state: 'draft', translating: true })
    expect((await single('vanocni-cukrovi', 'en')).body.item.title).toBe('Vánoční cukroví')
    expect((await translator.get(`/api/cms/post/${p.id}?locale=en`)).body.can.update).toBe(true)
  })
})

describe('taking it off the website again', () => {
  it('makes /en a 404, and announces it', async () => {
    const p = await liveCzech()
    await patchEn(translator, p.id, english)
    await patchEn(editor, p.id, { status: 'published' })
    const mark = hooksMark()
    const res = await patchEn(editor, p.id, { status: 'draft' })
    expect(res.body.row.__states.en).toEqual({ state: 'draft', own: true, date: expect.any(String) })
    expect(await stored()).toEqual([{ locale: 'en', published: false, wasLive: true }])
    const un = hookOf(p.id, 'entry.unpublished')
    const json = un(await waitForHooks(mark, (h) => !!un(h)))!.json
    expect(json).toMatchObject({ locale: 'en', public: true, paths: ['/en/blog/christmas-cookies'] })
    expect((await single('christmas-cookies', 'en')).status).toBe(404)
    expect((await single('vanocni-cukrovi', 'en')).status).toBe(404)
    expect((await single('vanocni-cukrovi', 'cs')).status).toBe(200)
  })

  it('a language that was on the website through Czech, unpublished without ever having a translation, is a 404 too', async () => {
    const p = await liveCzech()
    expect((await patchEn(editor, p.id, { status: 'draft' })).body.row.__states.en).toEqual({ state: 'draft', own: true, date: null })
    expect((await single('vanocni-cukrovi', 'en')).status).toBe(404)
  })
})

describe('what the translator may do, by state', () => {
  it('while it is being translated: write it and remove it (nothing visitors see changes)', async () => {
    // The proofreader: like the translator, never publishes, but no field rule keeps a translated field from it (removing a
    // translation removes every translated field of it, so the translator's read-only post.location would stop it there).
    const p = await liveCzech()
    await patchEn(proofreader, p.id, english)
    const before = await website(p.id)
    const mark = hooksMark()
    expect((await proofreader.delete(`/api/cms/post/${p.id}?locale=en`)).status).toBe(200)
    expect(await stored()).toEqual([])
    expect(await website(p.id)).toEqual(before)
    expect(await englishHooks(p.id, mark)).toEqual([])
    // Emptying every field of it does the same.
    await patchEn(proofreader, p.id, english)
    expect((await patchEn(proofreader, p.id, { title: null, slug: null, body: null })).status).toBe(200)
    expect(await stored()).toEqual([])
    // The translator's own removal is held by that field rule only, not by the publish rule; emptying it keeps the empty draft.
    await patchEn(translator, p.id, english)
    const refused = await translator.delete(`/api/cms/post/${p.id}?locale=en`)
    expect(refused.status).toBe(403)
    expect(JSON.stringify(refused.body)).not.toMatch(/publish/i)
    expect((await patchEn(translator, p.id, { title: null, slug: null, body: null })).status).toBe(200)
    expect(await stored()).toEqual([{ locale: 'en', published: false, wasLive: false }])
    expect(await website(p.id)).toEqual(before)
  })

  it('once it is live: nothing (not the text, not removing it, not its state)', async () => {
    const p = await liveCzech()
    await patchEn(translator, p.id, english)
    await patchEn(editor, p.id, { status: 'published' })
    const told = (await translator.get(`/api/cms/post/${p.id}?locale=en`)).body.can
    expect(told).toEqual({ update: false, why: 'published' })
    expect((await patchEn(translator, p.id, { title: 'Christmas biscuits' })).status).toBe(403)
    expect((await patchEn(translator, p.id, { status: 'draft' })).status).toBe(403)
    expect((await translator.delete(`/api/cms/post/${p.id}?locale=en`)).status).toBe(403)
    expect((await single('christmas-cookies', 'en')).body.item.title).toBe('Christmas cookies')
  })

  it('after an editor took it off: not put it back in any way (publish, follow Czech, remove it); its text stays theirs to fix, as for any draft', async () => {
    const p = await liveCzech()
    await patchEn(translator, p.id, english)
    await patchEn(editor, p.id, { status: 'published' })
    await patchEn(editor, p.id, { status: 'draft' })
    for (const body of [{ status: 'published' }, { status: null }]) expect((await patchEn(translator, p.id, body)).status).toBe(403)
    // Removing it would make English follow Czech: Czech text on /en again. (The proofreader: only the publish rule can stop it.)
    expect((await translator.delete(`/api/cms/post/${p.id}?locale=en`)).status).toBe(403)
    const refused = await proofreader.delete(`/api/cms/post/${p.id}?locale=en`)
    expect(refused.status).toBe(403)
    expect(JSON.stringify(refused.body)).toMatch(/publish/i)
    expect(await stored()).toEqual([{ locale: 'en', published: false, wasLive: true }])
    // Fixing its text changes nothing visitors see (it stays off), as before this change.
    expect((await translator.get(`/api/cms/post/${p.id}?locale=en`)).body.can.update).toBe(true)
    expect((await patchEn(translator, p.id, { title: 'Christmas biscuits' })).status).toBe(200)
    expect((await states(p.id)).en).not.toHaveProperty('translating')
    expect((await single('christmas-cookies', 'en')).status).toBe(404)
    expect((await single('vanocni-cukrovi', 'en')).status).toBe(404)
  })

  it('under a Czech draft: a first translation follows Czech, as before, and goes live with it', async () => {
    const p = await createPost(admin, { author: byline.id, status: 'draft', title: 'Koncept', slug: 'koncept' })
    expect((await patchEn(translator, p.id, { title: 'Draft', slug: 'draft' })).status).toBe(200)
    expect(await stored()).toEqual([{ locale: 'en', published: null, wasLive: false }])
    await admin.patch(`/api/cms/post/${p.id}`, { status: 'published' })
    expect((await single('draft', 'en')).body.item.title).toBe('Draft')
  })
})
