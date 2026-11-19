/**
 * What `GET /api/content/_analytics/rollups` answers: the daily totals of a site, for a tool
 * that watches many sites (tinyzoo's Keeper). Read with the site's status token
 * (`NUXT_CMS_STATUS_TOKEN`), like `/api/health/status`. Numbers per day and the addresses,
 * sources, countries and devices that had the most visitors: no raw page views, no visitor
 * ids, no consent ids, nothing that tells one visitor from another.
 *
 * `format` and `version` say how to read the rest. Within `version: 1` keys are only added
 * (ignore the ones you do not know); a change that breaks readers is `version: 2`.
 */
export interface AnalyticsRollups {
  format: 'tinyzoo-analytics-rollups'
  version: 1
  /** When this answer was made (ISO 8601). */
  at: string
  /** The time zone the site counts days in (`Europe/Prague`). */
  timeZone: string
  /** The days asked for (YYYY-MM-DD, both included). */
  from: string
  to: string
  /** The first day the site has totals for, or null before its first night of counting. */
  since: string | null
  /**
   * The last day whose totals are made (usually yesterday: a day's totals are made in the
   * night after it), or null when none are. Days after it are not in `days` yet.
   */
  through: string | null
  /**
   * Every day of `from`…`to` from `since` to `through`, oldest first. A day nobody visited
   * is there with zeros.
   */
  days: AnalyticsRollupDay[]
}

export interface AnalyticsRollupDay {
  /** YYYY-MM-DD, in `timeZone`. */
  day: string
  /** Distinct visitors of the day (a visitor id lasts one day, so days add up). */
  visitors: number
  visits: number
  pageviews: number
  /** Visits of a single page view. */
  bounces: number
  /** Time the pages were looked at, in milliseconds. */
  engagedMs: number
  /** The 10 addresses with the most visitors; `title` when the address is an entry tinyzoo knows. */
  pages: AnalyticsRollupItem[]
  /** The 10 sources (Google, Seznam, Direct, a referring site…) with the most visitors. */
  sources: AnalyticsRollupItem[]
  /** The 10 countries (ISO 3166 codes) with the most visitors. */
  countries: AnalyticsRollupItem[]
  /** Devices (`desktop`, `mobile`, `tablet`) by visitors. */
  devices: AnalyticsRollupItem[]
}

export interface AnalyticsRollupItem {
  value: string
  /** The entry's title (pages only, when the address is an entry). */
  title?: string
  visitors: number
  visits: number
  pageviews: number
}

/** The address of the route, under `/api/content/` (it registers there as a plugin content route). @internal */
export const ROLLUPS_CONTENT_PATH = '_analytics/rollups'

/** The longest range one request may ask for, in days. @internal */
export const MAX_ROLLUP_DAYS = 400

/** How many values each top list keeps per day. @internal */
export const ROLLUP_TOP = 10
