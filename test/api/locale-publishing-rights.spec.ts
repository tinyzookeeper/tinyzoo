import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, doc, newAccount, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

// Who may change a language (post.publish.perLocale in the playground), and what the editor is told about it.
//   translator   extends editor, may update posts, never publishes; post.location is the editors' (a field rule)
//   proofreader  the same, but its role is in the field rule: nothing but the publish rule can stop it
//   author       the built-in role: its own posts, drafts only (also held by the field rule)
//   editor       publishes
// A language's own state decides whether someone who may not publish can write it: its own while it has one, else the
// default language's (it follows). A language with no translation yet can always be written: a first translation of a
// published entry starts as being translated (a draft never on the website, which visitors do not see), one of a draft
// follows it. The default language gates what visitors see; this is about who may write.
const db = testDb()
let admin: Client
let editor: Client
let author: Client
let translator: Client
let proofreader: Client
let byline: any
let n = 0

beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
  author = await signIn('author')
  translator = (await newAccount('translator')).client
  proofreader = (await newAccount('proofreader')).client
})
beforeEach(async () => {
  await truncateAll(db)
  byline = await createAuthor(admin)
})
afterAll(() => db.end())

type Default = 'draft' | 'published'
// none: no translation; translating: a first translation written while Czech was live (never published); draft: taken off
type English = 'none' | 'translating' | 'follows' | 'draft' | 'published'
const patchEn = (c: Client, id: string, body: Record<string, unknown>) => c.request('PATCH', `/api/cms/post/${id}?locale=en`, { json: body })
const single = (slug: string, locale: string) => anonymous().get(`/api/content/post/${slug}?locale=${locale}`)

/** A post the built-in author made (so the author may touch it), with an English translation, in the given states. */
async function make(def: Default, en: English) {
  const k = ++n
  const p = await createPost(author, { author: byline.id, title: `Titulek ${k}`, slug: `titulek-${k}`, body: doc('Česky') })
  if (en === 'translating') {
    expect((await admin.patch(`/api/cms/post/${p.id}`, { status: 'published' })).status).toBe(200)
    const started = await patchEn(admin, p.id, { title: `Title ${k}`, slug: `title-${k}` })
    expect(started.body.row.__states.en.translating).toBe(true)
    if (def === 'draft') expect((await admin.patch(`/api/cms/post/${p.id}`, { status: 'draft' })).status).toBe(200)
    return { ...p, k }
  }
  if (en !== 'none') expect((await patchEn(admin, p.id, { title: `Title ${k}`, slug: `title-${k}` })).status).toBe(200)
  if (def === 'published') expect((await admin.patch(`/api/cms/post/${p.id}`, { status: 'published' })).status).toBe(200)
  if (en === 'draft' || en === 'published') expect((await patchEn(admin, p.id, { status: en })).status).toBe(200)
  return { ...p, k }
}
const rows = async () => (await db.query('select locale, published from post_locales order by locale')).rows

const matrix: [Default, English][] = [
  ['published', 'none'], ['published', 'translating'], ['published', 'follows'], ['published', 'draft'], ['published', 'published'],
  ['draft', 'none'], ['draft', 'translating'], ['draft', 'follows'], ['draft', 'draft'], ['draft', 'published'],
]

describe('the editor\'s read-only switch and the save agree, for every state', () => {
  for (const [def, en] of matrix) {
    it(`Czech ${def}, English ${en}`, async () => {
      // Whoever may not publish can write a language that is not marked live, whatever the default language says: one with
      // no translation yet or being translated too (visitors do not see what they write).
      const live = en === 'published' || (en === 'follows' && def === 'published')
      for (const [name, c] of [['translator', translator], ['proofreader', proofreader], ['author', author]] as const) {
        const p = await make(def, en)
        const told = (await c.get(`/api/cms/post/${p.id}?locale=en`)).body.can
        const saved = await patchEn(c, p.id, { title: `Edited by ${name}` })
        expect(told.update, `${name}: told`).toBe(!live)
        expect(saved.status, `${name}: saved (${saved.status})`).toBe(told.update ? 200 : 403)
        if (live) expect(told.why).toBe('published')
        // A first translation of a live article is being translated; of a draft, it follows the draft.
        if (en === 'none') expect((await c.get(`/api/cms/post/${p.id}`)).body.row.__states.en).toMatchObject(def === 'published' ? { state: 'draft', translating: true } : { own: false })
      }
      // Whoever may publish is never held.
      const p = await make(def, en)
      expect((await editor.get(`/api/cms/post/${p.id}?locale=en`)).body.can.update).toBe(true)
      expect((await patchEn(editor, p.id, { title: 'Edited by the editor' })).status).toBe(200)
    })
  }

  it('says the same for the default language: its own state only', async () => {
    for (const def of ['draft', 'published'] as const) {
      const p = await make(def, 'follows')
      for (const c of [translator, proofreader, author]) {
        const told = (await c.get(`/api/cms/post/${p.id}`)).body.can.update
        const saved = (await c.patch(`/api/cms/post/${p.id}`, { title: 'Změněno' })).status
        expect(told).toBe(def === 'draft')
        expect(saved).toBe(told ? 200 : 403)
      }
    }
  })
})

describe('removing a translation that holds a state of its own', () => {
  it('is a change of state: whoever may not publish cannot do it (it would put the language on the website)', async () => {
    // Czech is live, English is its own draft: removing the row would make English follow Czech, so it would go live.
    const p = await make('published', 'draft')
    expect((await single(`title-${p.k}`, 'en')).status).toBe(404)
    for (const c of [proofreader, translator, author]) {
      const res = await c.delete(`/api/cms/post/${p.id}?locale=en`)
      expect(res.status).toBe(403)
    }
    // The proofreader is not held by the field rule on post.location, so it is the publish rule that refused.
    const refused = await proofreader.delete(`/api/cms/post/${p.id}?locale=en`)
    expect(JSON.stringify(refused.body)).toMatch(/publish/i)
    expect(await rows()).toEqual([{ locale: 'en', published: false }])
    expect((await single(`title-${p.k}`, 'en')).status).toBe(404)
    // Whoever may publish can, and English then follows Czech.
    expect((await editor.delete(`/api/cms/post/${p.id}?locale=en`)).status).toBe(200)
    expect(await rows()).toEqual([])
    expect((await single(`titulek-${p.k}`, 'en')).status).toBe(200)
  })

  it('is refused for a language marked published, too, even while the default language holds it back', async () => {
    const p = await make('draft', 'published')
    expect((await proofreader.delete(`/api/cms/post/${p.id}?locale=en`)).status).toBe(403)
    expect(await rows()).toEqual([{ locale: 'en', published: true }])
  })

  it('is still theirs to do for a language that only follows, while the default language is not live', async () => {
    const p = await make('draft', 'follows')
    expect(await rows()).toEqual([{ locale: 'en', published: null }])
    expect((await proofreader.delete(`/api/cms/post/${p.id}?locale=en`)).status).toBe(200)
    expect(await rows()).toEqual([])
    // …but not once it follows a live default language: that is changing what is live.
    const live = await make('published', 'follows')
    expect((await proofreader.delete(`/api/cms/post/${live.id}?locale=en`)).status).toBe(403)
  })

  it('cannot be got round by emptying the translation: a language with a state keeps its row', async () => {
    const p = await make('published', 'draft')
    const res = await patchEn(editor, p.id, { title: null, slug: null, body: null })
    expect(res.status).toBe(200)
    expect(await rows()).toEqual([{ locale: 'en', published: false }])
    expect((await single(`titulek-${p.k}`, 'en')).status).toBe(404)
  })
})

describe('shared editing of a language', () => {
  const session = (c: Client, id: string, locale?: string) => c.get(`/api/cms/_collab/session?entity=post&id=${id}${locale ? `&locale=${locale}` : ''}`)

  it('judges a translation by its own state, in both directions', async () => {
    // Czech live, English its own draft: the Czech document is read-only for a translator, the English one is theirs to type in.
    const open = await make('published', 'draft')
    expect((await session(translator, open.id)).body.access).toBe('read')
    expect((await session(translator, open.id, 'en')).body.access).toBe('write')
    expect((await session(proofreader, open.id, 'en')).body.access).toBe('write')
    // Czech a draft, English published on its own: Czech is theirs, English is marked live, so it is read-only.
    const held = await make('draft', 'published')
    expect((await session(translator, held.id)).body.access).toBe('write')
    expect((await session(translator, held.id, 'en')).body.access).toBe('read')
    // A language that follows is as live as the default language.
    const follows = await make('published', 'follows')
    expect((await session(translator, follows.id, 'en')).body.access).toBe('read')
    // One being translated, or not translated yet, is theirs to type in, though Czech is live.
    for (const en of ['translating', 'none'] as const) expect((await session(translator, (await make('published', en)).id, 'en')).body.access).toBe('write')
    // People who may publish write either.
    for (const id of [open.id, held.id]) expect((await session(editor, id, 'en')).body.access).toBe('write')
  })
})

describe('what Publish is offered to', () => {
  it('needs the status and the date to be fields the role may edit', async () => {
    const graph = async (c: Client) => ((await c.get('/api/cms/_graph')).body as any[]).find((g) => g.name === 'post').can
    // The playground's post.publishedAt may be edited by editors, authors and the translator roles, not by the marketing role.
    expect((await graph(editor)).publish).toBe(true)
    expect((await graph(admin)).publish).toBe(true)
    expect((await graph(translator)).publish).toBe(false) // it may not publish at all
    const marketing = (await newAccount('marketer')).client
    expect((await graph(marketing)).publish).toBe(false) // it may publish, but not set the date
    // The server agrees: a schedule from the marketing role is refused on the field.
    const p = await make('draft', 'follows')
    expect((await marketing.patch(`/api/cms/post/${p.id}`, { status: 'published', publishedAt: new Date(Date.now() + 60_000).toISOString() })).status).toBe(403)
  })
})
