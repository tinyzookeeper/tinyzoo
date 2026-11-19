/**
 * Where a visit came from: the referring site's host, grouped into the sources people know
 * (Google, Seznam, Facebook…), and the campaign the link was tagged with (utm_*).
 */

export const SOURCE_GROUPS = ['Google', 'Seznam', 'Bing', 'DuckDuckGo', 'Facebook', 'Instagram', 'LinkedIn', 'X', 'YouTube', 'Direct', 'Other'] as const
export type SourceGroup = (typeof SOURCE_GROUPS)[number]

/** Hosts (and their subdomains) per group. `google.` matches every country domain (google.cz, google.co.uk). */
const GROUP_HOSTS: readonly [SourceGroup, RegExp][] = [
  ['Google', /(^|\.)google\.[a-z.]+$|(^|\.)googleusercontent\.com$|^com\.google\.android\./],
  ['Seznam', /(^|\.)seznam\.cz$|(^|\.)szn\.cz$|(^|\.)seznamzpravy\.cz$|(^|\.)firmy\.cz$|(^|\.)mapy\.(cz|com)$|(^|\.)novinky\.cz$|(^|\.)sbazar\.cz$/],
  ['Bing', /(^|\.)bing\.com$/],
  ['DuckDuckGo', /(^|\.)duckduckgo\.com$/],
  ['Facebook', /(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$|(^|\.)messenger\.com$/],
  ['Instagram', /(^|\.)instagram\.com$/],
  ['LinkedIn', /(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/],
  ['X', /^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/],
  ['YouTube', /(^|\.)youtube\.com$|(^|\.)youtu\.be$/],
]

/** utm_source values that name a group, for a tagged link opened without a referrer (an app, an email). */
const UTM_NAMES: Record<string, SourceGroup> = {
  google: 'Google', seznam: 'Seznam', sklik: 'Seznam', bing: 'Bing', duckduckgo: 'DuckDuckGo',
  facebook: 'Facebook', fb: 'Facebook', meta: 'Facebook', instagram: 'Instagram', ig: 'Instagram',
  linkedin: 'LinkedIn', twitter: 'X', x: 'X', youtube: 'YouTube',
}

/** The host of a referrer address, lowercased and without `www.`; null when there is none. */
export function referrerHost(referrer: string | null | undefined): string | null {
  const s = String(referrer ?? '').trim()
  if (!s) return null
  try {
    const u = new URL(s)
    // An app opened the link (android-app://com.google.android.gm/): its package is the "host".
    const host = (u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : u.hostname || u.pathname.replace(/^\/+/, '').split('/')[0]!).toLowerCase()
    return host.replace(/^www\./, '').slice(0, 253) || null
  }
  catch {
    return null
  }
}

/** The group of a host (Other for one that is in none). */
export function groupOfHost(host: string): SourceGroup {
  for (const [group, test] of GROUP_HOSTS) if (test.test(host)) return group
  return 'Other'
}

export interface Utm {
  source: string | null
  medium: string | null
  campaign: string | null
}

/** A utm value as stored: trimmed, lowercased, at most 100 characters; null when empty. */
export function cleanUtm(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase().slice(0, 100)
  return s || null
}

export interface Source {
  /** The referring host; null for none, and for the site's own pages. */
  referrerHost: string | null
  source: SourceGroup
  /** The referrer is this site itself (a page load from one of its own links). */
  internal: boolean
}

/**
 * The source of a page view. `siteHosts` are the site's own hosts (without `www.`): a referrer
 * on one of them is a click inside the site, which continues the visit rather than starting one.
 */
export function sourceOf(referrer: string | null | undefined, siteHosts: readonly string[], utm: Utm): Source {
  const host = referrerHost(referrer)
  if (host && siteHosts.includes(host)) return { referrerHost: null, source: 'Direct', internal: true }
  if (host) return { referrerHost: host, source: groupOfHost(host), internal: false }
  if (utm.source) return { referrerHost: null, source: UTM_NAMES[utm.source] ?? 'Other', internal: false }
  return { referrerHost: null, source: 'Direct', internal: false }
}
