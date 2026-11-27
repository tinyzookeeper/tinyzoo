// What the admin designs for a card bound to a content type (docs/builder-plan.md part 3c): the
// starter card made from the type's fields, the block a field brings when a person picks it, the
// remap of the card's references when the type changes, what one block of the card shows, and the
// counts (which fields are used, which blocks are drawn nowhere). Pure functions of the admin graph's
// description of the card's block types and of the type's fields; nothing here is reactive, and every
// change returns a new value. Rubbish in (a missing list, a block with no definition) gives an empty
// or neutral answer, never a throw.
import type { CustomFieldKind } from '../src/custom-kinds'
import type { CmsBuilderCard, CmsBuilderCardBlock } from './builder'
import { blankBlock, blockListField, type Block, type BlockDefs, type BlockFieldDef, type BlockKindDef } from './block-tree'

/** One field of the type a card shows, as the admin reads it (the type's order; the entry's page is kind 'page', key 'slug'). */
export interface CardTypeField { key: string; kind: CustomFieldKind; label: string; choices?: Record<string, string> }
/** The type a card shows. */
export interface CardType { name: string; titleField: string; fields: CardTypeField[] }
export type CardValue = string | number | boolean | null | Record<string, string>
export interface CardStep { block: string; from: 'title' | CustomFieldKind[]; set?: Record<string, CardValue> }
export interface CardGroupDef { block: string; label: unknown; icon?: string; set?: Record<string, CardValue>; next?: Record<string, CardValue> }
export interface CardOptions { starter: CardStep[]; groups: CardGroupDef[]; heading?: string }
export interface CardRef { key: string; takes: CustomFieldKind[]; own: string | null; only: Partial<Record<CustomFieldKind, string[]>> }
export type CardBlockState =
  | { state: 'field'; key: string; kind: CustomFieldKind; label: string }
  | { state: 'page'; key: string; label: string }
  | { state: 'own'; text: string }
  | { state: 'unbound' }
  | { state: 'missing'; key: string }
  | { state: 'unfit'; key: string; kind: CustomFieldKind; label: string }
  | { state: 'group' }
  | { state: 'other' }

type Plain = string | number | boolean | null

const isRec = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const listOf = (v: unknown): any[] => (Array.isArray(v) ? v : [])
const defsOf = (v: unknown): BlockDefs => (isRec(v) ? (v as BlockDefs) : {})
const defOf = (defs: BlockDefs, type: unknown): BlockKindDef | undefined => (typeof type === 'string' && Object.hasOwn(defs, type) ? defs[type] : undefined)
const cardKey = (b: unknown, ref: CardRef): string => (isRec(b) && filled(b[ref.key]) ? b[ref.key].trim() : '')

// ── reading the design ──

/** The field of a block type that binds the card to a type (`meta.binding === 'card'`). */
export function cardBindingFieldOf(def: BlockKindDef | undefined | null): BlockFieldDef | null {
  const fields = isRec(def) ? def.fields : null
  return (Array.isArray(fields) ? fields : []).find((f) => isRec(f) && f.type === 'binding' && f.meta?.binding === 'card') ?? null
}

function values(v: unknown): Record<string, CardValue> | undefined {
  if (!isRec(v)) return undefined
  const out: Record<string, CardValue> = {}
  for (const [k, x] of Object.entries(v)) {
    if (x === null || ['string', 'number', 'boolean'].includes(typeof x) || (isRec(x) && Object.values(x).every((y) => typeof y === 'string'))) out[k] = x as CardValue
  }
  return out
}

/** What the design says about the card (`customTypeCard({ starter, groups })`), malformed entries dropped. */
export function cardOptionsOf(def: BlockKindDef | undefined | null): CardOptions {
  const card = cardBindingFieldOf(def)?.meta?.card
  const out: CardOptions = { starter: [], groups: [] }
  if (!isRec(card)) return out
  for (const s of listOf(card.starter)) {
    if (!isRec(s) || !filled(s.block)) continue
    const from = s.from === 'title' ? 'title' : strings(s.from)
    if (from !== 'title' && !from.length) continue
    const set = values(s.set)
    out.starter.push({ block: s.block, from: from as CardStep['from'], ...(set ? { set } : {}) })
  }
  for (const g of listOf(card.groups)) {
    if (!isRec(g) || !filled(g.block)) continue
    const set = values(g.set)
    const next = values(g.next)
    out.groups.push({ block: g.block, label: g.label, ...(typeof g.icon === 'string' ? { icon: g.icon } : {}), ...(set ? { set } : {}), ...(next ? { next } : {}) })
  }
  if (filled(card.heading)) out.heading = card.heading
  return out
}

/** The reference of a small block type: its first field that names a field of the bound type. */
export function cardRefOf(def: BlockKindDef | undefined | null): CardRef | null {
  const fields = (isRec(def) && Array.isArray(def.fields) ? def.fields : []).filter(isRec) as BlockFieldDef[]
  const field = fields.find((f) => f.type === 'text' && f.meta?.format === 'field' && isRec(f.meta.ref) && Array.isArray(f.meta.ref.takes))
  if (!field) return null
  const ref = field.meta!.ref
  const keys = new Set(fields.map((f) => f.key))
  const takes = strings(ref.takes) as CustomFieldKind[]
  const only: CardRef['only'] = {}
  if (isRec(ref.only)) {
    for (const kind of takes) if (Array.isArray(ref.only[kind])) only[kind] = strings(ref.only[kind]).filter((k) => keys.has(k))
  }
  return { key: field.key, takes, own: filled(ref.own) && keys.has(ref.own) ? ref.own : null, only }
}

/** A value of the design as the admin puts it in: a text by language resolves to the language, else its region-less form, else English, else the first one. */
export function cardValue(v: CardValue, lang: string): Plain {
  if (!isRec(v)) return v as Plain
  const text = (k: string) => (Object.hasOwn(v, k) && typeof v[k] === 'string' ? (v[k] as string) : undefined)
  return text(lang) ?? text(lang.split('-')[0] ?? '') ?? text('en') ?? Object.values(v).find((x) => typeof x === 'string') ?? ''
}

/** `set` of a design, resolved, for the keys that are fields of `def`. */
function applySet(block: Block, def: BlockKindDef | undefined, set: Record<string, CardValue> | undefined, lang: string): Block {
  const keys = new Set((def?.fields ?? []).map((f) => f.key))
  for (const [k, v] of Object.entries(set ?? {})) if (keys.has(k) && k !== 'id' && k !== 'type') block[k] = cardValue(v, lang)
  return block
}

const refs = (listDefs: BlockDefs) => Object.keys(defsOf(listDefs)).flatMap((type) => {
  const ref = cardRefOf(listDefs[type])
  return ref ? [{ type, ref }] : []
})

// ── adding blocks ──

/** The card the admin designs when the type is chosen: each step of the design that finds a field. */
export function cardStarter(listDefs: BlockDefs, options: CardOptions, type: CardType, lang: string): Block[] {
  const defs = defsOf(listDefs)
  const used = new Set<string>()
  const out: Block[] = []
  const fields = listOf(type?.fields) as CardTypeField[]
  for (const step of listOf(options?.starter) as CardStep[]) {
    const ref = cardRefOf(defOf(defs, step?.block))
    if (!ref) continue
    const fits = (f: CardTypeField) => !used.has(f.key) && ref.takes.includes(f.kind)
    const field = step.from === 'title'
      ? fields.find((f) => f.key === type.titleField && fits(f))
      : fields.find((f) => fits(f) && listOf(step.from).includes(f.kind))
    if (!field) continue
    const block = blankBlock(defs, step.block)
    block[ref.key] = field.key
    out.push(applySet(block, defs[step.block], step.set, lang))
    used.add(field.key)
  }
  return out
}

/** The block a field brings when a person picks it, already bound; `null` when the field is unknown or no block takes its kind. */
export function cardBlockForField(listDefs: BlockDefs, options: CardOptions, type: CardType, fieldKey: string, lang: string): Block | null {
  const defs = defsOf(listDefs)
  const field = (listOf(type?.fields) as CardTypeField[]).find((f) => f.key === fieldKey)
  if (!field) return null
  const candidates = refs(defs).filter((c) => c.ref.takes.includes(field.kind))
  if (!candidates.length) return null
  const starter = listOf(options?.starter) as CardStep[]
  let pick = candidates[0]!
  if (field.key === type.titleField) {
    const titleStep = starter.find((s) => s.from === 'title')
    pick = candidates.find((c) => c.type === titleStep?.block) ?? pick
  }
  else {
    for (const c of candidates) if (c.ref.takes.length > pick.ref.takes.length) pick = c
  }
  const block = blankBlock(defs, pick.type)
  block[pick.ref.key] = field.key
  return applySet(block, defs[pick.type], starter.find((s) => s.block === pick.type)?.set, lang)
}

/** A group block of the design (a row, a column), empty. `null` when the card's list has no such block type. */
export function cardGroupBlock(listDefs: BlockDefs, group: CardGroupDef, lang: string): Block | null {
  const defs = defsOf(listDefs)
  if (!defOf(defs, group?.block)) return null
  return applySet(blankBlock(defs, group.block), defs[group.block], group.set, lang)
}

/** The values a block takes when it is added into a group that already holds one (a row: as wide as its content). */
export function cardNextValues(options: CardOptions, group: unknown, lang: string): Record<string, Plain> {
  if (!isRec(group) || !Object.values(group).some((v) => Array.isArray(v) && v.length)) return {}
  const match = (listOf(options?.groups) as CardGroupDef[]).find((g) => g?.block === group.type
    && Object.entries(g.set ?? {}).every(([k, v]) => cardValue(v, lang) === group[k]))
  const out: Record<string, Plain> = {}
  for (const [k, v] of Object.entries(match?.next ?? {})) out[k] = cardValue(v, lang)
  return out
}

// ── what a block shows ──

/** What one block of the card shows now: a field, the entry's page, a text of its own, or nothing the website can draw. */
export function cardBlockState(block: unknown, def: BlockKindDef | undefined | null, type: CardType | null): CardBlockState {
  if (!isRec(def)) return { state: 'other' }
  const ref = cardRefOf(def)
  if (!ref) return blockListField(def) ? { state: 'group' } : { state: 'other' }
  const key = cardKey(block, ref)
  if (!key) {
    const own = ref.own && isRec(block) && filled(block[ref.own]) ? block[ref.own].trim() : ''
    return own ? { state: 'own', text: own } : { state: 'unbound' }
  }
  const field = (type ? listOf(type.fields) as CardTypeField[] : []).find((f) => f.key === key)
  if (!field) return { state: 'missing', key }
  if (!ref.takes.includes(field.kind)) return { state: 'unfit', key, kind: field.kind, label: field.label }
  return field.kind === 'page' ? { state: 'page', key, label: field.label } : { state: 'field', key, kind: field.kind, label: field.label }
}

/** The keys of the block's fields the panel does not show now: its own text while it names a field, a kind's fields unless that kind is named. */
export function cardHiddenFields(def: BlockKindDef | undefined | null, block: unknown, type: CardType | null): Set<string> {
  const ref = cardRefOf(def)
  const out = new Set<string>()
  if (!ref) return out
  const s = cardBlockState(block, def, type)
  if (ref.own && ['field', 'page', 'missing', 'unfit'].includes(s.state)) out.add(ref.own)
  const shown = new Set<string>()
  for (const [kind, keys] of Object.entries(ref.only)) {
    if (s.state === 'field' && s.kind === kind) keys.forEach((k) => shown.add(k))
  }
  for (const keys of Object.values(ref.only)) for (const k of keys) if (!shown.has(k)) out.add(k)
  return out
}

// ── the card's blocks ──

/** A card's list rewritten: `change` returns a block's replacement, or `null` to leave it out; groups are walked, only two levels. Untouched lists keep their identity. */
function rewrite(items: unknown, listDefs: BlockDefs, change: (block: Block, def: BlockKindDef, ref: CardRef) => Block | null, level = 0): any[] {
  const defs = defsOf(listDefs)
  const list = listOf(items)
  let changed = false
  const out: any[] = []
  for (const b of list) {
    const def = isRec(b) ? defOf(defs, b.type) : undefined
    const ref = cardRefOf(def)
    let next: any = b
    if (def && ref) next = change(b as Block, def, ref)
    else if (def && level === 0) {
      const inner = blockListField(def)
      if (inner && Array.isArray(b[inner.key])) {
        const rewritten = rewrite(b[inner.key], defsOf(inner.meta?.blocks), change, 1)
        if (rewritten !== b[inner.key]) next = { ...b, [inner.key]: rewritten }
      }
    }
    if (next !== b) changed = true
    if (next !== null) out.push(next)
  }
  return changed ? out : list
}

/** The card's blocks that show a field or a text, at both levels in document order (groups themselves left out). */
export function cardLeaves(items: unknown, listDefs: BlockDefs): { block: Block; def: BlockKindDef; parent: Block | null }[] {
  const out: { block: Block; def: BlockKindDef; parent: Block | null }[] = []
  const defs = defsOf(listDefs)
  const walk = (list: unknown, ds: BlockDefs, parent: Block | null) => {
    for (const b of listOf(list)) {
      const def = isRec(b) ? defOf(ds, b.type) : undefined
      if (!isRec(b) || !def) continue
      const inner = parent || cardRefOf(def) ? null : blockListField(def)
      if (inner) walk(b[inner.key], defsOf(inner.meta?.blocks), b as Block)
      else out.push({ block: b as Block, def, parent })
    }
  }
  walk(items, defs, null)
  return out
}

const NOT_DRAWN = new Set(['unbound', 'missing', 'unfit'])

/** The ids of the blocks the website draws nothing for: no field, a field the type does not have, a field of a kind the block cannot show. */
export function cardUnbound(items: unknown, listDefs: BlockDefs, type: CardType | null): string[] {
  return cardLeaves(items, listDefs)
    .filter((l) => NOT_DRAWN.has(cardBlockState(l.block, l.def, type).state) && typeof l.block.id === 'string')
    .map((l) => l.block.id)
}

/** The card without those blocks (groups stay). */
export function cardDropUnbound(items: unknown, listDefs: BlockDefs, type: CardType | null): any[] {
  const ids = new Set(cardUnbound(items, listDefs, type))
  return rewrite(items, listDefs, (b) => (ids.has(b.id) ? null : b))
}

/** How many blocks of the card name each field. */
export function cardUsedFields(items: unknown, listDefs: BlockDefs): Map<string, number> {
  const out = new Map<string, number>()
  for (const l of cardLeaves(items, listDefs)) {
    const ref = cardRefOf(l.def)
    const key = ref ? cardKey(l.block, ref) : ''
    if (key) out.set(key, (out.get(key) ?? 0) + 1)
  }
  return out
}

/**
 * The card moves to another type. A block keeps its field when the new type has one of that key that
 * fits it; else it takes the field of the same name (when the old type is known); the rest take the
 * first free field that fits, or are left with none. A field goes to one block only. Blocks with no
 * field are left as they are; `unbound` counts the blocks the website would draw nothing for.
 */
export function cardRemap(items: unknown, listDefs: BlockDefs, from: CardType | null, to: CardType, lang: string): { items: any[]; unbound: number } {
  void lang
  const toFields = listOf(to?.fields) as CardTypeField[]
  const fromFields = listOf(from?.fields) as CardTypeField[]
  const leaves = cardLeaves(items, listDefs).flatMap((l) => {
    const ref = cardRefOf(l.def)
    const key = ref ? cardKey(l.block, ref) : ''
    return ref && key ? [{ block: l.block, ref, key }] : []
  })
  const taken = new Set<string>()
  const chosen = new Map<Block, string>()
  const pending: typeof leaves = []
  const fit = (ref: CardRef) => (f: CardTypeField) => !taken.has(f.key) && ref.takes.includes(f.kind)
  const norm = (s: string) => s.trim().toLowerCase()
  for (const l of leaves) {
    const same = toFields.find((f) => f.key === l.key && fit(l.ref)(f))
    const oldLabel = fromFields.find((f) => f.key === l.key)?.label
    const named = same ?? (oldLabel === undefined ? undefined : toFields.find((f) => norm(f.label) === norm(oldLabel) && fit(l.ref)(f)))
    if (named) {
      taken.add(named.key)
      chosen.set(l.block, named.key)
    }
    else pending.push(l)
  }
  for (const l of pending) {
    const free = toFields.find(fit(l.ref))
    if (free) taken.add(free.key)
    chosen.set(l.block, free?.key ?? '')
  }
  const next = rewrite(items, listDefs, (b, _def, ref) => (chosen.has(b) && chosen.get(b) !== b[ref.key] ? { ...b, [ref.key]: chosen.get(b)! } : b))
  return { items: next, unbound: cardUnbound(next, listDefs, to).length }
}

// ── examples ──

const cut = (s: string) => (s.length > 60 ? `${s.slice(0, 59)}…` : s)
const spaces = (s: string) => s.replace(/\s/g, ' ')

function plainText(node: unknown): string {
  if (!isRec(node)) return ''
  if (typeof node.text === 'string') return node.text
  const kids = listOf(node.content)
  const parts = kids.map(plainText)
  return kids.some((k) => isRec(k) && Array.isArray(k.content)) ? parts.filter((p) => p.trim()).join(' ') : parts.join('')
}

/** A short example of the field's value in an entry row of the admin's list API; empty when there is none. */
export function cardExample(field: CardTypeField, row: Record<string, any> | null | undefined, lang: string, pagePrefix?: string | null): string {
  if (!isRec(row) || !isRec(field)) return ''
  const v = row[field.key]
  const prim = () => (['string', 'number', 'boolean'].includes(typeof v) ? String(v) : '')
  try {
    switch (field.kind) {
      case 'text': case 'longText':
        return typeof v === 'string' ? cut(v.split('\n').map((l) => l.trim()).find(Boolean) ?? '') : ''
      case 'richText': {
        let doc = v
        if (typeof doc === 'string') { try { doc = JSON.parse(doc) } catch { return '' } }
        return cut(plainText(doc).replace(/\s+/g, ' ').trim())
      }
      case 'number': {
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
        return Number.isFinite(n) ? spaces(new Intl.NumberFormat(lang).format(n)) : ''
      }
      case 'date': {
        const date = v instanceof Date ? v : typeof v === 'string' && v ? new Date(v) : null
        if (!date || Number.isNaN(date.getTime())) return ''
        // A date with no time is a day, not a moment: the same day everywhere.
        const utc = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? { timeZone: 'UTC' } : {}
        return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', ...utc }).format(date)
      }
      case 'choice':
        return v === null || v === undefined || v === '' ? '' : (field.choices?.[String(v)] ?? String(v))
      case 'picture': case 'file': {
        const media = row[`${field.key}__media`]
        if (!isRec(media)) return ''
        return [media.alt, media.title, media.filename, media.originalName].find(filled) ?? ''
      }
      case 'link': case 'email':
        return typeof v === 'string' ? v : ''
      case 'page': {
        if (!filled(row.slug)) return ''
        return `${pagePrefix ? `/${pagePrefix.replace(/^\/|\/$/g, '')}` : ''}/${row.slug}`
      }
      default:
        return prim()
    }
  }
  catch {
    return ''
  }
}

// ── what the panel of a card's block says (part 3c, the panel) ──

/** The list of a section's card: its blocks and their definitions, from the section (top-level block) and its definition. */
export function cardItemsOf(block: unknown, def: BlockKindDef | undefined | null): { items: unknown; defs: BlockDefs } | null {
  const field = blockListField(def ?? undefined)
  if (!field || !isRec(block)) return null
  return { items: block[field.key], defs: defsOf(field.meta?.blocks) }
}

/**
 * How many OTHER blocks of the card show each field: the whole card's counts, less the block being
 * edited (it names `own`, the key its reference holds now, or none).
 */
export function cardUsedElsewhere(block: unknown, def: BlockKindDef | undefined | null, own: string | null | undefined): Set<string> {
  const card = cardItemsOf(block, def)
  const out = new Set<string>()
  if (!card) return out
  for (const [key, n] of cardUsedFields(card.items, card.defs)) if (n - (key === own ? 1 : 0) > 0) out.add(key)
  return out
}

/** The entries a card's panel takes its examples from: what the page's overlay says was clicked, else what the section shows first, else the first entry. */
export interface CardExamplePick {
  /** The entity of the card's type. */
  entity: string
  /** The section (the first id of the selected block's path); null when nothing is selected. */
  section: string | null
  /** The card the person clicked in the page (the overlay's, set with the section it is in). */
  cardEntry?: { section: string; entity: string; id: string } | null
  /** What the page said the section shows (`sources`), as `CmsBuilderSource`. */
  sources?: readonly { entity: string; entries: readonly { id: string }[] }[] | null
  /** The type's field keys: with no card clicked, the entry that fills most of them is the example. */
  fields?: readonly string[] | null
}

const hasValue = (v: unknown) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)

/**
 * The row an example is read from: the card the person clicked; else, of the entries the section shows (in its
 * order; else all rows), the first that fills the most of the type's fields among the first twelve, so the
 * examples say something (a first entry with a title only would show empty examples). Null when there are no rows.
 */
export function cardExampleRow(rows: readonly Record<string, any>[] | null | undefined, pick: CardExamplePick): Record<string, any> | null {
  const list = (Array.isArray(rows) ? rows : []).filter(isRec)
  if (!list.length) return null
  const byId = (id: unknown) => list.find((r) => r.id === id) ?? null
  const clicked = pick.cardEntry
  if (clicked && pick.section && clicked.section === pick.section && clicked.entity === pick.entity) {
    const row = byId(clicked.id)
    if (row) return row
  }
  const shown: Record<string, any>[] = []
  for (const src of Array.isArray(pick.sources) ? pick.sources : []) {
    if (src?.entity !== pick.entity) continue
    for (const e of Array.isArray(src.entries) ? src.entries : []) {
      const row = byId(e?.id)
      if (row && !shown.includes(row)) shown.push(row)
    }
  }
  const candidates = (shown.length ? shown : list).slice(0, 12)
  const keys = Array.isArray(pick.fields) ? pick.fields : []
  if (!keys.length) return candidates[0] ?? null
  const score = (r: Record<string, any>) => keys.filter((k) => hasValue(r[k]) || hasValue(r[`${k}Id`])).length
  return candidates.reduce((best, r) => (score(r) > score(best) ? r : best), candidates[0]!)
}

/** The title of an entry row (the type's title field); empty when it has none. */
export function cardEntryTitle(row: Record<string, any> | null | undefined, titleField: string): string {
  const v = isRec(row) ? row[titleField] : null
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
}

/**
 * The kinds a block takes as one list in the language ("krátké texty, čísla, data a výběry"): each
 * kind by its word, a word twice only once, joined as the language does (`Intl.ListFormat`).
 */
export function cardKindsList(kinds: readonly string[], word: (kind: string) => string, lang: string): string {
  const words = [...new Set(kinds.map(word).filter((w) => w))]
  if (!words.length) return ''
  try {
    return new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(words)
  }
  catch {
    return words.join(', ')
  }
}

/**
 * The fields of a type in the order a block's rows show them: the entry's page first (a button's first
 * choice), then the type's own order. Fields are split into those the block takes and those it does not.
 */
export function cardRowFields(type: CardType | null | undefined, takes: readonly CustomFieldKind[]): { fits: CardTypeField[]; misfits: CardTypeField[] } {
  const all = isRec(type) && Array.isArray(type.fields) ? type.fields : []
  const fits = all.filter((f) => takes.includes(f.kind))
  return { fits: [...fits.filter((f) => f.kind === 'page'), ...fits.filter((f) => f.kind !== 'page')], misfits: all.filter((f) => !takes.includes(f.kind)) }
}

// ── the picker of a card (part 3d) ──

/** The block a section of the card's type is made of when a type is chosen for it: bound to the type, with the starter card in its list. `null` when the def has no card binding or no list for the card. */
export function cardSectionBlock(defs: BlockDefs, defType: string, typeName: string, type: CardType, lang: string, heading?: string): Block | null {
  const def = defOf(defsOf(defs), defType)
  const binding = cardBindingFieldOf(def)
  const list = blockListField(def)
  if (!def || !binding || !list) return null
  const block = blankBlock(defsOf(defs), defType)
  block[binding.key] = { type: typeName }
  const options = cardOptionsOf(def)
  block[list.key] = cardStarter(defsOf(list.meta?.blocks), options, type, lang)
  if (options.heading && filled(heading) && (def.fields ?? []).some((f) => f.key === options.heading)) block[options.heading] = heading
  return block
}

/** The fields a list of blocks can show, for *Add to the card*: each with the block (its type in the list) it would bring; the type's order, the entry's page last. */
export function cardPickerFields(listDefs: BlockDefs, options: CardOptions, type: CardType | null | undefined): { key: string; kind: CustomFieldKind; label: string; block: string }[] {
  const all = (type && Array.isArray(type.fields) ? type.fields : []).filter(isRec) as CardTypeField[]
  const out: { key: string; kind: CustomFieldKind; label: string; block: string }[] = []
  for (const f of [...all.filter((x) => x.kind !== 'page'), ...all.filter((x) => x.kind === 'page')]) {
    const block = cardBlockForField(listDefs, options, type!, f.key, '')
    if (block) out.push({ key: f.key, kind: f.kind, label: f.label, block: block.type })
  }
  return out
}

/**
 * The empty blocks a list offers: its block types that are not groups, and, at the card's top level only,
 * the declared groups whose block is among them (a group type no declared group covers comes as a plain
 * empty block). `group` is the declared group (to build with `cardGroupBlock`), else null.
 */
export function cardEmptyChoices(listDefs: BlockDefs, options: CardOptions, top: boolean): { type: string; group: CardGroupDef | null }[] {
  const defs = defsOf(listDefs)
  const out: { type: string; group: CardGroupDef | null }[] = []
  const declared = (listOf(options?.groups) as CardGroupDef[]).filter((g) => isRec(g) && defOf(defs, g.block))
  for (const type of Object.keys(defs)) {
    if (!blockListField(defs[type])) out.push({ type, group: null })
  }
  if (!top) return out
  for (const g of declared) out.push({ type: g.block, group: g })
  const covered = new Set(declared.map((g) => g.block))
  for (const type of Object.keys(defs)) {
    if (blockListField(defs[type]) && !covered.has(type)) out.push({ type, group: null })
  }
  return out
}

/** `block` with the values it takes when it goes into a group that already holds a block (only keys the block has). `group` null or empty: as it is. */
export function cardApplyNext(block: Block, listDefs: BlockDefs, options: CardOptions, group: unknown, lang: string): Block {
  const keys = new Set((defOf(defsOf(listDefs), block.type)?.fields ?? []).map((f) => f.key))
  const next = cardNextValues(options, group, lang)
  const out = { ...block }
  for (const [k, v] of Object.entries(next)) if (keys.has(k) && k !== 'id' && k !== 'type') out[k] = v
  return out
}

// ── what a row of the card says, the type changing, the repeats (part 3c, the panel) ──

/** What the summary of a block's row is made of: the words come from the admin's catalogue, the texts from here. */
export type CardRowKind = 'field' | 'page' | 'own' | 'unbound' | 'missing' | 'unfit' | 'group' | 'other'
export interface CardRowSummary {
  kind: CardRowKind
  /** The name of the field (`field`, `page`, `unfit`), the stored key (`missing`), the quoted text (`own`); empty otherwise. */
  text: string
  /** The row shows nothing on the website: it is said in the warning colour, with a dot. */
  warn: boolean
}

/** A text in the quotes of a language: „…“ in Czech and German, “…” in English and the rest. */
export function cardQuote(text: string, lang: string): string {
  const l = String(lang ?? '').slice(0, 2).toLowerCase()
  return l === 'cs' || l === 'de' || l === 'sk' ? `„${text}“` : `“${text}”`
}

const cutText = (s: string) => (s.length > 40 ? `${s.slice(0, 39).trimEnd()}…` : s)

/** One row's summary kind and text, from what `cardBlockState` says; `lang` is the admin's (the quotes). */
export function cardRowSummary(state: CardBlockState, lang: string): CardRowSummary {
  switch (state.state) {
    case 'field': return { kind: 'field', text: state.label, warn: false }
    case 'page': return { kind: 'page', text: state.label, warn: false }
    case 'own': return { kind: 'own', text: cardQuote(cutText(state.text.replace(/\s+/g, ' ')), lang), warn: false }
    case 'unbound': return { kind: 'unbound', text: '', warn: true }
    case 'missing': return { kind: 'missing', text: state.key, warn: true }
    case 'unfit': return { kind: 'unfit', text: state.label || state.key, warn: true }
    case 'group': return { kind: 'group', text: '', warn: false }
    default: return { kind: 'other', text: '', warn: false }
  }
}

/** How many blocks a group holds (a group's own list is the one list of blocks of its definition). */
export function cardGroupCount(block: unknown, def: BlockKindDef | undefined | null): number {
  const field = blockListField(def ?? undefined)
  return field && isRec(block) ? listOf(block[field.key]).length : 0
}

/** The default of how many entries a card shows when the binding names no limit (the kit's). */
export const CARD_LIMIT_DEFAULT = 6

/**
 * How many times the card repeats on the page: the entries the page says the section shows when it
 * says (`shown`, null while unknown), else as many as the type has, at most the binding's limit
 * (or the default); null when the number of entries is not known either.
 */
export function cardRepeatCount(shown: number | null | undefined, total: number | null | undefined, limit: number | null | undefined): number | null {
  if (typeof shown === 'number' && shown >= 0) return shown
  if (typeof total !== 'number' || total < 0) return null
  const max = typeof limit === 'number' && limit > 0 ? limit : CARD_LIMIT_DEFAULT
  return Math.min(total, max)
}

/** The card's blocks a section holds, given the section and its definition (empty without a card list). */
export function cardItemsIn(section: unknown, def: BlockKindDef | undefined | null): { items: any[]; listDefs: BlockDefs; key: string } | null {
  const field = blockListField(def ?? undefined)
  if (!field || !isRec(section)) return null
  return { items: listOf(section[field.key]), listDefs: defsOf(field.meta?.blocks), key: field.key }
}

/**
 * The section moves to another type (the binding's new value is `next`): what to write besides it.
 * An empty card is designed anew from the new type (`starter`); a card with blocks is remapped, a block
 * keeping its field when it fits (`remap`, with how many are left with none). `null`: nothing to rewrite
 * (no card list, or the type did not change).
 */
export function cardTypeChange(
  section: unknown, def: BlockKindDef | undefined | null, from: CardType | null, to: CardType, lang: string,
): { mode: 'starter' | 'remap'; key: string; items: any[]; unbound: number } | null {
  const held = cardItemsIn(section, def)
  if (!held) return null
  if (from && from.name === to?.name) return null
  if (!held.items.length) {
    const items = cardStarter(held.listDefs, cardOptionsOf(def), to, lang)
    return { mode: 'starter', key: held.key, items, unbound: 0 }
  }
  const out = cardRemap(held.items, held.listDefs, from, to, lang)
  return { mode: 'remap', key: held.key, items: out.items, unbound: out.unbound }
}

/** The card designed again from the type's fields (one step): the blocks to write. */
export function cardRedesign(section: unknown, def: BlockKindDef | undefined | null, type: CardType, lang: string): { key: string; items: any[] } | null {
  const held = cardItemsIn(section, def)
  return held ? { key: held.key, items: cardStarter(held.listDefs, cardOptionsOf(def), type, lang) } : null
}

/** The ids of the section's blocks that show nothing on the website (the card's own list, at both levels). */
export function cardSectionUnbound(section: unknown, def: BlockKindDef | undefined | null, type: CardType | null): string[] {
  const held = cardItemsIn(section, def)
  return held ? cardUnbound(held.items, held.listDefs, type) : []
}

// ── what the page says about a card's blocks (part 3c, the tools in the page) ──

/** The admin's words for what a block of a card shows (the same as the panel's rows). */
export interface CardWords {
  unbound: string
  noPages: string
  missing: (name: string) => string
  unfit: (name: string) => string
  own: string
  groupBlocks: (count: number) => string
  groupEmpty: string
}

/** What one block shows in words, for the panel's row and the page's chip; `tone` is the row's colour. */
export function cardBlockWords(state: CardBlockState, lang: string, words: CardWords, groupCount = 0): { shows: string; chip: string; warn: boolean; tone: 'field' | 'own' | 'warn' | 'muted' } {
  switch (state.state) {
    case 'field': { const t = `← ${state.label}`; return { shows: t, chip: t, warn: false, tone: 'field' } }
    case 'page': { const t = `→ ${state.label}`; return { shows: t, chip: t, warn: false, tone: 'field' } }
    case 'own': { const t = cardRowSummary(state, lang).text; return { shows: t, chip: words.own, warn: false, tone: 'own' } }
    case 'unbound': return { shows: words.unbound, chip: words.unbound, warn: true, tone: 'warn' }
    case 'missing': { const t = state.key === 'slug' ? words.noPages : words.missing(state.key); return { shows: t, chip: t, warn: true, tone: 'warn' } }
    case 'unfit': { const t = words.unfit(state.label || state.key); return { shows: t, chip: t, warn: true, tone: 'warn' } }
    case 'group': return { shows: groupCount ? words.groupBlocks(groupCount) : words.groupEmpty, chip: '', warn: false, tone: 'muted' }
    default: return { shows: '', chip: '', warn: false, tone: 'muted' }
  }
}

type PageBlock = CmsBuilderCardBlock
type PageCard = CmsBuilderCard

/**
 * The card sections of a page's blocks, as the page needs them (`cms:builder:cards`): per section id the
 * type it shows and, for every block of its card at both levels, what it shows. Sections with no type
 * and blocks that hold no card are left out; rubbish gives less, never a throw.
 */
export function cardPageCards(
  items: unknown,
  defs: BlockDefs,
  o: {
    type: (name: string) => CardType | null
    typeLabel: (name: string) => string
    blockLabel: (def: BlockKindDef, type: string) => string
    words: CardWords
    lang: string
  },
): Record<string, PageCard> {
  const out: Record<string, PageCard> = {}
  try {
    for (const section of listOf(items)) {
      if (!isRec(section) || !filled(section.id)) continue
      const def = defOf(defsOf(defs), section.type)
      const binding = cardBindingFieldOf(def)
      if (!def || !binding) continue
      const bound = section[binding.key]
      const name = isRec(bound) && filled(bound.type) ? bound.type : ''
      if (!name) continue
      const held = cardItemsIn(section, def)
      if (!held) continue
      const type = o.type(name)
      const blocks: Record<string, PageBlock> = {}
      const add = (b: unknown, ds: BlockDefs) => {
        if (!isRec(b) || !filled(b.id)) return null
        const bd = defOf(ds, b.type)
        if (!bd) return null
        const ref = cardRefOf(bd)
        const state = cardBlockState(b, bd, type)
        const group = state.state === 'group'
        const w = cardBlockWords(state, o.lang, o.words, group ? cardGroupCount(b, bd) : 0)
        const entry: PageBlock = { label: o.blockLabel(bd, String(b.type)), shows: w.shows, chip: w.chip }
        if (w.warn) entry.warn = true
        if (state.state === 'field') { entry.field = state.key; entry.kind = state.kind }
        else if (state.state === 'page') { entry.field = 'slug'; entry.kind = 'page' }
        if (ref?.own) entry.own = ref.own
        if (ref) entry.ref = ref.key
        if (group) entry.group = true
        blocks[b.id] = entry
        return bd
      }
      for (const b of held.items) {
        const bd = add(b, held.listDefs)
        const inner = bd && isRec(b) ? blockListField(bd) : null
        if (inner && isRec(b)) for (const c of listOf(b[inner.key])) add(c, defsOf(inner.meta?.blocks))
      }
      out[section.id] = { entity: name, label: o.typeLabel(name) || name, blocks }
    }
  }
  catch { /* rubbish gives less, never a throw */ }
  return out
}
