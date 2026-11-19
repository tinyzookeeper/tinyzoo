import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

// The analytics plugin (tinyzoo/analytics) in the playground: the tracker's endpoint, the
// batching, visits, what is not counted, the reports, the switch and the nightly totals.
// Views wait CMS_TEST_ANALYTICS_FLUSH_MS (100 ms in tests) before they are written.
const db = testDb()
let admin: Client
let editor: Client
let author: Client
beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
  author = await signIn('author')
})
beforeEach(async () => {
  await truncateAll(db)
  await admin.put('/api/cms/_singleton/analytics_settings', { collect: true })
})
afterAll(() => db.end())

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1'
let n = 0
const viewId = () => `view${Date.now().toString(36)}${(n++).toString(36)}`

/** What the tracker sends, from a browser of `client`'s address. */
function beacon(client: Client, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return client.request('POST', '/api/content/_analytics/e', { body: JSON.stringify(body), headers: { 'content-type': 'text/plain', 'user-agent': CHROME, ...headers } })
}
const view = (client: Client, p: string, over: Record<string, unknown> = {}, headers: Record<string, string> = {}) => {
  const v = viewId()
  return beacon(client, { v, p, w: 1440, l: 'cs-CZ', lc: 'cs', ...over }, headers).then((res) => ({ res, v }))
}

async function rows(min = 1, timeoutMs = 4000): Promise<any[]> {
  const until = Date.now() + timeoutMs
  for (;;) {
    const { rows } = await db.query('select * from analytics_events order by id')
    if (rows.length >= min || Date.now() > until) return rows
    await new Promise((r) => setTimeout(r, 50))
  }
}
const settle = () => new Promise((r) => setTimeout(r, 400))

describe('collecting', () => {
  it('answers 202 at once and writes the view a moment later, with what it says about itself', async () => {
    const visitor = anonymous()
    const { res } = await view(visitor, '/o-nas?utm_source=x', { r: 'https://www.seznam.cz/', u: { s: 'Seznam', m: 'cpc', c: 'Jaro' } }, { 'cf-ipcountry': 'CZ' })
    expect(res.status).toBe(202)
    const [row] = await rows()
    expect(row).toMatchObject({
      path: '/o-nas', source: 'Seznam', referrer_host: 'seznam.cz', utm_source: 'seznam', utm_medium: 'cpc', utm_campaign: 'jaro',
      country: 'CZ', device: 'desktop', browser: 'Chrome', os: 'Windows', language: 'cs', locale: 'cs', is_entry: true, engaged_ms: 0, consent_id: null,
    })
    expect(row.visitor).toMatch(/^[0-9a-f]{16}$/)
    // The address is nowhere: not in a column, not in the hash's input that is kept.
    expect(JSON.stringify(row)).not.toContain(visitor.ip)
    const { rows: salt } = await db.query(`select value from cms_state where key = 'analytics:salt'`)
    expect(salt[0].value.salt).toMatch(/^[0-9a-f]{64}$/)
  })

  it('makes one visit of one browser\'s views, attributed to where it started, and adds the time a page was looked at', async () => {
    const visitor = anonymous()
    const first = await view(visitor, '/', { r: 'https://www.google.cz/' })
    await settle()
    await view(visitor, '/blog/a', { r: '' })
    await beacon(visitor, { v: first.v, e: 42_000 })
    await beacon(visitor, { v: first.v, e: 99 * 60_000 }) // more than a view can add: 30 minutes at most
    const all = await rows(2)
    await settle()
    const { rows: after } = await db.query('select path, session, is_entry, source, engaged_ms from analytics_events order by id')
    expect(all).toHaveLength(2)
    expect(after[0]).toMatchObject({ path: '/', is_entry: true, source: 'Google', engaged_ms: 30 * 60_000 })
    expect(after[1]).toMatchObject({ path: '/blog/a', is_entry: false, source: 'Google' })
    expect(after[1].session).toBe(after[0].session)
    // Another browser on another address is another visitor.
    await view(anonymous(), '/')
    const three = await rows(3)
    expect(new Set(three.map((r) => r.visitor)).size).toBe(2)
  })

  it('counts no robot, no editor, no preview, no admin page and nothing from another site', async () => {
    const visitor = anonymous()
    await view(visitor, '/', {}, { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' })
    await view(visitor, '/', {}, { 'user-agent': 'curl/8.7.1' })
    await view(admin, '/')
    await view(visitor, '/', {}, { referer: 'http://localhost/blog/a?preview=1' })
    await view(visitor, '/admin/post')
    await view(visitor, '/api/content/post')
    await view(visitor, '/', {}, { origin: 'https://elsewhere.example' })
    await beacon(visitor, { p: '/', w: 1 }) // no view id
    await beacon(visitor, { v: viewId(), p: 'https://example.cz/' })
    const res = await visitor.request('POST', '/api/content/_analytics/e', { body: 'not json', headers: { 'user-agent': CHROME } })
    expect(res.status).toBe(202)
    await settle()
    expect(await rows(1, 300)).toEqual([])
  })

  it('stops while an administrator has switched it off, and keeps what it had', async () => {
    await view(anonymous(), '/')
    await rows(1)
    expect((await editor.put('/api/cms/_singleton/analytics_settings', { collect: false })).status).toBe(403)
    expect((await admin.put('/api/cms/_singleton/analytics_settings', { collect: false })).status).toBe(200)
    await view(anonymous(), '/kontakt')
    await settle()
    expect((await rows(2, 300)).map((r) => r.path)).toEqual(['/'])
    const stats = await admin.get('/api/cms/_p/analytics/stats?period=today')
    expect(stats.body.collecting).toMatchObject({ on: false, settings: false, server: true, canSwitch: true })
    expect(stats.body.totals.pageviews).toBe(1)
  })
})

describe('the reports', () => {
  it('headline numbers, the chart and the lists; entries by their title', async () => {
    const a = await createAuthor(admin)
    const post = await createPost(admin, { author: a.id, title: 'Jak péct chleba', slug: 'chleba', status: 'published' })
    const one = anonymous()
    await view(one, '/blog/chleba', { r: 'https://www.google.com/' })
    await view(one, '/kontakt')
    await view(anonymous(), '/blog/chleba', { w: 390 }, { 'user-agent': IPHONE, 'cf-ipcountry': 'SK' })
    await rows(3)
    await settle()
    const { body, status } = await editor.get('/api/cms/_p/analytics/stats?period=today&compare=1')
    expect(status).toBe(200)
    expect(body.range).toMatchObject({ period: 'today', bucket: 'hour', days: 1 })
    expect(body.totals).toMatchObject({ visitors: 2, visits: 2, pageviews: 3, bounces: 1, bounceRate: 0.5, viewsPerVisit: 1.5 })
    expect(body.previousTotals).toMatchObject({ visitors: 0, pageviews: 0 })
    expect(body.series.reduce((s: number, p: any) => s + p.pageviews, 0)).toBe(3)
    const page = body.lists.page.find((i: any) => i.value === '/blog/chleba')
    expect(page).toMatchObject({ visitors: 2, pageviews: 2, entity: 'post', id: post.id, title: 'Jak péct chleba' })
    expect(body.lists.source.map((i: any) => i.value).sort()).toEqual(['Direct', 'Google'])
    expect(body.lists.device.map((i: any) => i.value).sort()).toEqual(['desktop', 'mobile'])
    expect(body.lists.country.map((i: any) => i.value)).toEqual(['SK'])

    // A filter applies to every number.
    const google = (await editor.get('/api/cms/_p/analytics/stats?period=today&f.source=Google')).body
    expect(google.totals).toMatchObject({ visitors: 1, visits: 1, pageviews: 2, bounces: 0 })
    expect(google.lists.page.map((i: any) => i.value).sort()).toEqual(['/blog/chleba', '/kontakt'])

    // The editor's panel and the home card.
    const panel = (await editor.get(`/api/cms/_p/analytics/entry?entity=post&id=${post.id}`)).body
    expect(panel).toMatchObject({ tracked: true, pageviews: 2, visitors: 2 })
    expect(panel.sources.map((s: any) => s.value).sort()).toEqual(['Direct', 'Google'])
    expect((await editor.get('/api/cms/_p/analytics/entry?entity=contactForm&id=00000000-0000-4000-8000-000000000000')).body).toEqual({ tracked: false })
    const home = (await admin.get('/api/cms/_p/analytics/summary')).body
    expect(home).toMatchObject({ visitors: 2, previousVisitors: 0 })
    expect(home.pages[0]).toMatchObject({ path: '/blog/chleba', title: 'Jak péct chleba' })
    expect((await admin.get('/api/cms/_p/analytics/live')).body.active).toBe(2)
  })

  it('are for administrators and editors, not authors or visitors', async () => {
    expect((await author.get('/api/cms/_p/analytics/stats')).status).toBe(403)
    expect((await author.get('/api/cms/_p/analytics/summary')).status).toBe(403)
    expect((await anonymous().get('/api/cms/_p/analytics/stats')).status).toBe(401)
  })

  it('reads days past keepRawDays from the nightly totals, which replace their raw views', async () => {
    // Two visitors 100 days ago (the playground keeps 90 days of raw views): one visit of two views, one bounce.
    const { rows: [{ day }] } = await db.query(`select ((now() - interval '100 days') at time zone 'Europe/Prague')::date::text as day`)
    await db.query(`insert into analytics_events (at, path, visitor, session, view, is_entry, source, device, engaged_ms) values
      (now() - interval '100 days', '/', 'v1', 's1', 'x1', true, 'Google', 'mobile', 1000),
      (now() - interval '100 days' + interval '1 minute', '/blog/a', 'v1', 's1', 'x2', false, 'Google', 'mobile', 2000),
      (now() - interval '100 days', '/', 'v2', 's2', 'x3', true, 'Direct', 'desktop', 500)`)
    // The retention task runs every 3 s in the test server: totals first, then the old views go.
    const until = Date.now() + 15_000
    for (;;) {
      const { rows: left } = await db.query('select count(*)::int as n from analytics_events')
      if (left[0].n === 0 || Date.now() > until) break
      await new Promise((r) => setTimeout(r, 200))
    }
    const { rows: totals } = await db.query(`select dimension, value, visitors, visits, pageviews, bounces, engaged_ms::int from analytics_daily where day = $1 and dimension in ('total', 'source') order by dimension, value`, [day])
    expect(totals).toEqual([
      { dimension: 'source', value: 'Direct', visitors: 1, visits: 1, pageviews: 1, bounces: 1, engaged_ms: 500 },
      { dimension: 'source', value: 'Google', visitors: 1, visits: 1, pageviews: 2, bounces: 0, engaged_ms: 3000 },
      { dimension: 'total', value: '', visitors: 2, visits: 2, pageviews: 3, bounces: 1, engaged_ms: 3500 },
    ])
    const { body } = await admin.get(`/api/cms/_p/analytics/stats?period=custom&from=${day}&to=${day}`)
    expect(body.totals).toMatchObject({ visitors: 2, visits: 2, pageviews: 3, bounces: 1 })
    expect(body.lists.source.map((i: any) => [i.value, i.pageviews])).toEqual([['Google', 2], ['Direct', 1]])
    // A filter cannot reach days that only have totals: said so, not guessed.
    const filtered = (await admin.get(`/api/cms/_p/analytics/stats?period=custom&from=${day}&to=${day}&f.source=Google`)).body
    expect(filtered.partial).toBe(true)
    expect(filtered.totals.pageviews).toBe(0)
  })
})
