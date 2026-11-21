import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { CmsStatus } from 'tinyzoo'
import type { AnalyticsRollups } from 'tinyzoo/analytics'
import { anonymous, type Client, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'
import { STATUS_TOKEN } from '../setup/server'

// GET /api/content/_analytics/rollups: the daily totals of the analytics plugin for a tool that
// watches many sites (Keeper), read with the status token. The totals are written straight into
// analytics_daily here, as the nightly job would (it does nothing while no raw views wait).
const db = testDb()
let admin: Client
beforeAll(async () => {
  admin = await signIn('admin')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const ROUTE = '/api/content/_analytics/rollups'
const key = { 'x-api-key': STATUS_TOKEN }

async function localDay(daysAgo: number): Promise<string> {
  const { rows } = await db.query(`select ((now() - make_interval(days => $1)) at time zone 'Europe/Prague')::date::text as day`, [daysAgo])
  return rows[0].day
}
async function total(day: string, dimension: string, value: string, visitors: number) {
  await db.query(`insert into analytics_daily (day, dimension, value, visitors, visits, pageviews, bounces, engaged_ms) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [day, dimension, value, visitors, visitors + 1, visitors * 2, 1, visitors * 1000])
}

describe('who may read the totals', () => {
  it('asks for the status token, as x-api-key or Bearer, and is never cached', async () => {
    const day = await localDay(5)
    const q = `${ROUTE}?from=${day}&to=${day}`
    expect((await anonymous().get(q)).status).toBe(401)
    expect((await anonymous().get(q, { 'x-api-key': 'wrong' })).status).toBe(401)
    // A signed-in admin is not enough: the route is for a machine with the token.
    expect((await admin.get(q)).status).toBe(401)
    const ok = await anonymous().get(q, key)
    expect(ok.status).toBe(200)
    expect(ok.headers.get('cache-control')).toBe('no-store')
    expect((await anonymous().get(q, { authorization: `Bearer ${STATUS_TOKEN}` })).status).toBe(200)
  })

  it('takes a range of real days, at most 400', async () => {
    const c = anonymous()
    expect((await c.get(ROUTE, key)).status).toBe(400)
    expect((await c.get(`${ROUTE}?from=2026-01-01`, key)).status).toBe(400)
    expect((await c.get(`${ROUTE}?from=2026-02-30&to=2026-03-01`, key)).status).toBe(400)
    expect((await c.get(`${ROUTE}?from=2026-03-01&to=2026-02-01`, key)).status).toBe(400)
    expect((await c.get(`${ROUTE}?from=2025-01-01&to=2026-02-05`, key)).status).toBe(400)
    expect((await c.get(`${ROUTE}?from=2025-01-01&to=2026-02-04`, key)).status).toBe(200)
  })
})

describe('the answer', () => {
  it('has every day from the first totals to yesterday, the totals and the four top lists', async () => {
    const a = await createAuthor(admin)
    await createPost(admin, { author: a.id, title: 'Jak péct chleba', slug: 'chleba', status: 'published' })
    const [d10, d9, yesterday] = [await localDay(10), await localDay(9), await localDay(1)]
    await total(d10, 'total', '', 40)
    for (let i = 0; i < 12; i++) await total(d10, 'page', `/p${i}`, i + 1)
    await total(d10, 'page', '/blog/chleba', 30)
    await total(d10, 'source', 'Google', 25)
    await total(d10, 'country', 'CZ', 38)
    await total(d10, 'device', 'mobile', 22)
    await total(d10, 'browser', 'Chrome', 40)
    await total(d10, 'utm_campaign', 'jaro', 3)
    await total(d9, 'total', '', 2)

    const res = await anonymous().get<AnalyticsRollups>(`${ROUTE}?from=${await localDay(30)}&to=${await localDay(0)}`, key)
    expect(res.status).toBe(200)
    const body = res.body
    expect(body).toMatchObject({ format: 'tinyzoo-analytics-rollups', version: 1, timeZone: 'Europe/Prague', since: d10, through: yesterday })
    expect(body.days).toHaveLength(10) // d10 … yesterday; today has no totals yet
    const [first, second, third] = body.days
    expect(first).toMatchObject({ day: d10, visitors: 40, visits: 41, pageviews: 80, bounces: 1, engagedMs: 40_000 })
    expect(first!.pages).toHaveLength(10)
    expect(first!.pages[0]).toEqual({ value: '/blog/chleba', title: 'Jak péct chleba', visitors: 30, visits: 31, pageviews: 60 })
    expect(first!.pages.map((p) => p.value).slice(1, 3)).toEqual(['/p11', '/p10'])
    expect(first!.sources).toEqual([{ value: 'Google', visitors: 25, visits: 26, pageviews: 50 }])
    expect(first!.countries.map((c) => c.value)).toEqual(['CZ'])
    expect(first!.devices.map((c) => c.value)).toEqual(['mobile'])
    expect(Object.keys(first!).sort()).toEqual(['bounces', 'countries', 'day', 'devices', 'engagedMs', 'pages', 'pageviews', 'sources', 'visitors', 'visits'])
    expect(second).toMatchObject({ day: d9, visitors: 2, pages: [] })
    expect(third).toMatchObject({ visitors: 0, visits: 0, pageviews: 0, pages: [], sources: [] })
    expect(body.days.at(-1)!.day).toBe(yesterday)
  })

  it('is empty before the first night, and says so in the status', async () => {
    const day = await localDay(3)
    const res = await anonymous().get<AnalyticsRollups>(`${ROUTE}?from=${day}&to=${day}`, key)
    expect(res.body).toMatchObject({ since: null, through: null, days: [] })
    const status = (await anonymous().get<CmsStatus>('/api/health/status', key)).body
    expect(status.analytics).toEqual({ enabled: true, collecting: true, since: null, rollupsPath: '/api/content/_analytics/rollups', livePath: '/api/content/_analytics/live' })
    await total(day, 'total', '', 4)
    expect((await anonymous().get<CmsStatus>('/api/health/status', key)).body.analytics?.since).toBe(day)
  })

  it('carries no visitor ids, raw views or consent ids', async () => {
    const day = await localDay(2)
    await db.query(`insert into analytics_events (at, path, visitor, session, consent_id, view, is_entry, source) values (now() - interval '2 days', '/', 'visitor-hash-x', 'session-x', 'consent-x', 'view-x', true, 'Direct')`)
    await total(day, 'total', '', 1)
    const text = JSON.stringify((await anonymous().get(`${ROUTE}?from=${day}&to=${day}`, key)).body)
    for (const secret of ['visitor-hash-x', 'session-x', 'consent-x', 'view-x']) expect(text).not.toContain(secret)
  })
})
