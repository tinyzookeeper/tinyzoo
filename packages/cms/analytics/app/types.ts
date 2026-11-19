/** A point of the Analytics page's chart. */
export interface ChartPoint { key: string; label: string; visitors: number; pageviews: number }

/** A row of a bar list. */
export interface BarItem {
  /** The value filtered by. */
  key: string
  label: string
  /** A second line (a page's address under its title). */
  sub?: string
  prefix?: string
  value: number
  /** The full numbers, for the row's tooltip. */
  detail?: string
  to?: string
}
