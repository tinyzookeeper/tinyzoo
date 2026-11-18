import sharp from 'sharp'
import { brandFileUrl, resolveText, type CmsAdminTheme, type CmsBrandFile } from 'tinyzoo'

// The PNG versions of the client's logo (src/theme.ts, CMS_BRAND_FILES) and the admin's
// web manifest, for places that cannot use SVG: emails (Gmail and Outlook do not show
// SVG), the phone's home-screen icon and the PNG tab icon. Pure functions: a logo's bytes
// in, a PNG out. Loading the logo and caching the result is cmsBrandSource.ts; the route
// is GET /api/cms/_brand/<file>.

/** The largest logo file tinyzoo reads (an `https://` logo stops downloading here). */
export const BRAND_SOURCE_MAX_BYTES = 2 * 1024 * 1024

/** The most pixels a logo may have, decoded or rendered: a logo is small, a bigger one is a mistake (or an attack). */
const MAX_LOGO_PIXELS = 25_000_000

/** The full logo in emails: 2× for a 160 px wide slot, and never taller than this (a tall logo gets narrower instead). */
export const EMAIL_LOGO_WIDTH = 320
export const EMAIL_LOGO_MAX_HEIGHT = 120

/** The apple-touch-icon is opaque (iOS fills transparency with black) and keeps the mark off the rounded corners. */
const TOUCH_ICON_PADDING = 16

/**
 * tinyzoo's own mark (app/assets/brand/logo/mascot.svg, kept equal by a unit test): the
 * tab and home-screen icon of an admin without a client's mark.
 */
export const TINYZOO_MARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 580 404"><path fill="#2E3035" d="M508.01 131.16c9.14-13.45 14.49-29.68 14.49-47.16 0-46.39-37.61-84-84-84-38.28 0-70.55 25.61-80.68 60.62C336.33 56.93 313.67 55 290 55s-46.33 1.93-67.82 5.62C212.05 25.61 179.78 0 141.5 0c-46.39 0-84 37.61-84 84 0 17.48 5.35 33.72 14.49 47.16C26.31 173.78 0 232.01 0 300v16c0 48.6 39.4 88 88 88h404c48.6 0 88-39.4 88-88v-16c0-67.99-26.31-126.22-71.99-168.84"/><circle cx="188" cy="251.5" r="90" fill="#F9F5EF"/><circle cx="230" cy="218" r="30" fill="#2E3035"/><circle cx="392" cy="251.5" r="90" fill="#F9F5EF"/><circle cx="434" cy="218" r="30" fill="#2E3035"/></svg>'

/** Whether a logo address is one tinyzoo reads: a path on this site or an `https://` URL. */
export function isBrandSourceAddress(address: string): boolean {
  if (/^https:\/\/[^/]/i.test(address)) return true
  // A site path, but not protocol-relative (//host) and not one of the API's own routes (it would ask itself).
  return address.startsWith('/') && !address.startsWith('//') && !address.startsWith('/\\') && !/^\/api\//i.test(address) && !address.split(/[?#]/)[0]!.split('/').includes('..')
}

/** Which logo a file is made from: the full logo for the email, the mark for the icons. `null`: none configured. */
export function brandFileSource(file: CmsBrandFile, theme: CmsAdminTheme): string | null {
  return file === 'full-email.png' ? theme.logo.full : theme.logo.mark
}

/** The `v` a file's address carries for this theme (`brandFileUrl`): when a request names it, the answer may be cached for good. */
export function brandFileVersion(file: CmsBrandFile, theme: CmsAdminTheme): string {
  return new URL(brandFileUrl(file, theme), 'http://x').searchParams.get('v') ?? ''
}

/** The square size of a mark file (`mark-180.png` → 180). */
const markSize = (file: CmsBrandFile) => Number(/^mark-(\d+)\.png$/.exec(file)?.[1] ?? 0)

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

/**
 * Opens a logo for drawing at about `scale` × its own size. An SVG is rendered at a
 * density that gives at least the pixels needed, so its edges stay crisp; a bitmap is
 * read as it is. Throws when the bytes are not an image sharp can read.
 */
async function openLogo(input: Buffer, fit: (w: number, h: number) => number): Promise<ReturnType<typeof sharp>> {
  const options = { failOn: 'error' as const, limitInputPixels: MAX_LOGO_PIXELS }
  const meta = await sharp(input, options).metadata()
  if (!meta.width || !meta.height) throw new Error('the logo has no size')
  if (meta.format !== 'svg') return sharp(input, options)
  // At 72 dpi an SVG renders at its own size; ask for enough dots to draw the target size (or twice it for small icons) directly.
  const density = Math.min(2400, Math.max(72, Math.ceil(72 * fit(meta.width, meta.height) * 2)))
  return sharp(input, { ...options, density })
}

/**
 * One PNG version of a logo (`input`: the logo's bytes, SVG or a bitmap).
 *
 *  - `mark-32.png`, `mark-192.png`, `mark-512.png`: the mark, square, centred on transparent.
 *  - `mark-180.png` (apple-touch-icon): the mark on white with a little padding, opaque.
 *  - `full-email.png`: the full logo 320 px wide on transparent, at most 120 px tall;
 *    a logo that would be taller is drawn smaller and sits at the left of the 320 px.
 */
export async function renderBrandFile(file: CmsBrandFile, input: Buffer): Promise<Buffer> {
  if (file === 'full-email.png') {
    const W = EMAIL_LOGO_WIDTH
    const H = EMAIL_LOGO_MAX_HEIGHT
    const logo = await openLogo(input, (w, h) => Math.min(W / w, H / h))
    const drawn = await logo.resize({ width: W, height: H, fit: 'inside' }).png().toBuffer({ resolveWithObject: true })
    const { width } = drawn.info
    if (width >= W) return sharp(drawn.data).png({ compressionLevel: 9 }).toBuffer()
    // Always 320 wide, so the email can say width="160" without stretching a narrower logo.
    return sharp(drawn.data)
      .extend({ top: 0, bottom: 0, left: 0, right: W - width, background: TRANSPARENT })
      .png({ compressionLevel: 9 })
      .toBuffer()
  }
  const size = markSize(file)
  if (!size) throw new Error(`not a brand file: ${file}`)
  if (file === 'mark-180.png') {
    const inner = size - 2 * TOUCH_ICON_PADDING
    const logo = await openLogo(input, (w, h) => inner / Math.max(w, h))
    const icon = await logo.resize(inner, inner, { fit: 'contain', background: TRANSPARENT }).png().toBuffer()
    return sharp(icon)
      .extend({ top: TOUCH_ICON_PADDING, bottom: TOUCH_ICON_PADDING, left: TOUCH_ICON_PADDING, right: TOUCH_ICON_PADDING, background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .png({ compressionLevel: 9 })
      .toBuffer()
  }
  const logo = await openLogo(input, (w, h) => size / Math.max(w, h))
  return logo.resize(size, size, { fit: 'contain', background: TRANSPARENT }).png({ compressionLevel: 9 }).toBuffer()
}

/** The admin's web manifest: "Add to Home Screen" opens the admin as an app, with the client's name and mark. */
export function adminWebManifest(theme: CmsAdminTheme, locale: string) {
  const name = resolveText(theme.name, locale, ['en']) || 'tinyzoo'
  // A home-screen label shows about 12 characters; a longer name is cut by the phone, the first word reads better.
  const shortName = name.length <= 12 ? name : (name.split(/\s+/)[0] ?? name).slice(0, 12)
  return {
    name,
    short_name: shortName,
    lang: locale,
    // start_url inside scope (a browser drops a scope that does not contain it).
    start_url: '/admin/',
    scope: '/admin/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: theme.accent.light.primary,
    icons: (['mark-192.png', 'mark-512.png'] as const).map((file) => ({
      src: brandFileUrl(file, theme),
      sizes: `${markSize(file)}x${markSize(file)}`,
      type: 'image/png',
      purpose: 'any',
    })),
  }
}
