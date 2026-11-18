import { brandFileUrl, type CmsAdminLogo, type CmsAdminTheme, type CmsThemeNote } from './theme'

/**
 * The client's logo set in the admin (0.7, `cms.admin.logo`): which addresses tinyzoo
 * can use, what the admin shows in each place, and the checks that tell the developer
 * when a logo will look wrong. Pure: the file checks get the file's size from the caller
 * (`server/plugins/cms-logo-check.ts` reads it in development).
 */

/** The four logos of `cms.admin.logo`. @internal */
export const CMS_LOGO_SLOTS = ['full', 'mark', 'fullDark', 'markDark'] as const
/** @internal */
export type CmsLogoSlot = (typeof CMS_LOGO_SLOTS)[number]

/**
 * What kind of address a logo has: a file of the site (`/brand/logo.svg`, served from
 * its `public/` folder), an `https://` URL, an `http://` URL (blocked by the browser on an
 * admin served over https), or something the browser cannot load from every admin page
 * (`brand/logo.svg`, `//cdn…`, `data:`, `javascript:`).
 *
 * @internal
 */
export function logoAddressKind(address: string): 'path' | 'https' | 'http' | 'invalid' {
  if (/^\/(?![/\\])/.test(address)) return address.includes('\\') ? 'invalid' : 'path'
  const scheme = /^(https?):\/\//i.exec(address)?.[1]?.toLowerCase()
  if (!scheme) return 'invalid'
  try {
    if (!new URL(address).hostname) return 'invalid'
  }
  catch {
    return 'invalid'
  }
  return scheme as 'https' | 'http'
}

const note = (message: string): CmsThemeNote => ({ kind: 'logo', message })
const key = (slot: CmsLogoSlot) => `cms.admin.logo.${slot}`

/**
 * The logo part of the theme, with notes on the addresses. An address tinyzoo cannot use
 * is left out (the admin falls back to the next logo, or the initials). A dark version
 * without its light one is left out too: the light one is what the admin shows in light
 * mode, and dark mode should not show a different logo from light mode.
 *
 * @internal
 */
export function resolveAdminLogo(logo: CmsAdminLogo | undefined | null): { logo: CmsAdminTheme['logo']; notes: CmsThemeNote[] } {
  const notes: CmsThemeNote[] = []
  const given = (logo && typeof logo === 'object' ? logo : {}) as Record<string, unknown>
  const read = (slot: CmsLogoSlot): string | null => {
    const value = given[slot]
    if (value === undefined || value === null || value === '') return null
    if (typeof value !== 'string') {
      notes.push(note(`${key(slot)} should be an address (a string such as '/brand/${slot === 'full' || slot === 'fullDark' ? 'logo' : 'mark'}.svg'); it was ${Array.isArray(value) ? 'a list' : `a ${typeof value}`}, so it is left out.`))
      return null
    }
    const address = value.trim()
    if (!address) return null
    const kind = logoAddressKind(address)
    if (kind === 'invalid') {
      notes.push(note(`${key(slot)} "${address}" is not an address the admin can load: start it with / for a file in the site's public/ folder ('/brand/logo.svg'), or use an https:// URL. It is left out.`))
      return null
    }
    if (kind === 'http') notes.push(note(`${key(slot)} "${address}" uses http://: an admin served over https cannot show it (the browser blocks it). Use https://.`))
    return address
  }
  const full = read('full')
  const mark = read('mark')
  let fullDark = read('fullDark')
  let markDark = read('markDark')
  if (fullDark && !full) {
    notes.push(note(`${key('fullDark')} is set, but ${key('full')} is not: the dark version is left out. Set the light one too (the admin shows it in light mode).`))
    fullDark = null
  }
  if (markDark && !mark) {
    notes.push(note(`${key('markDark')} is set, but ${key('mark')} is not: the dark version is left out. Set the light one too (the admin shows it in light mode).`))
    markDark = null
  }
  return {
    logo: {
      full,
      mark,
      fullDark: fullDark ?? full,
      markDark: markDark ?? mark,
      fullDarkPlate: !!full && !fullDark,
      markDarkPlate: !!mark && !markDark,
    },
    notes,
  }
}

/** What a logo file is, as the server read it. `missing`: no file at that address. @internal */
export type CmsLogoFileInfo =
  | { missing: true; where: string }
  | { unreadable: true }
  | { missing?: false; unreadable?: false; width: number; height: number; vector: boolean; /** An SVG with `<text>`: drawn with the server's fonts in the PNG files. */ text?: boolean }

/** The smallest raster logos that still look sharp: the mark becomes the 180 px home-screen icon; the full logo fills a 160 px slot at 2×. @internal */
export const CMS_LOGO_MIN_PX = { mark: 180, full: 320 } as const

/**
 * Notes on one logo file: missing, a mark that is not square (±5 %), a raster logo that is
 * too small. A vector logo (SVG) is never too small. Empty when the file is fine.
 *
 * @internal
 */
export function logoFileNotes(slot: CmsLogoSlot, address: string, info: CmsLogoFileInfo): CmsThemeNote[] {
  if ('missing' in info && info.missing) return [note(`${key(slot)} "${address}" was not found (${info.where}). The admin shows the next logo, or the initials, in its place.`)]
  if ('unreadable' in info && info.unreadable) return [note(`${key(slot)} "${address}" is not a picture tinyzoo can read. Use an SVG or a PNG (WebP and JPEG work too).`)]
  const notes: CmsThemeNote[] = []
  const { width, height, vector, text } = info as Extract<CmsLogoFileInfo, { width: number }>
  // The browser draws an SVG's text in the admin with the visitor's fonts, but the PNG files (the
  // emails, the home-screen icon) are drawn on the server, which often has no fonts at all (Docker).
  if (vector && text) notes.push(note(`${key(slot)} "${address}" has text in it (<text>): the PNG versions (the email logo, the home-screen icon) are drawn on the server with whatever fonts it has, often none. Convert the text to outlines (paths) in your design tool.`))
  if (!(width > 0 && height > 0)) return notes
  const isMark = slot === 'mark' || slot === 'markDark'
  if (isMark && Math.abs(width / height - 1) > 0.05) {
    notes.push(note(`${key(slot)} "${address}" is ${width}×${height}, not square: the mark is shown in a square (the folded sidebar, the tab icon, the phone's home screen) and will look squeezed or small. Use a square mark, 512×512 is best.`))
  }
  if (!vector) {
    if (isMark && Math.min(width, height) < CMS_LOGO_MIN_PX.mark) {
      notes.push(note(`${key(slot)} "${address}" is ${width}×${height} px: the phone's home-screen icon needs at least ${CMS_LOGO_MIN_PX.mark} px. Use an SVG, or a PNG of 512×512.`))
    }
    if (!isMark && width < CMS_LOGO_MIN_PX.full) {
      notes.push(note(`${key(slot)} "${address}" is ${width} px wide: it will look blurred on sharp screens and in the emails. Use an SVG, or a PNG at least ${CMS_LOGO_MIN_PX.full} px wide (640 px is better).`))
    }
  }
  return notes
}

/**
 * What the admin shows as the client's brand in one place:
 * - `full`: the full logo (it carries the name, which stays for screen readers);
 * - `mark`: the square mark, with the name beside it where there is room;
 * - `initials`: a tile with the name's initials (a client without logos);
 * - `mascot`: tinyzoo's own mascot (no client name and no logo: the admin is tinyzoo's).
 *
 * `wide`: the open sidebar, the sign-in pages, the phone's menu. `compact`: the folded sidebar.
 *
 * @internal
 */
export function adminBrandLockup(theme: Pick<CmsAdminTheme, 'logo'>, unbranded: boolean, room: 'wide' | 'compact'): 'full' | 'mark' | 'initials' | 'mascot' {
  if (room === 'wide' && theme.logo.full) return 'full'
  if (theme.logo.mark) return 'mark'
  return unbranded ? 'mascot' : 'initials'
}

/** Up to two initials of a name ("Pekárna Novák" → "PN"), for the tile shown without a mark. @internal */
export function brandInitials(name: string): string {
  return Array.from(name.split(/\s+/).filter(Boolean).map((part) => Array.from(part)[0]!).join('')).slice(0, 2).join('').toUpperCase() || '?'
}

/** The address of the admin's web manifest (slice E serves it, with the mark's PNG icons). @internal */
export const CMS_ADMIN_MANIFEST_URL = '/api/cms/_brand/admin.webmanifest'

/** The type of an image from its address's extension, for `<link type>`; `undefined` when it does not say. */
function imageType(address: string): string | undefined {
  const ext = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(address)?.[1]?.toLowerCase()
  return ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'ico' ? 'image/x-icon' : undefined
}

/** One `<link>` of the admin's icons. @internal */
export type CmsAdminIconLink =
  | { rel: 'icon'; href: string; key: string; type?: string; sizes?: string }
  | { rel: 'apple-touch-icon'; href: string; key: string }
  | { rel: 'manifest'; href: string; key: string }

/**
 * The admin's tab and home-screen icons as `<link>`s. With a mark: a 32 px PNG made from it
 * (for browsers that do not take an SVG icon), the mark itself (listed last, so browsers that
 * can use it prefer it), the 180 px PNG for the phone's home screen and the web manifest.
 * Without one, or when the server could not read it (`logo.files.markFallback`): tinyzoo's
 * mascot (`fallback`), as before 0.7, so the tab never shows a broken icon.
 *
 * @internal
 */
export function adminIconLinks(theme: CmsAdminTheme, fallback: string): CmsAdminIconLink[] {
  const mark = theme.logo.files?.markFallback ? null : theme.logo.mark
  if (!mark) return [{ rel: 'icon', type: 'image/svg+xml', href: fallback, key: 'cms-admin-icon' }]
  const type = imageType(mark)
  return [
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: brandFileUrl('mark-32.png', theme), key: 'cms-admin-icon-png' },
    { rel: 'icon', href: mark, key: 'cms-admin-icon', ...(type ? { type } : {}), ...(type === 'image/svg+xml' ? { sizes: 'any' } : {}) },
    { rel: 'apple-touch-icon', href: brandFileUrl('mark-180.png', theme), key: 'cms-admin-touch-icon' },
    { rel: 'manifest', href: CMS_ADMIN_MANIFEST_URL, key: 'cms-admin-manifest' },
  ]
}
