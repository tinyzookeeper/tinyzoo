// The Shop template's own helpers: its words, the opening hours and what they say about now,
// the prices of a department, the crop of a product's photograph. The content is in the CMS;
// Nuxt auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { Page } from '../lib/cms-content'
import { words as cs, type OpeningDetail, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words, OpeningDetail }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** Every address is a page built from blocks: nothing in the shop has a page of its own (nothing is sold on the website). */
export const ENTRY_PAGES: EntryPage[] = []

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `sortiment` (for `/#sortiment`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── the opening hours ──
// Settings hold them as rows (a day, from, to): one per stretch the shop is open. Everything the
// website says about "now" is worked out from them in the visitor's browser, after the page is
// drawn (the server does not know the visitor's clock).

export type Hour = { day: string | null; from: string; to: string }
/** A stretch of a day as minutes from midnight. */
export type Stretch = [from: number, to: number]
/** The week from Monday (0) to Sunday (6): the stretches of each day. */
export type Week = Stretch[][]

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** "7:30", "7.30", "07:30" → 450; null when it is not a time. */
export function parseTime(text: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})\s*[:.]\s*(\d{2})\s*$/.exec(text ?? '')
  if (!m) return null
  const hours = Number(m[1]), minutes = Number(m[2])
  return hours > 24 || minutes > 59 ? null : hours * 60 + minutes
}

/** 450 → "7:30" */
export const formatTime = (minutes: number): string => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`

/** The rows of Site settings as a week; a row that is not a day and two times is left out. */
export function weekOf(hours: Hour[] | null | undefined): Week {
  const week: Week = DAY_KEYS.map(() => [])
  for (const row of hours ?? []) {
    const day = DAY_KEYS.indexOf(row.day ?? '')
    const from = parseTime(row.from), to = parseTime(row.to)
    if (day === -1 || from === null || to === null || to <= from) continue
    week[day]!.push([from, to])
  }
  for (const stretches of week) stretches.sort((a, b) => a[0] - b[0])
  return week
}

/** One day's hours as written: "7:30–17:00", "7:30–12:00, 13:00–17:00"; the closed word when there are none. */
export const dayText = (stretches: Stretch[], closed: string): string =>
  stretches.length ? stretches.map(([from, to]) => `${formatTime(from)}–${formatTime(to)}`).join(', ') : closed

/** The week in short lines: ["Po–Pá 7:30–17:00", "So 8:00–11:30"]. Closed days are left out. */
export function weekLines(week: Week, shortDays: string[]): string[] {
  const lines: string[] = []
  const text = (d: number) => dayText(week[d]!, '')
  for (let d = 0; d < 7;) {
    if (!week[d]!.length) { d++; continue }
    let end = d
    while (end + 1 < 7 && text(end + 1) === text(d)) end++
    lines.push(`${end > d ? `${shortDays[d]}–${shortDays[end]}` : shortDays[d]} ${text(d)}`)
    d = end + 1
  }
  return lines
}

export interface Opening {
  /** Whether the shop is open at that moment */
  open: boolean
  /** "dnes do 17:00" is built from this by the words */
  detail: OpeningDetail
  /** Today, Monday (0) to Sunday (6) */
  day: number
  /** Today's stretches */
  today: Stretch[]
  /** "23. 11." */
  date: string
}

/** What the hours say about a moment: open or closed, until when or from when, and which day it is. */
export function openingAt(week: Week, now: Date): Opening {
  const day = (now.getDay() + 6) % 7
  const minutes = now.getHours() * 60 + now.getMinutes()
  const today = week[day]!
  const current = today.find(([from, to]) => minutes >= from && minutes < to)
  let detail: OpeningDetail
  if (current) detail = { kind: 'until', time: formatTime(current[1]) }
  else {
    const later = today.find(([from]) => minutes < from)
    if (later) detail = { kind: 'later', time: formatTime(later[0]) }
    else {
      let n = 1
      while (n < 8 && !week[(day + n) % 7]!.length) n++
      detail = n >= 8 ? { kind: 'never' } : n === 1 ? { kind: 'tomorrow', time: formatTime(week[(day + 1) % 7]![0]![0]) } : { kind: 'day', day: (day + n) % 7, time: formatTime(week[(day + n) % 7]![0]![0]) }
    }
  }
  return { open: !!current, detail, day, today, date: `${now.getDate()}. ${now.getMonth() + 1}.` }
}

// ── small helpers ──

/** "Domácí potřeby / Železářství" → ["Domácí potřeby", "Železářství"]: the parts a look sets apart. */
export const slashParts = (text: string | null | undefined): string[] => (text ?? '').split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean)

/** "Cínová 58" → "Cínová": the street without its number. */
export const streetOf = (address: string | null | undefined): string => (address ?? '').replace(/\s+\d[\d/a-z]*\s*$/i, '').trim()

/** "Cínová 58" → "58" */
export const numberOf = (address: string | null | undefined): string => /(\d[\d/a-z]*)\s*$/i.exec(address ?? '')?.[1] ?? ''

/** A department's prices: "35–2 490 Kč"; one price alone, or nothing. */
export function rangePrice(from: number | null | undefined, to: number | null | undefined): string {
  if (from == null && to == null) return ''
  if (from == null || to == null || from === to) return `${formatPrice(from ?? to)} Kč`
  return `${formatPrice(from)}–${formatPrice(to)} Kč`
}

/**
 * The part of a photograph a product shows: where the middle of the thing is (percent from the
 * left and the top) and how close to cut (100 = a third of the photograph's width). Null when
 * the product shows its whole photograph.
 */
export function productCrop(p: { cropX?: number | string | null; cropY?: number | string | null; zoom?: number | null }): { '--cx': number; '--cy': number; '--z': number } | null {
  // (a decimal field comes back as text)
  if (p.cropX == null || p.cropY == null) return null
  return { '--cx': Number(p.cropX) / 100, '--cy': Number(p.cropY) / 100, '--z': (p.zoom ?? 100) / 100 }
}

/** The minutes of "2 minuty pěšky": a number before "min", else nothing. */
export const minutesOf = (text: string | null | undefined): string => { const m = /(\d+)\s*min/i.exec(text ?? ''); return m ? `${m[1]} min` : '' }

/** The tel: address of a phone number written for people ("123 456 701"). */
export const phoneHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`
/** The sms: address of the same. */
export const smsHref = (phone: string): string => `sms:${phone.replace(/[^\d+]/g, '')}`

/** The attributes of a link that leaves the website: it opens in a new tab. */
export const linkAttrs = (url: string | null | undefined): Record<string, string> => (isExternal(url) ? { target: '_blank', rel: 'noopener' } : {})

/** A photograph's shape, snapped to the three the shelf stands: wide (3:2), tall (4:5) or square. */
export function shapeOf(media: { width: number | null; height: number | null } | null | undefined): 'wide' | 'tall' | 'square' {
  const r = media?.width && media?.height ? media.width / media.height : 1
  return r > 1.15 ? 'wide' : r < 0.9 ? 'tall' : 'square'
}

/**
 * The icons a service or a way to the shop can wear, written out so that the build finds them
 * (the name is put together at run time: `i-lucide-${icon}`, which a build cannot read).
 */
export const ICON_NAMES = [
  'i-lucide-key-round', 'i-lucide-scissors', 'i-lucide-hammer', 'i-lucide-calendar-days', 'i-lucide-ruler', 'i-lucide-truck',
  'i-lucide-wrench', 'i-lucide-package', 'i-lucide-paintbrush', 'i-lucide-shovel', 'i-lucide-lightbulb', 'i-lucide-gift',
  'i-lucide-car', 'i-lucide-bike', 'i-lucide-footprints', 'i-lucide-bus', 'i-lucide-train', 'i-lucide-map-pin',
] as const
