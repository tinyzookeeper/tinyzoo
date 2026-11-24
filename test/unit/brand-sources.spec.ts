import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminIconLinks, brandFileUrl } from 'tinyzoo'
import { BRAND_SOURCE_MAX_BYTES, TINYZOO_MARK_SVG, brandFileVersion } from '../../packages/cms/server/utils/cmsBrandFiles'

// Where the logo files' bytes come from and how long they are kept (server/utils/cmsBrandSource.ts),
// and the theme seam that hands out their versions (cmsAdminSettings). The version is the
// file's own bytes, so a logo replaced under the same address is a new address for every
// cache; development reads the site's public/ folder on disk; a mark that cannot be read
// leaves tinyzoo's own icons, never broken ones.

const remote = vi.hoisted(() => ({ fetchRemoteLogo: vi.fn() }))
vi.mock('../../packages/cms/server/utils/cmsRemoteLogo', async (original) => ({ ...(await original<object>()), fetchRemoteLogo: remote.fetchRemoteLogo }))

const root = join(import.meta.dirname, '../..')
const sharp = createRequire(join(root, 'packages/cms/package.json'))('sharp') as (input: Buffer) => any
const fixtures = join(root, 'test/fixtures/brand')
const file = (name: string) => readFileSync(join(fixtures, name))

// Loaded by path at run time: they use Nitro's auto-imports, which the root type-check does not
// know (the playground's nuxt typecheck checks the module itself); stubbed here.
const SOURCES = '../../packages/cms/server/utils/cmsBrandSource'
const SEAM = '../../packages/cms/server/utils/cmsAdminTheme'
let sources: any
let seam: any
beforeAll(async () => {
  sources = await import(/* @vite-ignore */ SOURCES)
  seam = await import(/* @vite-ignore */ SEAM)
})

let admin: Record<string, any>
let runtime: Record<string, any>
const fetched: string[] = []
const fakeFetch = { raw: async (path: string) => {
  fetched.push(path)
  const name = ({ '/brand/full.svg': 'full.svg', '/brand/mark.svg': 'mark.svg', '/brand/my%20mark.svg': 'mark.svg' } as Record<string, string>)[path]
  return name
    ? { status: 200, headers: new Headers({ 'content-type': 'image/svg+xml' }), _data: file(name) }
    : { status: 404, headers: new Headers({ 'content-type': 'text/html' }), _data: null }
} }
let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  admin = {}
  runtime = { cms: {} }
  fetched.length = 0
  remote.fetchRemoteLogo.mockReset()
  vi.stubGlobal('useAppConfig', () => ({ cms: { admin: { ...admin } } }))
  vi.stubGlobal('useRuntimeConfig', () => runtime)
  vi.stubGlobal('$fetch', fakeFetch)
  sources.resetBrandSources()
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  warn.mockRestore()
})

const EVENT = { path: '/admin' }

describe('the theme seam', () => {
  it('fills in the files’ versions from the logos’ bytes, and the default language', async () => {
    admin = { name: 'Pekárna Novák', defaultLocale: 'cs', logo: { full: '/brand/full.svg', mark: '/brand/mark.svg' } }
    const { theme, defaultLocale } = await seam.cmsAdminSettings(EVENT)
    expect(defaultLocale).toBe('cs')
    expect(theme.logo.files).toEqual({ full: brandFileVersion(file('full.svg')), mark: brandFileVersion(file('mark.svg')), markFallback: false })
    expect(brandFileUrl('mark-180.png', theme)).toBe(`/api/cms/_brand/mark-180.png?v=${brandFileVersion(file('mark.svg'))}`)
    expect((await seam.cmsAdminTheme(EVENT)).logo.files).toEqual(theme.logo.files)
  })

  it('without logos: no email logo, tinyzoo’s mark for the icons, English by default', async () => {
    const { theme, defaultLocale } = await seam.cmsAdminSettings()
    expect(defaultLocale).toBe('en')
    expect(theme.logo.files).toEqual({ full: null, mark: brandFileVersion(TINYZOO_MARK_SVG), markFallback: true })
    expect(fetched).toEqual([])
  })

  it('the same file under two addresses has one version; the address is not part of it', async () => {
    admin = { logo: { full: '/brand/mark.svg', mark: '/brand/my%20mark.svg' } }
    const { theme } = await seam.cmsAdminSettings()
    expect(theme.logo.files!.full).toBe(theme.logo.files!.mark)
    expect(fetched).toContain('/brand/my%20mark.svg') // decoded, checked, encoded again for the request
  })

  it('a site path is decoded before it is read: /%61pi/… is /api/… and is never requested', async () => {
    admin = { logo: { full: '/%61pi/cms/_theme', mark: '/brand/%2e%2e/%2e%2e/secret.svg' } }
    const { theme } = await seam.cmsAdminSettings()
    expect(fetched).toEqual([])
    expect(theme.logo.files).toMatchObject({ full: null, markFallback: true })
    expect(warn.mock.calls.map((c: unknown[]) => String(c[0]))).toEqual([
      expect.stringMatching(/"\/%61pi\/cms\/_theme" \(cms\.admin\.logo\) cannot be read: it is neither a picture on this site/),
      expect.stringMatching(/"\/brand\/%2e%2e\/%2e%2e\/secret\.svg" \(cms\.admin\.logo\) cannot be read/),
    ])
  })
})

describe('the name from the site’s content (cms.admin.nameFrom)', () => {
  const table = { siteName: 'col:siteName', createdAt: 'col:createdAt' }
  let rows: Array<Record<string, unknown>>
  let reads: number
  const stubCms = (entity: Record<string, unknown> | undefined = { singleton: true, table }) => {
    const query = { from: () => query, orderBy: () => query, limit: async () => { reads++; return rows } }
    vi.stubGlobal('useCms', () => ({ db: { select: () => query }, reg: { byName: new Map(entity ? [['siteSettings', entity]] : []) } }))
  }
  beforeEach(() => {
    rows = [{ value: 'Johana Loudová' }]
    reads = 0
    seam.resetAdminName()
    stubCms()
  })

  it('a site that does not opt in keeps cms.admin.name and never reads the content', async () => {
    admin = { name: 'Můj web' }
    expect((await seam.cmsAdminTheme(EVENT)).name).toBe('Můj web')
    expect(reads).toBe(0)
  })

  it('takes the name from the global’s field, and keeps it for a moment', async () => {
    admin = { name: 'Můj web', nameFrom: 'siteSettings.siteName' }
    expect((await seam.cmsAdminTheme(EVENT)).name).toBe('Johana Loudová')
    expect((await seam.cmsAdminSettings(EVENT)).theme.name).toBe('Johana Loudová')
    expect(reads).toBe(1)
  })

  it('reads again after a save (resetAdminName) and after a few seconds', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-23T10:00:00Z'), toFake: ['Date'] })
    admin = { name: 'Můj web', nameFrom: 'siteSettings.siteName' }
    await seam.cmsAdminTheme(EVENT)
    rows = [{ value: '  Ateliér Loudová ' }]
    seam.resetAdminName()
    expect((await seam.cmsAdminTheme(EVENT)).name).toBe('Ateliér Loudová')
    rows = [{ value: 'Foto Loudová' }]
    expect((await seam.cmsAdminTheme(EVENT)).name).toBe('Ateliér Loudová')
    vi.setSystemTime(new Date('2026-11-23T10:00:04Z'))
    expect((await seam.cmsAdminTheme(EVENT)).name).toBe('Foto Loudová')
  })

  it('falls back to cms.admin.name: an empty field, no row yet, an unknown global or field, a database that cannot be reached', async () => {
    admin = { name: 'Můj web', nameFrom: 'siteSettings.siteName' }
    for (const stored of [[{ value: '   ' }], [{ value: null }], []]) {
      rows = stored
      seam.resetAdminName()
      expect((await seam.cmsAdminTheme(EVENT)).name, JSON.stringify(stored)).toBe('Můj web')
    }
    rows = [{ value: 'Johana Loudová' }]
    for (const from of ['settings.siteName', 'siteSettings.title', 'siteName', 42]) {
      admin = { name: 'Můj web', nameFrom: from }
      seam.resetAdminName()
      expect((await seam.cmsAdminTheme(EVENT)).name, String(from)).toBe('Můj web')
    }
    admin = { name: 'Můj web', nameFrom: 'siteSettings.siteName' }
    stubCms({ singleton: false, table }) // a collection is not a global
    seam.resetAdminName()
    expect((await seam.cmsAdminTheme(EVENT)).name).toBe('Můj web')
    vi.stubGlobal('useCms', () => { throw new Error('No database address') })
    seam.resetAdminName()
    expect((await seam.cmsAdminTheme(EVENT)).name).toBe('Můj web')
  })
})

describe('a mark that cannot be read', () => {
  it('leaves tinyzoo’s mark in every icon file, with one log line, and no broken tab icon', async () => {
    admin = { name: 'Pekárna Novák', logo: { mark: '/brand/gone.svg' } }
    const theme = await seam.cmsAdminTheme(EVENT)
    expect(theme.logo.files).toEqual({ full: null, mark: brandFileVersion(TINYZOO_MARK_SVG), markFallback: true })
    for (const name of ['mark-32.png', 'mark-180.png', 'mark-192.png', 'mark-512.png'] as const) {
      const made = await sources.brandFilePng(name, theme)
      expect(made, name).not.toBeNull()
      expect(made!.version, name).toBe(theme.logo.files!.mark) // the version the address carries: may be kept for good
      const size = Number(/\d+/.exec(name)![0])
      expect(await sharp(made!.png).metadata(), name).toMatchObject({ format: 'png', width: size, height: size })
    }
    expect(await sources.brandFilePng('full-email.png', theme)).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toMatch(/"\/brand\/gone\.svg".*cannot be read: the site has no file at \/brand\/gone\.svg.*tab and home-screen icons are tinyzoo’s mark/)
    // The admin's head then links tinyzoo's icon only (no 404s for the SVG, the PNGs or the manifest).
    expect(adminIconLinks(theme, '/_nuxt/favicon.svg')).toEqual([{ rel: 'icon', type: 'image/svg+xml', href: '/_nuxt/favicon.svg', key: 'cms-admin-icon' }])
  })

  it('a mark that is not a picture counts as one that cannot be read', async () => {
    remote.fetchRemoteLogo.mockResolvedValue(Buffer.from('<html>not a logo</html>'))
    admin = { logo: { mark: 'https://cdn.example/mark.svg' } }
    const theme = await seam.cmsAdminTheme()
    expect(theme.logo.files).toMatchObject({ markFallback: true })
    expect(String(warn.mock.calls[0]![0])).toMatch(/it is not a picture tinyzoo can read/)
  })
})

describe('reading again', () => {
  it('an https logo changed at the same URL gets a new version within 15 minutes, read in the background', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-18T10:00:00Z'), toFake: ['Date'] })
    remote.fetchRemoteLogo.mockResolvedValue(file('mark.svg'))
    admin = { logo: { mark: 'https://cdn.example/mark.svg' } }
    const v1 = (await seam.cmsAdminTheme()).logo.files!.mark
    expect(v1).toBe(brandFileVersion(file('mark.svg')))
    expect(remote.fetchRemoteLogo).toHaveBeenCalledWith('https://cdn.example/mark.svg', { timeoutMs: 5000, maxBytes: BRAND_SOURCE_MAX_BYTES })

    remote.fetchRemoteLogo.mockResolvedValue(file('mark-dark.svg'))
    vi.setSystemTime(new Date('2026-11-18T10:14:00Z'))
    expect((await seam.cmsAdminTheme()).logo.files!.mark).toBe(v1) // not read again yet
    expect(remote.fetchRemoteLogo).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-11-18T10:15:01Z'))
    expect((await seam.cmsAdminTheme()).logo.files!.mark).toBe(v1) // the old copy while the new one loads
    await vi.waitFor(async () => expect((await seam.cmsAdminTheme()).logo.files!.mark).toBe(brandFileVersion(file('mark-dark.svg'))))
    expect(remote.fetchRemoteLogo).toHaveBeenCalledTimes(2)
  })

  it('keeps the last good copy when reading again fails (a network blip does not swap the icons)', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-18T10:00:00Z'), toFake: ['Date'] })
    remote.fetchRemoteLogo.mockResolvedValue(file('mark.svg'))
    admin = { logo: { mark: 'https://cdn.example/mark.svg' } }
    const v1 = (await seam.cmsAdminTheme()).logo.files!.mark
    remote.fetchRemoteLogo.mockRejectedValue(new Error('the server answered 503'))
    vi.setSystemTime(new Date('2026-11-18T10:20:00Z'))
    await seam.cmsAdminTheme()
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1))
    expect(String(warn.mock.calls[0]![0])).toMatch(/the server answered 503\. The last good copy is used until it can\./)
    expect((await seam.cmsAdminTheme()).logo.files).toEqual({ full: null, mark: v1, markFallback: false })
  })

  it('makes each PNG once per version of the logo', async () => {
    admin = { logo: { mark: '/brand/mark.svg' } }
    const theme = await seam.cmsAdminTheme()
    const a = await sources.brandFilePng('mark-192.png', theme)
    const b = await sources.brandFilePng('mark-192.png', theme)
    expect(a!.png).toBe(b!.png) // the same buffer: drawn once
    expect(a!.version).toBe(brandFileVersion(file('mark.svg')))
  })
})

describe('development', () => {
  it('reads a site logo from the public folder on disk, not over HTTP from whatever host the request named', async () => {
    runtime = { cms: { devPublicDir: join(root, 'test/fixtures') } }
    admin = { logo: { full: '/brand/full.svg', mark: '/brand/mark.png' } }
    const { theme } = await seam.cmsAdminSettings({ path: '/admin', headers: { host: 'attacker.example' } })
    expect(fetched).toEqual([])
    expect(theme.logo.files).toEqual({ full: brandFileVersion(file('full.svg')), mark: brandFileVersion(file('mark.png')), markFallback: false })
  })

  it('says which file is missing, and never reads outside the folder', async () => {
    runtime = { cms: { devPublicDir: join(root, 'test/fixtures/brand') } }
    admin = { logo: { full: '/missing.svg', mark: '/../brand-mail/mark.svg' } }
    const { theme } = await seam.cmsAdminSettings()
    expect(theme.logo.files).toMatchObject({ full: null, markFallback: true })
    expect(warn.mock.calls.map((c: unknown[]) => String(c[0])).sort()).toEqual([
      expect.stringMatching(/"\/\.\.\/brand-mail\/mark\.svg" \(cms\.admin\.logo\) cannot be read: it is neither a picture on this site/),
      expect.stringMatching(/"\/missing\.svg" \(cms\.admin\.logo\) cannot be read: there is no file public\/missing\.svg/),
    ])
  })
})
