import { z, type ZodTypeAny } from 'zod'
import type { CmsAdminField } from './admin'
import type { CustomFieldKind } from './custom-kinds'
import type { AnyFieldDescriptor, FieldDescriptor, FieldKind } from './descriptor'
import type { LocalizedText } from './i18n'
import { upgradeRichText } from './richtext'

/**
 * Blocks: an ordered list of typed sections a client arranges into a page (hero,
 * text, gallery, call to action…). The developer defines each block type in code,
 * with its own fields; the editor picks, orders and fills them. Stored as one jsonb
 * array per entry:
 *
 *   [{ id: 'k3j…', type: 'hero', heading: 'Vítejte', image: '<media id>' }, …]
 *
 * Block fields use the regular field catalog, minus relations (v1): text, slug,
 * number, boolean, datetime, select, rich text, media, groups, and lists two levels
 * deep (`f.list()` or `f.blocks()`: FAQ questions, feature cards, price rows inside one
 * block; a layout's small blocks and the groups among them, each group with small
 * blocks of its own). Rich text is sanitised on write like everywhere else; media ids
 * (also inside a block's lists) are resolved by the content API and counted by media
 * cleanup.
 *
 * Stored JSON outlives the code that wrote it, so a block (or `f.list`) can carry a
 * `version`: stored blocks are stamped `v` (left out while it is 1) and anything
 * behind runs through `upgrade` whenever it is read (see upgradeBlocks). A block
 * whose type was removed from the config is kept as it is, not dropped or refused,
 * for as long as it is stored (a new one of an unknown type is refused).
 *
 * A WRITE does not take the client's word for any of this (see `blocksSchema`): a
 * block that says it is behind, or whose `upgrade` throws, or whose type is gone, is
 * only kept when the same block is already stored; a block without `v` is checked
 * against the current definition and, when it does not fit, upgraded from version 1.
 */

/**
 * Field types allowed inside a block, a list item or a group ('blocks' = a list, two
 * levels deep at most, see `MAX_LIST_DEPTH`; 'group' = a named object of fields). A 'binding' is allowed in a block only,
 * as one of its own fields (see `checkContainedFields`).
 *
 * @internal
 */
export const BLOCK_FIELD_TYPES = new Set(['text', 'slug', 'number', 'boolean', 'datetime', 'select', 'richtext', 'media', 'blocks', 'group', 'binding'])

export interface BlockDef<F extends Record<string, AnyFieldDescriptor> = Record<string, AnyFieldDescriptor>> {
  /** Name in the block picker ("Hero", { cs: 'Úvod', en: 'Hero' }). */
  label: LocalizedText
  /** One line in the block picker on what the block is for. */
  description?: LocalizedText
  /** Iconify name, e.g. 'i-lucide-image'. */
  icon?: string
  fields: F
  /**
   * The shape's version, 1 when left out. Raise it whenever a stored block of the old
   * shape needs changing (a renamed or removed field, a new required one) and describe
   * the change in `upgrade`. Needed from 2 on.
   */
  version?: number
  /**
   * Bring a block stored at `fromVersion` to `fromVersion + 1` and return it (it is
   * called once per step: 1 → 2, then 2 → 3). `data` is a copy holding `id`, `type`
   * and the stored fields; `id` and `type` are kept whatever is returned. Must be pure
   * (no database, no clock): it runs on every read of an old block until
   * `tinyzoo content:migrate` rewrites the data.
   */
  upgrade?: (data: Record<string, any>, fromVersion: number) => Record<string, any>
}

/** Keys of a stored block that are not its fields. */
const BLOCK_META_KEYS = new Set(['id', 'type', 'v'])

/**
 * The version a block definition is at.
 *
 * @internal
 */
export const blockVersion = (def: Pick<BlockDef, 'version'>): number => def.version ?? 1

export function defineBlock<F extends Record<string, AnyFieldDescriptor>>(def: BlockDef<F>): BlockDef<F> {
  checkVersioning('Block', def)
  checkContainedFields('Block', def.fields, { reserved: true, binding: true })
  const cards = (Object.entries(def.fields) as [string, FieldDescriptor][]).filter(([, fld]) => isCardBinding(fld)).map(([key]) => key)
  if (cards.length > 1) throw new Error(`Block fields ${cards.map((k) => `"${k}"`).join(' and ')} are both a card's binding (customTypeCard()): a block shows one card, so it holds one.`)
  return def
}

// ── a card's references to the fields of the type it shows ──

type FieldLike = { type?: string; meta?: Record<string, unknown> | null } | null | undefined

/**
 * The text format that marks a reference to a field of the type a card shows. A text with a
 * format is never typed in the page, searched or summed up as words, and a reference is none of
 * those.
 *
 * @internal
 */
export const FIELD_REF_FORMAT = 'field'

/**
 * Whether a field is a reference to a field of the type a card shows (`customTypeFieldRef()`).
 *
 * @internal
 */
export const isFieldRef = (fld: FieldLike): boolean =>
  !!fld && fld.type === 'text' && fld.meta?.format === FIELD_REF_FORMAT && !!fld.meta?.ref && typeof fld.meta.ref === 'object'

/**
 * The kinds a reference takes, or an empty list for a field that is no reference.
 *
 * @internal
 */
export function fieldRefTakes(fld: FieldLike): CustomFieldKind[] {
  if (!isFieldRef(fld)) return []
  const takes = (fld!.meta!.ref as { takes?: unknown }).takes
  return Array.isArray(takes) ? takes.filter((k): k is CustomFieldKind => typeof k === 'string') : []
}

/**
 * Whether a field is a card's binding (`customTypeCard()`).
 *
 * @internal
 */
export const isCardBinding = (fld: FieldLike): boolean => !!fld && fld.type === 'binding' && fld.meta?.binding === 'card'

/**
 * The key of a block's card binding, or null when the block shows no card.
 *
 * @internal
 */
export function cardBindingKey(def: Pick<BlockDef, 'fields'> | undefined | null): string | null {
  for (const [key, fld] of Object.entries(def?.fields ?? {}) as [string, FieldDescriptor][]) if (isCardBinding(fld)) return key
  return null
}

const refRefusal = (trail: string[]) =>
  `${trail.join(' › ')} is a reference to a field of a content type (customTypeFieldRef()). A reference is a field of a block inside a block that shows a card (customTypeCard()): of its blocks, or of the blocks of a list inside one of them. Not of a collection, a global, a group, or a block of the page itself.`

/**
 * Where a reference may stand, checked when the config loads (`defineEntity`): as a field of a
 * block inside a page block that holds a card's binding, at the first or the second level. A
 * block is defined on its own before anything says where it goes, so the place is known only
 * here, from the entity down. `where` is the entity's name; a refusal names the path.
 *
 * @internal
 */
export function checkFieldRefPlaces(where: string, fields: Record<string, AnyFieldDescriptor>): void {
  for (const [key, fld] of Object.entries(fields) as [string, FieldDescriptor][]) {
    const trail = [where, key]
    if (isFieldRef(fld)) throw new Error(refRefusal(trail))
    if (fld.type === 'group') checkFieldRefPlaces(trail.join(' › '), (fld.fields ?? {}) as Record<string, AnyFieldDescriptor>)
    else if (fld.type === 'blocks') {
      for (const [type, def] of Object.entries(fld.blocks ?? {})) checkTopBlockRefs([...trail, type], def)
    }
  }
}

/** A block of an entity's list: no reference of its own; inside, references only when it holds a card. */
function checkTopBlockRefs(trail: string[], def: BlockDef) {
  const bindingKey = cardBindingKey(def)
  const card = bindingKey !== null
  if (bindingKey) checkCardOptions([...trail, bindingKey], def)
  for (const [key, fld] of Object.entries(def.fields) as [string, FieldDescriptor][]) {
    if (isFieldRef(fld)) throw new Error(refRefusal([...trail, key]))
    if (fld.type === 'group') checkNoRefs([...trail, key], fld.fields ?? {})
    else if (fld.type === 'blocks') checkInnerRefs([...trail, key], fld, card)
  }
}

/**
 * A card's starter and groups (`customTypeCard({ starter, groups })`) name blocks of the card's list
 * (the block's first `f.blocks()`) and fields of those blocks.
 */
function checkCardOptions(trail: string[], def: BlockDef) {
  const opts = (def.fields[trail[trail.length - 1]!] as FieldDescriptor | undefined)?.meta?.card as { starter?: any[]; groups?: any[]; heading?: string } | undefined
  if (!opts) return
  const list = (Object.values(def.fields) as FieldDescriptor[]).find((f) => f.type === 'blocks' && !f.meta?.list)
  const where = trail.join(' › ')
  const check = (what: string, block: string, ...values: (Record<string, unknown> | undefined)[]) => {
    const inner = list?.blocks?.[block]
    if (!inner) throw new Error(`${where}: ${what} names the block "${block}", which the card's list does not have${list ? ` (it has ${Object.keys(list.blocks ?? {}).join(', ')})` : ': the block has no list of blocks'}.`)
    for (const v of values) for (const key of Object.keys(v ?? {})) {
      if (!(key in inner.fields)) throw new Error(`${where}: ${what} sets "${key}", which the block "${block}" does not have.`)
    }
  }
  opts.starter?.forEach((step, i) => check(`starter[${i}]`, step.block, step.set))
  opts.groups?.forEach((g, i) => check(`groups[${i}]`, g.block, g.set, g.next))
  if (opts.heading !== undefined) {
    const field = def.fields[opts.heading] as FieldDescriptor | undefined
    if (!field) throw new Error(`${where}: heading names "${opts.heading}", which the block does not have.`)
    if (field.type !== 'text' || field.meta?.format || field.meta?.setting) throw new Error(`${where}: heading names "${opts.heading}", which is not a plain text field of the block.`)
  }
}

/** A reference's `own` and `only` name fields of its own block. */
function checkRefSiblings(trail: string[], def: BlockDef, fld: FieldDescriptor) {
  const ref = fld.meta?.ref as { own?: string; only?: Record<string, string[]> } | undefined
  const names = [...(ref?.own ? [ref.own] : []), ...Object.values(ref?.only ?? {}).flat()]
  for (const name of names) {
    if (!(name in def.fields)) throw new Error(`${trail.join(' › ')} names "${name}", which its block does not have (customTypeFieldRef({ own, only }) name fields of the same block).`)
  }
}

/** The blocks of a list inside a block: a reference is theirs only inside a card. */
function checkInnerRefs(trail: string[], list: FieldDescriptor, card: boolean) {
  for (const [type, def] of Object.entries(list.blocks ?? {})) {
    for (const [key, fld] of Object.entries(def.fields) as [string, FieldDescriptor][]) {
      if (isFieldRef(fld) && !card) throw new Error(refRefusal([...trail, type, key]))
      if (isFieldRef(fld)) checkRefSiblings([...trail, type, key], def, fld)
      if (fld.type === 'group') checkNoRefs([...trail, type, key], fld.fields ?? {})
      else if (fld.type === 'blocks') checkInnerRefs([...trail, type, key], fld, card)
    }
  }
}

/** A group holds no reference, at any depth. */
function checkNoRefs(trail: string[], fields: Record<string, FieldDescriptor>) {
  for (const [key, fld] of Object.entries(fields)) {
    if (isFieldRef(fld)) throw new Error(refRefusal([...trail, key]))
    if (fld.type === 'group') checkNoRefs([...trail, key], fld.fields ?? {})
  }
}

/** Does a set of fields hold a list (`f.list`, `f.blocks`), directly or inside a group? */
export function holdsList(fields: Record<string, AnyFieldDescriptor>): boolean {
  return (Object.values(fields) as FieldDescriptor[]).some((fld) => fld.type === 'blocks' || (fld.type === 'group' && holdsList(fld.fields ?? {})))
}

/**
 * How many lists deep the fields of a block (or a group) may go: a list, and a list
 * inside its items (a page's layout section holds small blocks and groups, a group holds
 * small blocks). The items of that inner list hold plain fields.
 */
const MAX_LIST_DEPTH = 2

/**
 * The rules for fields that sit inside something else (a block, a list item, a group):
 * only the field types blocks support; lists go two levels deep at most (a list, and a
 * list in its items, whose items hold plain fields and groups); a group inside a block
 * or a list holds no list (only a group straight on an entry may). A binding is a field
 * of a block itself (`opts.binding`), never of a group, a list item or a block inside
 * another block.
 */
export function checkContainedFields(what: string, fields: Record<string, AnyFieldDescriptor>, opts: { reserved?: boolean; binding?: boolean } = { reserved: true }) {
  for (const [key, fld] of Object.entries(fields) as [string, FieldDescriptor][]) {
    if (opts.reserved && (key === 'id' || key === 'type' || key === 'v')) throw new Error(`${what} field "${key}" is reserved (every block has an id, a type and a version).`)
    if (fld.meta?.access) {
      throw new Error(`${what} field "${key}" has .access(): per-field access belongs to the fields of a collection or global, not to a field inside a block, a list or a group. Put it on the blocks, list or group field itself.`)
    }
    if (!BLOCK_FIELD_TYPES.has(fld.type)) {
      throw new Error(`${what} field "${key}" has type "${fld.type}", which blocks, lists and groups do not support (allowed: ${[...BLOCK_FIELD_TYPES].join(', ')}).`)
    }
    if (fld.type === 'binding' && !opts.binding) throw new Error(bindingRefusal(what, key))
    if (fld.type === 'blocks') checkListItems(what, fld, [key])
    checkGroup(what, key, fld)
  }
}

/**
 * The item types of a list at `trail` (the keys from the block's own field down to it):
 * no binding, no group holding a list, and a list inside only while `trail` is shorter
 * than `MAX_LIST_DEPTH`. Each item type was checked on its own already when it was made
 * with `defineBlock`; this is what it may not hold because of where it sits.
 */
function checkListItems(what: string, list: FieldDescriptor, trail: string[]) {
  for (const inner of Object.values(list.blocks ?? {})) {
    for (const [innerKey, innerFld] of Object.entries(inner.fields) as [string, FieldDescriptor][]) {
      if (innerFld.type === 'binding') throw new Error(bindingRefusal(what, innerKey))
      checkGroup(what, innerKey, innerFld)
      if (innerFld.type !== 'blocks') continue
      const deeper = [...trail, innerKey]
      if (deeper.length > MAX_LIST_DEPTH) {
        throw new Error(`${what} field "${trail[0]}" holds lists three levels deep (${deeper.join(' › ')}). Lists inside a block go two levels deep at most: a list, and a list in its items.`)
      }
      checkListItems(what, innerFld, deeper)
    }
  }
}

/** A group inside a block, a list item or another group holds plain fields only. */
function checkGroup(what: string, key: string, fld: FieldDescriptor) {
  if (fld.type === 'group' && holdsList(fld.fields ?? {})) {
    throw new Error(`${what} field "${key}" is a group with a list inside. Inside a block or a list a group holds plain fields only (a group straight on an entry may hold a list).`)
  }
}

const bindingRefusal = (what: string, key: string) =>
  `${what} field "${key}" has type "binding": a binding is a field of a block only, not of a group, a list item or a block inside another block.`

/** The fields of a list's items hold no binding (`defineBlock`, which makes the item type, would allow one). */
export function checkNoBinding(what: string, fields: Record<string, AnyFieldDescriptor>) {
  for (const [key, fld] of Object.entries(fields) as [string, FieldDescriptor][]) {
    if (fld.type === 'binding') throw new Error(bindingRefusal(what, key))
  }
}

/** A version must be a whole number from 1, and from 2 on says how to get there. */
export function checkVersioning(what: string, o: { version?: number; upgrade?: unknown }) {
  if (o.version !== undefined && (!Number.isInteger(o.version) || o.version < 1)) throw new Error(`${what} version must be a whole number from 1 (got ${String(o.version)}).`)
  if ((o.version ?? 1) > 1 && typeof o.upgrade !== 'function') {
    throw new Error(`${what} is at version ${o.version} but has no \`upgrade(data, fromVersion)\`: stored items of the older shape could not be brought up to date.`)
  }
  if (o.upgrade !== undefined && typeof o.upgrade !== 'function') throw new Error(`${what} \`upgrade\` must be a function.`)
}

type KindOf<D> = D extends FieldDescriptor<infer K> ? K : never
type Prettify<T> = { [K in keyof T]: T[K] } & {}
/** One stored block of type K. Media fields hold a media id (string). */
export type BlockValue<K extends string, F> = Prettify<
  { id: string; type: K }
  & { [P in keyof F & string as KindOf<F[P]>['optionalIn'] extends true ? never : P]: KindOf<F[P]>['out'] }
  & { [P in keyof F & string as KindOf<F[P]>['optionalIn'] extends true ? P : never]?: KindOf<F[P]>['out'] | null }
>
/**
 * The stored value of a group: an object of its fields, each typed by its own kind
 * (media fields hold a media id). Every key is optional and may be null: which fields
 * must be filled in is a runtime rule (`required: true`) the types cannot see, and a
 * group is saved with the empty ones left out.
 */
export type GroupValue<F> = Prettify<{ [P in keyof F & string]?: KindOf<F[P]>['out'] | null }>
/** The value of a blocks field: an array of any of its block types. */
export type BlocksValue<B extends Record<string, BlockDef<any>>> = Array<{ [K in keyof B & string]: BlockValue<K, B[K]['fields']> }[keyof B & string]>

/** Erased shape of any stored block (what the emitted schema types the column as). */
export interface CmsBlock { id: string; type: string; [field: string]: unknown }

// ── stored versions ──────────────────────────────────────────────────────────

/**
 * The stored value of a block's `v`: a whole number from 1; anything else (or nothing) reads as 1.
 *
 * @internal
 */
export function storedBlockVersion(block: object): number {
  const v = (block as { v?: unknown }).v
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 1
}

/**
 * Marks a block whose `upgrade` threw (admin only): shown as needing attention, kept as stored.
 *
 * @internal
 */
export const UPGRADE_FAILED_KEY = '__upgradeFailed'

/** @internal */
export interface UpgradeIssue {
  type: string
  /** The block's id, when it has one. */
  id: string | null
  from: number
  to: number
  /** Where the block is inside the value: `[index, 'items', 2]` (the field key first when called with a row). */
  path: (string | number)[]
  error: unknown
}

/** @internal */
export interface UpgradeOptions {
  /** Called for each block whose `upgrade` threw; that block is then left as it was stored. */
  onError?: (issue: UpgradeIssue) => void
  /** Called for each block that was brought to a newer version (`tinyzoo content:migrate` counts them). */
  onUpgrade?: (info: { type: string; id: string | null; from: number; to: number; path: (string | number)[] }) => void
  /** Put `v` (the stored one) and `__upgradeFailed: true` on such blocks, so the admin can show them as needing attention. */
  markFailed?: boolean
  /** Put `v` on every block that has none (version 1 included), so a client always sends it back: what the admin reads. */
  stamp?: boolean
  /** What the value belongs to ("page 3f2a… · sections"), named in the development warnings. */
  where?: string
}

const isPlainObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Bring ONE block (not the lists inside it) from its stored version to the current
 * one, by calling `upgrade` once per step, and stamp `v` (left out at version 1).
 * Returns the block itself when it is not behind. Throws when a step does.
 *
 * @internal
 */
export function upgradeBlock<B extends Record<string, any>>(def: BlockDef, block: B): B {
  const to = blockVersion(def)
  const from = storedBlockVersion(block)
  if (from >= to) return block
  const { v: _v, ...rest } = block
  let data: Record<string, any> = structuredClone(rest)
  for (let step = from; step < to; step++) {
    const out = def.upgrade!(data, step)
    if (!isPlainObject(out)) throw new Error(`upgrade(data, ${step}) must return the block's data (got ${out === null ? 'null' : typeof out}).`)
    data = { ...out, id: block.id, type: block.type }
  }
  if (to > 1) data.v = to
  return data as B
}

const warned = new Set<string>()
const once = (key: string, fn: () => void) => {
  if (warned.has(key)) return
  if (warned.size > 500) warned.clear()
  warned.add(key)
  fn()
}

/**
 * Log a failed upgrade once per block (not on every request).
 *
 * @internal
 */
export function logUpgradeFailure(issue: UpgradeIssue, where = ''): void {
  const at = issue.path.join('.')
  once(`fail|${where}|${at}|${issue.id}|${issue.type}|${issue.from}`, () => {
    console.error(`[cms] could not upgrade the "${issue.type}" block${issue.id ? ` ${issue.id}` : ''} (stored at version ${issue.from}, now ${issue.to})${where ? ` in ${where}` : ''}${at ? ` at ${at}` : ''}: ${(issue.error as Error)?.message ?? issue.error}. It is shown as stored.`)
  })
}

const isProduction = () => typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'

/**
 * Development warning: a stored block has keys its definition does not know — the
 * case that silently loses data today (a field was renamed or removed without a
 * `version` and an `upgrade`). They are dropped on the next save.
 */
function warnUnknownKeys(def: BlockDef, block: Record<string, any>, where?: string) {
  if (isProduction()) return
  const unknown = Object.keys(block).filter((k) => !BLOCK_META_KEYS.has(k) && !k.startsWith('__') && !Object.hasOwn(def.fields, k))
  if (!unknown.length) return
  once(`keys|${block.type}|${unknown.join(',')}`, () => {
    console.warn(`[cms] A stored "${block.type}" block has keys its definition does not know (${unknown.join(', ')})${where ? ` in ${where}` : ''}. They are ignored and lost on the next save. If the block changed shape, raise its \`version\` and rename or move that data in \`upgrade(data, fromVersion)\`.`)
  })
}

/**
 * One stored field value brought to the current shape: a list's items run through
 * `upgrade`, rich text through `richTextUpgrades`, a group's fields one by one.
 * The same value when nothing changed.
 */
function upgradeFieldValue(fld: FieldDescriptor, value: unknown, opts: UpgradeOptions, path: (string | number)[]): unknown {
  if (fld.type === 'blocks' && fld.blocks) return upgradeBlocks(value, fld.blocks, opts, path)
  if (fld.type === 'richtext') return upgradeRichText(value)
  if (fld.type === 'group' && fld.fields && isPlainObject(value)) {
    let cur: Record<string, any> = value
    for (const [key, inner] of Object.entries(fld.fields) as [string, FieldDescriptor][]) {
      if (!(key in cur)) continue
      const next = upgradeFieldValue(inner, cur[key], opts, [...path, key])
      if (next !== cur[key]) cur = { ...cur, [key]: next }
    }
    return cur
  }
  return value
}

/**
 * Bring a stored blocks array (or list) to the versions in `defs`: every block that
 * is behind runs through its definition's `upgrade`, step by step, and is stamped
 * `v`; the lists inside blocks (and rich text, see `richTextUpgrades`) too.
 *
 * Pure: the input is not changed, and what needs no change comes back as the same
 * object. Blocks of a type that is not in `defs` pass through untouched (the config
 * dropped them; they are kept, not fatal). A block whose `upgrade` throws is left as
 * it was stored and reported through `onError`, so one bad block never takes a page down.
 *
 * @internal
 */
export function upgradeBlocks<T = unknown>(value: T, defs: Record<string, BlockDef>, opts: UpgradeOptions = {}, path: (string | number)[] = []): T {
  if (!Array.isArray(value)) return value
  let changed = false
  const out = (value as unknown[]).map((b, i) => {
    if (!isPlainObject(b) || typeof b.type !== 'string' || !Object.hasOwn(defs, b.type)) return b
    const def = defs[b.type]!
    let cur: Record<string, any> = b
    try {
      cur = upgradeBlock(def, b)
      if (cur !== b) opts.onUpgrade?.({ type: b.type, id: typeof b.id === 'string' ? b.id : null, from: storedBlockVersion(b), to: blockVersion(def), path: [...path, i] })
    }
    catch (error) {
      opts.onError?.({ type: b.type, id: typeof b.id === 'string' ? b.id : null, from: storedBlockVersion(b), to: blockVersion(def), path: [...path, i], error })
      changed = changed || !!opts.markFailed
      return opts.markFailed ? { ...b, v: storedBlockVersion(b), [UPGRADE_FAILED_KEY]: true } : b
    }
    for (const [key, fld] of Object.entries(def.fields) as [string, FieldDescriptor][]) {
      if (!(key in cur)) continue
      const next = upgradeFieldValue(fld, cur[key], opts, [...path, i, key])
      if (next !== cur[key]) cur = { ...cur, [key]: next }
    }
    if (opts.stamp && cur.v !== storedBlockVersion(cur)) cur = { ...cur, v: storedBlockVersion(cur) }
    warnUnknownKeys(def, cur, opts.where)
    if (cur !== b) changed = true
    return cur
  })
  return (changed ? out : value) as T
}

/**
 * The same for the items of an `f.list` (a blocks field with one item type): `upgradeBlocks` on its definition.
 *
 * @internal
 */
export const upgradeListItems = upgradeBlocks

/**
 * Upgrade the stored JSON of a row in place: blocks and lists (to their current
 * versions) and rich text (`richTextUpgrades`). Keys the row does not have (a
 * translation holds only the localized ones) are left alone.
 *
 * @internal
 */
export function upgradeStoredRow<R extends Record<string, any>>(
  fields: Record<string, { type: string; blocks?: Record<string, BlockDef>; fields?: Record<string, any> }>, row: R, opts: UpgradeOptions = {},
): R {
  for (const [key, fld] of Object.entries(fields)) {
    if (!(key in row) || row[key] == null) continue
    const was = row[key]
    const next = upgradeFieldValue(fld as FieldDescriptor, was, { ...opts, where: opts.where ? `${opts.where} · ${key}` : key }, [key])
    if (next !== was) (row as Record<string, any>)[key] = next
  }
  return row
}

// ── validation ───────────────────────────────────────────────────────────────

/**
 * What an unknown block type (one the config no longer has) may be called: lower
 * case, digits, `_` and `-`, starting with a letter or digit. Anything else
 * (`Link`, `_hero`, `-hero`) could be drawn as the component of a known type.
 *
 * @internal
 */
export const UNKNOWN_BLOCK_TYPE = /^[a-z0-9][a-z0-9_-]*$/
const squash = (type: string) => type.toLowerCase().replace(/[_-]/g, '')

const NOT_UP_TO_DATE = 'This block could not be brought up to date — remove it or fix it'
const OUT_OF_DATE = 'This block is out of date — reload the page and try again'

/** Structural equality of two JSON values. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => deepEqual(x, (b as unknown[])[i]))
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && deepEqual((a as any)[k], (b as any)[k]))
}

/** A block as it is compared with its stored copy: no failure marker, and `v` always spelled out (a missing one is 1). */
const comparable = (block: Record<string, any>) => {
  const { [UPGRADE_FAILED_KEY]: _marker, v: _v, ...rest } = block
  return { ...rest, v: storedBlockVersion(block) }
}
const sameAsStored = (item: Record<string, any>, stored: Record<string, any> | undefined) => !!stored && deepEqual(comparable(item), comparable(stored))

interface Compiled {
  loose: z.ZodObject<any>
  strict: z.ZodObject<any>
  /** Fields holding a list of blocks: validated by `validateBlockList`, with their own stored values. */
  lists: [string, FieldDescriptor][]
}

const compiled = new WeakMap<Record<string, BlockDef>, Map<string, Compiled>>()

function compile(blocks: Record<string, BlockDef>): Map<string, Compiled> {
  const known = compiled.get(blocks)
  if (known) return known
  const out = new Map<string, Compiled>()
  for (const [type, def] of Object.entries(blocks)) {
    const shape: Record<string, ZodTypeAny> = {
      id: z.string().min(1).max(64),
      type: z.literal(type),
    }
    const lists: [string, FieldDescriptor][] = []
    for (const [key, fld] of Object.entries(def.fields) as [string, FieldDescriptor][]) {
      if (fld.type === 'blocks' && fld.blocks) {
        // Checked on its own afterwards, against what is stored inside this block.
        lists.push([key, fld])
        shape[key] = z.unknown().optional()
        continue
      }
      // Inside a block every field may be left empty while the editor is still
      // filling it in, unless it is explicitly required.
      let s = fld.zod('create')
      if (!fld.isRequired) s = s.nullish()
      shape[key] = s
    }
    const o = z.object(shape)
    out.set(type, { loose: o, strict: o.strict(), lists })
  }
  compiled.set(blocks, out)
  return out
}

/** The most items a list field takes: `f.list({ max })` or `f.blocks(…, { max })`, else 500. */
const listMax = (fld: FieldDescriptor): number => (fld.meta?.list as { max?: number | null } | undefined)?.max ?? (fld.meta?.max as number | undefined) ?? 500

type Problem = { code: string; path: (string | number)[]; message: string; [k: string]: unknown }
const problem = (path: (string | number)[], message: string): Problem => ({ code: 'custom', path, message })
const idOf = (b: Record<string, any>) => (typeof b.id === 'string' ? b.id : null)

/** Keys of a block that are neither its fields nor its envelope. */
const unknownKeys = (def: BlockDef, block: Record<string, any>) => Object.keys(block).filter((k) => !BLOCK_META_KEYS.has(k) && k !== UPGRADE_FAILED_KEY && !Object.hasOwn(def.fields, k))

/**
 * Check a blocks array against its definitions, for a WRITE. `stored` is what the
 * same field holds right now (raw, as in the database), or nothing when the row is
 * new; the schema alone cannot see it, so the handlers that have the row pass it in.
 * It decides two things that must never be taken on the client's word:
 *
 *  - a block that says it is behind (`v` below the current version), or whose
 *    `upgrade` throws, or whose type is not defined any more, is only kept when it
 *    is a block that is already stored (same id, and for a stale one the same
 *    version; for a failing or unknown one identical to the stored copy). Anything
 *    else is refused: it would be stored without being checked.
 *  - a block without `v` is not trusted to be current: it is checked against the
 *    current definition, and only when that does not fit is it taken for version 1.
 *
 * Returns the checked list (blocks stamped with the current `v`), or null with the
 * problems added to `problems`.
 */
function validateBlockList(
  blocks: Record<string, BlockDef>, max: number, list: unknown, stored: unknown, base: (string | number)[], problems: Problem[],
): unknown[] | null {
  if (!Array.isArray(list)) {
    problems.push({ code: 'invalid_type', path: base, message: 'Invalid input: expected array' })
    return null
  }
  if (list.length > max) {
    problems.push({ code: 'too_big', path: base, message: `Too big: expected array to have <=${max} items` })
    return null
  }
  const types = compile(blocks)
  const storedById = new Map<string, Record<string, any>>()
  if (Array.isArray(stored)) for (const s of stored) if (isPlainObject(s) && typeof s.id === 'string' && !storedById.has(s.id)) storedById.set(s.id, s)
  const envelope = z.object({ id: z.string().min(1).max(64), type: z.string().min(1).max(64) })
  const squashed = Object.keys(blocks).map(squash)

  const out: unknown[] = []
  const seen = new Set<string>()
  let ok = true
  const fail = (path: (string | number)[], ...found: Problem[]) => {
    ok = false
    problems.push(...found.map((p) => ({ ...p, path: [...path, ...p.path] })))
  }
  const failZod = (index: number, issues: readonly any[]) => fail([...base, index], ...issues.map((is) => ({ ...is, path: is.path ?? [] })))
  const keep = (index: number, id: string, block: unknown) => {
    if (seen.has(id)) return fail([...base, index], problem(['id'], 'Duplicate block id'))
    seen.add(id)
    out.push(block)
  }

  list.forEach((item, i) => {
    const at = [...base, i]
    if (!isPlainObject(item)) return failZod(i, envelope.safeParse(item).error?.issues ?? [])
    const type = typeof item.type === 'string' ? item.type : ''
    const def = Object.hasOwn(blocks, type) ? blocks[type] : undefined
    const env = envelope.safeParse(item)
    const sb = typeof item.id === 'string' ? storedById.get(item.id) : undefined
    const storedOfType = sb && sb.type === type ? sb : undefined

    // ── a type the config does not have (any more) ──
    if (!def) {
      if (!env.success) return failZod(i, env.error.issues)
      const { [UPGRADE_FAILED_KEY]: _marker, ...kept } = item
      // Only a block that is already stored, exactly as it is stored, stays; it could not be checked.
      if (sameAsStored(item, sb)) return keep(i, env.data.id, kept)
      if (!UNKNOWN_BLOCK_TYPE.test(type) || squashed.includes(squash(type))) return fail(at, problem(['type'], 'Unknown block type'))
      return fail(at, problem([], 'This block type does not exist (any more), so no such block can be added or changed — remove it'))
    }

    // ── a known type ──
    const current = blockVersion(def)
    const { v: claimed, [UPGRADE_FAILED_KEY]: _marker, ...rest } = item
    const compiledDef = types.get(type)!
    let from = current
    let strictResult: ReturnType<z.ZodObject<any>['safeParse']> | null = null
    if (claimed !== undefined && claimed !== null) {
      if (typeof claimed !== 'number' || !Number.isInteger(claimed) || claimed < 1) return fail(at, problem(['v'], 'The version must be a whole number from 1'))
      if (claimed > current) return fail(at, problem(['v'], `Saved by a newer version of this site (block version ${claimed}, this one knows ${current})`))
      from = claimed
      // A stale block is taken as stale only when it is stored that way: the client's word is not enough.
      if (from < current && !(storedOfType && storedBlockVersion(storedOfType) === from)) return fail(at, problem(['v'], OUT_OF_DATE))
    }
    else {
      // No `v`: is it a block of the current shape? Nothing may be dropped silently.
      strictResult = compiledDef.strict.safeParse(rest)
      if (!strictResult.success) {
        if (current > 1) from = 1
        else {
          const extra = unknownKeys(def, item)
          if (extra.length) return fail(at, problem([], `This block has fields this site does not know (${extra.join(', ')}) — the editor is out of date, reload the page`))
          return failZod(i, strictResult.error.issues)
        }
      }
    }

    let data: Record<string, any> = rest
    let upgraded = false
    if (from < current) {
      try {
        data = upgradeBlock(def, { ...rest, v: from })
        upgraded = true
      }
      catch (error) {
        logUpgradeFailure({ type, id: idOf(item), from, to: current, path: at, error })
        // Not brought up to date, so not checked: only the copy that is already stored may stay.
        if (sameAsStored(item, sb) && env.success) return keep(i, env.data.id, sb)
        return fail(at, problem([], NOT_UP_TO_DATE))
      }
    }
    const { v: _v, ...fields } = data
    const r = strictResult?.success ? strictResult : (upgraded ? compiledDef.strict : compiledDef.loose).safeParse(fields)
    const own: Problem[] = []
    if (!r.success) own.push(...r.error.issues.map((is: any) => ({ ...is, path: is.path ?? [] })))
    const value: Record<string, any> = r.success ? { ...(r.data as Record<string, any>) } : {}
    // Lists inside the block, against the same list stored inside the same block.
    for (const [key, fld] of compiledDef.lists) {
      const raw = fields[key]
      if (raw === undefined || raw === null) {
        if (fld.isRequired) own.push({ code: 'invalid_type', path: [key], message: 'Required' })
        else if (r.success && raw === null) value[key] = null
        continue
      }
      const nested: Problem[] = []
      const checked = validateBlockList(fld.blocks!, listMax(fld), raw, storedOfType?.[key], [key], nested)
      own.push(...nested)
      if (checked) value[key] = checked
    }
    if (own.length) return fail(at, ...own)
    if (!env.success) return failZod(i, env.error.issues)
    keep(i, String(value.id), current > 1 ? { ...value, v: current } : value)
  })
  return ok ? out : null
}

/**
 * Zod for a blocks array. Each block is checked against its own type's fields, after
 * `upgrade` when it was stored at an older version (and then strictly: a key the
 * upgrade forgot to rename is an error, not silently dropped). Blocks come out
 * stamped with the current `v`.
 *
 * Writing is stricter than reading, because the server must not take the client's
 * word for what it stores (see `validateBlockList`): a block of a type that is no
 * longer defined, a block that is behind, and a block whose `upgrade` throws are kept
 * only when `stored` (what the field holds now) has the same block; a block without
 * `v` is checked as the current shape, and as version 1 only when it does not fit. With
 * no `stored` (a new row) none of those exist.
 *
 * @internal
 */
export function blocksSchema(blocks: Record<string, BlockDef>, max = 500, stored?: unknown): ZodTypeAny {
  return z.array(z.any()).max(max).transform((list, ctx) => {
    const problems: Problem[] = []
    const out = validateBlockList(blocks, max, list, stored, [], problems)
    for (const p of problems) ctx.addIssue(p as any)
    return out ?? z.NEVER
  })
}

/** The admin graph's description of one field inside a block, list item or group. */
export function innerFieldGraph(key: string, fld: FieldDescriptor): CmsAdminField {
  return {
    key,
    type: fld.type,
    optional: !fld.isRequired,
    required: fld.isRequired,
    unique: false,
    ui: fld.ui,
    meta: fld.meta,
  }
}

/** Serializable description of the block types for the admin graph. */
export function blocksGraph(blocks: Record<string, BlockDef>) {
  return Object.fromEntries(Object.entries(blocks).map(([type, def]) => [type, {
    label: def.label,
    description: def.description ?? null,
    icon: def.icon ?? 'i-lucide-square',
    fields: (Object.entries(def.fields) as [string, FieldDescriptor][]).map(([key, fld]) => innerFieldGraph(key, fld)),
  }]))
}

/** The fields of a group for the admin graph (a group's own `meta.fields`). */
export function groupGraph(fields: Record<string, AnyFieldDescriptor>) {
  return (Object.entries(fields) as [string, FieldDescriptor][]).map(([key, fld]) => innerFieldGraph(key, fld))
}

/**
 * For each block type, the keys of its media fields (for population and cleanup).
 *
 * @internal
 */
export function blockMediaKeys(blocks: Record<string, BlockDef>): Map<string, string[]> {
  return new Map(Object.entries(blocks).map(([type, def]) => [
    type,
    (Object.entries(def.fields) as [string, FieldDescriptor][]).filter(([, f]) => f.type === 'media').map(([k]) => k),
  ]))
}

/**
 * Every media id referenced by a stored blocks array (media fields, images in rich text, and both inside a block's lists).
 *
 * @internal
 */
export function mediaIdsInBlocks(value: unknown, blocks: Record<string, BlockDef>, out: string[] = []): string[] {
  if (!Array.isArray(value)) return out
  for (const block of value as CmsBlock[]) {
    if (!block || typeof block !== 'object') continue
    const def = Object.hasOwn(blocks, block.type) ? blocks[block.type] : undefined
    // A block we cannot read by its definition (its type is gone, or it is stored at an
    // older shape): every id inside it counts, so its files are not deleted under it.
    if (!def || storedBlockVersion(block) < blockVersion(def)) {
      collectAnyMedia(block, out, true)
      continue
    }
    mediaIdsInFields(def.fields, block, out)
  }
  return out
}

/**
 * Every media id in the values of a set of fields (a block's, or a group's): media fields, images in rich text, lists and groups inside.
 *
 * @internal
 */
export function mediaIdsInFields(fields: Record<string, AnyFieldDescriptor>, values: Record<string, any>, out: string[] = []): string[] {
  for (const [key, fld] of Object.entries(fields) as [string, FieldDescriptor][]) {
    const v = values[key]
    if (fld.type === 'media' && typeof v === 'string' && v) out.push(v)
    else if (fld.type === 'richtext') collectEmbedded(v, out)
    else if (fld.type === 'blocks' && fld.blocks) mediaIdsInBlocks(v, fld.blocks, out)
    else if (fld.type === 'group' && fld.fields && isPlainObject(v)) mediaIdsInFields(fld.fields, v, out)
  }
  return out
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Every media-looking id in a JSON value we have no definition for: uuid strings and rich-text `mediaId`s (not the block's own id). */
function collectAnyMedia(node: unknown, out: string[], top = false) {
  if (typeof node === 'string') {
    if (UUID_LIKE.test(node)) out.push(node)
  }
  else if (Array.isArray(node)) for (const child of node) collectAnyMedia(child, out)
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (top && (k === 'id' || k === 'type' || k === 'v')) continue
      if (k === 'mediaId' && typeof v === 'string' && v) out.push(v)
      else collectAnyMedia(v, out)
    }
  }
}

function collectEmbedded(doc: any, out: string[]) {
  if (!doc || typeof doc !== 'object') return
  if (typeof doc.attrs?.mediaId === 'string') out.push(doc.attrs.mediaId)
  if (Array.isArray(doc.content)) for (const child of doc.content) collectEmbedded(child, out)
}

export type { FieldKind }
