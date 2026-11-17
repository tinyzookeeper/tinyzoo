import { PgDialect } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type Client, doc, newAccount, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'
import { jsonFilledSql } from '../../packages/cms/server/utils/cmsTranslationWork'
import { hasTranslatedText } from '../../packages/cms/server/utils/cmsLocales'

// Translators find their work. The home page lists what needs translating — live (or scheduled) in Czech,
// and in English not translated yet, being translated, or a draft of its own — for whoever may write that
// English (the role, the entity's own rules, the field rules, and for someone who may not publish, a language
// that is not live). The list filters by where a language stands (`filter.lang:en=missing`, …), on the server,
// and "View all" on the home page is the list filtered by `todo`, so the two agree.
//
// Playground: post publishes per language; tag (translated name, no drafts) and page (a tree, one state for all
// languages) have translations too. translator: updates posts and pages, never publishes. curator: only reads
// posts and cannot read post.location (a translated field). The built-in author changes only their own posts.
const db = testDb()
let admin: Client
let editor: Client
let author: Client
let translator: Client
let curator: Client
let byline: any
beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
  author = await signIn('author')
  translator = (await newAccount('translator')).client
  curator = (await newAccount('curator')).client
})
beforeEach(async () => {
  await truncateAll(db)
  byline = await createAuthor(admin)
})
afterAll(() => db.end())

const en = (c: Client, id: string, body: Record<string, unknown>) => c.patch(`/api/cms/post/${id}?locale=en`, body)
const overview = async (c: Client) => {
  const res = await c.get('/api/cms/_overview')
  expect(res.status).toBe(200)
  return res.body.translate as { items: any[]; total: number; groups: { entity: string; locale: string; count: number }[] }
}
/** The (title, language, state) of what the home page lists for this person, newest first. */
const work = async (c: Client) => (await overview(c)).items.map((i) => `${i.title}|${i.locale}|${i.state}${i.review ? '|review' : ''}`)
const list = async (c: Client, query: string, entity = 'post') => {
  const res = await c.get(`/api/cms/${entity}?${query}`)
  expect(res.status).toBe(200)
  return res.body as { rows: any[]; total: number }
}
const titles = async (c: Client, query: string, entity = 'post') => (await list(c, query, entity)).rows.map((r) => r.title).sort()
const lang = (state: string, code = 'en') => `${encodeURIComponent(`filter.lang:${code}`)}=${state}`
const live = (title: string, over: Record<string, unknown> = {}) => createPost(admin, { author: byline.id, status: 'published', title, ...over })
const tick = () => new Promise((r) => setTimeout(r, 15))

/**
 * One post for each place an English translation can be in (Czech live unless said):
 *  missing: nothing in English · draftNoEn: a Czech draft, nothing in English · translating: started, never on the website ·
 *  takenOff: English was live, an editor took it off · following: translated, follows Czech (live) · draftFollowing: a
 *  Czech draft with an English translation that follows it.
 */
async function everyState() {
  const missing = await live('Chybí')
  const draftNoEn = await createPost(admin, { author: byline.id, status: 'draft', title: 'Koncept bez EN' })
  const translating = await live('Překládá se')
  expect((await en(translator, translating.id, { title: 'Being translated', slug: 'being-translated', body: doc('EN') })).status).toBe(200)
  const takenOff = await live('Staženo')
  expect((await en(editor, takenOff.id, { title: 'Taken off', slug: 'taken-off', body: doc('EN'), status: 'published' })).status).toBe(200)
  expect((await en(editor, takenOff.id, { status: 'draft' })).status).toBe(200)
  const following = await live('Na webu')
  expect((await en(editor, following.id, { title: 'On the website', slug: 'on-the-website', body: doc('EN'), status: null })).status).toBe(200)
  const draftFollowing = await createPost(admin, { author: byline.id, status: 'draft', title: 'Koncept s EN' })
  expect((await en(editor, draftFollowing.id, { title: 'Draft with English', slug: 'draft-with-english', body: doc('EN'), status: null })).status).toBe(200)
  return { missing, draftNoEn, translating, takenOff, following, draftFollowing }
}

describe('the list filter: where a language stands', () => {
  it('each state matches its posts, and none of them overlap', async () => {
    await everyState()
    expect(await titles(editor, lang('missing'))).toEqual(['Chybí', 'Koncept bez EN'])
    expect(await titles(editor, lang('translating'))).toEqual(['Překládá se'])
    expect(await titles(editor, lang('draft'))).toEqual(['Koncept s EN', 'Staženo'])
    expect(await titles(editor, lang('published'))).toEqual(['Na webu'])
    expect(await titles(editor, lang('translated'))).toEqual(['Koncept s EN', 'Na webu', 'Překládá se', 'Staženo'])
    // Several at once: any of them.
    expect(await titles(editor, lang('missing,translating'))).toEqual(['Chybí', 'Koncept bez EN', 'Překládá se'])
    // Needs translating: live in Czech, and in English missing, being translated or a draft of its own.
    expect(await titles(editor, lang('todo'))).toEqual(['Chybí', 'Překládá se', 'Staženo'])
    // The count is the filtered count, with the status tabs on top of it.
    expect((await list(editor, lang('missing'))).total).toBe(2)
    expect(await titles(editor, `${lang('missing')}&status=draft`)).toEqual(['Koncept bez EN'])
    // A language that waits for Czech, or is scheduled, is in none of the four.
    const waiting = await createPost(admin, { author: byline.id, status: 'draft', title: 'Čeká na češtinu' })
    expect((await en(editor, waiting.id, { title: 'Waiting', slug: 'waiting', body: doc('EN'), status: 'published' })).status).toBe(200)
    for (const s of ['missing', 'translating', 'draft', 'published']) expect(await titles(editor, lang(s))).not.toContain('Čeká na češtinu')
  })

  it('pages through the filtered rows, with the right total', async () => {
    for (let i = 0; i < 23; i++) await live(`Článek ${String(i).padStart(2, '0')}`)
    const done = await live('Přeloženo')
    expect((await en(editor, done.id, { title: 'Translated', slug: 'translated', body: doc('EN'), status: null })).status).toBe(200)
    const page = (n: number) => list(editor, `${lang('missing')}&limit=10&page=${n}&sort=title&dir=asc`)
    const [p1, p2, p3] = [await page(1), await page(2), await page(3)]
    expect([p1.total, p2.total, p3.total]).toEqual([23, 23, 23])
    expect([p1.rows.length, p2.rows.length, p3.rows.length]).toEqual([10, 10, 3])
    const all = [...p1.rows, ...p2.rows, ...p3.rows].map((r) => r.title)
    expect(new Set(all).size).toBe(23)
    expect(all).not.toContain('Přeloženo')
    expect((await list(editor, `${lang('published')}&limit=10`)).total).toBe(1)
  })

  it('a translated field the person may not read never says whether it is translated', async () => {
    // English holds only the place (post.location), which the curator cannot read.
    const placeOnly = await live('Jen místo')
    expect((await en(editor, placeOnly.id, { location: { place: 'Gym' }, status: null })).status).toBe(200)
    await live('Nic')
    // For the editor the place is a translation; for the curator nothing they can read is.
    expect(await titles(editor, lang('missing'))).toEqual(['Nic'])
    expect(await titles(editor, lang('published'))).toEqual(['Jen místo'])
    expect(await titles(curator, lang('missing'))).toEqual(['Jen místo', 'Nic'])
    expect(await titles(curator, lang('published'))).toEqual([])
    // The list's language column agrees, and the rows carry no place.
    const forCurator = (await list(curator, lang('missing'))).rows
    expect(forCurator.find((r) => r.id === placeOnly.id).__locales).toEqual(['cs'])
    expect(forCurator.every((r) => !('location' in r))).toBe(true)
    expect((await list(editor, '')).rows.find((r) => r.id === placeOnly.id).__locales).toEqual(['cs', 'en'])
    // The CSV holds what the list shows.
    const csv = await curator.get(`/api/cms/post/_export?${lang('published')}`)
    expect(csv.status).toBe(200)
    expect(String(csv.body)).not.toContain('Jen místo')
  })

  it('works on collections that publish as one and on those without drafts', async () => {
    await createTag(admin, { name: 'Bez překladu' })
    const t = await createTag(admin, { name: 'S překladem' })
    expect((await admin.patch(`/api/cms/tag/${t.id}?locale=en`, { name: 'Translated' })).status).toBe(200)
    expect((await list(editor, lang('missing'), 'tag')).rows.map((r) => r.name)).toEqual(['Bez překladu'])
    expect((await list(editor, lang('translated'), 'tag')).rows.map((r) => r.name)).toEqual(['S překladem'])
    // A page tree publishes all its languages together: a live page translated is on the website in English.
    const pg = await admin.post('/api/cms/page', { title: 'O nás', slug: 'o-nas', status: 'published', sections: [] })
    expect(pg.status).toBe(201)
    await admin.post('/api/cms/page', { title: 'Kontakt', slug: 'kontakt', status: 'published', sections: [] })
    expect((await admin.patch(`/api/cms/page/${pg.body.row.id}?locale=en`, { title: 'About', slug: 'about' })).status).toBe(200)
    expect(await titles(editor, lang('missing'), 'page')).toEqual(['Kontakt'])
    expect(await titles(editor, lang('published'), 'page')).toEqual(['O nás'])
    expect(await titles(editor, lang('translating'), 'page')).toEqual([])
  })

  it('ignores what it does not know: another language, the default one, a made-up state', async () => {
    await everyState()
    const all = (await list(editor, '')).total
    expect((await list(editor, lang('missing', 'xx'))).total).toBe(all)
    expect((await list(editor, lang('missing', 'cs'))).total).toBe(all)
    expect((await list(editor, lang('bogus'))).total).toBe(all)
    // A collection without translations ignores it too.
    expect((await list(editor, lang('missing'), 'author')).total).toBe(1)
  })
})

describe('the home page: needs translating', () => {
  it('lists, newest first, what a translator may translate, in the same words as the list', async () => {
    const s = await everyState()
    await tick()
    // Touched last: rises to the top.
    expect((await en(translator, s.translating.id, { body: doc('EN, more') })).status).toBe(200)
    expect(await work(translator)).toEqual(['Překládá se|en|translating', 'Staženo|en|draft', 'Chybí|en|missing'])
    const t = await overview(translator)
    expect(t.total).toBe(3)
    expect(t.groups).toEqual([{ entity: 'post', locale: 'en', count: 3 }])
    // "View all" is the list filtered by `todo`: the same posts.
    expect(await titles(translator, lang('todo'))).toEqual(['Chybí', 'Překládá se', 'Staženo'])
  })

  it('an editor sees the same posts, can review what is translated, and also the tags and pages', async () => {
    const s = await everyState()
    await createTag(admin, { name: 'Štítek' })
    await admin.post('/api/cms/page', { title: 'Kontakt', slug: 'kontakt', status: 'published', sections: [] })
    await tick()
    expect((await en(translator, s.translating.id, { body: doc('EN, more') })).status).toBe(200)
    const items = await work(editor)
    expect(items.filter((i) => !i.startsWith('Štítek') && !i.startsWith('Kontakt')))
      .toEqual(['Překládá se|en|translating|review', 'Staženo|en|draft|review', 'Chybí|en|missing'])
    expect(items).toEqual(expect.arrayContaining(['Štítek|en|missing', 'Kontakt|en|missing']))
    const t = await overview(editor)
    expect(t.total).toBe(5)
    expect(t.groups).toEqual(expect.arrayContaining([
      { entity: 'post', locale: 'en', count: 3 },
      { entity: 'tag', locale: 'en', count: 1 },
      { entity: 'page', locale: 'en', count: 1 },
    ]))
    for (const g of t.groups) expect((await list(editor, lang('todo'), g.entity)).total).toBe(g.count)
  })

  it('a translator does not see what they cannot write: tags (read only), live pages (one state for all languages)', async () => {
    await createTag(admin, { name: 'Štítek' })
    await admin.post('/api/cms/page', { title: 'Kontakt', slug: 'kontakt', status: 'published', sections: [] })
    expect(await work(translator)).toEqual([])
    expect((await overview(translator)).groups).toEqual([])
    expect((await list(translator, lang('todo'), 'page')).total).toBe(0)
    expect((await list(translator, lang('missing'), 'page')).total).toBe(1)
  })

  it('a role that only reads posts sees nothing; an author sees their own posts only', async () => {
    await live('Cizí')
    // The author's own post, which an editor published.
    const mine = await author.post('/api/cms/post', { title: 'Můj', slug: 'muj', author: byline.id, body: doc('Česky') })
    expect(mine.status).toBe(201)
    expect((await editor.patch(`/api/cms/post/${mine.body.row.id}`, { status: 'published' })).status).toBe(200)
    expect(await work(curator)).toEqual([])
    expect((await overview(curator)).total).toBe(0)
    expect((await list(curator, lang('todo'))).total).toBe(0)
    expect(await work(author)).toEqual(['Můj|en|missing'])
    expect(await work(editor)).toEqual(expect.arrayContaining(['Můj|en|missing', 'Cizí|en|missing']))
  })

  it('counts a scheduled post, leaves drafts out, and drops a language once it is on the website', async () => {
    const soon = await live('Brzy', { publishedAt: new Date(Date.now() + 86_400_000).toISOString() })
    await createPost(admin, { author: byline.id, status: 'draft', title: 'Koncept' })
    expect(await work(translator)).toEqual(['Brzy|en|missing'])
    expect((await en(translator, soon.id, { title: 'Soon', slug: 'soon', body: doc('EN') })).status).toBe(200)
    expect(await work(translator)).toEqual(['Brzy|en|translating'])
    expect((await en(editor, soon.id, { status: 'published' })).status).toBe(200)
    expect(await work(translator)).toEqual([])
  })

  it('says nothing when everything is translated', async () => {
    const p = await live('Hotovo')
    expect((await en(editor, p.id, { title: 'Done', slug: 'done', body: doc('EN'), status: null })).status).toBe(200)
    expect(await overview(editor)).toEqual({ items: [], total: 0, groups: [] })
  })
})

describe('what counts as translated: SQL and the admin agree', () => {
  const values: unknown[] = [
    null, '', 'x', ' ', 0, 1, true, false, [], [1], {},
    { type: 'doc', content: [] }, { type: 'doc', content: [{ type: 'paragraph' }] }, { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }] }, { type: 'doc', content: [{ type: 'image' }] },
    { place: '', note: null }, { place: 'Gym', note: null }, { flag: false }, { inner: { place: '' } }, { inner: { place: 'x' } }, { items: [] },
  ]
  it.each(values.map((v) => [JSON.stringify(v), v]))('%s', async (_name, v) => {
    const q = new PgDialect().sqlToQuery(sql`select coalesce(${jsonFilledSql(sql`${JSON.stringify(v)}::jsonb`)}, false) as filled`)
    const { rows } = await db.query(q.sql, q.params as any[])
    expect(rows[0].filled).toBe(hasTranslatedText({ localized: ['x'] } as any, { x: v }))
  })
})
