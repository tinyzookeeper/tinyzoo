import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import * as Y from 'yjs'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap'
import { anonymous, type Client, doc, newAccount, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost, createTag } from '../helpers/fixtures'

const db = testDb()
let admin: Client
let editor: Client
beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

interface Session { name: string; epoch: string; fields: string[]; access: 'write' | 'read'; you?: string }

/** A browser tab joining a shared document, as the admin does. */
class Collaborator {
  doc = new Y.Doc()
  socket: HocuspocusProviderWebsocket
  provider: HocuspocusProvider
  failed: string | null = null
  constructor(client: Client, session: Pick<Session, 'name' | 'epoch'>) {
    const headers = { origin: client.baseURL, cookie: client.cookie }
    class AuthedWebSocket extends WebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols, { headers })
        // A refused upgrade (401/403) surfaces as an error event: the provider sees the close.
        this.on('error', () => {})
      }
    }
    this.socket = new HocuspocusProviderWebsocket({ url: `${client.baseURL.replace(/^http/, 'ws')}/api/cms/_collab/socket`, WebSocketPolyfill: AuthedWebSocket, maxAttempts: 1, autoConnect: false })
    this.provider = new HocuspocusProvider({
      websocketProvider: this.socket,
      name: session.name,
      document: this.doc,
      token: session.epoch,
      onAuthenticationFailed: ({ reason }) => { this.failed = reason || 'denied' },
    })
    this.provider.attach()
    // A refused connection rejects; the test reads that from `synced()`.
    this.socket.connect().catch(() => {})
  }

  async synced(timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs
    while (!this.provider.isSynced && !this.failed && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25))
    if (this.failed) throw new Error(`refused: ${this.failed}`)
    if (!this.provider.isSynced) throw new Error('not synced')
  }

  text(field = 'body') { return JSON.stringify(yXmlFragmentToProsemirrorJSON(this.doc.getXmlFragment(field))) }

  /** Append a paragraph to a field, as typing would. */
  type(text: string, field = 'body') {
    const p = new Y.XmlElement('paragraph')
    p.insert(0, [new Y.XmlText(text)])
    this.doc.getXmlFragment(field).push([p])
  }

  close() {
    this.provider.destroy()
    this.socket.destroy()
  }
}

const tabs: Collaborator[] = []
const join = async (c: Client, s: Session) => {
  const tab = new Collaborator(c, s)
  tabs.push(tab)
  await tab.synced()
  return tab
}
afterEach(() => { for (const t of tabs.splice(0)) t.close() })

const session = async (c: Client, entity: string, id: string, locale?: string) =>
  c.get<Session>(`/api/cms/_collab/session?entity=${entity}&id=${id}${locale ? `&locale=${locale}` : ''}`)

const until = async (check: () => boolean, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs
  while (!check() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25))
  return check()
}

describe('shared editing', () => {
  it('starts from the saved text and shares typing between people', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, body: doc('Uloženo') })
    const s = await session(editor, 'post', post.id)
    expect(s.status).toBe(200)
    expect(s.body).toMatchObject({ name: `post/${post.id}`, fields: ['body'], access: 'write' })

    const eda = await join(editor, s.body)
    expect(eda.text()).toContain('Uloženo')
    const ada = await join(admin, (await session(admin, 'post', post.id)).body)
    eda.type('Ahoj od Edy')
    expect(await until(() => ada.text().includes('Ahoj od Edy'))).toBe(true)
  })

  it('keeps one history: the same epoch while it is open, and after a save made from it', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const first = (await session(editor, 'post', post.id)).body
    const tab = await join(editor, first)
    tab.type('Rozepsáno')
    expect((await session(admin, 'post', post.id)).body.epoch).toBe(first.epoch)

    // A save from the shared document (it says so) keeps the history current.
    const saved = await editor.request('PATCH', `/api/cms/post/${post.id}`, { json: { title: 'Nový' }, headers: { 'x-cms-collab': first.epoch } })
    expect(saved.status).toBe(200)
    tab.close()
    await db.query(`update cms_collab set active_at = null`)
    expect((await session(admin, 'post', post.id)).body.epoch).toBe(first.epoch)
  })

  it('starts afresh from the saved entry when it changed elsewhere and nobody has it open', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, body: doc('Stará verze') })
    const first = (await session(editor, 'post', post.id)).body
    await admin.patch(`/api/cms/post/${post.id}`, { body: doc('Nová verze z API') })
    const second = (await session(editor, 'post', post.id)).body
    expect(second.epoch).not.toBe(first.epoch)
    const tab = await join(editor, second)
    expect(tab.text()).toContain('Nová verze z API')

    // A browser still holding the old history is refused rather than merging it back.
    const stale = new Collaborator(editor, first)
    tabs.push(stale)
    await expect(stale.synced()).rejects.toThrow('refused')
  })

  it('lets people who may only read watch, but not write', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, body: doc('Na webu'), status: 'published' })
    const author = await newAccount('author')
    const s = await session(author.client, 'post', post.id)
    expect(s.body.access).toBe('read')
    const reader = await join(author.client, s.body)
    const writer = await join(editor, (await session(editor, 'post', post.id)).body)

    reader.type('Autor nemůže psát')
    writer.type('Editor může')
    expect(await until(() => reader.text().includes('Editor může'))).toBe(true)
    await new Promise((r) => setTimeout(r, 300))
    expect(writer.text()).not.toContain('Autor nemůže psát')
  })

  it('shares translations separately, per language', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, body: doc('Česky') })
    await admin.patch(`/api/cms/post/${post.id}?locale=en`, { body: doc('In English') })
    const s = await session(editor, 'post', post.id, 'en')
    expect(s.body.name).toBe(`post/${post.id}/en`)
    const tab = await join(editor, s.body)
    expect(tab.text()).toContain('In English')
    expect(tab.text()).not.toContain('Česky')
  })

  it('opens one document for many people at once without blocking the database', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const all = await Promise.all(Array.from({ length: 16 }, () => session(editor, 'post', post.id)))
    expect(all.map((r) => r.status)).toEqual(Array(16).fill(200))
    expect(new Set(all.map((r) => r.body.epoch)).size).toBe(1)
    expect((await editor.get('/api/cms/post')).status).toBe(200) // the pool is free
  })

  it('edits text the editor cannot hold on its own, so it is never replaced', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    await db.query(`update post set body = $1 where id = $2`, [JSON.stringify({ type: 'doc', content: [{ type: 'mystery', content: [] }] }), post.id])
    expect((await session(editor, 'post', post.id)).body.fields).toEqual([])
  })

  it('forgets the shared text when the entry is deleted', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    await session(editor, 'post', post.id)
    expect((await db.query(`select count(*)::int as n from cms_collab`)).rows[0].n).toBe(1)
    expect((await admin.delete(`/api/cms/post/${post.id}`)).status).toBe(200)
    expect((await db.query(`select count(*)::int as n from cms_collab`)).rows[0].n).toBe(0)
  })

  it('cuts off an account that is disabled while it has the document open', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const person = await newAccount('editor')
    const tab = await join(person.client, (await session(person.client, 'post', post.id)).body)
    let closed = false
    tab.socket.on('close', () => {
      closed = true
      tab.close() // a disabled account's reconnect is refused (401); stop here
    })
    expect((await admin.patch(`/api/cms/_users/${person.id}`, { status: 'disabled' })).status).toBe(200)
    // Checked within the 30 s heartbeat, also for a socket that only listens.
    expect(await until(() => closed, 40_000)).toBe(true)
  }, 45_000)

  it('treats emptied text in a translation as not translated (the site falls back)', async () => {
    const a = await createAuthor(admin)
    await createPost(admin, { author: a.id, slug: 'zahrada', status: 'published', body: doc('Česky') })
    const post = (await db.query(`select id from post where slug = 'zahrada'`)).rows[0]
    await admin.patch(`/api/cms/post/${post.id}?locale=en`, { title: 'Garden', body: { type: 'doc', content: [{ type: 'paragraph' }] } })
    const en = (await anonymous().get('/api/content/post/zahrada?locale=en')).body.item
    expect(JSON.stringify(en.body)).toContain('Česky')
  })

  it('puts the account\'s own name on a cursor, never someone else\'s', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const s = (await session(editor, 'post', post.id)).body
    expect(s.you).toBe('Eda Editor')
    const honest = await join(editor, s)
    honest.provider.setAwarenessField('user', { name: 'Eda Editor', color: '#0090ff' })
    const watcher = await join(admin, (await session(admin, 'post', post.id)).body)
    expect(await until(() => [...watcher.provider.awareness!.getStates().values()].some((st: any) => st.user?.name === 'Eda Editor'))).toBe(true)

    const liar = await join(editor, s)
    let closed = false
    liar.socket.on('close', () => {
      closed = true
      liar.close()
    })
    liar.provider.setAwarenessField('user', { name: 'Ada Admin', color: '#e5484d' })
    expect(await until(() => closed)).toBe(true)
    expect([...watcher.provider.awareness!.getStates().values()].some((st: any) => st.user?.name === 'Ada Admin')).toBe(false)
  })

  it('refuses strangers, other sites and made-up documents', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    expect((await session(anonymous(), 'post', post.id)).status).toBe(401)
    expect((await session(editor, 'post', '00000000-0000-4000-8000-000000000000')).status).toBe(404)
    const tag = await createTag(admin)
    expect((await session(editor, 'tag', tag.id)).status).toBe(404) // nothing to edit together

    const s = (await session(editor, 'post', post.id)).body
    // A made-up name with a real epoch.
    const forged = new Collaborator(editor, { name: `post/${a.id}`, epoch: s.epoch })
    tabs.push(forged)
    await expect(forged.synced()).rejects.toThrow('refused')
    // Anonymous socket, or one from another site: refused at the door.
    const status = (headers: Record<string, string>) => new Promise<number>((resolve) => {
      const ws = new WebSocket(`${editor.baseURL.replace(/^http/, 'ws')}/api/cms/_collab/socket`, { headers })
      ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0))
      ws.on('open', () => { ws.close(); resolve(101) })
      ws.on('error', () => {})
    })
    expect(await status({ origin: editor.baseURL })).toBe(401)
    expect(await status({ origin: 'https://evil.example', cookie: editor.cookie })).toBe(403)
  })
})
