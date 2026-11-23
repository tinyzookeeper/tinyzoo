// The Development template's own helpers: its words, and what the looks work out from the flats
// (their order, the layouts to filter by, the numbers of the opening, where a flat lies on its
// floor plan, which side the sun comes from). The content is in the CMS; Nuxt auto-imports what is
// exported here. (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { Flat, Floor, Page, SiteSettings } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** A flat has a page of its own: /byt/3-02. Everything else is a page built from blocks. */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'flat', prefix: 'byt', entity: 'flat', part: 'Flat', titleField: 'number', descriptionField: 'note' },
]

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `cenik` (for `/#cenik`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── the icons Po slunci puts before a standard ──
// Written out in full (not built from the name) so that every icon is known when the site is built.
export const STANDARD_ICONS: Record<Standard['icon'], string> = {
  'house': 'i-lucide-house', 'blinds': 'i-lucide-blinds', 'layers': 'i-lucide-layers', 'thermometer-sun': 'i-lucide-thermometer-sun',
  'wind': 'i-lucide-wind', 'shower-head': 'i-lucide-shower-head', 'door-closed': 'i-lucide-door-closed', 'car': 'i-lucide-car',
  'bike': 'i-lucide-bike', 'zap': 'i-lucide-zap', 'sun': 'i-lucide-sun', 'shield-check': 'i-lucide-shield-check',
  'trees': 'i-lucide-trees', 'sofa': 'i-lucide-sofa', 'key-round': 'i-lucide-key-round', 'ruler': 'i-lucide-ruler',
}
type Standard = import('../lib/cms-content').Standard

// ── the flats ──

export type FlatState = Flat['state']
export type Orientation = Flat['orientation']

/** The address of a flat's own page. */
export const flatHref = (flat: Pick<Flat, 'slug'>): string => `/byt/${flat.slug}`

/** A decimal from the content API arrives as text ("54.20"). */
export const toNumber = (value: string | number | null | undefined): number => Number(value ?? 0)

/** "3.02" before "3.10", whatever the digits: numbers as numbers. */
const byNumber = (a: string, b: string) => a.localeCompare(b, 'cs', { numeric: true })

/** By floor, lowest first, then by number. */
export const compareFlats = (a: Flat, b: Flat): number => a.floor - b.floor || byNumber(a.number, b.number)

/** The flats in the order every look lists them: by number. */
export const sortFlats = (flats: Flat[]): Flat[] => [...flats].sort((a, b) => byNumber(a.number, b.number))

/** The flats as the building stands: the highest floor first, each floor by number (Blueprint's and By the Sun's list). */
export const topDown = (flats: Flat[]): Flat[] => floorsOf(flats).flatMap((g) => g.flats)

export interface FloorGroup {
  floor: number
  flats: Flat[]
}

/** The flats grouped by floor, the highest floor first, as the building stands. */
export function floorsOf(flats: Flat[]): FloorGroup[] {
  const groups = new Map<number, Flat[]>()
  for (const flat of sortFlats(flats)) groups.set(flat.floor, [...(groups.get(flat.floor) ?? []), flat])
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([floor, list]) => ({ floor, flats: list }))
}

const LAYOUT_ORDER = ['1+kk', '1+1', '2+kk', '2+1', '3+kk', '3+1', '4+kk', '4+1', '5+kk', '5+1']

/** The layouts the flats have, smallest first: what the filter offers. */
export const layoutsOf = (flats: Flat[]): Flat['layout'][] => LAYOUT_ORDER.filter((l) => flats.some((f) => f.layout === l)) as Flat['layout'][]

export const STATES: FlatState[] = ['free', 'reserved', 'sold']

/** The states the flats have, in the order of the legend. */
export const statesOf = (flats: Flat[]): FlatState[] => STATES.filter((s) => flats.some((f) => f.state === s))

export interface FlatStats {
  total: number
  free: number
  reserved: number
  sold: number
  /** The lowest price of a flat that is not sold. */
  minPrice: number | null
  minArea: number | null
  maxArea: number | null
  /** The smallest and the largest layout. */
  layouts: [first: string, last: string] | null
}

export function flatStats(flats: Flat[]): FlatStats {
  const open = flats.filter((f) => f.state !== 'sold' && f.price != null)
  const areas = flats.map((f) => toNumber(f.area))
  const layouts = layoutsOf(flats)
  return {
    total: flats.length,
    free: flats.filter((f) => f.state === 'free').length,
    reserved: flats.filter((f) => f.state === 'reserved').length,
    sold: flats.filter((f) => f.state === 'sold').length,
    minPrice: open.length ? Math.min(...open.map((f) => f.price!)) : null,
    minArea: areas.length ? Math.min(...areas) : null,
    maxArea: areas.length ? Math.max(...areas) : null,
    layouts: layouts.length ? [layouts[0]!, layouts[layouts.length - 1]!] : null,
  }
}

const AREA = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** An area's number as Czech writes it, without the unit: "54,2". */
export const areaNumber = (value: string | number | null | undefined): string => AREA.format(toNumber(value))

/** An area as Czech writes it: "54,2 m²". */
export const areaText = (value: string | number | null | undefined): string => `${AREA.format(toNumber(value))} m²`

/** A price as Czech writes it: "5 190 000 Kč". */
export const priceText = (price: number | null | undefined): string => `${formatPrice(price)} Kč`

/** "3.02" → ".02": the flat on its floor, for the legend of the sun. */
export const placeOnFloor = (number: string): string => (number.includes('.') ? `.${number.split('.').pop()}` : number)

/** The flats a form can ask about: those that are not sold, by number. */
export const askableFlats = (flats: Flat[]): Flat[] => sortFlats(flats).filter((f) => f.state !== 'sold')

/** A line of a select in the enquiry form: "Byt 2.04 · 2+kk · 56,1 m² · 5 190 000 Kč (rezervace)". */
export function flatOption(flat: Flat, words: Pick<Words, 'flat' | 'reservedMark'>): string {
  return [`${words.flat} ${flat.number}`, flat.layout, areaText(flat.area), flat.price != null ? priceText(flat.price) : ''].filter(Boolean).join(' · ') + (flat.state === 'reserved' ? ` (${words.reservedMark})` : '')
}

// ── dates ──

/** "10/2027": a month the way Blueprint and Floors write it. */
export function monthNumbers(iso: string | null | undefined): string {
  const d = dateParts(iso)
  return d ? `${d.monthNumber.padStart(2, '0')}/${d.year}` : ''
}

/** "23. 11. 2026": a day as Blueprint writes it (the status of a price list, the title block). */
export function dateNumbers(iso: string | null | undefined): string {
  const d = dateParts(iso)
  return d ? `${d.day}. ${d.monthNumber}. ${d.year}` : ''
}

/** "02": the number of a section on the page, counted from one, as Blueprint numbers its sheets. */
export const sectionNo = (index: number | undefined): string => String((index ?? 0) + 1).padStart(2, '0')

/** The number of the month, 1 to 12; 0 when there is no date. */
export const monthIndex = (iso: string | null | undefined): number => Number(dateParts(iso)?.monthNumber ?? 0)

// ── the drawings ──

/** Where the sun is at a time of day, and so which flats get it: the order of the legend, east to west. */
export const SUN_ORDER: Orientation[] = ['SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ', 'S']

export interface SunGroup {
  orientation: Orientation
  /** The place of each flat on its floor: ".03". */
  places: string[]
}

/** The orientations the flats face, east to west, with the flats that face each. */
export function sunGroups(flats: Flat[]): SunGroup[] {
  return SUN_ORDER
    .map((orientation) => ({ orientation, places: [...new Set(flats.filter((f) => f.orientation === orientation).map((f) => placeOnFloor(f.number)))].sort() }))
    .filter((g) => g.places.length > 0)
}

/** The height mark of a floor's level: the one the owner wrote, else counted from the floor (3,1 m each). */
export function levelOf(floor: number, floors: Floor[]): string {
  const own = floors.find((f) => f.number === floor)?.level
  if (own) return own
  if (floor <= 1) return '±0,000'
  return `+${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format((floor - 1) * 3.1)}`
}

/** The note of a floor ("Four flats with a balcony"), if the owner wrote one. */
export const floorNote = (floor: number, floors: Floor[]): string => floors.find((f) => f.number === floor)?.note ?? ''

/** A cell of the floor plan: grid column and row, from line to line. */
export type PlanCell = [column: number, row: number, columnEnd: number, rowEnd: number]

/** Share `to - from` grid columns between flats by their area, each at least one. */
function spread(list: Flat[], from: number, to: number): Array<[number, number]> {
  const total = to - from
  const areas = list.map((f) => toNumber(f.area) || 1)
  const sum = areas.reduce((a, b) => a + b, 0)
  const widths = areas.map((a) => Math.max(1, Math.round((a / sum) * total)))
  let drift = total - widths.reduce((a, b) => a + b, 0)
  while (drift !== 0 && list.length) {
    const i = drift > 0 ? widths.indexOf(Math.min(...widths)) : widths.indexOf(Math.max(...widths))
    widths[i]! += Math.sign(drift)
    drift -= Math.sign(drift)
  }
  let at = from
  return widths.map((w) => { const cell: [number, number] = [at, at + w]; at += w; return cell })
}

export interface FloorPlan {
  cells: Record<string, PlanCell>
  /** The stairs and the lift, where the floor has them in the middle; null where there is no room for them. */
  core: PlanCell | null
}

/**
 * Where each flat of a floor lies on the floor plan (eight columns, two rows, north on top),
 * worked out from the flats' orientation: a flat that faces east takes the east end, the northern
 * ones the top row, the others the bottom row, each as wide as its area asks. A floor of one or two
 * flats (the recessed top floor) is divided in the middle by the stairs.
 */
export function planOf(floorFlats: Flat[]): FloorPlan {
  const flats = [...floorFlats].sort(compareFlats)
  const cells: Record<string, PlanCell> = {}
  if (flats.length <= 2) {
    flats.forEach((f, i) => { cells[f.id] = flats.length === 1 ? [1, 1, 9, 3] : i === 0 ? [1, 1, 5, 3] : [6, 1, 9, 3] })
    return { cells, core: flats.length === 2 ? [5, 1, 6, 3] : null }
  }
  const east = flats.find((f) => f.orientation === 'JV' || f.orientation === 'V' || f.orientation === 'SV')
  const rest = flats.filter((f) => f !== east)
  const north = rest.filter((f) => f.orientation.startsWith('S'))
  const south = rest.filter((f) => !f.orientation.startsWith('S'))
  if (east) cells[east.id] = [6, 1, 9, 3]
  const west = east ? 6 : 9
  const place = (list: Flat[], row: number, end: number, to: number) => spread(list, 1, to).forEach(([a, b], i) => { cells[list[i]!.id] = [a, row, b, end] })
  if (north.length && south.length) {
    // (with the stairs at the end of the top row when the east end is there)
    place(north, 1, 2, east ? 5 : west)
    place(south, 2, 3, west)
  }
  else if (north.length) place(north, 1, 3, west)
  else place(south, 1, 3, west)
  return { cells, core: east && north.length && south.length ? [5, 1, 6, 2] : null }
}

/** The floor plan's compass for a flat: where the sun sits on the little circle. */
export const COMPASS_SPOT: Record<Orientation, { left: string; top: string }> = {
  J: { left: '4.5px', top: '14.5px' }, JZ: { left: '-2.75px', top: '11.75px' }, JV: { left: '11.75px', top: '11.75px' },
  Z: { left: '-2.75px', top: '4.5px' }, V: { left: '11.75px', top: '4.5px' },
  SZ: { left: '-2.75px', top: '-2.75px' }, SV: { left: '11.75px', top: '-2.75px' }, S: { left: '4.5px', top: '-2.75px' },
}

// ── texts that are set in two parts ──

/** "Pohled z ulice · Vizualizace" → ["Pohled z ulice", "Vizualizace"]: a caption Blueprint sets at both ends of a line. */
export function captionPair(caption: string | null | undefined): [left: string, right: string] {
  const text = (caption ?? '').trim()
  const at = text.indexOf(' · ')
  return at === -1 ? [text, ''] : [text.slice(0, at), text.slice(at + 3)]
}

/** "Dnes. Stavba 14. listopadu 2026" → ["Dnes.", "Stavba 14. listopadu 2026"]: a short lead set bold, and the rest. */
export function captionLead(caption: string | null | undefined): [lead: string, rest: string] {
  const text = (caption ?? '').trim()
  const m = /^(\S+(?: \d{4})?\.)\s+(.+)$/.exec(text)
  return m ? [m[1]!, m[2]!] : ['', text]
}

/** "2.04" → the flat with that number, to work an example out from. */
export const flatByNumber = (flats: Flat[], number: string | null | undefined): Flat | null => flats.find((f) => f.number === (number ?? '').trim()) ?? null

/** What a share of a price comes to, rounded to whole crowns: 10 % of 5 190 000 → 519 000. */
export const shareOf = (price: number, percent: number): number => Math.round((price * percent) / 100)

// ── the four key facts of the opening ──
// Read from the flats and from Site settings; each look writes them its own way (FactStyle).

export interface FactStyle {
  /** Between the smallest and the largest layout: " – ", " až ", "–". */
  range: string
  /** The areas as "od 32,6 do 104,9 m²" (true) or "32,6 až 104,9 m²". */
  areaFromTo: boolean
  /** The month as "10/2027" (true) or "říjen 2027". */
  monthNumbers: boolean
  /** The occupancy approval with its year ("v srpnu 2027") even when it is the year of the handover. */
  alwaysYear: boolean
  /** The price in millions ("3,59 mil. Kč"). */
  millions: boolean
}

export interface KeyFact {
  kind: string
  label: string
  value: string
  /** What is written smaller after the value ("mil. Kč"). */
  unit: string
  note: string
}

const MILLIONS = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 })

export function keyFacts(items: BlockOf<'opening'>['facts'] | null | undefined, flats: Flat[], settings: SiteSettings | null | undefined, words: Words, style: FactStyle): KeyFact[] {
  const stats = flatStats(flats)
  return (items ?? []).map((item): KeyFact => {
    const fact: KeyFact = { kind: item.kind ?? 'custom', label: item.label, value: '', unit: '', note: item.note ?? '' }
    if (item.kind === 'flats') {
      fact.value = String(stats.total)
      fact.note ||= stats.free ? words.freeCount(stats.free) : words.noneFree
    }
    else if (item.kind === 'layouts') {
      fact.value = stats.layouts ? (stats.layouts[0] === stats.layouts[1] ? stats.layouts[0] : `${stats.layouts[0]}${style.range}${stats.layouts[1]}`) : ''
      if (stats.minArea != null && stats.maxArea != null) {
        fact.note ||= style.areaFromTo ? `od ${areaNumber(stats.minArea)} do ${areaText(stats.maxArea)}` : `${areaNumber(stats.minArea)} až ${areaText(stats.maxArea)}`
      }
    }
    else if (item.kind === 'completion') {
      const done = dateParts(settings?.completion)
      const approval = dateParts(settings?.approval)
      fact.value = done ? (style.monthNumbers ? monthNumbers(settings?.completion) : `${words.months[Number(done.monthNumber) - 1]} ${done.year}`) : ''
      if (approval) {
        const year = style.alwaysYear || approval.year !== done?.year ? ` ${approval.year}` : ''
        fact.note ||= words.approval(`${words.monthsIn[Number(approval.monthNumber) - 1]}${year}`)
      }
    }
    else if (item.kind === 'price') {
      if (stats.minPrice != null) {
        if (style.millions) { fact.value = MILLIONS.format(stats.minPrice / 1_000_000); fact.unit = words.millionCrowns }
        else fact.value = priceText(stats.minPrice)
      }
    }
    else fact.value = item.value ?? ''
    return fact
  })
}
