import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import * as Y from 'yjs'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { anonymous, type Client, doc, newAccount, PNG_1x1, signIn, testDb, truncateAll, waitForMail } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

// Custom roles (`defineRoles`) and per-field access (`.access()`), against the playground:
//   translator  extends editor: reads and updates posts and pages, reads authors and tags,
//               never publishes, changes only the files it uploaded
//   curator     extends editor: manages authors, reads posts and tags, no media library
//   marketer    extends editor: the settings and the posts; may publish
// and the fields
//   author.email     read: editor, curator   edit: editor
//   author.bio       read: editor            (rich text)
//   author.position  edit: editor
//   post.location    edit: editor            (a translatable group)
//   siteSettings.siteName, .brandColor  edit: editor
// Administrators always pass.
const db = testDb()
let admin: Client
let editor: Client
let builtInAuthor: Client
let translator: Client
let curator: Client
let marketer: Client
let ghost: Client
let ghostId: string

beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
  builtInAuthor = await signIn('author')
  translator = (await newAccount('translator')).client
  curator = (await newAccount('curator')).client
  marketer = (await newAccount('marketer')).client
  // A person whose role was taken out of the config: they sign in, and have no access.
  const removed = await newAccount('translator')
  ghost = removed.client
  ghostId = removed.id
  await db.query(`update cms_users set role = 'ghost' where id = $1`, [ghostId])
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const upload = (c: Client) => c.upload('/api/cms/_media', { name: 'a.png', type: 'image/png', data: PNG_1x1 })
const bio = (text: string) => doc(text)

async function authorWithBio(over: Record<string, unknown> = {}) {
  return createAuthor(admin, { name: 'Quokka Person', position: 3, bio: bio('The quokka lives near the zebrafish pond'), ...over })
}

describe('what a custom role may do with collections', () => {
  it('translator: reads what it lists, updates posts, nothing else', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    expect((await translator.get('/api/cms/post')).status).toBe(200)
    expect((await translator.get(`/api/cms/author/${a.id}`)).status).toBe(200)
    expect((await translator.patch(`/api/cms/post/${post.id}`, { title: 'Přeloženo' })).status).toBe(200)
    // Listed with read and update only: no create, no delete.
    expect((await translator.post('/api/cms/post', { title: 'T', slug: 't', author: a.id, body: doc('x') })).status).toBe(403)
    expect((await translator.delete(`/api/cms/post/${post.id}`)).status).toBe(403)
    // Authors and tags it may read, not change.
    expect((await translator.patch(`/api/cms/author/${a.id}`, { name: 'X' })).status).toBe(403)
    expect((await translator.post('/api/cms/tag', { name: 'T', slug: 't' })).status).toBe(403)
  })

  it('translator: never publishes, and cannot change what is live (it extends editor, which can)', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    expect((await translator.patch(`/api/cms/post/${post.id}`, { status: 'published' })).status).toBe(403)
    await admin.patch(`/api/cms/post/${post.id}`, { status: 'published' })
    expect((await translator.patch(`/api/cms/post/${post.id}`, { title: 'Live edit' })).status).toBe(403)
    // Content that is live the moment it is saved is a publication too: settings, redirects.
    expect((await translator.put('/api/cms/_singleton/siteSettings', { siteName: 'X' })).status).toBe(403)
    expect((await translator.post('/api/cms/redirect', { from: '/a', to: '/b' })).status).toBe(403)
  })

  it('curator: manages authors, only reads posts', async () => {
    const made = await createAuthor(admin)
    expect((await curator.patch(`/api/cms/author/${made.id}`, { name: 'Renamed' })).status).toBe(200)
    expect((await curator.delete(`/api/cms/author/${made.id}`)).status).toBe(200)
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id })
    expect((await curator.get(`/api/cms/post/${post.id}`)).status).toBe(200)
    expect((await curator.patch(`/api/cms/post/${post.id}`, { title: 'No' })).status).toBe(403)
  })

  it('a role built on editor is not an administrator: people, privacy and the audit log are closed to it', async () => {
    for (const c of [translator, curator, marketer]) {
      expect((await c.get('/api/cms/_users')).status).toBe(403)
      expect((await c.post('/api/cms/_users', { email: 'x@test.local', role: 'admin' })).status).toBe(403)
      expect((await c.post('/api/cms/_privacy/lookup', { email: 'a@b.cz' })).status).toBe(403)
    }
  })

  it('tells the admin what the role may do: entities, publishing and the fields', async () => {
    const graph = (await translator.get('/api/cms/_graph')).body as any[]
    const post = graph.find((g) => g.name === 'post')
    expect(post.can).toEqual({ create: false, update: true, delete: false, publish: false })
    expect(graph.find((g) => g.name === 'author').can).toMatchObject({ create: false, update: false, delete: false })
    // What an editor may do.
    expect((await editor.get('/api/cms/_graph')).body.find((g: any) => g.name === 'post').can).toEqual({ create: true, update: true, delete: true, publish: true })
    expect((await marketer.get('/api/cms/_graph')).body.find((g: any) => g.name === 'post').can).toMatchObject({ update: true, create: false, publish: true })
  })

  it('says who the person is: me carries the role\'s name, label and reach', async () => {
    const me = (await translator.get('/api/cms/_auth/me')).body
    expect(me.user.role).toBe('translator')
    expect(me.access).toMatchObject({ removed: false, role: 'translator', custom: true, base: 'editor', publish: false, media: 'own', manage: false, label: { en: 'Translator', cs: 'Překladatel' } })
    expect((await admin.get('/api/cms/_auth/me')).body.access).toMatchObject({ role: 'admin', manage: true, media: 'all', publish: true, custom: false })
    expect((await builtInAuthor.get('/api/cms/_auth/me')).body.access).toMatchObject({ role: 'author', publish: false, media: 'own' })
  })
})

describe('fields a role may not read: the admin API strips them everywhere', () => {
  const keysOf = (row: any) => Object.keys(row)

  it('the list, a single entry, the response of a save', async () => {
    const a = await authorWithBio()
    for (const [client, email, biography] of [[admin, true, true], [editor, true, true], [curator, true, false], [translator, false, false], [builtInAuthor, false, false]] as const) {
      const list = (await client.get('/api/cms/author')).body.rows[0]
      expect(keysOf(list).includes('email'), `list email for ${client.cookie.slice(0, 5)}`).toBe(email)
      expect(keysOf(list).includes('bio')).toBe(biography)
      const one = (await client.get(`/api/cms/author/${a.id}`)).body.row
      expect(keysOf(one).includes('email')).toBe(email)
      expect(keysOf(one).includes('bio')).toBe(biography)
      expect(one.name).toBe('Quokka Person')
    }
    // The save's own answer: a curator changes the name and gets back what it may read.
    const saved = (await curator.patch(`/api/cms/author/${a.id}`, { name: 'Renamed' })).body.row
    expect(saved.name).toBe('Renamed')
    expect(keysOf(saved).includes('email')).toBe(true)
    expect(keysOf(saved).includes('bio')).toBe(false)
  })

  it('what the form attaches goes too: a related name or a file preview of a hidden field', async () => {
    // post.location is a group (readable), so use the translation's defaults on a field that is hidden: author.bio
    const a = await authorWithBio()
    const en = (await translator.get(`/api/cms/author/${a.id}?locale=en`)).body.row
    expect(keysOf(en)).not.toContain('bio')
    expect(en.__defaults ?? {}).not.toHaveProperty('bio')
  })

  it('the graph lists no such field: not in the form, the list columns, nor the tabs', async () => {
    const grab = async (c: Client) => (await c.get('/api/cms/_graph')).body.find((g: any) => g.name === 'author')
    const forEditor = await grab(editor)
    const forTranslator = await grab(translator)
    const forCurator = await grab(curator)
    expect(forEditor.fields.map((f: any) => f.key)).toEqual(expect.arrayContaining(['name', 'email', 'bio', 'position']))
    expect(forEditor.listColumns).toEqual(['name', 'email'])
    expect(forTranslator.fields.map((f: any) => f.key)).not.toContain('email')
    expect(forTranslator.fields.map((f: any) => f.key)).not.toContain('bio')
    expect(forTranslator.listColumns).toEqual(['name'])
    expect(forCurator.fields.map((f: any) => f.key)).toContain('email')
    expect(forCurator.fields.map((f: any) => f.key)).not.toContain('bio')
    // The rules themselves are not sent.
    expect(JSON.stringify(forEditor)).not.toContain('"access"')
  })

  it('the graph marks a field the role may read but not edit', async () => {
    const field = (g: any, key: string) => g.find((x: any) => x.name === 'author').fields.find((f: any) => f.key === key)
    const forCurator = (await curator.get('/api/cms/_graph')).body
    expect(field(forCurator, 'email').readOnly).toBe(true)
    expect(field(forCurator, 'position').readOnly).toBe(true)
    expect(field(forCurator, 'name').readOnly).toBeUndefined()
    expect(field((await editor.get('/api/cms/_graph')).body, 'email').readOnly).toBeUndefined()
    expect(field((await admin.get('/api/cms/_graph')).body, 'bio').readOnly).toBeUndefined()
    // Arranging the list writes the position: the curator may not.
    expect((await curator.get('/api/cms/_graph')).body.find((g: any) => g.name === 'author').can.arrange).toBe(false)
    expect((await editor.get('/api/cms/_graph')).body.find((g: any) => g.name === 'author').can.arrange).toBeUndefined()
  })

  it('the CSV export leaves the column out', async () => {
    await authorWithBio()
    const csv = async (c: Client) => String((await c.get('/api/cms/author/_export')).body).split('\r\n')[0]!
    expect(await csv(editor)).toMatch(/E-mail|Email/)
    expect(await csv(curator)).toMatch(/E-mail|Email/)
    const forTranslator = await csv(translator)
    expect(forTranslator).not.toMatch(/E-mail|Email/)
    expect(forTranslator).toMatch(/Jméno|Name/)
    const body = String((await translator.get('/api/cms/author/_export')).body)
    expect(body).not.toContain('@example.com')
  })

  it('cannot order the list by a field it may not read', async () => {
    // Created in this order with emails that sort the other way round: the order by email is not what a hidden sort gives.
    await createAuthor(admin, { name: 'First', email: 'z@example.com' })
    await new Promise((r) => setTimeout(r, 15))
    await createAuthor(admin, { name: 'Second', email: 'a@example.com' })
    const names = async (c: Client, sort: string) => (await c.get(`/api/cms/author?sort=${sort}&dir=asc`)).body.rows.map((r: any) => r.name)
    expect(await names(editor, 'email')).toEqual(['Second', 'First']) // may read: sorted by it
    expect(await names(translator, 'email')).toEqual(['First', 'Second']) // may not: ignored (by creation, as asked: asc)
    expect(await names(translator, 'emailId')).toEqual(['First', 'Second'])
    expect(await names(translator, 'bio')).toEqual(['First', 'Second'])
  })

  it('history: the snapshots and the list of what changed leave the field out', async () => {
    const a = await authorWithBio()
    await curator.patch(`/api/cms/author/${a.id}`, { name: 'Changed' })
    await editor.patch(`/api/cms/author/${a.id}`, { bio: bio('Edited bio') })
    const list = async (c: Client) => (await c.get(`/api/cms/author/${a.id}/revisions`)).body.revisions as any[]
    const asEditor = await list(editor)
    expect(asEditor.some((r) => r.changed.includes('bio'))).toBe(true)
    expect((await list(curator)).some((r) => r.changed.includes('bio'))).toBe(false)
    expect((await list(translator)).some((r) => r.changed.includes('bio') || r.changed.includes('email'))).toBe(false)
    const rev = async (c: Client) => (await c.get(`/api/cms/author/${a.id}/revisions/${asEditor[0]!.id}`)).body.revision
    expect(Object.keys((await rev(editor)).data)).toEqual(expect.arrayContaining(['name', 'email', 'bio']))
    const forCurator = await rev(curator)
    expect(Object.keys(forCurator.data)).toContain('email')
    expect(Object.keys(forCurator.data)).not.toContain('bio')
    expect(forCurator.changed).not.toContain('bio')
    expect(Object.keys((await rev(translator)).data)).not.toContain('email')
    expect(JSON.stringify(await rev(translator))).not.toContain('zebrafish')
  })

  it('the admin search does not find an entry by text in a hidden field, nor show it', async () => {
    await authorWithBio()
    const search = async (c: Client, q: string) => (await c.get(`/api/cms/_search?q=${q}`)).body.items.filter((i: any) => i.entity === 'author') as any[]
    expect((await search(editor, 'zebrafish')).length).toBe(1)
    expect((await search(admin, 'zebrafish')).length).toBe(1)
    expect(await search(translator, 'zebrafish')).toEqual([])
    expect(await search(curator, 'zebrafish')).toEqual([])
    expect(await search(builtInAuthor, 'zebrafish')).toEqual([])
    // By the name they may read they find it — with no text from the field they may not.
    const found = await search(translator, 'quokka')
    expect(found.length).toBe(1)
    expect(JSON.stringify(found)).not.toContain('zebrafish')
    // Several words, one of them only in the hidden field: not found either.
    expect(await search(translator, 'quokka%20zebrafish')).toEqual([])
  })

  it('the preview of a draft on the content API: a signed-in person gets the page without the fields they may not read', async () => {
    const a = await authorWithBio()
    const item = async (c: Client, preview: boolean) => (await c.get(`/api/content/author/${a.id}${preview ? '?preview' : ''}`)).body.item
    expect(JSON.stringify((await item(editor, true)).bio)).toContain('zebrafish')
    expect((await item(translator, true)).bio).toBeUndefined()
    expect((await item(translator, true)).name).toBe('Quokka Person')
    // The public answer is governed by content.hidden, not by the admin's field access: unchanged.
    expect(JSON.stringify((await item(anonymous(), false)).bio)).toContain('zebrafish')
    expect(JSON.stringify((await item(translator, false)).bio)).toContain('zebrafish')
  })

  it('the overview and the link picker still work (they carry titles and states, never fields)', async () => {
    await authorWithBio()
    expect((await translator.get('/api/cms/_overview')).status).toBe(200)
    expect((await translator.get('/api/cms/_links?q=a')).status).toBe(200)
  })

  it('where a file is used: an entry holding it only in a hidden field is not listed', async () => {
    const file = (await upload(admin)).body
    const a = await createAuthor(admin, { name: 'With image', bio: doc('x', { mediaId: file.id, src: file.url }) })
    const used = async (c: Client) => (await c.get(`/api/cms/_media/${file.id}/usage`)).body.usage as any[]
    expect((await used(editor)).map((u) => u.id)).toEqual([a.id])
    expect(await used(translator)).toEqual([])
  })
})

describe('fields a role may not edit: a write that names one is refused, and nothing else changes', () => {
  it('update: 403 naming the field, even if the value is the one it already has', async () => {
    const a = await authorWithBio()
    const res = await curator.patch(`/api/cms/author/${a.id}`, { name: 'New name', email: 'other@example.com' })
    expect(res.status).toBe(403)
    expect(res.body.data).toEqual({ code: 'field_forbidden', fields: ['email'] })
    expect((await curator.patch(`/api/cms/author/${a.id}`, { position: 1 })).status).toBe(403)
    // Nothing was written, not even the field the person could have changed.
    const row = (await admin.get(`/api/cms/author/${a.id}`)).body.row
    expect(row.name).toBe('Quokka Person')
    expect(row.position).toBe(3)
  })

  it('a field it cannot even read is refused the same way', async () => {
    const a = await authorWithBio()
    const res = await curator.patch(`/api/cms/author/${a.id}`, { bio: bio('overwritten') })
    expect(res.status).toBe(403)
    expect(res.body.data.fields).toEqual(['bio'])
    expect(JSON.stringify((await admin.get(`/api/cms/author/${a.id}`)).body.row.bio)).toContain('zebrafish')
  })

  it('an omitted field keeps what it holds: no default, no null', async () => {
    const a = await authorWithBio()
    const post = await createPost(admin, { author: a.id, location: { place: 'Tábor', note: 'u řeky' }, status: 'draft' })
    const before = (await admin.get(`/api/cms/post/${post.id}`)).body.row
    const res = await translator.patch(`/api/cms/post/${post.id}`, { title: 'Jen název' })
    expect(res.status).toBe(200)
    const after = (await admin.get(`/api/cms/post/${post.id}`)).body.row
    expect(after.title).toBe('Jen název')
    expect(after).toMatchObject({ location: { place: 'Tábor', note: 'u řeky' }, status: 'draft', authorId: a.id, slug: before.slug })
    // Another editor's update leaves it too.
    await curator.patch(`/api/cms/author/${a.id}`, { name: 'Curated' })
    expect(JSON.stringify((await admin.get(`/api/cms/author/${a.id}`)).body.row.bio)).toContain('zebrafish')
    expect((await admin.get(`/api/cms/author/${a.id}`)).body.row.position).toBe(3)
  })

  it('create: refused when the body names one; a default still fills a new entry; a required field it cannot write is a validation error', async () => {
    // curator may create authors, but email (required) is the editors' to write
    const named = await curator.post('/api/cms/author', { name: 'N', email: 'n@example.com' })
    expect(named.status).toBe(403)
    expect(named.body.data.fields).toEqual(['email'])
    const without = await curator.post('/api/cms/author', { name: 'N' })
    expect(without.status).toBe(422)
    expect(JSON.stringify(without.body.data)).toContain('email')
    // The built-in author creates posts (a draft): location is the editors', and a default (status) still applies.
    const a = await createAuthor(admin)
    const withLocation = await builtInAuthor.post('/api/cms/post', { title: 'T', slug: 't-loc', author: a.id, body: doc('x'), location: { place: 'X', note: null } })
    expect(withLocation.status).toBe(403)
    const plain = await builtInAuthor.post('/api/cms/post', { title: 'T', slug: 't-plain', author: a.id, body: doc('x') })
    expect(plain.status).toBe(201)
    expect(plain.body.row.status).toBe('draft')
  })

  it('a translation: the same rule, for the translated fields', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const refused = await translator.patch(`/api/cms/post/${post.id}?locale=en`, { title: 'In English', location: { place: 'Tabor', note: null } })
    expect(refused.status).toBe(403)
    expect(refused.body.data.fields).toEqual(['location'])
    expect((await admin.get(`/api/cms/post/${post.id}?locale=en`)).body.row.__translated).toBe(false)
    expect((await translator.patch(`/api/cms/post/${post.id}?locale=en`, { title: 'In English' })).status).toBe(200)
    // Removing the translation removes every translated field: all must be the person's to change.
    expect((await translator.delete(`/api/cms/post/${post.id}?locale=en`)).status).toBe(403)
    expect((await editor.delete(`/api/cms/post/${post.id}?locale=en`)).status).toBe(200)
  })

  it('a global: a field it may not edit is neither sent nor reset when it saves the others', async () => {
    await editor.put('/api/cms/_singleton/siteSettings', { siteName: 'Original', brandColor: '#112233', tagline: 'one' })
    expect((await marketer.put('/api/cms/_singleton/siteSettings', { siteName: 'Hijack', tagline: 'two' })).status).toBe(403)
    const saved = await marketer.put('/api/cms/_singleton/siteSettings', { tagline: 'two' })
    expect(saved.status).toBe(200)
    const row = (await admin.get('/api/cms/_singleton/siteSettings')).body.row
    expect(row).toMatchObject({ siteName: 'Original', brandColor: '#112233', tagline: 'two' })
    // The marketer reads the global with the fields it may not edit (read-only), and is told so.
    const form = (await marketer.get('/api/cms/_graph')).body.find((g: any) => g.name === 'siteSettings')
    expect(form.fields.find((f: any) => f.key === 'siteName').readOnly).toBe(true)
    expect(form.fields.find((f: any) => f.key === 'tagline').readOnly).toBeUndefined()
  })

  it('a global: the very first save has nothing to keep, so a required field it may not write is missing', async () => {
    const res = await marketer.put('/api/cms/_singleton/siteSettings', { tagline: 'first' })
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body.data)).toContain('siteName')
  })

  it('arranging a list writes the position: refused for a role that may not edit it', async () => {
    const a = await createAuthor(admin)
    const b = await createAuthor(admin)
    const refused = await curator.post('/api/cms/author/_order', { ids: [b.id, a.id] })
    expect(refused.status).toBe(403)
    expect(refused.body.data.fields).toEqual(['position'])
    expect((await editor.post('/api/cms/author/_order', { ids: [b.id, a.id] })).status).toBe(200)
  })

  it('administrators always may, whatever the lists say', async () => {
    const a = await authorWithBio()
    const res = await admin.patch(`/api/cms/author/${a.id}`, { email: 'admin-set@example.com', bio: bio('by admin'), position: 9 })
    expect(res.status).toBe(200)
    expect(res.body.row).toMatchObject({ email: 'admin-set@example.com', position: 9 })
  })
})

describe('shared editing of rich text', () => {
  const session = (c: Client, entity: string, id: string) => c.get(`/api/cms/_collab/session?entity=${entity}&id=${id}`)

  it('a rich-text field with a rule is not in the shared document (it is edited alone)', async () => {
    const a = await authorWithBio()
    // author has only bio, which has a rule: nothing to share
    expect((await session(editor, 'author', a.id)).status).toBe(404)
    const post = await createPost(admin, { author: a.id })
    const res = await session(editor, 'post', post.id)
    expect(res.status).toBe(200)
    expect(res.body.fields).toEqual(['body'])
  })

  it('write or read, per the role: translator may type, curator only watches, a removed role is refused', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    expect((await session(translator, 'post', post.id)).body.access).toBe('write')
    expect((await session(curator, 'post', post.id)).body.access).toBe('read')
    const gone = await session(ghost, 'post', post.id)
    expect(gone.status).toBe(403)
    expect(gone.body.data.code).toBe('role-removed')
    // Once the translator may not change it any more (it is live), the document is read-only.
    await admin.patch(`/api/cms/post/${post.id}`, { status: 'published' })
    expect((await session(translator, 'post', post.id)).body.access).toBe('read')
  })

  it('on the socket, a role that only reads cannot type into the document, and one without a role is refused', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const open = async (c: Client) => {
      const s = (await session(c, 'post', post.id)).body
      return new Tab(c, s)
    }
    const reader = await open(curator)
    await reader.synced()
    const writer = await open(translator)
    await writer.synced()
    writer.type('written by the translator')
    await vi_waitFor(() => reader.text().includes('written by the translator'))
    reader.type('typed by someone who may only read')
    await new Promise((r) => setTimeout(r, 400))
    expect(writer.text()).not.toContain('typed by someone who may only read')
    reader.close()
    writer.close()
    // A role the site does not have gets no socket at all.
    const denied = new Tab(ghost, { name: `post/${post.id}`, epoch: (await session(translator, 'post', post.id)).body.epoch })
    await expect(denied.synced(2500)).rejects.toThrow()
    denied.close()
  })

  it('a stored document that holds a field outside the shared ones is started afresh (a rule added later must not hand out its text)', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const name = `post/${post.id}`
    const first = (await session(editor, 'post', post.id)).body
    const { rows } = await db.query('select state from cms_collab where name = $1', [name])
    const stored = new Y.Doc()
    Y.applyUpdate(stored, new Uint8Array(Buffer.from(rows[0].state, 'base64')))
    const para = new Y.XmlElement('paragraph')
    para.insert(0, [new Y.XmlText('text of a field that has an access rule now')])
    stored.getXmlFragment('location').insert(0, [para])
    await db.query('update cms_collab set state = $1 where name = $2', [Buffer.from(Y.encodeStateAsUpdate(stored)).toString('base64'), name])
    const second = (await session(translator, 'post', post.id)).body
    expect(second.epoch).not.toBe(first.epoch)
    const { rows: after } = await db.query('select state from cms_collab where name = $1', [name])
    expect(Buffer.from(after[0].state, 'base64').toString('latin1')).not.toContain('access rule now')
  })
})

describe('the media library, per role', () => {
  it('translator (own): browses everything, uploads, changes only its own files', async () => {
    const mine = (await upload(translator)).body
    const theirs = (await upload(editor)).body
    expect((await translator.get('/api/cms/_media')).body.items.map((m: any) => m.id)).toEqual(expect.arrayContaining([mine.id, theirs.id]))
    expect((await translator.patch(`/api/cms/_media/${mine.id}`, { alt: 'mine' })).status).toBe(200)
    expect((await translator.patch(`/api/cms/_media/${theirs.id}`, { alt: 'theirs' })).status).toBe(403)
    expect((await translator.delete(`/api/cms/_media/${theirs.id}`)).status).toBe(403)
    expect((await translator.delete(`/api/cms/_media/${mine.id}`)).status).toBe(200)
  })

  it('curator (none): the library is closed — list, upload, details, delete, where a file is used', async () => {
    const file = (await upload(admin)).body
    expect((await curator.get('/api/cms/_media')).status).toBe(403)
    expect((await upload(curator)).status).toBe(403)
    expect((await curator.patch(`/api/cms/_media/${file.id}`, { alt: 'x' })).status).toBe(403)
    expect((await curator.delete(`/api/cms/_media/${file.id}`)).status).toBe(403)
    expect((await curator.post('/api/cms/_media/exists', { ids: [file.id] })).status).toBe(403)
    expect((await curator.get(`/api/cms/_media/${file.id}/usage`)).status).toBe(403)
    expect((await curator.get('/api/cms/_auth/me')).body.access.media).toBe('none')
  })

  it('marketer (all, as editor): changes any file', async () => {
    const theirs = (await upload(editor)).body
    expect((await marketer.patch(`/api/cms/_media/${theirs.id}`, { alt: 'x' })).status).toBe(200)
  })

  it('cleaning up after a save never removes a file that is not the person\'s when they may not change all files', async () => {
    const file = (await upload(editor)).body
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, hero: file.id })
    // The translator clears the picture: the file is not theirs, so it stays (as an author's clearing would leave it).
    expect((await translator.patch(`/api/cms/post/${post.id}`, { hero: null })).status).toBe(200)
    const { rows } = await db.query('select count(*)::int as n from cms_media where id = $1', [file.id])
    expect(rows[0].n).toBe(1)
  })
})

describe('a role the site does not have (removed from the config) fails closed', () => {
  it('signs in, but sees "your role no longer exists": 403 role-removed on everything but its own account', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const code = async (res: { status: number; body: any }) => [res.status, res.body?.data?.code]
    for (const path of ['/api/cms/_graph', '/api/cms/_overview', '/api/cms/post', `/api/cms/post/${post.id}`, '/api/cms/_media', '/api/cms/_search?q=a', '/api/cms/_links?q=a', '/api/cms/post/_export', `/api/cms/post/${post.id}/revisions`, '/api/cms/_singleton/siteSettings']) {
      expect(await code(await ghost.get(path)), path).toEqual([403, 'role-removed'])
    }
    expect(await code(await ghost.patch(`/api/cms/post/${post.id}`, { title: 'x' }))).toEqual([403, 'role-removed'])
    expect(await code(await ghost.post('/api/cms/post', { title: 'T', slug: 'g', author: a.id, body: doc('x') }))).toEqual([403, 'role-removed'])
    expect(await code(await upload(ghost))).toEqual([403, 'role-removed'])
    expect((await ghost.get('/api/cms/_users')).status).toBe(403)
  })

  it('still knows who it is, and may change its own name and language — the screen needs that', async () => {
    const me = await ghost.get('/api/cms/_auth/me')
    expect(me.status).toBe(200)
    expect(me.body.access).toEqual({ removed: true, role: 'ghost' })
    expect((await ghost.patch('/api/cms/_auth/me', { name: 'Still me', locale: 'cs' })).status).toBe(200)
    expect((await ghost.get('/api/_auth/session')).body.user.role).toBe('ghost')
  })

  it('cannot see drafts through the content API, which a signed-in editor can', async () => {
    const a = await createAuthor(admin)
    const draft = await createPost(admin, { author: a.id, slug: 'a-draft' })
    expect((await editor.get('/api/content/post/a-draft?preview')).status).toBe(200)
    expect((await ghost.get('/api/content/post/a-draft?preview')).status).toBe(404)
    void draft
  })

  it('signing in works (the account is fine, only its role is gone)', async () => {
    const acc = await newAccount('translator')
    await db.query(`update cms_users set role = 'ghost' where id = $1`, [acc.id])
    const again = await anonymous().post('/api/cms/_auth/login', { email: acc.email, password: acc.password })
    expect(again.status).toBe(200)
  })

  it('the Team page flags it, and offers every role the site has', async () => {
    const team = (await admin.get('/api/cms/_users')).body
    expect(team.users.find((u: any) => u.id === ghostId)).toMatchObject({ role: 'ghost', roleRemoved: true })
    expect(team.users.find((u: any) => u.role === 'translator').roleRemoved).toBe(false)
    expect(team.users.find((u: any) => u.role === 'admin').roleRemoved).toBe(false)
    expect(team.roles.map((r: any) => r.name)).toEqual(['admin', 'editor', 'author', 'translator', 'curator', 'marketer'])
    expect(team.roles.find((r: any) => r.name === 'translator')).toMatchObject({ custom: true, from: 'editor', label: { en: 'Translator', cs: 'Překladatel' } })
    expect(team.roles.find((r: any) => r.name === 'editor')).toMatchObject({ custom: false, from: 'editor', label: null })
  })

  it('an administrator gives it another role and the person is back (their old sessions end)', async () => {
    const acc = await newAccount('translator')
    await db.query(`update cms_users set role = 'ghost' where id = $1`, [acc.id])
    expect((await acc.client.get('/api/cms/_graph')).status).toBe(403)
    const res = await admin.patch(`/api/cms/_users/${acc.id}`, { role: 'curator' })
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('curator')
    const back = await anonymous().post('/api/cms/_auth/login', { email: acc.email, password: acc.password })
    expect(back.status).toBe(200)
    const c = anonymous()
    c.cookie = back.headers.getSetCookie().map((x) => x.split(';')[0]).join('; ')
    expect((await c.get('/api/cms/_graph')).status).toBe(200)
  })
})

describe('giving people a custom role', () => {
  it('invites with one, names it in the email, and records role changes in the audit log', async () => {
    const email = `invited-${Date.now()}@test.local`
    const invited = await admin.post('/api/cms/_users', { email, role: 'translator' })
    expect(invited.status).toBe(201)
    expect(invited.body.user.role).toBe('translator')
    const mail = await waitForMail(email)
    expect(mail.text).toMatch(/jako Překladatel/)
    // Unknown roles are refused, on invite and on change.
    expect((await admin.post('/api/cms/_users', { email: 'x1@test.local', role: 'ghost' })).status).toBe(422)
    expect((await admin.post('/api/cms/_users', { email: 'x2@test.local', role: 'boss' })).status).toBe(422)
    const acc = await newAccount('author')
    expect((await admin.patch(`/api/cms/_users/${acc.id}`, { role: 'ghost' })).status).toBe(422)
    expect((await admin.patch(`/api/cms/_users/${acc.id}`, { role: 'marketer' })).status).toBe(200)
    const { rows } = await db.query(`select meta from cms_audit where action = 'user.role' and record_id = $1`, [acc.id])
    expect(rows.map((r) => r.meta)).toEqual([{ from: 'author', to: 'marketer' }])
  })

  it('a custom role can never be made an administrator through the roles', async () => {
    // Only the built-in admin manages people: nothing a role lists changes that.
    const acc = await newAccount('marketer')
    expect((await acc.client.patch(`/api/cms/_users/${acc.id}`, { role: 'admin' })).status).toBe(403)
    expect((await acc.client.get('/api/cms/_privacy/lookup')).status).toBeGreaterThanOrEqual(403)
  })
})

/** A browser tab on a shared document (see test/api/collab.spec.ts). */
class Tab {
  doc = new Y.Doc()
  socket: HocuspocusProviderWebsocket
  provider: HocuspocusProvider
  failed: string | null = null
  constructor(client: Client, session: { name: string; epoch: string }) {
    const headers = { origin: client.baseURL, cookie: client.cookie }
    class AuthedWebSocket extends WebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols, { headers })
        this.on('error', () => {})
      }
    }
    this.socket = new HocuspocusProviderWebsocket({ url: `${client.baseURL.replace(/^http/, 'ws')}/api/cms/_collab/socket`, WebSocketPolyfill: AuthedWebSocket, maxAttempts: 1, autoConnect: false })
    this.provider = new HocuspocusProvider({ websocketProvider: this.socket, name: session.name, document: this.doc, token: session.epoch, onAuthenticationFailed: ({ reason }) => { this.failed = reason || 'denied' } })
    this.provider.attach()
    this.socket.connect().catch(() => {})
  }

  async synced(timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs
    while (!this.provider.isSynced && !this.failed && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25))
    if (this.failed) throw new Error(`refused: ${this.failed}`)
    if (!this.provider.isSynced) throw new Error('not synced')
  }

  text(field = 'body') { return JSON.stringify(this.doc.getXmlFragment(field).toJSON()) }

  type(text: string, field = 'body') {
    const p = new Y.XmlElement('paragraph')
    p.insert(0, [new Y.XmlText(text)])
    this.doc.getXmlFragment(field).insert(this.doc.getXmlFragment(field).length, [p])
  }

  close() {
    this.provider.destroy()
    this.socket.destroy()
  }
}

async function vi_waitFor(check: () => boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (check()) return
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error('condition not met in time')
}
