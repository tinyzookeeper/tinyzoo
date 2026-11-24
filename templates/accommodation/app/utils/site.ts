// The Accommodation template's own helpers: its words, the seasons of the year drawn as a
// ribbon, the months of a trip, and the names of rooms. The content is in the CMS; Nuxt
// auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import { dateParts } from '../../../kit/app/utils/format'
import type { Page, Room, Season, Trip } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** A room has a page of its own (/pokoj/jerabina); every other address is a page built from blocks. */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'room', prefix: 'pokoj', entity: 'room', part: 'Room', titleField: 'name', descriptionField: 'summary' },
]

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `pokoje` (for `/#pokoje`). Undefined for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── rooms ──

type RoomLike = Pick<Room, 'kind' | 'name' | 'slug'>

/** "Pokoj Jeřabina", "Apartmán Arnika". */
export const roomTitle = (words: Words, room: Pick<Room, 'kind' | 'name'>): string => `${words.kind[room.kind]} ${room.name}`
/** The address of a room's page. */
export const roomHref = (room: Pick<RoomLike, 'slug'>): string => `/pokoj/${room.slug}`
/** The room's own lines: "2 lůžka · 18 m² · podkroví". */
export function roomFacts(words: Words, room: Pick<Room, 'beds' | 'area' | 'floor'>): string[] {
  return [words.beds(room.beds), room.area ? `${room.area} m²` : '', words.floor[room.floor]].filter(Boolean)
}

// ── the year ──

/** The day and the month of a stored date; the year does not matter for a season. */
function monthDay(iso: string | null | undefined): { month: number; day: number } | null {
  const parts = dateParts(iso)
  return parts ? { month: Number(parts.monthNumber), day: Number(parts.day) } : null
}

const DAYS_BEFORE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
/** The day of an ordinary year (1 to 365) of a month and a day. */
const dayOfYear = (md: { month: number; day: number }): number => DAYS_BEFORE[md.month - 1]! + md.day

/** "15. 3." */
export function dayMonth(iso: string | null | undefined): string {
  const md = monthDay(iso)
  return md ? `${md.day}. ${md.month}.` : ''
}

type RangeOf = Season['ranges'][number]
/** "15. 3. – 30. 6." */
export const rangeText = (r: RangeOf, joiner = '–'): string => `${dayMonth(r.from)} ${joiner} ${dayMonth(r.to)}`
/** All of a season's ranges: "15. 3. – 30. 6. a 1. 9. – 19. 12." */
export const seasonDates = (season: Pick<Season, 'ranges'>, between = ' a '): string => season.ranges.map((r) => rangeText(r)).join(between)

export interface RibbonSegment {
  /** What it spans, in days of the year. */
  days: number
  tone: Season['tone'] | 'none'
  /** The words written in it on a wide screen ("Zima · hlavní sezóna"); empty for a short one. */
  label: string
  /** Where it starts, in percent of the year. */
  at: number
}

/**
 * The seasons as one ribbon over the year: each range of each season is a stretch of days
 * (a range over New Year is two), in the order of the calendar. Days that no season covers
 * stay a quiet gap, so the ribbon is always the whole year.
 */
export function ribbonSegments(seasons: Season[]): RibbonSegment[] {
  const found: Array<{ from: number; to: number; tone: Season['tone']; label: string }> = []
  for (const season of seasons) {
    for (const r of season.ranges) {
      const a = monthDay(r.from)
      const b = monthDay(r.to)
      if (!a || !b) continue
      const from = dayOfYear(a)
      const to = dayOfYear(b)
      const label = r.label ? `${r.label} · ${season.name.toLowerCase()}` : ''
      if (to >= from) found.push({ from, to, tone: season.tone, label })
      else { found.push({ from, to: 365, tone: season.tone, label }); found.push({ from: 1, to, tone: season.tone, label }) }
    }
  }
  found.sort((x, y) => x.from - y.from)
  const out: RibbonSegment[] = []
  let next = 1
  const push = (days: number, tone: RibbonSegment['tone'], label: string) => {
    out.push({ days, tone, label, at: ((next - 1) / 365) * 100 })
    next += days
  }
  for (const s of found) {
    if (s.from > next) push(s.from - next, 'none', '')
    const from = Math.max(s.from, next)
    if (s.to >= from) push(s.to - from + 1, s.tone, s.label)
  }
  if (next <= 365) push(366 - next, 'none', '')
  return out
}

/** "2. 1. až 14. 3. a 1. 7. až 31. 8." for the ribbon's description. */
export const seasonSpoken = (season: Pick<Season, 'name' | 'ranges'>): string => `${season.name.toLowerCase()} ${season.ranges.map((r) => rangeText(r, 'až')).join(' a ')}`

/** Where today falls on the ribbon, in percent (the middle of the day), clamped to its ends. */
export function todayPercent(now: Date): number {
  const start = new Date(now.getFullYear(), 0, 1)
  const days = (now.getTime() - start.getTime()) / 864e5
  return Math.min(99.5, Math.max(0.5, ((days + 0.5) / 365) * 100))
}

// ── trips ──

export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'
export const SEASON_KEYS: SeasonKey[] = ['spring', 'summer', 'autumn', 'winter']

/** The seasons a trip suits. */
export const tripSeasons = (trip: Pick<Trip, SeasonKey>): SeasonKey[] => SEASON_KEYS.filter((k) => trip[k])

/** The twelve months as a trip uses them: on or off. Without both months the whole year. */
export function tripMonths(trip: Pick<Trip, 'fromMonth' | 'toMonth'>): boolean[] {
  const from = Number(trip.fromMonth)
  const to = Number(trip.toMonth)
  if (!from || !to) return Array.from({ length: 12 }, () => true)
  return Array.from({ length: 12 }, (_, i) => (from <= to ? i + 1 >= from && i + 1 <= to : i + 1 >= from || i + 1 <= to))
}

/** "prosinec – březen", or "celý rok". */
export function tripMonthsText(words: Words, trip: Pick<Trip, 'fromMonth' | 'toMonth'>): string {
  const from = Number(trip.fromMonth)
  const to = Number(trip.toMonth)
  return from && to ? `${words.months[from - 1]} – ${words.months[to - 1]}` : words.allYear.toLowerCase()
}

/** The pills of a trip in From the Door: its seasons ("celý rok" when all four), then its own tag. */
export function tripPills(words: Words, trip: Pick<Trip, SeasonKey | 'tag'>): string[] {
  const seasons = tripSeasons(trip)
  const pills = seasons.length === SEASON_KEYS.length ? [words.allYear.toLowerCase()] : seasons.map((k) => words.seasonNames[k])
  return trip.tag ? [...pills, trip.tag] : pills
}

/** "3,5 km" → 3.5, "600 m" → 0.6; null when the text is not a distance. */
export function kilometres(distance: string | null | undefined): number | null {
  const m = /^\s*([\d\s]+(?:[.,]\d+)?)\s*(km|m)\b/i.exec(distance ?? '')
  if (!m) return null
  const n = Number(m[1]!.replace(/\s/g, '').replace(',', '.'))
  return m[2]!.toLowerCase() === 'km' ? n : n / 1000
}

// ── reviews ──

/** The month of the stay as a number (1 to 12), and "srpen 2026". */
export function stayedMonth(iso: string | null | undefined): number | null {
  const parts = dateParts(iso)
  return parts ? Number(parts.monthNumber) : null
}
export function stayedText(words: Words, iso: string | null | undefined): string {
  const parts = dateParts(iso)
  return parts ? `${words.months[Number(parts.monthNumber) - 1]} ${parts.year}` : ''
}

// ── what the blocks hand to the looks ──

/** A room with what the cards and the table need: its cheapest night and its price in each season. */
export interface RoomRow {
  room: Room
  from: number | null
  prices: Array<{ season: Season; amount: number }>
  /** One amount per season, in the seasons' order; null where the room has no price. */
  amounts: Array<number | null>
}
