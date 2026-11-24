import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Client, doc, tokenOf } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'
import { Collaborator, LiveTab, upgradeStatus } from '../helpers/sockets'
import { expectNoSiteErrors, siteClient, siteLogin, siteQuery, startTenants, TENANT_PASSWORD, type Tenants, type TenantSite, until } from '../helpers/tenants'

// Two sites in one process: the admin's two sockets. The realtime hub (who else is here,
// what changed) and shared editing (one document typed into by several people).
//
// The hard case is built in: site B's database is a copy of site A's, so the post below has
// the same id on both sites and the people have the same account ids. The topic
// `entry:post:<id>` and the document `post/<id>` are spelled the same on both, and "Eda
// Editor" on A is the same person id as "Eda Editor" on B. Presence lists one entry per
// person id, so a hub shared between the sites would not even show as a second person:
// the tests below look at what each socket was sent, not only at how many people it lists.
let t: Tenants
let shared: { post: string; second: string; author: string }
let entry: string
/** Editors made before the copy (the same ids on both sites) for the tests that disable an account. */
const EXTRA = ['cut', 'cut2'] as const

beforeAll(async () => {
  t = await startTenants('live', {}, {
    async seed({ url, admin }) {
      const author = await createAuthor(admin, { name: 'Shared Author' })
      await createPost(admin, { author: author.id, title: 'Shared post', slug: 'shared-post', body: doc('Uloženo') })
      await createPost(admin, { author: author.id, title: 'Second shared post', slug: 'second-shared-post', body: doc('Druhý') })
      for (const who of EXTRA) {
        const invited = await admin.post('/api/cms/_users', { email: `${who}@test.local`, role: 'editor' })
        if (invited.status !== 201) throw new Error(`seed invite ${who}: ${invited.status}`)
        const accepted = await new Client(url).post('/api/cms/_auth/accept', { token: tokenOf(invited.body.inviteUrl), name: `Person ${who}`, password: TENANT_PASSWORD })
        if (accepted.status !== 200) throw new Error(`seed accept ${who}: ${accepted.status}`)
      }
    },
  })
  const id = async (slug: string) => (await siteQuery(t.a, 'select id from post where slug = $1', [slug]))[0].id
  shared = { post: await id('shared-post'), second: await id('second-shared-post'), author: (await siteQuery(t.a, 'select id from author'))[0].id }
  entry = `entry:post:${shared.post}`
  expect((await siteQuery(t.b, `select id from post where slug = 'shared-post'`))[0].id).toBe(shared.post)
  expect(t.a.users.editor).toBe(t.b.users.editor)
}, 120_000)

const tabs: LiveTab[] = []
const writers: Collaborator[] = []
afterEach(() => {
  for (const tab of tabs.splice(0)) tab.close()
  for (const w of writers.splice(0)) w.close()
})
afterAll(async () => {
  // Sockets are closed (afterEach) before the server stops.
  try { expectNoSiteErrors(t) }
  finally { await t?.stop() }
})

const open = async (client: Client) => {
  const tab = new LiveTab(client)
  tabs.push(tab)
  await tab.opened()
  return tab
}
/** A tab of `role` on `site`, watching these topics; resolves once it has its first presence for each. */
const watching = async (site: TenantSite, role: 'admin' | 'editor' | 'author', topics: string[]) => {
  const tab = await open(siteClient(site, role))
  for (const topic of topics) {
    tab.send({ type: 'watch', topic })
    await tab.presence(topic, (p) => p.length >= 1)
  }
  return tab
}
/** Longer than a heartbeat of the test build (1 s): anything the server was going to send has arrived. */
const beats = (n = 1) => new Promise((r) => setTimeout(r, n * 1200))
const names = (people: any[]) => people.map((p) => p.name).sort()
const last = (tab: LiveTab, type: string, topic: string) => tab.all.filter((m) => m.type === type && m.topic === topic).at(-1)
/** Wait until the newest presence `tab` was sent for `topic` lists `n` people. */
const sees = (tab: LiveTab, topic: string, n: number) => until(`${n} people on ${topic}`, () => last(tab, 'presence', topic)?.people ?? [], (people) => people.length === n, 5000)

describe('the realtime hub: who is here', () => {
  it('people on the same entry id on A and on B never see each other', async () => {
    // A: Ada and Eda. B: Eda only (the same account id as A's Eda).
    const adaA = await watching(t.a, 'admin', ['list:post', entry])
    const edaA = await watching(t.a, 'editor', ['list:post', entry])
    await sees(adaA, entry, 2)
    await sees(adaA, 'list:post', 2)
    const edaB = await watching(t.b, 'editor', ['list:post', entry])
    await beats()
    expect(names(last(adaA, 'presence', entry).people)).toEqual(['Ada Admin', 'Eda Editor'])
    expect(names(last(edaA, 'presence', 'list:post').people)).toEqual(['Ada Admin', 'Eda Editor'])
    // B's Eda is alone, on both topics, in every presence message she was ever sent.
    for (const m of edaB.all.filter((x) => x.type === 'presence')) expect(names(m.people), JSON.stringify(m)).toEqual(['Eda Editor'])
    // B's own colleague joining is seen on B, and not on A.
    const sentToA = adaA.all.length
    const adaB = await watching(t.b, 'admin', [entry])
    await sees(edaB, entry, 2)
    await beats()
    expect(adaA.all.slice(sentToA).filter((m) => m.type === 'presence')).toEqual([])
    adaB.close()
    await sees(edaB, entry, 1)
  })

  it('"is editing" on A does not show on B for the same person id (where one shared list would merge the two)', async () => {
    const edaA = await watching(t.a, 'editor', [entry])
    const edaB = await watching(t.b, 'editor', [entry])
    const adaB = await watching(t.b, 'admin', [entry])
    await sees(adaB, entry, 2)
    await sees(edaB, entry, 2)
    const before = { edaB: edaB.all.length, adaB: adaB.all.length }
    edaA.send({ type: 'editing', topic: entry, editing: true })
    await edaA.presence(entry, (p) => p.some((x: any) => x.editing))
    await beats()
    // Nothing at all was sent to B's tabs because of it, and nobody on B is "editing".
    expect(edaB.all.slice(before.edaB).filter((m) => m.type === 'presence')).toEqual([])
    expect(adaB.all.slice(before.adaB).filter((m) => m.type === 'presence')).toEqual([])
    expect(last(adaB, 'presence', entry).people.some((p: any) => p.editing)).toBe(false)
    // B's Eda starts editing: B is told, and A's flag is A's own.
    edaB.send({ type: 'editing', topic: entry, editing: true })
    await adaB.presence(entry, (p) => p.some((x: any) => x.editing))
    edaA.send({ type: 'editing', topic: entry, editing: false })
    await edaA.presence(entry, (p) => !p.some((x: any) => x.editing))
    await beats()
    expect(last(adaB, 'presence', entry).people.find((p: any) => p.name === 'Eda Editor').editing).toBe(true)
  })

  it('leaving on A does not remove the same person from B\'s list', async () => {
    const edaA = await watching(t.a, 'editor', [entry])
    const edaB = await watching(t.b, 'editor', [entry])
    const adaB = await watching(t.b, 'admin', [entry])
    await sees(adaB, entry, 2)
    const before = adaB.all.length
    edaA.close()
    await edaA.ended()
    await beats(2)
    expect(adaB.all.slice(before).filter((m) => m.type === 'presence')).toEqual([])
    expect(names(last(adaB, 'presence', entry).people)).toEqual(['Ada Admin', 'Eda Editor'])
    expect(edaB.closed).toBeNull()
  })
})

describe('the realtime hub: what changed', () => {
  it('a save on A is announced to A\'s watchers of that entry and list, and to nobody on B', async () => {
    const onA = await watching(t.a, 'editor', ['list:post'])
    const onAEntry = await watching(t.a, 'admin', [entry])
    const onB = await watching(t.b, 'editor', ['list:post'])
    const onBEntry = await watching(t.b, 'admin', [entry])

    const saved = await siteClient(t.a, 'admin').patch(`/api/cms/post/${shared.post}`, { title: 'Changed on A' })
    expect(saved.status).toBe(200)
    const change = await onAEntry.next((m) => m.type === 'change' && m.topic === entry)
    expect(change.change).toMatchObject({ type: 'entry.updated', id: shared.post, byName: 'Ada Admin', version: saved.body.row.updatedAt })
    await onA.next((m) => m.type === 'change' && m.topic === 'list:post')
    await beats()
    expect(onB.all.filter((m) => m.type === 'change')).toEqual([])
    expect(onBEntry.all.filter((m) => m.type === 'change')).toEqual([])

    // B's own save: the first change B's watchers ever see is B's, with B's version; A hears nothing of it.
    const seenOnA = onAEntry.all.filter((m) => m.type === 'change').length
    const savedB = await siteClient(t.b, 'editor').patch(`/api/cms/post/${shared.post}`, { title: 'Changed on B' })
    const onBChange = await onBEntry.next((m) => m.type === 'change' && m.topic === entry)
    expect(onBChange.change).toMatchObject({ type: 'entry.updated', id: shared.post, byName: 'Eda Editor', version: savedB.body.row.updatedAt })
    await beats()
    expect(onAEntry.all.filter((m) => m.type === 'change').length).toBe(seenOnA)
    expect(onBEntry.all.filter((m) => m.type === 'change')).toHaveLength(1)
  })

  it('a new entry, a delete and a scheduled entry going live (no request at all) are each announced on their own site only', async () => {
    const onA = await watching(t.a, 'editor', ['list:post'])
    const onB = await watching(t.b, 'editor', ['list:post'])
    const admin = siteClient(t.a, 'admin')
    const made = await createPost(admin, { author: shared.author, title: 'New on A', slug: 'new-on-a' })
    expect((await onA.next((m) => m.type === 'change' && m.change.type === 'entry.created')).change.id).toBe(made.id)
    expect((await admin.delete(`/api/cms/post/${made.id}`)).status).toBe(200)
    await onA.next((m) => m.type === 'change' && m.change.type === 'entry.deleted')
    // Scheduled 2 s ahead: the scheduler task announces it, from outside any request.
    await until('the scheduler\'s first run on A', () => siteQuery(t.a, `select 1 from cms_state where key = 'scheduler.lastRun'`), (r) => r.length > 0, 10_000)
    const soon = await createPost(admin, { author: shared.author, title: 'Soon on A', slug: 'soon-on-a', status: 'published', publishedAt: new Date(Date.now() + 2000).toISOString() })
    const published = await onA.next((m) => m.type === 'change' && m.change.type === 'entry.published', 12_000)
    expect(published.change.id).toBe(soon.id)
    await beats()
    expect(onB.all.filter((m) => m.type === 'change')).toEqual([])
  }, 30_000)
})

describe('the realtime hub: accounts and limits', () => {
  it('an account disabled on A loses its socket on A; the same account id on B keeps its socket', async () => {
    const id = (await siteQuery(t.a, `select id from cms_users where email = 'cut@test.local'`))[0].id
    expect((await siteQuery(t.b, `select id from cms_users where email = 'cut@test.local'`))[0].id).toBe(id)
    const tabA = await open(await siteLogin(t.a, 'cut@test.local'))
    const tabB = await open(await siteLogin(t.b, 'cut@test.local'))
    expect((await siteClient(t.a, 'admin').patch(`/api/cms/_users/${id}`, { status: 'disabled' })).status).toBe(200)
    // Checked on the heartbeat (every second in the test build), in each site's own database.
    expect((await tabA.ended(15_000)).code).toBe(4401)
    await beats(2)
    expect(tabB.closed).toBeNull()
    tabB.send({ type: 'watch', topic: 'list:post' })
    expect((await tabB.presence('list:post', (p) => p.length === 1)).people[0].id).toBe(id)
  }, 30_000)

  it('the limit of ten tabs a person is counted per site', async () => {
    const editorA = siteClient(t.a, 'editor')
    const onB = await open(siteClient(t.b, 'editor'))
    const first = await open(editorA)
    for (let i = 0; i < 9; i++) await open(editorA)
    await beats()
    // Ten on A and one on B, the same person id: nothing was closed.
    expect(first.closed).toBeNull()
    expect(onB.closed).toBeNull()
    await open(editorA) // the eleventh on A
    expect((await first.ended()).code).toBe(4429)
    expect(onB.closed).toBeNull()
  })
})

// ── shared editing ───────────────────────────────────────────────────────────────────────

interface Session { name: string; epoch: string; fields: string[]; access: 'write' | 'read'; unsaved?: unknown }
const session = (client: Client, id: string) => client.get<Session>(`/api/cms/_collab/session?entity=post&id=${id}`)
const join = async (client: Client, s: Session) => {
  const tab = new Collaborator(client, s)
  writers.push(tab)
  await tab.synced()
  return tab
}
const eventually = async (check: () => boolean, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs
  while (!check() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25))
  return check()
}
const collabRows = (site: TenantSite) => siteQuery(site, 'select name, epoch, active_at is not null as active from cms_collab order by name')

describe('shared editing', () => {
  it('the same document name on A and B is two documents: text and cursors never cross', async () => {
    const [sa, sb] = [await session(siteClient(t.a, 'editor'), shared.post), await session(siteClient(t.b, 'editor'), shared.post)]
    expect(sa.status).toBe(200)
    expect(sb.status).toBe(200)
    expect(sa.body.name).toBe(`post/${shared.post}`)
    expect(sb.body.name).toBe(sa.body.name) // the same name on both sites
    expect(sb.body.epoch).not.toBe(sa.body.epoch) // each site started its own history

    const edaA = await join(siteClient(t.a, 'editor'), sa.body)
    const adaA = await join(siteClient(t.a, 'admin'), (await session(siteClient(t.a, 'admin'), shared.post)).body)
    const edaB = await join(siteClient(t.b, 'editor'), sb.body)
    const adaB = await join(siteClient(t.b, 'admin'), (await session(siteClient(t.b, 'admin'), shared.post)).body)
    expect(edaA.text()).toContain('Uloženo')
    expect(edaB.text()).toContain('Uloženo')

    edaA.provider.setAwarenessField('user', { name: 'Eda Editor', color: '#0090ff' })
    edaA.type('Napsáno na A')
    expect(await eventually(() => adaA.text().includes('Napsáno na A'))).toBe(true)
    expect(await eventually(() => adaA.cursors().includes('Eda Editor'))).toBe(true)
    adaB.provider.setAwarenessField('user', { name: 'Ada Admin', color: '#e5484d' })
    adaB.type('Napsáno na B')
    expect(await eventually(() => edaB.text().includes('Napsáno na B'))).toBe(true)
    expect(await eventually(() => edaB.cursors().includes('Ada Admin'))).toBe(true)
    await beats(2) // two heartbeats: anything that was going to cross has crossed

    for (const onB of [edaB, adaB]) {
      expect(onB.text()).not.toContain('Napsáno na A')
      expect(onB.cursors()).not.toContain('Eda Editor')
    }
    for (const onA of [edaA, adaA]) {
      expect(onA.text()).not.toContain('Napsáno na B')
      expect(onA.cursors()).not.toContain('Ada Admin')
    }
    // Each site's database holds its own row for the document, marked as being edited by its own heartbeat.
    const [rowsA, rowsB] = [await collabRows(t.a), await collabRows(t.b)]
    expect(rowsA.find((r) => r.name === sa.body.name)).toMatchObject({ epoch: sa.body.epoch, active: true })
    expect(rowsB.find((r) => r.name === sb.body.name)).toMatchObject({ epoch: sb.body.epoch, active: true })
  })

  it('what A handed out opens nothing on B: its session cookie, its document epoch', async () => {
    const sa = (await session(siteClient(t.a, 'editor'), shared.post)).body
    const sb = (await session(siteClient(t.b, 'editor'), shared.post)).body
    // A's session cookie on B's socket: refused at the door (tenants-hosts.spec.ts covers the door in full).
    expect(await upgradeStatus(t.b.url, '/api/cms/_collab/socket', { origin: t.b.url, cookie: t.a.cookies.editor })).toBe(401)
    expect((await session(siteClient(t.b, { cookie: t.a.cookies.editor }), shared.post)).status).toBe(401)
    // B's own session with the epoch A handed out for the same document name: not B's history, refused.
    const stale = new Collaborator(siteClient(t.b, 'editor'), { name: sb.name, epoch: sa.epoch })
    writers.push(stale)
    await expect(stale.synced()).rejects.toThrow('refused')
    // With B's own epoch it opens.
    await join(siteClient(t.b, 'editor'), sb)
  })

  it('text left behind by a tab that closed without saving is kept in its own site\'s database, and offered there only', async () => {
    const sa = (await session(siteClient(t.a, 'editor'), shared.second)).body
    const sb = (await session(siteClient(t.b, 'editor'), shared.second)).body
    const tab = await join(siteClient(t.a, 'editor'), sa)
    const onB = await join(siteClient(t.b, 'editor'), sb)
    tab.type('Rozepsáno na A a zapomenuto')
    tab.close() // closed without saving
    // A's document settles: idle, with its text and its last typist stored.
    await until('A\'s document to settle', () => collabRows(t.a), (rows) => rows.some((r) => r.name === `${sa.name}~by`) && rows.find((r) => r.name === sa.name)?.active === false, 10_000)
    const rowsB = await collabRows(t.b)
    expect(rowsB.map((r) => r.name)).not.toContain(`${sa.name}~by`)
    expect(rowsB.map((r) => r.name)).not.toContain(`${sa.name}~unsaved`)
    // B's document is still open and active (its own tab is in it).
    expect(rowsB.find((r) => r.name === sb.name)).toMatchObject({ epoch: sb.epoch, active: true })
    expect(onB.text()).not.toContain('Rozepsáno na A')
    // The next editor on A is offered the left-over text; on B nobody is.
    const nextA = (await session(siteClient(t.a, 'admin'), shared.second)).body
    expect(JSON.stringify(nextA.unsaved)).toContain('Rozepsáno na A a zapomenuto')
    onB.close()
    await until('B\'s document to settle', () => collabRows(t.b), (rows) => rows.find((r) => r.name === sb.name)?.active === false, 10_000)
    const nextB = (await session(siteClient(t.b, 'admin'), shared.second)).body
    expect(nextB.unsaved ?? null).toBeNull()
    expect(JSON.stringify(await siteQuery(t.b, 'select * from cms_collab'))).not.toContain('zapomenuto')
  }, 30_000)

  it('an account disabled on A is cut off from the document on A; the same account id keeps typing on B', async () => {
    const id = (await siteQuery(t.a, `select id from cms_users where email = 'cut2@test.local'`))[0].id
    const personA = await siteLogin(t.a, 'cut2@test.local')
    const personB = await siteLogin(t.b, 'cut2@test.local')
    const onA = await join(personA, (await session(personA, shared.post)).body)
    const onB = await join(personB, (await session(personB, shared.post)).body)
    const watcherB = await join(siteClient(t.b, 'admin'), (await session(siteClient(t.b, 'admin'), shared.post)).body)
    let closedA = false
    let closedB = false
    onA.socket.on('close', () => { closedA = true; onA.close() })
    onB.socket.on('close', () => { closedB = true })
    expect((await siteClient(t.a, 'admin').patch(`/api/cms/_users/${id}`, { status: 'disabled' })).status).toBe(200)
    expect(await eventually(() => closedA, 15_000)).toBe(true)
    await beats(2)
    expect(closedB).toBe(false)
    onB.type('Stále píšu na B')
    expect(await eventually(() => watcherB.text().includes('Stále píšu na B'))).toBe(true)
  }, 30_000)

  it('deleting the entry on A ends A\'s document; the same entry id on B stays open with its text', async () => {
    const sa = (await session(siteClient(t.a, 'editor'), shared.post)).body
    const sb = (await session(siteClient(t.b, 'editor'), shared.post)).body
    const onA = await join(siteClient(t.a, 'editor'), sa)
    const edaB = await join(siteClient(t.b, 'editor'), sb)
    const adaB = await join(siteClient(t.b, 'admin'), (await session(siteClient(t.b, 'admin'), shared.post)).body)
    let closedA = false
    onA.socket.on('close', () => { closedA = true; onA.close() })
    expect((await siteClient(t.a, 'admin').delete(`/api/cms/post/${shared.post}`)).status).toBe(200)
    expect(await eventually(() => closedA || !onA.provider.isSynced, 10_000)).toBe(true)
    expect((await collabRows(t.a)).filter((r) => r.name.startsWith(`post/${shared.post}`))).toEqual([])
    // B: the row, the open document and its people are untouched.
    expect((await collabRows(t.b)).find((r) => r.name === sb.name)).toMatchObject({ epoch: sb.epoch })
    edaB.type('B píše dál')
    expect(await eventually(() => adaB.text().includes('B píše dál'))).toBe(true)
    expect((await siteClient(t.b, 'editor').get(`/api/cms/post/${shared.post}`)).status).toBe(200)
    expect((await session(siteClient(t.a, 'editor'), shared.post)).status).toBe(404)
  }, 30_000)
})
