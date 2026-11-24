// The Office template's own helpers: its words, the name's two halves, the services by group,
// the office hours, and the ruler of deadlines. The content is in the CMS; Nuxt auto-imports
// what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import { byLength, dateParts } from '../../../kit/app/utils/format'
import type { Deadline, Page, Service, ServiceGroup, SiteSettings } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** The addresses that lead to an entry instead of a page from blocks: a case study, an article. */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'case', prefix: 'pripad', entity: 'caseStudy', part: 'Case', descriptionField: 'outcome', imageField: 'image' },
  { kind: 'article', prefix: 'clanek', entity: 'article', part: 'Article', descriptionField: 'summary' },
]

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `sluzby` (for `/#sluzby`). */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── the name ──

/** "Tesař & Vondrová" → ["Tesař", "Vondrová"]; a name that is not two names joined by "&", "a", "and" or "+" stays whole. */
export function partnersOf(name: string | null | undefined): [first: string, second: string | null] {
  const whole = (name ?? '').trim().replace(/\s+/g, ' ')
  const pair = /^(.+?)\s*(?:&|\+|\band\b|\ba\b)\s*(.+)$/i.exec(whole)
  return pair ? [pair[1]!, pair[2]!] : [whole, null]
}

/** "Tesař, Vondrová…" → what stands before the first comma ("truhlářská dílna, 8 zaměstnanců" → "truhlářská dílna"). */
export const beforeComma = (text: string | null | undefined): string => (text ?? '').split(',')[0]!.trim()

/** "123 456 700" → the number with non-breaking spaces, so it never breaks across lines. */
export const phoneText = (phone: string | null | undefined): string => (phone ?? '').trim().replace(/\s+/g, ' ')

/** "12. 11. 2026": the date as the office's lists write it. */
export function numericDate(iso: string | null | undefined): string {
  const d = dateParts(iso)
  return d ? `${d.day}. ${d.monthNumber}. ${d.year}` : ''
}

/** The address on one line ("Vrbová 28, 586 01 Jihlava") or, `short`, without the postcode ("Vrbová 28, Jihlava"). */
export function addressOf(s: Pick<SiteSettings, 'street' | 'zip' | 'city'> | null | undefined, short = false): string {
  // (the postcode keeps its two halves together: "586 01")
  const town = short ? s?.city : [s?.zip?.replace(/\s+/g, '\u00A0'), s?.city].filter(Boolean).join(' ')
  return [s?.street, town].filter(Boolean).join(', ')
}

/** A heading split into its sentences, each of which a look may set on a line of its own (a marked part is never cut). */
export function headingLines(heading: string | null | undefined): string[] {
  const lines: string[] = []
  for (const piece of (heading ?? '').trim().split(/(?<=[.!?])\s+/)) {
    const last = lines.length - 1
    // (a piece inside a *marked* part belongs to the line before it)
    if (last >= 0 && (lines[last]!.match(/\*/g)?.length ?? 0) % 2 === 1) lines[last] += ` ${piece}`
    else lines.push(piece)
  }
  return lines.filter(Boolean)
}

// ── the services, by group ──

export interface ServiceGroupWithItems {
  group: ServiceGroup
  /** 0, 1, 2…: Šanony gives each group its own colour by this */
  index: number
  items: Service[]
}

/** The groups in the editors' order, each with its services (a service whose group is gone is left out). */
export function groupServices(groups: ServiceGroup[], services: Service[]): ServiceGroupWithItems[] {
  return groups
    .map((group, index) => ({ group, index, items: services.filter((s) => s.group?.id === group.id) }))
    .filter((g) => g.items.length > 0)
}

/** "od 3 900 Kč" → ["od", "3 900 Kč"]; any other price with the spine's own note under it. */
export function spinePrice(service: Pick<Service, 'price' | 'spineNote'>): [top: string, bottom: string] {
  const price = (service.price ?? '').trim()
  const from = /^od\s+(.+)$/i.exec(price)
  return from ? ['od', from[1]!] : [price, (service.spineNote ?? '').trim()]
}

/** How many spines the shelf holds: more would be too narrow to read. */
export const SHELF_MAX = 10

/** The services as the shelf stands them: in the groups' order, each in its group's colour. */
export function shelfOf(grouped: ServiceGroupWithItems[]): Array<{ service: Service; tone: 'a' | 'b' | 'c' }> {
  return grouped.flatMap((g) => g.items.map((service) => ({ service, tone: toneOf(g.index) }))).slice(0, SHELF_MAX)
}

/** The class of Šanony's large headings by their length: the design's own size for its own wording, smaller for a longer one. */
export const displaySize = (text: string | null | undefined): string => byLength(text, [
  [34, 'text-[42px] sm:text-[64px] xl:text-[76px]'],
  [60, 'text-[34px] sm:text-[48px] xl:text-[56px]'],
], 'text-[28px] sm:text-[38px] xl:text-[44px]')

/** The heights of the spines on the shelf (percent of its height), taken in turn: a shelf is never quite even. */
export const SPINE_HEIGHTS = [100, 93, 97, 100, 95, 100, 91, 98]

/** The colour of a group's spines and price tags: one of three, in turn. */
export const toneOf = (groupIndex: number): 'a' | 'b' | 'c' => (['a', 'b', 'c'] as const)[groupIndex % 3]!

// ── office hours ──

const DAY_INDEX: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }

export interface HoursDay { day: number; from: string; to: string }
export interface HoursGroup { days: number[]; from: string; to: string }

/** The settings' hours as lines per day, Monday first. */
export function hoursDays(hours: SiteSettings['hours'] | null | undefined): HoursDay[] {
  return (hours ?? [])
    .filter((h) => h.day && h.from && h.to)
    .map((h) => ({ day: DAY_INDEX[h.day!]!, from: h.from, to: h.to }))
    .sort((a, b) => a.day - b.day)
}

/** Days with the same hours, next to each other, as one group: Mon–Thu 8:00–16:30, Friday 8:00–13:00. */
export function hoursGroups(hours: SiteSettings['hours'] | null | undefined): HoursGroup[] {
  const groups: HoursGroup[] = []
  for (const d of hoursDays(hours)) {
    const last = groups[groups.length - 1]
    if (last && last.from === d.from && last.to === d.to && last.days[last.days.length - 1] === d.day - 1) last.days.push(d.day)
    else groups.push({ days: [d.day], from: d.from, to: d.to })
  }
  return groups
}

/** "po–čt", "pátek" (`short`: "pá"); days that are not next to each other are listed ("po, st"). */
export function groupLabel(group: HoursGroup, w: Pick<Words, 'dayLong' | 'dayLower'>, short = false): string {
  const first = group.days[0]!
  const last = group.days[group.days.length - 1]!
  if (group.days.length === 1) return (short ? w.dayLower : w.dayLong)[first]!
  if (last - first + 1 === group.days.length) return `${w.dayLower[first]}–${w.dayLower[last]}`
  return group.days.map((d) => w.dayLower[d]).join(', ')
}

/** "8:00–16:30" */
export const hoursSpan = (h: { from: string; to: string }): string => `${h.from}–${h.to}`

const hourOf = (time: string): number => {
  const m = /^\s*(\d{1,2})(?:[.:](\d{2}))?\s*$/.exec(time)
  return m ? Number(m[1]) + Number(m[2] ?? 0) / 60 : Number.NaN
}

/** A bar on the 7 to 18 hours scale of the hours table: where it starts and how long it is, in percent. */
export function hoursBar(h: { from: string; to: string }, start = 7, end = 18): { left: string; width: string } {
  const from = Math.min(Math.max(hourOf(h.from), start), end)
  const to = Math.min(Math.max(hourOf(h.to), start), end)
  const pct = (v: number) => `${Math.round(((v - start) / (end - start)) * 10000) / 100}%`
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return { left: '0%', width: '0%' }
  return { left: pct(from), width: `${Math.round(((to - from) / (end - start)) * 10000) / 100}%` }
}

// ── the ruler of deadlines ──
// Lhůty draws the nearest deadlines on a 100-day ruler, 12 px a day, with today two days from its
// start. Which deadlines are "upcoming" depends on today's date, so it is worked out in the
// browser after the page is drawn (the server draws the ruler empty), and the demo's dates are
// written by the seed relative to the day it runs.

/** The days the ruler shows beyond today: a flag is 218 px wide, so it must start before the last 18 days of the 100. */
export const RULER_DAYS = 80
/** Where today stands on the ruler, in days from its start. */
export const RULER_TODAY = 2
const FLAG_DAYS = 19

export interface Flag {
  id: string
  /** "25. 11." */
  date: string
  text: string
  /** days from today */
  days: number
  /** "za 2 dny", "za týden", for the nearest ones only */
  chip: string
  /** the flag's place on the ruler, in days from its start */
  n: number
  /** the row it hangs in, so two neighbours do not write over each other */
  level: 0 | 1
}

export interface RulerMonth { n: number; label: string }

/** The day number of a date in the site's time zone: the same for two moments on the same day. */
function dayNumber(iso: string): number | null {
  const d = dateParts(iso)
  return d ? Math.floor(Date.UTC(Number(d.year), Number(d.monthNumber) - 1, Number(d.day)) / 86_400_000) : null
}

/** The nearest deadlines from today on (today included), each with its place on the ruler. */
export function upcomingDeadlines(items: Deadline[], now: Date, limit: number, w: Pick<Words, 'today' | 'tomorrow' | 'inDays' | 'inWeek'>): Flag[] {
  const today = dayNumber(now.toISOString())
  if (today == null) return []
  const flags: Flag[] = []
  for (const item of items) {
    const day = dayNumber(item.date)
    if (day == null) continue
    const days = day - today
    if (days < 0 || days > RULER_DAYS) continue
    const d = dateParts(item.date)!
    const chip = days === 0 ? w.today : days === 1 ? w.tomorrow : days === 7 ? w.inWeek : days < 7 ? w.inDays(days) : ''
    flags.push({ id: item.id, date: `${d.day}. ${d.monthNumber}.`, text: item.text, days, chip, n: days + RULER_TODAY, level: 0 })
  }
  flags.sort((a, b) => a.days - b.days || a.text.localeCompare(b.text, 'cs'))
  const shown = flags.slice(0, Math.max(1, limit || 6))
  // The upper row when the lower one is still taken by the flag before.
  const free = [-Infinity, -Infinity]
  for (const f of shown) {
    const row = free[0]! <= f.n ? 0 : free[1]! <= f.n ? 1 : free[0]! <= free[1]! ? 0 : 1
    f.level = row as 0 | 1
    free[row] = f.n + FLAG_DAYS
  }
  return shown
}

/** The months on the ruler: the first of each month that falls on it, and the month the ruler starts in. */
export function rulerMonths(now: Date, nameOf: (utcNoon: Date) => string): RulerMonth[] {
  const today = dayNumber(now.toISOString())
  if (today == null) return []
  const start = today - RULER_TODAY
  const first = new Date(start * 86_400_000)
  const marks: RulerMonth[] = [{ n: 0, label: nameOf(first) }]
  for (let k = 1; ; k++) {
    const month = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + k, 1, 12))
    const n = Math.floor(month.getTime() / 86_400_000) - start
    if (n > 98) break
    marks.push({ n, label: nameOf(month) })
  }
  // (the month the ruler starts in has no room for its name when the next one begins right after)
  if (marks.length > 1 && marks[1]!.n < 8) marks.shift()
  return marks
}

/** "listopad", and "leden 2027" for a January: a month's name as the ruler writes it. */
export function monthLabel(utcNoon: Date): string {
  const name = new Intl.DateTimeFormat('cs-CZ', { month: 'long', timeZone: 'UTC' }).format(utcNoon)
  return utcNoon.getUTCMonth() === 0 ? `${name} ${utcNoon.getUTCFullYear()}` : name
}

/** The moment the ruler counts from, in the site's time zone, as the legend writes it: "pondělí", "23. 11. 2026". */
export function legendOf(now: Date): { weekday: string; date: string } | null {
  const d = dateParts(now.toISOString())
  return d ? { weekday: d.weekday, date: `${d.day}. ${d.monthNumber}. ${d.year}` } : null
}
