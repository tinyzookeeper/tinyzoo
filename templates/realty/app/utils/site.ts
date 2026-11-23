// The Realty template's own helpers: its words, the filter over the listings, and the little
// facts the looks write the same way (the price of a plot per m², the floor, the card's three
// cells). The content is in the CMS; Nuxt auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import { formatPrice } from '../../../kit/app/utils/format'
import type { Listing, Page } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** A listing has a page of its own: /nabidka/<slug>. (/nabidka itself is a page built from blocks.) */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'listing', prefix: 'nabidka', entity: 'listing', part: 'Listing', titleField: 'title', descriptionField: 'summary' },
]

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `nabidka` (for `/#nabidka`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

/** "1 nemovitost", "2 nemovitosti", "5 nemovitostí": Czech counts. */
export const plural = (n: number, one: string, few: string, many: string): string => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)

// ── the listings ──

export type Deal = Listing['deal']
export type Kind = Listing['kind']
/** What the filter chooses by kind: one kind, or the two that make "houses". */
export type KindChoice = 'all' | Kind | 'houses'

export interface ListingFilter {
  deal: 'all' | Deal
  kind: KindChoice
  /** A town as the listings write it, or "all" */
  town: string
  /** The most a property may cost (a month's rent for a rental); 0 for no limit */
  max: number
}

export const NO_FILTER: ListingFilter = { deal: 'all', kind: 'all', town: 'all', max: 0 }

/** The kinds the filter's chips stand for: a house and a cottage are both "houses". */
export const kindMatches = (kind: Kind, choice: KindChoice): boolean => choice === 'all' || (choice === 'houses' ? kind === 'house' || kind === 'cottage' : kind === choice)

export function listingMatches(l: Listing, f: ListingFilter): boolean {
  if (f.deal !== 'all' && l.deal !== f.deal) return false
  if (!kindMatches(l.kind, f.kind)) return false
  if (f.town !== 'all' && l.town !== f.town) return false
  if (f.max > 0 && (l.price ?? 0) > f.max) return false
  return true
}

/** The filter an address asks for (/nabidka?kind=flat&town=Písek&max=6000000); what it does not say stays open. */
export function filterFromQuery(query: Record<string, unknown>): ListingFilter {
  const one = (v: unknown): string => String(Array.isArray(v) ? v[0] ?? '' : v ?? '')
  const deal = one(query.deal)
  const kind = one(query.kind)
  const max = Number.parseInt(one(query.max), 10)
  return {
    deal: deal === 'sale' || deal === 'rent' ? deal : 'all',
    kind: (['flat', 'house', 'cottage', 'plot', 'commercial', 'houses'] as const).find((k) => k === kind) ?? 'all',
    town: one(query.town) || 'all',
    max: Number.isFinite(max) && max > 0 ? max : 0,
  }
}

/** The chips over the listings, in the design's order; only those with something behind them. */
export const CHIPS: Array<{ id: string; filter: ListingFilter }> = [
  { id: 'all', filter: NO_FILTER },
  { id: 'sale', filter: { ...NO_FILTER, deal: 'sale' } },
  { id: 'rent', filter: { ...NO_FILTER, deal: 'rent' } },
  { id: 'flat', filter: { ...NO_FILTER, kind: 'flat' } },
  { id: 'houses', filter: { ...NO_FILTER, kind: 'houses' } },
  { id: 'plot', filter: { ...NO_FILTER, kind: 'plot' } },
  { id: 'commercial', filter: { ...NO_FILTER, kind: 'commercial' } },
]
export const sameFilter = (a: ListingFilter, b: ListingFilter): boolean => a.deal === b.deal && a.kind === b.kind && a.town === b.town && a.max === b.max

/** The prices a "price up to" choice offers: the steps from the first that covers the cheapest property up to the first that covers the dearest. */
export function maxSteps(prices: number[], deal: Deal): number[] {
  const steps = deal === 'rent'
    ? [5_000, 8_000, 10_000, 15_000, 20_000, 30_000, 50_000, 80_000]
    : [1, 2, 3, 5, 8, 12, 20, 30, 50, 80, 120].map((m) => m * 1_000_000)
  const have = prices.filter((p) => p > 0)
  if (!have.length) return []
  const low = Math.min(...have)
  const high = Math.max(...have)
  const from = steps.findIndex((s) => s >= low)
  const to = steps.findIndex((s) => s >= high)
  return from === -1 ? [] : steps.slice(from, to === -1 ? undefined : to + 1)
}

/** "Písek – Hradiště": the town and the part of it. */
export const placeOf = (l: Pick<Listing, 'town' | 'district'>): string => [l.town, l.district].filter(Boolean).join(' – ')

/** "2 295 Kč/m²" for a plot on sale: its price over its area; null for anything else. */
export function pricePerM2(l: Pick<Listing, 'deal' | 'kind' | 'price' | 'landArea'>): string | null {
  if (l.kind !== 'plot' || l.deal !== 'sale' || !l.price || !l.landArea) return null
  return `${formatPrice(Math.round(l.price / l.landArea))}\u00A0Kč/m²`
}

/** "ze" or "z" before the number of floors: "2. ze 3", "7. z 8". */
const ZE = new Set([2, 3, 4, 6, 7, 12, 13, 14, 16, 17])
export const floorOf = (floor: number | null, total: number | null, words: { floorOf: (f: number, t: number) => string; floorN: (f: number) => string }): string =>
  floor == null ? '' : total ? words.floorOf(floor, total) : words.floorN(floor)
export const zeZ = (n: number): 'ze' | 'z' => (ZE.has(n) ? 'ze' : 'z')

/** "13 500 Kč" */
export const priceKc = (n: number | null | undefined): string => (n == null ? '' : `${formatPrice(n)}\u00A0Kč`)

/** "8,49 mil. Kč": a price in millions, for a sticker. */
export function priceMil(n: number | null | undefined): string {
  if (n == null) return ''
  const m = Math.round(n / 10_000) / 100
  return `${String(m).replace('.', ',')}\u00A0mil.\u00A0Kč`
}

/** "17 dní" → ["17", "dní"]: the number a sale is written large with, and its unit. */
export function durationParts(text: string | null | undefined): [number: string, unit: string] {
  const m = /^\s*(\d+)\s*(.*)$/.exec(text ?? '')
  return m ? [m[1]!, m[2]!.trim()] : ['', (text ?? '').trim()]
}

/** The listing to show in detail and in the opening: the first one marked so, else the first. */
export const featuredListing = (list: Listing[]): Listing | null => list.find((l) => l.featured) ?? list[0] ?? null

/** The photographs a detail shows: the ones after the cover (the cover is on the card), up to three. */
export const detailPhotos = (l: Listing): Listing['photos'] => (l.photos.length > 1 ? l.photos.slice(1, 4) : l.photos)

/** A listing's parameters as a table's rows, in order: what a property of that kind has. */
export interface Row { label: string; value: string }
export function paramRows(l: Listing, words: Words, opts: { landApart?: boolean; usable?: string } = {}): Row[] {
  const rows: Row[] = []
  const add = (label: string, value: string | null | undefined) => { if (value) rows.push({ label, value }) }
  const area = l.area ? `${formatPrice(l.area)}\u00A0m²` : ''
  const land = l.landArea ? `${formatPrice(l.landArea)}\u00A0m²` : ''
  add(words.params.layout, l.layout)
  if (l.kind === 'plot') {
    add(words.params.plot, land)
  }
  else if (opts.landApart) {
    add(opts.usable ?? words.params.usable, area)
    add(words.params.land, land)
  }
  else {
    add(opts.usable ?? words.params.usable, [area, land ? `${words.params.landLower} ${land}` : ''].filter(Boolean).join(', '))
  }
  add(words.params.storeys, l.storeys)
  add(words.params.floor, floorOf(l.floor, l.floorsTotal, words))
  add(words.params.ownership, l.ownership)
  add(words.params.energy, l.energyClass)
  add(words.params.parking, l.parking)
  for (const e of l.extras) add(e.label, e.value)
  return rows
}

/** "Domy", "Byty": what the chips and the search call a group, with how many listings are in it. */
export function chipCounts(list: Listing[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of CHIPS) out[c.id] = list.filter((l) => listingMatches(l, c.filter)).length
  return out
}

/** "Byt 2+1 v cihlovém domě" and the like need no helper: the title is written as it should read. */
export type AgentOf = NonNullable<Listing['agent']>

// ── the last cell of a grid ──
// A grid of cards ends with a cell that fills what is left of the last row (the box that
// watches the offer). Its width depends on how many cards the filter leaves and on the columns
// each width of screen has, so it is worked out here in classes, not measured: the server
// draws it right, and no script moves it afterwards. (The class names are written out in full
// so Tailwind finds them.)
const SPANS = {
  sm: ['sm:col-span-1', 'sm:col-span-1', 'sm:col-span-2', 'sm:col-span-3', 'sm:col-span-4'],
  md: ['md:col-span-1', 'md:col-span-1', 'md:col-span-2', 'md:col-span-3', 'md:col-span-4'],
  lg: ['lg:col-span-1', 'lg:col-span-1', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-4'],
  xl: ['xl:col-span-1', 'xl:col-span-1', 'xl:col-span-2', 'xl:col-span-3', 'xl:col-span-4'],
} as const
/** `lastCellSpan(7, { sm: 2, lg: 3 })`: the classes that give the cell after 7 cards the rest of its row, at each width. */
export function lastCellSpan(cards: number, columns: Partial<Record<keyof typeof SPANS, number>>): string {
  return (Object.keys(SPANS) as Array<keyof typeof SPANS>)
    .filter((bp) => columns[bp])
    .map((bp) => SPANS[bp][columns[bp]! - (cards % columns[bp]!)])
    .join(' ')
}
