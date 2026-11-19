import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, signIn, testDb, truncateAll } from '../helpers/api'

// The consent plugin (tinyzoo/consent) in the playground, and the analytics plugin in its
// `mode: 'consent'`: the texts, the choice and its log, the cookie, what the analytics keep of
// it, a withdrawal, the reports among those who agreed, the counts and "ask everyone again".
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
const choose = (client: Client, choice: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  client.post('/api/content/_consent/choice', { choice, version: 1, ...extra })
const consentCookie = (client: Client) => /(?:^|; )tz_consent=([^;]+)/.exec(client.cookie)?.[1] ?? null
let n = 0
const view = (client: Client, p: string) => client.request('POST', '/api/content/_analytics/e', {
  body: JSON.stringify({ v: `cview${Date.now().toString(36)}${(n++).toString(36)}`, p, w: 1440, l: 'cs' }),
  headers: { 'content-type': 'text/plain', 'user-agent': CHROME },
})
async function until<T>(read: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 4000): Promise<T> {
  const end = Date.now() + timeoutMs
  for (;;) {
    const v = await read()
    if (ok(v) || Date.now() > end) return v
    await new Promise((r) => setTimeout(r, 50))
  }
}
const events = () => db.query('select path, consent_id from analytics_events order by id').then((r) => r.rows)
const log = () => db.query('select * from consent_log order by id').then((r) => r.rows)

describe('the banner\'s texts', () => {
  it('are the standard ones in the page\'s language, until editors write their own, per language', async () => {
    const cs = (await anonymous().get('/api/content/_consent/config?locale=cs')).body
    expect(cs).toMatchObject({ version: 1, cookieDays: 365, locale: 'cs', texts: { title: 'Cookies na tomto webu', acceptAll: 'Přijmout vše', rejectAll: 'Odmítnout vše', privacyUrl: '' } })
    expect(cs.categories.map((c: any) => [c.key, c.required])).toEqual([['necessary', true], ['analytics', false], ['marketing', false]])
    const en = await anonymous().get('/api/content/_consent/config?locale=en-GB')
    expect(en.body).toMatchObject({ locale: 'en', texts: { title: 'Cookies on this website' } })
    expect(en.headers.get('cache-control')).toBe('public, max-age=60')
    expect(en.headers.getSetCookie()).toEqual([])

    expect((await author.put('/api/cms/_singleton/consent_settings', { title: 'x' })).status).toBe(403)
    expect((await editor.put('/api/cms/_singleton/consent_settings', { title: 'Sušenky', privacyUrl: '/ochrana-udaju', analyticsLabel: 'Měření návštěvnosti' })).status).toBe(200)
    expect((await editor.put('/api/cms/_singleton/consent_settings?locale=en', { title: 'Biscuits' })).status).toBe(200)
    const cs2 = (await anonymous().get('/api/content/_consent/config?locale=cs')).body
    expect(cs2.texts).toMatchObject({ title: 'Sušenky', privacyUrl: '/ochrana-udaju', body: cs.texts.body })
    expect(cs2.categories[1].label).toBe('Měření návštěvnosti')
    // English: its own title; what English left empty is the standard English text, not the Czech one.
    const en2 = (await anonymous().get('/api/content/_consent/config?locale=en')).body
    expect(en2.texts).toMatchObject({ title: 'Biscuits', acceptAll: 'Accept all', privacyUrl: '' })
    expect(en2.categories[1].label).toBe('Statistics')
  })
})

describe('a choice', () => {
  it('is logged without address or browser, and kept in a first-party cookie', async () => {
    const visitor = anonymous()
    const res = await choose(visitor, { analytics: true, marketing: false })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ action: 'given', version: 1 })
    expect(res.body.id).toMatch(/^[A-Za-z0-9_-]{22}$/)
    const [set] = res.headers.getSetCookie()
    expect(set).toMatch(new RegExp(`^tz_consent=1\\.${res.body.id}\\.1\\.\\d{4}-\\d{2}-\\d{2}\\.analytics:1\\|marketing:0; Path=/; Max-Age=31536000; SameSite=Lax$`))
    const rows = await log()
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0]).sort()).toEqual(['action', 'at', 'choice', 'consent_id', 'id', 'version'])
    expect(rows[0]).toMatchObject({ consent_id: res.body.id, action: 'given', choice: { analytics: true, marketing: false }, version: 1 })
    expect(JSON.stringify(rows[0])).not.toContain(visitor.ip)
  })

  it('keeps one consent id for one visitor, and says what each later answer was', async () => {
    const visitor = anonymous()
    const first = await choose(visitor, { analytics: true, marketing: true })
    const id = first.body.id
    // The cookie names the visitor's id: later answers join their history.
    expect((await choose(visitor, { analytics: false, marketing: true })).body).toMatchObject({ id, action: 'withdrawn' })
    expect((await choose(visitor, { analytics: true, marketing: false })).body).toMatchObject({ id, action: 'changed' })
    expect((await log()).map((r) => [r.consent_id, r.action])).toEqual([[id, 'given'], [id, 'withdrawn'], [id, 'changed']])
    // Another visitor is another id.
    expect((await choose(anonymous(), { analytics: false, marketing: false })).body.id).not.toBe(id)
  })

  it('refuses what is not a choice, and what comes from another site', async () => {
    const visitor = anonymous()
    expect((await choose(visitor, { tracking: true })).status).toBe(422)
    expect((await choose(visitor, { analytics: 'yes' })).status).toBe(422)
    expect((await choose(visitor, { analytics: true }, { id: 'not-an-id' })).status).toBe(422)
    expect((await visitor.request('POST', '/api/content/_consent/choice', { json: { choice: { analytics: true } }, headers: { origin: 'https://elsewhere.example' } })).status).toBe(403)
    expect((await visitor.request('POST', '/api/content/_consent/choice', { json: { choice: { analytics: true }, pad: 'x'.repeat(4000) } })).status).toBe(413)
    expect(await log()).toEqual([])
    // A version that does not exist yet is the current one.
    expect((await choose(visitor, { analytics: true }, { version: 99 })).body.version).toBe(1)
  })
})

describe('analytics in consent mode', () => {
  it('counts everyone; keeps the consent id only of visitors who allowed statistics', async () => {
    const yes = anonymous()
    const no = anonymous()
    const silent = anonymous()
    const { body } = await choose(yes, { analytics: true, marketing: false })
    await choose(no, { analytics: false, marketing: true })
    expect(consentCookie(yes)).toBeTruthy()
    await view(yes, '/a')
    await view(no, '/b')
    await view(silent, '/c')
    const rows = await until(events, (r) => r.length >= 3)
    expect(rows).toEqual([{ path: '/a', consent_id: body.id }, { path: '/b', consent_id: null }, { path: '/c', consent_id: null }])
  })

  it('forgets the consent id of a visitor who takes statistics back, and keeps the visits', async () => {
    const visitor = anonymous()
    const other = anonymous()
    const { body } = await choose(visitor, { analytics: true, marketing: true })
    const keep = await choose(other, { analytics: true, marketing: true })
    await view(visitor, '/a')
    await view(other, '/b')
    await until(events, (r) => r.length >= 2 && r.every((x: any) => x.consent_id))
    // Taking marketing back changes nothing here.
    await choose(visitor, { analytics: true, marketing: false })
    expect((await events()).find((r: any) => r.path === '/a').consent_id).toBe(body.id)
    await choose(visitor, { analytics: false, marketing: false })
    const rows = await until(events, (r) => r.find((x: any) => x.path === '/a')?.consent_id === null)
    expect(rows).toEqual([{ path: '/a', consent_id: null }, { path: '/b', consent_id: keep.body.id }])
    expect((await log()).filter((r) => r.consent_id === body.id).map((r) => r.action)).toEqual(['given', 'withdrawn', 'withdrawn'])
    // From now on their views are counted without it.
    await view(visitor, '/c')
    expect((await until(events, (r) => r.length >= 3))[2]).toEqual({ path: '/c', consent_id: null })
  })

  it('reports among visitors who agreed: their share, unique visitors over the period, new and returning, how often', async () => {
    // Today: three visits. One by a consenting visitor first seen ten days ago, one by a new
    // consenting visitor (two visits), one by someone who did not agree.
    await db.query(`insert into analytics_events (at, path, visitor, session, consent_id, view, is_entry, source) values
      (now() - interval '10 days', '/', 'h0', 's0', 'old-consent-id-aaaaaaa', 'x0', true, 'Direct'),
      (now() - interval '2 minutes', '/', 'h1', 's1', 'old-consent-id-aaaaaaa', 'x1', true, 'Google'),
      (now() - interval '90 seconds', '/', 'h2', 's2', 'new-consent-id-bbbbbbb', 'x2', true, 'Direct'),
      (now() - interval '60 seconds', '/', 'h2', 's3', 'new-consent-id-bbbbbbb', 'x3', true, 'Direct'),
      (now() - interval '30 seconds', '/', 'h3', 's4', null, 'x4', true, 'Direct')`)
    const { body, status } = await editor.get('/api/cms/_p/analytics/stats?period=today')
    expect(status).toBe(200)
    expect(body.mode).toBe('consent')
    // The headline numbers count the day's hash, as always.
    expect(body.totals).toMatchObject({ visitors: 3, visits: 4 })
    expect(body.consent).toMatchObject({
      visits: 4, consentVisits: 3, share: 0.75, visitors: 2, newVisitors: 1, returningVisitors: 1, visitsPerVisitor: 1.5, partial: false,
      frequency: [{ key: '1', visitors: 1 }, { key: '2', visitors: 1 }, { key: '3-5', visitors: 0 }, { key: '6+', visitors: 0 }],
    })
    // Over 30 days the returning visitor is one visitor, not one a day.
    const month = (await editor.get('/api/cms/_p/analytics/stats?period=30d')).body
    expect(month.totals.visitors).toBe(4)
    expect(month.consent).toMatchObject({ visitors: 2, newVisitors: 2, returningVisitors: 0 })
  })
})

describe('the counts in the admin', () => {
  it('are counts only, for administrators and editors', async () => {
    await choose(anonymous(), { analytics: true, marketing: true })
    await choose(anonymous(), { analytics: false, marketing: false })
    const v = anonymous()
    await choose(v, { analytics: true, marketing: false })
    await choose(v, { analytics: false, marketing: false })
    const { body, status } = await editor.get('/api/cms/_p/consent/stats')
    expect(status).toBe(200)
    expect(body).toMatchObject({ period: '12w', unit: 'week', version: 1, totals: { total: 4, all: 1, none: 2, custom: 1, withdrawn: 1 } })
    expect(body.series).toHaveLength(12)
    expect(body.categories).toEqual([{ key: 'analytics', label: null, granted: 2 }, { key: 'marketing', label: null, granted: 1 }])
    expect(JSON.stringify(body)).not.toMatch(/[A-Za-z0-9_-]{22}/)
    expect((await editor.get('/api/cms/_p/consent/stats?period=12m')).body.series).toHaveLength(12)
    expect((await author.get('/api/cms/_p/consent/stats')).status).toBe(403)
    expect((await anonymous().get('/api/cms/_p/consent/stats')).status).toBe(401)
  })

  it('deletes records older than keepLogDays every night', async () => {
    await db.query(`insert into consent_log (consent_id, at, action, choice, version) values
      ('aaaaaaaaaaaaaaaaaaaaaa', now() - interval '4 years', 'given', '{"analytics":true}', 1),
      ('bbbbbbbbbbbbbbbbbbbbbb', now() - interval '2 years', 'given', '{"analytics":true}', 1)`)
    // The retention task runs every 3 s in the test server.
    const rows = await until(log, (r) => r.length === 1, 15_000)
    expect(rows.map((r) => r.consent_id)).toEqual(['bbbbbbbbbbbbbbbbbbbbbb'])
  })

  it('"ask everyone again" raises the version: earlier choices stop counting', async () => {
    const visitor = anonymous()
    await choose(visitor, { analytics: true, marketing: true })
    expect((await author.post('/api/cms/_p/consent/ask-again', {})).status).toBe(403)
    const res = await editor.post('/api/cms/_p/consent/ask-again', {})
    expect(res.body).toEqual({ version: 2 })
    expect((await anonymous().get('/api/content/_consent/config')).body.version).toBe(2)
    // The visitor's cookie is of version 1: their views no longer carry the consent id.
    await view(visitor, '/after')
    expect((await until(events, (r) => r.length >= 1))[0]).toEqual({ path: '/after', consent_id: null })
    // Answering again under version 2 counts as given anew.
    expect((await choose(visitor, { analytics: true, marketing: true }, { version: 2 })).body).toMatchObject({ action: 'given', version: 2 })
    // Back to version 1 for the files after this one (a save tells the server's cache).
    expect((await admin.put('/api/cms/_singleton/consent_settings', { version: 1 })).status).toBe(200)
  })
})
