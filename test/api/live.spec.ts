import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { accounts, type Client, newAccount, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

const db = testDb()
let admin: Client
let editor: Client
beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

/** A realtime socket as a browser tab would open it; collects what the server sends. */
class Tab {
  ws: WebSocket
  messages: any[] = []
  closed: { code: number } | null = null
  constructor(readonly client: Client, headers: Record<string, string> = {}) {
    const base = client.baseURL
    this.ws = new WebSocket(`${base.replace(/^http/, 'ws')}/api/cms/_live`, {
      headers: { origin: base, ...(client.cookie ? { cookie: client.cookie } : {}), ...headers },
    })
    this.ws.on('message', (d) => this.messages.push(JSON.parse(String(d))))
    this.ws.on('close', (code) => { this.closed = { code } })
  }

  opened(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve()
      this.ws.once('open', () => resolve())
      this.ws.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)))
      this.ws.once('error', reject)
    })
  }

  send(msg: unknown) { this.ws.send(JSON.stringify(msg)) }

  async next(match: (m: any) => boolean, timeoutMs = 5000): Promise<any> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const i = this.messages.findIndex(match)
      if (i >= 0) return this.messages.splice(i, 1)[0]
      await new Promise((r) => setTimeout(r, 25))
    }
    throw new Error(`no matching message in ${timeoutMs}ms; got ${JSON.stringify(this.messages)}`)
  }

  /** The latest presence for a topic once `match` holds for it. */
  presence(topic: string, match: (people: any[]) => boolean) {
    return this.next((m) => m.type === 'presence' && m.topic === topic && match(m.people))
  }

  close() { this.ws.close() }
}

const tabs: Tab[] = []
const open = async (c: Client, headers?: Record<string, string>) => {
  const t = new Tab(c, headers)
  tabs.push(t)
  await t.opened()
  return t
}
afterEach(() => { for (const t of tabs.splice(0)) t.close() })

describe('realtime socket', () => {
  it('refuses anonymous visitors and other sites', async () => {
    await expect(open(new (admin.constructor as any)())).rejects.toThrow('HTTP 401')
    await expect(open(admin, { origin: 'https://evil.example' })).rejects.toThrow('HTTP 403')
  })

  it('shows who is on an entry and who is editing it, by their account name', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const topic = `entry:post:${post.id}`
    const ada = await open(admin)
    const eda = await open(editor)
    ada.send({ type: 'watch', topic })
    eda.send({ type: 'watch', topic })
    const both = await ada.presence(topic, (p) => p.length === 2)
    expect(both.people.map((p: any) => p.name).sort()).toEqual(['Ada Admin', 'Eda Editor'])

    eda.send({ type: 'editing', topic, editing: true })
    const editing = await ada.presence(topic, (p) => p.some((x: any) => x.editing))
    expect(editing.people.find((x: any) => x.editing).id).toBe(accounts().editor.id)

    eda.close()
    await ada.presence(topic, (p) => p.length === 1)
  })

  it('ignores what a browser claims about itself', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const topic = `entry:post:${post.id}`
    const eda = await open(editor)
    eda.send({ type: 'watch', topic, name: 'Ada Admin', userId: accounts().admin.id })
    const p = await eda.presence(topic, (people) => people.length === 1)
    expect(p.people[0]).toMatchObject({ id: accounts().editor.id, name: 'Eda Editor' })
  })

  it('tells watchers what changed, and who changed it', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const ada = await open(admin)
    ada.send({ type: 'watch', topic: 'list:post' })
    ada.send({ type: 'watch', topic: `entry:post:${post.id}` })
    await ada.presence('list:post', () => true)

    const saved = await editor.patch(`/api/cms/post/${post.id}`, { title: 'Nový název' })
    const entry = await ada.next((m) => m.type === 'change' && m.topic === `entry:post:${post.id}`)
    expect(entry.change).toMatchObject({ type: 'entry.updated', id: post.id, byName: 'Eda Editor', version: saved.body.row.updatedAt })
    expect(entry.change.paths).toBeUndefined()

    await createPost(editor, { author: a.id })
    const list = await ada.next((m) => m.type === 'change' && m.topic === 'list:post')
    expect(list.change.type).toBe('entry.created')
  })

  it('needs read access to watch, and refuses made-up topics', async () => {
    const author = await newAccount('author')
    const tab = await open(author.client)
    tab.send({ type: 'watch', topic: 'list:nope' })
    expect((await tab.next((m) => m.type === 'error')).topic).toBe('list:nope')
    tab.send({ type: 'watch', topic: 'entry:post:not-a-uuid' })
    await tab.next((m) => m.type === 'error')
    tab.send({ type: 'watch', topic: 'entry:post:00000000-0000-4000-8000-000000000000' })
    await tab.next((m) => m.type === 'error')
  })

  it('drops the socket when the account is disabled', async () => {
    const person = await newAccount('editor')
    const tab = await open(person.client)
    expect((await admin.patch(`/api/cms/_users/${person.id}`, { status: 'disabled' })).status).toBe(200)
    // Checked on the heartbeat (every 20 s).
    const deadline = Date.now() + 25_000
    while (!tab.closed && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
    expect(tab.closed?.code).toBe(4401)
  }, 30_000)
})

describe('saving over someone else’s change', () => {
  it('answers 409 with who saved, unless the editor saw the latest version', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    const seen = post.updatedAt

    const first = await editor.request('PATCH', `/api/cms/post/${post.id}`, { json: { title: 'Eda' }, headers: { 'x-cms-version': seen } })
    expect(first.status).toBe(200)

    const stale = await admin.request('PATCH', `/api/cms/post/${post.id}`, { json: { title: 'Ada' }, headers: { 'x-cms-version': seen } })
    expect(stale.status).toBe(409)
    expect(stale.body.data).toMatchObject({ code: 'stale', updatedByName: 'Eda Editor', version: first.body.row.updatedAt })

    // With the current version (after reloading) or without one (save anyway), it goes through.
    expect((await admin.request('PATCH', `/api/cms/post/${post.id}`, { json: { title: 'Ada' }, headers: { 'x-cms-version': first.body.row.updatedAt } })).status).toBe(200)
    expect((await editor.patch(`/api/cms/post/${post.id}`, { title: 'Anyway' })).status).toBe(200)
  })

  it('protects globals the same way, and translations do not change the entry’s version', async () => {
    const saved = await admin.put('/api/cms/_singleton/siteSettings', { siteName: 'Web' })
    const v = saved.body.row.updatedAt
    expect((await editor.request('PUT', '/api/cms/_singleton/siteSettings', { json: { siteName: 'A' }, headers: { 'x-cms-version': v } })).status).toBe(200)
    expect((await admin.request('PUT', '/api/cms/_singleton/siteSettings', { json: { siteName: 'B' }, headers: { 'x-cms-version': v } })).status).toBe(409)

    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    expect((await editor.patch(`/api/cms/post/${post.id}?locale=en`, { title: 'English' })).status).toBe(200)
    expect((await admin.request('PATCH', `/api/cms/post/${post.id}`, { json: { title: 'Czech' }, headers: { 'x-cms-version': post.updatedAt } })).status).toBe(200)
  })

  it('refuses a malformed version', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id })
    expect((await admin.request('PATCH', `/api/cms/post/${post.id}`, { json: { title: 'x' }, headers: { 'x-cms-version': 'yesterday' } })).status).toBe(400)
  })
})
