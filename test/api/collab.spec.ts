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

interface Session { name: string; epoch: string; fields: string[]; access: 'write' | 'read' }

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
    // Anonymous socket: refused at the door.
    const anon = new Collaborator(anonymous(), s)
    tabs.push(anon)
    await expect(anon.synced(1500)).rejects.toThrow()
  })
})
