// The Event template's own helpers: its words, how an elevation profile is drawn, which fee
// period holds, how results are grouped. The content is in the CMS; Nuxt auto-imports what is
// exported here. (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import { dateParts } from '../../../kit/app/utils/format'
import type { FeePeriod, Page, Result, Track } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** The addresses that lead to an entry instead of a page from blocks: a news item. */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'news', prefix: 'aktuality', entity: 'newsItem', part: 'NewsEntry', descriptionField: 'summary', imageField: 'image' },
]

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `program` (for `/#program`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

/** "sokolovna" → "Sokolovna": the place of a programme item where a look writes it as a sentence. */
export const ucfirst = (text: string | null | undefined): string => {
  const t = text ?? ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** The icons of the practical-information cards, by the name the editor chooses. (Written out so the icon bundle finds them.) */
export const INFO_ICON_NAMES: Record<string, string> = {
  'parking': 'i-lucide-square-parking', 'locker': 'i-lucide-shirt', 'refreshments': 'i-lucide-cup-soda', 'bus': 'i-lucide-bus',
  'train': 'i-lucide-train-front', 'toilet': 'i-lucide-toilet', 'medic': 'i-lucide-heart-pulse', 'tent': 'i-lucide-tent',
  'info': 'i-lucide-info', 'bike': 'i-lucide-bike', 'food': 'i-lucide-utensils', 'camera': 'i-lucide-camera',
}

/** A size class for the name of the event by its length: the design's size for its own short name, smaller for a longer one. */
export const NAME_LENGTHS = { short: 10, medium: 18 } as const

// ── the fee periods ──

/** "28. 2." from an ISO moment: the day and the month as a number, for a table head. */
export function shortDay(iso: string | null | undefined): string {
  const p = dateParts(iso)
  return p ? `${p.day}. ${p.monthNumber}.` : ''
}

/**
 * The index of the fee period that holds at `now` (milliseconds): the first whose last day has
 * not passed; the open-ended one (no date) holds for ever. Before the page has a clock (on the
 * server, and in the browser's first drawing) it is the first period, so the two drawings agree.
 */
export function currentPeriod(periods: FeePeriod[], now: number | null): number {
  if (now == null) return periods.length ? 0 : -1
  for (const [i, p] of periods.entries()) {
    if (!p.validUntil) return i
    // (an all-day date is stored at the start of its day: it holds to the end of it)
    if (now < Date.parse(p.validUntil) + 86_400_000) return i
  }
  return -1
}

/** A route's price in the period (a number), or null. */
export const priceIn = (track: Track, period: number): number | null => (period >= 0 ? track.prices?.[period]?.price ?? null : null)

/** The head of a fee column in two lines: the first and the second as the looks write them. */
export function periodHead(period: FeePeriod, eventDay: string, words: Words, current: boolean, nowLabel: string): [string, string] {
  const until = period.validUntil ? words.until(shortDay(period.validUntil)) : ''
  if (current) return [nowLabel, until || period.name]
  return period.validUntil ? [period.name, until] : [eventDay, period.name]
}

// ── places ──

/** Places left on every route, and in all. */
export function placesOf(tracks: Track[]): { free: number; capacity: number; taken: number } {
  const free = tracks.reduce((n, t) => n + (t.free ?? 0), 0)
  const capacity = tracks.reduce((n, t) => n + (t.capacity ?? 0), 0)
  return { free, capacity, taken: capacity ? Math.round(((capacity - free) / capacity) * 1000) / 10 : 0 }
}

/** The share of a route's places that are taken, in percent. */
export function takenPercent(track: Pick<Track, 'free' | 'capacity'>): number {
  const cap = track.capacity ?? 0
  return cap ? Math.round(((cap - (track.free ?? 0)) / cap) * 1000) / 10 : 0
}

// ── elevation profiles ──

export interface ProfilePoint { km: number; m: number }

/** "4.5 724" lines → points; a comma is accepted as the decimal sign. */
export function parseProfile(text: string | null | undefined): ProfilePoint[] {
  const points: ProfilePoint[] = []
  for (const line of (text ?? '').split(/\r?\n/)) {
    const m = /^\s*(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*$/.exec(line)
    if (m) points.push({ km: Number(m[1]!.replace(',', '.')), m: Number(m[2]!.replace(',', '.')) })
  }
  return points.sort((a, b) => a.km - b.km)
}

export interface ProfileScale {
  /** The lowest and the highest point of all the routes: the one vertical scale of every profile. */
  lo: number
  hi: number
  /** The length of the longest route, in km: the kilometre axis. */
  kmMax: number
}

export function profileScale(tracks: Track[]): ProfileScale {
  let lo = Infinity
  let hi = -Infinity
  let kmMax = 0
  for (const t of tracks) {
    for (const p of parseProfile(t.profile)) {
      lo = Math.min(lo, p.m)
      hi = Math.max(hi, p.m)
      kmMax = Math.max(kmMax, p.km)
    }
  }
  return { lo: Number.isFinite(lo) ? lo : 0, hi: Number.isFinite(hi) ? hi : 1, kmMax: kmMax || 1 }
}

/** A height as a y in the drawing's 0–100 box: the highest point of all at 10, the lowest at 91.5. */
export const profileY = (m: number, s: ProfileScale): number => (s.hi === s.lo ? 80 : 10 + ((s.hi - m) / (s.hi - s.lo)) * 81.5)

const r1 = (n: number) => (Math.round(n * 10) / 10).toString()

export interface ProfileDrawing {
  /** The route's own length in km. */
  km: number
  /** The line, in a 1000 × 100 box. */
  line: string
  /** The line closed down to the bottom: the hill. */
  area: string
  /** The route's length as a share of the longest one, in percent. */
  width: number
  /** The marked peaks, placed in percent of the drawing's box. */
  peaks: Array<{ left: number; top: number; text: string; main: boolean; wordOnly: boolean }>
}

/** A route's profile as a smooth line (a Catmull-Rom curve through the points), at the shared vertical scale. */
export function drawProfile(track: Track, s: ProfileScale): ProfileDrawing | null {
  const pts = parseProfile(track.profile)
  if (pts.length < 2) return null
  const km = pts[pts.length - 1]!.km
  const xy = pts.map((p) => [(p.km / km) * 1000, profileY(p.m, s)] as const)
  let d = `M${r1(xy[0]![0])} ${r1(xy[0]![1])}`
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[Math.max(0, i - 1)]!
    const p1 = xy[i]!
    const p2 = xy[i + 1]!
    const p3 = xy[Math.min(xy.length - 1, i + 2)]!
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`
  }
  const yAt = (at: number) => {
    const i = pts.findIndex((p) => p.km >= at)
    if (i <= 0) return profileY(pts[0]!.m, s)
    const a = pts[i - 1]!
    const b = pts[i]!
    return profileY(a.m + ((b.m - a.m) * (at - a.km)) / (b.km - a.km || 1), s)
  }
  const high = Math.max(...(track.peaks ?? []).map((p) => p.height ?? 0))
  const peaks = (track.peaks ?? []).map((p) => {
    const km = Number(p.km ?? 0)
    const wordOnly = !p.height && !!p.label
    const main = !wordOnly && p.height === high
    return {
      left: Math.round((km / s.kmMax) * 1000) / 10,
      // (a label sits above its point; a word without a height, a little lower)
      top: Math.round((yAt(km) - (wordOnly ? 18 : 30.7)) * 10) / 10,
      text: wordOnly ? p.label! : main ? `${p.height} m` : String(p.height),
      main: main || wordOnly,
      wordOnly,
    }
  })
  return { km, line: d, area: `${d}L1000 100L0 100Z`, width: Math.round((km / s.kmMax) * 1000) / 10, peaks }
}

// ── results ──

export interface ResultGroup { track: Track; rows: Result[] }

/** The results of a year by route (in the editors' order of the routes); `all` keeps every place, else only the winners. */
export function groupResults(results: Result[], year: number | null | undefined, all: boolean | null | undefined): ResultGroup[] {
  const groups = new Map<string, ResultGroup>()
  for (const r of results) {
    if (year && r.year !== year) continue
    if (!all && r.place !== 1) continue
    const t = r.track as Track | null
    if (!t) continue
    if (!groups.has(t.id)) groups.set(t.id, { track: t, rows: [] })
    groups.get(t.id)!.rows.push(r)
  }
  const order = (t: Track) => t.position ?? 0
  const list = [...groups.values()].sort((a, b) => order(a.track) - order(b.track))
  const categories: string[] = []
  for (const r of results) if (!categories.includes(r.category)) categories.push(r.category)
  for (const g of list) g.rows.sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category) || a.place - b.place)
  return list
}

// ── small helpers of the looks ──

/** "1:44:38" → ["1", "44", "38"]: a time taken apart where a look sets the colons itself. */
export const timeParts = (time: string | null | undefined): string[] => (time ?? '').split(':')

/** "7:30" → ["07", "30"] (a programme time with its hour in two digits); null when it is not a time. */
export function clockParts(time: string | null | undefined): [string, string] | null {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(time ?? '')
  return m ? [m[1]!.padStart(2, '0'), m[2]!] : null
}

/** A date as numbers: "18. 11. 2026"; `pad` writes the day and the month with two digits ("04. 11. 2026"). */
export function numericDate(iso: string | null | undefined, pad = false): string {
  const p = dateParts(iso)
  if (!p) return ''
  const two = (v: string) => (pad ? v.padStart(2, '0') : v)
  return `${two(p.day)}. ${two(p.monthNumber)}. ${p.year}`
}

/** The aspect of a photograph snapped to the three the strips use. */
export function aspectOf(media: { width: number | null; height: number | null } | null | undefined): string {
  const r = media?.width && media?.height ? media.width / media.height : 1.5
  return r > 1.15 ? 'aspect-[3/2]' : r < 0.9 ? 'aspect-[4/5]' : 'aspect-square'
}

/** The text with its `{total}` and `{free}` filled in from the routes. */
export const withPlaces = (text: string | null | undefined, places: { free: number; capacity: number }): string => (text ?? '').replace(/\{total\}/g, String(places.capacity)).replace(/\{free\}/g, String(places.free))
