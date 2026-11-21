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

/**
 * What `GET /api/content/_analytics/live` answers: a site's visits of today so far, for a tool
 * that watches many sites (tinyzoo's Keeper) and should not wait for the night's totals. Read
 * with the status token, like the rollups. Counted from the day's raw page views as the admin's
 * report counts them, so the numbers grow during the day and become final in the night's
 * totals (`AnalyticsRollups`). No raw page view, visitor id or consent id is in it.
 *
 * `format` and `version` say how to read the rest. Within `version: 1` keys are only added
 * (ignore the ones you do not know); a change that breaks readers is `version: 2`.
 */
export interface AnalyticsLive {
  format: 'tinyzoo-analytics-live'
  version: 1
  /** When this answer was made (ISO 8601). */
  at: string
  /** The time zone the site counts days in (`Europe/Prague`). */
  timeZone: string
  /** Today, YYYY-MM-DD in `timeZone`. */
  day: string
  /** The hour it is now in `timeZone`, 0–23. */
  hour: number
  /** Distinct visitors in the last five minutes. */
  active: number
  /** Today so far: the totals and the top lists, in the shape of a day of the rollups. */
  today: AnalyticsRollupDay
  /** Yesterday from its midnight to the same time of day as now, to compare today with. */
  yesterdaySoFar: AnalyticsLiveTotals
  /** Visitors and pageviews in each hour of today, from 0 to `hour`, every hour there (zeros when nobody came). */
  hours: AnalyticsLiveHour[]
}

/** The totals of a span of time. */
export interface AnalyticsLiveTotals {
  visitors: number
  visits: number
  pageviews: number
  /** Visits of a single page view. */
  bounces: number
  /** Time the pages were looked at, in milliseconds. */
  engagedMs: number
}

/** One hour of today. */
export interface AnalyticsLiveHour {
  /** 0–23, in the site's time zone. */
  hour: number
  visitors: number
  pageviews: number
}

/** The address of the route, under `/api/content/` (it registers there as a plugin content route). @internal */
export const ROLLUPS_CONTENT_PATH = '_analytics/rollups'

/** The address of today's visits, under `/api/content/`. @internal */
export const LIVE_CONTENT_PATH = '_analytics/live'

/** The longest range one request may ask for, in days. @internal */
export const MAX_ROLLUP_DAYS = 400

/** How many values each top list keeps per day. @internal */
export const ROLLUP_TOP = 10
