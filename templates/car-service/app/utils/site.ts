// The Garage template's own helpers: its words, the hours and the free days, which photograph
// a look takes, and the groups of the price list. The content is in the CMS; Nuxt auto-imports
// what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { CmsMedia, Page, Service, ServiceGroup, SiteSettings } from '../lib/cms-content'
import { formatPrice } from '../../../kit/app/utils/format'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** Every address is a page built from blocks: nothing in the garage has a page of its own. */
export const ENTRY_PAGES: EntryPage[] = []

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `cenik` (for `/#cenik`). Undefined for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

/** The phone number as a link: Czech numbers are written without the country code. */
export const phoneHref = (phone: string): string => `tel:${phone.startsWith('+') ? '' : '+420'}${phone.replace(/[^\d+]/g, '')}`

/** "Autoservis U Vlečky" → "U Vlečky": the name without the word that says what the business is, for the header. A name without such a word stays whole. */
export function shortNameOf(name: string | null | undefined): string {
  const whole = (name ?? '').trim()
  const rest = whole.replace(/^(?:auto|pneu)?(?:servis|dílna|centrum)\s+(?=\S)/i, '').trim()
  return rest || whole
}

/** "Škoda, Volkswagen" → ["Škoda", "Volkswagen"] */
export const splitList = (text: string | null | undefined): string[] => (text ?? '').split(',').map((s) => s.trim()).filter(Boolean)

/** "Servis a opravy" → "Servis a opravy": the last two words stay together, so no line ends with a lonely preposition. */
export function keepEnd(text: string | null | undefined): string {
  const t = (text ?? '').trim()
  const at = t.lastIndexOf(' ')
  return at === -1 ? t : `${t.slice(0, at)} ${t.slice(at + 1)}`
}

// ── days, hours and free dates ──
// A "day" is a text `2026-11-23` in the site's time zone; the website works in days, never in
// the visitor's own zone. (Moments from the admin are the day's midnight in that zone.)

const ZONE = 'Europe/Prague'
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** A moment as the day it falls on in the site's zone. */
export const dayOf = (moment: Date | string | number): string => dayFormat.format(new Date(moment))

/** The minutes since midnight, in the site's zone. */
export function minutesOf(moment: Date | string | number): number {
  const [h, m] = clockFormat.format(new Date(moment)).split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

const utc = (day: string) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y!, m! - 1, d!) }
/** The day `n` days later (or earlier). */
export const addDays = (day: string, n: number): string => new Date(utc(day) + n * 86_400_000).toISOString().slice(0, 10)
/** 0 for Monday … 6 for Sunday. */
export const weekdayOf = (day: string): number => (new Date(utc(day)).getUTCDay() + 6) % 7
/** "26. 11." */
export const shortDay = (day: string): string => { const [, m, d] = day.split('-').map(Number); return `${d}. ${m}.` }

/** "7.00" → 420; null when it is not a time. */
export function clockMinutes(text: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})[.:](\d{2})\s*$/.exec(text ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export interface DayHours { from: string; to: string; note: string }
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/** The week from Monday, a day without hours being closed (null). */
export function weekHours(hours: SiteSettings['hours'] | null | undefined): Array<DayHours | null> {
  return DAY_KEYS.map((key) => {
    const h = (hours ?? []).find((x) => x.day === key)
    return h && h.from && h.to ? { from: h.from, to: h.to, note: h.note ?? '' } : null
  })
}

export type OpenState = 'open' | 'over' | 'closed'
/** Whether the garage is open today, from the hours and the moment: still to open or open, already over, or closed all day. */
export function openToday(hours: SiteSettings['hours'] | null | undefined, now: number): { hours: DayHours | null; state: OpenState; weekday: number } {
  const weekday = weekdayOf(dayOf(now))
  const today = weekHours(hours)[weekday] ?? null
  if (!today) return { hours: null, state: 'closed', weekday }
  const closes = clockMinutes(today.to)
  return { hours: today, state: closes != null && minutesOf(now) >= closes ? 'over' : 'open', weekday }
}

/** "čtvrtek 26. 11." */
export const longDay = (day: string, w: Words): string => `${w.weekdays[weekdayOf(day)]} ${shortDay(day)}`
/** "ve čtvrtek 26. 11." */
export const onDay = (day: string, w: Words): string => `${w.onWeekdays[weekdayOf(day)]} ${shortDay(day)}`

/** A free day as a headline: "zítra, úterý" when it is tomorrow, "dnes, pondělí" today, else "čtvrtek 26. 11.". */
export function freeDayLine(moment: string | null | undefined, now: number, w: Words): string | null {
  if (!moment) return null
  const day = dayOf(moment), today = dayOf(now)
  if (day === today) return `${w.today}, ${w.weekdays[weekdayOf(day)]}`
  if (day === addDays(today, 1)) return `${w.tomorrow}, ${w.weekdays[weekdayOf(day)]}`
  return longDay(day, w)
}

/** A free day inside a sentence: "ve čtvrtek 26. 11.", "zítra", "dnes". */
export function freeDayInSentence(moment: string | null | undefined, now: number, w: Words): string | null {
  if (!moment) return null
  const day = dayOf(moment), today = dayOf(now)
  if (day === today) return w.today
  if (day === addDays(today, 1)) return w.tomorrow
  return onDay(day, w)
}

/** The days the form offers: "as soon as possible", four working days from the next free one, "another day". */
export function bookingDays(next: string | null | undefined, w: Words): string[] {
  const days: string[] = []
  if (next) {
    let day = dayOf(next)
    while (days.length < 4) {
      if (weekdayOf(day) < 5) days.push(`${w.weekdays[weekdayOf(day)]!.replace(/^./, (c) => c.toUpperCase())} ${shortDay(day)}`)
      day = addDays(day, 1)
    }
  }
  return [w.asap, ...days, w.otherDay]
}

// ── the price list ──

export interface PriceGroup { group: ServiceGroup; items: Service[] }

/** The services under their groups, in the editors' order: the groups by their place, the lines as listed. */
export function priceGroups(groups: ServiceGroup[], services: Service[]): PriceGroup[] {
  return groups
    .map((group) => ({ group, items: services.filter((s) => s.group?.id === group.id) }))
    .filter((g) => g.items.length > 0)
}

/** The price of a line, without "od" and the unit: "1 690 Kč". */
export const priceOf = (s: Pick<Service, 'price'>): string => `${formatPrice(s.price)} Kč`

/** The cheapest line of a group: "480". */
export const lowestPrice = (items: Service[]): number => Math.min(...items.map((i) => i.price))

/** The groups' warning lights in the order the owner chose (else the order of the groups). */
export function lampGroups(groups: ServiceGroup[]): ServiceGroup[] {
  return groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (a.g.lampPosition ?? 1000 + a.i) - (b.g.lampPosition ?? 1000 + b.i))
    .map((x) => x.g)
}

/** The symbols a group can have, as full icon names (so the build finds and bundles them, which a name put together at run time would not). */
export const GROUP_ICONS: Record<ServiceGroup['icon'], string> = {
  'wrench': 'i-lucide-wrench', 'circle-dot': 'i-lucide-circle-dot', 'snowflake': 'i-lucide-snowflake', 'clipboard-check': 'i-lucide-clipboard-check', 'activity': 'i-lucide-activity',
  'car': 'i-lucide-car', 'battery-charging': 'i-lucide-battery-charging', 'gauge': 'i-lucide-gauge', 'settings': 'i-lucide-settings', 'droplets': 'i-lucide-droplets',
}
/** The symbols of a turn of the directions, the same way. */
export const TURN_ICONS: Record<NonNullable<BlockOf<'where'>['turns'][number]['icon']>, string> = {
  'arrow-up': 'i-lucide-arrow-up', 'corner-up-right': 'i-lucide-corner-up-right', 'corner-up-left': 'i-lucide-corner-up-left', 'train-track': 'i-lucide-train-track',
  'flag': 'i-lucide-flag', 'arrow-right': 'i-lucide-arrow-right', 'arrow-left': 'i-lucide-arrow-left',
}

/** The colours of the warning lights, as the dashboard shows them. */
export const LAMP_COLORS: Record<ServiceGroup['lampColor'], string> = { amber: '#ffb224', red: '#ff6a57', green: '#5fe08a', blue: '#74bcff' }

/** The symbols of the warning lights (Material Design Icons, 24 × 24): the dashboard has no Lucide ones. */
export const LAMP_PATHS: Record<ServiceGroup['lamp'], string> = {
  engine: 'M8 10h8v8h-5l-2-2H7v-5m0-7v2h3v2H7l-2 2v3H3v-3H1v8h2v-3h2v3h3l2 2h8v-4h2v3h3V9h-3v3h-2V8h-6V6h3V4z',
  brake: 'M11 15h2v2h-2zm0-8h2v6h-2zm1-4a9 9 0 0 0-9 9a9 9 0 0 0 9 9a9 9 0 0 0 9-9a9 9 0 0 0-9-9m0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7s7 3.14 7 7s-3.14 7-7 7m8.5 1.5c2.16-2.19 3.5-5.19 3.5-8.5s-1.34-6.31-3.5-8.5l-1.08 1.08C21.32 6.5 22.5 9.11 22.5 12c0 2.9-1.18 5.5-3.08 7.42zM4.58 19.42C2.68 17.5 1.5 14.9 1.5 12c0-2.89 1.18-5.5 3.08-7.42L3.5 3.5C1.34 5.69 0 8.69 0 12s1.34 6.31 3.5 8.5z',
  tyre: 'M11 13h2v2h-2zm0-8h2v6h-2zm6-.24c1.86 1.43 3 3.85 3 6.24a8 8 0 0 1-4.14 7H8.14A8 8 0 0 1 4 11c0-2.39 1.09-4.83 3-6.24V2H5v1.86C3.15 5.68 2 8.2 2 11s1.15 5.32 3 7.14V22h2v-2h2v2h2v-2h2v2h2v-2h2v2h2v-3.86c1.85-1.82 3-4.34 3-7.14s-1.15-5.32-3-7.14V2h-2z',
  snow: 'm20.79 13.95l-2.33.62l-2-1.13v-2.88l2-1.13l2.33.62l.52-1.93l-1.77-.47l.46-1.77l-1.93-.52l-.62 2.33l-2 1.13L13 7.38V5.12l1.71-1.71L13.29 2L12 3.29L10.71 2L9.29 3.41L11 5.12v2.26L8.5 8.82l-2-1.13l-.58-2.33L4 5.88l.47 1.77l-1.77.47l.52 1.93l2.33-.62l2 1.13v2.89l-2 1.13l-2.33-.62l-.52 1.93l1.77.47L4 18.12l1.93.52l.62-2.33l2-1.13L11 16.62v2.26l-1.71 1.71L10.71 22L12 20.71L13.29 22l1.41-1.41l-1.7-1.71v-2.26l2.5-1.45l2 1.13l.62 2.33l1.88-.51l-.47-1.77l1.77-.47zM9.5 10.56L12 9.11l2.5 1.45v2.88L12 14.89l-2.5-1.45z',
  wrench: 'M20.96 16.45c.01-.15.04-.3.04-.45v.5zM11 16c0 .71.15 1.39.42 2H6v1c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1v-8l2.08-6c.2-.58.76-1 1.42-1h11c.66 0 1.22.42 1.42 1L21 11v5c0-2.76-2.24-5-5-5s-5 2.24-5 5m-3-2.5c0-.83-.67-1.5-1.5-1.5S5 12.67 5 13.5S5.67 15 6.5 15S8 14.33 8 13.5M19 10l-1.5-4.5h-11L5 10zm3.87 11.19l-4.11-4.11c.41-1.04.18-2.26-.68-3.11c-.9-.91-2.25-1.09-3.34-.59l1.94 1.94l-1.35 1.36l-1.99-1.95c-.54 1.09-.29 2.44.59 3.35a2.91 2.91 0 0 0 3.12.68l4.11 4.1c.18.19.45.19.63 0l1.04-1.03c.22-.18.22-.5.04-.64',
  door: 'M19 14h-3v2h3zm3 7H3V11l8-8h10a1 1 0 0 1 1 1zM11.83 5l-6 6H20V5z',
  battery: 'M4 3v3H1v14h22V6h-3V3h-6v3h-4V3zM3 8h18v10H3zm12 2v2h-2v2h2v2h2v-2h2v-2h-2v-2zM5 12v2h6v-2z',
  oil: 'M22 12.5s2 2.17 2 3.5a2 2 0 0 1-2 2a2 2 0 0 1-2-2c0-1.33 2-3.5 2-3.5M6 6h4a1 1 0 0 1 1 1a1 1 0 0 1-1 1H9v2h2c.74 0 1.39.4 1.73 1l6.51-3.76l3.26 1.89c.5.27.64.87.37 1.37c-.28.47-.87.64-1.37.36l-2.1-1.21l-3.65 6.32c-.34.61-1 1.03-1.75 1.03H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h2V8H6a1 1 0 0 1-1-1a1 1 0 0 1 1-1m-1 6v3h9l2.06-3.57l-3.46 2l-.91-1.43zM.38 9.21L2.09 7.5c.41-.39 1.02-.39 1.41 0s.39 1 0 1.41l-1.71 1.71c-.39.38-1.02.38-1.41 0C0 10.23 0 9.6.38 9.21',
}
/** The snowflake with an exclamation mark, for the frost warning of a seasonal offer. */
export const FROST_PATH = 'M16.46 9.41L13 7.38V5.12l1.71-1.71L13.29 2L12 3.29L10.71 2L9.29 3.41L11 5.12v2.26L8.5 8.82l-2-1.13l-.58-2.33L4 5.88l.47 1.77l-1.77.47l.52 1.93l2.33-.62l2 1.13v2.89l-2 1.13l-2.33-.62l-.52 1.93l1.77.47L4 18.12l1.93.52l.62-2.33l2-1.13L11 16.62v2.26l-1.71 1.71L10.71 22L12 20.71L13.29 22l1.41-1.41l-1.7-1.71v-2.26l3.46-2.01M9.5 10.56L12 9.11l2.5 1.45v2.88L12 14.89l-2.5-1.45M19 13V7h2v6zm0 4v-2h2v2z'

// ── which photographs a look shows ──

type Opening = BlockOf<'hero'>
/** The opening's photograph: Kontrolky's own, Šuplíky's own, else the main one. */
export function openingPhoto(block: Opening, look: string): CmsMedia | null {
  if (look === 'kontrolky') return block.dashImage ?? block.image
  if (look === 'supliky') return block.chestImage ?? block.image
  return block.image
}

/** A seasonal offer is shown from its first day to its last, both included. */
export function isSeasonOn(offer: { validFrom: string | null; validTo: string | null }, now: number): boolean {
  const today = dayOf(now)
  return (!offer.validFrom || dayOf(offer.validFrom) <= today) && (!offer.validTo || today <= dayOf(offer.validTo))
}
