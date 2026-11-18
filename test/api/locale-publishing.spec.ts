import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, doc, hooksMark, receivedHooks, type ReceivedHook, signIn, testDb, truncateAll, waitForHooks } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

// Per-language publishing (publish.perLocale on the playground's posts): a translation has its own
// state and schedule; until one is set it follows the default language (cs).
const db = testDb()
let admin: Client
let author: Client
let byline: any
beforeAll(async () => {
  admin = await signIn('admin')
  author = await signIn('author')
})
beforeEach(async () => {
  await truncateAll(db)
  byline = await createAuthor(admin)
})
afterAll(() => db.end())

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString()
const patchEn = (id: string, body: Record<string, unknown>, c = admin) => c.request('PATCH', `/api/cms/post/${id}?locale=en`, { json: body })
const post = (over: Record<string, unknown> = {}) => createPost(admin, { author: byline.id, status: 'published', title: 'Vánoční cukroví', slug: 'vanocni-cukrovi', body: doc('Česky'), ...over })
/** A published post with an English translation that has no state of its own (said so: a first translation of a published post is otherwise being translated). */
const translated = async (over: Record<string, unknown> = {}) => {
  const p = await post(over)
  expect((await patchEn(p.id, { title: 'Christmas cookies', slug: 'christmas-cookies', status: null })).status).toBe(200)
  return p
}
const single = (slug: string, locale: string) => anonymous().get(`/api/content/post/${slug}?locale=${locale}`)
const list = async (locale: string) => (await anonymous().get(`/api/content/post?locale=${locale}`)).body.items as any[]
const sitemap = async () => (await anonymous().get('/api/content/_sitemap')).body.entries as { loc: string; locale: string; alternates: { locale: string; loc: string }[] }[]
const locs = async () => (await sitemap()).map((e) => e.loc).filter((l) => l.includes('/blog/')).sort()

describe('a language that follows the default language', () => {
  it('is live while the default language is, with or without a translation (nothing has changed on the website)', async () => {
    const withTr = await translated()
    const without = await post({ slug: 'bez-prekladu', title: 'Bez překladu' })
    expect((await single('christmas-cookies', 'en')).status).toBe(200)
    expect((await single('bez-prekladu', 'en')).body.item.title).toBe('Bez překladu') // the default language's text
    expect((await list('en')).map((i) => i.id).sort()).toEqual([withTr.id, without.id].sort())
    // The sitemap lists the languages an entry has a translation in, as before.
    expect(await locs()).toEqual(['/blog/bez-prekladu', '/blog/vanocni-cukrovi', '/en/blog/christmas-cookies'])
    const entry = (await sitemap()).find((e) => e.loc === '/blog/vanocni-cukrovi')!
    expect(entry.alternates.map((a) => a.locale)).toEqual(['cs', 'en'])
    // …and goes off with it.
    await admin.patch(`/api/cms/post/${withTr.id}`, { status: 'draft' })
    expect((await single('christmas-cookies', 'en')).status).toBe(404)
    expect((await list('en')).map((i) => i.id)).toEqual([without.id])
  })

  it('reports each language in the admin: its own state, or the default language\'s', async () => {
    const p = await translated({ publishedAt: inSeconds(-60) })
    const row = (await admin.get(`/api/cms/post/${p.id}`)).body.row
    expect(row.__states.cs).toMatchObject({ state: 'published', own: true })
    expect(row.__states.en).toMatchObject({ state: 'published', own: false })
    const tr = (await admin.get(`/api/cms/post/${p.id}?locale=en`)).body.row
    expect(tr).toMatchObject({ status: 'published', __stateOwn: false, title: 'Christmas cookies' })
    expect((await admin.get('/api/cms/post')).body.rows[0].__states.en.state).toBe('published')
  })
})

describe('unpublishing one language', () => {
  it('takes that language off the website and leaves the others', async () => {
    const p = await translated()
    const res = await patchEn(p.id, { status: 'draft' })
    expect(res.status).toBe(200)
    expect(res.body.row).toMatchObject({ status: 'draft', __stateOwn: true, __translated: true, title: 'Christmas cookies' })
    expect(res.body.row.__states).toMatchObject({ cs: { state: 'published' }, en: { state: 'draft', own: true } })

    // A draft translation is not there: 404 by its own address and by the default one, left out of the list.
    expect((await single('christmas-cookies', 'en')).status).toBe(404)
    expect((await single('vanocni-cukrovi', 'en')).status).toBe(404)
    expect((await list('en'))).toEqual([])
    // The default language is untouched, and no longer says it exists in English.
    const cs = (await single('vanocni-cukrovi', 'cs')).body.item
    expect(cs).toMatchObject({ locale: 'cs', locales: ['cs'], status: 'published' })
    expect(Object.keys(cs.paths)).toEqual(['cs'])
    expect((await list('cs')).map((i) => i.id)).toEqual([p.id])
  })

  it('leaves it out of the sitemap, the hreflang alternates and the search', async () => {
    const p = await translated()
    expect((await anonymous().get('/api/content/_search?q=christmas&locale=en')).body.total).toBe(1)
    await patchEn(p.id, { status: 'draft' })
    expect(await locs()).toEqual(['/blog/vanocni-cukrovi'])
    expect((await sitemap()).find((e) => e.loc === '/blog/vanocni-cukrovi')!.alternates).toEqual([{ locale: 'cs', loc: '/blog/vanocni-cukrovi' }])
    expect((await anonymous().get('/api/content/_search?q=christmas&locale=en')).body.total).toBe(0)
    expect((await anonymous().get('/api/content/_search?q=vanocni&locale=cs')).body.total).toBe(1)
    // The XML sitemap the website serves follows.
    const xml = await (await fetch(`${anonymous().baseURL}/sitemap.xml`)).text()
    expect(xml).toContain('/blog/vanocni-cukrovi')
    expect(xml).not.toContain('christmas-cookies')
  })

  it('works for a language without a translation row (it was served through the default language)', async () => {
    const p = await post({ slug: 'bez-prekladu', title: 'Bez překladu' })
    expect((await single('bez-prekladu', 'en')).status).toBe(200)
    const res = await patchEn(p.id, { status: 'draft' })
    expect(res.status).toBe(200)
    expect(res.body.row).toMatchObject({ __stateOwn: true, __translated: false })
    // A row that holds only the state is not a translation.
    expect((await db.query('select count(*)::int as n from post_locales')).rows[0].n).toBe(1)
    expect((await admin.get(`/api/cms/post/${p.id}`)).body.row.__locales).toEqual(['cs'])
    expect((await single('bez-prekladu', 'en')).status).toBe(404)
    expect((await single('bez-prekladu', 'cs')).status).toBe(200)
    // Following the default language again removes the row it only held for the state.
    expect((await patchEn(p.id, { status: null })).body.row).toMatchObject({ __stateOwn: false })
    expect((await db.query('select count(*)::int as n from post_locales')).rows[0].n).toBe(0)
    expect((await single('bez-prekladu', 'en')).status).toBe(200)
  })

  it('shows the draft translation to an editor\'s preview, and to the content token\'s', async () => {
    const p = await translated()
    await patchEn(p.id, { status: 'draft' })
    const preview = await admin.get('/api/content/post/christmas-cookies?locale=en&preview')
    expect(preview.status).toBe(200)
    expect(preview.body).toMatchObject({ preview: true, item: { title: 'Christmas cookies', status: 'draft', locales: ['cs', 'en'] } })
    expect((await anonymous().get('/api/content/post/christmas-cookies?locale=en&preview')).status).toBe(404)
  })

  it('makes what links to it read as a draft in that language only', async () => {
    const p = await translated()
    const ref = `cms:post/${p.id}`
    const state = async (locale: string) => (await admin.post('/api/cms/_links/resolve', { refs: [ref], locale })).body.items[ref].state
    expect(await state('en')).toBe('live')
    await patchEn(p.id, { status: 'draft' })
    expect(await state('en')).toBe('draft')
    expect(await state('cs')).toBe('live')
    const picked = async (locale: string) => (await admin.get(`/api/cms/_links?locale=${locale}&q=cookies`)).body.items.concat((await admin.get(`/api/cms/_links?locale=${locale}&q=cukrov`)).body.items)
    expect((await picked('en')).filter((i: any) => i.id === p.id).every((i: any) => !i.published)).toBe(true)
  })
})

describe('the default language gates every language', () => {
  const state = async (id: string, locale = 'en') => (await admin.get(`/api/cms/post/${id}`)).body.row.__states[locale]
  const nothingPublic = async () => {
    for (const locale of ['cs', 'en']) {
      expect((await single('vanocni-cukrovi', locale)).status).toBe(404)
      expect((await single('christmas-cookies', locale)).status).toBe(404)
      expect(await list(locale)).toEqual([])
    }
    expect(await locs()).toEqual([])
    for (const [q, locale] of [['christmas', 'en'], ['vanocni', 'cs'], ['vanocni', 'en']]) expect((await anonymous().get(`/api/content/_search?q=${q}&locale=${locale}`)).body.total).toBe(0)
  }

  it('keeps a translation off the website while the default language is a draft, with nothing of the draft public', async () => {
    const p = await post({ status: 'draft' })
    expect((await patchEn(p.id, { title: 'Christmas cookies', slug: 'christmas-cookies', status: 'published' })).status).toBe(200)
    // Published on its own, but the default language is a draft: the item, the list, the sitemap, hreflang and the search have none of it.
    await nothingPublic()
    // The admin says why.
    expect(await state(p.id)).toMatchObject({ state: 'published', own: true, waitingFor: 'cs' })
    expect((await patchEn(p.id, { title: 'Christmas cookies' })).body.row.__states.en).toMatchObject({ waitingFor: 'cs' })
    // An editor's preview still sees the draft translation (and, shared fields, the draft).
    expect((await admin.get('/api/content/post/christmas-cookies?locale=en&preview')).status).toBe(200)
    // Links to it read as a draft in every language.
    const ref = `cms:post/${p.id}`
    for (const locale of ['cs', 'en']) expect((await admin.post('/api/cms/_links/resolve', { refs: [ref], locale })).body.items[ref].state).toBe('draft')

    // The default language goes live: the translation goes with it, in its own words, falling back for the rest.
    await admin.patch(`/api/cms/post/${p.id}`, { status: 'published' })
    const en = await single('christmas-cookies', 'en')
    expect(en.status).toBe(200)
    expect(en.body.item).toMatchObject({ title: 'Christmas cookies', status: 'published', locale: 'en', locales: ['cs', 'en'] })
    expect(JSON.stringify(en.body.item.body)).toContain('Česky')
    expect(await locs()).toEqual(['/blog/vanocni-cukrovi', '/en/blog/christmas-cookies'])
    expect((await sitemap()).find((e) => e.locale === 'en')!.alternates.map((a) => a.locale)).toEqual(['cs', 'en'])
    expect(await state(p.id)).toMatchObject({ state: 'published', own: true })
    expect(await state(p.id)).not.toHaveProperty('waitingFor')
    // …and unpublishing it takes every language off, whatever its own state says.
    await admin.patch(`/api/cms/post/${p.id}`, { status: 'draft' })
    await nothingPublic()
    expect((await admin.get('/api/cms/post')).body.rows[0].__states.en).toMatchObject({ state: 'published', waitingFor: 'cs' })
  })

  it('still lets a language be unpublished on its own while the default language is live', async () => {
    const p = await translated()
    expect((await patchEn(p.id, { status: 'draft' })).status).toBe(200)
    expect((await single('christmas-cookies', 'en')).status).toBe(404)
    expect((await single('vanocni-cukrovi', 'cs')).status).toBe(200)
    expect(await state(p.id)).toMatchObject({ state: 'draft', own: true })
  })

  it('makes a following language exactly as live as the default language', async () => {
    const p = await translated({ status: 'draft' })
    expect(await state(p.id)).toMatchObject({ state: 'draft', own: false })
    expect((await single('christmas-cookies', 'en')).status).toBe(404)
    await admin.patch(`/api/cms/post/${p.id}`, { status: 'published' })
    expect((await single('christmas-cookies', 'en')).status).toBe(200)
  })

  it('is live from the later of the two dates when the default language is scheduled', async () => {
    const p = await translated({ publishedAt: inSeconds(3600) })
    // English publishes on its own now; Czech is scheduled for later: English waits for it.
    expect((await patchEn(p.id, { status: 'published', publishedAt: inSeconds(-60) })).status).toBe(200)
    expect((await single('christmas-cookies', 'en')).status).toBe(404)
    const waiting = await state(p.id)
    expect(waiting).toMatchObject({ state: 'scheduled', own: true })
    expect(new Date(waiting.date).getTime()).toBeGreaterThan(Date.now() + 3000 * 1000)
    // Czech goes live (its date has come): English with it.
    await db.query(`update post set published_at = now() - interval '1 minute' where id = $1`, [p.id])
    expect((await single('christmas-cookies', 'en')).status).toBe(200)
    // English scheduled after Czech: English waits for its own date.
    await patchEn(p.id, { status: 'published', publishedAt: inSeconds(3600) })
    expect((await single('vanocni-cukrovi', 'cs')).status).toBe(200)
    expect((await single('christmas-cookies', 'en')).status).toBe(404)
    expect(await state(p.id)).toMatchObject({ state: 'scheduled', own: true })
  })

  it('publishes a language on its own only to follow the default language: nothing to announce while the default language is a draft', async () => {
    const p = await translated({ status: 'draft' })
    const mark = hooksMark()
    await patchEn(p.id, { status: 'published' })
    await new Promise((r) => setTimeout(r, 700))
    expect(receivedHooks(mark).filter((h) => h.path === '/ok' && h.json.id === p.id && (h.json.type === 'entry.published' || h.json.type === 'entry.unpublished') && h.json.public)).toEqual([])
  })
})

describe('publishing one language alone', () => {
  it('refuses a status other than the entry\'s own, and a date without one', async () => {
    const p = await translated()
    expect((await patchEn(p.id, { status: 'archived' })).status).toBe(422)
    const dated = await patchEn(p.id, { publishedAt: inSeconds(60) })
    expect(dated.status).toBe(422)
    expect(dated.body.data[0].path).toEqual(['publishedAt'])
    // Nothing changed.
    expect((await admin.get(`/api/cms/post/${p.id}`)).body.row.__states.en.own).toBe(false)
  })

  it('stamps the publish date when the language is published without one, as the entry\'s own is', async () => {
    const p = await translated({ status: 'draft' })
    const res = await patchEn(p.id, { status: 'published' })
    expect(res.body.row.publishedAt).toBeTruthy()
    expect(new Date(res.body.row.publishedAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000)
  })
})

describe('a language with its own schedule', () => {
  it('stays off the website until its date, then goes live and is announced as that language', async () => {
    const p = await translated()
    const res = await patchEn(p.id, { status: 'published', publishedAt: inSeconds(40) })
    expect(res.body.row.__states.en).toMatchObject({ state: 'scheduled', own: true })
    // Czech is live; English waits.
    expect((await single('vanocni-cukrovi', 'cs')).status).toBe(200)
    expect((await single('christmas-cookies', 'en')).status).toBe(404)
    expect((await list('en'))).toEqual([])
    expect(await locs()).toEqual(['/blog/vanocni-cukrovi'])

    // The scheduler's first run on a fresh database starts from "now"; wait for it.
    const deadline = Date.now() + 5000
    while (!(await db.query(`select 1 from cms_state where key = 'scheduler.lastRun'`)).rowCount && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
    const mark = hooksMark()
    await db.query(`update post_locales set published_at = now(), updated_at = now() - interval '1 minute' where parent_id = $1`, [p.id])
    expect((await single('christmas-cookies', 'en')).status).toBe(200)
    const hooks = await waitForHooks(mark, (h) => h.some((x) => x.path === '/ok' && x.json.id === p.id && x.json.locale === 'en' && x.json.type === 'entry.published'), 10_000)
    const event = hooks.find((x) => x.path === '/ok' && x.json.id === p.id && x.json.locale === 'en')!.json
    expect(event).toMatchObject({ type: 'entry.published', locale: 'en', public: true, paths: ['/en/blog/christmas-cookies'] })
  }, 25_000)

  it('holds a language back while the default language is not live, and announces both when the default language goes live', async () => {
    const p = await translated({ publishedAt: inSeconds(3600) }) // Czech is scheduled far ahead
    const deadline = Date.now() + 5000
    while (!(await db.query(`select 1 from cms_state where key = 'scheduler.lastRun'`)).rowCount && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
    // English publishes on its own date, which passes while Czech is still waiting: nothing is announced, it is not on the website.
    expect((await patchEn(p.id, { status: 'published', publishedAt: inSeconds(2) })).status).toBe(200)
    const mark = hooksMark()
    await new Promise((r) => setTimeout(r, 4500))
    expect(receivedHooks(mark).filter((h) => h.path === '/ok' && h.json.id === p.id && h.json.type === 'entry.published')).toEqual([])
    expect((await single('christmas-cookies', 'en')).status).toBe(404)

    // Czech goes live: it is announced (every language's address in it), and English is announced as its own language.
    const mark2 = hooksMark()
    await db.query(`update post set published_at = now(), updated_at = now() - interval '1 minute' where id = $1`, [p.id])
    const pub = (h: ReceivedHook[], locale: string | null) => h.find((x) => x.path === '/ok' && x.json.id === p.id && x.json.type === 'entry.published' && x.json.locale === locale)
    const hooks = await waitForHooks(mark2, (h) => !!pub(h, null) && !!pub(h, 'en'), 10_000)
    expect([...pub(hooks, null)!.json.paths].sort()).toEqual(['/blog/vanocni-cukrovi', '/en/blog/christmas-cookies'])
    expect(pub(hooks, 'en')!.json).toMatchObject({ public: true, paths: ['/en/blog/christmas-cookies'] })
    expect((await single('christmas-cookies', 'en')).status).toBe(200)
  }, 30_000)
})

describe('webhooks', () => {
  it('announce publishing and unpublishing a language, with that language and its addresses only', async () => {
    const p = await translated()
    const mark = hooksMark()
    await patchEn(p.id, { status: 'draft' })
    const un = (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.id === p.id && x.json.type === 'entry.unpublished')
    const off = un(await waitForHooks(mark, (h) => !!un(h)))!.json
    expect(off).toMatchObject({ type: 'entry.unpublished', locale: 'en', public: true, paths: ['/en/blog/christmas-cookies'] })
    expect(off).toHaveProperty('delivery')
    expect(off).not.toHaveProperty('by')

    const mark2 = hooksMark()
    await patchEn(p.id, { status: 'published' })
    const pub = (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.id === p.id && x.json.type === 'entry.published')
    expect(pub(await waitForHooks(mark2, (h) => !!pub(h)))!.json).toMatchObject({ type: 'entry.published', locale: 'en', public: true, paths: ['/en/blog/christmas-cookies'] })
  })

  it('purge the address of a language served through the default language when it goes off', async () => {
    const p = await post({ slug: 'bez-prekladu', title: 'Bez překladu' })
    const mark = hooksMark()
    await patchEn(p.id, { status: 'draft' })
    const un = (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.id === p.id && x.json.type === 'entry.unpublished')
    expect(un(await waitForHooks(mark, (h) => !!un(h)))!.json).toMatchObject({ locale: 'en', paths: ['/en/blog/bez-prekladu'] })
  })

  it('send nothing public for a language that is not live', async () => {
    const p = await translated()
    // Wait for the hooks of the steps before (delivery is asynchronous), so none lands after the mark.
    const mark0 = hooksMark()
    await patchEn(p.id, { status: 'draft' })
    const un = (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.id === p.id && x.json.type === 'entry.unpublished')
    await waitForHooks(mark0, (h) => !!un(h))
    const mark = hooksMark()
    await patchEn(p.id, { title: 'Christmas biscuits' })
    await new Promise((r) => setTimeout(r, 700))
    // A late hook of the default language's own publishing is not about English: only English counts here.
    expect(receivedHooks(mark).filter((h) => h.path === '/ok' && h.json.id === p.id && h.json.locale !== null)).toEqual([])
  })

  it('a change to the default language still names every language that is live', async () => {
    const p = await translated()
    const mark = hooksMark()
    await admin.patch(`/api/cms/post/${p.id}`, { title: 'Vánoční cukroví 2' })
    const up = (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.id === p.id && x.json.type === 'entry.updated')
    const json = up(await waitForHooks(mark, (h) => !!up(h)))!.json
    expect(json.locale).toBeNull()
    expect([...json.paths].sort()).toEqual(['/blog/vanocni-cukrovi', '/en/blog/christmas-cookies'])
  })
  it('unpublishing the default language names every language that was live (one with a translation or a state of its own), and not one that was off', async () => {
    const withText = await translated()
    const through = await post({ slug: 'bez-prekladu', title: 'Bez překladu' })
    const ownLive = await post({ slug: 'vlastni-stav', title: 'Vlastní stav' })
    await patchEn(ownLive.id, { status: 'published' })
    const off = await post({ slug: 'anglicky-vypnuto', title: 'Anglicky vypnuto' })
    await patchEn(off.id, { status: 'draft' })
    const down = async (id: string, status = 'draft') => {
      const mark = hooksMark()
      await admin.patch(`/api/cms/post/${id}`, { status })
      const type = status === 'draft' ? 'entry.unpublished' : 'entry.published'
      const find = (h: ReceivedHook[]) => h.find((x) => x.path === '/ok' && x.json.id === id && x.json.type === type)
      const json = find(await waitForHooks(mark, (h) => !!find(h)))!.json
      expect(json.locale).toBeNull()
      return [...json.paths].sort()
    }
    expect(await down(withText.id)).toEqual(['/blog/vanocni-cukrovi', '/en/blog/christmas-cookies'])
    // A language served only through the default language has no row: as ever, a change to the default language does not list it.
    expect(await down(through.id)).toEqual(['/blog/bez-prekladu'])
    expect(await down(ownLive.id)).toEqual(['/blog/vlastni-stav', '/en/blog/vlastni-stav'])
    expect(await down(off.id)).toEqual(['/blog/anglicky-vypnuto'])
    // And back: each language that is live again, the one that stayed off excluded.
    expect(await down(through.id, 'published')).toEqual(['/blog/bez-prekladu'])
    expect(await down(off.id, 'published')).toEqual(['/blog/anglicky-vypnuto'])
  })

})

describe('who may publish a language', () => {
  it('is whoever may publish the entry: an author writes the translation as a draft and cannot publish it', async () => {
    const mine = await createPost(author, { author: byline.id, title: 'Můj článek', slug: 'muj-clanek' })
    expect((await patchEn(mine.id, { title: 'My post', slug: 'my-post' }, author)).status).toBe(200)
    const refused = await patchEn(mine.id, { status: 'published' }, author)
    expect(refused.status).toBe(403)
    expect((await patchEn(mine.id, { status: 'draft' }, author)).status).toBe(403)
    expect((await patchEn(mine.id, { status: null }, author)).status).toBe(403)
  })

  it('does not let an author change a language that is live, but lets them write one that is not', async () => {
    const mine = await createPost(author, { author: byline.id, title: 'Můj článek', slug: 'muj-clanek' })
    await patchEn(mine.id, { title: 'My post', slug: 'my-post' }, author)
    // The editor publishes English on its own; Czech stays a draft.
    expect((await patchEn(mine.id, { status: 'published' })).status).toBe(200)
    expect((await patchEn(mine.id, { title: 'My post, edited' }, author)).status).toBe(403)
    // The Czech draft is the author's to write; the English live one is not.
    expect((await author.patch(`/api/cms/post/${mine.id}`, { title: 'Můj článek 2' })).status).toBe(200)
    // Back to a draft by an editor: the author may write again.
    await patchEn(mine.id, { status: 'draft' })
    expect((await patchEn(mine.id, { title: 'My post, edited' }, author)).status).toBe(200)
  })
})

describe('the dashboard and the admin search follow each language', () => {
  const overview = async () => (await admin.get('/api/cms/_overview')).body as { drafts: any[]; scheduled: any[] }
  const found = async (q: string) => ((await admin.get(`/api/cms/_search?q=${q}`)).body.items as any[]).filter((i) => i.entity === 'post')

  it('lists a language that is a draft, or scheduled on its own, with that language', async () => {
    const p = await translated()
    expect((await overview()).drafts.filter((d) => d.id === p.id)).toEqual([])
    await patchEn(p.id, { status: 'draft' })
    expect((await overview()).drafts.filter((d) => d.id === p.id)).toEqual([expect.objectContaining({ entity: 'post', locale: 'en', published: false })])
    await patchEn(p.id, { status: 'published', publishedAt: inSeconds(3600) })
    const o = await overview()
    expect(o.drafts.filter((d) => d.id === p.id)).toEqual([])
    expect(o.scheduled.filter((d) => d.id === p.id)).toEqual([expect.objectContaining({ locale: 'en', published: true })])
  })

  it('shows the state of the language a hit was found in, and a language held back by a draft default language as waiting', async () => {
    const p = await translated()
    expect((await found('christmas'))[0]).toMatchObject({ id: p.id, status: 'published' })
    await patchEn(p.id, { status: 'draft' })
    expect((await found('christmas'))[0]).toMatchObject({ id: p.id, status: 'draft' })
    // The Czech hit is still the live Czech entry.
    expect((await found('vanocni'))[0]).toMatchObject({ id: p.id, status: 'published' })
    await patchEn(p.id, { status: 'published' })
    await admin.patch(`/api/cms/post/${p.id}`, { status: 'draft' })
    expect((await found('christmas'))[0]).toMatchObject({ id: p.id, status: 'waiting' })
  })
})

describe('history', () => {
  it('records publishing a language in that language\'s history, with its state', async () => {
    const p = await translated({ status: 'draft' })
    await patchEn(p.id, { status: 'published' })
    await patchEn(p.id, { status: 'draft' })
    const history = (await admin.get(`/api/cms/post/${p.id}/revisions?locale=en`)).body.revisions as any[]
    expect(history.map((r) => r.action)).toEqual(['entry.unpublished', 'entry.published', 'translation.updated'])
    expect(history[1].changed).toContain('status')
    const snap = (await admin.get(`/api/cms/post/${p.id}/revisions/${history[1].id}`)).body.revision.data
    expect(snap).toMatchObject({ title: 'Christmas cookies', status: 'published' })
    // The entry's own history has none of it.
    expect(((await admin.get(`/api/cms/post/${p.id}/revisions`)).body.revisions as any[]).map((r) => r.action)).toEqual(['entry.created'])
  })
})

describe('entities without it', () => {
  it('keep one state for every language: a translation of a page carries no status', async () => {
    const page = (await admin.post('/api/cms/page', { title: 'O nás', slug: 'o-nas', status: 'published' })).body.row
    expect((await admin.request('PATCH', `/api/cms/page/${page.id}?locale=en`, { json: { title: 'About', status: 'draft' } })).status).toBe(422)
    expect((await admin.get(`/api/cms/page/${page.id}?locale=en`)).body.row.__states).toBeUndefined()
  })
})
