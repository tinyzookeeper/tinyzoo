import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRegistry, collectPlugins, emitSchema, planPlugins } from 'tinyzoo'
import { analyticsPlugin } from 'tinyzoo/analytics'
import { consentPlugin } from 'tinyzoo/consent'
import { consentDecision } from '../../packages/cms/analytics/core/consent'
import { analyticsOptionsOf } from '../../packages/cms/analytics/options'
import { startTracker, type TrackerGate } from '../../packages/cms/analytics/app/tracker'
import {
  actionOf, consentCookieString, decodeConsent, encodeConsent, grantedIn, isCurrent, MAX_COOKIE_DAYS, newConsentId,
  normalizeChoice, outcomeOf, readConsentCookie, withdrawnFrom, type ConsentCookie,
} from '../../packages/cms/consent/core/cookie'
import { DEFAULT_TEXTS, daysText, defaultsLanguage, resolveTexts } from '../../packages/cms/consent/core/texts'
import { createConsentRuntime, initialConsentState, type ConsentConfig, type ConsentEnv } from '../../packages/cms/consent/app/runtime'
import { CONSENT_MESSAGES } from '../../packages/cms/consent/messages'
import { consentOptionsOf, consentReadAccess, resolveConsentOptions } from '../../packages/cms/consent/options'

// The consent plugin (tinyzoo/consent) and the analytics plugin's modes with a cookie banner:
// the pure parts. The endpoints and the database run in test/api/consent.spec.ts.

const ID = 'q8Kf2mZ0Ls9xWc4RbT7nYe'

describe('the consent cookie', () => {
  const c: ConsentCookie = { id: ID, version: 3, date: '2026-11-19', choice: { marketing: false, analytics: true } }
  it('is one plain value: format, id, version, date and each category, sorted', () => {
    expect(encodeConsent(c)).toBe(`1.${ID}.3.2026-11-19.analytics:1|marketing:0`)
    // Only characters a cookie value may hold, without encoding.
    expect(encodeConsent(c)).toMatch(/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/)
  })
  it('reads back what it wrote, also URL-encoded on the way', () => {
    expect(decodeConsent(encodeConsent(c))).toEqual(c)
    expect(decodeConsent(encodeURIComponent(encodeConsent(c)))).toEqual(c)
    expect(decodeConsent(`1.${ID}.1.2026-01-02.`)).toEqual({ id: ID, version: 1, date: '2026-01-02', choice: {} })
  })
  it('never stores necessary: it is always on', () => {
    expect(encodeConsent({ ...c, choice: { necessary: false, analytics: true } })).toBe(`1.${ID}.3.2026-11-19.analytics:1`)
    expect(decodeConsent(`1.${ID}.3.2026-11-19.necessary:0`)).toBeNull()
  })
  it('reads nothing it does not know', () => {
    for (const raw of [
      null, undefined, '', 'yes', `2.${ID}.3.2026-11-19.analytics:1`, `1.short.3.2026-11-19.analytics:1`, `1.${ID}.0.2026-11-19.analytics:1`,
      `1.${ID}.x.2026-11-19.analytics:1`, `1.${ID}.3.19-11-2026.analytics:1`, `1.${ID}.3.2026-11-19.analytics:2`, `1.${ID}.3.2026-11-19.Analytics:1`,
      `1.${ID}.3.2026-11-19.analytics:1.extra`, '%E0%A4%A', 'x'.repeat(2000),
    ]) expect(decodeConsent(raw as any), String(raw)).toBeNull()
  })
  it('is found in a Cookie header among others', () => {
    expect(readConsentCookie(`a=1; tz_consent=${encodeConsent(c)}; b=2`)).toBe(encodeConsent(c))
    expect(readConsentCookie('a=1; tz_consent_old=x')).toBeNull()
    expect(readConsentCookie(undefined)).toBeNull()
  })
  it('is set for the whole site, Lax, Secure in production, for at most 13 months', () => {
    expect(consentCookieString('v', { days: 365, secure: true })).toBe('tz_consent=v; Path=/; Max-Age=31536000; SameSite=Lax; Secure')
    expect(consentCookieString('v', { days: 30, secure: false })).toBe('tz_consent=v; Path=/; Max-Age=2592000; SameSite=Lax')
    expect(MAX_COOKIE_DAYS).toBe(395)
  })
  it('has a random id of 16 bytes', () => {
    const a = newConsentId()
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(newConsentId()).not.toBe(a)
    expect(newConsentId((b) => b.fill(255))).toBe('_____________________w')
  })
})

describe('whether a choice still holds', () => {
  const now = new Date('2026-11-19T12:00:00Z')
  const c: ConsentCookie = { id: ID, version: 2, date: '2026-11-01', choice: { analytics: true, marketing: false } }
  const opts = { version: 2, categories: ['analytics', 'marketing'], days: 365, now }
  it('holds under the current texts, or later ones', () => {
    expect(isCurrent(c, opts)).toBe(true)
    expect(isCurrent(c, { ...opts, version: 1 })).toBe(true)
  })
  it('is asked again when editors raised the version', () => {
    expect(isCurrent(c, { ...opts, version: 3 })).toBe(false)
  })
  it('is asked again about a category the site added', () => {
    expect(isCurrent(c, { ...opts, categories: ['analytics', 'marketing', 'video'] })).toBe(false)
    // A category the site dropped does not matter.
    expect(isCurrent(c, { ...opts, categories: ['analytics'] })).toBe(true)
  })
  it('is asked again once it is older than the days a choice holds', () => {
    expect(isCurrent({ ...c, date: '2025-11-19' }, opts)).toBe(true) // 365 days ago: the day itself still counts
    expect(isCurrent({ ...c, date: '2025-11-17' }, opts)).toBe(false)
    expect(isCurrent({ ...c, date: '2026-10-01' }, { ...opts, days: 30 })).toBe(false)
  })
  it('without a cookie, nothing holds', () => {
    expect(isCurrent(null, opts)).toBe(false)
  })
})

describe('categories', () => {
  it('necessary is always granted, the others only on a yes', () => {
    expect(grantedIn(null, 'necessary')).toBe(true)
    expect(grantedIn(null, 'analytics')).toBe(false)
    expect(grantedIn({ analytics: true, marketing: false }, 'analytics')).toBe(true)
    expect(grantedIn({ analytics: true, marketing: false }, 'marketing')).toBe(false)
    expect(grantedIn({ analytics: true }, 'video')).toBe(false)
  })
  it('a choice from the browser: yes or no for each category asked; one left out is a no; anything else is refused', () => {
    const keys = ['analytics', 'marketing']
    expect(normalizeChoice({ analytics: true }, keys)).toEqual({ analytics: true, marketing: false })
    expect(normalizeChoice({ analytics: true, marketing: true, necessary: false }, keys)).toEqual({ analytics: true, marketing: true })
    expect(normalizeChoice({ analytics: 'yes' }, keys)).toBeNull()
    expect(normalizeChoice({ tracking: true }, keys)).toBeNull()
    expect(normalizeChoice(['analytics'], keys)).toBeNull()
    expect(normalizeChoice(null, keys)).toBeNull()
  })
  it('what a choice is, for the log', () => {
    expect(actionOf(null, { analytics: true }, 1)).toBe('given')
    expect(actionOf({ choice: { analytics: true, marketing: true }, version: 1 }, { analytics: false, marketing: true }, 1)).toBe('withdrawn')
    expect(actionOf({ choice: { analytics: false, marketing: false }, version: 1 }, { analytics: true, marketing: false }, 1)).toBe('changed')
    expect(actionOf({ choice: { analytics: true, marketing: false }, version: 1 }, { analytics: false, marketing: true }, 1)).toBe('changed')
    // Asked again under new texts: given anew, unless it only takes something back.
    expect(actionOf({ choice: { analytics: true }, version: 1 }, { analytics: true }, 2)).toBe('given')
    expect(actionOf({ choice: { analytics: true }, version: 1 }, { analytics: false }, 2)).toBe('withdrawn')
  })
  it('which categories a choice takes back', () => {
    expect(withdrawnFrom({ analytics: true, marketing: true }, { analytics: false, marketing: true })).toEqual(['analytics'])
    expect(withdrawnFrom(null, { analytics: false })).toEqual([])
    expect(withdrawnFrom({ analytics: false }, { analytics: false })).toEqual([])
  })
  it('how a choice reads in the counts', () => {
    expect(outcomeOf({ analytics: true, marketing: true })).toBe('all')
    expect(outcomeOf({ analytics: false, marketing: false })).toBe('none')
    expect(outcomeOf({ analytics: true, marketing: false })).toBe('custom')
  })
})

describe('the banner\'s texts', () => {
  it('has the standard texts in Czech, English and German, every one filled', () => {
    for (const lang of ['cs', 'en', 'de'] as const) {
      const d = DEFAULT_TEXTS[lang]
      for (const [k, v] of Object.entries(d.texts)) if (k !== 'privacyUrl') expect(v, `${lang}.${k}`).toMatch(/\S/)
      for (const c of Object.values(d.categories)) expect(c.label && c.description).toBeTruthy()
    }
    // "Accept all" and "Reject all" are two plain words each: neither is the louder one.
    expect([DEFAULT_TEXTS.cs.texts.acceptAll, DEFAULT_TEXTS.cs.texts.rejectAll]).toEqual(['Přijmout vše', 'Odmítnout vše'])
  })
  it('picks the language of the standard texts: cs, de, en; Slovak reads Czech; anything else English', () => {
    expect(['cs-CZ', 'de_AT', 'en', 'sk', 'fr', '', null].map(defaultsLanguage)).toEqual(['cs', 'de', 'en', 'cs', 'en', 'en', 'en'])
  })
  it('uses what editors wrote, and the standard text where they left one empty', () => {
    const r = resolveTexts({ title: ' Sušenky ', body: '', analyticsLabel: 'Měření', privacyUrl: '/ochrana-udaju' }, ['analytics'], 'cs')
    expect(r.texts).toMatchObject({ title: 'Sušenky', body: DEFAULT_TEXTS.cs.texts.body, privacyUrl: '/ochrana-udaju', acceptAll: 'Přijmout vše' })
    expect(r.categories.map(({ services, ...c }) => c)).toEqual([
      { key: 'necessary', label: 'Nezbytné', description: DEFAULT_TEXTS.cs.categories.necessary.description, required: true },
      { key: 'analytics', label: 'Měření', description: DEFAULT_TEXTS.cs.categories.analytics.description, required: false },
    ])
  })
  it('a category of the site\'s own: what editors wrote, else the text of the options', () => {
    const video = { key: 'video', label: { cs: 'Videa', en: 'Videos' }, description: { cs: 'Přehrávač YouTube.', en: 'The YouTube player.' } }
    expect(resolveTexts({ videoLabel: ' Přehrávač ' }, [video], 'cs').categories[1]).toMatchObject({ label: 'Přehrávač', description: 'Přehrávač YouTube.' })
    expect(resolveTexts({ videoLabel: '', videoText: 'Vlastní popis' }, [video], 'cs').categories[1]).toMatchObject({ label: 'Videa', description: 'Vlastní popis' })
  })
  it('lists the consent cookie under necessary by itself, for as long as a choice holds', () => {
    const [necessary] = resolveTexts(null, ['analytics'], 'en', { cookieDays: 180 }).categories
    expect(necessary!.services).toEqual([{ name: 'Cookie consent', provider: 'This website', purpose: expect.stringContaining('Remembers your choice'), cookies: ['tz_consent'], duration: '180 days', privacyUrl: '' }])
    expect(['cs', 'de'].map((l) => resolveTexts(null, ['analytics'], l, { cookieDays: 3 }).categories[0]!.services[0]!.duration)).toEqual(['3 dny', '3 Tage'])
    expect(daysText(1, 'cs')).toBe('1 den')
    expect(daysText(365, 'cs')).toBe('365 dní')
  })
  it('the analytics plugin with a banner describes what it keeps; without one it is not listed', () => {
    const analytics = (mode: string | null) => resolveTexts(null, ['analytics'], 'en', { analyticsMode: mode }).categories[1]!.services
    expect(analytics('consent')).toEqual([expect.objectContaining({ name: 'Website statistics', cookies: ['tz_consent'], purpose: expect.stringContaining('how often people come back') })])
    expect(analytics('strict')).toEqual([expect.objectContaining({ name: 'Website statistics', cookies: [], duration: '' })])
    expect(analytics('cookieless')).toEqual([])
    expect(analytics(null)).toEqual([])
  })
  it('the site\'s services, in the page\'s language, after the ones the plugins describe', () => {
    const services = {
      necessary: [{ name: 'Cart', purpose: { cs: 'Košík.', en: 'The cart.' }, cookies: ['cart'], duration: { cs: '1 den', en: '1 day' } }],
      marketing: [{ name: 'Meta Pixel', provider: 'Meta Platforms Ireland Ltd.', purpose: 'Ads.', cookies: ['_fbp'], privacyUrl: 'https://www.facebook.com/privacy/policy/' }],
    }
    const cats = resolveTexts(null, ['analytics', 'marketing'], 'cs', { services }).categories
    expect(cats[0]!.services.map((s) => s.name)).toEqual(['Souhlas s cookies', 'Cart'])
    expect(cats[0]!.services[1]).toEqual({ name: 'Cart', provider: '', purpose: 'Košík.', cookies: ['cart'], duration: '1 den', privacyUrl: '' })
    expect(cats[2]!.services).toEqual([{ name: 'Meta Pixel', provider: 'Meta Platforms Ireland Ltd.', purpose: 'Ads.', cookies: ['_fbp'], duration: '', privacyUrl: 'https://www.facebook.com/privacy/policy/' }])
  })
  it('a category of the site\'s own, in the page\'s language', () => {
    const video = { key: 'video', label: { cs: 'Videa', en: 'Videos' }, description: { cs: 'Přehrávač YouTube.', en: 'The YouTube player.' } }
    expect(resolveTexts(null, ['analytics', video], 'en-GB').categories.map((c) => [c.key, c.label, c.required])).toEqual([
      ['necessary', 'Necessary', true], ['analytics', 'Statistics', false], ['video', 'Videos', false],
    ])
    expect(resolveTexts(null, [video], 'de').categories[1]).toMatchObject({ label: 'Videos', description: 'The YouTube player.' })
  })
})

describe('the options', () => {
  it('asks about statistics and marketing by default, keeps a choice a year and the log three years', () => {
    expect(resolveConsentOptions()).toMatchObject({ keys: ['analytics', 'marketing'], cookieDays: 365, keepLogDays: 1095, localized: false })
  })
  it('takes categories of the site\'s own', () => {
    const o = resolveConsentOptions({ categories: ['analytics', { key: 'video', label: { cs: 'Videa', en: 'Videos' } }] })
    expect(o.keys).toEqual(['analytics', 'video'])
  })
  it('refuses what makes no sense', () => {
    expect(() => resolveConsentOptions({ categories: [] })).toThrow(/at least one category/)
    expect(() => resolveConsentOptions({ categories: ['necessary' as any] })).toThrow(/always on/)
    expect(() => resolveConsentOptions({ categories: ['ads' as any] })).toThrow(/not a built-in category/)
    expect(() => resolveConsentOptions({ categories: [{ key: 'necessary', label: 'x' }] })).toThrow(/always on/)
    expect(() => resolveConsentOptions({ categories: [{ key: 'Video', label: 'x' }] })).toThrow(/lowercase letters/)
    expect(() => resolveConsentOptions({ categories: [{ key: 'analytics', label: 'x' }] })).toThrow(/built in/)
    expect(() => resolveConsentOptions({ categories: ['analytics', 'analytics'] })).toThrow(/twice/)
    expect(() => resolveConsentOptions({ categories: [{ key: 'video' } as any] })).toThrow(/needs a label/)
    expect(() => resolveConsentOptions({ cookieDays: 400 })).toThrow(/13 months/)
    expect(() => resolveConsentOptions({ cookieDays: 365, keepLogDays: 100 })).toThrow(/must outlive the choice/)
    // Its texts are fields of the settings: privacyLabel is the privacy link's.
    expect(() => resolveConsentOptions({ categories: [{ key: 'privacy', label: 'x' }] })).toThrow(/taken by a text of the banner/)
  })
  it('takes services per category, checked', () => {
    const yt = { name: 'YouTube', provider: 'Google Ireland Limited', purpose: { en: 'Plays videos.' }, cookies: ['YSC', 'VISITOR_INFO1_LIVE'], duration: { en: '6 months' }, privacyUrl: 'https://policies.google.com/privacy' }
    const video = { key: 'video', label: 'Videos' }
    const o = resolveConsentOptions({ categories: ['analytics', video], services: { video: [yt], necessary: [{ name: 'Cart', purpose: 'The cart.' }] } })
    expect(o.services).toEqual({ video: [yt], necessary: [{ name: 'Cart', purpose: 'The cart.' }] })
    expect(resolveConsentOptions().services).toEqual({})
    const bad = (services: any) => () => resolveConsentOptions({ categories: ['analytics', video], services })
    expect(bad({ marketing: [yt] })).toThrow(/"marketing" is not a category the banner asks about \(necessary, analytics, video\)/)
    expect(bad({ video: yt })).toThrow(/services.video is a list/)
    expect(bad({ video: [{ purpose: 'x' }] })).toThrow(/services.video\[0\] needs a name/)
    expect(bad({ video: [{ name: 'YouTube' }] })).toThrow(/needs a purpose/)
    expect(bad({ video: [{ name: 'YouTube', purpose: { en: ' ' } }] })).toThrow(/needs a purpose/)
    expect(bad({ video: [{ ...yt, cookie: ['YSC'] }] })).toThrow(/unknown "cookie"/)
    expect(bad({ video: [{ ...yt, cookies: 'YSC' }] })).toThrow(/cookies is a list of cookie names/)
    expect(bad({ video: [{ ...yt, cookies: ['a b'] }] })).toThrow(/cookies is a list of cookie names/)
    expect(bad({ video: [{ ...yt, privacyUrl: '/privacy' }] })).toThrow(/privacyUrl is a full address/)
    expect(bad({ video: [{ ...yt, duration: 6 }] })).toThrow(/duration is a text/)
    expect(bad([yt])).toThrow(/a list of services per category/)
  })
  it('lets administrators and editors see the counts by default, not authors', () => {
    const u = (role: string, base: string | null = role) => ({ user: { id: '1', email: '', name: '', role, base, locale: null } as any })
    expect([consentReadAccess(u('admin')), consentReadAccess(u('editor')), consentReadAccess(u('author'))]).toEqual([true, true, false])
  })
})

describe('the plugin', () => {
  it('is a valid plugin whose files are all there', () => {
    const plugin = consentPlugin()
    const plan = planPlugins([plugin], { exists: existsSync })
    expect(plan.handlers.map((h) => `${h.method} ${h.route}`)).toEqual([
      'get /api/content/_consent/config', 'post /api/content/_consent/choice', 'get /api/cms/_p/consent/stats', 'post /api/cms/_p/consent/ask-again',
    ])
    expect(plan.appPlugins).toEqual([expect.objectContaining({ mode: 'all', plugin: 'consent' })])
    expect(plan.composableDirs).toEqual([plugin.composables])
    expect(existsSync(`${plugin.components}/CmsConsent.vue`)).toBe(true)
    expect(existsSync(`${plugin.composables}/useConsent.ts`)).toBe(true)
  })
  it('writes its log into schema.ts; the settings follow the categories, per language with `localized`', () => {
    const reg = buildRegistry({ plugins: [consentPlugin({ categories: ['analytics'] })] })
    expect([...reg.pluginTables.keys()]).toEqual(['consent_log'])
    expect(emitSchema(reg)).toContain("export const consentLog = pgTable('consent_log'")
    const settings = reg.byName.get('consent_settings')!
    expect(settings.singleton).toBe(true)
    expect(Object.keys(settings.fields)).toEqual(expect.arrayContaining(['title', 'body', 'acceptAll', 'rejectAll', 'necessaryLabel', 'analyticsText', 'privacyUrl', 'version']))
    expect(Object.keys(settings.fields)).not.toContain('marketingLabel')
    expect(settings.localized ?? []).toEqual([])
    const locales = { __cms: 'locales', default: 'cs', locales: ['cs', 'en'] }
    const many = buildRegistry({ locales, plugins: [consentPlugin({ localized: true })] }).byName.get('consent_settings')!
    expect(many.localized).toEqual(expect.arrayContaining(['title', 'body', 'marketingLabel', 'privacyUrl']))
    expect(many.localized).not.toContain('version')
    expect(consentOptionsOf(buildRegistry({ plugins: [consentPlugin({ cookieDays: 180 })] }))).toMatchObject({ cookieDays: 180 })
  })
  it('editors write the texts of the site\'s own categories too; the options\' texts are the defaults', () => {
    const video = { key: 'video_embeds', label: { en: 'Videos', cs: 'Videa' }, description: { en: 'The YouTube player.' } }
    const settings = buildRegistry({ plugins: [consentPlugin({ categories: ['analytics', video] })] }).byName.get('consent_settings')!
    expect(Object.keys(settings.fields)).toEqual(expect.arrayContaining(['video_embedsLabel', 'video_embedsText']))
    const meta = (k: string) => (settings.fields as any)[k].meta
    expect(meta('video_embedsLabel').label).toMatchObject({ en: 'Name (Videos)', cs: 'Název (Videa)' })
    expect(meta('video_embedsLabel').help).toMatchObject({ en: 'Leave it empty for the site\'s own text: "Videos".' })
    expect(meta('video_embedsText').help).toMatchObject({ en: 'Leave it empty for the site\'s own text: "The YouTube player.".' })
    expect(meta('analyticsLabel').help.en).toBe('Leave it empty for the standard text.')
  })
  it('has every admin text in Czech and German too', () => {
    const keys = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' || 'other' in (v as any) ? [`${p}${k}`] : keys(v, `${p}${k}.`)))
    const en = keys(CONSENT_MESSAGES.en).sort()
    expect(keys(CONSENT_MESSAGES.cs).sort()).toEqual(en)
    expect(keys(CONSENT_MESSAGES.de).sort()).toEqual(en)
  })
})

describe('the analytics plugin with a cookie banner', () => {
  it('counts without a banner by default', () => {
    expect((analyticsPlugin() as any).analytics.mode).toBe('cookieless')
    expect(analyticsOptionsOf({ plugins: collectPlugins({ plugins: [analyticsPlugin()] }) })?.mode).toBe('cookieless')
    expect(() => analyticsPlugin({ mode: 'opt-in' as any })).toThrow(/mode is 'cookieless', 'consent' or 'strict'/)
  })
  it('follows the banner by default: consent when it asks about statistics', () => {
    const modeWith = (...plugins: any[]) => analyticsOptionsOf({ plugins: collectPlugins({ plugins }) })?.mode
    expect(modeWith(analyticsPlugin(), consentPlugin())).toBe('consent')
    expect(modeWith(consentPlugin({ categories: ['analytics'] }), analyticsPlugin())).toBe('consent')
    expect(modeWith(analyticsPlugin(), consentPlugin({ categories: ['marketing'] }))).toBe('cookieless')
    // A mode the site sets stays as it is.
    expect(modeWith(analyticsPlugin({ mode: 'cookieless' }), consentPlugin())).toBe('cookieless')
    expect(modeWith(analyticsPlugin({ mode: 'strict' }), consentPlugin())).toBe('strict')
    // The same options object on every call, for the server's routes.
    const reg = { plugins: collectPlugins({ plugins: [analyticsPlugin(), consentPlugin()] }) }
    expect(analyticsOptionsOf(reg)).toBe(analyticsOptionsOf(reg))
  })
  it('consent and strict need the consent plugin, and its category "analytics"', () => {
    for (const mode of ['consent', 'strict'] as const) {
      expect(() => collectPlugins({ plugins: [analyticsPlugin({ mode })] })).toThrow(new RegExp(`Plugin "analytics": mode: '${mode}' needs the consent plugin.*consentPlugin\\(\\)`))
      expect(() => collectPlugins({ plugins: [analyticsPlugin({ mode }), consentPlugin({ categories: ['marketing'] })] })).toThrow(/does not ask about "analytics"/)
      expect(collectPlugins({ plugins: [analyticsPlugin({ mode }), consentPlugin()] }).map((p) => p.name)).toEqual(['analytics', 'consent'])
    }
    expect(collectPlugins({ plugins: [analyticsPlugin()] }).map((p) => p.name)).toEqual(['analytics'])
  })
  it('strict uses the tracker that waits for consent', () => {
    expect(analyticsPlugin({ mode: 'strict' }).appPlugins?.[0]?.src).toMatch(/tracker-strict\.client\.ts$/)
    expect(analyticsPlugin({ mode: 'consent' }).appPlugins?.[0]?.src).toMatch(/tracker\.client\.ts$/)
  })
  it('what a page view does with the visitor\'s choice', () => {
    const yes = { id: ID, choice: { analytics: true, marketing: false } }
    const no = { id: ID, choice: { analytics: false, marketing: true } }
    expect(consentDecision('cookieless', yes)).toEqual({ count: true, consentId: null })
    expect(consentDecision('cookieless', null)).toEqual({ count: true, consentId: null })
    // consent: everyone counted; the consent id only with statistics allowed.
    expect(consentDecision('consent', yes)).toEqual({ count: true, consentId: ID })
    expect(consentDecision('consent', no)).toEqual({ count: true, consentId: null })
    expect(consentDecision('consent', null)).toEqual({ count: true, consentId: null })
    // strict: nobody without statistics allowed, and never with the id.
    expect(consentDecision('strict', yes)).toEqual({ count: true, consentId: null })
    expect(consentDecision('strict', no)).toEqual({ count: false, consentId: null })
    expect(consentDecision('strict', null)).toEqual({ count: false, consentId: null })
  })
})

describe('the tracker', () => {
  let sent: any[]
  let mounted: (() => void) | null
  let finished: (() => void) | null
  const hooks = { mounted: (cb: () => void) => { mounted = cb }, pageFinish: (cb: () => void) => { finished = cb } }
  const send = (body: string) => { sent.push(JSON.parse(body)) }
  beforeEach(() => {
    sent = []
    mounted = null
    finished = null
    vi.useFakeTimers()
    vi.stubGlobal('location', { pathname: '/', search: '', protocol: 'https:' })
    vi.stubGlobal('navigator', { webdriver: false, language: 'cs-CZ' })
    vi.stubGlobal('screen', { width: 1440 })
    vi.stubGlobal('window', { addEventListener: () => {} })
    vi.stubGlobal('document', { referrer: 'https://www.google.com/', visibilityState: 'visible', documentElement: { lang: 'cs' }, addEventListener: () => {} })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
  const go = (path: string) => {
    ;(globalThis as any).location.pathname = path
    finished!()
    vi.runAllTimers()
  }
  function gate(initial: { ready: boolean; granted: boolean }) {
    const s = { ...initial }
    const listeners: (() => void)[] = []
    const g: TrackerGate = { ready: () => s.ready, granted: () => s.granted, onChange: (cb) => { listeners.push(cb) } }
    return { g, set: (next: Partial<typeof s>) => { Object.assign(s, next); listeners.forEach((cb) => cb()) } }
  }

  it('without a gate (cookieless, consent) sends a view at once and on every page', () => {
    startTracker(hooks, { send })
    mounted!()
    go('/blog')
    expect(sent.map((b) => b.p)).toEqual(['/', '/blog'])
    expect(sent[0]).toMatchObject({ r: 'https://www.google.com/', w: 1440, l: 'cs-CZ', lc: 'cs' })
    expect(sent[1].r).toBe('')
  })
  it('strict: sends nothing at all until statistics are allowed, then the page the visitor is on', () => {
    const { g, set } = gate({ ready: false, granted: false })
    startTracker(hooks, { send, gate: g })
    mounted!()
    go('/blog')
    expect(sent).toEqual([])
    set({ ready: true, granted: false })
    go('/kontakt')
    expect(sent).toEqual([])
    set({ granted: true })
    expect(sent.map((b) => b.p)).toEqual(['/kontakt'])
    go('/o-nas')
    expect(sent.map((b) => b.p)).toEqual(['/kontakt', '/o-nas'])
  })
  it('strict: a visitor who allowed it before is counted as soon as the choice is read', () => {
    const { g, set } = gate({ ready: false, granted: true })
    startTracker(hooks, { send, gate: g })
    mounted!()
    expect(sent).toEqual([])
    set({ ready: true })
    expect(sent.map((b) => b.p)).toEqual(['/'])
    set({ ready: true }) // told again: still one view of this page
    expect(sent).toHaveLength(1)
  })
  it('strict: stops at once when statistics are taken back, also the time on the page', () => {
    const { g, set } = gate({ ready: true, granted: true })
    let hidden: (() => void) | undefined
    ;(globalThis as any).document.addEventListener = (type: string, cb: () => void) => { if (type === 'visibilitychange') hidden = cb }
    startTracker(hooks, { send, gate: g })
    mounted!()
    expect(sent).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    set({ granted: false })
    ;(globalThis as any).document.visibilityState = 'hidden'
    hidden!()
    go('/blog')
    expect(sent).toHaveLength(1)
  })
  it('stays quiet in the admin and for automated browsers', () => {
    ;(globalThis as any).location.pathname = '/admin/post'
    startTracker(hooks, { send })
    mounted!()
    expect(sent).toEqual([])
    ;(globalThis as any).navigator.webdriver = true
    mounted = null
    startTracker(hooks, { send })
    expect(mounted).toBeNull()
  })
})

describe('the choice in the browser', () => {
  const config: ConsentConfig = {
    version: 2, cookieDays: 365, locale: 'cs', texts: DEFAULT_TEXTS.cs.texts,
    categories: resolveTexts(null, ['analytics', 'marketing'], 'cs').categories,
  }
  const now = new Date('2026-11-19T12:00:00Z')
  function env(cookie: string, over: Partial<ConsentEnv> = {}) {
    const calls: any[] = []
    const written: string[] = []
    const e: ConsentEnv = {
      readCookie: () => cookie,
      writeCookie: (c) => { written.push(c) },
      loadConfig: async () => config,
      sendChoice: async (body) => {
        calls.push(body)
        const id = body.id ?? ID
        return { id, cookie: encodeConsent({ id, version: body.version, date: '2026-11-19', choice: body.choice }) }
      },
      secure: true,
      now: () => now,
      ...over,
    }
    return { e, calls, written }
  }
  const current = `tz_consent=${encodeConsent({ id: ID, version: 2, date: '2026-11-10', choice: { analytics: true, marketing: false } })}`

  it('nothing is known on the server: only necessary is granted', () => {
    const rt = createConsentRuntime(initialConsentState(), env('').e)
    expect(rt.state.ready).toBe(false)
    expect([rt.granted('necessary'), rt.granted('analytics')]).toEqual([true, false])
  })
  it('reads a choice that holds from the cookie', async () => {
    const rt = createConsentRuntime(initialConsentState(), env(current).e)
    const seen: any[] = []
    rt.onChange((c) => seen.push(c))
    await rt.start('cs')
    expect(rt.state).toMatchObject({ ready: true, id: ID, choice: { analytics: true, marketing: false } })
    expect([rt.granted('analytics'), rt.granted('marketing')]).toEqual([true, false])
    expect(seen).toEqual([{ analytics: true, marketing: false }])
  })
  it('asks again when editors raised the version since', async () => {
    const old = `tz_consent=${encodeConsent({ id: ID, version: 1, date: '2026-11-10', choice: { analytics: true, marketing: true } })}`
    const rt = createConsentRuntime(initialConsentState(), env(old).e)
    await rt.start('cs')
    expect(rt.state.choice).toBeNull()
    expect(rt.granted('analytics')).toBe(false)
    // The same consent id stays: the new answer joins the visitor's history.
    expect(rt.state.id).toBe(ID)
  })
  it('saves through the server, which logs it and sets the cookie', async () => {
    const { e, calls, written } = env('')
    const rt = createConsentRuntime(initialConsentState(), e)
    await rt.start('cs')
    expect(rt.state.choice).toBeNull()
    await rt.acceptAll()
    expect(calls).toEqual([{ id: null, choice: { analytics: true, marketing: true }, version: 2 }])
    expect(rt.state).toMatchObject({ id: ID, choice: { analytics: true, marketing: true }, saving: false })
    await rt.save({ analytics: false, marketing: true })
    expect(calls[1]).toEqual({ id: ID, choice: { analytics: false, marketing: true }, version: 2 })
    await rt.rejectAll()
    expect(calls[2].choice).toEqual({ analytics: false, marketing: false })
    expect(written).toEqual([])
  })
  it('keeps the choice in the browser when the server cannot be reached', async () => {
    const { e, written } = env('', { sendChoice: async () => { throw new Error('offline') } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rt = createConsentRuntime(initialConsentState(), e)
    await rt.start('cs')
    await rt.rejectAll()
    expect(rt.state.choice).toEqual({ analytics: false, marketing: false })
    expect(written).toHaveLength(1)
    expect(written[0]).toMatch(/^tz_consent=1\.[A-Za-z0-9_-]{22}\.2\.2026-11-19\.analytics:0\|marketing:0; Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/)
    vi.restoreAllMocks()
  })
  it('opens and closes the settings; a listener added late hears the choice once', async () => {
    const rt = createConsentRuntime(initialConsentState(), env(current).e)
    await rt.start('cs')
    rt.open()
    expect(rt.state.settingsOpen).toBe(true)
    rt.close()
    expect(rt.state.settingsOpen).toBe(false)
    const late = vi.fn()
    const stop = rt.onChange(late)
    await Promise.resolve()
    expect(late).toHaveBeenCalledWith({ analytics: true, marketing: false })
    stop()
    await rt.rejectAll()
    expect(late).toHaveBeenCalledTimes(1)
  })
})

describe('the styles', () => {
  const cms = join(import.meta.dirname, '../../packages/cms')
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]))
  it('the banner uses no utility classes at all: only its own, themed with CSS variables', () => {
    const vue = readFileSync(join(cms, 'consent/components/CmsConsent.vue'), 'utf8')
    const classes = [...vue.matchAll(/ class="([^"]+)"/g)].flatMap((m) => m[1]!.split(/\s+/))
    expect(classes.filter((c) => !c.startsWith('cms-consent'))).toEqual([])
    for (const v of ['--cms-consent-bg', '--cms-consent-fg', '--cms-consent-button-bg', '--cms-consent-radius']) expect(vue).toContain(v)
  })
  it('"Accept all" and "Reject all" look the same, in the banner and in the settings', () => {
    const vue = readFileSync(join(cms, 'consent/components/CmsConsent.vue'), 'utf8')
    const buttons = [...vue.matchAll(/<button[^>]*class="([^"]+)"[^>]*>\{\{ texts\.(acceptAll|rejectAll) \}\}/g)].map((m) => [m[2], m[1]])
    expect(buttons).toEqual([['acceptAll', 'cms-consent__btn'], ['rejectAll', 'cms-consent__btn'], ['acceptAll', 'cms-consent__btn'], ['rejectAll', 'cms-consent__btn']])
  })
  it('the admin page uses only utility classes the admin itself uses (a site\'s Tailwind scans tinyzoo\'s app/ only)', () => {
    const app = files(join(cms, 'app')).filter((f) => /\.(vue|ts)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n')
    const missing: string[] = []
    for (const f of [...files(join(cms, 'consent')), join(cms, 'analytics/components/AnalyticsConsentReport.vue')].filter((x) => x.endsWith('.vue'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/ class="([^"]+)"/g)) {
        for (const c of m[1]!.split(/\s+/).filter(Boolean)) {
          if (c.startsWith('cs-') || c.startsWith('an-') || c.startsWith('cms-')) continue
          const re = new RegExp(`(?<![\\w:-])${c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?![\\w-])`)
          if (!re.test(app)) missing.push(`${f.split('/packages/cms/')[1]}: ${c}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
