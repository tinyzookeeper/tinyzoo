// The Software template's own helpers: its words, the numbers some looks print before a
// section, the bars Magnets sets its headings on, the price of a year. The content is in the
// CMS; Nuxt auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { Page } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** Every address is a page built from blocks: the changelog's releases have no pages of their own. */
export const ENTRY_PAGES: EntryPage[] = []

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `cenik` (for `/#cenik`). Undefined for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── sections and figures that are numbered (Návod) ──

/** The blocks Návod numbers in the line above their heading ("1 · Co umí"), in the page's order. */
const NUMBERED = ['features', 'audience', 'pricing', 'changelog', 'questions', 'team']

/** The number of a block in the line above its heading: 1 for the first numbered block of the page. */
export function sectionNumber(sections: Array<{ type: string }>, type: string): number {
  const at = sections.filter((s) => NUMBERED.includes(s.type)).findIndex((s) => s.type === type)
  return at + 1
}

// ── Magnets: a heading set on three bars ──

/**
 * A heading split into three bars of words, the way Magnets sets "Kdo má / zítra / ranní?": the
 * words are shared out as evenly as they go, the first bar taking the extra ones ("Zítra ráno /
 * to vědí / všichni."). Fewer than three words leave the last bars empty.
 */
export function barsOf(heading: string | null | undefined, bars = 3): string[] {
  const words = (heading ?? '').replace(/\*/g, '').trim().split(/\s+/).filter(Boolean)
  const base = Math.floor(words.length / bars)
  const extra = words.length % bars
  const out: string[] = []
  let at = 0
  for (let i = 0; i < bars; i++) {
    const take = base + (i < extra ? 1 : 0)
    out.push(words.slice(at, at + take).join(' '))
    at += take
  }
  return out
}

// ── One Day: the icon beside a time of the day ──

/** "06:40" → sunrise, "12:00" → sun, "17:00" → sunset, "22:00" → moon. */
export function momentIcon(time: string | null | undefined): string {
  const hour = Number.parseInt(time ?? '', 10)
  if (Number.isNaN(hour)) return 'i-lucide-sun'
  if (hour < 7) return 'i-lucide-sunrise'
  if (hour < 17) return 'i-lucide-sun'
  if (hour < 21) return 'i-lucide-sunset'
  return 'i-lucide-moon'
}

// ── prices ──

/** What is paid for a year when it is paid yearly: twelve times the monthly price of that payment. */
export const yearTotal = (perMonth: number | null | undefined): number => (perMonth ?? 0) * 12

/** "18. 11. 2026", the way the changelog writes a date. */
export function releaseDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')}. ${get('month')}. ${get('year')}`
}
