import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildRegistry, emitSchema, planPlugins } from 'tinyzoo'
import { analyticsPlugin } from 'tinyzoo/analytics'
import { filtersQuery, parseFilters } from '../../packages/cms/analytics/core/dimensions'
import { cleanPath, countryCode, countryFromHeaders, deviceOf, excludedPath, languageOf } from '../../packages/cms/analytics/core/enrich'
import { addDays, eachDay, isDay, resolveRange, seriesKeys, splitByCutoff } from '../../packages/cms/analytics/core/range'
import { addTotals, change, emptyTotals, headline, rollupDay, type RollupRow, type RollupView } from '../../packages/cms/analytics/core/rollup'
import { assignSessions, SESSION_GAP_MS, type SessionTail, type ViewDraft } from '../../packages/cms/analytics/core/sessions'
import { cleanUtm, groupOfHost, referrerHost, sourceOf } from '../../packages/cms/analytics/core/source'
import { isRobot, parseUserAgent } from '../../packages/cms/analytics/core/ua'
import { localDay, newSalt, saltFor, visitorHash } from '../../packages/cms/analytics/core/visitor'
import { ANALYTICS_MESSAGES } from '../../packages/cms/analytics/messages'
import { analyticsOptionsOf, analyticsReadAccess, resolveAnalyticsOptions } from '../../packages/cms/analytics/options'

// The analytics plugin (tinyzoo/analytics): the pure parts. The endpoint, the batching and the
// queries run against Postgres in test/api/analytics.spec.ts.

describe('the visitor id', () => {
  const salt = 'a'.repeat(64)
  it('is the same for one browser on one day, and 16 hex characters', () => {
    const a = visitorHash(salt, 'example.cz', '203.0.113.7', 'Mozilla/5.0 Firefox/140.0')
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    expect(visitorHash(salt, 'example.cz', '203.0.113.7', 'Mozilla/5.0 Firefox/140.0')).toBe(a)
  })
  it('changes with the salt, the site, the address and the browser', () => {
    const base = ['example.cz', '203.0.113.7', 'UA'] as const
    const a = visitorHash(salt, ...base)
    expect(visitorHash('b'.repeat(64), ...base)).not.toBe(a)
    expect(visitorHash(salt, 'other.cz', base[1], base[2])).not.toBe(a)
    expect(visitorHash(salt, base[0], '203.0.113.8', base[2])).not.toBe(a)
    expect(visitorHash(salt, base[0], base[1], 'UA2')).not.toBe(a)
  })
  it('never holds the address', () => {
    expect(visitorHash(salt, 'example.cz', '203.0.113.7', 'UA')).not.toContain('203')
  })
})

describe('the daily salt', () => {
  const make = () => 'n'.repeat(64)
  it('is random and long', () => {
    expect(newSalt()).toMatch(/^[0-9a-f]{64}$/)
    expect(newSalt()).not.toBe(newSalt())
  })
  it('is kept for the day it was made', () => {
    const stored = { day: '2026-11-19', salt: 's'.repeat(64) }
    expect(saltFor(stored, '2026-11-19', make)).toEqual({ salt: stored, changed: false })
  })
  it('is replaced on a new day, never reused', () => {
    const r = saltFor({ day: '2026-11-18', salt: 's'.repeat(64) }, '2026-11-19', make)
    expect(r).toEqual({ salt: { day: '2026-11-19', salt: 'n'.repeat(64) }, changed: true })
  })
  it('keeps a later day\'s salt (another server passed midnight first) rather than going back', () => {
    const later = { day: '2026-11-20', salt: 's'.repeat(64) }
    expect(saltFor(later, '2026-11-19', make)).toEqual({ salt: later, changed: false })
  })
  it('makes a new one when nothing (or nonsense) is stored', () => {
    for (const stored of [null, undefined, {}, { day: '2026-11-19', salt: 'short' }, { day: 'yesterday', salt: 's'.repeat(64) }, 'x']) {
      expect(saltFor(stored, '2026-11-19', make).changed).toBe(true)
    }
  })
  it('turns over at midnight in the site\'s time zone, not the server\'s', () => {
    const late = new Date('2026-11-19T23:30:00Z') // 00:30 on the 20th in Prague
    expect(localDay(late, 'Europe/Prague')).toBe('2026-11-20')
    expect(localDay(late, 'UTC')).toBe('2026-11-19')
    expect(localDay(late, 'America/New_York')).toBe('2026-11-19')
  })
})

describe('user agents', () => {
  const cases: [string, string | null, string | null][] = [
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', 'Chrome', 'Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 'Edge', 'Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15', 'Safari', 'macOS'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 15.6; rv:145.0) Gecko/20100101 Firefox/145.0', 'Firefox', 'macOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1', 'Safari', 'iOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.0.0 Mobile/15E148 Safari/604.1', 'Chrome', 'iOS'],
    ['Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36', 'Samsung Internet', 'Android'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36', 'Chrome', 'Android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/125.0.0.0', 'Opera', 'Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 YaBrowser/25.8.0.0 SznProhlizec/14.2.0 Safari/537.36', 'Seznam', 'Windows'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0', 'Firefox', 'Linux'],
    ['Mozilla/5.0 (X11; CrOS x86_64 16181.61.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', 'Chrome', 'ChromeOS'],
    ['Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko', 'Internet Explorer', 'Windows'],
  ]
  it.each(cases)('%s', (ua, browser, os) => {
    expect(parseUserAgent(ua)).toEqual({ browser, os, bot: false })
  })
  it('knows robots, previews and scripts', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/142.0.0.0 Safari/537.36',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
      'curl/8.7.1',
      'python-requests/2.32.3',
      'UptimeRobot/2.0',
      '',
    ]) expect(isRobot(ua), ua).toBe(true)
  })
})

describe('sources', () => {
  const own = ['example.cz']
  const none = { source: null, medium: null, campaign: null }
  it('groups the referring host', () => {
    const cases: [string, string][] = [
      ['https://www.google.com/', 'Google'], ['https://www.google.cz/', 'Google'], ['https://google.co.uk/search?q=x', 'Google'],
      ['android-app://com.google.android.gm/', 'Google'],
      ['https://www.seznam.cz/', 'Seznam'], ['https://search.seznam.cz/?q=pek%C3%A1rna', 'Seznam'], ['https://www.firmy.cz/detail/1', 'Seznam'], ['https://mapy.com/', 'Seznam'],
      ['https://www.bing.com/', 'Bing'], ['https://duckduckgo.com/', 'DuckDuckGo'],
      ['https://l.facebook.com/l.php?u=x', 'Facebook'], ['https://m.facebook.com/', 'Facebook'], ['https://l.instagram.com/', 'Instagram'],
      ['https://www.linkedin.com/feed/', 'LinkedIn'], ['https://lnkd.in/abc', 'LinkedIn'], ['https://t.co/xyz', 'X'], ['https://x.com/someone', 'X'],
      ['https://www.youtube.com/watch?v=1', 'YouTube'], ['https://youtu.be/1', 'YouTube'],
      ['https://blog.someone.cz/clanek', 'Other'], ['https://googlefans.example/', 'Other'], ['https://notseznam.cz/', 'Other'],
    ]
    for (const [ref, group] of cases) expect(sourceOf(ref, own, none).source, ref).toBe(group)
  })
  it('keeps the host without www, and none for a click inside the site', () => {
    expect(sourceOf('https://www.seznam.cz/', own, none)).toEqual({ referrerHost: 'seznam.cz', source: 'Seznam', internal: false })
    expect(sourceOf('https://www.example.cz/blog', own, none)).toEqual({ referrerHost: null, source: 'Direct', internal: true })
  })
  it('is Direct without a referrer, or the group a tagged link names', () => {
    expect(sourceOf('', own, none).source).toBe('Direct')
    expect(sourceOf(null, own, { source: 'facebook', medium: 'social', campaign: 'jaro' }).source).toBe('Facebook')
    expect(sourceOf(null, own, { source: 'newsletter', medium: 'email', campaign: null }).source).toBe('Other')
  })
  it('reads hosts and campaign values carefully', () => {
    expect(referrerHost('not a url')).toBeNull()
    expect(referrerHost('https://WWW.Example.COM/x')).toBe('example.com')
    expect(groupOfHost('news.google.de')).toBe('Google')
    expect(cleanUtm('  Spring_Sale ')).toBe('spring_sale')
    expect(cleanUtm('')).toBeNull()
    expect(cleanUtm(['x'])).toBeNull()
    expect(cleanUtm('x'.repeat(300))).toHaveLength(100)
  })
})

describe('what a view says about itself', () => {
  it('device from the screen width', () => {
    expect([deviceOf(390), deviceOf(599), deviceOf(600), deviceOf(1024), deviceOf(1025), deviceOf(2560)]).toEqual(['mobile', 'mobile', 'tablet', 'tablet', 'desktop', 'desktop'])
    expect([deviceOf(undefined), deviceOf('x'), deviceOf(0), deviceOf(-5), deviceOf(50_000)]).toEqual([null, null, null, null, null])
  })
  it('country from the first CDN header that names one', () => {
    const headers: Record<string, string> = { 'cf-ipcountry': 'XX', 'x-vercel-ip-country': 'cz' }
    expect(countryFromHeaders((n) => headers[n], ['cf-ipcountry', 'x-vercel-ip-country'])).toBe('CZ')
    expect(countryFromHeaders(() => undefined, ['cf-ipcountry'])).toBeNull()
    expect([countryCode('T1'), countryCode('EU'), countryCode('CZE'), countryCode('de')]).toEqual([null, null, null, 'DE'])
  })
  it('the browser\'s language', () => {
    expect([languageOf('cs-CZ'), languageOf('EN'), languageOf('de_AT'), languageOf(''), languageOf('x1')]).toEqual(['cs', 'en', 'de', null, null])
  })
  it('the path, cleaned', () => {
    expect(cleanPath('/blog/post/?utm_source=x#top')).toBe('/blog/post')
    expect(cleanPath('/')).toBe('/')
    expect(cleanPath('/o-n%C3%A1s')).toBe('/o-nás')
    expect(cleanPath('//evil.example/x')).toBeNull()
    expect(cleanPath('https://example.cz/')).toBeNull()
    expect(cleanPath('/a//b')).toBe('/a/b')
    expect(cleanPath(`/${'x'.repeat(600)}`)).toBeNull()
    expect(cleanPath(42)).toBeNull()
  })
  it('never counts the admin, the API or the build\'s files, nor what the site leaves out', () => {
    for (const p of ['/admin', '/admin/post/1', '/api/content/post', '/_nuxt/app.js']) expect(excludedPath(p), p).toBe(true)
    expect(excludedPath('/administrace')).toBe(false)
    expect(excludedPath('/shop/checkout/pay', ['/shop/checkout'])).toBe(true)
    expect(excludedPath('/shop', ['/shop/checkout'])).toBe(false)
  })
})

describe('visits (sessions)', () => {
  const MIN = 60_000
  const view = (visitor: string, at: number, over: Partial<ViewDraft> = {}): ViewDraft => ({
    visitor, at, referrerHost: null, source: 'Direct', internal: false, utmSource: null, utmMedium: null, utmCampaign: null, ...over,
  })
  const ids = () => { let n = 0; return () => `s${++n}` }

  it('joins one visitor\'s views with gaps under 30 minutes, and starts a new visit after', () => {
    const out = assignSessions([view('a', 0), view('a', 10 * MIN), view('a', 39 * MIN), view('a', 39 * MIN + SESSION_GAP_MS)], new Map(), ids())
    expect(out.map((v) => [v.session, v.isEntry])).toEqual([['s1', true], ['s1', false], ['s1', false], ['s2', true]])
  })
  it('keeps visitors apart', () => {
    const out = assignSessions([view('a', 0), view('b', MIN), view('a', 2 * MIN)], new Map(), ids())
    expect(out.map((v) => v.session)).toEqual(['s1', 's2', 's1'])
  })
  it('takes views in time order, whatever order they came in', () => {
    const out = assignSessions([view('a', 5 * MIN), view('a', 0)], new Map(), ids())
    expect(out.map((v) => [v.at, v.isEntry])).toEqual([[5 * MIN, false], [0, true]])
  })
  it('attributes the whole visit to where it started', () => {
    const out = assignSessions([
      view('a', 0, { referrerHost: 'google.com', source: 'Google', utmCampaign: 'jaro' }),
      view('a', MIN, { referrerHost: 'facebook.com', source: 'Facebook' }),
    ], new Map(), ids())
    expect(out.map((v) => [v.source, v.referrerHost, v.utmCampaign])).toEqual([['Google', 'google.com', 'jaro'], ['Google', 'google.com', 'jaro']])
  })
  it('continues a visit from an earlier batch (the database\'s latest view)', () => {
    const tails = new Map<string, SessionTail>([['a', { session: 'old', at: 0, referrerHost: 'seznam.cz', source: 'Seznam', utmSource: null, utmMedium: null, utmCampaign: null }]])
    const [v] = assignSessions([view('a', 20 * MIN, { internal: true })], tails, ids())
    expect(v).toMatchObject({ session: 'old', isEntry: false, source: 'Seznam', referrerHost: 'seznam.cz' })
    expect(tails.get('a')!.at).toBe(20 * MIN)
  })
  it('counts a visit that starts from the site\'s own page (long after) as Direct', () => {
    const [v] = assignSessions([view('a', 0, { internal: true, source: 'Direct' })], new Map(), ids())
    expect(v).toMatchObject({ isEntry: true, source: 'Direct', referrerHost: null })
  })
})

describe('daily totals (rollups)', () => {
  const v = (visitor: string, session: string, path: string, over: Partial<RollupView> = {}): RollupView => ({
    path, entity: null, entryId: null, locale: 'cs', visitor, session, isEntry: false, referrerHost: null, source: 'Direct',
    utmSource: null, utmMedium: null, utmCampaign: null, country: 'CZ', device: 'mobile', browser: 'Chrome', os: 'Android', language: 'cs', engagedMs: 0, ...over,
  })
  // Visitor a: one visit of two views from Google. Visitor b: two visits, each of one view (two bounces).
  const views: RollupView[] = [
    v('a', 'a1', '/', { isEntry: true, source: 'Google', referrerHost: 'google.com', engagedMs: 30_000 }),
    v('a', 'a1', '/blog/x', { source: 'Google', referrerHost: 'google.com', entity: 'post', entryId: 'p1', engagedMs: 90_000 }),
    v('b', 'b1', '/blog/x', { isEntry: true, entity: 'post', entryId: 'p1', device: 'desktop', engagedMs: 10_000 }),
    v('b', 'b2', '/', { isEntry: true, device: 'desktop', engagedMs: 99 * 60_000 }),
  ]
  const rows = rollupDay(views)
  const row = (dimension: string, value: string) => rows.find((r) => r.dimension === dimension && r.value === value)

  it('the day\'s totals', () => {
    // b's last view looked at the page longer than counts: 30 minutes at most.
    expect(row('total', '')).toEqual({ dimension: 'total', value: '', visitors: 2, visits: 3, pageviews: 4, bounces: 2, engagedMs: 30_000 + 90_000 + 10_000 + 30 * 60_000 })
  })
  it('per page, per entry and per entry page', () => {
    expect(row('page', '/blog/x')).toMatchObject({ visitors: 2, visits: 2, pageviews: 2, bounces: 1 })
    expect(row('entry', 'post:p1')).toMatchObject({ visitors: 2, visits: 2, pageviews: 2 })
    expect(row('entry_page', '/')).toMatchObject({ visitors: 2, visits: 2, pageviews: 2, bounces: 1 })
    expect(row('entry_page', '/blog/x')).toMatchObject({ visitors: 1, visits: 1, pageviews: 1, bounces: 1 })
  })
  it('per source and device; nothing for a value that is not there', () => {
    expect(row('source', 'Google')).toMatchObject({ visitors: 1, visits: 1, pageviews: 2, bounces: 0 })
    expect(row('source', 'Direct')).toMatchObject({ visitors: 1, visits: 2, pageviews: 2, bounces: 2 })
    expect(row('device', 'desktop')).toMatchObject({ visitors: 1, visits: 2, pageviews: 2 })
    expect(rows.some((r) => r.dimension === 'referrer' && r.value === '')).toBe(false)
    expect(rows.some((r) => r.dimension === 'utm_campaign')).toBe(false)
  })
  it('adds up per dimension to the day\'s pageviews', () => {
    for (const dim of ['source', 'device', 'country', 'browser', 'os', 'page']) {
      const sum = rows.filter((r) => r.dimension === dim).reduce((n, r) => n + r.pageviews, 0)
      expect(sum, dim).toBe(4)
    }
  })
  it('is the same for the same views (running a day again replaces it with equal rows)', () => {
    expect(rollupDay([...views].reverse())).toEqual(rows)
    expect(rollupDay([])).toEqual([])
  })
  it('headline figures, and the change against the period before', () => {
    const t: RollupRow = row('total', '')!
    const h = headline(addTotals(emptyTotals(), t))
    expect(h.viewsPerVisit).toBeCloseTo(4 / 3)
    expect(h.bounceRate).toBeCloseTo(2 / 3)
    expect(h.avgEngagedMs).toBe(Math.round(t.engagedMs / 3))
    expect(headline(emptyTotals())).toMatchObject({ viewsPerVisit: 0, bounceRate: 0, avgEngagedMs: 0 })
    expect([change(150, 100), change(50, 100), change(0, 0), change(5, 0)]).toEqual([0.5, -0.5, 0, null])
  })
})

describe('periods', () => {
  const today = '2026-11-19'
  it('the presets, and what each is compared with', () => {
    expect(resolveRange('today', today)).toMatchObject({ from: today, to: today, bucket: 'hour', days: 1, previous: { from: '2026-11-18', to: '2026-11-18' } })
    expect(resolveRange('yesterday', today)).toMatchObject({ from: '2026-11-18', to: '2026-11-18', bucket: 'hour', previous: { from: '2026-11-17', to: '2026-11-17' } })
    expect(resolveRange('7d', today)).toMatchObject({ from: '2026-11-13', to: today, bucket: 'day', days: 7, previous: { from: '2026-11-06', to: '2026-11-12' } })
    expect(resolveRange('30d', today)).toMatchObject({ from: '2026-10-21', to: today, days: 30, previous: { from: '2026-09-21', to: '2026-10-20' } })
    expect(resolveRange('month', today)).toMatchObject({ from: '2026-11-01', to: today, previous: { from: '2026-10-01', to: '2026-10-19' } })
    expect(resolveRange('lastmonth', today)).toMatchObject({ from: '2026-10-01', to: '2026-10-31', days: 31, previous: { from: '2026-09-01', to: '2026-09-30' } })
    expect(resolveRange('12m', today)).toMatchObject({ from: '2025-11-20', to: today, days: 365, previous: { from: '2024-11-20', to: '2025-11-19' } })
  })
  it('this month on the 31st is compared with the whole shorter month before', () => {
    expect(resolveRange('month', '2026-03-31').previous).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(resolveRange('lastmonth', '2026-03-05')).toMatchObject({ from: '2026-02-01', to: '2026-02-28' })
  })
  it('a custom range: swapped, cut at today, at most two years; nonsense is the last 30 days', () => {
    expect(resolveRange('custom', today, { from: '2026-11-10', to: '2026-11-01' })).toMatchObject({ from: '2026-11-01', to: '2026-11-10', previous: { from: '2026-10-22', to: '2026-10-31' } })
    expect(resolveRange('custom', today, { from: '2026-11-10', to: '2027-01-01' })).toMatchObject({ from: '2026-11-10', to: today })
    expect(resolveRange('custom', today, { from: '2000-01-01', to: today }).days).toBe(731)
    expect(resolveRange('custom', today, { from: '2026-02-30', to: today })).toMatchObject({ period: '30d', from: '2026-10-21' })
    expect(resolveRange('custom', today, { from: '2026-11-19', to: '2026-11-19' }).bucket).toBe('hour')
  })
  it('day arithmetic', () => {
    expect([isDay('2028-02-29'), isDay('2026-02-29'), isDay('2026-1-1')]).toEqual([true, false, false])
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })
  it('splits a range into days with totals only and days with raw views', () => {
    const r = { from: '2026-01-01', to: '2026-11-19' }
    expect(splitByCutoff(r, '2026-08-21')).toEqual({ rolled: { from: '2026-01-01', to: '2026-08-20' }, raw: { from: '2026-08-21', to: '2026-11-19' } })
    expect(splitByCutoff({ from: '2026-11-01', to: '2026-11-19' }, '2026-08-21')).toEqual({ rolled: null, raw: { from: '2026-11-01', to: '2026-11-19' } })
    expect(splitByCutoff({ from: '2026-01-01', to: '2026-01-31' }, '2026-08-21')).toEqual({ rolled: { from: '2026-01-01', to: '2026-01-31' }, raw: null })
  })
  it('the chart\'s points', () => {
    expect(seriesKeys({ from: '2026-11-19', to: '2026-11-19', bucket: 'hour' })).toHaveLength(24)
    expect(seriesKeys({ from: '2026-11-19', to: '2026-11-19', bucket: 'hour' }, 9)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(seriesKeys({ from: '2026-11-13', to: '2026-11-19', bucket: 'day' })).toHaveLength(7)
  })
})

describe('filters in the address', () => {
  it('known dimensions, one value each', () => {
    expect(parseFilters({ 'f.source': 'Google', 'f.page': ['/a', '/b'], 'f.nope': 'x', period: '7d', 'f.country': '' })).toEqual([
      { dimension: 'source', value: 'Google' }, { dimension: 'page', value: '/a' },
    ])
    expect(filtersQuery([{ dimension: 'device', value: 'mobile' }])).toEqual({ 'f.device': 'mobile' })
  })
})

describe('the plugin', () => {
  it('is a valid plugin whose files are all there', () => {
    const plugin = analyticsPlugin()
    const plan = planPlugins([plugin], { exists: existsSync })
    expect(plan.handlers.map((h) => `${h.method} ${h.route}`)).toEqual([
      'post /api/content/_analytics/e', 'get /api/content/_analytics/rollups',
      'get /api/cms/_p/analytics/stats', 'get /api/cms/_p/analytics/live', 'get /api/cms/_p/analytics/summary', 'get /api/cms/_p/analytics/entry',
    ])
    expect(plan.appPlugins).toEqual([expect.objectContaining({ mode: 'client', plugin: 'analytics' })])
    expect(plan.dashboardWidgets.map((w) => w.component)).toEqual(['AnalyticsHomeCard'])
    expect(plan.entityPanels.map((p) => p.component)).toEqual(['AnalyticsEntryPanel'])
    for (const c of ['AnalyticsHomeCard', 'AnalyticsEntryPanel']) expect(existsSync(`${plugin.components}/${c}.vue`), c).toBe(true)
  })
  it('writes its tables into schema.ts, and their source matches the tables', () => {
    const reg = buildRegistry({ plugins: [analyticsPlugin()] })
    expect([...reg.pluginTables.keys()]).toEqual(['analytics_events', 'analytics_daily'])
    const schema = emitSchema(reg)
    expect(schema).toContain("export const analyticsEvents = pgTable('analytics_events'")
    expect(schema).toContain("export const analyticsDaily = pgTable('analytics_daily'")
    expect(reg.byName.get('analytics_settings')?.singleton).toBe(true)
  })
  it('keeps its options for the server', () => {
    const reg = buildRegistry({ plugins: [analyticsPlugin({ keepRawDays: 30, respectDoNotTrack: true })] })
    expect(analyticsOptionsOf(reg)).toMatchObject({ keepRawDays: 30, respectDoNotTrack: true, countryHeaders: ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country'] })
    expect(analyticsOptionsOf(buildRegistry({}))).toBeNull()
  })
  it('refuses options that make no sense', () => {
    expect(() => resolveAnalyticsOptions({ keepRawDays: 1 })).toThrow(/keepRawDays must be a whole number of days from 2/)
    expect(() => resolveAnalyticsOptions({ keepRawDays: 7.5 })).toThrow(/keepRawDays/)
    expect(() => resolveAnalyticsOptions({ timeZone: 'Mars/Olympus' })).toThrow(/is not a time zone/)
    expect(() => resolveAnalyticsOptions({ excludePaths: ['shop'] })).toThrow(/start with "\/"/)
  })
  it('lets administrators and editors read the reports by default, not authors', () => {
    const u = (role: string, base: string | null = role) => ({ user: { id: '1', email: '', name: '', role, base, locale: null } as any })
    expect([analyticsReadAccess(u('admin')), analyticsReadAccess(u('editor')), analyticsReadAccess(u('author')), analyticsReadAccess(u('shopManager', 'editor'))]).toEqual([true, true, false, true])
  })
  it('has every text in Czech and German too', () => {
    // A plural ({ one, few, other }) is one text: each language has the forms it needs.
    const keys = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' || 'other' in (v as any) ? [`${p}${k}`] : keys(v, `${p}${k}.`)))
    const en = keys(ANALYTICS_MESSAGES.en).sort()
    expect(keys(ANALYTICS_MESSAGES.cs).sort()).toEqual(en)
    expect(keys(ANALYTICS_MESSAGES.de).sort()).toEqual(en)
  })
})

describe('the admin\'s styles', () => {
  // A site's Tailwind scans tinyzoo's app/ only (`@source "…/tinyzoo/app"`), so a utility class the
  // plugin's components use and the admin does not would never be generated: layout of its own goes
  // into the component's scoped CSS.
  it('uses only utility classes the admin itself uses', () => {
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]))
    const cms = join(import.meta.dirname, '../../packages/cms')
    const app = files(join(cms, 'app')).filter((f) => /\.(vue|ts)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n')
    const missing: string[] = []
    for (const f of files(join(cms, 'analytics')).filter((x) => x.endsWith('.vue'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/ class="([^"]+)"/g)) {
        for (const c of m[1]!.split(/\s+/).filter(Boolean)) {
          if (c.startsWith('an-') || c.startsWith('cms-')) continue // their own CSS, not utilities
          const re = new RegExp(`(?<![\\w:-])${c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?![\\w-])`)
          if (!re.test(app)) missing.push(`${f.split('/analytics/')[1]}: ${c}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
