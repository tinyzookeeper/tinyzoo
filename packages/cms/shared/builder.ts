// The editor in the preview (experimental, NUXT_CMS_BUILDER=on): the messages between the
// admin's preview panel and the page inside it, and the arithmetic of a place in a list of
// blocks. One file for both sides. Each side reads a message only from the other one: the
// page from its parent window on its own origin, the admin from its preview frame's window
// on the frame's origin (as the `cms:preview` message is checked today).
//
// A block is named by its id, never by its index: the page draws only the blocks it has a
// component for, so its order and the form's may differ by the blocks it skips.

/** A place in a list of blocks: right before or right after a block. */
export type CmsBuilderPlace = { before: string } | { after: string }

/** The tool's own words, in the admin's language (the page does not know them). */
export interface CmsBuilderTexts {
  drag: string
  moveUp: string
  moveDown: string
  duplicate: string
  remove: string
  insertHere: string
}

/** From the admin to the page. */
export type CmsBuilderToPage =
  /** The editor in the preview is on: the block types' names, the tool's words, the selected block. Sent on every load of the frame. */
  | { type: 'cms:builder:on'; labels: Record<string, string>; texts: CmsBuilderTexts; selected: string | null }
  /** Select a block (`null`: none); `scroll` brings it into view. */
  | { type: 'cms:builder:select'; id: string | null; scroll: boolean }

/** From the page to the admin. */
export type CmsBuilderToAdmin =
  /** The page listens (sent once per load, in the preview only, whether the tool is on or not): the admin answers with `cms:builder:on`. */
  | { type: 'cms:builder:ready' }
  | { type: 'cms:builder:select'; id: string | null }
  | { type: 'cms:builder:move'; id: string; place: CmsBuilderPlace }
  | { type: 'cms:builder:duplicate'; id: string }
  | { type: 'cms:builder:remove'; id: string }
  | { type: 'cms:builder:add'; place: CmsBuilderPlace }

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isId = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200

export function isCmsBuilderPlace(x: unknown): x is CmsBuilderPlace {
  if (!isObject(x)) return false
  const keys = Object.keys(x)
  return keys.length === 1 && (keys[0] === 'before' || keys[0] === 'after') && isId(x[keys[0]])
}

const TEXT_KEYS: (keyof CmsBuilderTexts)[] = ['drag', 'moveUp', 'moveDown', 'duplicate', 'remove', 'insertHere']

/** A message the page may act on. Anything else (another tool's message, a wrong shape) is not one. */
export function isCmsBuilderToPage(x: unknown): x is CmsBuilderToPage {
  if (!isObject(x)) return false
  if (x.type === 'cms:builder:on') {
    return isObject(x.labels) && Object.values(x.labels).every((v) => typeof v === 'string')
      && isObject(x.texts) && TEXT_KEYS.every((k) => typeof (x.texts as Record<string, unknown>)[k] === 'string')
      && (x.selected === null || isId(x.selected))
  }
  if (x.type === 'cms:builder:select') return (x.id === null || isId(x.id)) && typeof x.scroll === 'boolean'
  return false
}

/** A message the admin may act on. */
export function isCmsBuilderToAdmin(x: unknown): x is CmsBuilderToAdmin {
  if (!isObject(x)) return false
  switch (x.type) {
    case 'cms:builder:ready': return true
    case 'cms:builder:select': return x.id === null || isId(x.id)
    case 'cms:builder:move': return isId(x.id) && isCmsBuilderPlace(x.place)
    case 'cms:builder:duplicate':
    case 'cms:builder:remove': return isId(x.id)
    case 'cms:builder:add': return isCmsBuilderPlace(x.place)
    default: return false
  }
}

/** Where a place is in a list of ids, as the index to insert at; `null` when its block is not in the list. */
export function cmsBuilderPlaceIndex(ids: readonly string[], place: CmsBuilderPlace): number | null {
  const anchor = 'before' in place ? place.before : place.after
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
  const anchor = 'before' in place ? place.before : place.after
  if (anchor === id) return null
  const rest = list.filter((_, i) => i !== from)
  const at = cmsBuilderPlaceIndex(rest.map((b) => b.id), place)
  if (at === null || at === from) return null
  const next = [...rest]
  next.splice(at, 0, list[from]!)
  return next
}
