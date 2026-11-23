// The Trades template's own helpers: its words, and which jobs and prices a look shows how.
// The content is in the CMS; Nuxt auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { CmsMedia, Job, Page, Service } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** A job has a page of its own: /zakazka/vymena-plynoveho-kotle. Everything else is a page built from blocks. */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'job', prefix: 'zakazka', entity: 'job', part: 'Job', descriptionField: 'text', imageField: 'photo' },
]

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `cenik` (for `/#cenik`). Undefined for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── the price list ──

/** "od 1 800 Kč / ks": the parts of a price, each drawn its own size by the looks. */
export function priceParts(service: Pick<Service, 'price' | 'from' | 'unit'>, words: Pick<Words, 'from'>) {
  return { from: service.from ? words.from : '', amount: formatAmount(service.price), unit: service.unit ?? '' }
}

/** 19000 → "19 000" (a non-breaking space, the Czech way). */
const formatAmount = (n: number): string => new Intl.NumberFormat('cs-CZ').format(n).replace(/\s/g, ' ')

/** The price list in groups, in the order the groups first appear. A service without a group stands in a group without a title. */
export function serviceGroups(services: Service[]): Array<{ title: string; items: Service[] }> {
  const groups: Array<{ title: string; items: Service[] }> = []
  for (const s of services) {
    const title = (s.group ?? '').trim()
    const found = groups.find((g) => g.title === title)
    if (found) found.items.push(s)
    else groups.push({ title, items: [s] })
  }
  return groups
}

// ── jobs ──

/** The jobs a block shows: every job, or those marked for the home page, as many as the block says. */
export function jobsShown(block: Pick<BlockOf<'jobs'>, 'all' | 'count'>, jobs: Job[]): Job[] {
  if (block.all) return jobs
  return jobs.filter((j) => j.featured).slice(0, block.count || 5)
}

/** A job's photographs: a before-and-after pair, one photograph, or none. */
export function jobPhotos(job: Pick<Job, 'before' | 'after' | 'photo'>): { pair: [CmsMedia, CmsMedia] | null; single: CmsMedia | null } {
  if (job.before && job.after) return { pair: [job.before, job.after], single: null }
  return { pair: null, single: job.photo ?? job.before ?? job.after ?? null }
}

/** "říjen 2026": a job's date, month and year only. Empty without a date. */
export function monthYear(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // (all-day dates are stored at 0:00 in the admin's time zone)
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', month: 'long', year: 'numeric' }).format(d)
}

/** The place, the month and the time a job took, for the line under its name. */
export const jobFacts = (job: Pick<Job, 'place' | 'date' | 'duration'>): string[] => [job.place, monthYear(job.date), job.duration].filter((x): x is string => !!x)

// ── which photographs a look shows ──
// One set of content serves two designs that place the owner's photograph differently.

/** The owner's photograph for Reflex's about section: its own, else the one from the page's opening. */
export function ownerPhoto(block: BlockOf<'about'>, sections: Page['sections']): CmsMedia | null {
  if (block.ownerImage) return block.ownerImage
  const opening = sections.find((b): b is BlockOf<'opening'> => b.type === 'opening')
  return opening?.image ?? null
}
