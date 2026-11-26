// The editor in the preview (experimental, NUXT_CMS_BUILDER=on): the messages between the
// admin's preview panel and the page inside it, and the arithmetic of a place in a list of
// blocks. One file for both sides. Each side reads a message only from the other one: the
// page from its parent window on its own origin, the admin from its preview frame's window
// on the frame's origin (as the `cms:preview` message is checked today).
//
// A block is named by its id, never by its index: the page draws only the blocks it has a
// component for, so its order and the form's may differ by the blocks it skips. A block inside
// another block's list (a small block of a layout, an item of a group) is named by its path:
// the ids from the page's list down to it, built on the page from the marks' ancestry. A path
// of one id is a block of the page, so the messages of part 1 (an id, no path) stay valid.

/** A block by the ids from the page's list down to it: `[sectionId]`, `[sectionId, groupId, itemId]`. */
export type CmsBuilderPath = string[]

/**
 * A place in a list of blocks: right before or right after a block, or at the end of a list.
 * `in` is the path of the block whose list it is (its first list of blocks); left out or empty,
 * the page's own list.
 */
export type CmsBuilderPlace =
  | { before: string; in?: CmsBuilderPath }
  | { after: string; in?: CmsBuilderPath }
  | { end: true; in: CmsBuilderPath }

/** The tool's own words, in the admin's language (the page does not know them). */
export interface CmsBuilderTexts {
  drag: string
  moveUp: string
  moveDown: string
  duplicate: string
  remove: string
  insertHere: string
  /** Since 2c: the arrows of a row, and what an empty list says. */
  moveLeft?: string
  moveRight?: string
  addBlock?: string
  /** Since 2c: what a block that draws nothing says while the tool is on. */
  blank?: string
}

/** One type of block the page may hold in a list: its name, and its own list if it has one. */
export interface CmsBuilderKind {
  label: string
  /** Two kinds with the same `sig` are the same definition, so a block may move between two lists that both have it. */
  sig: string
  /** The block's list of blocks (its first `f.blocks()` field), if it has one. */
  list?: CmsBuilderListKinds
}

/** What a list of blocks takes: its types, and at most how many. */
export interface CmsBuilderListKinds {
  types: Record<string, CmsBuilderKind>
  max: number | null
}

/** A key the admin passes on to the page while the page has no focus: Escape, and Alt with an arrow. */
export type CmsBuilderKey = 'Escape' | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

/** From the admin to the page. */
export type CmsBuilderToPage =
  /**
   * The editor in the preview is on: the block types' names, the tool's words, the selected block.
   * Sent on every load of the frame. Since 2c also the page list's kinds (`lists`) and the
   * selected block's path.
   */
  | { type: 'cms:builder:on'; labels: Record<string, string>; texts: CmsBuilderTexts; selected: string | null; selectedPath?: CmsBuilderPath | null; lists?: CmsBuilderListKinds; scale?: number }
  /** Select a block (`null`: none); `scroll` brings it into view. `path` names a block inside another one. */
  | { type: 'cms:builder:select'; id: string | null; scroll: boolean; path?: CmsBuilderPath | null }
  /** A key pressed in the admin outside a text field, for the selected block. */
  | { type: 'cms:builder:key'; key: CmsBuilderKey }
  /**
   * Since 2c: how much smaller the admin draws the page than it lays it out (1: as large; 0.6: a page
   * laid out 1280 px wide shown 768 px wide). The tools keep their size on the screen.
   */
  | { type: 'cms:builder:view'; scale: number }

/** From the page to the admin. `path`, when given, names a block inside another one; its last id is `id`. */
export type CmsBuilderToAdmin =
  /** The page listens (sent once per load, in the preview only, whether the tool is on or not): the admin answers with `cms:builder:on`. */
  | { type: 'cms:builder:ready' }
  | { type: 'cms:builder:select'; id: string | null; path?: CmsBuilderPath }
  | { type: 'cms:builder:move'; id: string; place: CmsBuilderPlace; path?: CmsBuilderPath }
  | { type: 'cms:builder:duplicate'; id: string; path?: CmsBuilderPath }
  | { type: 'cms:builder:remove'; id: string; path?: CmsBuilderPath }
  | { type: 'cms:builder:add'; place: CmsBuilderPlace }
  /** Since 2c: Ctrl/⌘ Z (`undo`) or Ctrl/⌘ ⇧ Z, Ctrl Y (`redo`) pressed in the page outside a text field. */
  | { type: 'cms:builder:history'; action: 'undo' | 'redo' }

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isId = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200
/** The most ids in a path: deeper than any list the engine allows. */
const PATH_MOST = 8

/** A path of ids (`min` ids at least: 0 for the page's own list, 1 for a block). */
export function isCmsBuilderPath(x: unknown, min = 1): x is CmsBuilderPath {
  return Array.isArray(x) && x.length >= min && x.length <= PATH_MOST && x.every(isId)
}

export function isCmsBuilderPlace(x: unknown): x is CmsBuilderPlace {
  if (!isObject(x)) return false
  const keys = Object.keys(x)
  const own = keys.filter((k) => k !== 'in')
  if (own.length !== 1) return false
  if (keys.includes('in') && !isCmsBuilderPath(x.in, 0)) return false
  if (own[0] === 'end') return x.end === true && keys.includes('in')
  return (own[0] === 'before' || own[0] === 'after') && isId(x[own[0]])
}

/** The path of the block whose list a place is in (`[]`: the page's list). */
export const cmsBuilderPlaceList = (place: CmsBuilderPlace): CmsBuilderPath => place.in ?? []

/** The block a place is next to (`null`: the end of a list). */
export const cmsBuilderPlaceAnchor = (place: CmsBuilderPlace): string | null => ('before' in place ? place.before : 'after' in place ? place.after : null)

/** A message's block as a path: its `path`, else its id alone (a block of the page). */
export function cmsBuilderPathOf(message: { id: string; path?: CmsBuilderPath }): CmsBuilderPath {
  return message.path && message.path[message.path.length - 1] === message.id ? message.path : [message.id]
}

const TEXT_KEYS: (keyof CmsBuilderTexts)[] = ['drag', 'moveUp', 'moveDown', 'duplicate', 'remove', 'insertHere']
const MORE_TEXT_KEYS: (keyof CmsBuilderTexts)[] = ['moveLeft', 'moveRight', 'addBlock', 'blank']
const KEYS: CmsBuilderKey[] = ['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
const isScale = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0.1 && x <= 4

/** A list's kinds, as far down as `depth` lists. */
export function isCmsBuilderListKinds(x: unknown, depth = 4): x is CmsBuilderListKinds {
  if (!isObject(x) || depth <= 0) return false
  if (!(x.max === null || (typeof x.max === 'number' && Number.isInteger(x.max) && x.max > 0))) return false
  if (!isObject(x.types)) return false
  return Object.values(x.types).every((k) => isObject(k) && typeof k.label === 'string' && typeof k.sig === 'string'
    && (k.list === undefined || isCmsBuilderListKinds(k.list, depth - 1)))
}

/** A message the page may act on. Anything else (another tool's message, a wrong shape) is not one. */
export function isCmsBuilderToPage(x: unknown): x is CmsBuilderToPage {
  if (!isObject(x)) return false
  if (x.type === 'cms:builder:on') {
    return isObject(x.labels) && Object.values(x.labels).every((v) => typeof v === 'string')
      && isObject(x.texts) && TEXT_KEYS.every((k) => typeof (x.texts as Record<string, unknown>)[k] === 'string')
      && MORE_TEXT_KEYS.every((k) => (x.texts as Record<string, unknown>)[k] === undefined || typeof (x.texts as Record<string, unknown>)[k] === 'string')
      && (x.selected === null || isId(x.selected))
      && (x.selectedPath === undefined || x.selectedPath === null || isCmsBuilderPath(x.selectedPath))
      && (x.lists === undefined || isCmsBuilderListKinds(x.lists))
      && (x.scale === undefined || isScale(x.scale))
  }
  if (x.type === 'cms:builder:select') {
    return (x.id === null || isId(x.id)) && typeof x.scroll === 'boolean'
      && (x.path === undefined || x.path === null || isCmsBuilderPath(x.path))
  }
  if (x.type === 'cms:builder:key') return KEYS.includes(x.key as CmsBuilderKey)
  if (x.type === 'cms:builder:view') return isScale(x.scale)
  return false
}

const pathOk = (x: Record<string, unknown>) => x.path === undefined || (isCmsBuilderPath(x.path) && (x.path as string[])[(x.path as string[]).length - 1] === x.id)

/** A message the admin may act on. */
export function isCmsBuilderToAdmin(x: unknown): x is CmsBuilderToAdmin {
  if (!isObject(x)) return false
  switch (x.type) {
    case 'cms:builder:ready': return true
    case 'cms:builder:select': return (x.id === null && x.path === undefined) || (isId(x.id) && pathOk(x))
    case 'cms:builder:move': return isId(x.id) && isCmsBuilderPlace(x.place) && pathOk(x)
    case 'cms:builder:duplicate':
    case 'cms:builder:remove': return isId(x.id) && pathOk(x)
    case 'cms:builder:add': return isCmsBuilderPlace(x.place)
    case 'cms:builder:history': return x.action === 'undo' || x.action === 'redo'
    default: return false
  }
}

/** Where a place is in a list of ids, as the index to insert at; `null` when its block is not in the list. The end of a list is its length. */
export function cmsBuilderPlaceIndex(ids: readonly string[], place: CmsBuilderPlace): number | null {
  const anchor = cmsBuilderPlaceAnchor(place)
  if (anchor === null) return ids.length
  const at = ids.indexOf(anchor)
  if (at < 0) return null
  return 'before' in place ? at : at + 1
}

/**
 * The list with block `id` moved to `place`; `null` when the block or the place's block is not in
 * the list, or when the move changes nothing (a block before or after itself, or where it is).
 */
export function cmsBuilderMove<T extends { id: string }>(list: readonly T[], id: string, place: CmsBuilderPlace): T[] | null {
  const from = list.findIndex((b) => b.id === id)
  if (from < 0) return null
  const anchor = cmsBuilderPlaceAnchor(place)
  if (anchor === id) return null
  const rest = list.filter((_, i) => i !== from)
  const at = cmsBuilderPlaceIndex(rest.map((b) => b.id), place)
  if (at === null || at === from) return null
  const next = [...rest]
  next.splice(at, 0, list[from]!)
  return next
}

// ── the preview's size ──

/** The width a desktop page is laid out at in the preview, at least. */
export const CMS_BUILDER_DESKTOP = 1280
/** The width of a phone. */
export const CMS_BUILDER_PHONE = 390

/**
 * How the preview draws the page in a stage `width` × `height` px: the width the page is laid out at,
 * the scale it is drawn at (at most 1) and the height it is laid out at, so that scaled it fills the
 * stage and scrolls inside itself. A desktop page is laid out at 1280 px, or at the stage's width when
 * that is wider; a phone at 390 px, at full size unless even that does not fit.
 */
export function cmsBuilderFit(mode: 'desktop' | 'phone', width: number, height: number): { width: number; height: number; scale: number } {
  const room = Math.max(1, Math.floor(width))
  const logical = mode === 'phone' ? CMS_BUILDER_PHONE : Math.max(CMS_BUILDER_DESKTOP, room)
  // Rounded down to a thousandth, so the page never ends up a fraction wider than the stage.
  const scale = Math.max(0.1, Math.min(1, Math.floor((room / logical) * 1000) / 1000))
  return { width: logical, height: Math.max(1, Math.round(Math.max(0, height) / scale)), scale }
}

/** Every block type's name in the admin's language, from the page list's kinds all the way down (the first name of a type wins). */
export function cmsBuilderNames(labels: Record<string, string>, lists: CmsBuilderListKinds | null | undefined): Record<string, string> {
  const out: Record<string, string> = { ...labels }
  const walk = (list: CmsBuilderListKinds | undefined, depth: number) => {
    if (!list || depth > 4) return
    for (const [type, kind] of Object.entries(list.types)) {
      if (!Object.hasOwn(out, type)) out[type] = kind.label
      walk(kind.list, depth + 1)
    }
  }
  walk(lists ?? undefined, 0)
  return out
}
