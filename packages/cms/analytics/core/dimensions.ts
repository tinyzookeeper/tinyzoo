/**
 * The ways the reports split visits: each is a column of `analytics_events` (or, for
 * `entry_page` and `entry`, a column read a particular way). The same keys name the filters in
 * the admin's address (`?f.source=Google`) and the rows of `analytics_daily`.
 * No `import`s of anything server-side: the admin page uses this file too.
 */

export const DIMENSIONS = [
  'page', 'entry_page', 'entry', 'source', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign',
  'country', 'device', 'browser', 'os', 'language', 'locale',
] as const
export type Dimension = (typeof DIMENSIONS)[number]

export const isDimension = (v: unknown): v is Dimension => typeof v === 'string' && (DIMENSIONS as readonly string[]).includes(v)

/** The `analytics_events` column each dimension reads (SQL name). `entry` is `entity:entry_id`. */
export const DIMENSION_COLUMN: Record<Dimension, string> = {
  page: 'path',
  entry_page: 'path',
  entry: 'entity',
  source: 'source',
  referrer: 'referrer_host',
  utm_source: 'utm_source',
  utm_medium: 'utm_medium',
  utm_campaign: 'utm_campaign',
  country: 'country',
  device: 'device',
  browser: 'browser',
  os: 'os',
  language: 'language',
  locale: 'locale',
}

/** One filter: a dimension and the value it must have. */
export interface Filter {
  dimension: Dimension
  value: string
}

const MAX_FILTER_VALUE = 500

/** The filters in a query (`f.page=/about&f.source=Google`): known dimensions only, one value each, at most 10. */
export function parseFilters(query: Record<string, unknown>): Filter[] {
  const out: Filter[] = []
  for (const [key, raw] of Object.entries(query ?? {})) {
    if (!key.startsWith('f.')) continue
    const dimension = key.slice(2)
    const value = Array.isArray(raw) ? raw[0] : raw
    if (!isDimension(dimension) || typeof value !== 'string' || !value || value.length > MAX_FILTER_VALUE) continue
    if (out.some((f) => f.dimension === dimension)) continue
    out.push({ dimension, value })
    if (out.length >= 10) break
  }
  return out
}

/** The filters as query entries again (for links in the admin). */
export function filtersQuery(filters: readonly Filter[]): Record<string, string> {
  return Object.fromEntries(filters.map((f) => [`f.${f.dimension}`, f.value]))
}
