// Visits in plain words, for the Simple view: who came, against when, and how it compares.
// No percentages and no jargon; the Detailed view keeps the usual numbers.

export type VisitsPeriod = 'today' | '7' | '30' | '90'

const fmt = (n: number) => n.toLocaleString('en-GB')

/** "people" or "person". */
export const peopleWord = (n: number) => (n === 1 ? 'person' : 'people')

/** The period, said the way someone would: "this week", and what it is compared with. */
export function periodWords(p: VisitsPeriod): { now: string; against: string; tab: string } {
  switch (p) {
    case 'today': return { now: 'today', against: 'yesterday by now', tab: 'Today' }
    case '7': return { now: 'this week', against: 'last week', tab: 'Week' }
    case '30': return { now: 'this month', against: 'last month', tab: 'Month' }
    case '90': return { now: 'in 3 months', against: 'the 3 months before', tab: '3 months' }
  }
}

/** The period tabs of the Simple view (words) and of the Detailed one (days). */
export function periodTabs(p: VisitsPeriod[], simple: boolean) {
  return p.map((value) => ({ value, label: simple ? periodWords(value).tab : value === 'today' ? 'Today' : `${value} days` }))
}

/**
 * How `now` compares with `before`, in words: "About the same as last week", "179 more than last
 * week", "About a fifth fewer than last month", "About twice as many as yesterday by now".
 * Small changes are said as a number, bigger ones as a rough share.
 */
export function changeInWords(now: number, before: number, against: string): string {
  if (!before) return now ? `Nothing to compare with ${against} yet` : ''
  const ratio = now / before
  const diff = now - before
  if (Math.abs(ratio - 1) < 0.05) return `About the same as ${against}`
  if (Math.abs(ratio - 1) < 0.18) return `${fmt(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'} than ${against}`
  if (ratio > 1) {
    if (ratio < 1.23) return `About a fifth more than ${against}`
    if (ratio < 1.29) return `About a quarter more than ${against}`
    if (ratio < 1.42) return `About a third more than ${against}`
    if (ratio < 1.75) return `About one and a half times as many as ${against}`
    if (ratio < 2.5) return `About twice as many as ${against}`
    return `About ${Math.round(ratio)} times as many as ${against}`
  }
  if (ratio > 0.77) return `About a fifth fewer than ${against}`
  if (ratio > 0.71) return `About a quarter fewer than ${against}`
  if (ratio > 0.58) return `About a third fewer than ${against}`
  if (ratio > 0.42) return `About half as many as ${against}`
  if (ratio > 0.29) return `About a third as many as ${against}`
  if (ratio > 0.18) return `About a quarter as many as ${against}`
  return `Far fewer than ${against}`
}

/**
 * A site's mood over a period: quieter (a drop Keeper told about, or 20 % fewer), busier (20 %
 * more), steady, or new (nothing to compare with). Tiny numbers swing a lot, so a site with fewer
 * than 10 visitors on both sides stays steady unless there is a drop.
 */
export type Mood = 'quiet' | 'busy' | 'steady' | 'new'
export function moodOf(now: number, before: number, drop = false): Mood {
  if (drop) return 'quiet'
  if (!before) return now ? 'new' : 'steady'
  if (Math.max(now, before) < 10) return 'steady'
  const ratio = now / before
  if (ratio <= 0.8) return 'quiet'
  if (ratio >= 1.2) return 'busy'
  return 'steady'
}
export const MOOD_LABELS: Record<Mood, string> = { quiet: 'Quieter than usual', busy: 'Busier than usual', steady: 'Steady', new: 'New' }

/** "just now", "a few minutes ago", "2 hours ago": when the numbers were last read. */
export function updatedAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'not yet'
  const min = Math.floor((now - Date.parse(iso)) / 60_000)
  if (!Number.isFinite(min)) return 'not yet'
  if (min < 2) return 'just now'
  if (min < 15) return 'a few minutes ago'
  if (min < 60) return `${min} minutes ago`
  const h = Math.floor(min / 60)
  if (h < 24) return h === 1 ? 'an hour ago' : `${h} hours ago`
  return timeAgo(iso, now)
}

/** A source or device as people say it. */
const SIMPLE_SOURCES: Record<string, string> = { Direct: 'Typed the address', Other: 'Other websites' }
const SIMPLE_DEVICES: Record<string, string> = { mobile: 'Phone', tablet: 'Tablet', desktop: 'Computer' }
export const simpleSource = (v: string) => SIMPLE_SOURCES[v] ?? v
export const simpleDevice = (v: string) => SIMPLE_DEVICES[v] ?? v.charAt(0).toUpperCase() + v.slice(1)

/** The first day of a drop's week, said as a weekday when it was this week: "Tuesday", "12 Nov". */
export function dropSince(day: string, now = Date.now()): string {
  const start = new Date(`${day}T12:00:00Z`)
  start.setUTCDate(start.getUTCDate() - 6)
  const ago = (now - start.getTime()) / 86_400_000
  return ago < 6.5
    ? start.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
    : start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
