// The editor in the preview: which field of a block a clicked text shows, found from the page itself
// (since 2e). A site's own block component says nothing: the page compares the clicked element's text
// with the block's own values (what <CmsBlocks> drew it from) and takes the smallest element, from the
// click up to the block's root, whose text is exactly one field's value. An element a site marks with
// `cmsField()` is never asked: the mark wins. An element marked `data-cms-field="off"` (`cmsField('off')`)
// and everything inside it is never found.
//
// Texts are compared in a normal form: white space collapsed, non-breaking and narrow spaces as plain
// spaces, invisible characters dropped, trimmed; in a value the look's `*marked*` words lose their
// asterisks (the look draws them as an element), so a heading "Hello *world*" is found in "Hello world".
// A line break of a value is a space, and so is a `<br>` or the edge of a paragraph on the page.
// Upper case by CSS needs nothing: the page's own text is read, not what CSS shows.
//
// When one text is the value of two fields or items, the text alone does not tell. The order does only
// when it is safe: the same field of items of one list, and as many elements with that text in the
// block as items with that value; then the n-th element (in the page's order) is the n-th item (in the
// list's order). Anything else is not offered.
//
// Pure functions of plain values and of anything shaped like a DOM node, so they are unit-tested on a
// small fake tree (test/unit/builder-match.spec.ts) and used by the overlay (app/builder/overlay.ts).
import type { CmsBuilderField, CmsTextNode } from './builder'

/** A node as the matcher reads it: a DOM node, or anything shaped like one. */
export interface CmsMatchNode extends CmsTextNode {
  parentNode: CmsMatchNode | null
  childNodes: ArrayLike<CmsMatchNode>
}

/** A field (or a field of an item of the block's own list) the page may find by its text. */
export interface CmsMatchField {
  field: string
  /** The item's id, for a field of an item of the block's own list (`f.list()`). */
  item: string | null
  /** The key of the list the item is in. */
  list: string | null
  /** A plain text (typed in the page) or a rich text (its field comes into view in the panel). */
  kind: 'text' | 'rich'
  /** The value in the normal form. */
  norm: string
  /** For a plain text: one line or several, and its maximum. */
  text?: 'line' | 'lines'
  max?: number
}

/** A picture field (or a field of an item) and the addresses of its pictures. */
export interface CmsMatchPicture {
  field: string
  item: string | null
  list: string | null
  urls: string[]
  ids: string[]
}

/** What a click found: a field, or several it could be and the order does not tell. */
/**
 * What a click found: a field, or several it could be and the order does not tell. `range`: the field is
 * a part of a longer text of one text node (`el`), from `range[0]` to `range[1]` of its text.
 */
export type CmsMatch<N> = { el: N; field: CmsMatchField; range?: [number, number] } | { el: N; ambiguous: CmsMatchField[] } | null

// ── the normal form ──

// No-break, figure, narrow no-break, thin, hair, en/em spaces and the like, ideographic space.
const SPACES = /[  -   　]/g
// Soft hyphen, zero-width space and joiners, word joiner, byte order mark.
const INVISIBLE = /[­​-‍⁠﻿]/g

/** White space collapsed, odd spaces as spaces, invisible characters dropped, trimmed. */
export function cmsMatchSquash(text: string): string {
  return text.replace(INVISIBLE, '').replace(SPACES, ' ').replace(/\s+/g, ' ').trim()
}

/** A plain-text value in the normal form: the look's `*marked*` words without their asterisks. */
export function cmsMatchValue(value: string): string {
  return cmsMatchSquash(value.replace(/\*([^*]+)\*/g, '$1'))
}

const BLOCKS = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'TABLE', 'TR', 'TD', 'TH', 'DT', 'DD', 'DL', 'FIGURE', 'FIGCAPTION', 'ASIDE', 'NAV', 'MAIN', 'ADDRESS', 'DETAILS', 'SUMMARY'])
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'svg', 'IFRAME', 'SELECT', 'TEXTAREA'])

const attr = (n: CmsTextNode, name: string) => n.getAttribute?.(name) ?? null
const isElement = (n: CmsTextNode) => n.nodeType === 1

/** Whether an element is left out of the matching, and all inside it: `data-cms-field="off"`. */
export const cmsMatchOff = (n: CmsTextNode) => isElement(n) && attr(n, 'data-cms-field') === 'off'

/**
 * An element's text as a visitor reads it, in the normal form: its text in order, a `<br>` and the edge
 * of a paragraph or another block a space. What is hidden from everyone (`aria-hidden="true"`: an icon,
 * a decoration) and what is no text (a script, a style, an SVG drawing) does not count.
 */
export function cmsMatchShown(el: CmsTextNode): string {
  const walk = (n: CmsTextNode): string => {
    if (n.nodeType === 3) return n.nodeValue ?? ''
    if (!isElement(n)) return ''
    const name = n.nodeName.toUpperCase()
    if (name === 'BR') return ' '
    if (SKIP.has(n.nodeName) || SKIP.has(name) || attr(n, 'aria-hidden') === 'true') return ''
    let inner = ''
    for (let i = 0; i < n.childNodes.length; i++) inner += walk(n.childNodes[i]!)
    return BLOCKS.has(name) ? ` ${inner} ` : inner
  }
  if (el.nodeType === 3) return cmsMatchSquash(el.nodeValue ?? '')
  let out = ''
  for (let i = 0; i < el.childNodes.length; i++) out += walk(el.childNodes[i]!)
  return cmsMatchSquash(out)
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Whether a value is a rich text's document (TipTap/ProseMirror JSON). */
export const isCmsRichDoc = (x: unknown): x is { type: 'doc'; content?: unknown[] } => isObject(x) && x.type === 'doc'

/** A rich text's plain text in the normal form: its texts in order, a hard break and the edge of a block a space. */
export function cmsRichPlain(doc: unknown): string {
  let out = ''
  const walk = (n: unknown, depth: number) => {
    if (!isObject(n) || depth > 40) return
    if (n.type === 'text' && typeof n.text === 'string') { out += n.text; return }
    if (n.type === 'hardBreak') { out += ' '; return }
    const inline = n.type === 'text'
    if (!inline) out += ' '
    if (Array.isArray(n.content)) for (const c of n.content) walk(c, depth + 1)
    if (!inline) out += ' '
  }
  walk(doc, 0)
  return cmsMatchSquash(out)
}

/** Whether a value is a picture as the content API gives it (`{ id, url }`). */
const isMedia = (x: unknown): x is { id?: unknown; url: string } => isObject(x) && typeof x.url === 'string' && x.url.length > 0

// ── a block's fields ──

function fieldsOf(values: Record<string, unknown>, fields: Record<string, CmsBuilderField>, item: string | null, list: string | null, out: CmsMatchField[]) {
  for (const [key, info] of Object.entries(fields)) {
    const value = values[key]
    if (info.items) continue
    if (info.text && typeof value === 'string') {
      const norm = cmsMatchValue(value)
      if (norm) out.push({ field: key, item, list, kind: 'text', norm, text: info.text, ...(info.max ? { max: info.max } : {}) })
    }
    else if (isCmsRichDoc(value)) {
      const norm = cmsRichPlain(value)
      if (norm) out.push({ field: key, item, list, kind: 'rich', norm })
    }
  }
}

/** The items of a block's own lists (`f.list()`), with their list's key and fields. */
function* itemsOf(block: Record<string, unknown>, fields: Record<string, CmsBuilderField>) {
  for (const [key, info] of Object.entries(fields)) {
    if (!info.items || !Array.isArray(block[key])) continue
    for (const x of block[key] as unknown[]) if (isObject(x) && typeof x.id === 'string' && x.id) yield { key, item: x, fields: info.items }
  }
}

/**
 * The plain and rich texts of a block the page may find, from the block's values (as <CmsBlocks> drew
 * them) and its fields (as the admin describes them): the block's own first, in the order of its
 * fields, then the items of its lists in their order. Empty values are left out: they have no text.
 */
export function cmsMatchFields(block: Record<string, unknown>, fields: Record<string, CmsBuilderField> | undefined): CmsMatchField[] {
  if (!fields) return []
  const out: CmsMatchField[] = []
  fieldsOf(block, fields, null, null, out)
  for (const { key, item, fields: inner } of itemsOf(block, fields)) fieldsOf(item, inner, item.id as string, key, out)
  return out
}

/** The picture fields of a block (and of its items), with the addresses of what they hold. */
export function cmsMatchPictures(block: Record<string, unknown>, fields: Record<string, CmsBuilderField> | undefined): CmsMatchPicture[] {
  if (!fields) return []
  const out: CmsMatchPicture[] = []
  const add = (values: Record<string, unknown>, own: Record<string, CmsBuilderField>, item: string | null, list: string | null) => {
    for (const [key, info] of Object.entries(own)) {
      if (info.items || info.text) continue
      const value = values[key]
      const all = (Array.isArray(value) ? value : [value]).filter(isMedia)
      if (all.length) out.push({ field: key, item, list, urls: all.map((m) => m.url), ids: all.map((m) => (typeof m.id === 'string' ? m.id : '')).filter(Boolean) })
    }
  }
  add(block, fields, null, null)
  for (const { key, item, fields: inner } of itemsOf(block, fields)) add(item, inner, item.id as string, key)
  return out
}

/** The path of an address, without its origin, query and hash. */
function pathOf(url: string): string {
  const s = url.trim()
  const noOrigin = s.replace(/^[a-z][a-z\d+.-]*:\/\/[^/]+/i, '').replace(/^\/\/[^/]+/, '')
  return noOrigin.replace(/[?#].*$/, '')
}

/**
 * The picture field an image shows, from its addresses (its `src`, the one the browser chose, those of
 * its `srcset`): one whose picture has the same address, or whose id is a part of it (a smaller copy).
 * Two fields with that picture: the same rule of order as for texts (`index`: the image's place among
 * the block's images of that picture, `count`: how many there are).
 */
export function cmsMatchPictureOf(sources: string[], pictures: CmsMatchPicture[], order?: { index: number; count: number }): CmsMatchPicture | null {
  const paths = sources.filter(Boolean).map(pathOf).filter(Boolean)
  if (!paths.length) return null
  const hits = pictures.filter((p) => p.urls.some((u) => paths.includes(pathOf(u))) || p.ids.some((id) => paths.some((x) => x.includes(`/${id}/`) || x.endsWith(`/${id}`))))
  if (hits.length === 1) return hits[0]!
  if (hits.length < 2 || !order) return null
  const safe = hits.every((h) => h.item !== null && h.list === hits[0]!.list && h.field === hits[0]!.field)
  return safe && order.count === hits.length && order.index >= 0 && order.index < hits.length ? hits[order.index]! : null
}

/** Every source of an image's addresses as `srcset` lists them. */
export function cmsSrcsetUrls(srcset: string | null | undefined): string[] {
  if (!srcset) return []
  return srcset.split(',').map((part) => part.trim().split(/\s+/)[0] ?? '').filter(Boolean)
}

/**
 * The fields no element of the block is marked for (`cmsField()`): a marked field is where its mark is,
 * so it is no candidate for a text found by itself (its value may stand elsewhere too: an eyebrow with
 * the heading's words).
 */
export function cmsMatchUnmarked(fields: CmsMatchField[], elements: CmsMatchNode[]): CmsMatchField[] {
  const marks = new Set<string>()
  for (const el of elements) {
    const field = attr(el, 'data-cms-field')
    if (field && field !== 'off') marks.add(`${field}\n${attr(el, 'data-cms-item') ?? ''}`)
  }
  return marks.size ? fields.filter((f) => !marks.has(`${f.field}\n${f.item ?? ''}`)) : fields
}

// ── the walk ──

function contains(outer: CmsMatchNode, inner: CmsMatchNode): boolean {
  for (let n: CmsMatchNode | null = inner; n; n = n.parentNode) if (n === outer) return true
  return false
}

/**
 * The elements of a block (its root elements and all inside them) in the page's order, without what is
 * inside another block (`data-cms-block`, a block of the block's own list of blocks) or switched off.
 */
export function cmsMatchElements<N extends CmsMatchNode>(roots: N[], options: { texts?: boolean; text?: (n: N) => string } = {}): N[] {
  const out: N[] = []
  const text = options.text ?? cmsMatchShown
  const walk = (n: N, root: boolean) => {
    if (n.nodeType === 3) {
      // A text beside other content of its element (`<strong>Title.</strong> text`) is a part of its own.
      if (options.texts && mixed(n, text)) out.push(n)
      return
    }
    if (!isElement(n) || cmsMatchOff(n) || isDrawing(n)) return
    if (!root && attr(n, 'data-cms-block') !== null) return
    out.push(n)
    for (let i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i] as N, false)
  }
  for (const r of roots) walk(r, true)
  return out
}

/** An SVG drawing: its texts are drawn, not typed in. */
const isDrawing = (n: CmsTextNode) => isElement(n) && n.nodeName.toUpperCase() === 'SVG'

/** A text node with text of its own that is not all of its element's text: it stands beside other content. */
function mixed<N extends CmsMatchNode>(n: N, text: (n: N) => string): boolean {
  const own = text(n)
  return !!own && !!n.parentNode && text(n.parentNode as N) !== own
}

/**
 * The element and its ancestors up to the block's root (one of `roots`), or `[]` when it is outside them.
 * Started from a text node (the one under the pointer), the text node comes first.
 */
export function cmsMatchChain<N extends CmsMatchNode>(el: N, roots: N[]): N[] {
  const chain: N[] = []
  for (let n: N | null = el; n; n = n.parentNode as N | null) {
    // Inside an SVG drawing: nothing of it is a part to type in.
    if (isDrawing(n)) { chain.length = 0; if (roots.includes(n)) return chain; continue }
    if (isElement(n) || (n === el && n.nodeType === 3)) chain.push(n)
    if (roots.includes(n)) return chain
  }
  return []
}

// Quotes, brackets and dashes a look may draw around a value, and the punctuation it may put after one.
const ADDED_BEFORE = /^[\s"'„“”‚‘’«»‹›([–—·•|/-]+/
const ADDED_AFTER = /[\s"'„“”‚‘’«»‹›)\].:,;!?…–—·•|/-]+$/

/** A text without the quotes, brackets and punctuation a look may add around a value; `''` when nothing else is left. */
export function cmsMatchBare(text: string): string {
  return text.replace(ADDED_BEFORE, '').replace(ADDED_AFTER, '')
}

/** The fields whose value is the text: exactly, else but for what a look adds around it (a period after a title, quotes around a quote), else but for upper and lower case. */
function fieldsWith(fields: CmsMatchField[], shown: string): CmsMatchField[] {
  const exact = fields.filter((f) => f.norm === shown)
  if (exact.length) return exact
  const bare = cmsMatchBare(shown)
  if (!bare) return []
  const loose = fields.filter((f) => cmsMatchBare(f.norm) === bare)
  if (loose.length) return loose
  // A look that capitalises a value in its code (the first letter, or all of it).
  const folded = bare.toLocaleLowerCase('cs')
  return fields.filter((f) => cmsMatchBare(f.norm).toLocaleLowerCase('cs') === folded)
}

/**
 * Which field a click found: walking `chain` (the clicked element and its ancestors up to the block's
 * root), the first element whose text is exactly one field's value. Two or more fields with that value:
 * the order tells only for one field of items of one list with as many elements of that text in the
 * block (`all`, in the page's order) as items; else it is ambiguous and nothing is offered. An element
 * switched off (`data-cms-field="off"`) anywhere on the way: nothing. When no element shows exactly one
 * value and the chain starts at a text node, `at` (the click's place in its text) looks for a value
 * inside that text (`cmsMatchInText`).
 */
export function cmsMatchAt<N extends CmsMatchNode>(chain: N[], fields: CmsMatchField[], all: () => N[], text: (n: N) => string = cmsMatchShown, at?: number | null): CmsMatch<N> {
  if (!fields.length || chain.some(cmsMatchOff)) return null
  for (const el of chain) {
    const shown = text(el)
    if (!shown) continue
    // A text node is asked only beside other content: alone, its element is the smallest part with its text.
    if (el.nodeType === 3 && el.parentNode && text(el.parentNode as N) === shown) continue
    const hits = fieldsWith(fields, shown).filter((f) => el.nodeType !== 3 || f.kind === 'text')
    if (!hits.length) continue
    if (hits.length === 1) return { el, field: hits[0]! }
    const first = hits[0]!
    const safe = hits.every((h) => h.item !== null && h.list === first.list && h.field === first.field && h.kind === first.kind)
    if (!safe) return { el, ambiguous: hits }
    // The smallest parts with this text: none of their children has it too.
    const same = all().filter((n) => text(n) === shown && ![...asArray(n.childNodes)].some((c) => isElement(c) && text(c as N) === shown))
    const at = same.findIndex((n) => n === el || contains(el, n))
    if (same.length !== hits.length || at < 0) return { el, ambiguous: hits }
    return { el, field: hits[at]! }
  }
  // Nothing shows exactly one value: a value inside the longer text of the text node clicked on.
  const first = chain[0]
  if (first && first.nodeType === 3 && at !== undefined) {
    const part = cmsMatchInText(first.nodeValue ?? '', at, fields)
    if (part === 'ambiguous') return null
    if (part) return { el: first, field: part.field, range: [part.start, part.end] }
  }
  return null
}

const WORD = /[\p{L}\p{N}]/u

/** A text in the normal form, with the place in the raw text of each of its characters. */
function squashWithMap(raw: string): { norm: string; map: number[] } {
  let norm = ''
  const map: number[] = []
  let space = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!
    if (INVISIBLE_CHAR.test(c)) continue
    if (SPACE_CHAR.test(c)) { space = norm.length > 0; continue }
    if (space) { norm += ' '; map.push(i - 1); space = false }
    norm += c
    map.push(i)
  }
  return { norm, map }
}

/**
 * The plain text fields whose value stands inside the longer text of one text node (`Rozpis · podzim 2026`,
 * `Hrací plocha: tráva`), as whole words, and where: each place a value is found, in the raw text. With
 * `at` (the click's place in the raw text), only the place under it: the longest there; two fields of
 * the same value there are `ambiguous`.
 */
export function cmsMatchInText(raw: string, at: number | null, fields: CmsMatchField[]): { field: CmsMatchField; start: number; end: number } | 'ambiguous' | null {
  const all = cmsMatchPlacesInText(raw, fields).filter((p) => at === null || (p.start <= at && at <= p.end))
  if (!all.length) return null
  const longest = Math.max(...all.map((p) => p.end - p.start))
  const best = all.filter((p) => p.end - p.start === longest)
  return best.length === 1 ? best[0]! : 'ambiguous'
}

/** Every place in a text node's raw text where a plain text field's value stands as whole words (two of one value: both). */
export function cmsMatchPlacesInText(raw: string, fields: CmsMatchField[]): { field: CmsMatchField; start: number; end: number }[] {
  const { norm, map } = squashWithMap(raw)
  const out: { field: CmsMatchField; start: number; end: number }[] = []
  for (const f of fields) {
    if (f.kind !== 'text' || f.norm.length < 2 || f.norm.length >= norm.length) continue
    for (let i = norm.indexOf(f.norm); i >= 0; i = norm.indexOf(f.norm, i + 1)) {
      const end = i + f.norm.length
      if ((i > 0 && WORD.test(norm[i - 1]!) && WORD.test(f.norm[0]!)) || (end < norm.length && WORD.test(norm[end]!) && WORD.test(f.norm[f.norm.length - 1]!))) continue
      out.push({ field: f, start: map[i]!, end: map[end - 1]! + 1 })
    }
  }
  return out
}

const asArray = <T>(list: ArrayLike<T>): T[] => Array.from(list)

// ── the place of the cursor ──

const SPACE_CHAR = /[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]/
const INVISIBLE_CHAR = /[\u00AD\u200B-\u200D\u2060\uFEFF]/
const isSpace = (c: string) => SPACE_CHAR.test(c)
const sameChar = (a: string, b: string) => a === b || (isSpace(a) && isSpace(b))

/**
 * Where the cursor goes in a field's raw value when the click was `at` characters into the text the
 * page shows for it: the raw value may hold the look's asterisks, line breaks the page draws as a
 * `<br>` (no character) and runs of spaces the page collapses. Characters are matched in order; what
 * the page shows and the value does not have is skipped.
 */
export function cmsMatchOffset(shown: string, raw: string, at: number): number {
  const stop = Math.max(0, Math.min(at, shown.length))
  let i = 0
  let j = 0
  while (i < stop && j < raw.length) {
    const s = shown[i]!
    const r = raw[j]!
    if (sameChar(s, r)) {
      // A run of spaces on either side counts as one.
      if (isSpace(s)) {
        while (i < stop && isSpace(shown[i]!)) i++
        while (j < raw.length && isSpace(raw[j]!)) j++
      }
      else { i++; j++ }
      continue
    }
    if (r === '*' || INVISIBLE_CHAR.test(r)) { j++; continue }
    // A line break of the value drawn as a <br>: no character on the page.
    if (r === '\n') { j++; continue }
    if (isSpace(s) || INVISIBLE_CHAR.test(s)) { i++; continue }
    // Something the page adds (or changes): skip it on the page.
    i++
  }
  // The asterisk that opens a marked word stays before the cursor when the click was at the word's start.
  return Math.min(j, raw.length)
}

// ── what is found and what is not (for the measuring script) ──

export type CmsMatchMiss = 'not-on-page' | 'longer-text' | 'split' | 'ambiguous' | 'hidden' | 'form' | 'drawing'

/** The text of an SVG drawing's elements (a label on a map, a word set on an arc), in the normal form. */
function drawnText(n: CmsMatchNode): string {
  let out = ''
  const walk = (x: CmsMatchNode) => {
    if (x.nodeType === 3) { out += ` ${x.nodeValue ?? ''}`; return }
    for (let i = 0; i < x.childNodes.length; i++) walk(x.childNodes[i]!)
  }
  walk(n)
  return cmsMatchSquash(out)
}

/** Whether a node is inside a form's choice (an option of a select): shown by the browser, not as text of the page. */
function inChoice(n: CmsMatchNode): boolean {
  for (let at: CmsMatchNode | null = n; at; at = at.parentNode) if (isElement(at) && ['SELECT', 'OPTION', 'DATALIST'].includes(at.nodeName.toUpperCase())) return true
  return false
}

export interface CmsMatchReport<N> {
  found: { field: CmsMatchField; el: N; marked: boolean }[]
  missed: { field: CmsMatchField; reason: CmsMatchMiss }[]
}

/**
 * For each plain or rich text of a block, whether a click finds it: an element marked for it, or an
 * element whose text the walk resolves to it. A text not found says why: no element shows it (the page
 * shows another text: a shortened or changed one), it stands inside a longer text of one element, it is
 * split across elements in a way the normal form does not join, two fields have it and the order does
 * not tell, the only elements that show it are hidden at this width (`visible`), or only a form's
 * choice (an option of a select) shows it, or only an SVG drawing does. A value inside the longer text of one text node, as whole
 * words, is found there when no other field has that value.
 */
export function cmsMatchReport<N extends CmsMatchNode>(roots: N[], fields: CmsMatchField[], visible: (n: N) => boolean = () => true, text: (n: N) => string = cmsMatchShown): CmsMatchReport<N> {
  const all = cmsMatchElements(roots, { texts: true, text })
  const shown = all.filter((n) => visible(n.nodeType === 3 ? n.parentNode as N : n))
  const found = new Map<CmsMatchField, { field: CmsMatchField; el: N; marked: boolean }>()
  const ambiguous = new Set<CmsMatchField>()
  for (const el of all) {
    const mark = attr(el, 'data-cms-field')
    if (mark && mark !== 'off') {
      const item = attr(el, 'data-cms-item')
      for (const f of fields) if (f.field === mark && f.item === (item || null) && !found.has(f)) found.set(f, { field: f, el, marked: true })
    }
  }
  const auto = cmsMatchUnmarked(fields, all)
  for (const el of shown) {
    const t = text(el)
    if (!t || !fieldsWith(auto, t).length) continue
    const m = cmsMatchAt([el], auto, () => shown, text)
    if (m && 'field' in m) { if (!found.has(m.field)) found.set(m.field, { field: m.field, el, marked: false }) }
    else if (m) for (const f of m.ambiguous) ambiguous.add(f)
  }
  // A value inside the longer text of one text node, where no other field has that value.
  const textNodes: N[] = []
  const collect = (n: N, root: boolean) => {
    if (n.nodeType === 3) { if (n.parentNode && visible(n.parentNode as N)) textNodes.push(n); return }
    if (!isElement(n) || cmsMatchOff(n) || isDrawing(n) || (!root && attr(n, 'data-cms-block') !== null)) return
    for (let i = 0; i < n.childNodes.length; i++) collect(n.childNodes[i] as N, false)
  }
  for (const r of roots) collect(r, true)
  for (const n of textNodes) {
    for (const p of cmsMatchPlacesInText(n.nodeValue ?? '', auto)) {
      if (found.has(p.field) || auto.some((f) => f !== p.field && f.norm === p.field.norm)) continue
      found.set(p.field, { field: p.field, el: n, marked: false })
    }
  }
  const whole = roots.map((r) => text(r)).join(' ')
  const drawings: string[] = []
  const svgs = (n: CmsMatchNode) => {
    if (!isElement(n)) return
    if (n.nodeName.toUpperCase() === 'SVG') { drawings.push(drawnText(n)); return }
    for (let i = 0; i < n.childNodes.length; i++) svgs(n.childNodes[i]!)
  }
  for (const r of roots) svgs(r)
  const nodes: string[] = []
  const texts = (n: CmsMatchNode) => {
    if (n.nodeType === 3) { const v = cmsMatchSquash(n.nodeValue ?? ''); if (v) nodes.push(v) }
    else if (isElement(n) && !cmsMatchOff(n)) for (let i = 0; i < n.childNodes.length; i++) texts(n.childNodes[i]!)
  }
  for (const r of roots) texts(r)
  const missed: CmsMatchReport<N>['missed'] = []
  for (const f of fields) {
    if (found.has(f)) continue
    let reason: CmsMatchMiss
    if (ambiguous.has(f)) reason = 'ambiguous'
    else if (all.some((el) => el.nodeType === 1 && !visible(el) && text(el) === f.norm)) reason = all.some((el) => el.nodeType === 1 && inChoice(el) && text(el) === f.norm) ? 'form' : 'hidden'
    else if (!whole.includes(f.norm)) reason = drawings.some((d) => d.includes(f.norm)) ? 'drawing' : 'not-on-page'
    else if (nodes.some((v) => v.includes(f.norm))) reason = 'longer-text'
    else reason = 'split'
    missed.push({ field: f, reason })
  }
  return { found: [...found.values()], missed }
}
