// The value of a list of blocks as a tree: a page's blocks, a block's list of small blocks, a
// group's list inside one of them. Pure functions of the value and the admin graph's description
// of the block types (`field.meta.blocks`), so the form's list (CmsFieldBlocks.vue) and the editor
// in the preview (useCmsBuilder) make every change the same way: one id generation, one empty
// block, one limit (`max`), one rule for which list takes which block. Nothing here is reactive;
// each change returns a new value and leaves the old one as it was.
//
// A block is found by its path of ids from the root list down (see shared/builder.ts). A block's
// list is its first `f.blocks()` field.
import { cmsBuilderMove, cmsBuilderPlaceAnchor, cmsBuilderPlaceIndex, type CmsBuilderListKinds, type CmsBuilderPath, type CmsBuilderPlace } from './builder'

/** One field of a block type, as the admin graph describes it. */
export interface BlockFieldDef {
  key: string
  type: string
  meta?: Record<string, any> | null
}

/** One block type, as the admin graph describes it (`field.meta.blocks[type]`). */
export interface BlockKindDef {
  label?: unknown
  description?: unknown
  icon?: string
  fields?: BlockFieldDef[]
}

export type BlockDefs = Record<string, BlockKindDef>
export type Block = Record<string, any> & { id: string; type: string }

/** A list of blocks: what it holds, the types it takes and at most how many (`null`: no limit of its own). */
export interface BlockList {
  items: readonly any[]
  defs: BlockDefs
  max: number | null
}

const isRec = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)

/** A new block id: 12 characters, as every block of the admin gets. */
export function newBlockId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 12)
}

/** A new, empty block of `type`: every field empty (false, an empty rich text, an empty list, or null). */
export function blankBlock(defs: BlockDefs, type: string): Block {
  const b: Block = { id: newBlockId(), type }
  for (const f of defs[type]?.fields ?? []) {
    b[f.key] = f.type === 'boolean' ? false : f.type === 'richtext' ? { type: 'doc', content: [] } : f.type === 'blocks' ? [] : null
  }
  return b
}

/** The most items a list field takes: `f.list({ max })` or `f.blocks(…, { max })`; `null` when it says none. */
export function blockListMax(field: { meta?: Record<string, any> | null } | null | undefined): number | null {
  const max = field?.meta?.list?.max ?? field?.meta?.max
  return typeof max === 'number' && max > 0 ? max : null
}

/** Whether a list holds as many items as it takes. */
export const blockListFull = (list: { items: readonly unknown[]; max: number | null }) => list.max !== null && list.items.length >= list.max

/**
 * A block type's list of blocks: its first `f.blocks()` field. (Not an `f.list()`: a site draws the
 * items of a list as it likes, a list of blocks with <CmsBlocks>, which the editor in the preview sees.)
 */
export function blockListField(def: BlockKindDef | undefined): BlockFieldDef | null {
  return def?.fields?.find((f) => f.type === 'blocks' && isRec(f.meta?.blocks) && !f.meta?.list) ?? null
}

/** A block the form shows but cannot change: its type is gone, or its old shape could not be brought up to date. */
export const isLockedBlock = (defs: BlockDefs, b: unknown) => !isRec(b) || !defs[b.type] || b.__upgradeFailed === true

/** A copy of a block with a new id for it and for every block inside its lists, at any depth. */
export function withNewIds<T>(block: T): T {
  const copy = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(copy)
    if (!isRec(v)) return v
    const out: Record<string, any> = {}
    for (const [k, x] of Object.entries(v)) out[k] = copy(x)
    return out
  }
  const fresh = (v: unknown, isBlock: boolean): void => {
    if (Array.isArray(v)) {
      for (const x of v) fresh(x, isRec(x) && typeof x.id === 'string' && typeof x.type === 'string')
      return
    }
    if (!isRec(v)) return
    if (isBlock) v.id = newBlockId()
    for (const x of Object.values(v)) if (Array.isArray(x)) fresh(x, false)
  }
  const out = copy(block)
  fresh(out, true)
  return out as T
}

/** A short signature of a block type's definition: two types with the same one are the same block. */
export function blockKindSig(def: BlockKindDef | undefined): string {
  const text = JSON.stringify(def ?? null)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `${(h >>> 0).toString(36)}${text.length.toString(36)}`
}

/** Whether a list takes a block of `type` defined as `def`: it has the same type, defined the same way. */
export function listTakes(list: BlockList, type: string, def: BlockKindDef | undefined): boolean {
  const own = Object.hasOwn(list.defs, type) ? list.defs[type] : undefined
  return !!own && !!def && blockKindSig(own) === blockKindSig(def)
}

/** What a list takes, for the page: each type's name and signature, and its own list, all the way down. */
export function blockListKinds(list: { defs: BlockDefs; max: number | null }, label: (def: BlockKindDef, type: string) => string, depth = 4): CmsBuilderListKinds {
  const types: CmsBuilderListKinds['types'] = {}
  for (const [type, def] of Object.entries(list.defs)) {
    const inner = depth > 1 ? blockListField(def) : null
    types[type] = {
      label: label(def, type), sig: blockKindSig(def),
      ...(inner ? { list: blockListKinds({ defs: inner.meta!.blocks, max: blockListMax(inner) }, label, depth - 1) } : {}),
    }
  }
  return { types, max: list.max }
}

// ── finding ──

/** A block found by its path: the block, where it is in its list, the list, and the path of the block whose list it is. */
export interface FoundBlock {
  block: Block
  index: number
  list: BlockList
  parent: CmsBuilderPath
}

/** The list of the block at `parent` (`[]`: the root list itself), with the key of the field that holds it. */
export function listAt(root: BlockList, parent: CmsBuilderPath): (BlockList & { key: string | null }) | null {
  if (!parent.length) return { ...root, key: null }
  const found = findBlock(root, parent)
  if (!found) return null
  const field = blockListField(found.list.defs[found.block.type])
  if (!field) return null
  const items = found.block[field.key]
  return { items: Array.isArray(items) ? items : [], defs: field.meta!.blocks as BlockDefs, max: blockListMax(field), key: field.key }
}

export function findBlock(root: BlockList, path: CmsBuilderPath): FoundBlock | null {
  let list: BlockList = root
  let found: FoundBlock | null = null
  for (let depth = 0; depth < path.length; depth++) {
    if (found) {
      const field = blockListField(list.defs[found.block.type])
      if (!field) return null
      const items = found.block[field.key]
      list = { items: Array.isArray(items) ? items : [], defs: field.meta!.blocks as BlockDefs, max: blockListMax(field) }
    }
    const index = list.items.findIndex((b) => isRec(b) && b.id === path[depth])
    if (index < 0) return null
    found = { block: list.items[index] as Block, index, list, parent: path.slice(0, depth) }
  }
  return found
}

/** The block types along a path, from the root list down: each block's type and its definition. */
export function kindsAlong(root: BlockList, path: CmsBuilderPath): { id: string; type: string; def: BlockKindDef | undefined }[] {
  const out: { id: string; type: string; def: BlockKindDef | undefined }[] = []
  for (let depth = 1; depth <= path.length; depth++) {
    const found = findBlock(root, path.slice(0, depth))
    if (!found) break
    out.push({ id: found.block.id, type: found.block.type, def: found.list.defs[found.block.type] })
  }
  return out
}

/**
 * The ids of the blocks a list inside the form sits in, from its field key: in a root field
 * `sections`, the key `sections.2.items.0.items` is the list of the group at `[sections[2].id,
 * sections[2].items[0].id]`. `null` when the key is not inside the root or a block is not there.
 */
export function pathOfListKey(rootKey: string, rootItems: readonly any[], key: string): CmsBuilderPath | null {
  if (key === rootKey) return []
  if (!key.startsWith(`${rootKey}.`)) return null
  const parts = key.slice(rootKey.length + 1).split('.')
  const path: string[] = []
  let items: readonly any[] = rootItems
  for (let i = 0; i < parts.length; i += 2) {
    const block = items[Number(parts[i])]
    if (!isRec(block) || typeof block.id !== 'string' || !/^\d+$/.test(parts[i]!)) return null
    path.push(block.id)
    if (i + 1 >= parts.length) return null
    const next = block[parts[i + 1]!]
    if (i + 2 >= parts.length) return path
    items = Array.isArray(next) ? next : []
  }
  return null
}

// ── changing ──

/** The root list's items with the list of the block at `parent` replaced by `items`. */
function withList(root: BlockList, parent: CmsBuilderPath, items: any[]): any[] | null {
  if (!parent.length) return items
  const found = findBlock(root, parent)
  if (!found) return null
  const field = blockListField(found.list.defs[found.block.type])
  if (!field) return null
  const block = { ...found.block, [field.key]: items }
  const siblings = [...found.list.items]
  siblings[found.index] = block
  return withList(root, found.parent, siblings)
}

/** The place a block had in its list: before the block after it, else after the one before it, else the end of the list. */
export function placeOf(found: FoundBlock): CmsBuilderPlace {
  const next = found.list.items[found.index + 1]
  const prev = found.list.items[found.index - 1]
  const at = found.parent.length ? { in: found.parent } : {}
  if (isRec(next) && typeof next.id === 'string') return { before: next.id, ...at }
  if (isRec(prev) && typeof prev.id === 'string') return { after: prev.id, ...at }
  return { end: true, in: found.parent }
}

const listOfPlace = (place: CmsBuilderPlace): CmsBuilderPath => place.in ?? []
const startsWith = (path: CmsBuilderPath, prefix: CmsBuilderPath) => prefix.length <= path.length && prefix.every((id, i) => path[i] === id)

/** The list a place is in, if it exists and holds the place's block. */
export function listOfPlaceIn(root: BlockList, place: CmsBuilderPlace): (BlockList & { key: string | null; at: number }) | null {
  const list = listAt(root, listOfPlace(place))
  if (!list) return null
  const at = cmsBuilderPlaceIndex(list.items.map((b) => (isRec(b) ? b.id : undefined)), place)
  return at === null ? null : { ...list, at }
}

/** Insert `block` at `place`. `null` when the place is not there, its list does not take the block's type, or the list is full. */
export function treeInsert(root: BlockList, place: CmsBuilderPlace, block: Block, def?: BlockKindDef): any[] | null {
  const list = listOfPlaceIn(root, place)
  if (!list || blockListFull(list)) return null
  if (!Object.hasOwn(list.defs, block.type) || (def && !listTakes(list, block.type, def))) return null
  const items = [...list.items]
  items.splice(list.at, 0, block)
  return withList(root, listOfPlace(place), items)
}

/** Remove the block at `path`; with it, the place it had (to put it back). */
export function treeRemove(root: BlockList, path: CmsBuilderPath): { items: any[]; removed: Block; place: CmsBuilderPlace } | null {
  const found = findBlock(root, path)
  if (!found) return null
  const items = found.list.items.filter((_, i) => i !== found.index)
  const next = withList(root, found.parent, items)
  return next ? { items: next, removed: found.block, place: placeOf(found) } : null
}

/** A copy of the block at `path` right after it, with new ids inside. `null` for a locked block, or when its list is full. */
export function treeDuplicate(root: BlockList, path: CmsBuilderPath): { items: any[]; copy: Block; path: CmsBuilderPath } | null {
  const found = findBlock(root, path)
  if (!found || isLockedBlock(found.list.defs, found.block) || blockListFull(found.list)) return null
  const copy = withNewIds(found.block)
  const items = [...found.list.items]
  items.splice(found.index + 1, 0, copy)
  const next = withList(root, found.parent, items)
  return next ? { items: next, copy, path: [...found.parent, copy.id] } : null
}

/**
 * Move the block at `path` to `place`: in its own list, or into another list that takes its type
 * (the same definition) and is not full. Never into itself. With the moved block's new path and
 * the place it had (to move it back). `null` when the move is not allowed or changes nothing.
 */
export function treeMove(root: BlockList, path: CmsBuilderPath, place: CmsBuilderPlace): { items: any[]; path: CmsBuilderPath; back: CmsBuilderPlace } | null {
  const found = findBlock(root, path)
  if (!found) return null
  const target = listOfPlace(place)
  const back = placeOf(found)
  if (target.length === found.parent.length && startsWith(target, found.parent)) {
    const moved = cmsBuilderMove(found.list.items as Block[], found.block.id, place)
    const next = moved && withList(root, found.parent, moved)
    return next ? { items: next, path, back } : null
  }
  if (startsWith(target, path) || isLockedBlock(found.list.defs, found.block)) return null
  if (cmsBuilderPlaceAnchor(place) === found.block.id) return null
  const def = found.list.defs[found.block.type]
  const into = listOfPlaceIn(root, place)
  if (!into || blockListFull(into) || !listTakes(into, found.block.type, def)) return null
  const removed = withList(root, found.parent, found.list.items.filter((_, i) => i !== found.index))
  if (!removed) return null
  const next = treeInsert({ ...root, items: removed }, place, found.block, def)
  return next ? { items: next, path: [...target, found.block.id], back } : null
}

/** The block at `path` with its field `key` set to `value`. `null` when the block is not there. */
export function treeSet(root: BlockList, path: CmsBuilderPath, key: string, value: unknown): any[] | null {
  const found = findBlock(root, path)
  if (!found || key === 'id' || key === 'type') return null
  const siblings = [...found.list.items]
  siblings[found.index] = { ...found.block, [key]: value }
  return withList(root, found.parent, siblings)
}

// ── the focus panel: where a block is in the form ──

/**
 * The form's key of the block at `path` in the field `rootKey`: `sections.2` for a block of the page,
 * `sections.2.items.0` for a small block in it. Errors are kept by such keys. `null` when not there.
 */
export function keyOfPath(rootKey: string, root: BlockList, path: CmsBuilderPath): string | null {
  let key = rootKey
  for (let depth = 1; depth <= path.length; depth++) {
    const list = listAt(root, path.slice(0, depth - 1))
    if (!list) return null
    const index = list.items.findIndex((b) => isRec(b) && b.id === path[depth - 1])
    if (index < 0) return null
    key += `${list.key ? `.${list.key}` : ''}.${index}`
  }
  return key
}

/** The path of the block with this id, at any depth; `null` when the tree has none. */
export function pathOfId(root: BlockList, id: string): CmsBuilderPath | null {
  const walk = (list: BlockList, above: string[]): CmsBuilderPath | null => {
    for (const b of list.items) {
      if (!isRec(b) || typeof b.id !== 'string') continue
      if (b.id === id) return [...above, b.id]
      const field = blockListField(list.defs[b.type])
      if (!field || !Array.isArray(b[field.key])) continue
      const inner = walk({ items: b[field.key], defs: field.meta!.blocks as BlockDefs, max: blockListMax(field) }, [...above, b.id])
      if (inner) return inner
    }
    return null
  }
  return walk(root, [])
}

const under = (key: string, prefix: string) => key === prefix || key.startsWith(`${prefix}.`)

/**
 * The errors a panel that shows the block at `path` alone does not show where they are, counted where
 * they lead from: `outside` (the rest of the form, behind the way back to all sections) and one count
 * per block along the path but the last (its own fields, or its other blocks, behind that part of the
 * breadcrumb). The selected block's own fields and its list's rows show their errors themselves.
 */
export function issueCounts(rootKey: string, root: BlockList, path: CmsBuilderPath, issueKeys: readonly string[]): { outside: number; along: number[] } {
  const keys = path.map((_, i) => keyOfPath(rootKey, root, path.slice(0, i + 1)))
  const along = path.slice(0, -1).map((_, i) => {
    const mine = keys[i]
    const next = keys[i + 1]
    return mine ? issueKeys.filter((k) => under(k, mine) && !(next && under(k, next))).length : 0
  })
  const first = keys[0]
  return { outside: first ? issueKeys.filter((k) => !under(k, first)).length : issueKeys.length, along }
}

const idsOf = (items: readonly any[]) => items.filter((b) => isRec(b) && typeof b.id === 'string').map((b) => b.id as string)

/**
 * The block a change between two values of a list made a difference to, at any depth: one added or
 * removed (`around`: the blocks whose list it is in), the one moved within its list, else the deepest
 * block whose own fields changed. For undo and redo, which select it afterwards. `null`: no difference.
 */
export function changedBlock(defs: BlockDefs, a: readonly any[], b: readonly any[], around: CmsBuilderPath = []): { id: string; around: CmsBuilderPath } | null {
  const ia = idsOf(a)
  const ib = idsOf(b)
  const added = ib.find((id) => !ia.includes(id))
  if (added) return { id: added, around }
  const removed = ia.find((id) => !ib.includes(id))
  if (removed) return { id: removed, around }
  if (ia.join('\n') !== ib.join('\n')) {
    const moved = ia.find((id) => ia.filter((x) => x !== id).join('\n') === ib.filter((x) => x !== id).join('\n'))
    return { id: moved ?? ia.find((id, i) => ib[i] !== id)!, around }
  }
  for (const x of a) {
    if (!isRec(x) || typeof x.id !== 'string') continue
    const y = b.find((v) => isRec(v) && v.id === x.id)
    if (JSON.stringify(x) === JSON.stringify(y)) continue
    const field = blockListField(defs[x.type])
    if (field && JSON.stringify(x[field.key] ?? []) !== JSON.stringify(y?.[field.key] ?? [])) {
      const inner = changedBlock(field.meta!.blocks as BlockDefs, Array.isArray(x[field.key]) ? x[field.key] : [], Array.isArray(y?.[field.key]) ? y[field.key] : [], [...around, x.id])
      if (inner) return inner
    }
    return { id: x.id, around }
  }
  return null
}

/** Field types whose changes are typing: in the history, one step per field per pause. */
const TYPED = new Set(['text', 'textarea', 'richtext', 'number', 'slug', 'email', 'url', 'string', 'markdown', 'code', 'group'])

/**
 * The field being typed in, when a change between two values of a list is typing: the same blocks in
 * the same places at every depth, and one field of one block changed, a text (or a list's item's text,
 * or a group's), not a setting. `block id:field key`, else `null` (a step of its own: a setting, a
 * choice, a picture, a block added, moved or removed).
 */
export function typingGroup(defs: BlockDefs, a: readonly any[], b: readonly any[]): string | null {
  if (a.length !== b.length || idsOf(a).join('\n') !== idsOf(b).join('\n')) return null
  const differ = a.map((x, i) => JSON.stringify(x) !== JSON.stringify(b[i]))
  if (differ.filter(Boolean).length !== 1) return null
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (!differ[i]) continue
    if (!isRec(x) || !isRec(y) || x.type !== y.type) return null
    const fields = defs[x.type]?.fields ?? []
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]))
    if (keys.length !== 1) return null
    const field = fields.find((f) => f.key === keys[0])
    if (!field || field.meta?.setting) return null
    const list = blockListField(defs[x.type])
    if (list && list.key === field.key) return typingGroup(list.meta!.blocks as BlockDefs, Array.isArray(x[field.key]) ? x[field.key] : [], Array.isArray(y[field.key]) ? y[field.key] : [])
    if (field.type === 'blocks') {
      // A list's items (questions, cards): typing when they are the same items in the same order.
      const ia = Array.isArray(x[field.key]) ? x[field.key] : []
      const ib = Array.isArray(y[field.key]) ? y[field.key] : []
      return ia.length === ib.length && idsOf(ia).join('\n') === idsOf(ib).join('\n') ? `${x.id}:${field.key}` : null
    }
    return TYPED.has(field.type) ? `${x.id}:${field.key}` : null
  }
  return null
}
