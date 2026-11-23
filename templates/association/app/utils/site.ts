// The Association template's own helpers: its words, the seasons, the calendar (what is coming
// and what is past, by the day), the money strips and which photograph goes where. The content is
// in the CMS; Nuxt auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import { SITE_TIME_ZONE } from '../../../kit/app/utils/format'
import type { Event as CalendarEvent, Page, Project } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** The addresses that lead to an entry instead of a page from blocks: an event, a piece of news. */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'event', prefix: 'akce', entity: 'event', part: 'Event', titleField: 'title', descriptionField: 'summary', imageField: 'photo' },
  { kind: 'news', prefix: 'aktuality', entity: 'news', part: 'Article', titleField: 'title', descriptionField: 'summary', imageField: 'photo' },
]

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `rok` (for `/#rok`). */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

/**
 * Czech typography for the running text, as the design sets it: a one-letter word stays with
 * the word after it, a number with its thousands and with its unit ("1,2 ha", "21 h", "2,4 MB",
 * "250 Kč"), and a day with its month ("26. 11."). The kit's `tidyText` also glues "do", "ve",
 * "za" and the like, which would break the lines of this look at other places than its design.
 */
export const tidy = (text: string | null | undefined): string => (text ?? '')
  .replace(/(?<=^|[\s(])([aikosuvzAIKOSUVZ]) (?=\S)/g, '$1\u00A0')
  .replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00A0')
  .replace(/(\d\.?) (?=(?:Kč|ha|km|h|MB|kB|m n\. m\.|\d{1,2}\.)(?![\wá-ž]))/g, '$1\u00A0')

// ── seasons ──

export type Season = 'zima' | 'jaro' | 'leto' | 'podzim'

/** The season of a month (1–12): winter is December to February, then three months each. */
export const seasonOfMonth = (month: number): Season => (month === 12 || month <= 2 ? 'zima' : month <= 5 ? 'jaro' : month <= 8 ? 'leto' : 'podzim')

/** The tint of a season's cards, and the colour of its small mark (written out so the stylesheet finds the classes). */
export const TINT: Record<Season, string> = { zima: 'bg-zima', jaro: 'bg-jaro', leto: 'bg-leto', podzim: 'bg-podzim' }
export const MARK: Record<Season, string> = { zima: 'bg-zima-m', jaro: 'bg-jaro-m', leto: 'bg-leto-m', podzim: 'bg-podzim-m' }

/** A project's season as the looks name it; null for a project of the whole year. */
export function projectSeason(season: Project['season'] | null | undefined): Season | null {
  return season === 'winter' ? 'zima' : season === 'spring' ? 'jaro' : season === 'summer' ? 'leto' : season === 'autumn' ? 'podzim' : null
}

// ── the calendar, by the day ──
// Everything about "now" is a day written `2026-11-23` in the site's time zone: an event is
// coming until its own day is over.

const PARTS = new Intl.DateTimeFormat('en-GB', { timeZone: SITE_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })

export interface DayParts {
  /** "2026-11-28" */
  key: string
  year: number
  /** 1–12 */
  month: number
  day: number
  hour: number
  minute: number
  /** 0 is Sunday */
  weekday: number
}

/** A moment taken apart in the site's time zone. Null when there is none. */
export function dayParts(iso: string | Date | null | undefined): DayParts | null {
  if (!iso) return null
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return null
  const get = (type: string) => Number(PARTS.formatToParts(d).find((p) => p.type === type)?.value ?? 0)
  const year = get('year'), month = get('month'), day = get('day')
  const pad = (n: number) => String(n).padStart(2, '0')
  return { key: `${year}-${pad(month)}-${pad(day)}`, year, month, day, hour: get('hour'), minute: get('minute'), weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() }
}

/** Today as a day key in the site's time zone. */
export const todayKey = (now: Date = new Date()): string => dayParts(now)!.key

/** "9:00" for a start at nine o'clock; "" for midnight (a date without a time). */
export function clockOf(p: DayParts | null): string {
  return !p || (p.hour === 0 && p.minute === 0) ? '' : `${p.hour}:${String(p.minute).padStart(2, '0')}`
}

/** "9:00" → "9", "9:30" → "9:30": a time as a sentence says it ("od 9 do 14 hodin"). */
export const hourOf = (clock: string | null | undefined): string => {
  const m = /^\s*(\d{1,2})[.:](\d{2})\s*$/.exec(clock ?? '')
  return m ? (m[2] === '00' ? String(Number(m[1])) : `${Number(m[1])}:${m[2]}`) : (clock ?? '').trim()
}

/** A time as the list writes it: "17:00", "12:00" (also from "17.00"). */
export const clockText = (clock: string | null | undefined): string => {
  const m = /^\s*(\d{1,2})[.:](\d{2})\s*$/.exec(clock ?? '')
  return m ? `${Number(m[1])}:${m[2]}` : (clock ?? '').trim()
}

/** Events that are still to come (today's included), the nearest first, and the past ones, the newest first. */
export function splitEvents<T extends { date: string }>(events: T[], today: string): { coming: T[]; past: T[] } {
  const dated = events.map((e) => ({ e, key: dayParts(e.date)?.key ?? '' })).filter((x) => x.key)
  const byDate = (a: { e: T }, b: { e: T }) => a.e.date.localeCompare(b.e.date)
  return {
    coming: dated.filter((x) => x.key >= today).sort(byDate).map((x) => x.e),
    past: dated.filter((x) => x.key < today).sort((a, b) => byDate(b, a)).map((x) => x.e),
  }
}

/** The events grouped by the month they fall in, in the order given. */
export function groupByMonth<T extends { date: string }>(events: T[]): Array<{ key: string; month: number; events: T[] }> {
  const groups: Array<{ key: string; month: number; events: T[] }> = []
  for (const e of events) {
    const p = dayParts(e.date)
    if (!p) continue
    const key = p.key.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.events.push(e)
    else groups.push({ key, month: p.month, events: [e] })
  }
  return groups
}

/** A text as a sentence: with its full stop when it has no end mark. */
export const sentence = (text: string | null | undefined): string => {
  const t = (text ?? '').trim()
  return !t || /[.!?…]$/.test(t) ? t : `${t}.`
}

/** "Sušárna Na Vrších, do 12:00. Stloukáme budky." — the line under an event's name in the list (what to bring follows it). */
export function eventLead(e: Pick<CalendarEvent, 'place' | 'endTime' | 'summary'>): string {
  const where = [e.place?.trim(), e.endTime ? `do ${clockText(e.endTime)}` : ''].filter(Boolean).join(', ')
  return [sentence(where), sentence(e.summary)].filter(Boolean).join(' ')
}

/** "so 28. 11.": the day of an event in a line of the form's choices. */
export function eventShort(e: Pick<CalendarEvent, 'date'>, words: Words): string {
  const p = dayParts(e.date)
  return p ? `${words.weekdaysShort[p.weekday]} ${words.shortDate(p.day, p.month)}` : ''
}

/** The choice of the form that signs up for an event: the same text the event's "Přihlásit se" puts there. */
export const signupTopic = (e: Pick<CalendarEvent, 'title' | 'date'>, words: Words): string => words.signUpForOption(e.title, eventShort(e, words))

/** An event's own words for the "sign up" answer: the day it ends and why. */
export function signupBy(e: Pick<CalendarEvent, 'signupBy'>, words: Words): string {
  const p = dayParts(e.signupBy)
  return p ? `${words.weekdaysUntil[p.weekday]} ${words.shortDate(p.day, p.month)}` : ''
}

/** How many places an event has left; null when the places are not counted. */
export const placesLeft = (e: Pick<CalendarEvent, 'capacity' | 'registered'>): number | null => (e.capacity ? Math.max(0, e.capacity - (e.registered ?? 0)) : null)

// ── the money strips ──

/** The tint of the n-th of `count` pieces of a strip, in percent of the strip's own colour: from the full colour down. */
export function stripShades(count: number): number[] {
  if (count === 6) return [100, 84, 70, 56, 42, 30]
  if (count === 7) return [100, 86, 73, 61, 49, 38, 28]
  return Array.from({ length: count }, (_, i) => (count < 2 ? 100 : Math.round(100 - (70 * i) / (count - 1))))
}

export interface StripPiece { name: string; amount: number; flex: number; shade: number }

/** The pieces of a strip, each as wide as its share of `scale` (the larger of the two totals, so the strips compare). */
export function stripPieces(items: Array<{ name: string; amount: number | null }>, scale: number): StripPiece[] {
  const shades = stripShades(items.length)
  return items.map((it, i) => ({ name: it.name, amount: it.amount ?? 0, flex: scale > 0 ? Math.round(((it.amount ?? 0) / scale) * 10000) / 100 : 0, shade: shades[i]! }))
}

/** A text with a *marked* part and a `{email}`: its pieces, for the look to draw each its way. */
export function receiptParts(text: string | null | undefined, email: string | null | undefined): Array<{ text: string; kind: 'plain' | 'bold' | 'email' }> {
  const parts: Array<{ text: string; kind: 'plain' | 'bold' | 'email' }> = []
  for (const piece of (text ?? '').split(/(\*[^*]+\*|\{email\})/g)) {
    if (!piece) continue
    if (piece === '{email}') { if (email) parts.push({ text: email, kind: 'email' }) }
    else if (/^\*[^*]+\*$/.test(piece)) parts.push({ text: piece.slice(1, -1), kind: 'bold' })
    else parts.push({ text: piece, kind: 'plain' })
  }
  return parts
}

// ── documents ──

/** The documents by year, the newest year first, each year's documents in the editors' order; the ones without a year come last as one group. */
export function documentGroups<T extends { year: number | null; position: number | null }>(documents: T[], years = 0): Array<{ year: number | null; items: T[] }> {
  const byPosition = (a: T, b: T) => (a.position ?? 0) - (b.position ?? 0)
  const numbers = [...new Set(documents.map((d) => d.year).filter((y): y is number => y != null))].sort((a, b) => b - a)
  const shown = years > 0 ? numbers.slice(0, years) : numbers
  const groups: Array<{ year: number | null; items: T[] }> = shown.map((year) => ({ year, items: documents.filter((d) => d.year === year).sort(byPosition) }))
  const permanent = documents.filter((d) => d.year == null).sort(byPosition)
  if (permanent.length) groups.push({ year: null, items: permanent })
  return groups
}

/** How many years of documents there are, to tell whether older ones were left out. */
export const documentYears = (documents: Array<{ year: number | null }>): number => new Set(documents.map((d) => d.year).filter((y) => y != null)).size
