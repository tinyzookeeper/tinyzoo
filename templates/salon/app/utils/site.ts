// The Salon template's own helpers: its words, the opening hours as numbers, the price list in
// its groups, and the days the booking form offers. The content is in the CMS; Nuxt
// auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { Page, Person, PersonEmbedded, Service, ServiceGroup, SiteSettings } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** Every address is a page built from blocks: the salon has no entries with pages of their own. */
export const ENTRY_PAGES: EntryPage[] = []

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `cenik` (for `/#cenik`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── the opening hours ──

const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/** One day of the week, Monday first. `from` and `to` are hours as numbers (8.5 is half past eight), null when closed. */
export interface OpenDay {
  /** 0 is Monday, 6 is Sunday */
  index: number
  /** "Pondělí" */
  name: string
  /** "Po" */
  short: string
  from: number | null
  to: number | null
  /** "8.30" as the salon wrote it; "" when closed */
  fromText: string
  toText: string
}

/** "9" → 9, "8.30" or "8:30" → 8.5; null when the text is no hour. */
export function parseHour(text: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})(?:[.:](\d{2}))?\s*$/.exec(text ?? '')
  if (!m) return null
  const hour = Number(m[1]) + Number(m[2] ?? 0) / 60
  return hour <= 24 ? hour : null
}

/** The seven days Monday to Sunday from the site's settings; a day the settings leave out is closed. */
export function hoursOf(settings: Pick<SiteSettings, 'hours'> | null | undefined, words: Pick<Words, 'weekdays' | 'weekdaysShort'>): OpenDay[] {
  return WEEK.map((key, index) => {
    const row = (settings?.hours ?? []).find((h) => h.day === key)
    const from = parseHour(row?.from)
    const to = parseHour(row?.to)
    const open = from != null && to != null && to > from
    return {
      index, name: words.weekdays[index]!, short: words.weekdaysShort[index]!,
      from: open ? from : null, to: open ? to : null,
      fromText: open ? row!.from!.trim() : '', toText: open ? row!.to!.trim() : '',
    }
  })
}

/** Monday is 0: the day of the week for a date (a browser's local day; call it after mount). */
export const weekdayIndex = (date: Date): number => (date.getDay() + 6) % 7

/** The first open day after the given one, and how many days ahead it is. */
export function nextOpen(days: OpenDay[], dayIndex: number): { day: OpenDay; ahead: number } | null {
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = days[(dayIndex + ahead) % 7]!
    if (day.from != null) return { day, ahead }
  }
  return null
}

/** The days the booking form offers: the next open days, and only those the chosen person works. */
export function bookableDays(days: OpenDay[], works: boolean[] | null, dayNames: string[], count = 12, now = new Date()): string[] {
  const out: string[] = []
  for (let i = 1; out.length < count && i < 60; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const wd = weekdayIndex(d)
    if (days[wd]!.from == null || (works && !works[wd])) continue
    out.push(`${dayNames[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`)
  }
  return out
}

/** A bar's start and width, in percent of the span from 7 to 20 h. */
export function barOf(day: OpenDay): { left: string; width: string } | null {
  if (day.from == null || day.to == null) return null
  return { left: `${((day.from - 7) / 13) * 100}%`, width: `${((day.to - day.from) / 13) * 100}%` }
}

// ── the price list ──

/** 2400 → "2 400 Kč" with non-breaking spaces; `narrow` uses the thin one (Mirror's price list). */
export function kc(price: number, narrow = false): string {
  const space = narrow ? ' ' : ' '
  return `${String(price).replace(/\B(?=(\d{3})+$)/g, space)}${space}Kč`
}

/** "350 Kč" → "350 Kč" with the thin space Mirror writes between a figure and the currency. */
export const narrowPrice = (text: string): string => text.replace(/(\d) +(?=Kč)/g, '$1\u202f')

export interface ServiceGroupWithItems {
  group: ServiceGroup
  items: Service[]
}

const byPosition = <T extends { position: number | null }>(a: T, b: T): number => (a.position ?? 1e9) - (b.position ?? 1e9)

/** The price list: the groups in their order, each with its services in theirs. Empty groups are left out. */
export function groupServices(groups: ServiceGroup[], services: Service[]): ServiceGroupWithItems[] {
  return [...groups].sort(byPosition)
    .map((group) => ({ group, items: services.filter((s) => s.group?.id === group.id).sort(byPosition) }))
    .filter((g) => g.items.length)
}

/** The services marked as quick prices, at most three (Zrcadlo's strip under the opening). */
export const quickServices = (services: Service[]): Service[] => services.filter((s) => s.quick).sort(byPosition).slice(0, 3)

/** The quarters of an hour a service takes, rounded up (Chessboard's squares). */
export const quarters = (minutes: number): number => Math.ceil(minutes / 15)

/** The hours of a service as shares of a full circle, one for each hour begun (Mirror's dials): 150 min → [1, 1, 0.5]. */
export function dialFractions(minutes: number): number[] {
  const out: number[] = []
  for (let left = minutes; left > 0; left -= 60) out.push(Math.min(left, 60) / 60)
  return out
}

/** The path of a dial's slice in a 18 × 18 box: a full circle is one hour. */
export function dialPath(fraction: number): string {
  const a = Math.min(fraction, 0.999) * 2 * Math.PI
  return `M9 9V2A7 7 0 ${fraction > 0.5 ? 1 : 0} 1 ${(9 + 7 * Math.sin(a)).toFixed(2)} ${(9 - 7 * Math.cos(a)).toFixed(2)}Z`
}

/** The lowest price of a group's services (Šachovnice writes "5 služeb, od 590 Kč" under a group's name). */
export const cheapest = (items: Service[]): number => Math.min(...items.map((s) => s.price))

// ── the team ──

/** The six days Monday to Saturday a person works. */
export const workDays = (p: Pick<Person, 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'> | PersonEmbedded): boolean[] => [p.mon, p.tue, p.wed, p.thu, p.fri, p.sat]

/** "Radka Vejvodová" → "Radka": a result is signed with a first name. */
export const firstName = (name: string | null | undefined): string => (name ?? '').trim().split(/\s+/)[0] ?? ''

// ── small things ──

/** "Šípková 59" → ["Šípková", "59"]: the street and the number; the number is "" when the address has none. */
export function addressParts(address: string | null | undefined): [street: string, number: string] {
  const m = /^(.*?)\s+(\d+\s?[a-zA-Z]?(?:\/\d+)?)$/.exec((address ?? '').trim())
  return m ? [m[1]!, m[2]!] : [(address ?? '').trim(), '']
}

/** A phone number as the footer and the header write it: spaces that never break. */
export const phoneText = (phone: string | null | undefined): string => (phone ?? '').replace(/ /g, ' ')

/** The size of a section's heading in Šachovnice, whose type is so wide that a long heading needs a smaller size than the short ones the design has. */
export const wideHeading = (text: string | null | undefined): string => byLength(text, [[26, 'text-[40px] leading-[1] md:text-[72px]']], 'text-[32px] leading-[1.05] md:text-[48px]')
