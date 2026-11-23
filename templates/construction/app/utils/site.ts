// The Builders and architects template's own helpers: its words, the pages of the projects, and
// the small calculations the looks share (a build's stages laid end to end, a price in millions,
// the towns on a scale). The content is in the CMS; Nuxt auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { Page, Project, SiteSettings, Town } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** The addresses that lead to an entry instead of a page from blocks: a project (/realizace/dum-v-libici). */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'project', prefix: 'realizace', entity: 'project', part: 'Project', descriptionField: 'summary' },
]

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `realizace` (for `/#realizace`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  const anchors: Record<string, string> = {
    building: wordsOf(lang).anchors.building, projects: wordsOf(lang).anchors.projects, services: wordsOf(lang).anchors.services,
    process: wordsOf(lang).anchors.process, team: wordsOf(lang).anchors.team, testimonials: wordsOf(lang).anchors.testimonials,
    enquiry: wordsOf(lang).anchors.enquiry, contact: wordsOf(lang).anchors.contact,
  }
  return anchors[type]
}

// ── small helpers ──

/** A text's lines: a line break the editor typed stays where it is. */
export const lines = (text: string | null | undefined): string[] => (text ?? '').split(/\n/).map((l) => l.trim()).filter(Boolean)

/** 6600000 → "6,6", 7000000 → "7": millions the Czech way. */
const millions = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n / 1_000_000)

/** A price range as the designs write it: "6,6–7 mil. Kč" (`unit: false` leaves "Kč" out); under a million in full. Empty without a price. */
export function priceRange(from: number | null | undefined, to: number | null | undefined, unit = true): string {
  const a = from ?? to
  const b = to ?? from
  if (a == null || b == null) return ''
  const NB = ' '
  // (in millions when the upper end is a million or more and both are whole hundreds of thousands: 0,9–1,1 mil.)
  if (b >= 1_000_000 && a % 100_000 === 0 && b % 100_000 === 0) return `${millions(a)}${a === b ? '' : `–${millions(b)}`}${NB}mil.${unit ? `${NB}Kč` : ''}`
  return `${formatPrice(a)}${a === b ? '' : `–${formatPrice(b)}`}${unit ? `${NB}Kč` : ''}`
}

/** The construction system of a project as a word: "zděný", "dřevostavba", or what the note says for "other". */
export function systemWord(project: Pick<Project, 'system' | 'systemNote'>, words: Words, short = false): string {
  if (project.system === 'other') return project.systemNote ?? ''
  return words.systems[project.system][short ? 'short' : 'long']
}

/** Which hatch of a drawing stands for a system: masonry, timber (and anything else, a roof truss for one). */
export const hatchOf = (system: Project['system']): 'zdivo' | 'drevo' => (system === 'masonry' ? 'zdivo' : 'drevo')

// ── a build's stages, laid end to end ──

type Step = BlockOf<'process'>['steps'][number]

export interface Stage {
  step: Step
  /** The week the stage starts in, counted from 0. */
  start: number
  weeks: number
  /** The week the stage ends in: where its payment stands on the grid. */
  end: number
}

/** The steps of one phase, in the editors' order. */
export const stepsOf = (block: BlockOf<'process'>, phase: Step['phase']): Step[] => block.steps.filter((s) => s.phase === phase)

/** The stages of the build laid one after another; their weeks add up to `total`. */
export function stagesOf(block: BlockOf<'process'>): { stages: Stage[]; total: number } {
  let at = 0
  const stages = stepsOf(block, 'build').map((step) => {
    const weeks = step.weeks ?? 0
    const stage = { step, start: at, weeks, end: at + weeks }
    at += weeks
    return stage
  })
  return { stages, total: at }
}

/** What a step says about how long it takes: its own words, else its weeks. */
export const durationOf = (step: Step, words: Words): string => step.duration || (step.weeks ? words.weeks(step.weeks) : '')

/** The days of inspection on the grid: every `every` weeks up to the end of the build. */
export const inspectionWeeks = (every: number | null | undefined, total: number): number[] => {
  if (!every || every < 1 || !total) return []
  const out: number[] = []
  for (let w = every; w <= total; w += every) out.push(w)
  return out
}

// ── the projects ──

export type DoneProject = Project

/** The projects that are finished and the ones under construction. */
export const finished = (all: Project[]): Project[] => all.filter((p) => p.state !== 'building')
export const underway = (all: Project[]): Project[] => all.filter((p) => p.state === 'building')

/** The project the home page shows large: the first finished one marked so, in the editors' order. */
export const featuredOf = (all: Project[]): Project | null => finished(all).find((p) => p.featured) ?? null

/** The other finished projects (not the large one), the first `limit` of them; all without a limit. */
export function othersOf(all: Project[], block: { showFeatured: boolean | null; limit: number | null }): Project[] {
  const featured = block.showFeatured ? featuredOf(all) : null
  const rest = finished(all).filter((p) => p.id !== featured?.id)
  return block.limit ? rest.slice(0, block.limit) : rest
}

/** The kinds that are present among projects, in the order the designs list them, with their counts. */
export function kindCounts(projects: Project[]): Array<{ kind: Project['kind']; count: number }> {
  const order: Project['kind'][] = ['new', 'renovation', 'extension', 'roof']
  return order.map((kind) => ({ kind, count: projects.filter((p) => p.kind === kind).length })).filter((k) => k.count > 0)
}

/** The weeks of progress of a build under construction at `now`, counted from its start; null before anything is known. */
export function weekOf(project: Pick<Project, 'startDate' | 'weeks'>, now: number | null): number | null {
  if (now == null || !project.startDate || !project.weeks) return null
  const days = Math.floor((now - new Date(project.startDate).getTime()) / 86_400_000)
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), project.weeks)
}

/** How much of the contract's time a build used: "2 weeks earlier" is 2, later is negative. Null without both. */
export const weeksEarlier = (p: Pick<Project, 'weeks' | 'contractWeeks'>): number | null => (p.weeks && p.contractWeeks ? p.contractWeeks - p.weeks : null)

// ── the area ──

export interface Placed {
  town: Town
  /** 0–1: where on the scale it stands. */
  at: number
}

/** The towns on a scale: the seat first, then by distance; `end` is the km the scale ends at (the farthest town without one). */
export function townsOnScale(towns: Town[], end: number | null | undefined): { placed: Placed[]; end: number } {
  const sorted = [...towns].sort((a, b) => (a.seat === b.seat ? a.km - b.km : a.seat ? -1 : 1))
  const scale = end || Math.max(1, ...sorted.map((t) => t.km))
  return { placed: sorted.map((town) => ({ town, at: Math.min(town.km / scale, 1) })), end: scale }
}

/** "583 01 Chotěboř" */
export const postalTown = (s: Pick<SiteSettings, 'postcode' | 'town'> | null | undefined): string => [s?.postcode, s?.town].filter(Boolean).join(' ')

/** A day as the schedule writes it: "14. 5. 2027". */
export function numericDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')}. ${get('month')}. ${get('year')}`
}

// ── a wall of bricks in a running bond (Zdivo) ──

export type BondCell =
  | { kind: 'item'; index: number }
  | { kind: 'cta' }
  /** a half brick that closes a short row on a phone / on a desktop */
  | { kind: 'mb' | 'db' }
  /** a blank brick that fills the rest of a row on a phone / on a desktop */
  | { kind: 'padm' | 'padd' }

/**
 * The cells of a wall of `n` bricks, in the order the page holds them. On a phone the wall has
 * four columns: a row of two bricks, then one between two half bricks, and so on. On a desktop
 * it has four bricks to a row and three, flanked by half bricks, in the rows between; a
 * `cta` brick closes the first row. A phone and a desktop share one list: the half bricks of
 * one are hidden on the other. `free` is how many bricks the last desktop row still has room for.
 */
export function bond(n: number, cta: boolean, pad = false): { cells: BondCell[]; free: number } {
  const rows = (sizeAt: (row: number) => number) => {
    const out: Array<{ start: number; end: number; row: number }> = []
    for (let i = 0, row = 0; i < n; row++) {
      const size = sizeAt(row)
      out.push({ start: i, end: Math.min(i + size, n), row })
      i += size
    }
    return out
  }
  const mobile = rows((r) => (r % 2 === 0 ? 2 : 1))
  const desktop = rows((r) => (r % 2 === 0 ? (r === 0 && cta ? 3 : 4) : 3))
  const cells: BondCell[] = []
  let free = 0
  for (let i = 0; i < n; i++) {
    const m = mobile.find((r) => i >= r.start && i < r.end)!
    const d = desktop.find((r) => i >= r.start && i < r.end)!
    if (i === m.start && m.row % 2 === 1) cells.push({ kind: 'mb' })
    if (i === d.start && d.row % 2 === 1) cells.push({ kind: 'db' })
    cells.push({ kind: 'item', index: i })
    if (i === m.end - 1) {
      if (m.row % 2 === 1) cells.push({ kind: 'mb' })
      else if (pad && m.end - m.start < 2) cells.push({ kind: 'padm' })
    }
    if (i === d.end - 1) {
      if (d.row === 0 && cta) cells.push({ kind: 'cta' })
      free = (d.row % 2 === 0 ? 4 : 3) - (d.end - d.start) - (d.row === 0 && cta ? 1 : 0)
      if (pad) for (let k = 0; k < free; k++) cells.push({ kind: 'padd' })
      if (d.row % 2 === 1) cells.push({ kind: 'db' })
    }
  }
  if (!n && cta) cells.push({ kind: 'cta' })
  return { cells, free }
}

/** The tone of a brick by its place: the three clay tones in turn. */
export const brickTone = (i: number): 't1' | 't2' | 't1d' => (['t1', 't2', 't1d', 't2'] as const)[i % 4]!
