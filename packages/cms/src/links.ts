import { blockVersion, storedBlockVersion } from './blocks'
import { looksLikeLinkRef } from './linkref'

/**
 * Links that follow their target.
 *
 * A page or entry an editor picks in the link picker is stored as a reference,
 * `cms:<entity>/<id>`, instead of its address — in a link field (`f.text({ format:
 * 'link' })`, a menu's link block) and in the `href` of a rich-text link. The website
 * never sees one: on read, the content API turns each reference into the target's
 * current address in the language asked for (or `null` / an unlinked text when the
 * target is gone, not published or not public). Addresses typed by hand (`/path`,
 * `https://…`, `mailto:`, `tel:`) are stored and served as they are.
 *
 * This module is the pure part: the reference format, and the walk over stored values
 * (fields, lists, blocks, groups, rich text) that finds links and rewrites them.
 */

export { linkRef, parseLinkRef, isLinkRef, looksLikeLinkRef, type LinkRef } from './linkref'

// ── walking stored values ──────────────────────────────────────────────────────

/** What the walk needs to know of a field (a field descriptor, or its graph entry). */
export interface LinkFieldLike {
  type: string
  meta?: Record<string, any>
  blocks?: Record<string, { fields: Record<string, LinkFieldLike>; version?: number }>
  fields?: Record<string, LinkFieldLike>
}

/** Is this a field that holds an address a link can be stored in? */
export const isLinkField = (fld: LinkFieldLike): boolean => fld.type === 'text' && fld.meta?.format === 'link'

const holds = new WeakMap<object, boolean>()

/**
 * Can a value of this field contain a link, at any depth? Link fields and rich text do;
 * a list, a block or a group does when one of its fields does.
 */
export function holdsLinks(fld: LinkFieldLike): boolean {
  const known = holds.get(fld)
  if (known !== undefined) return known
  holds.set(fld, false) // a field cannot contain itself: stops a cycle if one ever exists
  let out = isLinkField(fld) || fld.type === 'richtext'
  if (!out && fld.type === 'blocks') out = Object.values(fld.blocks ?? {}).some((def) => Object.values(def.fields).some(holdsLinks))
  if (!out && fld.type === 'group') out = Object.values(fld.fields ?? {}).some(holdsLinks)
  holds.set(fld, out)
  return out
}

/** The fields of an entity (or any field map) that can hold a link. */
export const linkFieldsOf = <F extends LinkFieldLike>(fields: Record<string, F>): [string, F][] => Object.entries(fields).filter(([, fld]) => holdsLinks(fld))

/**
 * What to do with each link found. Return `undefined` to leave a link as it is.
 *  - `field`: a stored link field's value (text) → the new value, or null to empty it;
 *  - `mark`: a rich-text link's href → the new href, or null to take the link off the text (the text stays).
 */
export interface LinkVisitor {
  field?: (value: string) => string | null | undefined
  mark?: (href: string) => string | null | undefined
  /** Blocks stored at an older version than their definition are skipped (and reported here): their fields may not be where the definition says. */
  skipStale?: boolean
  onStale?: (type: string) => void
}

const isPlainObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)

/** A rich-text document with its link marks rewritten; the same object when nothing changed. */
export function mapDocLinks<T>(doc: T, visitor: LinkVisitor): T {
  if (!visitor.mark) return doc
  const mark = visitor.mark
  const walk = (node: any): any => {
    if (!isPlainObject(node)) return node
    let out = node
    if (Array.isArray(node.marks)) {
      let changed = false
      const marks: unknown[] = []
      for (const m of node.marks) {
        if (isPlainObject(m) && m.type === 'link' && typeof m.attrs?.href === 'string') {
          const next = mark(m.attrs.href)
          if (next === undefined || next === m.attrs.href) marks.push(m)
          else {
            changed = true
            if (next !== null) marks.push({ ...m, attrs: { ...m.attrs, href: next } })
          }
        }
        else marks.push(m)
      }
      if (changed) {
        // A text left with no mark at all has no `marks`, as if it had never been a link.
        const { marks: _old, ...rest } = out
        out = marks.length ? { ...rest, marks } : rest
      }
    }
    if (Array.isArray(node.content)) {
      let changed = false
      const content = node.content.map((child: unknown) => {
        const next = walk(child)
        if (next !== child) changed = true
        return next
      })
      if (changed) out = { ...out, content }
    }
    return out
  }
  return walk(doc)
}

/** One field's value with its links rewritten; the same value when nothing changed. */
export function mapFieldLinks(fld: LinkFieldLike, value: unknown, visitor: LinkVisitor): unknown {
  if (value === null || value === undefined) return value
  if (isLinkField(fld)) {
    if (typeof value !== 'string' || !value || !visitor.field) return value
    const next = visitor.field(value)
    return next === undefined ? value : next
  }
  if (fld.type === 'richtext') return mapDocLinks(value, visitor)
  if (fld.type === 'blocks' && fld.blocks) return mapBlockLinks(value, fld.blocks, visitor)
  if (fld.type === 'group' && fld.fields) return mapGroupLinks(value, fld.fields, visitor)
  return value
}

function mapGroupLinks(value: unknown, fields: Record<string, LinkFieldLike>, visitor: LinkVisitor): unknown {
  if (!isPlainObject(value)) return value
  let out = value
  for (const [key, fld] of linkFieldsOf(fields)) {
    if (!(key in out)) continue
    const next = mapFieldLinks(fld, out[key], visitor)
    if (next !== out[key]) out = { ...out, [key]: next }
  }
  return out
}

function mapBlockLinks(value: unknown, defs: Record<string, { fields: Record<string, LinkFieldLike>; version?: number }>, visitor: LinkVisitor): unknown {
  if (!Array.isArray(value)) return value
  let changed = false
  const out = value.map((b) => {
    if (!isPlainObject(b) || typeof b.type !== 'string' || !Object.hasOwn(defs, b.type)) return b
    const def = defs[b.type]!
    if (visitor.skipStale && storedBlockVersion(b) < blockVersion(def)) {
      visitor.onStale?.(b.type)
      return b
    }
    let cur: Record<string, any> = b
    for (const [key, fld] of linkFieldsOf(def.fields)) {
      if (!(key in cur)) continue
      const next = mapFieldLinks(fld, cur[key], visitor)
      if (next !== cur[key]) cur = { ...cur, [key]: next }
    }
    if (cur !== b) changed = true
    return cur
  })
  return changed ? out : value
}

/**
 * The links of a row rewritten, as the fields that changed (`{ url: '/o-nas' }`):
 * nothing is modified, so a row (or a draft someone else holds) is never touched.
 */
export function mapRowLinks(fields: Record<string, LinkFieldLike>, row: Record<string, any>, visitor: LinkVisitor): Record<string, any> {
  const changed: Record<string, any> = {}
  for (const [key, fld] of linkFieldsOf(fields)) {
    if (!(key in row)) continue
    const next = mapFieldLinks(fld, row[key], visitor)
    if (next !== row[key]) changed[key] = next
  }
  return changed
}

/** Every link reference (`cms:…`, well-formed or not) a row holds, in its link fields and rich text. */
export function linkRefsOf(fields: Record<string, LinkFieldLike>, row: Record<string, any>, out: Set<string> = new Set()): Set<string> {
  const seen = (v: string) => {
    if (looksLikeLinkRef(v)) out.add(v)
    return undefined
  }
  mapRowLinks(fields, row, { field: seen, mark: seen })
  return out
}
