// Which colours does a look put together with its main colour? Read from the look's own code.
//
// An owner's own main colour is kept readable against the colours the look sets it on or under
// (palette.ts: `own.against`, `own.fixed`). This file finds those colours, so nobody lists them
// by hand: templates/kit/scripts/look-pairs.mjs runs it and writes the answer into looks.ts.
//
// What it reads, for one look:
//   - the look's stylesheet (app/assets/css/<look>.css), block by block, nested blocks included;
//   - the look's components, the template's shared ones (components/global and the top level
//     of components/): the `<template>`, the `<script>` and the `<style>` of each .vue file;
//   - the Tailwind colour names of the template (the `@theme` of app/assets/css/main.css), to know
//     which variable `bg-brand` or `text-cream` stands for.
//
// A pair is a background and a text *in the same place*: one CSS block, or one element's classes
// (a variant such as `hover:` or `peer-checked:` pairs only with what it replaces). A gradient is
// a decoration, not a background under text, and a colour-mix is not the main colour: both are
// left out. The page's own background counts when the main colour is used as a text anywhere,
// and so do the look's backgrounds that are nearly as light or as dark as the page (a tinted
// section, a card). Where the main colour is the page's background, every text that has no
// background of its own counts.
//
// What it cannot see:
//   - text inside an element whose background is set on an ancestor (a section with `bg-brand`
//     and a heading in it with `text-paper`, or one CSS rule for a card and another for its heading);
//   - colours set through `:style` bindings, or worked out in script and applied elsewhere;
//   - colours written as rgb() or hsl(), and any text that inherits its colour from an ancestor.
//
// Plain TypeScript that Node runs as it is (type stripping): no enums, no namespaces.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { hexToOklch, mainVariable, plainHex, type Vars } from './palette.ts'

/** The parts of a look this file reads: the same shape as an entry of `looks.all`. */
export interface LookInput {
  id: string
  presets: readonly { vars: Record<string, string> }[]
  own?: {
    main?: string
    calm?: boolean
    follows?: readonly string[]
    against?: readonly string[]
    fixed?: readonly string[]
  }
}

export interface LookPairs {
  main: `--${string}`
  /** Preset variables (not the main one) put together with the main colour. */
  against: `--${string}`[]
  /** Colours of the look's stylesheet that are in no preset, as `#rrggbb`. */
  fixed: string[]
  /** Variables found as a pair whose value is worked out (color-mix, var(), …) and in no preset: not checked. */
  derived: string[]
  /** The page's background: a variable name or `#rrggbb`. */
  page: string | null
  /** The main colour is used as a text somewhere. */
  mainAsText: boolean
  /** For each name or colour in `against`, `fixed` and `derived`: where it was found. */
  sources: Record<string, string[]>
}

// ── colours in CSS values and Tailwind classes ────────────────────────────────────────────────

type Kind = 'bg' | 'text'
/** One colour a place uses: as a background or a text, under a variant (`hover`, `peer-checked`, or none). */
interface Item { kind: Kind; variant: string; ref: string }
/** The colours one CSS block or one element can show together. */
interface Group { where: string; items: Item[] }

// How near in lightness (OKLCH, 0 to 1) a background is to the page's to count as one of its surfaces.
const SURFACE_LIKE_PAGE = 0.12
const TEXT_PROPS = new Set(['color', 'fill', 'stroke', '-webkit-text-fill-color'])
const BG_PROPS = new Set(['background', 'background-color'])

// Whole calls that hold no colour a text sits on: removed, with their parentheses, before reading.
const DROPPED_CALL = /(?<![\w-])(?:color-mix|url|(?:[a-z]+-)*gradient)\(/gi

function removeCalls(value: string): string {
  let out = ''
  let from = 0
  DROPPED_CALL.lastIndex = 0
  for (let m = DROPPED_CALL.exec(value); m; m = DROPPED_CALL.exec(value)) {
    let depth = 1
    let quote = ''
    let i = m.index + m[0].length
    for (; i < value.length && depth > 0; i++) {
      const c = value[i]
      if (quote) { if (c === quote) quote = '' }
      else if (c === '"' || c === "'") quote = c
      else if (c === '(') depth++
      else if (c === ')') depth--
    }
    out += value.slice(from, m.index) + ' '
    from = i
    DROPPED_CALL.lastIndex = i
  }
  return out + value.slice(from)
}

/** The colours a CSS value names, in order: `var(--x)` as `--x`, plain hex, white and black as hex. */
function colourRefs(value: string): string[] {
  const text = removeCalls(value.replace(/!important/gi, ' '))
  const refs: string[] = []
  for (const m of text.matchAll(/var\(\s*(--[\w-]+)|(#[0-9a-f]+)(?!\w)|(?<![\w#-])(white|black)(?![\w-])/gi)) {
    if (m[1]) refs.push(m[1])
    else if (m[2]) { const hex = plainHex(m[2]); if (hex) refs.push(hex) }
    else refs.push(m[3]!.toLowerCase() === 'white' ? '#ffffff' : '#000000')
  }
  return refs
}

/** The text and background colours of declarations, as items of the base variant. */
function declItems(decls: { prop: string; value: string }[]): Item[] {
  const items: Item[] = []
  for (const { prop, value } of decls) {
    const kind: Kind | null = TEXT_PROPS.has(prop) ? 'text' : BG_PROPS.has(prop) ? 'bg' : null
    if (kind) for (const ref of colourRefs(value)) items.push({ kind, variant: '', ref })
  }
  return items
}

// ── CSS ───────────────────────────────────────────────────────────────────────────────────────

interface CssBlock {
  /** The selector (or at-rule), trimmed, white space collapsed. */
  prelude: string
  /** The line of its opening brace, from 1. */
  line: number
  /** The declarations written directly in the block: nested blocks have their own. */
  decls: { prop: string; value: string }[]
}

/** Comments removed; their line breaks stay, so line numbers still match. Quoted text is left alone. */
function stripComments(text: string): string {
  let out = ''
  let quote = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      out += c
      if (c === '\\') out += text[++i] ?? ''
      else if (c === quote) quote = ''
    } else if (c === '"' || c === "'") {
      quote = c
      out += c
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end < 0 ? text.length : end + 2
      out += text.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop - 1
    } else out += c
  }
  return out
}

/**
 * Every block of a stylesheet, in the order they open, with its own declarations; and the first
 * declaration of every custom property. A `;` or `{` inside quotes or parentheses is no structure.
 */
function parseCss(raw: string): { blocks: CssBlock[]; declared: Map<string, string> } {
  const text = stripComments(raw)
  const blocks: CssBlock[] = []
  const declared = new Map<string, string>()
  const stack: CssBlock[] = []
  let buf = ''
  let quote = ''
  let depth = 0
  let line = 1
  const declaration = () => {
    const top = stack[stack.length - 1]
    const t = buf.trim()
    buf = ''
    const colon = t.indexOf(':')
    if (!top || !t || colon < 1) return
    const name = t.slice(0, colon).trim()
    const prop = name.startsWith('--') ? name : name.toLowerCase()
    const value = t.slice(colon + 1).trim()
    top.decls.push({ prop, value })
    if (prop.startsWith('--') && !declared.has(prop)) declared.set(prop, value)
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '\n') line++
    if (quote) {
      buf += c
      if (c === '\\') buf += text[++i] ?? ''
      else if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')') depth = Math.max(0, depth - 1)
    else if (depth === 0 && c === '{') {
      const block: CssBlock = { prelude: buf.trim().replace(/\s+/g, ' '), line, decls: [] }
      blocks.push(block)
      stack.push(block)
      buf = ''
      continue
    } else if (depth === 0 && c === ';') { declaration(); continue }
    else if (depth === 0 && c === '}') { declaration(); stack.pop(); continue }
    buf += c
  }
  return { blocks, declared }
}

/** A selector list split at its top-level commas. */
function selectorItems(prelude: string): string[] {
  const items: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) { items.push(prelude.slice(from, i).trim()); from = i + 1 }
  }
  items.push(prelude.slice(from).trim())
  return items
}

// `body`, `& body`, `html[data-look="x"] body`, `body.dark`; not `.body` or `tbody`.
const ENDS_IN_BODY = /(?:^|[\s>+~&])body(?![\w-])(?:[:.#[][^\s>+~]*)?$/

// ── Tailwind classes ──────────────────────────────────────────────────────────────────────────

/** The last `ch` that is outside `[…]` and `(…)`; -1 if there is none. */
function lastOutside(text: string, ch: string): number {
  let depth = 0
  let found = -1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth = Math.max(0, depth - 1)
    else if (c === ch && depth === 0) found = i
  }
  return found
}

/** The `--color-*` names of a template's `@theme` blocks, with the colours they stand for. */
function loadTheme(templateDir: string): Map<string, string[]> {
  const theme = new Map<string, string[]>()
  const file = join(templateDir, 'app/assets/css/main.css')
  if (!existsSync(file)) return theme
  for (const block of parseCss(readFileSync(file, 'utf8')).blocks) {
    if (!block.prelude.startsWith('@theme')) continue
    for (const { prop, value } of block.decls) {
      if (prop.startsWith('--color-')) theme.set(prop.slice('--color-'.length), colourRefs(value))
    }
  }
  return theme
}

/** What one class says about colour: its variant, whether it is a background or a text, and which colours. */
function classItems(token: string, theme: Map<string, string[]>): Item[] {
  let cls = token.replace(/^!|!$/g, '')
  const colon = lastOutside(cls, ':')
  const variant = colon < 0 ? '' : cls.slice(0, colon)
  cls = cls.slice(colon + 1)
  const slash = lastOutside(cls, '/')
  if (slash > 0) cls = cls.slice(0, slash)
  const m = /^(bg|text|fill|stroke)-(.+)$/.exec(cls)
  if (!m) return []
  const kind: Kind = m[1] === 'bg' ? 'bg' : 'text'
  const x = m[2]!
  const arbitrary = /^\[(?:color:)?var\(\s*(--[\w-]+)/.exec(x) ?? /^\((?:color:)?(--[\w-]+)\)$/.exec(x)
  let refs: string[]
  if (arbitrary) refs = [arbitrary[1]!]
  else if (/^\[(?:color:)?#[0-9a-f]+\]$/i.test(x)) refs = [plainHex(x.replace(/^\[(?:color:)?|\]$/gi, ''))].filter((h): h is string => !!h)
  else if (x === 'white') refs = ['#ffffff']
  else if (x === 'black') refs = ['#000000']
  else refs = theme.get(x) ?? []
  return refs.map((ref) => ({ kind, variant, ref }))
}

const classesOf = (list: string, theme: Map<string, string[]>): Item[] =>
  list.split(/\s+/).filter(Boolean).flatMap((token) => classItems(token, theme))

// ── string literals ───────────────────────────────────────────────────────────────────────────

/**
 * The string literals of some code ('…', "…", `…`), with their offset. In a backtick literal
 * the `${…}` parts are left out (what is inside them is read as code of its own). Comments are skipped.
 */
function literals(code: string, base = 0): { text: string; index: number }[] {
  const found: { text: string; index: number }[] = []
  for (let i = 0; i < code.length; i++) {
    const c = code[i]
    if (c === '/' && code[i + 1] === '/') { const e = code.indexOf('\n', i); if (e < 0) break; i = e; continue }
    if (c === '/' && code[i + 1] === '*') { const e = code.indexOf('*/', i + 2); if (e < 0) break; i = e + 1; continue }
    if (c !== '"' && c !== "'" && c !== '`') continue
    const start = i
    let text = ''
    for (i++; i < code.length && code[i] !== c; i++) {
      if (code[i] === '\\') { i++; text += ' '; continue }
      if (c === '`' && code[i] === '$' && code[i + 1] === '{') {
        let depth = 1
        const inner = i + 2
        for (i = inner; i < code.length && depth > 0; i++) {
          if (code[i] === '{') depth++
          else if (code[i] === '}') depth--
        }
        i--
        found.push(...literals(code.slice(inner, i), base + inner))
        text += ' '
        continue
      }
      text += code[i]
    }
    found.push({ text, index: base + start })
  }
  return found
}

// ── Vue files ─────────────────────────────────────────────────────────────────────────────────

interface Tag { index: number; attrs: { name: string; value: string | null }[] }

/** The start tags of some HTML; a `>` inside a quoted attribute value does not end a tag. */
function scanTags(src: string, from: number, to: number): Tag[] {
  const tags: Tag[] = []
  let i = from
  while (i < to) {
    const lt = src.indexOf('<', i)
    if (lt < 0 || lt >= to) break
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt); i = e < 0 ? to : e + 3; continue }
    const m = /^<[A-Za-z][\w.:-]*/.exec(src.slice(lt, lt + 120))
    if (!m) { i = lt + 1; continue }
    let j = lt + m[0].length
    const attrs: Tag['attrs'] = []
    while (j < to) {
      while (j < to && /\s/.test(src[j]!)) j++
      if (src[j] === '>') { j++; break }
      if (src[j] === '/') { j++; continue }
      let k = j
      while (k < to && !/[\s=>]/.test(src[k]!) && !(src[k] === '/' && src[k + 1] === '>')) k++
      if (k === j) { j++; continue }
      const name = src.slice(j, k)
      j = k
      while (j < to && /\s/.test(src[j]!)) j++
      let value: string | null = null
      if (src[j] === '=') {
        j++
        while (j < to && /\s/.test(src[j]!)) j++
        const q = src[j]
        if (q === '"' || q === "'") {
          const e = src.indexOf(q, j + 1)
          value = src.slice(j + 1, e < 0 ? to : e)
          j = (e < 0 ? to : e) + 1
        } else {
          k = j
          while (k < to && !/[\s>]/.test(src[k]!)) k++
          value = src.slice(j, k)
          j = k
        }
      }
      attrs.push({ name, value })
    }
    tags.push({ index: lt, attrs })
    i = j
  }
  return tags
}

/** The groups of one .vue file: elements' classes, script literals and `<style>` blocks. */
function vueGroups(file: string, name: string, theme: Map<string, string[]>): Group[] {
  const src = readFileSync(file, 'utf8')
  const lineAt = (index: number) => src.slice(0, index).split('\n').length
  const groups: Group[] = []

  const parts: { tag: 'script' | 'style'; from: number; to: number }[] = []
  for (const m of src.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const from = m.index + m[0].indexOf('>') + 1
    parts.push({ tag: m[1] as 'script' | 'style', from, to: from + m[2]!.length })
  }

  const open = /^<template\b[^>]*>/m.exec(src)
  const close = src.lastIndexOf('\n</template>')
  if (open && close > open.index) {
    for (const tag of scanTags(src, open.index + open[0].length, close)) {
      const where = `${name}:${lineAt(tag.index)}`
      const staticItems: Item[] = []
      const bound: { name: string; value: string }[] = []
      for (const { name: attr, value } of tag.attrs) {
        if (value === null) continue
        if (attr === 'class') staticItems.push(...classesOf(value, theme))
        else if (attr === 'style') staticItems.push(...declItems(parseCss(`x{${value}}`).blocks[0]?.decls ?? []))
        else if (attr.startsWith(':') || attr.startsWith('v-bind:')) bound.push({ name: attr.replace(/^(?:v-bind)?:/, ''), value })
      }
      groups.push({ where, items: staticItems })
      for (const { name: attr, value } of bound) {
        if (attr === 'style') continue
        // A bound class adds to the static one; any other bound attribute stands alone.
        const base = attr === 'class' ? staticItems : []
        for (const lit of literals(value)) groups.push({ where, items: [...base, ...classesOf(lit.text, theme)] })
      }
    }
  }

  for (const part of parts) {
    const code = src.slice(part.from, part.to)
    if (part.tag === 'script') {
      for (const lit of literals(code, part.from)) groups.push({ where: `${name}:${lineAt(lit.index)}`, items: classesOf(lit.text, theme) })
    } else {
      const firstLine = lineAt(part.from)
      for (const block of parseCss(code).blocks) {
        groups.push({ where: `${name}:${firstLine + block.line - 1} ${block.prelude}`, items: declItems(block.decls) })
      }
    }
  }
  return groups
}

function vueFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    return e.isDirectory() ? vueFilesIn(path) : e.name.endsWith('.vue') ? [path] : []
  })
}

// ── the scan ──────────────────────────────────────────────────────────────────────────────────

/** The template ids that have a looks.ts, `kit` and `app` left out. */
export function lookTemplates(templatesDir: string): string[] {
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'kit' && e.name !== 'app' && existsSync(join(templatesDir, e.name, 'looks.ts')))
    .map((e) => e.name)
    .sort()
}

/** The pairs of backgrounds and texts a group shows, one per variant. */
function pairsOf(items: Item[]): { bgs: string[]; texts: string[] }[] {
  const variants = new Set(['', ...items.map((x) => x.variant)])
  const pick = (kind: Kind, variant: string) => {
    const own = items.filter((x) => x.kind === kind && x.variant === variant)
    return (own.length ? own : items.filter((x) => x.kind === kind && x.variant === '')).map((x) => x.ref)
  }
  return [...variants].map((v) => ({ bgs: pick('bg', v), texts: pick('text', v) })).filter((p) => p.bgs.length || p.texts.length)
}

const sorted = <T extends string>(values: Iterable<T>): T[] => [...new Set(values)].sort()

export function scanLook(templatesDir: string, templateId: string, look: LookInput): LookPairs {
  const vars = look.presets[0]!.vars
  const main = (look.own?.main ?? mainVariable(vars as Vars)) as `--${string}` | null
  if (!main) throw new Error(`[look-pairs] ${templateId}/${look.id}: no main colour (no --brand or --accent, and no own.main)`)
  const templateDir = join(templatesDir, templateId)
  const cssName = `${look.id}.css`
  const cssFile = join(templateDir, 'app/assets/css', cssName)
  if (!existsSync(cssFile)) throw new Error(`[look-pairs] ${templateId}/${look.id}: ${cssFile} is missing`)
  const theme = loadTheme(templateDir)
  const { blocks, declared } = parseCss(readFileSync(cssFile, 'utf8'))

  const groups: Group[] = blocks.map((b) => ({ where: `${cssName} ${b.prelude}`, items: declItems(b.decls) }))
  const components = join(templateDir, 'app/components')
  const files = sorted([
    ...vueFilesIn(join(components, look.id)),
    ...vueFilesIn(join(components, 'global')),
    ...(existsSync(components) ? readdirSync(components, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.vue')).map((e) => join(components, e.name)) : []),
  ])
  for (const file of files) groups.push(...vueGroups(file, relative(components, file).split(sep).join('/'), theme))

  const against = new Set<`--${string}`>()
  const fixed = new Set<string>()
  const derived = new Set<string>()
  const sources = new Map<string, Set<string>>()
  const candidate = (ref: string, why: string) => {
    let key: string
    if (ref.startsWith('#')) { fixed.add(ref); key = ref }
    else if (ref === main) return
    else if (ref in vars) { against.add(ref as `--${string}`); key = ref }
    else if (declared.has(ref)) {
      const hex = plainHex(declared.get(ref))
      if (hex) { fixed.add(hex); key = hex } else { derived.add(ref); key = ref }
    } else return
    if (!sources.has(key)) sources.set(key, new Set())
    sources.get(key)?.add(why)
  }

  let mainAsText = groups.some((g) => g.items.some((x) => x.kind === 'text' && x.ref === main))
  for (const group of groups) {
    for (const { bgs, texts } of pairsOf(group.items)) {
      if (bgs.includes(main)) for (const ref of texts) candidate(ref, `${group.where}: text on ${main}`)
      if (texts.includes(main)) {
        mainAsText = true
        for (const ref of bgs) candidate(ref, `${group.where}: background under text in ${main}`)
      }
    }
  }

  // The page's background: the first `body` block's last background that names a colour.
  const body = blocks.find((b) => selectorItems(b.prelude).some((s) => ENDS_IN_BODY.test(s)))
  let page: string | null = null
  if (body) {
    const refs = body.decls.filter((d) => BG_PROPS.has(d.prop)).map((d) => colourRefs(d.value)).filter((r) => r.length).pop()
    page = refs?.[0] ?? null
  }
  if (mainAsText && page) candidate(page, `${cssName} ${body?.prelude}: page under text in ${main}`)
  // The page's other surfaces: a background nearly as light (or as dark) as the page, such as a
  // tinted section or a card. A text in the main colour stands on those too, often set on an
  // element around it, which no single rule shows. A background far from the page's lightness
  // (a dark footer on a light page) is another place with its own texts, and is left out.
  if (mainAsText && page && page !== main) {
    const lightness = (ref: string, preset: Record<string, string>): number | null => {
      const hex = plainHex(ref.startsWith('#') ? ref : ref in preset ? preset[ref] : declared.get(ref))
      return hex ? hexToOklch(hex)[0] : null
    }
    const likePage = (ref: string) => look.presets.every((preset) => {
      const a = lightness(ref, preset.vars)
      const b = lightness(page!, preset.vars)
      return a !== null && b !== null && Math.abs(a - b) <= SURFACE_LIKE_PAGE
    })
    for (const group of groups) {
      for (const item of group.items) {
        if (item.kind === 'bg' && item.ref !== page && likePage(item.ref)) candidate(item.ref, `${group.where}: a surface like the page, under text in ${main}`)
      }
    }
  }
  // The other way round: where the main colour is the page itself (Modrotisk, Výloha, Portál),
  // every text with no background of its own in the same place stands on it.
  if (page === main) {
    for (const group of groups) {
      for (const { bgs, texts } of pairsOf(group.items)) {
        if (!bgs.length) for (const ref of texts) candidate(ref, `${group.where}: text on the page in ${main}`)
      }
    }
  }

  return {
    main,
    against: sorted(against),
    fixed: sorted(fixed),
    derived: sorted(derived),
    page,
    mainAsText,
    sources: Object.fromEntries([...sources].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, why]) => [key, sorted(why)])),
  }
}

// ── looks.ts ──────────────────────────────────────────────────────────────────────────────────

const list = (values: readonly string[]) => `[${values.map((v) => `'${v}'`).join(', ')}]`

/** The `own:` line of a look, as looks.ts writes it. */
export function ownLine(own: { main?: string; calm?: boolean; follows?: readonly string[]; against: readonly string[]; fixed?: readonly string[] }): string {
  const keys: string[] = []
  if (own.main) keys.push(`main: '${own.main}'`)
  if (own.calm) keys.push('calm: true')
  if (own.follows) keys.push(`follows: ${list(own.follows)}`)
  keys.push(`against: ${list(own.against)}`)
  if (own.fixed?.length) keys.push(`fixed: ${list(own.fixed)}`)
  return `own: { ${keys.join(', ')} },`
}

/**
 * The text of a looks.ts with a look's `own:` line in place. Every look is written as a line
 * that is only `id: '<look>',` followed by its `name:` line; the `own:` line comes right after
 * the name, and replaces one that is there. Everything else stays byte for byte.
 */
export function writeOwn(source: string, lookId: string, line: string): string {
  const lines = source.split(/(?<=\n)/)
  const at = lines.findIndex((l) => l.trim() === `id: '${lookId}',`)
  if (at < 0) throw new Error(`[look-pairs] looks.ts has no line "id: '${lookId}',"`)
  const name = lines[at + 1]
  if (name === undefined || !/^\s*name:/.test(name)) throw new Error(`[look-pairs] look "${lookId}": its id line is not followed by a name: line`)
  const indent = /^\s*/.exec(name)?.[0] ?? ''
  const eol = /\r?\n$/.exec(name)?.[0] ?? '\n'
  const next = lines[at + 2]
  if (next !== undefined && /^\s*own:/.test(next)) {
    const text = next.trim()
    const opens = (text.match(/\{/g) ?? []).length
    const closes = (text.match(/\}/g) ?? []).length
    if (opens !== closes || !/\},?$/.test(text)) throw new Error(`[look-pairs] look "${lookId}": its own: spans several lines; write it as one line`)
    lines[at + 2] = `${indent}${line}${/\r?\n$/.exec(next)?.[0] ?? ''}`
  } else {
    lines.splice(at + 2, 0, `${indent}${line}${eol}`)
  }
  return lines.join('')
}
