import type { Dimension } from './dimensions'

/**
 * A day's totals, from its page views: what `analytics_daily` keeps once the raw rows are gone.
 * Pure: the nightly job loads one day's views and writes what this returns, replacing the day.
 *
 * Per dimension value (and once for the whole day, dimension `total`, value ''):
 *  - visitors: distinct visitors with a view that has the value;
 *  - visits: distinct visits with such a view (`entry_page`: visits that started there);
 *  - pageviews: views with the value (`entry_page`: entrances);
 *  - bounces: those visits that had one view in all;
 *  - engagedMs: the time on those views.
 * The visitor id changes every day, so visitors of several days add up: the sum of the days is
 * what a count over the raw rows of the same days gives.
 */

export interface RollupView {
  path: string
  entity: string | null
  entryId: string | null
  locale: string | null
  visitor: string
  session: string
  isEntry: boolean
  referrerHost: string | null
  source: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  country: string | null
  device: string | null
  browser: string | null
  os: string | null
  language: string | null
  engagedMs: number
}

export interface RollupRow {
  dimension: 'total' | Dimension
  value: string
  visitors: number
  visits: number
  pageviews: number
  bounces: number
  engagedMs: number
}

/** What each dimension reads from a view; null leaves the view out of that dimension. */
export const ROLLUP_VALUE: Record<Dimension, (v: RollupView) => string | null> = {
  page: (v) => v.path,
  entry_page: (v) => (v.isEntry ? v.path : null),
  entry: (v) => (v.entity && v.entryId ? `${v.entity}:${v.entryId}` : null),
  source: (v) => v.source,
  referrer: (v) => v.referrerHost,
  utm_source: (v) => v.utmSource,
  utm_medium: (v) => v.utmMedium,
  utm_campaign: (v) => v.utmCampaign,
  country: (v) => v.country,
  device: (v) => v.device,
  browser: (v) => v.browser,
  os: (v) => v.os,
  language: (v) => v.language,
  locale: (v) => v.locale,
}

interface Acc { visitors: Set<string>; visits: Set<string>; pageviews: number; engagedMs: number }

const MAX_ENGAGED_MS = 30 * 60_000

export function rollupDay(views: readonly RollupView[]): RollupRow[] {
  // Views per visit: a visit of one view is a bounce.
  const perVisit = new Map<string, number>()
  for (const v of views) perVisit.set(v.session, (perVisit.get(v.session) ?? 0) + 1)

  const groups = new Map<string, Acc>()
  const add = (key: string, v: RollupView) => {
    let acc = groups.get(key)
    if (!acc) groups.set(key, acc = { visitors: new Set(), visits: new Set(), pageviews: 0, engagedMs: 0 })
    acc.visitors.add(v.visitor)
    acc.visits.add(v.session)
    acc.pageviews += 1
    acc.engagedMs += Math.min(Math.max(0, Number(v.engagedMs) || 0), MAX_ENGAGED_MS)
  }
  for (const v of views) {
    add('total\u0000', v)
    for (const [dimension, read] of Object.entries(ROLLUP_VALUE)) {
      const value = read(v)
      if (value !== null && value !== '') add(`${dimension}\u0000${value}`, v)
    }
  }

  const rows: RollupRow[] = []
  for (const [key, acc] of groups) {
    const [dimension, value] = key.split('\u0000') as [RollupRow['dimension'], string]
    let bounces = 0
    for (const s of acc.visits) if (perVisit.get(s) === 1) bounces++
    rows.push({ dimension, value, visitors: acc.visitors.size, visits: acc.visits.size, pageviews: acc.pageviews, bounces, engagedMs: acc.engagedMs })
  }
  return rows.sort((a, b) => (a.dimension < b.dimension ? -1 : a.dimension > b.dimension ? 1 : b.visitors - a.visitors || (a.value < b.value ? -1 : 1)))
}

/** Headline figures from totals (of rollups, raw rows, or both added up). */
export interface Totals { visitors: number; visits: number; pageviews: number; bounces: number; engagedMs: number }

export const emptyTotals = (): Totals => ({ visitors: 0, visits: 0, pageviews: 0, bounces: 0, engagedMs: 0 })

export function addTotals(a: Totals, b: Partial<Totals>): Totals {
  return {
    visitors: a.visitors + (Number(b.visitors) || 0),
    visits: a.visits + (Number(b.visits) || 0),
    pageviews: a.pageviews + (Number(b.pageviews) || 0),
    bounces: a.bounces + (Number(b.bounces) || 0),
    engagedMs: a.engagedMs + (Number(b.engagedMs) || 0),
  }
}

/** The figures the admin shows: views per visit, bounce rate (0–1) and the average engaged time per visit. */
export function headline(t: Totals) {
  return {
    ...t,
    viewsPerVisit: t.visits ? t.pageviews / t.visits : 0,
    bounceRate: t.visits ? t.bounces / t.visits : 0,
    avgEngagedMs: t.visits ? Math.round(t.engagedMs / t.visits) : 0,
  }
}

/** The change from `before` to `now` as a fraction (0.25 = 25 % more); null when there was nothing before. */
export function change(now: number, before: number): number | null {
  if (!before) return now ? null : 0
  return (now - before) / before
}
