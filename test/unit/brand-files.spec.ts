import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CMS_BRAND_FILES, brandFileUrl, resolveAdminTheme } from 'tinyzoo'
import { BRAND_RENDER_VERSION, EMAIL_LOGO_MAX_HEIGHT, EMAIL_LOGO_WIDTH, TINYZOO_MARK_SVG, adminWebManifest, brandFileCacheControl, brandFileSource, brandFileVersion, brandSourcePath, isBrandSourceAddress, publicFilePath, renderBrandFile, svgHasText } from '../../packages/cms/server/utils/cmsBrandFiles'

// The PNG versions of the client's logo (GET /api/cms/_brand/<file>) as a pure function:
// a logo's bytes in, a PNG out. The route and the caching are covered in test/api/brand.spec.ts.

const root = join(import.meta.dirname, '../..')
// sharp is tinyzoo's dependency, not the workspace root's.
const sharp = createRequire(join(root, 'packages/cms/package.json'))('sharp') as (input: Buffer) => any
const fixture = (name: string) => readFileSync(join(root, 'test/fixtures/brand-mail', name))

async function info(png: Buffer) {
  const meta = await sharp(png).metadata()
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3]!
  return { format: meta.format, width: meta.width!, height: meta.height!, hasAlpha: meta.hasAlpha, alphaAt }
}

describe('the mark files', () => {
  it.each([32, 192, 512])('mark-%i.png is that size, square, on transparent', async (size) => {
    const png = await renderBrandFile(`mark-${size}.png` as any, fixture('mark.svg'))
    const out = await info(png)
    expect(out).toMatchObject({ format: 'png', width: size, height: size, hasAlpha: true })
    expect(out.alphaAt(0, 0)).toBe(0) // the corner is outside the round mark
    expect(out.alphaAt(size / 2, size / 2)).toBe(255) // the middle is the mark
  })

  it('draws an SVG crisp at 512 px (rendered at that size, not scaled up from its own 64 px)', async () => {
    const out = await info(await renderBrandFile('mark-512.png', fixture('mark.svg')))
    // A scaled-up 64 px circle has a soft edge several pixels wide; a rendered one is about one pixel.
    let soft = 0
    for (let x = 0; x < 512; x++) {
      const a = out.alphaAt(x, 256)
      if (a > 0 && a < 255) soft++
    }
    expect(soft).toBeLessThanOrEqual(4)
  })

  it('centres a mark that is not square, with transparent bands', async () => {
    const out = await info(await renderBrandFile('mark-192.png', fixture('wide-mark.png')))
    expect([out.width, out.height]).toEqual([192, 192])
    expect(out.alphaAt(96, 10)).toBe(0) // above the 2:1 mark
    expect(out.alphaAt(96, 96)).toBe(255)
    expect(out.alphaAt(96, 181)).toBe(0) // below it
  })

  it('mark-180.png (the apple-touch-icon) is opaque, white around the mark', async () => {
    const png = await renderBrandFile('mark-180.png', fixture('mark.svg'))
    const meta = await sharp(png).metadata()
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([180, 180, false])
    const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
    expect([...data.subarray(0, 3)]).toEqual([255, 255, 255]) // the padded corner is white
    const mid = (90 * 180 + 30) * 3 // inside the mark, left of the bread
    expect([...data.subarray(mid, mid + 3)]).toEqual([0xB4, 0x53, 0x2A])
  })

  it('tinyzoo’s own mark (no client mark) renders too, and is the one in the admin’s assets', async () => {
    expect(TINYZOO_MARK_SVG).toBe(readFileSync(join(root, 'packages/cms/app/assets/brand/logo/mascot.svg'), 'utf8').trim())
    const out = await info(await renderBrandFile('mark-180.png', Buffer.from(TINYZOO_MARK_SVG)))
    expect([out.width, out.height]).toEqual([180, 180])
  })
})

describe('full-email.png', () => {
  it('is 320 px wide on transparent, as tall as the logo’s proportions give', async () => {
    const out = await info(await renderBrandFile('full-email.png', fixture('full.svg')))
    expect(out).toMatchObject({ format: 'png', width: EMAIL_LOGO_WIDTH, height: 80, hasAlpha: true })
    expect(out.alphaAt(73, 40)).toBe(0) // between the two shapes (x 64–83 after the 1.6× scale)
    expect(out.alphaAt(30, 40)).toBe(255)
  })

  it('caps the height at 120 px: a tall logo is drawn smaller and sits at the left of the 320 px', async () => {
    const out = await info(await renderBrandFile('full-email.png', fixture('tall-full.png')))
    expect([out.width, out.height]).toEqual([EMAIL_LOGO_WIDTH, EMAIL_LOGO_MAX_HEIGHT])
    expect(out.alphaAt(10, 60)).toBe(255) // the 60 × 120 logo at the left
    expect(out.alphaAt(200, 60)).toBe(0) // transparent to the right of it
  })
})

describe('a logo that is not an image', () => {
  it('throws (the route answers 404 and logs it once)', async () => {
    await expect(renderBrandFile('mark-32.png', fixture('broken.png'))).rejects.toThrow()
    await expect(renderBrandFile('full-email.png', Buffer.from('<svg'))).rejects.toThrow()
  })
})

describe('which logo a file comes from', () => {
  const theme = resolveAdminTheme({ logo: { full: '/brand/logo.svg', mark: 'https://cdn.example.test/mark.png' } })

  it('the full logo for the email, the mark for the icons', () => {
    expect(brandFileSource('full-email.png', theme)).toBe('/brand/logo.svg')
    for (const file of CMS_BRAND_FILES.filter((f) => f.startsWith('mark'))) expect(brandFileSource(file, theme)).toBe('https://cdn.example.test/mark.png')
    expect(brandFileSource('full-email.png', resolveAdminTheme())).toBeNull()
  })

  it('the version is a hash of the logo’s bytes and of how tinyzoo draws them, not of its address', () => {
    const bytes = fixture('mark.svg')
    expect(brandFileVersion(bytes)).toBe(brandFileVersion(Buffer.from(bytes))) // the same file, wherever it is
    expect(brandFileVersion(Buffer.concat([bytes, Buffer.from(' ')]))).not.toBe(brandFileVersion(bytes)) // one byte more: a new version
    expect(brandFileVersion(bytes)).toBe(createHash('sha256').update(`tinyzoo-brand-${BRAND_RENDER_VERSION}\0`).update(bytes).digest('base64url').slice(0, 16))
    expect(brandFileVersion(bytes)).toMatch(/^[\w-]{16}$/)
  })

  it('the address carries the version the server filled in, and none without it', () => {
    const files = { full: 'fullV1', mark: 'markV1', markFallback: false }
    const filled = { ...theme, logo: { ...theme.logo, files } }
    expect(brandFileUrl('mark-180.png', filled)).toBe('/api/cms/_brand/mark-180.png?v=markV1')
    expect(brandFileUrl('full-email.png', filled)).toBe('/api/cms/_brand/full-email.png?v=fullV1')
    // Resolved without reading the files (the browser's fallback): no version, so nothing may cache it for good.
    expect(brandFileUrl('mark-180.png', theme)).toBe('/api/cms/_brand/mark-180.png')
  })

  it('a year only for the version of the file sent, never in development', () => {
    expect(brandFileCacheControl({ dev: false, asked: 'abc', version: 'abc' })).toBe('public, max-age=31536000, immutable')
    expect(brandFileCacheControl({ dev: false, asked: 'old', version: 'abc' })).toBe('public, max-age=300')
    expect(brandFileCacheControl({ dev: false, asked: undefined, version: 'abc' })).toBe('public, max-age=300')
    expect(brandFileCacheControl({ dev: false, asked: ['abc', 'abc'], version: 'abc' })).toBe('public, max-age=300')
    expect(brandFileCacheControl({ dev: true, asked: 'abc', version: 'abc' })).toBe('no-cache')
  })

  it('reads only a path on the site or an https:// URL', () => {
    for (const ok of ['/brand/logo.svg', '/logo.png?x=1', 'https://cdn.example.test/logo.svg']) expect(isBrandSourceAddress(ok), ok).toBe(true)
    for (const bad of ['//evil.test/logo.svg', '/\\evil.test', 'http://cdn.example.test/logo.svg', 'file:///etc/passwd', 'logo.svg', '/api/cms/_brand/mark-32.png', '/API/cms/_theme', '/brand/../secret', 'https://', 'data:image/png;base64,AAAA'])
      expect(isBrandSourceAddress(bad), bad).toBe(false)
  })

  it('decodes a site path before checking it: no /api/ in disguise, no .., pictures only', () => {
    expect(brandSourcePath('/brand/logo%20new.svg?v=2#x')).toBe('/brand/logo new.svg')
    expect(brandSourcePath('/brand/Logo.PNG')).toBe('/brand/Logo.PNG')
    for (const ext of ['svg', 'png', 'webp', 'jpg', 'jpeg', 'avif']) expect(brandSourcePath(`/b/l.${ext}`), ext).toBe(`/b/l.${ext}`)
    for (const bad of [
      '/%61pi/cms/_theme', '/%61pi/cms/_brand/mark-32.png', '/%41PI/x.png', // /api/ percent-encoded
      '/%2561pi/x.png', '/brand/%252e%252e/x.png', // encoded twice
      '/brand/%2e%2e/%2e%2e/etc/x.png', '/brand/%2E%2E%2Fsecret.png', '/brand/./x.png', '/brand//x.png', // dots and empty segments
      '/brand%5c..%5cx.png', '/brand/x%00.png', // a backslash, a NUL
      '/brand/100%.svg', // a % that is not an encoding: decoding fails
      '/brand/logo', '/brand/logo.svg.txt', '/brand/logo.html', '/favicon.ico', '/api', // not a picture
    ]) expect(brandSourcePath(bad), bad).toBeNull()
  })

  it('finds a site path’s file only inside the public folder', () => {
    expect(publicFilePath('/srv/site/public', '/brand/logo.svg')).toBe(join('/srv/site/public', 'brand/logo.svg'))
    expect(publicFilePath('/srv/site/public', '/../secret.png')).toBeNull()
    expect(publicFilePath('/srv/site/public', '/')).toBeNull()
    expect(publicFilePath('', '/brand/logo.svg')).toBeNull()
  })

  it('tells an SVG with text from one with outlines', () => {
    expect(svgHasText(Buffer.from('<svg><text x="0">Pekárna</text></svg>'))).toBe(true)
    expect(svgHasText(Buffer.from('<svg:svg><svg:text>A</svg:text></svg:svg>'))).toBe(true)
    expect(svgHasText(Buffer.from('<svg><path d="M0 0"/><textPath/></svg>'))).toBe(false) // a textPath only inside a text
    expect(svgHasText(fixture('mark.svg'))).toBe(false)
  })
})

describe('the admin’s web manifest', () => {
  it('names the admin, opens /admin standalone, and lists the 192 and 512 icons with their version', () => {
    const theme = resolveAdminTheme({ name: { cs: 'Pekárna Novák', en: 'Novák Bakery' }, logo: { mark: '/brand/mark.svg' } })
    const m = adminWebManifest(theme, 'cs')
    expect(m).toMatchObject({ name: 'Pekárna Novák', short_name: 'Pekárna', lang: 'cs', start_url: '/admin/', scope: '/admin/', display: 'standalone', background_color: '#ffffff', theme_color: theme.accent.light.primary })
    expect(m.icons).toEqual([
      { src: brandFileUrl('mark-192.png', theme), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: brandFileUrl('mark-512.png', theme), sizes: '512x512', type: 'image/png', purpose: 'any' },
    ])
    expect(adminWebManifest(theme, 'en').name).toBe('Novák Bakery')
    expect(adminWebManifest(resolveAdminTheme(), 'de')).toMatchObject({ name: 'tinyzoo', short_name: 'tinyzoo' })
  })
})
