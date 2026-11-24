import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Client, doc } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'
import { expectNoSiteErrors, siteClient, siteQuery, startTenants, type Tenants, type TenantSite, tenantGet, until } from '../helpers/tenants'

// Two sites in one process: the analytics and consent plugins (the playground counts in
// `consent` mode). Page views wait in memory and are written together a moment later
// (CMS_TEST_ANALYTICS_FLUSH_MS, 100 ms in tests): the buffer, its timer, the switch, the
// day's salt, the address-to-entry map and the banner's settings are each a site's own.
//
// Site B's database is a copy of site A's: the shared post has the same id and address on both.
let t: Tenants
let adminA: Client
let adminB: Client
let shared: { post: string; author: string }

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
let n = 0
const viewId = () => `tview${Date.now().toString(36)}${(n++).toString(36)}`
/** What the tracker sends for a page view, from the browser `client` is. */
const view = (client: Client, p: string, over: Record<string, unknown> = {}) =>
  client.request('POST', '/api/content/_analytics/e', { body: JSON.stringify({ v: viewId(), p, w: 1440, l: 'cs-CZ', lc: 'cs', ...over }), headers: { 'content-type': 'text/plain', 'user-agent': CHROME } })
const events = (site: TenantSite) => siteQuery(site, 'select path, visitor, session, entity, entry_id, consent_id from analytics_events order by id')
const paths = async (site: TenantSite) => (await events(site)).map((r) => r.path)
/** Wait for `site` to hold a view of each of `wanted`. */
const written = (site: TenantSite, wanted: string[]) => until(`views of ${wanted.join(', ')} on ${site.id}`, () => paths(site), (got) => wanted.every((p) => got.includes(p)), 5000)
/** Longer than the flush timer and its write: what was going to be written has been. */
const settle = () => new Promise((r) => setTimeout(r, 500))

beforeAll(async () => {
  t = await startTenants('analytics', {}, {
    async seed({ admin }) {
      const author = await createAuthor(admin, { name: 'Shared Author' })
      await createPost(admin, { author: author.id, title: 'Shared post', slug: 'shared-post', status: 'published', body: doc('Text') })
    },
  })
  adminA = siteClient(t.a, 'admin')
  adminB = siteClient(t.b, 'admin')
  shared = { post: (await siteQuery(t.a, 'select id from post'))[0].id, author: (await siteQuery(t.a, 'select id from author'))[0].id }
  expect((await siteQuery(t.b, 'select id from post'))[0].id).toBe(shared.post)
  await createPost(adminA, { author: shared.author, title: 'Only on A', slug: 'only-on-a', status: 'published' })
  for (const admin of [adminA, adminB]) expect((await admin.put('/api/cms/_singleton/analytics_settings', { collect: true })).status).toBe(200)
}, 120_000)
afterAll(async () => {
  try { expectNoSiteErrors(t) }
  finally { await t?.stop() }
})

describe('page views', () => {
  it('a view collected on A is written to A\'s database after the timed flush, and never to B\'s', async () => {
    expect((await view(siteClient(t.a), '/first-on-a')).status).toBe(202)
    await written(t.a, ['/first-on-a'])
    await settle()
    expect(await paths(t.b)).toEqual([])
    // B's own view goes to B.
    expect((await view(siteClient(t.b), '/first-on-b')).status).toBe(202)
    await written(t.b, ['/first-on-b'])
    await settle()
    expect(await paths(t.a)).toEqual(['/first-on-a'])
    expect(await paths(t.b)).toEqual(['/first-on-b'])
  })

  it('views collected on both sites at the same moment each land in their own database, none lost, none doubled', async () => {
    const before = { a: (await paths(t.a)).length, b: (await paths(t.b)).length }
    const a = Array.from({ length: 25 }, (_, i) => `/burst-a-${i}`)
    const b = Array.from({ length: 25 }, (_, i) => `/burst-b-${i}`)
    // Interleaved, so both buffers fill and both timers run at once.
    await Promise.all(a.flatMap((p, i) => [view(siteClient(t.a), p), view(siteClient(t.b), b[i]!)]))
    await Promise.all([written(t.a, a), written(t.b, b)])
    await settle()
    const [inA, inB] = [await paths(t.a), await paths(t.b)]
    expect(inA.filter((p) => p.startsWith('/burst-')).sort()).toEqual([...a].sort())
    expect(inB.filter((p) => p.startsWith('/burst-')).sort()).toEqual([...b].sort())
    expect([inA.length - before.a, inB.length - before.b]).toEqual([25, 25])
  })

  it('the time a page was looked at is added to the view on its own site only', async () => {
    const visitor = siteClient(t.a)
    const v = viewId()
    await view(visitor, '/looked-at', { v })
    await written(t.a, ['/looked-at'])
    // The same view id reported from B's site (another visitor's browser cannot know it, but ids are not secret).
    const sameOnB = siteClient(t.b)
    sameOnB.ip = visitor.ip
    await sameOnB.request('POST', '/api/content/_analytics/e', { body: JSON.stringify({ v, e: 9000 }), headers: { 'content-type': 'text/plain', 'user-agent': CHROME } })
    await visitor.request('POST', '/api/content/_analytics/e', { body: JSON.stringify({ v, e: 4000 }), headers: { 'content-type': 'text/plain', 'user-agent': CHROME } })
    const row = await until('the time on A', () => siteQuery(t.a, `select engaged_ms from analytics_events where path = '/looked-at'`), (r) => r[0]?.engaged_ms > 0)
    await settle()
    expect((await siteQuery(t.a, `select engaged_ms from analytics_events where path = '/looked-at'`))[0].engaged_ms).toBe(4000)
    expect(row[0].engaged_ms).toBe(4000)
  })

  it('an address is matched to the entry of the site it was viewed on', async () => {
    // B first: the map of addresses is kept ten minutes, and B's must not become A's.
    await view(siteClient(t.b), '/blog/shared-post')
    await view(siteClient(t.b), '/blog/only-on-a') // no such post on B
    await written(t.b, ['/blog/shared-post', '/blog/only-on-a'])
    await view(siteClient(t.a), '/blog/shared-post')
    await view(siteClient(t.a), '/blog/only-on-a')
    await written(t.a, ['/blog/shared-post', '/blog/only-on-a'])
    const of = async (site: TenantSite, path: string) => (await events(site)).find((r) => r.path === path)
    const onlyA = (await siteQuery(t.a, `select id from post where slug = 'only-on-a'`))[0].id
    expect(await of(t.a, '/blog/shared-post')).toMatchObject({ entity: 'post', entry_id: shared.post })
    expect(await of(t.b, '/blog/shared-post')).toMatchObject({ entity: 'post', entry_id: shared.post })
    expect(await of(t.a, '/blog/only-on-a')).toMatchObject({ entity: 'post', entry_id: onlyA })
    expect(await of(t.b, '/blog/only-on-a')).toMatchObject({ entity: null, entry_id: null })
    // A post published on B after its map was built is found at once (the change forgets B's map, not A's).
    await createPost(adminB, { author: shared.author, title: 'Only on B', slug: 'only-on-b', status: 'published' })
    await view(siteClient(t.b), '/blog/only-on-b')
    await view(siteClient(t.a), '/blog/only-on-b')
    await Promise.all([written(t.b, ['/blog/only-on-b']), written(t.a, ['/blog/only-on-b'])])
    expect((await of(t.b, '/blog/only-on-b'))!.entity).toBe('post')
    expect((await of(t.a, '/blog/only-on-b'))!.entity).toBeNull()
  })

  it('the same browser is a different visitor on each site, hashed with each site\'s own salt of the day', async () => {
    const onA = siteClient(t.a)
    const onB = siteClient(t.b)
    onB.ip = onA.ip
    await Promise.all([view(onA, '/same-browser'), view(onB, '/same-browser')])
    await Promise.all([written(t.a, ['/same-browser']), written(t.b, ['/same-browser'])])
    const visitorOf = async (site: TenantSite) => (await events(site)).find((r) => r.path === '/same-browser')!.visitor
    const [va, vb] = [await visitorOf(t.a), await visitorOf(t.b)]
    expect(va).toMatch(/^[0-9a-f]{16}$/)
    expect(va).not.toBe(vb)
    // Each database keeps its own salt (made on the site's first view of the day), and they differ.
    const salt = async (site: TenantSite) => (await siteQuery(site, `select value from cms_state where key = 'analytics:salt'`))[0]?.value
    const [sa, sb] = [await salt(t.a), await salt(t.b)]
    expect(sa.salt).toMatch(/^[0-9a-f]{64}$/)
    expect(sb.salt).toMatch(/^[0-9a-f]{64}$/)
    expect(sa.salt).not.toBe(sb.salt)
    expect(sa.day).toBe(sb.day)
  })

  it('a view sent to A from B\'s pages (its origin) is not counted', async () => {
    const from = (origin: string) => siteClient(t.a).request('POST', '/api/content/_analytics/e', {
      body: JSON.stringify({ v: viewId(), p: `/from-${new URL(origin).hostname.split('.')[0]}`, w: 1440, l: 'cs' }),
      headers: { 'content-type': 'text/plain', 'user-agent': CHROME, origin },
    })
    await from(t.b.url)
    await from(t.a.url)
    await written(t.a, ['/from-site-a'])
    await settle()
    expect(await paths(t.a)).not.toContain('/from-site-b')
  })
})

describe('the switch and the reports', () => {
  it('turning collecting off on A stops A at once and does not stop B, inside the half minute each remembers its switch', async () => {
    // Both have just read their switch (the views above), so both hold "on" in memory.
    expect((await adminA.put('/api/cms/_singleton/analytics_settings', { collect: false })).status).toBe(200)
    await view(siteClient(t.a), '/while-a-is-off')
    await view(siteClient(t.b), '/while-a-is-off')
    await written(t.b, ['/while-a-is-off'])
    await settle()
    expect(await paths(t.a)).not.toContain('/while-a-is-off')
    const stats = async (admin: Client) => (await admin.get('/api/cms/_p/analytics/stats?period=today')).body.collecting
    expect(await stats(adminA)).toMatchObject({ on: false, settings: false })
    expect(await stats(adminB)).toMatchObject({ on: true, settings: true })
    // On again on A; B switched off meanwhile stops B only.
    expect((await adminA.put('/api/cms/_singleton/analytics_settings', { collect: true })).status).toBe(200)
    expect((await adminB.put('/api/cms/_singleton/analytics_settings', { collect: false })).status).toBe(200)
    await view(siteClient(t.a), '/while-b-is-off')
    await view(siteClient(t.b), '/while-b-is-off')
    await written(t.a, ['/while-b-is-off'])
    await settle()
    expect(await paths(t.b)).not.toContain('/while-b-is-off')
    expect((await adminB.put('/api/cms/_singleton/analytics_settings', { collect: true })).status).toBe(200)
  })

  it('each site\'s reports count its own views: the admin\'s pages and the token routes for a monitor', async () => {
    const count = async (site: TenantSite) => (await siteQuery(site, `select count(*)::int as n from analytics_events where at > now() - interval '1 hour'`))[0].n
    // One more on A, so the two sites' totals differ and a mixed-up answer shows.
    await view(siteClient(t.a), '/one-more-on-a')
    await written(t.a, ['/one-more-on-a'])
    const [na, nb] = [await count(t.a), await count(t.b)]
    const stats = async (admin: Client) => (await admin.get('/api/cms/_p/analytics/stats?period=today')).body
    const [sa, sb] = [await stats(adminA), await stats(adminB)]
    expect(sa.totals.pageviews).toBe(na)
    expect(sb.totals.pageviews).toBe(nb)
    expect(JSON.stringify(sa.lists.page)).toContain('/first-on-a')
    expect(JSON.stringify(sa.lists.page)).not.toContain('/first-on-b')
    expect(JSON.stringify(sb.lists.page)).toContain('/first-on-b')
    expect(JSON.stringify(sb.lists.page)).not.toContain('/first-on-a')
    // The shared entry's panel: the same entry id, each site's own numbers.
    const panel = async (admin: Client) => (await admin.get(`/api/cms/_p/analytics/entry?entity=post&id=${shared.post}`)).body
    expect((await panel(adminA)).pageviews).toBe((await siteQuery(t.a, `select count(*)::int as n from analytics_events where path = '/blog/shared-post'`))[0].n)
    expect((await panel(adminB)).pageviews).toBe((await siteQuery(t.b, `select count(*)::int as n from analytics_events where path = '/blog/shared-post'`))[0].n)

    // For a fleet monitor, with the site's status token: A's token reads A, and is refused by B.
    const today = new Date().toISOString().slice(0, 10)
    for (const route of ['/api/content/_analytics/live', `/api/content/_analytics/rollups?from=${today}&to=${today}`]) {
      expect((await tenantGet(t.b.url, route, '', { 'x-api-key': t.a.statusToken })).status, route).toBe(401)
      expect((await tenantGet(t.a.url, route, '', { 'x-api-key': t.b.statusToken })).status, route).toBe(401)
      expect((await tenantGet(t.a.url, route, '', { 'x-api-key': t.a.statusToken })).status, route).toBe(200)
    }
    const live = async (site: TenantSite) => (await tenantGet(site.url, '/api/content/_analytics/live', '', { 'x-api-key': site.statusToken })).body
    expect((await live(t.a)).today.pageviews).toBe(na)
    expect((await live(t.b)).today.pageviews).toBe(nb)
  })

  it('the nightly totals are made in each site\'s own database from its own old views', async () => {
    // 100 days ago (the playground keeps 90 days of raw views): three views on A, one on B.
    // At noon of that day in the site's time zone: a view "a minute later" must not fall on
    // the next day when the test happens to run a minute before that day's midnight.
    const noon = `(date_trunc('day', (now() - interval '100 days') at time zone 'Europe/Prague') + interval '12 hours') at time zone 'Europe/Prague'`
    await siteQuery(t.a, `insert into analytics_events (at, path, visitor, session, view, is_entry, source, device, engaged_ms) values
      (${noon}, '/', 'v1', 's1', 'x1', true, 'Google', 'mobile', 1000),
      (${noon} + interval '1 minute', '/old-a', 'v1', 's1', 'x2', false, 'Google', 'mobile', 2000),
      (${noon}, '/', 'v2', 's2', 'x3', true, 'Direct', 'desktop', 500)`)
    await siteQuery(t.b, `insert into analytics_events (at, path, visitor, session, view, is_entry, source, device, engaged_ms) values
      (${noon}, '/old-b', 'w1', 't1', 'y1', true, 'Seznam', 'desktop', 700)`)
    const day = (await siteQuery(t.a, `select ((now() - interval '100 days') at time zone 'Europe/Prague')::date::text as day`))[0].day
    // The retention task runs every 3 s in the test build, for every site: totals first, then the old views go.
    const old = (site: TenantSite) => siteQuery(site, `select count(*)::int as n from analytics_events where at < now() - interval '95 days'`).then((r) => r[0].n)
    await until('A\'s old views to be rolled up', () => old(t.a), (left) => left === 0, 20_000)
    await until('B\'s old views to be rolled up', () => old(t.b), (left) => left === 0, 20_000)
    const totals = (site: TenantSite) => siteQuery(site, `select dimension, value, visitors, pageviews from analytics_daily where day = $1 and dimension in ('total', 'source', 'page') order by dimension, value`, [day])
    expect(await totals(t.a)).toEqual([
      { dimension: 'page', value: '/', visitors: 2, pageviews: 2 },
      { dimension: 'page', value: '/old-a', visitors: 1, pageviews: 1 },
      { dimension: 'source', value: 'Direct', visitors: 1, pageviews: 1 },
      { dimension: 'source', value: 'Google', visitors: 1, pageviews: 2 },
      { dimension: 'total', value: '', visitors: 2, pageviews: 3 },
    ])
    expect(await totals(t.b)).toEqual([
      { dimension: 'page', value: '/old-b', visitors: 1, pageviews: 1 },
      { dimension: 'source', value: 'Seznam', visitors: 1, pageviews: 1 },
      { dimension: 'total', value: '', visitors: 1, pageviews: 1 },
    ])
    // Today's views were left alone on both.
    expect(await paths(t.a)).toContain('/first-on-a')
    expect(await paths(t.b)).toContain('/first-on-b')
  }, 45_000)
})

describe('the cookie banner', () => {
  const config = async (site: TenantSite, locale = 'cs') => (await siteClient(site).get(`/api/content/_consent/config?locale=${locale}`)).body
  const choose = (client: Client, choice: Record<string, unknown>, extra: Record<string, unknown> = {}) => client.post('/api/content/_consent/choice', { choice, version: 1, ...extra })
  const log = (site: TenantSite) => siteQuery(site, 'select consent_id, action, version from consent_log order by id')

  it('texts changed on A do not change B\'s, inside the half minute each remembers its settings', async () => {
    // Both read their settings first: the standard texts, version 1.
    expect((await config(t.b)).texts.title).toBe('Cookies na tomto webu')
    expect((await config(t.a)).texts.title).toBe('Cookies na tomto webu')
    expect((await siteClient(t.a, 'editor').put('/api/cms/_singleton/consent_settings', { title: 'Sušenky u A', privacyUrl: '/ochrana-a' })).status).toBe(200)
    expect((await siteClient(t.a, 'editor').put('/api/cms/_singleton/consent_settings?locale=en', { title: 'Biscuits at A' })).status).toBe(200)
    for (let round = 0; round < 2; round++) {
      expect((await config(t.a)).texts).toMatchObject({ title: 'Sušenky u A', privacyUrl: '/ochrana-a' })
      expect((await config(t.b)).texts).toMatchObject({ title: 'Cookies na tomto webu', privacyUrl: '' })
      expect((await config(t.a, 'en')).texts.title).toBe('Biscuits at A')
      expect((await config(t.b, 'en')).texts.title).toBe('Cookies on this website')
    }
    // B writes its own: both keep theirs.
    expect((await siteClient(t.b, 'editor').put('/api/cms/_singleton/consent_settings', { title: 'Sušenky u B' })).status).toBe(200)
    expect((await config(t.b)).texts.title).toBe('Sušenky u B')
    expect((await config(t.a)).texts.title).toBe('Sušenky u A')
  })

  it('"ask everyone again" on A raises A\'s version only', async () => {
    expect((await config(t.a)).version).toBe(1)
    expect((await config(t.b)).version).toBe(1)
    expect((await siteClient(t.a, 'editor').post('/api/cms/_p/consent/ask-again', {})).body).toEqual({ version: 2 })
    expect((await config(t.a)).version).toBe(2)
    expect((await config(t.b)).version).toBe(1)
    // A choice on B is still given under B's version 1; on A under A's 2.
    expect((await choose(siteClient(t.b), { analytics: true, marketing: false }, { version: 2 })).body.version).toBe(1)
    expect((await choose(siteClient(t.a), { analytics: true, marketing: false }, { version: 2 })).body.version).toBe(2)
    expect((await siteClient(t.a, 'admin').put('/api/cms/_singleton/consent_settings', { version: 1 })).status).toBe(200)
    expect((await config(t.a)).version).toBe(1)
  })

  it('a choice is logged in its own site\'s database, and its counts are that site\'s', async () => {
    const before = { a: (await log(t.a)).length, b: (await log(t.b)).length }
    const res = await choose(siteClient(t.a), { analytics: true, marketing: true })
    expect(res.status).toBe(200)
    expect((await log(t.a)).length).toBe(before.a + 1)
    expect((await log(t.b)).length).toBe(before.b)
    expect((await log(t.b)).map((r) => r.consent_id)).not.toContain(res.body.id)
    const total = async (site: TenantSite) => (await siteClient(site, 'editor').get('/api/cms/_p/consent/stats')).body.totals.total
    expect(await total(t.a)).toBe((await log(t.a)).length)
    expect(await total(t.b)).toBe((await log(t.b)).length)
    // A choice sent to A from B's pages is refused.
    expect((await siteClient(t.a).request('POST', '/api/content/_consent/choice', { json: { choice: { analytics: true, marketing: true } }, headers: { origin: t.b.url } })).status).toBe(403)
  })

  it('a visitor who takes statistics back on A loses the consent id on A\'s views; B\'s views with the same id keep it', async () => {
    // One consent id on both sites (a visitor's id is theirs to send): the hard case for "forget this id".
    const onA = siteClient(t.a)
    const given = await choose(onA, { analytics: true, marketing: true })
    const id = given.body.id
    const onB = siteClient(t.b)
    expect((await choose(onB, { analytics: true, marketing: true }, { id })).body.id).toBe(id)
    await Promise.all([view(onA, '/consented'), view(onB, '/consented')])
    const idOn = async (site: TenantSite) => (await events(site)).find((r) => r.path === '/consented')?.consent_id
    await until('the views with the consent id', async () => [await idOn(t.a), await idOn(t.b)], ([a, b]) => a === id && b === id)

    expect((await choose(onA, { analytics: false, marketing: true })).body.action).toBe('withdrawn')
    await until('A to forget the id', () => idOn(t.a), (v) => v === null)
    await settle()
    expect(await idOn(t.b)).toBe(id)
    // And B's own withdrawal clears B's.
    expect((await choose(onB, { analytics: false, marketing: true })).body.action).toBe('withdrawn')
    await until('B to forget the id', () => idOn(t.b), (v) => v === null)
  })

  it('old records of consent are deleted in each site\'s own database', async () => {
    for (const site of [t.a, t.b]) {
      await siteQuery(site, `insert into consent_log (consent_id, at, action, choice, version) values
        ('${site === t.a ? 'a' : 'b'}aaaaaaaaaaaaaaaaaaaaa', now() - interval '4 years', 'given', '{"analytics":true}', 1),
        ('${site === t.a ? 'a' : 'b'}bbbbbbbbbbbbbbbbbbbbb', now() - interval '2 years', 'given', '{"analytics":true}', 1)`)
    }
    const old = (site: TenantSite) => siteQuery(site, `select consent_id from consent_log where at < now() - interval '1 year' order by consent_id`).then((r) => r.map((x) => x.consent_id))
    // The retention task runs every 3 s in the test build.
    expect(await until('A\'s old record to go', () => old(t.a), (r) => r.length === 1, 20_000)).toEqual(['abbbbbbbbbbbbbbbbbbbbb'])
    expect(await until('B\'s old record to go', () => old(t.b), (r) => r.length === 1, 20_000)).toEqual(['bbbbbbbbbbbbbbbbbbbbbb'])
  }, 45_000)
})

describe('views that wait when the server stops', () => {
  // A server of its own, with a flush timer that never fires during the test: what is
  // written must have been written by the stop itself.
  let slow: Tenants
  beforeAll(async () => { slow = await startTenants('analyticsstop', { CMS_TEST_ANALYTICS_FLUSH_MS: '600000' }) }, 120_000)
  afterAll(async () => { await slow?.stop() })

  it('are not lost when their site\'s row in the directory changes', async () => {
    // A site's row changes now and then (a new host name, a setting, its state while it is
    // moved). What its visitors did in the seconds before must not be thrown away with the
    // site's memory: here A's row gets another alias, and A's waiting view must still be written.
    expect((await siteClient(slow.a, 'admin').put('/api/cms/_singleton/analytics_settings', { collect: true })).status).toBe(200)
    expect((await view(siteClient(slow.a), '/before-the-row-changed')).status).toBe(202)
    await settle()
    expect(await paths(slow.a)).toEqual([]) // waiting in memory
    await slow.writeDirectory(slow.rows.map((r) => (r.id === 'site-a' ? { ...r, hosts: [...r.hosts, 'also.site-a.localhost'] } : r)))
    expect((await siteClient(slow.a).get('/api/content/tag')).status).toBe(200) // the change has been taken up
    await written(slow.a, ['/before-the-row-changed'])
    await slow.writeDirectory(slow.rows)
  })

  it('are written to each site\'s own database before the process ends', async () => {
    for (const site of [slow.a, slow.b]) expect((await siteClient(site, 'admin').put('/api/cms/_singleton/analytics_settings', { collect: true })).status).toBe(200)
    expect((await view(siteClient(slow.a), '/waiting-on-a')).status).toBe(202)
    expect((await view(siteClient(slow.b), '/waiting-on-b')).status).toBe(202)
    expect((await view(siteClient(slow.a), '/waiting-on-a-too')).status).toBe(202)
    await settle()
    const waiting = (list: string[]) => list.filter((p) => p.startsWith('/waiting-')).sort()
    expect(waiting(await paths(slow.a))).toEqual([]) // still waiting in memory
    expect(waiting(await paths(slow.b))).toEqual([])
    await slow.server.stop() // SIGTERM: the server closes in an orderly way
    expect(waiting(await paths(slow.a))).toEqual(['/waiting-on-a', '/waiting-on-a-too'])
    expect(waiting(await paths(slow.b))).toEqual(['/waiting-on-b'])
    expectNoSiteErrors(slow)
  })
})
