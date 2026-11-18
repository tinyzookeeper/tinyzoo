import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveAdminTheme } from 'tinyzoo'
import { brandFileVersion } from '../../packages/cms/server/utils/cmsBrandFiles'

// The emails carry the client's brand from the admin's theme: the full logo (PNG from
// /api/cms/_brand/full-email.png) or the site's name at the top, the button in the brand
// colour with its text colour, and never tinyzoo's signature. Every email the CMS sends is
// built here with the auto-imports Nitro gives the module stubbed; test/api/mail-language.spec.ts
// and test/api/brand.spec.ts check real ones.

// Loaded by path at run time: the module and what it imports use Nitro's auto-imports, which
// the root type-check does not know (the playground's nuxt typecheck checks the module itself).
const EMAILS = '../../packages/cms/server/utils/cmsEmails'
const SOURCES = '../../packages/cms/server/utils/cmsBrandSource'
let m: any
let sources: any

// The site's public files, as the production server reads them (an internal $fetch): the bakery's logos.
const fixtures = join(import.meta.dirname, '../fixtures/brand')
const publicFiles: Record<string, string> = { '/brand/logo.svg': 'full.svg', '/brand/mark.svg': 'mark.svg', '/brand/logo-2026.svg': 'full-dark.svg' }
const fakeFetch = { raw: async (path: string) => {
  const name = publicFiles[path]
  return name
    ? { status: 200, headers: new Headers({ 'content-type': 'image/svg+xml' }), _data: readFileSync(join(fixtures, name)) }
    : { status: 404, headers: new Headers({ 'content-type': 'text/html' }), _data: null }
} }
/** Any request: the emails take it (a per-site theme would come from it), and nothing in it decides the brand. */
const EVENT = { path: '/api/cms/_auth/forgot' }

let admin: Record<string, any> = {}
let publicUrl = ''
beforeAll(async () => {
  m = await import(/* @vite-ignore */ EMAILS)
  sources = await import(/* @vite-ignore */ SOURCES)
})
beforeEach(() => {
  admin = { name: 'tinyzoo', defaultLocale: 'en', logo: {} }
  publicUrl = ''
  // A new object each time: cmsAdminTheme keeps the theme for the same config object.
  vi.stubGlobal('useAppConfig', () => ({ cms: { admin: { ...admin } } }))
  vi.stubGlobal('useRuntimeConfig', () => ({ cms: { publicUrl } }))
  vi.stubGlobal('useCms', () => { throw new Error('no server') })
  vi.stubGlobal('$fetch', fakeFetch)
  sources.resetBrandSources()
})
afterEach(() => vi.unstubAllGlobals())

const LINK = 'https://pekarna-novak.example/admin/reset/abc123'
const bakery = { name: { cs: 'Pekárna Novák', en: 'Novák Bakery' }, defaultLocale: 'cs', logo: { full: '/brand/logo.svg', mark: '/brand/mark.svg' } }

/** Every email the CMS sends, with what it needs. */
const everyEmail = async () => Promise.all([
  ['invitation', m.inviteEmail(EVENT, { to: 'a@x.test', inviter: 'Jana', url: LINK, role: 'editor' })],
  ['password reset', m.resetEmail(EVENT, { to: 'a@x.test', url: LINK })],
  ['confirm a new address', m.emailConfirmEmail(EVENT, { to: 'a@x.test', url: LINK })],
  ['a change was asked for', m.emailRequestedNotice(EVENT, { to: 'a@x.test', newEmail: 'new@x.test', url: LINK })],
  ['the address was changed', m.emailChangedNotice(EVENT, { to: 'a@x.test', newEmail: 'new@x.test' })],
  ['the address was changed, with the way back', m.emailChangedNotice(EVENT, { to: 'a@x.test', newEmail: 'new@x.test', revertUrl: LINK })],
  ['an administrator set the address', m.emailSetNotice(EVENT, { to: 'a@x.test', url: LINK })],
  ['the address was set back', m.emailRevertedNotice(EVENT, { to: 'a@x.test', restoredEmail: 'old@x.test' })],
  ['the address is in use', m.emailInUseNotice(EVENT, { to: 'a@x.test' })],
].map(async ([kind, mail]) => [kind, await mail])) as Promise<[string, { to: string; subject: string; html: string; text: string }][]>

describe('every email', () => {
  it('renders with the site’s name at the top and no tinyzoo signature (unbranded)', async () => {
    for (const [kind, mail] of await everyEmail()) {
      expect(mail.subject, kind).toContain('tinyzoo') // the admin's default name is the site's name
      expect(mail.html, kind).toMatch(/^<!doctype html>/)
      expect(mail.html, kind).toContain('font-weight:700;color:#171717">tinyzoo</p>')
      expect(mail.html, kind).not.toContain('<img')
      expect(mail.html, kind).not.toMatch(/made with|powered by|tinyzoo\.(dev|app|cz)/i)
    }
  })

  it('carries the bakery’s logo, name and language once the admin has them', async () => {
    admin = bakery
    publicUrl = 'https://pekarna-novak.example/'
    // The version is the full logo's own bytes (the file in public/brand), not its address.
    const logo = `https://pekarna-novak.example/api/cms/_brand/full-email.png?v=${brandFileVersion(readFileSync(join(fixtures, 'full.svg')))}`
    for (const [kind, mail] of await everyEmail()) {
      expect(mail.subject, kind).toContain('Pekárna Novák')
      expect(mail.html, kind).toContain(`<img src="${logo}" width="160" alt="Pekárna Novák"`)
      expect(mail.html, kind).not.toContain('font-weight:700;color:#171717">')
    }
  })

  it('keeps the text version as it was: the message and the link, no brand', async () => {
    admin = bakery
    publicUrl = 'https://pekarna-novak.example'
    const reset = await m.resetEmail(EVENT, { to: 'a@x.test', url: LINK, locale: 'en' })
    expect(reset.text).toBe(`Someone asked to reset the password for this email address. Choose a new password with the link below.\n\nChoose a new password: ${LINK}\n\nThe link works for 1 hour. If you didn’t ask for this, ignore this email — your password stays the same.\n`)
    const inUse = await m.emailInUseNotice(EVENT, { to: 'a@x.test', locale: 'en' })
    expect(inUse.text).toBe('Someone asked to use this address for another account at Novák Bakery, but it already belongs to an account there. Nothing was changed.\n\nIf it was you, sign in with this address instead. Otherwise, ignore this email.\n')
  })
})

describe('the logo at the top', () => {
  it('needs a full logo: a mark alone gives the name', async () => {
    admin = { ...bakery, logo: { mark: '/brand/mark.svg' } }
    publicUrl = 'https://pekarna-novak.example'
    const mail = await m.resetEmail(EVENT, { to: 'a@x.test', url: LINK })
    expect(mail.html).not.toContain('<img')
    expect(mail.html).toContain('>Pekárna Novák</p>')
  })

  it('comes from the public URL; without one, from the email’s own link (development), else the name', async () => {
    admin = bakery
    const withLink = await m.resetEmail(EVENT, { to: 'a@x.test', url: 'http://localhost:3000/admin/reset/x' })
    expect(withLink.html).toContain('<img src="http://localhost:3000/api/cms/_brand/full-email.png?v=')
    const noLink = await m.emailInUseNotice(EVENT, { to: 'a@x.test' })
    expect(noLink.html).not.toContain('<img')
    expect(noLink.html).toContain('>Pekárna Novák</p>')
    publicUrl = 'https://pekarna-novak.example'
    expect((await m.emailInUseNotice(EVENT, { to: 'a@x.test' })).html).toContain('<img src="https://pekarna-novak.example/api/cms/_brand/full-email.png?v=')
  })

  it('is 160 px wide with the site’s name as its alt text, and its address changes with the logo', async () => {
    admin = bakery
    publicUrl = 'https://pekarna-novak.example'
    const before = /<img src="([^"]+)"/.exec((await m.resetEmail(EVENT, { to: 'a@x.test', url: LINK })).html)![1]
    admin = { ...bakery, logo: { full: '/brand/logo-2026.svg' } }
    const after = /<img src="([^"]+)"/.exec((await m.resetEmail(EVENT, { to: 'a@x.test', url: LINK })).html)![1]
    expect(before).not.toBe(after)
  })

  it('gets a new address when the file changes under the same name (read again after 15 minutes)', async () => {
    admin = bakery
    publicUrl = 'https://pekarna-novak.example'
    const src = async () => /<img src="([^"]+)"/.exec((await m.resetEmail(EVENT, { to: 'a@x.test', url: LINK })).html)![1]
    vi.useFakeTimers({ now: new Date('2026-11-18T10:00:00Z'), toFake: ['Date'] })
    try {
      const before = await src()
      publicFiles['/brand/logo.svg'] = 'full-dark.svg' // a new logo deployed as public/brand/logo.svg
      expect(await src()).toBe(before) // kept for a while: not read on every email
      vi.setSystemTime(new Date('2026-11-18T10:16:00Z'))
      await src() // the old copy while it is read again
      await vi.waitFor(async () => expect(await src()).not.toBe(before))
      expect(await src()).toContain(`?v=${brandFileVersion(readFileSync(join(fixtures, 'full-dark.svg')))}`)
    }
    finally {
      publicFiles['/brand/logo.svg'] = 'full.svg'
      vi.useRealTimers()
    }
  })

  it('a full logo that cannot be read gives the name, not a broken picture, and one log line', async () => {
    admin = { ...bakery, logo: { full: '/brand/gone.svg' } }
    publicUrl = 'https://pekarna-novak.example'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (let i = 0; i < 3; i++) {
        const mail = await m.resetEmail(EVENT, { to: 'a@x.test', url: LINK })
        expect(mail.html).not.toContain('<img')
        expect(mail.html).toContain('>Pekárna Novák</p>')
      }
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]![0])).toMatch(/the admin logo "\/brand\/gone\.svg" \(cms\.admin\.logo\) cannot be read: the site has no file at \/brand\/gone\.svg/)
    }
    finally {
      warn.mockRestore()
    }
  })
})

describe('the button', () => {
  it('is in the accent’s light colour with its text colour (tinyzoo’s charcoal and white by default)', async () => {
    const theme = resolveAdminTheme()
    const mail = await m.resetEmail(EVENT, { to: 'a@x.test', url: LINK })
    expect(mail.html).toContain(`background:${theme.accent.light.primary};color:${theme.accent.light.onPrimary};`)
  })

  it('follows the theme’s colours, and the written-out link is a readable link in the accent’s text colour', () => {
    const theme = resolveAdminTheme()
    const brand = m.emailBrand({ ...theme, accent: { ...theme.accent, light: { ...theme.accent.light, primary: '#8F3F1E', onPrimary: '#FFFFFF', text: '#7A3519' } } }, 'Pekárna Novák', null)
    const { html } = m.emailLayout({ brand, intro: 'Hi', action: 'Go', url: LINK, footer: 'Bye', fallback: 'Copy this:' })
    expect(html).toContain('background:#8F3F1E;color:#FFFFFF;')
    expect(html).toContain(`<a href="${LINK}" style="color:#7A3519;word-break:break-all">${LINK}</a>`)
    expect(html).toContain('color:#525252">Copy this:') // 7.8:1 on white (it was a pale grey)
  })

  it('never puts a colour that is not a hex into the style', () => {
    const theme = resolveAdminTheme()
    const brand = m.emailBrand({ ...theme, accent: { ...theme.accent, light: { ...theme.accent.light, primary: 'red;background:url(x)', onPrimary: '"><script>', text: 'x;y' } } }, 'x', null)
    expect(brand).toMatchObject({ primary: '#2E3035', onPrimary: '#FFFFFF', link: '#2E3035' })
  })

  it('is left out with its link when the email has nothing to click', async () => {
    const mail = await m.emailRevertedNotice(EVENT, { to: 'a@x.test', restoredEmail: 'old@x.test' })
    expect(mail.html).not.toContain('<a ')
  })
})

describe('escaping', () => {
  it('escapes the site’s name in the heading, the subject stays plain text', async () => {
    admin = { name: 'Tom & Jerry <Bakery> "Best"', defaultLocale: 'en', logo: {} }
    const mail = await m.resetEmail(EVENT, { to: 'a@x.test', url: LINK })
    expect(mail.html).toContain('>Tom &amp; Jerry &lt;Bakery&gt; &quot;Best&quot;</p>')
    expect(mail.html).not.toContain('<Bakery>')
    expect(mail.subject).toBe('Reset your password for Tom & Jerry <Bakery> "Best"')
  })

  it('escapes the name in the logo’s alt text, and the addresses', () => {
    const brand = { site: '"><img src=x onerror=alert(1)>', logoUrl: 'https://x.test/logo.png?a=1&b="2"', primary: '#2E3035', onPrimary: '#FFFFFF' }
    const { html } = m.emailLayout({ brand, intro: '<b>hi</b>', action: 'Go & see', url: 'https://x.test/a?b=1&c="d"', footer: 'f', fallback: 'fb' })
    expect(html).toContain('alt="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"')
    expect(html).toContain('src="https://x.test/logo.png?a=1&amp;b=&quot;2&quot;"')
    expect(html).toContain('href="https://x.test/a?b=1&amp;c=&quot;d&quot;"')
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;')
    expect(html).toContain('>Go &amp; see</a>')
    expect(html).not.toContain('onerror=alert(1)>')
  })
})

describe('the public address for images', () => {
  it('is cms.publicUrl without its trailing slash, else the origin of an http(s) link', () => {
    publicUrl = 'https://pekarna-novak.example//'
    expect(m.emailPublicBase()).toBe('https://pekarna-novak.example')
    publicUrl = ''
    expect(m.emailPublicBase('http://localhost:3000/admin/x')).toBe('http://localhost:3000')
    expect(m.emailPublicBase('javascript:alert(1)')).toBeNull()
    expect(m.emailPublicBase('not a url')).toBeNull()
    expect(m.emailPublicBase()).toBeNull()
  })
})
