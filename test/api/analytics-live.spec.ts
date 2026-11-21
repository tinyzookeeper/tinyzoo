import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AnalyticsLive } from 'tinyzoo/analytics'
import { anonymous, type Client, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'
import { STATUS_TOKEN } from '../setup/server'

// GET /api/content/_analytics/live: today's visits so far, for a tool that watches many sites
// (Keeper), read with the status token like the rollups. Counted from the raw views.
const db = testDb()
let admin: Client
beforeAll(async () => {
  admin = await signIn('admin')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const ROUTE = '/api/content/_analytics/live'
const key = { 'x-api-key': STATUS_TOKEN }

describe('today’s visits', () => {
  it('ask for the status token, as x-api-key or Bearer, and are never cached', async () => {
    expect((await anonymous().get(ROUTE)).status).toBe(401)
    expect((await anonymous().get(ROUTE, { 'x-api-key': 'wrong' })).status).toBe(401)
    // A signed-in admin is not enough: the route is for a machine with the token.
    expect((await admin.get(ROUTE)).status).toBe(401)
    const ok = await anonymous().get(ROUTE, key)
    expect(ok.status).toBe(200)
    expect(ok.headers.get('cache-control')).toBe('no-store')
    expect((await anonymous().get(ROUTE, { authorization: `Bearer ${STATUS_TOKEN}` })).status).toBe(200)
  })

  it('are zeros on a day nobody came, with every hour so far', async () => {
    const { body } = await anonymous().get<AnalyticsLive>(ROUTE, key)
    const { rows: [{ day, hour }] } = await db.query(`select (now() at time zone 'Europe/Prague')::date::text as day, extract(hour from now() at time zone 'Europe/Prague')::int as hour`)
    expect(body).toMatchObject({ format: 'tinyzoo-analytics-live', version: 1, timeZone: 'Europe/Prague', day, hour, active: 0 })
    expect(body.today).toEqual({ day, visitors: 0, visits: 0, pageviews: 0, bounces: 0, engagedMs: 0, pages: [], sources: [], countries: [], devices: [] })
    expect(body.yesterdaySoFar).toEqual({ visitors: 0, visits: 0, pageviews: 0, bounces: 0, engagedMs: 0 })
    expect(body.hours).toHaveLength(hour + 1)
    expect(body.hours.every((h) => h.visitors === 0 && h.pageviews === 0)).toBe(true)
  })

  it('count today so far, who is here now, and yesterday up to the same time', async () => {
    const a = await createAuthor(admin)
    await createPost(admin, { author: a.id, title: 'Jak péct chleba', slug: 'chleba', status: 'published' })
    await db.query(`insert into analytics_events (at, path, visitor, session, consent_id, view, is_entry, source, country, device, engaged_ms) values
      (now(), '/blog/chleba', 'v1', 's1', 'consent-x', 'x1', true, 'Google', 'CZ', 'mobile', 1000),
      (now(), '/', 'v1', 's1', null, 'x2', false, 'Google', 'CZ', 'mobile', 2000),
      (now(), '/blog/chleba', 'v2', 's2', null, 'x3', true, 'Direct', 'SK', 'desktop', 500),
      (now() - interval '1 day' - interval '1 minute', '/', 'y1', 'ys1', null, 'y1', true, 'Direct', 'CZ', 'desktop', 700),
      (now() - interval '1 day' + interval '1 minute', '/', 'y2', 'ys2', null, 'y2', true, 'Direct', 'CZ', 'desktop', 900)`)
    const { body } = await anonymous().get<AnalyticsLive>(ROUTE, key)
    expect(body.active).toBe(2)
    expect(body.today).toMatchObject({ visitors: 2, visits: 2, pageviews: 3, bounces: 1, engagedMs: 3500 })
    expect(body.today.pages[0]).toEqual({ value: '/blog/chleba', title: 'Jak péct chleba', visitors: 2, visits: 2, pageviews: 2 })
    expect(body.today.sources).toEqual([{ value: 'Google', visitors: 1, visits: 1, pageviews: 2 }, { value: 'Direct', visitors: 1, visits: 1, pageviews: 1 }])
    expect(body.today.countries.map((c) => c.value).sort()).toEqual(['CZ', 'SK'])
    expect(body.today.devices.map((c) => c.value).sort()).toEqual(['desktop', 'mobile'])
    // Only the view from before this time of day yesterday.
    expect(body.yesterdaySoFar).toEqual({ visitors: 1, visits: 1, pageviews: 1, bounces: 1, engagedMs: 700 })
    expect(body.hours.at(-1)).toMatchObject({ hour: body.hour, visitors: 2, pageviews: 3 })
    const text = JSON.stringify(body)
    for (const secret of ['"v1"', 's1', 'consent-x', 'x1']) expect(text).not.toContain(secret)
  })
})
