import { z, type ZodTypeAny } from 'zod'
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
 * number, boolean, datetime, select, rich text, media, and one level of lists
 * (`f.list()`: FAQ questions, feature cards, price rows inside one block). Rich text
 * is sanitised on write like everywhere else; media ids (also inside a block's
 * lists) are resolved by the content API and counted by media cleanup.
 *
 * Stored JSON outlives the code that wrote it, so a block (or `f.list`) can carry a
 * `version`: stored blocks are stamped `v` (left out while it is 1) and anything
 * behind runs through `upgrade` whenever it is read (see upgradeBlocks). A block
 * whose type was removed from the config is kept as it is, not dropped or refused.
 */

/** Field types allowed inside a block ('blocks' = a list, one level deep). */
export const BLOCK_FIELD_TYPES = new Set(['text', 'slug', 'number', 'boolean', 'datetime', 'select', 'richtext', 'media', 'blocks'])

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

/** The version a block definition is at. */
export const blockVersion = (def: Pick<BlockDef, 'version'>): number => def.version ?? 1

export function defineBlock<F extends Record<string, AnyFieldDescriptor>>(def: BlockDef<F>): BlockDef<F> {
  checkVersioning('Block', def)
  for (const [key, fld] of Object.entries(def.fields) as [string, FieldDescriptor][]) {
    if (key === 'id' || key === 'type' || key === 'v') throw new Error(`Block field "${key}" is reserved (every block has an id, a type and a version).`)
    if (!BLOCK_FIELD_TYPES.has(fld.type)) {
      throw new Error(`Block field "${key}" has type "${fld.type}", which blocks do not support (allowed: ${[...BLOCK_FIELD_TYPES].join(', ')}).`)
    }
    // A list inside a block is one level: its items hold plain fields, not more lists.
    if (fld.type === 'blocks') {
      for (const inner of Object.values(fld.blocks ?? {})) {
        for (const [innerKey, innerFld] of Object.entries(inner.fields) as [string, FieldDescriptor][]) {
          if (innerFld.type === 'blocks') throw new Error(`Block field "${key}" is a list whose items have a list ("${innerKey}"). Lists inside a block are one level deep.`)
        }
      }
    }
  }
  return def
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
/** The value of a blocks field: an array of any of its block types. */
export type BlocksValue<B extends Record<string, BlockDef<any>>> = Array<{ [K in keyof B & string]: BlockValue<K, B[K]['fields']> }[keyof B & string]>

/** Erased shape of any stored block (what the emitted schema types the column as). */
export interface CmsBlock { id: string; type: string; [field: string]: unknown }

// ── stored versions ──────────────────────────────────────────────────────────

/** The stored value of a block's `v`: a whole number from 1; anything else (or nothing) reads as 1. */
export function storedBlockVersion(block: object): number {
  const v = (block as { v?: unknown }).v
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 1
}

/** Marks a block whose `upgrade` threw (admin only): shown as needing attention, kept as stored. */
export const UPGRADE_FAILED_KEY = '__upgradeFailed'

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

export interface UpgradeOptions {
  /** Called for each block whose `upgrade` threw; that block is then left as it was stored. */
  onError?: (issue: UpgradeIssue) => void
  /** Called for each block that was brought to a newer version (`tinyzoo content:migrate` counts them). */
  onUpgrade?: (info: { type: string; id: string | null; from: number; to: number; path: (string | number)[] }) => void
  /** Put `v` (the stored one) and `__upgradeFailed: true` on such blocks, so the admin can show them as needing attention. */
  markFailed?: boolean
  /** What the value belongs to ("page 3f2a… · sections"), named in the development warnings. */
  where?: string
}

const isPlainObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Bring ONE block (not the lists inside it) from its stored version to the current
 * one, by calling `upgrade` once per step, and stamp `v` (left out at version 1).
 * Returns the block itself when it is not behind. Throws when a step does.
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

/** Log a failed upgrade once per block (not on every request). */
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
 * Bring a stored blocks array (or list) to the versions in `defs`: every block that
 * is behind runs through its definition's `upgrade`, step by step, and is stamped
 * `v`; the lists inside blocks (and rich text, see `richTextUpgrades`) too.
 *
 * Pure: the input is not changed, and what needs no change comes back as the same
 * object. Blocks of a type that is not in `defs` pass through untouched (the config
 * dropped them; they are kept, not fatal). A block whose `upgrade` throws is left as
 * it was stored and reported through `onError`, so one bad block never takes a page down.
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
      const next = fld.type === 'blocks' && fld.blocks ? upgradeBlocks(cur[key], fld.blocks, opts, [...path, i, key])
        : fld.type === 'richtext' ? upgradeRichText(cur[key])
          : cur[key]
      if (next !== cur[key]) cur = { ...cur, [key]: next }
    }
    warnUnknownKeys(def, cur, opts.where)
    if (cur !== b) changed = true
    return cur
  })
  return (changed ? out : value) as T
}

/** The same for the items of an `f.list` (a blocks field with one item type): `upgradeBlocks` on its definition. */
export const upgradeListItems = upgradeBlocks

/**
 * Upgrade the stored JSON of a row in place: blocks and lists (to their current
 * versions) and rich text (`richTextUpgrades`). Keys the row does not have (a
 * translation holds only the localized ones) are left alone.
 */
export function upgradeStoredRow<R extends Record<string, any>>(
  fields: Record<string, { type: string; blocks?: Record<string, BlockDef> }>, row: R, opts: UpgradeOptions = {},
): R {
  for (const [key, fld] of Object.entries(fields)) {
    if (!(key in row) || row[key] == null) continue
    const was = row[key]
    const next = fld.type === 'blocks' && fld.blocks ? upgradeBlocks(was, fld.blocks, { ...opts, where: opts.where ? `${opts.where} · ${key}` : key }, [key])
      : fld.type === 'richtext' ? upgradeRichText(was)
        : was
    if (next !== was) (row as Record<string, any>)[key] = next
  }
  return row
}

// ── validation ───────────────────────────────────────────────────────────────

/**
 * Zod for a blocks array. Each block is checked against its own type's fields, after
 * `upgrade` when it was stored at an older version (and then strictly: a key the
 * upgrade forgot to rename is an error, not silently dropped). Blocks come out
 * stamped with the current `v`. A block of a type that is no longer defined, or whose
 * `upgrade` throws, is kept exactly as it came in. On write, a missing `v` means "the
 * current version" (what the content API returns carries none).
 */
export function blocksSchema(blocks: Record<string, BlockDef>, max = 500): ZodTypeAny {
  const loose = new Map<string, z.ZodObject<any>>()
  const strict = new Map<string, z.ZodObject<any>>()
  for (const [type, def] of Object.entries(blocks)) {
    const shape: Record<string, ZodTypeAny> = {
      id: z.string().min(1).max(64),
      type: z.literal(type),
    }
    for (const [key, fld] of Object.entries(def.fields) as [string, FieldDescriptor][]) {
      // Inside a block every field may be left empty while the editor is still
      // filling it in, unless it is explicitly required.
      let s = fld.zod('create')
      if (!fld.isRequired) s = s.nullish()
      shape[key] = s
    }
    const o = z.object(shape)
    loose.set(type, o)
    strict.set(type, o.strict())
  }
  const envelope = z.object({ id: z.string().min(1).max(64), type: z.string().min(1).max(64) })

  return z.array(z.any()).max(max).transform((list, ctx) => {
    const out: unknown[] = []
    const seen = new Set<string>()
    let ok = true
    const fail = (issues: readonly any[], index: number) => {
      ok = false
      for (const is of issues) ctx.addIssue({ ...is, path: [index, ...(is.path ?? [])] })
    }
    list.forEach((item, i) => {
      if (!isPlainObject(item)) return fail(envelope.safeParse(item).error?.issues ?? [], i)
      const def = typeof item.type === 'string' && Object.hasOwn(blocks, item.type) ? blocks[item.type] : undefined
      // Not a type we know (any more): kept as it is.
      if (!def) {
        const r = envelope.safeParse(item)
        if (!r.success) return fail(r.error.issues, i)
        const { [UPGRADE_FAILED_KEY]: _marker, ...kept } = item
        if (seen.has(r.data.id)) return fail([{ code: 'custom', path: ['id'], message: 'Duplicate block id' }], i)
        seen.add(r.data.id)
        out.push(kept)
        return
      }
      const current = blockVersion(def)
      let from = current
      if (item.v !== undefined && item.v !== null) {
        if (typeof item.v !== 'number' || !Number.isInteger(item.v) || item.v < 1) return fail([{ code: 'custom', path: ['v'], message: 'The version must be a whole number from 1' }], i)
        if (item.v > current) return fail([{ code: 'custom', path: ['v'], message: `Saved by a newer version of this site (block version ${item.v}, this one knows ${current})` }], i)
        from = item.v
      }
      let data: Record<string, any> = item
      let upgraded = false
      if (from < current) {
        try {
          data = upgradeBlock(def, { ...item, v: from })
          upgraded = true
        }
        catch (error) {
          logUpgradeFailure({ type: item.type, id: typeof item.id === 'string' ? item.id : null, from, to: current, path: [i], error })
          const { [UPGRADE_FAILED_KEY]: _marker, ...kept } = item
          out.push(kept)
          return
        }
      }
      const { v: _v, [UPGRADE_FAILED_KEY]: _marker, ...rest } = data
      const r = (upgraded ? strict : loose).get(item.type)!.safeParse(rest)
      if (!r.success) return fail(r.error.issues, i)
      const id = String(r.data.id)
      if (seen.has(id)) return fail([{ code: 'custom', path: ['id'], message: 'Duplicate block id' }], i)
      seen.add(id)
      out.push(current > 1 ? { ...r.data, v: current } : r.data)
    })
    return ok ? out : z.NEVER
  })
}

/** Serializable description of the block types for the admin graph. */
export function blocksGraph(blocks: Record<string, BlockDef>) {
  return Object.fromEntries(Object.entries(blocks).map(([type, def]) => [type, {
    label: def.label,
    description: def.description ?? null,
    icon: def.icon ?? 'i-lucide-square',
    fields: (Object.entries(def.fields) as [string, FieldDescriptor][]).map(([key, fld]) => ({
      key,
      type: fld.type,
      optional: !fld.isRequired,
      required: fld.isRequired,
      unique: false,
      ui: fld.ui,
      meta: fld.meta,
    })),
  }]))
}

/** For each block type, the keys of its media fields (for population and cleanup). */
export function blockMediaKeys(blocks: Record<string, BlockDef>): Map<string, string[]> {
  return new Map(Object.entries(blocks).map(([type, def]) => [
    type,
    (Object.entries(def.fields) as [string, FieldDescriptor][]).filter(([, f]) => f.type === 'media').map(([k]) => k),
  ]))
}

/** Every media id referenced by a stored blocks array (media fields, images in rich text, and both inside a block's lists). */
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
    for (const [key, fld] of Object.entries(def.fields) as [string, FieldDescriptor][]) {
      const v = block[key]
      if (fld.type === 'media' && typeof v === 'string' && v) out.push(v)
      else if (fld.type === 'richtext') collectEmbedded(v, out)
      else if (fld.type === 'blocks' && fld.blocks) mediaIdsInBlocks(v, fld.blocks, out)
    }
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
