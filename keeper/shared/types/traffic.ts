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

// ── today, live ────────────────────────────────────────────────────────────────

/** GET /api/content/_analytics/live on a site (tinyzoo 1.6+): today so far, read when asked. */
export interface AnalyticsLive {
  format: 'tinyzoo-analytics-live'
  version: 1
  at: string
  timeZone: string
  /** Today, YYYY-MM-DD in `timeZone`, and the hour it is there (0–23). */
  day: string
  hour: number
  /** Distinct visitors in the last 5 minutes. */
  active: number
  today: AnalyticsRollups['days'][number]
  /** Yesterday from its midnight to the same time of day as now. */
  yesterdaySoFar: TrafficTotals
  /** Today's hours 0…`hour`, every hour present. */
  hours: { hour: number; visitors: number; pageviews: number }[]
}

/** A site's today, as Keeper shows it (GET /api/sites/:id/live). Not stored: read from the site, kept 20 s. */
export interface SiteLive {
  /** The site counts visits (its status lists the analytics plugin). */
  available: boolean
  /** Why today could not be read, or null. `update` is set when the site's tinyzoo is too old to share it. */
  error: string | null
  update?: boolean
  /** When the site made the answer (ISO 8601), or null without one. */
  at: string | null
  timeZone: string | null
  day: string | null
  hour: number | null
  active: number
  totals: TrafficTotals
  yesterdaySoFar: TrafficTotals
  hours: { hour: number; visitors: number; pageviews: number }[]
  pages: TrafficItem[]
  sources: TrafficItem[]
  countries: TrafficItem[]
  devices: TrafficItem[]
}

// ── many sites at once ─────────────────────────────────────────────────────────

/** A place a value of a top list was counted on, for lists across several sites. */
export interface TrafficSiteRef {
  id: string
  name: string
}

/** A page across several sites: which site it is on. */
export interface ScopeTrafficPage extends TrafficItem {
  site: TrafficSiteRef
}

/** One site's line in a workspace's traffic. */
export interface ScopeTrafficSite {
  id: string
  name: string
  url: string
  workspace: { slug: string; name: string }
  team: { slug: string; name: string }
  /** The site counts visits. */
  available: boolean
  error: string | null
  update?: boolean
  totals: TrafficTotals
  previous: TrafficTotals
  /** Visitors a day over the period (an hour for today), oldest first. */
  spark: number[]
  /** Visitors in the last 5 minutes (today only, or when read live). */
  active?: number
}

/**
 * GET /api/traffic?workspace=&team=&period=today|7|30|90 — the visits of every site in a
 * workspace and team (or of every workspace I work in), added up. Visitors of different sites
 * add up as visitors of each: one person on two sites counts twice.
 */
export interface ScopeTraffic {
  period: 'today' | '7' | '30' | '90'
  /** The last complete day (days), or today (today). */
  through: string | null
  /** For today: when the oldest of the sites' answers was made. For days: when the oldest read was. */
  at: string | null
  /** Visitors in the last 5 minutes on all the sites (today only). */
  active: number | null
  /** One point a day (or an hour for today), oldest first. */
  series: { day: string; visitors: number; pageviews: number }[]
  /** Today: the hour labels of `series` ("14:00"); days: none. */
  hourly: boolean
  totals: TrafficTotals
  /** The days before (days), or yesterday up to the same time (today). */
  previous: TrafficTotals
  /** Days only: today so far on all the sites that share it live, for the chart's last point. */
  today: { day: string; visitors: number; pageviews: number; active: number } | null
  sites: ScopeTrafficSite[]
  pages: ScopeTrafficPage[]
  sources: TrafficItem[]
  countries: TrafficItem[]
  devices: TrafficItem[]
}
