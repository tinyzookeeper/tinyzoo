import { renameSync, writeFileSync } from 'node:fs'
import type Redis from 'ioredis'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { type Client, doc, type ReceivedHook } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'
import type { SpawnedServer } from '../helpers/server'
import { Collaborator, LiveTab, upgradeStatus } from '../helpers/sockets'
import { startTenantInstances, type TenantInstance, type TenantInstances } from '../helpers/tenantInstances'
import { expectNoSiteErrors, siteClient, siteHooks, siteHooksMark, siteQuery, tenantGet, tenantPost, type TenantSite, until, waitForSiteHooks } from '../helpers/tenants'

// Two INSTANCES of one app in multi-tenant mode: two server processes on the same site
// directory and the same two databases, sharing what instances share through Redis (changes,
// presence, shared documents, rate limits). Two sites, A and B, on both.
//
// The hard case is built in, as in the other tenants-*.spec.ts files: site B's database is a
// copy of site A's, so the two sites hold the same account ids and the same entry ids. A
// topic (`entry:post:<id>`), a document (`post/<id>`) and a person are spelled the same on
// both sites; in Redis only the site's id keeps them apart.
//
// Every test works across the instances: what is done on one is looked for on the other,
// inside its site, and looked for in vain on the other site, on both instances.
//
// Needs a Redis: TEST_REDIS_URL (CI has one; locally `docker compose --profile redis up -d`
// and TEST_REDIS_URL=redis://localhost:6383). Without one the file skips itself.
const REDIS = process.env.TEST_REDIS_URL

describe.skipIf(!REDIS)('two instances of one app, two sites', () => {
  let x: TenantInstances
  let one: TenantInstance
  let two: TenantInstance
  let shared: { author: string; post: string; draft: string; later: string }
  let entry: string
  /** Servers a test started besides the two (stopped with them): their logs are read at the end too. */
  const more: SpawnedServer[] = []
  /** Every message on the two channels all sites of the app share (`changes`, `live`), as the instances sent them. */
  const channel: { channel: string; message: any }[] = []

  beforeAll(async () => {
    x = await startTenantInstances('instances', {}, {
      async seed({ admin }) {
        const author = await createAuthor(admin, { name: 'Shared Author' })
        await createPost(admin, { author: author.id, title: 'Shared post', slug: 'shared-post', body: doc('Uloženo') })
        await createPost(admin, { author: author.id, title: 'Shared draft', slug: 'shared-draft', body: doc('Text') })
        await createPost(admin, { author: author.id, title: 'Shared, for later', slug: 'shared-later', body: doc('Text') })
      },
    })
    one = x.one
    two = x.two
    const id = async (slug: string) => (await siteQuery(x.t.a, 'select id from post where slug = $1', [slug]))[0].id
    shared = { author: (await siteQuery(x.t.a, 'select id from author'))[0].id, post: await id('shared-post'), draft: await id('shared-draft'), later: await id('shared-later') }
    entry = `entry:post:${shared.post}`
    // The hard case: the same entry ids and the same account ids on both sites.
    expect((await siteQuery(x.t.b, `select id from post where slug = 'shared-post'`))[0].id).toBe(shared.post)
    expect(x.t.a.users).toEqual(x.t.b.users)
    expect(one.port).not.toBe(two.port)

    const listener = x.redisClient()
    listener.on('message', (ch: string, raw: string) => {
      try { channel.push({ channel: ch.slice(x.redis.prefix.length + 1), message: JSON.parse(raw) }) }
      catch { channel.push({ channel: ch, message: raw }) }
    })
    await listener.subscribe(`${x.redis.prefix}:changes`, `${x.redis.prefix}:live`)
  }, 180_000)

  const tabs: LiveTab[] = []
  const writers: Collaborator[] = []
  afterEach(() => {
    for (const tab of tabs.splice(0)) tab.close()
    for (const w of writers.splice(0)) w.close()
  })
  afterAll(async () => {
    await x?.stop()
  })

  const settle = (ms = 500) => new Promise((r) => setTimeout(r, ms))
  /** Longer than a heartbeat of the test build (1 s): anything an instance was going to send, also to the other one, has arrived. */
  const beats = (n = 1) => new Promise((r) => setTimeout(r, n * 1200))
  const hit = (site: TenantSite, path: string) => fetch(site.url + path, { redirect: 'manual' }).then(async (r) => { await r.arrayBuffer(); return { status: r.status, location: r.headers.get('location') } })
  const sitemapLocs = async (site: TenantSite): Promise<string[]> => (await tenantGet(site.url, '/api/content/_sitemap')).body.entries.map((e: any) => e.loc)
  const sitemapXml = async (site: TenantSite): Promise<string> => (await tenantGet(site.url, '/sitemap.xml', '', { accept: 'application/xml' })).text
  const about = (id: string, type?: string) => (h: ReceivedHook[]) => h.filter((hook) => hook.json.id === id && (!type || hook.json.type === type))

  it('both instances serve both sites, each from its own database, and a session of a site is valid on either instance', async () => {
    for (const instance of [one, two]) {
      expect((await tenantGet(instance.ipUrl, '/api/health/ready')).body).toEqual({ ok: true, sites: 2 })
      for (const site of [instance.a, instance.b]) {
        expect((await tenantGet(site.url, '/api/health/ready')).body).toMatchObject({ ok: true, migrations: 'done' })
        expect((await siteClient(site, 'admin').get('/api/cms/_auth/me')).body.user.id).toBe(x.t.a.users.admin)
      }
      // A's session on B: refused on either instance, although the account id exists there.
      expect((await siteClient(instance.b, { cookie: instance.a.cookies.admin }).get('/api/cms/_auth/me')).status).toBe(401)
    }
    const made = await siteClient(one.a, 'admin').post('/api/cms/tag', { name: 'Made on one', slug: 'made-on-one' })
    expect(made.status).toBe(201)
    expect((await siteClient(two.a, 'admin').get(`/api/cms/tag/${made.body.row.id}`)).status).toBe(200)
    expect((await siteClient(two.b, 'admin').get(`/api/cms/tag/${made.body.row.id}`)).status).toBe(404)
    expect((await siteClient(one.b, 'admin').get(`/api/cms/tag/${made.body.row.id}`)).status).toBe(404)
  })

  // ── 1. changes travel between instances, inside their site ────────────────────────────

  describe('a change saved on one instance', () => {
    it('clears that site\'s redirect list on the other instance at once (not after its 30 s), and leaves the other site\'s list there as it was', async () => {
      // Instance two now holds the redirect lists of both sites in memory, for 30 s each.
      expect((await hit(two.a, '/old-on-a')).status).not.toBe(301)
      expect((await hit(two.b, '/old-on-b')).status).not.toBe(301)
      expect((await hit(one.b, '/old-on-b')).status).not.toBe(301)
      const held = Date.now()
      // B gets a redirect behind every instance's back (straight into its database): no instance
      // is told, so each serves it only once its list is 30 s old or something clears the list.
      await siteQuery(x.t.b, `insert into redirect ("from", "to", permanent) values ('/old-on-b', '/new-on-b', true)`)
      expect((await hit(two.b, '/old-on-b')).status).not.toBe(301)

      // A's administrator makes a redirect on instance ONE.
      const saved = Date.now()
      expect((await siteClient(one.a, 'admin').post('/api/cms/redirect', { from: '/old-on-a', to: '/new-on-a' })).status).toBe(201)
      // Instance TWO serves it at once.
      expect(await until('instance two to serve A\'s new redirect', () => hit(two.a, '/old-on-a'), (r) => r.status === 301, 5000)).toEqual({ status: 301, location: '/new-on-a' })
      expect(Date.now() - saved).toBeLessThan(5000)
      await settle()
      // B on instance two: its list was not cleared (it still does not know the row put behind its back), and A's redirect is not B's.
      expect(Date.now() - held, 'the lists were still inside their 30 s').toBeLessThan(25_000)
      expect((await hit(two.b, '/old-on-b')).status).not.toBe(301)
      expect((await hit(one.b, '/old-on-b')).status).not.toBe(301)
      expect((await hit(two.b, '/old-on-a')).status).not.toBe(301)
      expect((await hit(one.b, '/old-on-a')).status).not.toBe(301)

      // The reverse, from instance TWO to instance ONE, with B as the site that changes.
      // A gets a row behind its back first, after instance one loaded A's list again.
      expect((await hit(one.a, '/second-old-on-a')).status).not.toBe(301)
      const heldA = Date.now()
      await siteQuery(x.t.a, `insert into redirect ("from", "to", permanent) values ('/second-old-on-a', '/second-new-on-a', true)`)
      expect((await siteClient(two.b, 'admin').post('/api/cms/redirect', { from: '/made-on-b', to: '/b-page', permanent: false })).status).toBe(201)
      expect(await until('instance one to serve B\'s new redirect', () => hit(one.b, '/made-on-b'), (r) => r.status === 302, 5000)).toEqual({ status: 302, location: '/b-page' })
      // B's list on instance one was read anew: the row put behind its back is served now too.
      expect(await hit(one.b, '/old-on-b')).toEqual({ status: 301, location: '/new-on-b' })
      await settle()
      expect(Date.now() - heldA, 'A\'s list was still inside its 30 s').toBeLessThan(25_000)
      expect((await hit(one.a, '/second-old-on-a')).status).not.toBe(301)
      expect((await hit(one.a, '/made-on-b')).status).not.toBe(302)
      expect((await hit(two.a, '/made-on-b')).status).not.toBe(302)
    })

    it('clears that site\'s sitemap on the other instance at once (not after its minute), and leaves the other site\'s sitemap as it was; one webhook, not one per instance', async () => {
      // Instance two holds both sites' sitemaps now (the entries for a minute, and the rendered /sitemap.xml).
      for (const site of [two.a, two.b]) {
        expect(await sitemapLocs(site)).not.toContain('/blog/shared-draft')
        expect(await sitemapXml(site)).not.toContain('/blog/shared-draft')
      }
      const held = Date.now()
      // B's copy of the entry goes live behind every instance's back.
      await siteQuery(x.t.b, `update post set status = 'published', published_at = now() - interval '1 hour' where id = $1`, [shared.draft])
      expect(await sitemapLocs(two.b)).not.toContain('/blog/shared-draft')

      // A publishes the entry (the same id) on instance ONE.
      const marks = { a: siteHooksMark(x.t.a), b: siteHooksMark(x.t.b) }
      const saved = Date.now()
      expect((await siteClient(one.a, 'admin').patch(`/api/cms/post/${shared.draft}`, { status: 'published' })).status).toBe(200)
      await until('instance two to list A\'s new address', () => sitemapLocs(two.a), (locs) => locs.includes('/blog/shared-draft'), 5000)
      await until('instance two to render it in A\'s /sitemap.xml', () => sitemapXml(two.a), (xml) => xml.includes('/blog/shared-draft'), 5000)
      expect(Date.now() - saved).toBeLessThan(8000)
      expect((await tenantGet(two.a.url, '/api/content/post/shared-draft')).status).toBe(200)

      // B on instance two: its sitemap is the one it held, although its own database has the entry live.
      await settle()
      expect(Date.now() - held, 'the sitemaps were still inside their minute').toBeLessThan(50_000)
      expect((await siteQuery(x.t.b, 'select status from post where id = $1', [shared.draft]))[0].status).toBe('published')
      expect(await sitemapLocs(two.b)).not.toContain('/blog/shared-draft')
      expect(await sitemapXml(two.b)).not.toContain('/blog/shared-draft')

      // The webhook of A's change: one delivery to A's receiver (the instance that saved it sends; the one that heard of it does not), none to B's.
      await waitForSiteHooks(x.t.a, marks.a, (h) => about(shared.draft, 'entry.published')(h).length > 0)
      await settle(1000)
      expect(about(shared.draft, 'entry.published')(siteHooks(x.t.a, marks.a))).toHaveLength(1)
      expect(siteHooks(x.t.b, marks.b)).toEqual([])

      // B's own change, saved on instance ONE, is what clears B's sitemap on instance two.
      expect((await siteClient(one.b, 'admin').patch(`/api/cms/post/${shared.draft}`, { title: 'Live on B too' })).status).toBe(200)
      await until('instance two to list B\'s address', () => sitemapLocs(two.b), (locs) => locs.includes('/blog/shared-draft'), 5000)
      await until('instance two to render it in B\'s /sitemap.xml', () => sitemapXml(two.b), (xml) => xml.includes('/blog/shared-draft'), 5000)
    })
  })

  // ── 2. the realtime hub across instances ─────────────────────────────────────────────

  const open = async (client: Client) => {
    const tab = new LiveTab(client)
    tabs.push(tab)
    await tab.opened()
    return tab
  }
  /** A tab of `role` on `site` (of one instance), watching these topics; resolves once it has its first presence for each. */
  const watching = async (site: TenantSite, role: 'admin' | 'editor' | 'author', topics: string[]) => {
    const tab = await open(siteClient(site, role))
    for (const topic of topics) {
      tab.send({ type: 'watch', topic })
      await tab.presence(topic, (p) => p.length >= 1)
    }
    return tab
  }
  const names = (people: any[]) => people.map((p) => p.name).sort()
  const last = (tab: LiveTab, type: string, topic: string) => tab.all.filter((m) => m.type === type && m.topic === topic).at(-1)
  /** Wait until the newest presence `tab` was sent for `topic` lists `n` people. */
  const sees = (tab: LiveTab, topic: string, n: number) => until(`${n} people on ${topic}`, () => last(tab, 'presence', topic)?.people ?? [], (people) => people.length === n, 6000)
  const presences = (tab: LiveTab, from = 0) => tab.all.slice(from).filter((m) => m.type === 'presence')
  const changes = (tab: LiveTab, from = 0) => tab.all.slice(from).filter((m) => m.type === 'change')

  describe('the realtime hub', () => {
    it('editors of A on different instances see each other on the list and on the entry; editors of B (the same person ids, the same entry id) see none of it, and the reverse', async () => {
      // A: Ada on instance one, Eda on instance two.
      const adaA = await watching(one.a, 'admin', ['list:post', entry])
      const edaA = await watching(two.a, 'editor', ['list:post', entry])
      for (const tab of [adaA, edaA]) {
        expect(names(await sees(tab, 'list:post', 2))).toEqual(['Ada Admin', 'Eda Editor'])
        expect(names(await sees(tab, entry, 2))).toEqual(['Ada Admin', 'Eda Editor'])
      }
      // B: Eda alone, on instance one (where A's Ada is). The same account id as A's Eda.
      const edaB = await watching(one.b, 'editor', ['list:post', entry])
      await beats(2)
      // In every presence message she was ever sent she is alone: A's Ada, on the same instance and the same topics, is not there.
      expect(presences(edaB).length).toBeGreaterThan(0)
      for (const m of presences(edaB)) expect(names(m.people), JSON.stringify(m)).toEqual(['Eda Editor'])

      // "Is editing" on A crosses to A's other instance, and to nobody on B.
      const beforeB = edaB.all.length
      edaA.send({ type: 'editing', topic: entry, editing: true })
      await until('Ada on instance one to see Eda editing', () => last(adaA, 'presence', entry)?.people ?? [], (people) => people.some((p: any) => p.name === 'Eda Editor' && p.editing), 6000)
      await beats()
      expect(presences(edaB, beforeB)).toEqual([])

      // The reverse: B's Ada joins on instance two. B's Eda (instance one) sees her; A's tabs are sent nothing about it.
      const beforeA = { ada: adaA.all.length, eda: edaA.all.length }
      const adaB = await watching(two.b, 'admin', [entry])
      expect(names(await sees(edaB, entry, 2))).toEqual(['Ada Admin', 'Eda Editor'])
      expect(names(await sees(adaB, entry, 2))).toEqual(['Ada Admin', 'Eda Editor'])
      // Nobody is "editing" on B: A's Eda is, B's Eda (the same id) is not.
      expect(last(adaB, 'presence', entry).people.some((p: any) => p.editing)).toBe(false)
      adaB.send({ type: 'editing', topic: entry, editing: true })
      await until('Eda of B to see Ada of B editing', () => last(edaB, 'presence', entry)?.people ?? [], (people) => people.some((p: any) => p.name === 'Ada Admin' && p.editing), 6000)
      await beats(2)
      expect(presences(adaA, beforeA.ada)).toEqual([])
      expect(presences(edaA, beforeA.eda)).toEqual([])
      // On A, Ada is not editing (B's Ada is), Eda is.
      expect(last(edaA, 'presence', entry).people.map((p: any) => [p.name, p.editing]).sort()).toEqual([['Ada Admin', false], ['Eda Editor', true]])

      // Leaving on A is seen on A's other instance; B's list keeps the same person.
      const beforeLeave = edaB.all.length
      edaA.close()
      await edaA.ended()
      expect(names(await sees(adaA, entry, 1))).toEqual(['Ada Admin'])
      await beats(2)
      expect(presences(edaB, beforeLeave)).toEqual([])
      expect(names(last(adaB, 'presence', entry).people)).toEqual(['Ada Admin', 'Eda Editor'])
    }, 60_000)

    it('a save on A through one instance is announced to A\'s watchers on the other instance, and to nobody on B on either; and the reverse', async () => {
      const adaA = await watching(one.a, 'admin', [entry])
      const edaA = await watching(two.a, 'editor', [entry])
      const listA = await watching(two.a, 'author', ['list:post'])
      const edaB = await watching(one.b, 'editor', [entry])
      const adaB = await watching(two.b, 'admin', [entry, 'list:post'])
      await sees(edaA, entry, 2)
      await sees(adaB, entry, 2)

      // Saved on instance ONE by Ada: Eda and the list's watcher, both on instance TWO, are told.
      const saved = await siteClient(one.a, 'admin').patch(`/api/cms/post/${shared.post}`, { title: 'Changed on A, instance one' })
      expect(saved.status).toBe(200)
      const told = await edaA.next((m) => m.type === 'change' && m.topic === entry)
      expect(told.change).toMatchObject({ type: 'entry.updated', entity: 'post', id: shared.post, byName: 'Ada Admin', version: saved.body.row.updatedAt })
      await listA.next((m) => m.type === 'change' && m.topic === 'list:post')
      await adaA.next((m) => m.type === 'change' && m.topic === entry)
      // Saved on instance TWO by Eda: Ada on instance ONE is told.
      const second = await siteClient(two.a, 'editor').patch(`/api/cms/post/${shared.post}`, { title: 'Changed on A, instance two' })
      expect(second.status).toBe(200)
      const back = await adaA.next((m) => m.type === 'change' && m.topic === entry)
      expect(back.change).toMatchObject({ type: 'entry.updated', id: shared.post, byName: 'Eda Editor', version: second.body.row.updatedAt })
      await beats()
      // Each of A's tabs was told once per save, not once per instance.
      expect(changes(edaA)).toHaveLength(2)
      expect(changes(adaA)).toHaveLength(2)
      // B: nothing, on either instance.
      expect(changes(edaB)).toEqual([])
      expect(changes(adaB)).toEqual([])

      // The reverse: B's save on instance TWO reaches B's watcher on instance ONE with B's own version; A hears nothing of it.
      const savedB = await siteClient(two.b, 'editor').patch(`/api/cms/post/${shared.post}`, { title: 'Changed on B' })
      expect(savedB.status).toBe(200)
      const onB = await edaB.next((m) => m.type === 'change' && m.topic === entry)
      expect(onB.change).toMatchObject({ type: 'entry.updated', id: shared.post, byName: 'Eda Editor', version: savedB.body.row.updatedAt })
      await beats()
      expect(changes(edaB)).toHaveLength(1)
      expect(changes(adaB).filter((m) => m.topic === entry)).toHaveLength(1)
      expect(changes(edaA)).toHaveLength(2)
      expect(changes(adaA)).toHaveLength(2)
      expect(changes(listA)).toHaveLength(2)
    }, 60_000)
  })

  describe('the realtime hub, with an instance on production\'s heartbeat', () => {
    it('a person who joins on another instance sees at once who is already there, not at that instance\'s next heartbeat (20 s in production)', async () => {
      // A third instance of the app that repeats who is on it every 20 s, as a deployed one does
      // (the other two do it every second, which would hide the wait).
      const third = await x.t.startInstance({ CMS_TEST_LIVE_HEARTBEAT_MS: '20000' })
      more.push(third.server)
      const onThird = (site: TenantSite): TenantSite => ({ ...site, url: `http://${site.host}:${third.port}` })
      // Nobody is connected to instance two: its hubs have stopped (a hub runs while its site has a socket on the instance).
      await beats(2)
      // Ada of A arrives on the slow instance. That is announced at once, to instances with a hub for A: there is none.
      const adaA = await watching(onThird(x.t.a), 'admin', [entry])
      const arrived = Date.now()
      await settle(1500)
      // Eda of A arrives on instance two, and so does Eda of B (the same person id, the same entry id).
      const edaA = await watching(two.a, 'editor', [entry])
      const edaB = await watching(two.b, 'editor', [entry])
      // A's Eda is told about Ada now: her instance asked who is here, and the slow one answered.
      expect(names(await until('Eda to see Ada', () => last(edaA, 'presence', entry)?.people ?? [], (people) => people.length === 2, 5000))).toEqual(['Ada Admin', 'Eda Editor'])
      expect(Date.now() - arrived, 'well before the slow instance repeats who is on it').toBeLessThan(12_000)
      expect(names(await sees(adaA, entry, 2))).toEqual(['Ada Admin', 'Eda Editor'])
      // B's Eda asked too, and is alone: A's Ada is not an answer to B's question.
      await beats(2)
      expect(presences(edaB).length).toBeGreaterThan(0)
      for (const m of presences(edaB)) expect(names(m.people), JSON.stringify(m)).toEqual(['Eda Editor'])
      // The third instance has done its part (its log is read at the end with the others').
      adaA.close()
      await adaA.ended()
      await third.server.stop()
    }, 60_000)
  })

  // ── 3. shared editing across instances ───────────────────────────────────────────────

  interface Session { name: string; epoch: string; fields: string[]; access: 'write' | 'read'; unsaved?: unknown }
  const session = (client: Client, id: string) => client.get<Session>(`/api/cms/_collab/session?entity=post&id=${id}`)
  const join = async (client: Client, s: Session) => {
    const tab = new Collaborator(client, s)
    writers.push(tab)
    await tab.synced()
    return tab
  }
  const eventually = async (check: () => boolean, timeoutMs = 6000) => {
    const deadline = Date.now() + timeoutMs
    while (!check() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25))
    return check()
  }

  describe('shared editing', () => {
    it('two people in one document of A, one on each instance, see each other\'s text and cursors; the same document name on B is another document on both instances; in Redis the site\'s id keeps them apart', async () => {
      // A's session asked on each instance: the same document, the same history.
      const [sa1, sa2] = [await session(siteClient(one.a, 'editor'), shared.post), await session(siteClient(two.a, 'admin'), shared.post)]
      expect(sa1.status).toBe(200)
      expect(sa2.body).toMatchObject({ name: `post/${shared.post}`, epoch: sa1.body.epoch })
      const [sb1, sb2] = [await session(siteClient(one.b, 'admin'), shared.post), await session(siteClient(two.b, 'editor'), shared.post)]
      expect(sb1.body.name).toBe(sa1.body.name) // the same name on both sites
      expect(sb1.body.epoch).not.toBe(sa1.body.epoch) // each site has its own history
      expect(sb2.body.epoch).toBe(sb1.body.epoch)

      // A: Eda on instance one, Ada on instance two. B the other way round, so each instance holds the document of both sites.
      const edaA = await join(siteClient(one.a, 'editor'), sa1.body)
      const adaA = await join(siteClient(two.a, 'admin'), sa2.body)
      const adaB = await join(siteClient(one.b, 'admin'), sb1.body)
      const edaB = await join(siteClient(two.b, 'editor'), sb2.body)
      for (const tab of [edaA, adaA, adaB, edaB]) expect(tab.text()).toContain('Uloženo')

      edaA.provider.setAwarenessField('user', { name: 'Eda Editor', color: '#0090ff' })
      edaA.type('Napsáno na A, instance jedna')
      expect(await eventually(() => adaA.text().includes('Napsáno na A, instance jedna'))).toBe(true)
      expect(await eventually(() => adaA.cursors().includes('Eda Editor'))).toBe(true)
      // And back, from instance two to instance one.
      adaA.type('Odpověď z instance dvě')
      expect(await eventually(() => edaA.text().includes('Odpověď z instance dvě'))).toBe(true)

      adaB.provider.setAwarenessField('user', { name: 'Ada Admin', color: '#e5484d' })
      adaB.type('Napsáno na B')
      expect(await eventually(() => edaB.text().includes('Napsáno na B'))).toBe(true)
      expect(await eventually(() => edaB.cursors().includes('Ada Admin'))).toBe(true)
      await beats(2) // two heartbeats: anything that was going to cross has crossed

      for (const onB of [edaB, adaB]) {
        expect(onB.text()).not.toContain('Napsáno na A')
        expect(onB.text()).not.toContain('Odpověď z instance dvě')
        expect(onB.cursors()).not.toContain('Eda Editor')
      }
      for (const onA of [edaA, adaA]) {
        expect(onA.text()).not.toContain('Napsáno na B')
        expect(onA.cursors()).not.toContain('Ada Admin')
      }

      // Redis, under this run's prefix: what is about the document names its site.
      const r = x.redisClient()
      const docName = sa1.body.name
      const keys = (await r.keys(`${x.redis.prefix}:*`)).filter((k) => k.includes(docName))
      const channels = ((await r.call('PUBSUB', 'CHANNELS', `${x.redis.prefix}*`)) as string[]).filter((c) => c.includes(docName))
      const ofSite = (id: string) => `${x.redis.prefix}:site:${id}:collab:`
      // Who has the document open: one list per site, each with both instances in it.
      expect(keys).toContain(`${ofSite('site-a')}presence:${docName}`)
      expect(keys).toContain(`${ofSite('site-b')}presence:${docName}`)
      for (const id of ['site-a', 'site-b']) expect(await r.zcard(`${ofSite(id)}presence:${docName}`), `instances in ${id}'s document`).toBe(2)
      // The channel the instances pass the document's updates on: one per site, both instances listening on each.
      expect(channels.sort()).toEqual([`${ofSite('site-a')}${docName}`, `${ofSite('site-b')}${docName}`])
      for (const c of channels) expect((await r.call('PUBSUB', 'NUMSUB', c)) as unknown[]).toEqual([c, 2])
      // Nothing about the document is kept or sent without a site in its name.
      for (const name of [...keys, ...channels]) expect(name.startsWith(ofSite('site-a')) || name.startsWith(ofSite('site-b')), name).toBe(true)

      // Each site's database holds its own row for the document, marked as being edited.
      const row = async (site: TenantSite) => (await siteQuery(site, 'select epoch, active_at is not null as active from cms_collab where name = $1', [docName]))[0]
      await until('both documents to be marked as being edited', async () => [await row(x.t.a), await row(x.t.b)], ([a, b]) => a?.active && b?.active, 6000)
      expect((await row(x.t.a)).epoch).toBe(sa1.body.epoch)
      expect((await row(x.t.b)).epoch).toBe(sb1.body.epoch)
    }, 60_000)

    it('after everybody left, the text typed on both instances waits on its own site; a document stays "being edited" while someone has it open on the other instance', async () => {
      const name = `post/${shared.post}`
      const rows = (site: TenantSite) => siteQuery(site, 'select name, epoch, active_at is not null as active from cms_collab order by name')
      const idle = (site: TenantSite) => until(`the document of ${site.id} to settle`, () => rows(site), (r) => r.some((row) => row.name === `${name}~by`) && r.find((row) => row.name === name)?.active === false, 15_000)
      // The tabs of the test before are closed: each instance stored its copy when its last tab left,
      // and "nobody has it open" was decided over both instances (their lists in Redis).
      await idle(x.t.a)
      await idle(x.t.b)
      // The next person, on either instance, is offered what was left behind on their site, typed on whichever instance.
      const nextA = await session(siteClient(two.a, 'admin'), shared.post)
      expect(JSON.stringify(nextA.body.unsaved)).toContain('Napsáno na A, instance jedna')
      expect(JSON.stringify(nextA.body.unsaved)).toContain('Odpověď z instance dvě')
      expect(JSON.stringify(nextA.body.unsaved)).not.toContain('Napsáno na B')
      const nextB = await session(siteClient(one.b, 'editor'), shared.post)
      expect(JSON.stringify(nextB.body.unsaved)).toContain('Napsáno na B')
      expect(JSON.stringify(nextB.body.unsaved)).not.toContain('Napsáno na A')

      // A new history on A. One person on each instance; the one on instance one types and leaves.
      const here = await join(siteClient(one.a, 'editor'), (await session(siteClient(one.a, 'editor'), shared.post)).body)
      const there = await join(siteClient(two.a, 'admin'), nextA.body)
      expect(here.text()).not.toContain('Napsáno na A')
      here.type('Dopsáno na instanci jedna')
      expect(await eventually(() => there.text().includes('Dopsáno na instanci jedna'))).toBe(true)
      here.close()
      writers.splice(writers.indexOf(here), 1)
      // Instance one has no tab in it any more and stores its copy; the document is still being edited (on instance two).
      await beats(4)
      expect((await rows(x.t.a)).find((row) => row.name === name)).toMatchObject({ epoch: nextA.body.epoch, active: true })
      // So a third person is sent into the same history, on either instance, and has the text.
      const again = await session(siteClient(one.a, 'author'), shared.post)
      expect(again.body.epoch).toBe(nextA.body.epoch)
      const third = await join(siteClient(one.a, 'editor'), again.body)
      expect(third.text()).toContain('Dopsáno na instanci jedna')
      third.close()
      writers.splice(writers.indexOf(third), 1)
      there.close()
      writers.splice(writers.indexOf(there), 1)
      // The last one left, on instance two: idle now.
      await until('A\'s document to be idle', () => rows(x.t.a), (r) => r.find((row) => row.name === name)?.active === false, 15_000)
    }, 60_000)
  })

  // ── 4. rate limits: shared by the instances, per site ────────────────────────────────

  describe('rate limits', () => {
    it('sign-in tries on A through both instances add up to one limit; B is untouched on both', async () => {
      // The counter in Redis is per quarter of an hour: do not start within the last seconds of one.
      const WINDOW = 15 * 60_000
      const left = WINDOW - (Date.now() % WINDOW)
      if (left < 8000) await settle(left + 200)
      const wrong = { email: 'limit@test.local', password: 'not the password' }
      // Ten tries are allowed per address: five on each instance, in turn.
      const statuses: number[] = []
      for (let i = 0; i < 5; i++) {
        statuses.push((await tenantPost(one.a.url, '/api/cms/_auth/login', wrong)).status)
        statuses.push((await tenantPost(two.a.url, '/api/cms/_auth/login', wrong)).status)
      }
      expect(statuses).toEqual(Array(10).fill(401))
      // The eleventh, on either instance: refused. (Counted apart, each instance would allow five more.)
      expect((await tenantPost(one.a.url, '/api/cms/_auth/login', wrong)).status).toBe(429)
      expect((await tenantPost(two.a.url, '/api/cms/_auth/login', wrong)).status).toBe(429)
      // B, the same address, on both instances: its own count, which starts now.
      expect((await tenantPost(two.b.url, '/api/cms/_auth/login', wrong)).status).toBe(401)
      expect((await tenantPost(one.b.url, '/api/cms/_auth/login', wrong)).status).toBe(401)
      // And A's lock is on that one address, not on A: somebody else signs in on A.
      expect((await tenantPost(two.a.url, '/api/cms/_auth/login', { email: 'editor@test.local', password: 'correct horse battery' })).status).toBe(200)
    })
  })

  // ── 5. scheduled publishing with two instances ───────────────────────────────────────

  describe('scheduled publishing', () => {
    const lastRun = async (site: TenantSite) => (await siteQuery(site, `select value->>'at' as at from cms_state where key = 'scheduler.lastRun'`))[0]?.at ?? null
    const wentLive = () => ([x.logs(), ...more.map((server) => server.logs.join(''))].join('\n').match(/\[cms\] scheduled: \d+ entries went live/g) ?? []).length

    it('an entry scheduled on A is announced once (one webhook delivery, one notice per watcher) although both instances run the task; nothing on B', async () => {
      await until('the scheduler\'s first run on both sites', async () => [await lastRun(x.t.a), await lastRun(x.t.b)], ([a, b]) => !!a && !!b, 10_000)
      // Watchers of A's list on each instance, and of B's on each.
      const onA = [await watching(one.a, 'editor', ['list:post']), await watching(two.a, 'editor', ['list:post'])]
      const onB = [await watching(one.b, 'editor', ['list:post']), await watching(two.b, 'editor', ['list:post'])]
      const marks = { a: siteHooksMark(x.t.a), b: siteHooksMark(x.t.b) }
      const announced = wentLive()
      // Saved 2 s before its time, on instance two: not live at the save, so only the task can announce it.
      expect((await siteClient(two.a, 'admin').patch(`/api/cms/post/${shared.later}`, { status: 'published', publishedAt: new Date(Date.now() + 2000).toISOString() })).status).toBe(200)
      expect((await tenantGet(one.a.url, '/api/content/post/shared-later')).status).toBe(404)
      const published = about(shared.later, 'entry.published')
      const [hook] = published(await waitForSiteHooks(x.t.a, marks.a, (h) => published(h).length > 0, 12_000))
      expect(hook!.json).toMatchObject({ type: 'entry.published', public: true, paths: ['/blog/shared-later'] })
      // Both instances serve it, and both of A's watchers hear of it.
      for (const site of [one.a, two.a]) expect((await tenantGet(site.url, '/api/content/post/shared-later')).status).toBe(200)
      // (The save itself was announced as it was made, by its author; the task's announcement has none.)
      const byTheTask = (m: any) => m.type === 'change' && m.change.type === 'entry.published' && m.change.by === null
      for (const tab of onA) expect((await until('the task\'s notice', () => tab.all.filter(byTheTask), (got) => got.length > 0, 6000))[0].change.id).toBe(shared.later)
      // A few more rounds of the task on both instances: still one announcement.
      for (let round = 0; round < 3; round++) {
        const seen = await lastRun(x.t.a)
        await until('another scheduler run on A', () => lastRun(x.t.a), (at) => at !== seen, 10_000)
      }
      await settle()
      expect(published(siteHooks(x.t.a, marks.a))).toHaveLength(1)
      for (const tab of onA) {
        expect(tab.all.filter(byTheTask)).toHaveLength(1)
        // In all: the save (told once, by its author) and the task's announcement.
        expect(changes(tab).map((m) => [m.change.type, m.change.by === null ? 'task' : 'person'])).toEqual([['entry.published', 'person'], ['entry.published', 'task']])
      }
      expect(wentLive() - announced, 'instances that announced it').toBe(1)
      // B: no webhook, no notice, and its copy of the entry is still a draft.
      expect(siteHooks(x.t.b, marks.b)).toEqual([])
      for (const tab of onB) expect(changes(tab)).toEqual([])
      expect((await siteQuery(x.t.b, 'select status from post where id = $1', [shared.later]))[0].status).toBe('draft')
      for (const site of [one.b, two.b]) expect((await tenantGet(site.url, '/api/content/post/shared-later')).status).toBe(404)
    }, 60_000)
  })

  // ── 6. the site directory is one file for both instances ─────────────────────────────

  describe('a change of the site directory', () => {
    const write = (rows: unknown[]) => {
      const tmp = `${x.t.directoryFile}.tmp`
      writeFileSync(tmp, JSON.stringify({ sites: rows }, null, 2))
      renameSync(tmp, x.t.directoryFile)
    }

    it('pausing A answers 503 on both instances within a second; B is served by both all along', async () => {
      for (const site of [one.a, two.a]) expect((await tenantGet(site.url, '/api/content/tag')).status).toBe(200)
      const at = Date.now()
      write(x.t.rows.map((row) => (row.id === 'site-a' ? { ...row, state: 'paused' } : row)))
      try {
        const took = await Promise.all([one, two].map(async (instance) => {
          const res = await until(`A to be paused on port ${instance.port}`, () => tenantGet(instance.a.url, '/api/content/tag'), (r) => r.status === 503, 5000)
          expect(res.text).toBe('This website is paused')
          return Date.now() - at
        }))
        expect(Math.max(...took), `ms until both answered 503: ${took.join(', ')}`).toBeLessThan(1000)
        for (const instance of [one, two]) {
          expect((await tenantGet(instance.a.url, '/admin')).status).toBe(503)
          expect(await upgradeStatus(instance.a.url, '/api/cms/_live', { origin: instance.a.url, cookie: instance.a.cookies.admin })).toBe(503)
          expect((await tenantGet(instance.b.url, '/api/content/tag')).status).toBe(200)
          expect((await siteClient(instance.b, 'admin').get('/api/cms/_auth/me')).status).toBe(200)
          // The process's own health check still counts both sites.
          expect((await tenantGet(instance.ipUrl, '/api/health/ready')).body).toEqual({ ok: true, sites: 2 })
        }
      }
      finally {
        write(x.t.rows)
      }
      const back = Date.now()
      for (const instance of [one, two]) {
        await until(`A to be back on port ${instance.port}`, () => tenantGet(instance.a.url, '/api/content/tag'), (r) => r.status === 200, 5000)
        expect((await siteClient(instance.a, 'admin').get('/api/cms/_auth/me')).status).toBe(200)
      }
      expect(Date.now() - back).toBeLessThan(2000)
    })
  })

  // ── 7. what the instances said to each other, and their logs ─────────────────────────

  describe('at the end', () => {
    it('every message on the channels all sites share named its site', () => {
      const sites = (name: string) => [...new Set(channel.filter((m) => m.channel === name).map((m) => m.message?.site))].sort()
      // Both sites sent changes and presence, and no message went without a site (or with another).
      expect(sites('changes')).toEqual(['site-a', 'site-b'])
      expect(sites('live')).toEqual(['site-a', 'site-b'])
      // The instances wrote them: the two, and the ones a test started.
      expect(new Set(channel.map((m) => m.message?.origin)).size).toBe(2 + more.length)
    })

    it('neither server logged work that ran without a site, a dropped change or an error of the shared store', () => {
      for (const server of [one.server, two.server, ...more]) expectNoSiteErrors({ server })
      const bad = [x.logs(), ...more.map((server) => server.logs.join(''))].join('\n').split('\n').filter((line) => /dropped a change for a site|\[cms\] redis|could not publish change|realtime (announce|delivery) failed|cannot hear other instances|could not listen for changes|collab presence|rate limit store error/.test(line))
      expect(bad).toEqual([])
    })
  })
})
