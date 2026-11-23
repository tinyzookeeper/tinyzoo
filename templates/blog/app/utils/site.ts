// The Blog template's own helpers: its words, and what each part of the front page takes from
// the articles (the lead, the picks, the list, the series, the most read). The content is in the
// CMS; Nuxt auto-imports what is exported here. (Addresses, prices and dates are the template
// kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import { dateParts, type DateParts } from '../../../kit/app/utils/format'
import type { Article, Author, Page, Section, Series } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** The addresses that lead to an entry: an article, a section, a series, an author. */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'article', prefix: 'clanek', entity: 'article', part: 'Article', titleField: 'title', descriptionField: 'perex', imageField: 'image' },
  { kind: 'section', prefix: 'rubrika', entity: 'section', part: 'SectionPage', titleField: 'name', descriptionField: 'description' },
  { kind: 'series', prefix: 'serial', entity: 'series', part: 'SeriesPage', titleField: 'name', descriptionField: 'description', imageField: 'image' },
  { kind: 'author', prefix: 'autor', entity: 'author', part: 'AuthorPage', titleField: 'name', descriptionField: 'bio', imageField: 'photo' },
]

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `serial` (for `/#serial`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

// ── reading time ──

const WORDS_PER_MINUTE = 200

/** The words in a rich-text document. */
function wordsIn(node: unknown): number {
  if (!node || typeof node !== 'object') return 0
  const n = node as { text?: unknown; content?: unknown[] }
  if (typeof n.text === 'string') return n.text.split(/\s+/).filter(Boolean).length
  return (n.content ?? []).reduce<number>((sum, child) => sum + wordsIn(child), 0)
}

/** The minutes an article takes to read: the editor's own figure, else counted from the text. */
export function minutesOf(a: Pick<Article, 'readingMinutes' | 'body'>): number {
  return a.readingMinutes ?? Math.max(1, Math.round(wordsIn(a.body) / WORDS_PER_MINUTE))
}

/** 114 → "1 h 54 min", 45 → "45 min". */
export const hoursMinutes = (total: number): string => (total >= 60 ? `${Math.floor(total / 60)} h ${total % 60} min` : `${total} min`)

// ── which articles ──

const time = (a: Article): number => (a.publishedAt ? Date.parse(a.publishedAt) : 0)
/** Newest first (the API sends them so; this keeps a list right after it is filtered or joined). */
export const newestFirst = (articles: readonly Article[]): Article[] => [...articles].sort((a, b) => time(b) - time(a))

/** The articles that are not parts of a series: what the lists of the front page are made of. */
export const standalone = (articles: readonly Article[]): Article[] => newestFirst(articles).filter((a) => !a.series)

/** The lead article: the newest one marked so, else the newest article. */
export const leadOf = (articles: readonly Article[]): Article | null => {
  const all = standalone(articles)
  return all.find((a) => a.lead) ?? all[0] ?? null
}

/** The editors' picks: the newest three marked, without the lead. */
export const picksOf = (articles: readonly Article[]): Article[] => {
  const lead = leadOf(articles)
  return standalone(articles).filter((a) => a.pick && a.id !== lead?.id).slice(0, 3)
}

/** The short articles ("Krátce"): the newest three marked, without the lead and the picks. */
export const briefsOf = (articles: readonly Article[]): Article[] => {
  const taken = new Set([leadOf(articles)?.id, ...picksOf(articles).map((a) => a.id)])
  return standalone(articles).filter((a) => a.brief && !taken.has(a.id)).slice(0, 3)
}

/**
 * The articles of the list block. "Those not shown above" leaves out the lead and the picks; the
 * short articles too in Obálka (it prints them on the cover), while Čtvrthodinka lists them and
 * adds `count` others. Čtvrthodinka sorts by reading time, the staircase of bars; Obálka by date.
 */
export function listOf(articles: readonly Article[], block: { scope: 'rest' | 'all' | null; count: number | null }, look: string): Article[] {
  const count = block.count ?? 6
  const all = standalone(articles)
  let chosen: Article[]
  if (block.scope === 'all') {
    chosen = all.slice(0, count)
  }
  else {
    const shown = new Set([leadOf(articles)?.id, ...picksOf(articles).map((a) => a.id)])
    const rest = all.filter((a) => !shown.has(a.id))
    const briefs = new Set(briefsOf(articles).map((a) => a.id))
    const others = rest.filter((a) => !briefs.has(a.id)).slice(0, count)
    chosen = look === 'ctvrthodinka' ? newestFirst([...rest.filter((a) => briefs.has(a.id)), ...others]) : others
  }
  return look === 'ctvrthodinka' ? [...chosen].sort((a, b) => minutesOf(a) - minutesOf(b)) : chosen
}

/** The articles with a place among the most read, in that order. */
export const mostReadOf = (articles: readonly Article[]): Article[] =>
  articles.filter((a) => a.mostReadRank != null).sort((a, b) => a.mostReadRank! - b.mostReadRank!)

/** A section's latest articles. */
export const inSection = (articles: readonly Article[], section: Pick<Section, 'id'>): Article[] => standalone(articles).filter((a) => a.section?.id === section.id)

/** An author's articles, newest first (parts of a series too: they wrote them). */
export const byAuthor = (articles: readonly Article[], author: Pick<Author, 'id'>): Article[] => newestFirst(articles).filter((a) => a.author?.id === author.id)

/** The parts of a series in order. */
export const partsOf = (articles: readonly Article[], series: Pick<Series, 'id'>): Article[] =>
  articles.filter((a) => a.series?.id === series.id).sort((a, b) => (a.seriesPart ?? 0) - (b.seriesPart ?? 0))

/** The series the front page shows: the one with the newest part, else the first. */
export function frontSeries(articles: readonly Article[], all: readonly Series[]): Series | null {
  const newest = newestFirst(articles).find((a) => a.series)
  return all.find((s) => s.id === newest?.series?.id) ?? all[0] ?? null
}

/** The part of a series that came out last. */
export const latestPart = (parts: readonly Article[]): Article | null => [...parts].sort((a, b) => (b.seriesPart ?? 0) - (a.seriesPart ?? 0))[0] ?? null

/** Where an article stands: its address. */
export const articleHref = (a: Pick<Article, 'slug'>): string => `/clanek/${a.slug}`

/** "Listopad: první sníh a poslední dříví" → "První sníh a poslední dříví": a part without its month, as the lists write it. */
export function partTitle(a: Pick<Article, 'title'>): string {
  const at = a.title.indexOf(': ')
  const rest = at === -1 ? a.title : a.title.slice(at + 2)
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

/** What a list calls an article: its headline; a part of a series also says which. */
export function listTitle(a: Pick<Article, 'title' | 'series' | 'seriesPart'>, words: Words): string {
  return a.series ? words.partOf(a.series.name, a.seriesPart ?? 0, partTitle(a)) : a.title
}

// ── the figures of the front page ──

/** How many articles there are and how long they take to read: the line beside "Last week". */
export function statsOf(articles: readonly Article[]) {
  const all = standalone(articles)
  return { count: all.length, minutes: all.reduce((sum, a) => sum + minutesOf(a), 0) }
}

/** Čtvrthodinka's three shelves, by reading time: up to five minutes, up to a quarter of an hour, the rest. */
export const SHELVES = [
  { key: '5', from: 0, to: 5 },
  { key: '15', from: 6, to: 15 },
  { key: '60', from: 16, to: 999 },
] as const
export type ShelfKey = typeof SHELVES[number]['key']

/** The articles a shelf holds: the standalone ones and the latest part of the series on the front page. */
export function shelfArticles(articles: readonly Article[], key: ShelfKey): Article[] {
  const shelf = SHELVES.find((s) => s.key === key)!
  const newest = newestFirst(articles).find((a) => a.series)
  return [...standalone(articles), ...(newest ? [newest] : [])].filter((a) => minutesOf(a) >= shelf.from && minutesOf(a) <= shelf.to)
}

// ── dates ──

/** "19. listopadu": a day without its year. */
export const dayMonth = (iso: string | null | undefined): string => { const d = dateParts(iso); return d ? `${d.day}. ${d.month}` : '' }
/** "17. 11.": the short way, for a byline with little room. */
export const dayShort = (iso: string | null | undefined): string => { const d = dateParts(iso); return d ? `${d.day}. ${d.monthNumber}.` : '' }

/** The ISO week of a day (week 1 is the one with the year's first Thursday). */
export function isoWeek(d: Pick<DateParts, 'day' | 'monthNumber' | 'year'>): number {
  const date = new Date(Date.UTC(Number(d.year), Number(d.monthNumber) - 1, Number(d.day)))
  const weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - weekday)
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  return Math.ceil(((date.getTime() - start) / 86_400_000 + 1) / 7)
}

/** The first and the last year of the copyright line: the year the magazine began, and the year of its newest article. */
export function yearsOf(articles: readonly Article[], founded: number | null | undefined): string {
  const years = articles.map((a) => Number(dateParts(a.publishedAt)?.year)).filter(Boolean)
  const last = years.length ? Math.max(...years) : null
  const first = founded ?? (years.length ? Math.min(...years) : null)
  if (first == null || last == null) return String(first ?? last ?? '')
  return first >= last ? String(last) : `${first}–${last}`
}

/**
 * A text in two voices, for Čtvrthodinka: what comes before the sentence that holds the *marked*
 * part, and the rest (without asterisks). Without a marked part: the first sentence, and the rest.
 */
export function firstSentence(text: string | null | undefined): [first: string, rest: string] {
  const source = (text ?? '').trim()
  const star = source.indexOf('*')
  const plain = source.replace(/\*/g, '')
  if (star > 0) {
    const at = source.lastIndexOf('. ', star)
    if (at > 0) return [source.slice(0, at + 1).replace(/\*/g, ''), source.slice(at + 2).replace(/\*/g, '')]
  }
  const end = plain.search(/[.!?]\s/)
  return end === -1 ? [plain, ''] : [plain.slice(0, end + 1), plain.slice(end + 2)]
}

/** The size class of the opening's name, by how long it is: a long name needs smaller type than "Souvrať". */
export const NAME_SIZES: Array<[max: number, cls: string]> = [
  [9, 'text-[5.1rem] sm:text-[8rem] lg:text-[12.5rem]'],
  [14, 'text-[3.4rem] sm:text-[5.4rem] lg:text-[8.5rem]'],
]
export const NAME_SIZE_LONG = 'text-[2.4rem] sm:text-[3.6rem] lg:text-[5.5rem]'
