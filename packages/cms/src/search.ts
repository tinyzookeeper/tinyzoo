import type { FieldDescriptor } from './descriptor'

/**
 * Search over entries, without a search engine or a database extension: the server
 * narrows the candidates in SQL (every word somewhere in the entry, accents and case
 * ignored), then reads what an entry says the way a visitor sees it — headings, text,
 * rich text and the text inside blocks, never addresses, ids or block type names —
 * to check the match, rank it and cut a snippet around the first hit.
 *
 * Meant for the size of a typical client site (hundreds to a few thousand entries).
 */

/** Lowercase, without accents ("Zimní" → "zimni"): the same folding as the SQL side. */
export function foldSearchText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/đ/g, 'd')
}

/** Longest query the search reads, and most words it matches on. */
export const SEARCH_MAX_QUERY = 100
const MAX_TERMS = 8

/**
 * The words of a query, folded: each must appear in an entry (in any order, also
 * inside a longer word: "kvas" finds "kvásek"). Empty when there is nothing to look for.
 */
export function searchTerms(query: string): string[] {
  const folded = foldSearchText(String(query ?? '').slice(0, SEARCH_MAX_QUERY))
  const words = folded.split(/[\s,;]+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean)
  // A longer word already covers a word it contains ("chleb chlebovy" → just "chlebovy").
  const unique = [...new Set(words)].filter((w, _, all) => !all.some((o) => o !== w && o.includes(w)))
  return unique.slice(0, MAX_TERMS)
}

/** Text fields that hold an address or a code, not words a visitor reads. */
const NOT_PROSE = new Set(['email', 'url', 'path', 'link', 'color'])

/** Is this field something people read (and so something to search)? */
export function isSearchableField(fld: FieldDescriptor): boolean {
  if (fld.relation) return false
  if (fld.type === 'text') return !NOT_PROSE.has(String((fld.meta as any)?.format ?? ''))
  return fld.type === 'richtext' || fld.type === 'blocks'
}

/** The words of a rich-text document, one line per paragraph, heading or list item. */
export function richTextPlain(doc: unknown): string {
  const lines: string[] = []
  let line = ''
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'text' && typeof node.text === 'string') {
      line += node.text
      return
    }
    if (node.type === 'hardBreak') line += ' '
    if (Array.isArray(node.content)) for (const child of node.content) walk(child)
    if (node.type !== 'text' && node.type !== 'hardBreak' && node.type !== 'doc' && line.trim()) {
      lines.push(line.trim())
      line = ''
    }
  }
  walk(doc)
  if (line.trim()) lines.push(line.trim())
  return lines.join('\n')
}

/**
 * Everything an entry says, field by field in the order the fields are defined: text,
 * rich text, and inside blocks their own text fields (lists included). Fields in
 * `skip` (e.g. hidden from the public) and anything that is not prose are left out.
 */
export function entryTexts(fields: Record<string, FieldDescriptor>, row: Record<string, any>, skip: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = []
  for (const [key, fld] of Object.entries(fields)) {
    if (skip.has(key) || !isSearchableField(fld)) continue
    collect(fld, row[key], out)
  }
  return out
}

function collect(fld: FieldDescriptor, value: unknown, out: string[]) {
  if (value === null || value === undefined || value === '') return
  if (fld.type === 'text') {
    if (typeof value === 'string' && value.trim()) out.push(value.trim())
  }
  else if (fld.type === 'richtext') {
    const text = richTextPlain(value)
    if (text) out.push(text)
  }
  else if (fld.type === 'blocks' && Array.isArray(value)) {
    const blocks = fld.blocks ?? {}
    for (const block of value) {
      if (!block || typeof block !== 'object') continue
      const def = Object.hasOwn(blocks, block.type) ? blocks[block.type] : undefined
      if (!def) continue
      for (const [key, inner] of Object.entries(def.fields) as [string, FieldDescriptor][]) {
        if (isSearchableField(inner)) collect(inner, block[key], out)
      }
    }
  }
}


// ── matching: exact or with a typo ──────────────────────────────────────────────

/**
 * How many typos a word may have and still match: none under 4 letters, one up to 7,
 * two from 8 ("sousterdeni" → "soustředění", "preveiw" → "preview").
 */
export function allowedTypos(term: string): number {
  return term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0
}

/**
 * Edit distance with swapped neighbours counting as one edit (optimal string
 * alignment), giving up once it is over `max` (returns max + 1).
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const n = b.length
  let prev2 = new Int32Array(n + 1)
  let prev = new Int32Array(n + 1)
  let cur = new Int32Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    let best = i
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      let d = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) d = Math.min(d, prev2[j - 2]! + 1)
      cur[j] = d
      if (d < best) best = d
    }
    if (best > max) return max + 1
    const spare = prev2
    prev2 = prev
    prev = cur
    cur = spare
  }
  return prev[n]!
}

/**
 * Does a (folded) word match a (folded) search term? 'exact' when it contains it,
 * 'typo' when it or its beginning is within the allowed typos — so a word's other
 * forms match too ("priprava" ~ "priprave", "zima" ~ "zimni"). Like most search
 * engines, a typo match keeps the first letter (or swaps the first two).
 */
export function wordMatch(term: string, word: string): 'exact' | 'typo' | null {
  if (word.includes(term)) return 'exact'
  const max = allowedTypos(term)
  if (!max || word.length < 3) return null
  if (word[0] !== term[0] && !(word[0] === term[1] && word[1] === term[0])) return null
  for (let len = term.length - max; len <= term.length + max; len++) {
    if (len < 3 || len > word.length) continue
    // The whole word, or its beginning (an ending that differs is a word form).
    if (len !== word.length && len < term.length) continue
    if (editDistance(term, word.slice(0, len), max) <= max) return 'typo'
  }
  return null
}

/** Where a term is in a folded text: [start, end) ranges, and whether any is exact. */
function termHits(folded: string, term: string): { exact: boolean; ranges: [number, number][] } {
  const ranges: [number, number][] = []
  let exact = false
  // A text repeats its words: each distinct one is checked once.
  const seen = new Map<string, ReturnType<typeof wordMatch>>()
  for (const m of folded.matchAll(/[\p{L}\p{N}]+/gu)) {
    const word = m[0]
    let kind = seen.get(word)
    if (kind === undefined) seen.set(word, kind = wordMatch(term, word))
    if (!kind) continue
    if (kind === 'exact') {
      exact = true
      for (let i = word.indexOf(term); i !== -1; i = word.indexOf(term, i + term.length)) ranges.push([m.index + i, m.index + i + term.length])
    }
    else ranges.push([m.index, m.index + word.length])
  }
  return { exact, ranges }
}

/** One found entry: how well it matches, and a snippet of its text around the words. */
export interface SearchMatch {
  score: number
  /** A sentence or two around the first match (empty when only the title matched). */
  excerpt: string
  /** Where the words are in `excerpt`, as [start, end) pairs, for highlighting. */
  highlights: [number, number][]
}

/**
 * Does an entry match every word (exactly or with a typo), and how well? Null when a
 * word is missing. The title counts most (the whole query in it, at its start, each
 * word in it); then how often the words appear in the text. A word found only with a
 * typo counts for less than the same word spelled right.
 */
export function matchEntry(title: string, texts: string[], terms: string[], query = terms.join(' ')): SearchMatch | null {
  if (!terms.length) return null
  const foldedTitle = foldSearchText(title ?? '')
  const body = texts.join('\n')
  const foldedBody = foldSearchText(body)
  let score = 0
  for (const term of terms) {
    const t = termHits(foldedTitle, term)
    const b = termHits(foldedBody, term)
    if (!t.ranges.length && !b.ranges.length) return null
    if (t.ranges.length) score += t.exact ? 20 + (wordStart(foldedTitle, term) ? 10 : 0) : 12
    if (b.ranges.length) score += Math.min(b.ranges.length, 10) * (b.exact ? 1 : 0.5) + (b.exact && wordStart(foldedBody, term) ? 2 : 0)
  }
  const phrase = foldSearchText(query).trim()
  if (phrase && foldedTitle.includes(phrase)) score += 40 + (foldedTitle.startsWith(phrase) ? 20 : 0) + (foldedTitle === phrase ? 40 : 0)
  return { score, ...excerptOf(body, terms) }
}

const wordStart = (hay: string, needle: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(needle)}`, 'u').test(hay)
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The text folded character by character, with each folded position's original index. */
const foldedChars = new Map<string, string>()
function foldChar(ch: string): string {
  const code = ch.charCodeAt(0)
  if (code < 128) return code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : ch
  let f = foldedChars.get(ch)
  if (f === undefined) {
    f = foldSearchText(ch)
    if (foldedChars.size < 5000) foldedChars.set(ch, f)
  }
  return f
}

function foldWithMap(text: string): { folded: string; at: number[] } {
  let folded = ''
  const at: number[] = []
  let i = 0
  for (const ch of text) {
    const f = foldChar(ch)
    for (let k = 0; k < f.length; k++) at.push(i)
    folded += f
    i += ch.length
  }
  at.push(text.length)
  return { folded, at }
}

/** Every term's hits in `text`, in the text's own characters, merged. */
function hitsIn(text: string, terms: string[]): [number, number][] {
  const { folded, at } = foldWithMap(text)
  const out: [number, number][] = []
  for (const term of terms) for (const [s, e] of termHits(folded, term).ranges) out.push([at[s]!, at[e]!])
  return mergeRanges(out)
}

const EXCERPT_LENGTH = 180

/**
 * About `length` characters of `text` around the first word found (exactly or with a
 * typo), cut at word boundaries, with "…" where it was cut, and where the words are.
 */
export function excerptOf(text: string, terms: string[], length = EXCERPT_LENGTH): Pick<SearchMatch, 'excerpt' | 'highlights'> {
  // One line per heading, paragraph or field: a line that does not end a sentence
  // (a heading, a card title) is set apart from the next with " · ".
  const flat = text.split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
    .reduce((out, line) => (!out ? line : /[.!?…:;]$/.test(out) ? `${out} ${line}` : `${out} · ${line}`), '')
  if (!flat) return { excerpt: '', highlights: [] }
  const hits = hitsIn(flat, terms)
  if (!hits.length) return { excerpt: '', highlights: [] }
  const hit = hits[0]![0]
  // Start a little before the hit (at a word boundary), so it reads as a sentence.
  let start = Math.max(0, hit - Math.round(length * 0.3))
  if (start > 0) {
    const sentence = flat.lastIndexOf('. ', hit)
    if (sentence !== -1 && sentence + 2 >= start - 40 && sentence + 2 <= hit) start = sentence + 2
    else {
      const space = flat.indexOf(' ', start)
      start = space !== -1 && space < hit ? space + 1 : start
    }
  }
  let end = Math.min(flat.length, start + length)
  if (end < flat.length) {
    const space = flat.lastIndexOf(' ', end)
    if (space > hit) end = space
  }
  const prefix = start > 0 ? '…' : ''
  const suffix = end < flat.length ? '…' : ''
  const excerpt = prefix + flat.slice(start, end).replace(/[\s,;:–-]+$/, '') + suffix
  const highlights = hits
    .filter(([s, e]) => s >= start && e <= end)
    .map(([s, e]) => [s - start + prefix.length, e - start + prefix.length] as [number, number])
  return { excerpt, highlights }
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = ranges.sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else out.push([...r])
  }
  return out
}

/** Highlight ranges of `terms` (exact or with a typo) in a short text (a title), as [start, end) pairs. */
export function highlightRanges(text: string, terms: string[]): [number, number][] {
  return hitsIn(text, terms)
}
