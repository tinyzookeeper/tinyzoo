/** Small facts about a page view, from what the browser and the CDN say. Pure functions. */

export type Device = 'mobile' | 'tablet' | 'desktop'

/** The kind of device, from the screen's width in CSS pixels (phones under 600, tablets up to 1024). */
export function deviceOf(screenWidth: unknown): Device | null {
  const w = Number(screenWidth)
  if (!Number.isFinite(w) || w <= 0 || w > 20_000) return null
  if (w < 600) return 'mobile'
  if (w <= 1024) return 'tablet'
  return 'desktop'
}

/** The CDN headers that name the visitor's country, by default (Cloudflare, Vercel, CloudFront). */
export const COUNTRY_HEADERS = ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country'] as const

/** Codes that are no country: unknown, Tor, anonymous proxies, satellite, "Europe", "Asia/Pacific". */
const NOT_A_COUNTRY = new Set(['XX', 'T1', 'A1', 'A2', 'O1', 'EU', 'AP', 'ZZ'])

/** An ISO 3166 alpha-2 code as stored (`CZ`), or null. */
export function countryCode(v: unknown): string | null {
  const s = String(v ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(s) && !NOT_A_COUNTRY.has(s) ? s : null
}

/** The country from the first of `names` the request carries. */
export function countryFromHeaders(header: (name: string) => string | undefined | null, names: readonly string[]): string | null {
  for (const name of names) {
    const code = countryCode(header(name))
    if (code) return code
  }
  return null
}

/** The browser's language as stored: the language part only, lowercased (`cs-CZ` → `cs`). */
export function languageOf(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase().split(/[-_,;]/)[0]!
  return /^[a-z]{2,3}$/.test(s) ? s : null
}

/**
 * A page's path as stored: what the tracker sent without query and fragment, `/` for the home
 * page, no trailing slash, percent-escapes decoded where that is safe. Null for anything that
 * is not a path of this site.
 */
export function cleanPath(v: unknown): string | null {
  if (typeof v !== 'string') return null
  let p = v.split(/[?#]/)[0]!.trim()
  if (!p.startsWith('/') || p.startsWith('//') || p.length > 500) return null
  try { p = decodeURI(p) }
  catch { /* keep it as sent */ }
  if (/[\u0000-\u001F\u007F]/.test(p)) return null
  p = p.replace(/\/{2,}/g, '/')
  return p.length > 1 ? p.replace(/\/+$/, '') : p
}

/** Is this a path the plugin never counts: the admin, the API, a file of the build, or one the site excluded? */
export function excludedPath(path: string, extra: readonly string[] = []): boolean {
  const under = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`)
  return under('/admin') || under('/api') || under('/_nuxt') || under('/__nuxt_error') || extra.some((p) => under(p.replace(/\/+$/, '') || '/'))
}
