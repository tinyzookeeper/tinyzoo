import type { CmsAccessUser } from '../src/roles'
import type { CmsRegistry } from '../src/entity'
import { COUNTRY_HEADERS } from './core/enrich'
import { validTimeZone } from './core/visitor'

/**
 * How the plugin goes with a cookie banner (the consent plugin, `tinyzoo/consent`):
 *  - `cookieless` (default): every visit is counted without a cookie; no banner is needed for it.
 *  - `consent`: the same, and the visits of visitors who allowed statistics in the banner also
 *    carry their consent id, which gives the extra reports "among visitors who agreed".
 *  - `strict`: nothing at all is sent until the visitor allows statistics.
 * `consent` and `strict` need `consentPlugin()` registered too.
 */
export type AnalyticsMode = 'cookieless' | 'consent' | 'strict'

export const ANALYTICS_MODES: readonly AnalyticsMode[] = ['cookieless', 'consent', 'strict']

export interface AnalyticsOptions {
  /**
   * With a cookie banner or without (default `cookieless`). See `AnalyticsMode` and
   * docs/analytics.md, "Cookie banner": which mode fits which site, and what each changes.
   */
  mode?: AnalyticsMode
  /**
   * Days the raw page views are kept (default 90). Older ones are deleted every night; the
   * daily totals made from them stay, so the reports of older periods keep their numbers (but
   * cannot be filtered or broken down by a second dimension any more).
   */
  keepRawDays?: number
  /**
   * Who may read the reports (the Analytics page, the home card, the editor's panel).
   * Default: administrators and editors, and roles built on them (`user.base`).
   *
   *   access: ({ user }) => user.base === 'admin'
   */
  access?: (ctx: { user: CmsAccessUser }) => boolean
  /** Count nobody whose browser sends Do Not Track (`DNT: 1`) or Global Privacy Control (`Sec-GPC: 1`). Default: false (nothing personal is stored). */
  respectDoNotTrack?: boolean
  /** Request headers that carry the visitor's country, set by the CDN in front of the site. Default: Cloudflare's, Vercel's and CloudFront's. */
  countryHeaders?: string[]
  /**
   * A country database in the MaxMind format (`.mmdb`), for the country when no CDN header
   * says it: DB-IP's free "IP to Country Lite" (CC BY 4.0) or MaxMind's GeoLite2 Country.
   * Default: the environment variable `NUXT_CMS_ANALYTICS_GEOIP_FILE`; without one, visits
   * have no country unless a CDN header gives it.
   */
  geoipFile?: string
  /** The time zone days are counted in. Default: the admin's (`cms.admin.timeZone`, Europe/Prague when unset). */
  timeZone?: string
  /** Paths never counted, besides the admin and the API: `['/shop/checkout']` leaves that page and everything under it out. */
  excludePaths?: string[]
}

/** The options with their defaults, as the server reads them. @internal */
export interface ResolvedAnalyticsOptions {
  mode: AnalyticsMode
  keepRawDays: number
  access: (ctx: { user: CmsAccessUser }) => boolean
  respectDoNotTrack: boolean
  countryHeaders: string[]
  geoipFile: string | null
  timeZone: string | null
  excludePaths: string[]
}

/**
 * Who reads the reports by default: administrators and editors (and custom roles built on
 * them). Authors write; how many people read the site is the business's own information.
 *
 * @internal
 */
export const analyticsReadAccess = ({ user }: { user: CmsAccessUser }): boolean => {
  const base = user?.base ?? user?.role
  return base === 'admin' || base === 'editor'
}

/** @internal */
export function resolveAnalyticsOptions(opts: AnalyticsOptions = {}): ResolvedAnalyticsOptions {
  const keep = opts.keepRawDays ?? 90
  if (!Number.isInteger(keep) || keep < 2 || keep > 3650) {
    throw new Error(`Plugin "analytics": keepRawDays must be a whole number of days from 2 to 3650, got ${JSON.stringify(opts.keepRawDays)}.`)
  }
  if (opts.mode !== undefined && !ANALYTICS_MODES.includes(opts.mode)) throw new Error(`Plugin "analytics": mode is 'cookieless', 'consent' or 'strict', got ${JSON.stringify(opts.mode)}.`)
  if (opts.access !== undefined && typeof opts.access !== 'function') throw new Error('Plugin "analytics": access must be a function ({ user }) => boolean.')
  if (opts.timeZone !== undefined && !validTimeZone(opts.timeZone)) throw new Error(`Plugin "analytics": timeZone "${opts.timeZone}" is not a time zone (e.g. "Europe/Prague").`)
  for (const p of opts.excludePaths ?? []) {
    if (typeof p !== 'string' || !p.startsWith('/')) throw new Error(`Plugin "analytics": excludePaths takes paths that start with "/", got ${JSON.stringify(p)}.`)
  }
  const headers = (opts.countryHeaders ?? [...COUNTRY_HEADERS]).map((h) => String(h).trim().toLowerCase()).filter(Boolean)
  return {
    mode: opts.mode ?? 'cookieless',
    keepRawDays: keep,
    access: opts.access ?? analyticsReadAccess,
    respectDoNotTrack: !!opts.respectDoNotTrack,
    countryHeaders: headers,
    geoipFile: opts.geoipFile || null,
    timeZone: opts.timeZone ?? null,
    excludePaths: [...(opts.excludePaths ?? [])],
  }
}

/**
 * The options of the registered analytics plugin, or null when the site does not use it.
 *
 * @internal
 */
export function analyticsOptionsOf(reg: Pick<CmsRegistry, 'plugins'>): ResolvedAnalyticsOptions | null {
  const p = reg.plugins.find((x) => x.name === 'analytics') as { analytics?: ResolvedAnalyticsOptions } | undefined
  return p?.analytics ?? null
}
