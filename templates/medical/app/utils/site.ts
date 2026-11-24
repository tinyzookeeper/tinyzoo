// The Medical template's own helpers: its words, the opening hours worked out for a day and a
// moment, which notices are valid, and small rules both looks share. The content is in the CMS;
// Nuxt auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import { SITE_TIME_ZONE } from '../../../kit/app/utils/format'
import type { Insurer, Notice, OpeningHour, Page, Service } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** Every address is a page built from blocks: the practice has no entries with pages of their own. */
export const ENTRY_PAGES: EntryPage[] = []

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `hodiny` (for `/#hodiny`). Undefined for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── opening hours ──
// One collection holds them (a row is a part of a day); everything the looks write about
// "today", "open now" and "tomorrow" is worked out here from those rows and a moment.

/** JavaScript's `getDay()` gives the index: 0 is Sunday. */
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type DayKey = typeof DAY_KEYS[number]
/** The week as a practice writes it, Monday first. */
export const WEEK: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export type HourKind = OpeningHour['kind']

/** "7:00", "07.30" or "7" in minutes since midnight; -1 for what is not a time. */
export function toMinutes(text: string | null | undefined): number {
  const m = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*$/.exec(text ?? '')
  if (!m) return -1
  const h = Number(m[1]), min = Number(m[2] ?? 0)
  return h > 24 || min > 59 ? -1 : h * 60 + min
}

/** 450 → "7:30" */
export const timeText = (minutes: number): string => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`

/** "7:00" → "7", "7:30" stays: the shorter way the clock face writes a time. */
export const shortTime = (text: string): string => text.replace(/:00$/, '')

/** One part of a day, with its times as minutes. */
export interface Seg {
  id: string
  day: DayKey
  from: string
  to: string
  fromM: number
  toM: number
  note: string
  kind: HourKind
}

/** The rows of the collection by day, each day in time order. A row with times that make no sense is left out. */
export function weekOf(hours: OpeningHour[] | null | undefined): Record<DayKey, Seg[]> {
  const week = Object.fromEntries(DAY_KEYS.map((d) => [d, [] as Seg[]])) as Record<DayKey, Seg[]>
  const rows = [...(hours ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  for (const h of rows) {
    const fromM = toMinutes(h.from), toM = toMinutes(h.to)
    if (fromM < 0 || toM <= fromM || !week[h.day]) continue
    week[h.day].push({ id: h.id, day: h.day, from: timeText(fromM), to: timeText(toM), fromM, toM, note: h.note ?? '', kind: h.kind })
  }
  for (const d of DAY_KEYS) week[d].sort((a, b) => a.fromM - b.fromM)
  return week
}

/** The stretches a day is open without a break: rows that follow each other make one. */
export function stretchesOf(segs: Seg[]): Array<{ from: string; to: string; fromM: number; toM: number }> {
  const out: Array<{ from: string; to: string; fromM: number; toM: number }> = []
  for (const s of segs) {
    const last = out[out.length - 1]
    if (last && last.toM === s.fromM) { last.to = s.to; last.toM = s.toM }
    else out.push({ from: s.from, to: s.to, fromM: s.fromM, toM: s.toM })
  }
  return out
}

/** "7:00–13:00" or, for several stretches, "7:00–11:00 a 13:00–15:00" (`short`: "7–11 a 13–15"). */
export function spanTextOf(segs: Seg[], and: string, short = false): string {
  const t = short ? shortTime : (x: string) => x
  return stretchesOf(segs).map((s) => `${t(s.from)}–${t(s.to)}`).join(` ${and} `)
}

/** A moment on the practice's wall clock. */
export interface Moment {
  day: DayKey
  /** Minutes since midnight. */
  minutes: number
  /** The day of the month. */
  date: number
  /** 0 to 11. */
  month: number
  year: number
  /** "2026-11-25" */
  iso: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const momentOf = (year: number, month: number, date: number, minutes: number): Moment => ({
  day: DAY_KEYS[new Date(Date.UTC(year, month, date)).getUTCDay()]!, minutes, date, month, year, iso: `${year}-${pad(month + 1)}-${pad(date)}`,
})

/** The wall clock of the practice's town at an instant. */
export function momentFromDate(at: Date): Moment {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: SITE_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return momentOf(get('year'), get('month') - 1, get('day'), get('hour') * 60 + get('minute'))
}

/** "2026-11-25T09:40" as a moment on the wall clock itself (the address's `?now=` shows how the site reads at that time); null for anything else. */
export function momentFromText(text: string | null | undefined): Moment | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?$/.exec((text ?? '').trim())
  return m ? momentOf(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0) * 60 + Number(m[5] ?? 0)) : null
}

/** What the practice does on a day at a moment. */
export interface TodayState {
  day: DayKey
  segs: Seg[]
  /** The stretch we are open in right now, if any. */
  open: { from: string; to: string } | null
  /** The part of the day that is on now, if any. */
  current: Seg | null
  /** The next stretch today, when closed right now. */
  later: { from: string; to: string } | null
  /** The next day with hours, and whether it is tomorrow. */
  next: { day: DayKey; segs: Seg[]; tomorrow: boolean } | null
}

export function todayOf(week: Record<DayKey, Seg[]>, now: Moment): TodayState {
  const segs = week[now.day]
  const stretches = stretchesOf(segs)
  const open = stretches.find((s) => s.fromM <= now.minutes && now.minutes < s.toM) ?? null
  const later = open ? null : stretches.find((s) => s.fromM > now.minutes) ?? null
  const at = DAY_KEYS.indexOf(now.day)
  let next: TodayState['next'] = null
  for (let i = 1; i <= 7 && !next; i++) {
    const day = DAY_KEYS[(at + i) % 7]!
    if (week[day].length) next = { day, segs: week[day], tomorrow: i === 1 }
  }
  return { day: now.day, segs, open, current: segs.find((s) => s.fromM <= now.minutes && now.minutes < s.toM) ?? null, later, next }
}

/** Whether a part of a day is on right now. */
export const isOn = (seg: Seg, now: Moment | null): boolean => !!now && seg.day === now.day && seg.fromM <= now.minutes && now.minutes < seg.toM

/** The days with hours, in week order, and the days without (closed). */
export function openAndClosed(week: Record<DayKey, Seg[]>): { open: DayKey[]; closed: DayKey[] } {
  return { open: WEEK.filter((d) => week[d].length), closed: WEEK.filter((d) => !week[d].length) }
}

// ── notices ──

/** The day a notice is checked against, "2026-11-25": the practice's town, not the visitor's. */
export const dayOf = (iso: string | null | undefined): string => (iso ? new Intl.DateTimeFormat('en-CA', { timeZone: SITE_TIME_ZONE }).format(new Date(iso)) : '')

/** The notices that are valid on a day (`today` as "2026-11-25"), the important first in their order, then the rest. */
export function validNotices(notices: Notice[] | null | undefined, today: string): Notice[] {
  const valid = [...(notices ?? [])]
    .filter((n) => (!n.validFrom || dayOf(n.validFrom) <= today) && (!n.validTo || today <= dayOf(n.validTo)))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  return valid
}

/** The one notice shown large (the first important), and the others. */
export function splitNotices(valid: Notice[]): { main: Notice | null; rest: Notice[] } {
  const main = valid.find((n) => n.important) ?? null
  return { main, rest: valid.filter((n) => n !== main) }
}

/** A notice's paragraphs: the first is the message, the others are what to do about it. */
export const noticeParts = (text: string): { first: string; more: string[] } => {
  const [first = '', ...more] = paragraphsOf(text)
  return { first, more }
}

/** A text's paragraphs: an empty line starts a new one. (The kit's `paragraphs`, for code outside Nuxt.) */
export const paragraphsOf = (text: string | null | undefined): string[] => (text ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

// ── services, insurers, team ──

/** The services insurance pays for, in the editors' order. */
export const coveredServices = (all: Service[]): Service[] => all.filter((s) => s.covered)
/** The services that are paid by the patient, with a price. */
export const paidServices = (all: Service[]): Service[] => all.filter((s) => !s.covered)

/** "Všeobecná zdravotní pojišťovna (VZP)": the full name with the abbreviation, unless the name already has it. */
export const insurerLabel = (i: Insurer): string => (i.name.includes(i.short) ? i.name : `${i.name} (${i.short})`)

/** "111 JZP": what the appointment form offers. */
export const insurerOption = (i: Insurer): string => `${i.code} ${i.short}`

/** The icons a fact about getting here may have, as Lucide icons. */
export const FACT_ICONS: Record<string, string> = {
  bus: 'i-lucide-bus', parking: 'i-lucide-square-parking', access: 'i-lucide-accessibility', door: 'i-lucide-door-open', car: 'i-lucide-car', info: 'i-lucide-info',
}

/** The icons a notice may have. */
export const NOTICE_ICONS: Record<string, string> = {
  'bell': 'i-lucide-bell', 'shield-plus': 'i-lucide-shield-plus', 'info': 'i-lucide-info', 'calendar': 'i-lucide-calendar', 'phone': 'i-lucide-phone',
}

/** Clock Face's rows of facts: the bus stop is told by the minute rings, the rest in the order access, door, parking. */
export function factsForRows<T extends { icon: string | null }>(facts: T[]): T[] {
  const order = ['access', 'door', 'parking']
  const rank = (f: T) => { const i = order.indexOf(f.icon ?? ''); return i === -1 ? order.length : i }
  return facts.filter((f) => f.icon !== 'bus').map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i).map((x) => x.f)
}

/** The colour of a kind of hours on Ciferník's clock face and in its legend. */
export const KIND_COLOR: Record<HourKind, string> = { walkin: 'var(--brand)', booked: 'var(--second)', samples: 'var(--sun)' }
