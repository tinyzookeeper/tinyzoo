/**
 * Visits: what Keeper reads from a site's analytics plugin, and what it shows of them.
 * The site's answer is `tinyzoo-analytics-rollups` version 1 (tinyzoo's `AnalyticsRollups`):
 * keys are only added within version 1.
 */

/** A value of a top list (a page, a source, a country, a device) on a day or over a period. */
export interface TrafficItem {
  value: string
  /** The entry's title, for a page that is an entry. */
  title?: string
  visitors: number
  visits: number
  pageviews: number
}

/** GET /api/content/_analytics/rollups on a site. */
export interface AnalyticsRollups {
  format: 'tinyzoo-analytics-rollups'
  version: 1
  at: string
  timeZone: string
  from: string
  to: string
  since: string | null
  through: string | null
  days: {
    day: string
    visitors: number
    visits: number
    pageviews: number
    bounces: number
    engagedMs: number
    pages: TrafficItem[]
    sources: TrafficItem[]
    countries: TrafficItem[]
    devices: TrafficItem[]
  }[]
}

/** A drop in visitors the team was told about (sites.traffic_drop). */
export interface TrafficDrop {
  /** The last day of the week that showed the drop. */
  day: string
  /** Visitors a day over those 7 days. */
  perDay: number
  /** Visitors a day over the 4 weeks before: the level a recovery is measured against. */
  baselinePerDay: number
  /** When the e-mail went out (ISO 8601). */
  alertedAt: string
}

/** Totals of a period. */
export interface TrafficTotals {
  visitors: number
  visits: number
  pageviews: number
  bounces: number
  engagedMs: number
}

/** The visits on the site list: the last 30 days of visitors, this week against the one before. */
export interface TrafficGlance {
  /** Visitors a day, oldest first, ending with the last complete day (`through`). */
  spark: number[]
  through: string
  /** Visitors of the last 7 complete days, and of the 7 before. */
  week: number
  previousWeek: number
  drop: TrafficDrop | null
}

/** GET /api/sites/:id/traffic?days=30|90 — the Traffic section of a site. */
export interface TrafficReport {
  days: number
  /** The site counts visits (its status lists the analytics plugin). */
  available: boolean
  /** Why the visits could not be read last time, or null. */
  error: string | null
  checkedAt: string | null
  since: string | null
  /** The last complete day, or null before the first one. */
  through: string | null
  /** One point a day, oldest first, `days` long (days before the site counted are 0). */
  series: { day: string; visitors: number; pageviews: number }[]
  totals: TrafficTotals
  /** The same number of days just before. */
  previous: TrafficTotals
  /**
   * The period's top values, added up from each day's top 10 (a value outside a day's top 10
   * is not counted that day, so the long tail is a little low).
   */
  pages: TrafficItem[]
  sources: TrafficItem[]
  countries: TrafficItem[]
  devices: TrafficItem[]
  drop: TrafficDrop | null
}
