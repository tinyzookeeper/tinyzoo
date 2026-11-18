import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from '../../packages/cms/node_modules/sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminBrandLockup, adminIconLinks, brandFileUrl, brandInitials, CMS_ADMIN_MANIFEST_URL, logoAddressKind, logoFileNotes, resolveAdminTheme } from 'tinyzoo'
import { checkAdminLogos } from '../../packages/cms/server/utils/cmsLogoCheck'
import { cmsFailedLogos, cmsShownLogo, type CmsLogoImage } from '../../packages/cms/app/utils/cmsBrandLogo'

// The client's logo set in the admin (0.7): which addresses are used, what each place
// shows, the tab icons, and the checks a developer sees in development.

const fixtures = join(import.meta.dirname, '../fixtures/brand')

describe('resolveAdminTheme: logos and signature', () => {
  it('has no logos and keeps the signature by default', () => {
    const theme = resolveAdminTheme()
    expect(theme.logo).toEqual({ full: null, mark: null, fullDark: null, markDark: null, fullDarkPlate: false, markDarkPlate: false })
    expect(theme.signature).toBe(true)
    expect(theme.notes).toEqual([])
  })

  it('shows the light logos in dark mode on a tile when there are no dark versions', () => {
    const { logo, notes } = resolveAdminTheme({ logo: { full: '/brand/logo.svg', mark: ' https://cdn.example.com/mark.png ' } })
    expect(logo).toEqual({
      full: '/brand/logo.svg', mark: 'https://cdn.example.com/mark.png',
      fullDark: '/brand/logo.svg', markDark: 'https://cdn.example.com/mark.png',
      fullDarkPlate: true, markDarkPlate: true,
    })
    expect(notes).toEqual([])
  })

  it('uses the dark versions when given, without a tile', () => {
    const { logo } = resolveAdminTheme({ logo: { full: '/a.svg', fullDark: '/a-dark.svg', mark: '/m.svg', markDark: '/m-dark.svg' } })
    expect(logo).toMatchObject({ fullDark: '/a-dark.svg', markDark: '/m-dark.svg', fullDarkPlate: false, markDarkPlate: false })
  })

  it('leaves out an address the admin cannot load, and says so', () => {
    for (const bad of ['brand/logo.svg', '//cdn.example.com/logo.svg', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'ftp://example.com/l.svg', 'https://']) {
      const theme = resolveAdminTheme({ logo: { full: bad } })
      expect(theme.logo.full, bad).toBeNull()
      expect(theme.logo.fullDarkPlate).toBe(false)
      expect(theme.notes, bad).toEqual([{ kind: 'logo', message: expect.stringContaining('cms.admin.logo.full') }])
      expect(theme.notes[0]!.message).toMatch(/start it with \/|https:\/\//)
    }
    const odd = resolveAdminTheme({ logo: { mark: 42 as any } })
    expect(odd.logo.mark).toBeNull()
    expect(odd.notes[0]!.message).toMatch(/should be an address.*a number/)
  })

  it('keeps an http:// logo but warns that an https admin cannot show it', () => {
    const theme = resolveAdminTheme({ logo: { mark: 'http://cdn.example.com/m.png' } })
    expect(theme.logo.mark).toBe('http://cdn.example.com/m.png')
    expect(theme.notes).toHaveLength(1)
    expect(theme.notes[0]!.message).toMatch(/http:\/\/.*Use https:\/\//)
  })

  it('leaves out a dark version without its light one', () => {
    const theme = resolveAdminTheme({ logo: { fullDark: '/d.svg', markDark: '/md.svg' } })
    expect(theme.logo).toEqual({ full: null, mark: null, fullDark: null, markDark: null, fullDarkPlate: false, markDarkPlate: false })
    expect(theme.notes.map((n) => n.message)).toEqual([
      expect.stringMatching(/logo\.fullDark is set, but cms\.admin\.logo\.full is not/),
      expect.stringMatching(/logo\.markDark is set, but cms\.admin\.logo\.mark is not/),
    ])
  })

  it('hides the signature only with signature: false', () => {
    expect(resolveAdminTheme({ signature: false }).signature).toBe(false)
    expect(resolveAdminTheme({ signature: undefined }).signature).toBe(true)
  })
})

describe('logoAddressKind', () => {
  it('tells site files, https and http apart from the rest', () => {
    expect(logoAddressKind('/brand/logo.svg')).toBe('path')
    expect(logoAddressKind('/brand/logo.svg?v=2')).toBe('path')
    expect(logoAddressKind('https://cdn.example.com/l.svg')).toBe('https')
    expect(logoAddressKind('HTTPS://cdn.example.com/l.svg')).toBe('https')
    expect(logoAddressKind('http://localhost:3000/l.svg')).toBe('http')
    expect(logoAddressKind('//cdn.example.com/l.svg')).toBe('invalid')
    expect(logoAddressKind('/\\evil.example.com/l.svg')).toBe('invalid')
    expect(logoAddressKind('logo.svg')).toBe('invalid')
  })
})

describe('adminBrandLockup: what each place shows', () => {
  const theme = (full: string | null, mark: string | null) => resolveAdminTheme({ logo: { full: full ?? undefined, mark: mark ?? undefined } })
  it.each([
    // full, mark, unbranded → wide (open sidebar, sign-in), compact (folded sidebar)
    ['/f.svg', '/m.svg', false, 'full', 'mark'],
    ['/f.svg', null, false, 'full', 'initials'],
    [null, '/m.svg', false, 'mark', 'mark'],
    [null, null, false, 'initials', 'initials'],
    [null, null, true, 'mascot', 'mascot'],
  ] as const)('full %s, mark %s, unbranded %s → %s open, %s folded', (full, mark, unbranded, wide, compact) => {
    expect(adminBrandLockup(theme(full, mark), unbranded, 'wide')).toBe(wide)
    expect(adminBrandLockup(theme(full, mark), unbranded, 'compact')).toBe(compact)
  })

  it('makes initials from the client name', () => {
    expect(brandInitials('Pekárna Novák')).toBe('PN')
    expect(brandInitials('  Úl  ')).toBe('Ú')
    expect(brandInitials('Zoo Praha Troja')).toBe('ZP')
    expect(brandInitials('')).toBe('?')
  })
})

describe('adminIconLinks: the tab and home-screen icons', () => {
  it("keeps tinyzoo's icon without a mark, and adds no manifest", () => {
    expect(adminIconLinks(resolveAdminTheme({ logo: { full: '/f.svg' } }), '/_nuxt/favicon.svg')).toEqual([
      { rel: 'icon', type: 'image/svg+xml', href: '/_nuxt/favicon.svg', key: 'cms-admin-icon' },
    ])
  })

  it('uses the mark, its PNG versions and the manifest', () => {
    const theme = resolveAdminTheme({ logo: { mark: '/brand/mark.svg' } })
    const links = adminIconLinks(theme, '/fallback.svg')
    expect(links).toEqual([
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: brandFileUrl('mark-32.png', theme), key: 'cms-admin-icon-png' },
      { rel: 'icon', type: 'image/svg+xml', sizes: 'any', href: '/brand/mark.svg', key: 'cms-admin-icon' },
      { rel: 'apple-touch-icon', href: brandFileUrl('mark-180.png', theme), key: 'cms-admin-touch-icon' },
      { rel: 'manifest', href: CMS_ADMIN_MANIFEST_URL, key: 'cms-admin-manifest' },
    ])
    expect(links[0]!.href).toBe('/api/cms/_brand/mark-32.png') // no version until the server fills it in
    const served = { ...theme, logo: { ...theme.logo, files: { full: null, mark: 'm4rk', markFallback: false } } }
    expect(adminIconLinks(served, '/fallback.svg')[0]!.href).toBe('/api/cms/_brand/mark-32.png?v=m4rk')
    expect(CMS_ADMIN_MANIFEST_URL).toBe('/api/cms/_brand/admin.webmanifest')
  })

  it("keeps tinyzoo's icon when the server could not read the mark, so the tab never shows a broken one", () => {
    const theme = resolveAdminTheme({ logo: { mark: '/brand/gone.svg' } })
    const unread = { ...theme, logo: { ...theme.logo, files: { full: null, mark: 'tz', markFallback: true } } }
    expect(adminIconLinks(unread, '/_nuxt/favicon.svg')).toEqual([
      { rel: 'icon', type: 'image/svg+xml', href: '/_nuxt/favicon.svg', key: 'cms-admin-icon' },
    ])
  })

  it('gives a PNG mark its type, and an address without an extension none', () => {
    expect(adminIconLinks(resolveAdminTheme({ logo: { mark: '/m.png?v=3' } }), '')[1]).toEqual({ rel: 'icon', type: 'image/png', href: '/m.png?v=3', key: 'cms-admin-icon' })
    expect(adminIconLinks(resolveAdminTheme({ logo: { mark: 'https://cdn.example.com/logo' } }), '')[1]).toEqual({ rel: 'icon', href: 'https://cdn.example.com/logo', key: 'cms-admin-icon' })
  })
})

describe('logoFileNotes', () => {
  it('says nothing about a good mark and a good full logo', () => {
    expect(logoFileNotes('mark', '/m.png', { width: 512, height: 512, vector: false })).toEqual([])
    expect(logoFileNotes('mark', '/m.svg', { width: 64, height: 66, vector: true })).toEqual([]) // within 5 %, and vector
    expect(logoFileNotes('full', '/f.png', { width: 640, height: 160, vector: false })).toEqual([])
    expect(logoFileNotes('full', '/f.svg', { width: 120, height: 30, vector: true })).toEqual([])
  })

  it('flags a missing or unreadable file', () => {
    expect(logoFileNotes('full', '/brand/l.svg', { missing: true, where: 'no file at public/brand/l.svg' })[0]!.message).toMatch(/cms\.admin\.logo\.full "\/brand\/l\.svg" was not found \(no file at public\/brand\/l\.svg\)/)
    expect(logoFileNotes('mark', '/m.txt', { unreadable: true })[0]!.message).toMatch(/not a picture/)
  })

  it('flags a mark that is not square, and small raster logos', () => {
    expect(logoFileNotes('mark', '/m.svg', { width: 100, height: 60, vector: true }).map((n) => n.message)).toEqual([expect.stringMatching(/100×60, not square/)])
    expect(logoFileNotes('markDark', '/m.png', { width: 64, height: 64, vector: false }).map((n) => n.message)).toEqual([expect.stringMatching(/64×64 px.*at least 180 px/)])
    expect(logoFileNotes('full', '/f.png', { width: 200, height: 50, vector: false }).map((n) => n.message)).toEqual([expect.stringMatching(/200 px wide.*at least 320 px/)])
    expect(logoFileNotes('mark', '/m.png', { width: 120, height: 90, vector: false })).toHaveLength(2)
    for (const n of logoFileNotes('mark', '/m.png', { width: 120, height: 90, vector: false })) expect(n.kind).toBe('logo')
  })
})

describe('checkAdminLogos: the files, as development reads them at start', () => {
  let publicDir: string
  beforeAll(async () => {
    publicDir = mkdtempSync(join(tmpdir(), 'tz-logo-'))
    mkdirSync(join(publicDir, 'brand'))
    for (const f of ['full.svg', 'mark.svg', 'mark.png', 'full-dark.svg', 'full-viewbox.svg', 'mark-viewbox.svg']) copyFileSync(join(fixtures, f), join(publicDir, 'brand', f))
    await sharp({ create: { width: 300, height: 200, channels: 4, background: '#7A3A17' } }).png().toFile(join(publicDir, 'brand', 'wide-mark.png'))
    await sharp({ create: { width: 200, height: 50, channels: 4, background: '#7A3A17' } }).png().toFile(join(publicDir, 'brand', 'small-full.png'))
  })
  afterAll(() => rmSync(publicDir, { recursive: true, force: true }))

  it('is quiet about logos drawn in outlines, and says when an SVG has text in it', async () => {
    const theme = resolveAdminTheme({ logo: { full: '/brand/full.svg', mark: '/brand/mark.png', fullDark: '/brand/full-dark.svg' } })
    // The bakery's wordmarks are set in Georgia: the PNG files would use whatever fonts the server has.
    expect((await checkAdminLogos(theme, publicDir)).map((n) => n.message)).toEqual([
      expect.stringMatching(/logo\.full "\/brand\/full\.svg" has text in it \(<text>\).*Convert the text to outlines/),
      expect.stringMatching(/logo\.fullDark "\/brand\/full-dark\.svg" has text in it/),
    ])
    expect(await checkAdminLogos(resolveAdminTheme({ logo: { mark: '/brand/mark.svg' } }), publicDir)).toEqual([])
  })

  it('reads an SVG with only a viewBox (no width or height, as design tools export it)', async () => {
    for (const f of ['full-viewbox.svg', 'mark-viewbox.svg']) {
      const svg = readFileSync(join(fixtures, f), 'utf8')
      expect(svg, f).toMatch(/<svg[^>]* viewBox="0 0 \d+ 64"/)
      expect(svg, f).not.toMatch(/<svg[^>]* (width|height)=/)
    }
    const theme = resolveAdminTheme({ logo: { full: '/brand/full-viewbox.svg', mark: '/brand/mark-viewbox.svg' } })
    // Read and measured without complaint; the only note is the wordmark's <text> (its own check).
    const notes = (await checkAdminLogos(theme, publicDir)).map((n) => n.message)
    expect(notes.filter((m) => !m.includes('has text in it'))).toEqual([])
  })

  it('reports a missing file, a mark that is not square and a small full logo (the address notes are the theme’s own)', async () => {
    const theme = resolveAdminTheme({ logo: { full: '/brand/small-full.png', mark: '/brand/wide-mark.png', markDark: '/brand/gone.svg', fullDark: 'oops.svg' } })
    const messages = (await checkAdminLogos(theme, publicDir)).map((n) => n.message)
    expect(messages).toEqual([
      expect.stringMatching(/logo\.full "\/brand\/small-full\.png" is 200 px wide/),
      expect.stringMatching(/logo\.mark "\/brand\/wide-mark\.png" is 300×200, not square/),
      expect.stringMatching(/logo\.markDark "\/brand\/gone\.svg" was not found \(no file at public\/brand\/gone\.svg\)/),
    ])
    expect(theme.notes.map((n) => n.message)).toEqual([expect.stringMatching(/logo\.fullDark "oops\.svg" is not an address/)])
  })

  it('checks each logo on its own: a % in one address never hides the notes on the others', async () => {
    const theme = resolveAdminTheme({ logo: { full: '/brand/100%.svg', mark: '/brand/wide-mark.png' } })
    const messages = (await checkAdminLogos(theme, publicDir)).map((n) => n.message)
    expect(messages).toEqual([
      expect.stringMatching(/logo\.full "\/brand\/100%\.svg" cannot be made into the PNG files.*%25/),
      expect.stringMatching(/logo\.full "\/brand\/100%\.svg" was not found \(the address is not a valid path: write a % in a file name as %25\)/),
      expect.stringMatching(/logo\.mark "\/brand\/wide-mark\.png" is 300×200, not square/),
    ])
  })

  it('says when a site path cannot be made into the PNG files (not a picture, or under /api/)', async () => {
    const theme = resolveAdminTheme({ logo: { full: '/%61pi/cms/_theme', mark: '/brand/mark' } })
    const messages = (await checkAdminLogos(theme, publicDir)).map((n) => n.message)
    expect(messages).toContainEqual(expect.stringMatching(/logo\.full "\/%61pi\/cms\/_theme" cannot be made into the PNG files \(the email logo\)/))
    expect(messages).toContainEqual(expect.stringMatching(/logo\.mark "\/brand\/mark" cannot be made into the PNG files \(the tab and home-screen icons\)/))
  })

  it('never reads outside the public folder', async () => {
    const theme = resolveAdminTheme({ logo: { markDark: '/../../etc/hosts.png', mark: '/brand/mark.svg' } })
    expect(await checkAdminLogos(theme, publicDir)).toEqual([])
  })
})

describe('CmsBrandLogo: a logo that does not load', () => {
  const bakery = resolveAdminTheme({ logo: { full: '/brand/full.svg', fullDark: '/brand/full-dark.svg', mark: '/brand/mark.svg', markDark: '/brand/mark-dark.svg' } }).logo
  const lightOnly = resolveAdminTheme({ logo: { full: '/brand/full.svg', mark: '/brand/mark.svg' } }).logo

  it('shows the theme\'s logos while all of them load', () => {
    expect(cmsShownLogo(bakery, {})).toEqual(bakery)
    expect(cmsShownLogo(lightOnly, {})).toEqual(lightOnly)
    const none = resolveAdminTheme().logo
    expect(cmsShownLogo(none, { full: true, mark: true })).toEqual(none)
  })

  it('keeps the light logo when only its dark version is broken, on the cream tile in dark mode', () => {
    // logo { full, fullDark: a typo, mark }: the dark file is a 404 even in light mode (hidden images load too).
    const theme = resolveAdminTheme({ logo: { full: '/brand/full.svg', fullDark: '/brand/typo.svg', mark: '/brand/mark.svg' } }).logo
    const shown = cmsShownLogo(theme, { fullDark: true })
    expect(shown).toMatchObject({ full: '/brand/full.svg', fullDark: '/brand/full.svg', fullDarkPlate: true, mark: '/brand/mark.svg', markDarkPlate: true })
    expect(adminBrandLockup({ logo: shown }, false, 'wide')).toBe('full')
    expect(cmsShownLogo(bakery, { markDark: true })).toMatchObject({ mark: '/brand/mark.svg', markDark: '/brand/mark.svg', markDarkPlate: true, fullDark: '/brand/full-dark.svg', fullDarkPlate: false })
  })

  it('lets a broken light logo give way to the next one in both modes, as before', () => {
    const noFull = cmsShownLogo(bakery, { full: true })
    expect(noFull).toMatchObject({ full: null, fullDark: null, fullDarkPlate: false, mark: '/brand/mark.svg', markDark: '/brand/mark-dark.svg' })
    expect(adminBrandLockup({ logo: noFull }, false, 'wide')).toBe('mark')
    const noMark = cmsShownLogo(bakery, { mark: true })
    expect(noMark).toMatchObject({ mark: null, markDark: null, markDarkPlate: false })
    expect(adminBrandLockup({ logo: noMark }, false, 'compact')).toBe('initials')
    expect(adminBrandLockup({ logo: cmsShownLogo(bakery, { full: true, fullDark: true, mark: true, markDark: true }) }, false, 'wide')).toBe('initials')
  })

  // A server-rendered <img> that already finished before hydration: complete, and its natural
  // width says nothing (an SVG with only a viewBox can report 0 and still be on screen).
  const img = (logo: string, opts: { loaded: boolean; complete?: boolean; src?: string | null }): CmsLogoImage & { naturalWidth: number } => ({
    complete: opts.complete ?? true,
    naturalWidth: 0,
    dataset: { logo },
    getAttribute: (name) => (name === 'src' ? (opts.src === undefined ? `/brand/${logo}.svg` : opts.src) : null),
    decode: () => (opts.loaded ? Promise.resolve() : Promise.reject(new DOMException('The source image cannot be decoded.', 'EncodingError'))),
  })

  it('does not take an SVG without a natural size for a failed load', async () => {
    expect(await cmsFailedLogos([img('full', { loaded: true }), img('mark', { loaded: true }), img('fullDark', { loaded: true }), img('markDark', { loaded: true })])).toEqual([])
  })

  it('finds the images that failed before the page came alive, by slot', async () => {
    expect(await cmsFailedLogos([img('full', { loaded: true }), img('fullDark', { loaded: false }), img('mark', { loaded: true })])).toEqual(['fullDark'])
    expect(await cmsFailedLogos([img('full', { loaded: false }), img('markDark', { loaded: false })])).toEqual(['full', 'markDark'])
  })

  it('leaves images still loading to their own error event, and images without an address alone', async () => {
    expect(await cmsFailedLogos([img('full', { loaded: false, complete: false }), img('mark', { loaded: false, src: null })])).toEqual([])
    expect(await cmsFailedLogos([])).toEqual([])
  })

  it('marks each <img> with the slot whose file it shows', () => {
    const vue = readFileSync(join(import.meta.dirname, '../../packages/cms/app/components/CmsBrandLogo.vue'), 'utf8')
    const imgs = [...vue.matchAll(/<img\b[^>]*>/g)].map((m) => m[0])
    expect(imgs).toHaveLength(6)
    for (const tag of imgs) {
      const slot = /data-logo="(\w+)"/.exec(tag)?.[1]
      const src = /:src="logo\.(\w+)!"/.exec(tag)?.[1]
      const failed = /@error="fail\('(\w+)'\)"/.exec(tag)?.[1]
      expect(slot, tag).toBe(src)
      expect(failed, tag).toBe(slot)
    }
    expect(imgs.filter((t) => t.includes('data-logo="fullDark"'))).toHaveLength(1)
    expect(imgs.filter((t) => t.includes('data-logo="markDark"'))).toHaveLength(1)
    expect(vue).not.toMatch(/naturalWidth/)
  })

  it('keeps the sign-in page\'s initials tile as drawn before 0.7 (leading-none only in the sidebar)', () => {
    const vue = readFileSync(join(import.meta.dirname, '../../packages/cms/app/components/CmsBrandLogo.vue'), 'utf8')
    const tile = /v-else-if="lockup === 'initials'"[\s\S]*?>\{\{ initials \}\}/.exec(vue)?.[0] ?? ''
    expect(tile).toContain(`:class="auth ? 'size-6 rounded-md text-[0.625rem]' : 'size-7 rounded-lg text-xs leading-none'"`)
    expect(/\bclass="([^"]*)"/.exec(tile)?.[1]).not.toContain('leading-none')
  })
})
