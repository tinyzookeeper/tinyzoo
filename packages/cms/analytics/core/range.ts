/**
 * The periods the admin offers, as calendar days in the site's time zone (`YYYY-MM-DD`, both
 * ends included), each with the period it is compared with. Pure date arithmetic on day
 * strings; the server turns days into instants in SQL, in the site's time zone.
 * No `import`s of anything server-side: the admin page uses this file too.
 */

export const PERIODS = ['today', 'yesterday', '7d', '30d', 'month', 'lastmonth', '12m', 'custom'] as const
export type Period = (typeof PERIODS)[number]

export const isPeriod = (v: unknown): v is Period => typeof v === 'string' && (PERIODS as readonly string[]).includes(v)

export interface DayRange { from: string; to: string }

export interface ResolvedRange extends DayRange {
  period: Period
  /** Hours for a single day, days otherwise. */
  bucket: 'hour' | 'day'
  /** How many days the range has. */
  days: number
  previous: DayRange
}

const DAY_MS = 86_400_000
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
/** The longest custom range: two years. */
export const MAX_RANGE_DAYS = 731

const toMs = (d: string) => {
  const m = DAY.exec(d)!
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function isDay(v: unknown): v is string {
  if (typeof v !== 'string' || !DAY.test(v)) return false
  return fromMs(toMs(v)) === v
}

export const addDays = (d: string, n: number) => fromMs(toMs(d) + n * DAY_MS)
export const daysBetween = (from: string, to: string) => Math.round((toMs(to) - toMs(from)) / DAY_MS) + 1

/** Every day from `from` to `to`, both included. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

const firstOfMonth = (d: string) => `${d.slice(0, 7)}-01`
const lastOfMonth = (d: string) => addDays(firstOfMonth(addDays(firstOfMonth(d), 32)), -1)
const previousMonth = (d: string) => firstOfMonth(addDays(firstOfMonth(d), -1))

/** The same date a year earlier (29 February becomes the 28th). */
function yearEarlier(d: string): string {
  const y = Number(d.slice(0, 4)) - 1
  const candidate = `${y}${d.slice(4)}`
  return isDay(candidate) ? candidate : `${y}-02-28`
}

function shifted(r: DayRange): DayRange {
  const n = daysBetween(r.from, r.to)
  return { from: addDays(r.from, -n), to: addDays(r.to, -n) }
}

/**
 * The days of `period` as seen on `today`, and the period before it. `custom` takes `from` and
 * `to` (swapped when given the wrong way round, never past today, at most two years); a custom
 * range that is not valid falls back to the last 30 days.
 */
export function resolveRange(period: Period, today: string, custom: { from?: unknown; to?: unknown } = {}): ResolvedRange {
  let r: DayRange
  let previous: DayRange | null = null
  switch (period) {
    case 'today': r = { from: today, to: today }; break
    case 'yesterday': r = { from: addDays(today, -1), to: addDays(today, -1) }; break
    case '7d': r = { from: addDays(today, -6), to: today }; break
    case '30d': r = { from: addDays(today, -29), to: today }; break
    case 'month': {
      r = { from: firstOfMonth(today), to: today }
      // The same days of the month before (1–19 November against 1–19 October), cut at its end.
      const prevFrom = previousMonth(today)
      const sameDay = `${prevFrom.slice(0, 8)}${today.slice(8)}`
      previous = { from: prevFrom, to: isDay(sameDay) && sameDay <= lastOfMonth(prevFrom) ? sameDay : lastOfMonth(prevFrom) }
      break
    }
    case 'lastmonth': {
      const from = previousMonth(today)
      r = { from, to: lastOfMonth(from) }
      const before = previousMonth(from)
      previous = { from: before, to: lastOfMonth(before) }
      break
    }
    case '12m': {
      r = { from: addDays(yearEarlier(today), 1), to: today }
      previous = { from: yearEarlier(r.from), to: addDays(r.from, -1) }
      break
    }
    case 'custom': {
      let from = isDay(custom.from) ? custom.from : null
      let to = isDay(custom.to) ? custom.to : null
      if (!from || !to) return resolveRange('30d', today)
      if (from > to) [from, to] = [to, from]
      if (to > today) to = today
      if (from > to) from = to
      if (daysBetween(from, to) > MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1))
      r = { from, to }
      break
    }
  }
  const days = daysBetween(r.from, r.to)
  return { period, ...r, bucket: days === 1 ? 'hour' : 'day', days, previous: previous ?? shifted(r) }
}

/**
 * Which days of a range come from the raw views and which from the daily totals: days before
 * `firstRawDay` (today minus `keepRawDays`) have totals only.
 */
export function splitByCutoff(r: DayRange, firstRawDay: string): { rolled: DayRange | null; raw: DayRange | null } {
  const rolledTo = r.to < firstRawDay ? r.to : addDays(firstRawDay, -1)
  const rawFrom = r.from > firstRawDay ? r.from : firstRawDay
  return {
    rolled: r.from <= rolledTo ? { from: r.from, to: rolledTo } : null,
    raw: rawFrom <= r.to ? { from: rawFrom, to: r.to } : null,
  }
}

/**
 * The points of a chart of the range: hours (`'0'`…`'23'`) for one day, else every day. For
 * today, the hours so far (`untilHour`).
 */
export function seriesKeys(r: Pick<ResolvedRange, 'from' | 'to' | 'bucket'>, untilHour?: number): string[] {
  if (r.bucket === 'hour') {
    const last = untilHour === undefined ? 23 : Math.max(0, Math.min(23, untilHour))
    return Array.from({ length: last + 1 }, (_, h) => String(h))
  }
  return eachDay(r.from, r.to)
}
