// The Restaurant template's own helpers: its words, the opening hours and whether the doors are
// open now, the menu by sections, today's lunch, the next events, and which photographs each look
// takes. The content is in the CMS; Nuxt auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { CmsMedia, DailyMenu, Dish, Event, MenuCategory, Page, SiteSettings } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** Every address is a page built from blocks: the restaurant has no entries with pages of their own. */
export const ENTRY_PAGES: EntryPage[] = []

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `poledni` (for `/#poledni`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── the site's clock ──
// The restaurant is open by the clock of the place, whatever the visitor's own says.

const ZONE = 'Europe/Prague'

export interface ClockParts {
  /** 0 is Monday … 6 is Sunday */
  weekday: number
  /** the hour with its minutes as a decimal: 13.5 is half past one */
  hour: number
  /** "2026-11-23" */
  date: string
}

const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

/** A moment as the place's wall clock shows it. */
export function clockOf(ms: number): ClockParts {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { weekday: WEEKDAYS[get('weekday')] ?? 0, hour: Number(get('hour')) + Number(get('minute')) / 60, date: `${get('year')}-${get('month')}-${get('day')}` }
}

/** The day of a stored date (all-day dates sit at 0:00 of the place): "2026-11-23". */
export function dayOf(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? '' : clockOf(ms).date
}

/** "2026-11-23" plus some days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10)
}

// ── opening hours ──

export type OpeningHours = NonNullable<SiteSettings['openingHours']>

export interface DayHours {
  /** the hour it opens, as a decimal; null for a day that is closed */
  open: number | null
  /** the hour it closes; above 24 for a night that goes past midnight */
  close: number | null
  /** "11:00" as written (the hour taken modulo 24) */
  from: string
  to: string
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** "25:00" → [25, 0]: hour and minutes of a typed time; null when it is not one. */
function timeOf(text: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(text ?? '')
  return m ? Number(m[1]) + Number(m[2]) / 60 : null
}
/** 11.5 → "11:30"; hours past 24 wrap round to the next day's clock. */
export function timeText(hour: number): string {
  const h = Math.floor(hour + 1e-9), m = Math.round((hour - h) * 60)
  return `${h % 24}:${String(m).padStart(2, '0')}`
}

/** The week's seven days, Monday first; a day the list leaves out is closed. */
export function weekHours(list: OpeningHours | null | undefined): DayHours[] {
  return DAY_KEYS.map((key) => {
    const day = (list ?? []).find((d) => d.day === key)
    const open = day && !day.closed ? timeOf(day.from) : null
    const close = day && !day.closed ? timeOf(day.to) : null
    if (open == null || close == null) return { open: null, close: null, from: '', to: '' }
    return { open, close: close <= open ? close + 24 : close, from: timeText(open), to: timeText(close) }
  })
}

/** "11:00–22:00", or "" for a closed day. */
export const rangeText = (day: DayHours | undefined): string => (day && day.open != null ? `${day.from}–${day.to}` : '')

export interface OpenState {
  /** whether the doors are open at that moment */
  open: boolean
  /** open: "until" the closing time; closed: "today" later, "tomorrow", or "later" on another day */
  when: 'until' | 'today' | 'tomorrow' | 'later'
  /** the time to say: when it closes, or when it opens next */
  time: string
  /** the weekday of the next opening, for "later" */
  day: number
}

/** Whether the restaurant is open at a moment, and what to say about it. Null when no hours are set. */
export function openState(week: DayHours[], ms: number): OpenState | null {
  if (!week.some((d) => d.open != null)) return null
  const { weekday, hour } = clockOf(ms)
  const today = week[weekday]!
  const yesterday = week[(weekday + 6) % 7]!
  // (last night's opening that went on past midnight)
  if (yesterday.close != null && yesterday.close > 24 && hour < yesterday.close - 24) return { open: true, when: 'until', time: yesterday.to, day: weekday }
  if (today.open != null && today.close != null) {
    if (hour >= today.open && hour < today.close) return { open: true, when: 'until', time: today.to, day: weekday }
    if (hour < today.open) return { open: false, when: 'today', time: today.from, day: weekday }
  }
  for (let k = 1; k <= 7; k++) {
    const next = week[(weekday + k) % 7]!
    if (next.open != null) return { open: false, when: k === 1 ? 'tomorrow' : 'later', time: next.from, day: (weekday + k) % 7 }
  }
  return null
}

/** The week's hours as short lines for a footer: "Po–Čt 11–22" for days that share them. */
export function hoursSummary(week: DayHours[], short: string[]): string[] {
  const groups: Array<{ first: number; last: number; range: string }> = []
  week.forEach((day, i) => {
    if (day.open == null) return
    const range = `${day.from.replace(':00', '')}–${day.to.replace(':00', '')}`
    const last = groups[groups.length - 1]
    if (last && last.last === i - 1 && last.range === range) last.last = i
    else groups.push({ first: i, last: i, range })
  })
  return groups.map((g) => `${g.first === g.last ? short[g.first] : `${short[g.first]}–${short[g.last]}`} ${g.range}`)
}

// ── the address ──

/** "Kmínová 58, Jičín": the street and the town, for a line that is short. */
export const shortAddress = (s: Pick<SiteSettings, 'street' | 'city'> | null | undefined): string => [s?.street, s?.city].filter(Boolean).join(', ')

/** "731 204 586": the number as written. A number is a link to call it where the look makes it one. */
export const phoneText = (s: Pick<SiteSettings, 'phone'> | null | undefined): string => (s?.phone ?? '').trim()

// ── the menu ──

/** A dish's allergens as the numbers: "1, 3, 7" → ["1", "3", "7"]. */
export const allergenList = (text: string | null | undefined): string => (text ?? '').split(/[,;\s]+/).filter(Boolean).join(', ')

/** "150 g · alergeny 1, 3, 7": a dish's weight and its allergens as one line. */
export function metaLine(amount: string | null | undefined, allergens: string | null | undefined, word: string): string {
  const list = allergenList(allergens)
  return [(amount ?? '').trim(), list ? `${word} ${list}` : ''].filter(Boolean).join(' · ')
}

export interface MenuSection {
  category: MenuCategory
  dishes: Dish[]
}

/** The menu by its sections, in the editors' order: a section with no dish to show is left out. */
export function menuSections(categories: MenuCategory[], dishes: Dish[]): MenuSection[] {
  return categories
    .map((category) => ({ category, dishes: dishes.filter((d) => !d.hidden && d.category?.id === category.id) }))
    .filter((s) => s.dishes.length > 0)
}

// ── today's lunch ──

/** The lunch the page shows: the one of today, else the next that comes, else the last there was. */
export function lunchOf(menus: DailyMenu[], ms: number): { menu: DailyMenu; today: boolean } | null {
  if (!menus.length) return null
  const today = clockOf(ms).date
  const days = menus.map((menu) => ({ menu, day: dayOf(menu.date) })).sort((a, b) => a.day.localeCompare(b.day))
  const exact = days.find((d) => d.day === today)
  if (exact) return { menu: exact.menu, today: true }
  const next = days.find((d) => d.day > today)
  return { menu: (next ?? days[days.length - 1]!).menu, today: false }
}

/** The lowest price of a day's main courses (the "from 149 Kč" of an opening); null when it has none. */
export function lunchFrom(menu: Pick<DailyMenu, 'mains'> | null | undefined): number | null {
  const prices = (menu?.mains ?? []).map((m) => m.price).filter((n): n is number => typeof n === 'number')
  return prices.length ? Math.min(...prices) : null
}

// ── events ──

/** The events that have not ended yet, the soonest first, as many as asked for. */
export function upcomingEvents(events: Event[], ms: number, limit: number | null | undefined): Event[] {
  const today = clockOf(ms).date
  return events
    .filter((e) => (dayOf(e.dateTo) || dayOf(e.dateFrom)) >= today)
    .sort((a, b) => dayOf(a.dateFrom).localeCompare(dayOf(b.dateFrom)))
    .slice(0, limit ?? 3)
}

/** An event's days as a short line: "27.–29. 11." or "6. 12."; with `monthless` "27.–29." for a look that writes the month apart. */
export function eventDays(event: Pick<Event, 'dateFrom' | 'dateTo'>, monthless = false): string {
  const from = dayOf(event.dateFrom).split('-').map(Number), to = event.dateTo ? dayOf(event.dateTo).split('-').map(Number) : null
  if (from.length < 3) return ''
  const month = monthless ? '' : ` ${from[1]}.`
  if (!to || (to[2] === from[2] && to[1] === from[1])) return `${from[2]}.${month}`
  if (to[1] === from[1]) return `${from[2]}.–${to[2]}.${month}`
  return `${from[2]}. ${from[1]}. – ${to[2]}. ${to[1]}.`
}

/** The month of an event, in words: "listopad" (for a look that prints it above the day). */
export function eventMonth(event: Pick<Event, 'dateFrom'>): string {
  return event.dateFrom ? new Intl.DateTimeFormat('cs-CZ', { timeZone: ZONE, month: 'long' }).format(new Date(event.dateFrom)) : ''
}

// ── which photographs a look shows ──
// One set of content serves three designs that place photographs differently. These rules are
// the only place that knows which look takes which.

type Photo = { image: CmsMedia | null }
const withImage = <T extends Photo>(items: T[] | null | undefined): Array<T & { image: CmsMedia }> => (items ?? []).filter((p): p is T & { image: CmsMedia } => !!p.image)

/**
 * Which of the gallery's photographs each look takes, by their place in the list, and in what
 * order they hang: Salon the first six, Talíř the first three and the last three of nine
 * (the ones shot from above in the middle), Paragon nine in its own order.
 */
export const GALLERY_PICKS: Record<string, number[]> = {
  salon: [0, 1, 2, 3, 4, 5],
  talir: [0, 7, 1, 2, 8, 6],
  paragon: [0, 1, 3, 6, 2, 4, 5, 8, 7],
}

/** A gallery's photographs in this look: its picks that the list has. */
export function galleryPhotos(block: BlockOf<'gallery'>, look: string) {
  const all = withImage(block.photos)
  return (GALLERY_PICKS[look] ?? GALLERY_PICKS.salon!).map((i) => all[i]).filter((p): p is (typeof all)[number] => !!p)
}

/** A text's two paragraphs: the first, and the rest (a look sets the second quieter). */
export function twoParagraphs(text: string | null | undefined): [first: string, rest: string[]] {
  const all = (text ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return [all[0] ?? '', all.slice(1)]
}

/** The plan's text for Salon, without the minutes: "autobusy 6 min" → "autobusy". */
export const planWord = (text: string | null | undefined): string => (text ?? '').replace(/\s*\d.*$/, '').trim()

/** The tagline for a look that follows it with the town: "bistro & kavárna" → "bistro a kavárna". */
export const taglineWithAnd = (text: string | null | undefined): string => (text ?? '').replace(/\s*&\s*/g, ' a ')
