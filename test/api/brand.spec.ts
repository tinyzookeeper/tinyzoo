import { createRequire } from 'node:module'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { brandFileUrl, resolveAdminTheme, type CmsAdminTheme } from 'tinyzoo'
import { anonymous, signIn, waitForMail } from '../helpers/api'

// GET /api/cms/_brand/<file> on the built playground, which has no logo (the demo stays
// unbranded): the mark files are tinyzoo's own mark, there is no email logo, and the
// manifest names the admin. The drawing itself is test/unit/brand-files.spec.ts; a branded
// production build was checked by hand (docs/roadmap.md, 0.7 E).

const sharp = createRequire(join(import.meta.dirname, '../../packages/cms/package.json'))('sharp') as (input: Buffer) => any
const base = () => anonymous().baseURL
/** The theme the server hands the admin: with the files' versions it filled in. */
const served = async (): Promise<CmsAdminTheme> => (await anonymous().get('/api/cms/_theme')).body
let theme: CmsAdminTheme
beforeAll(async () => {
  theme = await served()
})
/** The address the admin links (the playground has no logo: tinyzoo's mark, with its version). */
const current = (file: Parameters<typeof brandFileUrl>[0]) => brandFileUrl(file, theme)

describe('the PNG files without a logo', () => {
  it('mark-180.png is tinyzoo’s mark, 180 × 180 and opaque, without a session', async () => {
    const res = await fetch(base() + current('mark-180.png'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta).toMatchObject({ format: 'png', width: 180, height: 180, hasAlpha: false })
  })

  it.each(['mark-32.png', 'mark-192.png', 'mark-512.png'] as const)('%s is square on transparent', async (file) => {
    const res = await fetch(base() + current(file))
    expect(res.status).toBe(200)
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    const size = Number(/\d+/.exec(file)![0])
    expect(meta).toMatchObject({ width: size, height: size, hasAlpha: true })
  })

  it('full-email.png is 404: without a full logo the emails show the site’s name', async () => {
    const res = await fetch(base() + current('full-email.png'))
    expect(res.status).toBe(404)
  })

  it('anything else is 404, and no address can be asked for', async () => {
    for (const path of ['/api/cms/_brand/logo.svg', '/api/cms/_brand/mark-64.png', '/api/cms/_brand/..%2F_theme', '/api/cms/_brand/mark-32.png.map'])
      expect((await fetch(base() + path)).status, path).toBe(404)
  })
})

describe('caching', () => {
  it('the theme carries the files’ versions: tinyzoo’s own mark, a hash of its bytes', async () => {
    expect(theme.logo.files).toEqual({ full: null, mark: expect.stringMatching(/^[\w-]{16}$/), markFallback: true })
    expect(current('mark-32.png')).toBe(`/api/cms/_brand/mark-32.png?v=${theme.logo.files!.mark}`)
  })

  it('keeps a file for a year with the current version, briefly without it or with an old one', async () => {
    const long = await fetch(base() + current('mark-32.png'))
    expect(long.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    // `v` was a hash of the logo's address before (an empty one here): no longer a version.
    const addressHash = (2166136261).toString(36)
    for (const path of ['/api/cms/_brand/mark-32.png', '/api/cms/_brand/mark-32.png?v=old', `/api/cms/_brand/mark-32.png?v=${addressHash}`]) {
      const res = await fetch(base() + path)
      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control'), path).toBe('public, max-age=300')
    }
  })

  it('never caches a 404', async () => {
    const res = await fetch(base() + current('full-email.png'))
    expect(res.headers.get('cache-control')).not.toMatch(/max-age=[1-9]/)
  })
})

describe('the admin’s web manifest', () => {
  it('is JSON with the manifest content type, named in the admin’s default language, opening /admin', async () => {
    const res = await fetch(`${base()}/api/cms/_brand/admin.webmanifest`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^application\/manifest\+json/)
    const m = await res.json()
    // The playground's admin is "Demo blog" in Czech, its default language.
    expect(m).toMatchObject({ name: 'Demo blog', short_name: 'Demo blog', lang: 'cs', start_url: '/admin/', scope: '/admin/', display: 'standalone' })
    expect(m.theme_color).toMatch(/^#[0-9A-F]{6}$/i)
    expect(m.icons.map((i: any) => [i.src, i.sizes, i.type])).toEqual([
      [current('mark-192.png'), '192x192', 'image/png'],
      [current('mark-512.png'), '512x512', 'image/png'],
    ])
    for (const icon of m.icons) {
      const png = await fetch(base() + icon.src)
      expect(png.status).toBe(200)
      expect(png.headers.get('cache-control')).toContain('immutable')
    }
  })
})

describe('the emails', () => {
  it('show the site’s name at the top when there is no logo, and the button in tinyzoo’s charcoal', async () => {
    const admin = await signIn('admin')
    const to = `brand-${Date.now().toString(36)}@test.local`
    const res = await admin.request('POST', '/api/cms/_users', { json: { email: to, role: 'editor' }, headers: { 'accept-language': 'en' } })
    expect(res.status).toBe(201)
    const mail = await waitForMail(to)
    expect(mail.html).toContain('font-weight:700;color:#171717">Demo Blog</p>')
    expect(mail.html).not.toContain('<img')
    const theme = resolveAdminTheme()
    expect(mail.html).toContain(`background:${theme.accent.light.primary};color:${theme.accent.light.onPrimary};`)
  })
})
