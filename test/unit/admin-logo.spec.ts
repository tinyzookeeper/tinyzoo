import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from '../../packages/cms/node_modules/sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminBrandLockup, adminIconLinks, brandFileUrl, brandInitials, CMS_ADMIN_MANIFEST_URL, logoAddressKind, logoFileNotes, resolveAdminTheme } from 'tinyzoo'
import { checkAdminLogos } from '../../packages/cms/server/utils/cmsLogoCheck'

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
    expect(links[0]!.href).toMatch(/^\/api\/cms\/_brand\/mark-32\.png\?v=/)
    expect(CMS_ADMIN_MANIFEST_URL).toBe('/api/cms/_brand/admin.webmanifest')
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
    for (const f of ['full.svg', 'mark.svg', 'mark.png', 'full-dark.svg']) copyFileSync(join(fixtures, f), join(publicDir, 'brand', f))
    await sharp({ create: { width: 300, height: 200, channels: 4, background: '#7A3A17' } }).png().toFile(join(publicDir, 'brand', 'wide-mark.png'))
    await sharp({ create: { width: 200, height: 50, channels: 4, background: '#7A3A17' } }).png().toFile(join(publicDir, 'brand', 'small-full.png'))
  })
  afterAll(() => rmSync(publicDir, { recursive: true, force: true }))

  it('is quiet about the bakery fixtures', async () => {
    const theme = resolveAdminTheme({ logo: { full: '/brand/full.svg', mark: '/brand/mark.png', fullDark: '/brand/full-dark.svg' } })
    expect(await checkAdminLogos(theme, publicDir)).toEqual([])
    expect(await checkAdminLogos(resolveAdminTheme({ logo: { mark: '/brand/mark.svg' } }), publicDir)).toEqual([])
  })

  it('reports a missing file, a mark that is not square and a small full logo, with the address notes', async () => {
    const theme = resolveAdminTheme({ logo: { full: '/brand/small-full.png', mark: '/brand/wide-mark.png', markDark: '/brand/gone.svg', fullDark: 'oops.svg' } })
    const messages = (await checkAdminLogos(theme, publicDir)).map((n) => n.message)
    expect(messages).toEqual([
      expect.stringMatching(/logo\.fullDark "oops\.svg" is not an address/),
      expect.stringMatching(/logo\.full "\/brand\/small-full\.png" is 200 px wide/),
      expect.stringMatching(/logo\.mark "\/brand\/wide-mark\.png" is 300×200, not square/),
      expect.stringMatching(/logo\.markDark "\/brand\/gone\.svg" was not found \(no file at public\/brand\/gone\.svg\)/),
    ])
  })

  it('never reads outside the public folder', async () => {
    const theme = resolveAdminTheme({ logo: { mark: '/../../etc/hosts' } })
    expect(await checkAdminLogos(theme, publicDir)).toEqual([])
  })
})
