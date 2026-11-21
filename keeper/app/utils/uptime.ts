// Uptime in words: the 30-day strip, the sentence above it, the causes of incidents and the
// speed of the site, for the Simple view of a site's page (auto-imported from app/utils).
import type { CheckPoint, Incident } from '#keeper/types/keeper'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** up: no downtime; short: down under 30 min; long: 30 min or more, or still down; none: no checks yet. */
export type UptimeDayTone = 'up' | 'short' | 'long' | 'none'

export interface UptimeDay {
  /** Local midnight that starts the day. */
  start: number
  tone: UptimeDayTone
  /** Downtime inside the day, in ms. */
  downMs: number
  /** "Wed 18 Nov: down 9 min" */
  label: string
  today: boolean
}

/** Whole minutes in words: "under a minute", "9 min", "2 h 5 min", "1 day 3 h". */
export function minutesInWords(ms: number): string {
  const minutes = Math.round(ms / MINUTE)
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return `${d === 1 ? '1 day' : `${d} days`}${rh ? ` ${rh} h` : ''}`
}

const end = (i: Incident, now: number) => (i.endedAt ? Date.parse(i.endedAt) : now)
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

/** The day in the viewer's language of dates: "Wed 18 Nov". */
export const dayName = (t: number) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * The last 30 days in the viewer's time zone, oldest first, today last: each day's downtime from
 * the incidents, clipped to the day's bounds (today ends now).
 */
export function uptimeDays(incidents: Incident[], firstCheckAt: string | null, now: number): UptimeDay[] {
  const first = firstCheckAt ? Date.parse(firstCheckAt) : null
  const days: UptimeDay[] = []
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 29)
  for (let k = 0; k < 30; k++) {
    const start = d.getTime()
    d.setDate(d.getDate() + 1)
    const today = k === 29
    const stop = today ? now : d.getTime()
    let downMs = 0
    let ongoing = false
    for (const i of incidents) {
      const o = overlap(Date.parse(i.startedAt), end(i, now), start, stop)
      if (!o && !(today && !i.endedAt)) continue
      downMs += o
      if (!i.endedAt) ongoing = true
    }
    const tone: UptimeDayTone = first == null || stop <= first ? 'none' : ongoing || downMs >= 30 * MINUTE ? 'long' : downMs > 0 ? 'short' : 'up'
    const what = tone === 'none' ? 'no checks yet'
      : ongoing && today ? `down now, for ${minutesInWords(downMs)}`
      : downMs > 0 ? `down ${minutesInWords(downMs)}`
      : today ? 'up so far' : 'up all day'
    days.push({ start, tone, downMs, label: `${dayName(start)}: ${what}`, today })
  }
  return days
}

/** The strip in one sentence, for its aria-label. */
export function stripSummary(days: UptimeDay[]): string {
  const down = days.filter((d) => d.tone === 'short' || d.tone === 'long').length
  const none = days.filter((d) => d.tone === 'none').length
  const now = days.at(-1)?.label.includes('down now')
  const parts = [down ? `Down on ${down === 1 ? '1 day' : `${down} days`} of the last 30` : none === days.length ? 'No checks in the last 30 days yet' : 'Up every day of the last 30 days']
  if (now) parts.push('down right now')
  if (none && none < days.length) parts.push(`no checks yet on the first ${none === 1 ? 'day' : `${none} days`}`)
  return `${parts.join(', ')}.`
}

/** The incidents that touch the last 30 days (rolling), with their downtime inside them. */
export function downtime30d(incidents: Incident[], now: number) {
  const from = now - 30 * DAY
  const inside = incidents.filter((i) => end(i, now) > from)
  return { count: inside.length, ms: inside.reduce((sum, i) => sum + overlap(Date.parse(i.startedAt), end(i, now), from, now), 0) }
}

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

/** "Up the whole time", "Down twice in the last 30 days, 14 min in total". */
export function uptimeHeadline(count: number, ms: number): string {
  if (!count) return 'Up the whole time'
  return `Down ${times(count)} in the last 30 days, ${minutesInWords(ms)} in total`
}

/** The typical (median) answer time of the successful checks, or null without any. */
export function typicalMs(checks: CheckPoint[]): number | null {
  const ms = checks.filter((c) => c.ok && c.ms != null).map((c) => c.ms!).sort((a, b) => a - b)
  return ms.length ? ms[Math.floor(ms.length / 2)]! : null
}

/** "Pages answer in about 0.3 s, which is quick." Under 0.6 s quick, under 1.5 s fine, else slow. */
export function speedInWords(ms: number): string {
  const s = ms < 100 ? 'under 0.1 s' : `about ${(Math.round(ms / 100) / 10).toLocaleString('en-GB')} s`
  const word = ms < 600 ? 'quick' : ms < 1500 ? 'fine' : 'slow'
  return `Pages answer in ${s}, which is ${word}.`
}

type CauseKind = 'server' | 'timeout' | 'refused' | 'dns' | 'certificate' | 'other'

/** What an incident's raw cause (as the uptime check saw it) is about. */
export function causeKind(cause: string | null | undefined): CauseKind {
  const c = (cause ?? '').toLowerCase()
  if (/certificate|cert_|tls|ssl|https/.test(c)) return 'certificate'
  if (/enotfound|eai_again|dns|address not found|lookup/.test(c)) return 'dns'
  if (/timeout|timed out|no answer within|etimedout/.test(c)) return 'timeout'
  if (/econnrefused|refused|unreachable|ehostunreach|econnreset|reset/.test(c)) return 'refused'
  if (/http\s*5\d\d/.test(c)) return 'server'
  return 'other'
}

/** An incident's cause in plain words. */
export function causeInWords(cause: string | null | undefined): string {
  return {
    server: 'The server didn’t answer properly.',
    timeout: 'The site took too long to answer.',
    refused: 'Nothing answered.',
    dns: 'The address couldn’t be found.',
    certificate: 'A problem with the certificate.',
    other: 'The site didn’t answer as it should.',
  }[causeKind(cause)]
}

/** What is wrong right now, for a site that is down: "Nothing answers at the site’s address." */
export function downNowInWords(cause: string | null | undefined): string {
  return {
    server: 'The server answers with an error.',
    timeout: 'The site takes too long to answer.',
    refused: 'Nothing answers at the site’s address.',
    dns: 'The site’s address can’t be found.',
    certificate: 'The site’s certificate has a problem.',
    other: 'The site doesn’t answer as it should.',
  }[causeKind(cause)]
}

/** "Today, 15:20", "Yesterday, 09:12", "Wed 18 Nov, 14:02" in the viewer's time zone. */
export function incidentWhen(iso: string, now: number): string {
  const t = new Date(iso)
  const time = t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const ms = t.getTime()
  if (ms >= midnight.getTime()) return `Today, ${time}`
  if (ms >= midnight.getTime() - DAY) return `Yesterday, ${time}`
  return `${dayName(ms)}, ${time}`
}
