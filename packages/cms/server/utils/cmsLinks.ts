import { and, chainOf, eq, indexTree, inArray, linkFieldsOf, looksLikeLinkRef, linkRef, linkRefsOf, mapRowLinks, ne, or, parseLinkRef, sql } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'
import { addressKeys, entryAddresses, isLinkable } from './cmsLinkAddress'
import { loadTreeNodes } from './cmsTreeAddress'

/**
 * Links that follow their target (see src/links.ts for the format).
 *
 *  - `resolveContentLinks`: what visitors get. Every `cms:<entity>/<id>` in the rows —
 *    link fields, rich text, inside lists, blocks and groups — becomes the target's
 *    current address in the language asked for, or null (a link field) / an unlinked
 *    text (rich text) when the target is gone, not live or not public. Nothing
 *    reaches a visitor with a `cms:` in it.
 *  - `describeLinkRefs`: what the admin shows beside a link: the target's title and
 *    address, and whether it is live.
 *  - `linksTo`: what links to an entry (a delete is refused while something does).
 */

export interface LinkScope {
  /** The language the content is served in (null: single-language content). */
  locale: string | null
  /** An editor's preview (admin session or content token + `?preview`): drafts count as targets. */
  preview?: boolean
  /** The signed-in previewer: a draft only resolves when this person may read it (a content token has no user and sees every draft). */
  user?: any
}

/** Does any collection or global hold a field a link can be stored in? */
export function hasLinkFields(reg: CmsRegistry): boolean {
  return reg.entities.some((e) => linkFieldsOf(e.fields as any).length > 0)
}

/**
 * The address each reference resolves to for visitors, or null: not a reference to a
 * collection that has addresses, a missing entry, or one that is not live (draft,
 * unpublished, scheduled for later) — unless it is an editor's preview.
 */
export async function resolveLinkRefs(db: any, reg: CmsRegistry, refs: Iterable<string>, scope: LinkScope): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  const wanted = new Map<string, Map<string, string[]>>()
  for (const ref of refs) {
    const parsed = parseLinkRef(ref)
    const e = parsed ? reg.byName.get(parsed.entity) : undefined
    if (!parsed || !isLinkable(e)) {
      out.set(ref, null)
      continue
    }
    const ids = wanted.get(e.name) ?? new Map<string, string[]>()
    ids.set(parsed.id, [...(ids.get(parsed.id) ?? []), ref])
    wanted.set(e.name, ids)
  }
  for (const [name, ids] of wanted) {
    const e = reg.byName.get(name)!
    const cols: Record<string, any> = { id: e.table.id }
    for (const k of addressKeys(e)) cols[k] = (e.table as any)[k]
    // Visitors reach what is live. A signed-in previewer also reaches the drafts they may read
    // (never one a row-level `access.read` rule keeps from them); a content token (no user) reaches every draft.
    const published = publishedCond(e, liveLocale(reg, scope.locale))
    let live = published
    if (scope.preview) {
      live = undefined
      if (scope.user && published) {
        const read = accessWhere(e, 'read', scope.user)
        live = !read.allowed ? published : read.where ? or(published, read.where) : undefined
      }
    }
    const idCond = inArray(e.table.id, [...ids.keys()])
    const rows: any[] = await db.select(cols).from(e.table).where(live ? and(live, idCond) : idCond)
    const addresses = await entryAddresses(db, reg, e, rows, scope.locale, { drafts: scope.preview })
    // A page under an unpublished page is not reachable on the website (page tree rule),
    // so a visitor's link to it goes nowhere, like a link to a draft.
    if (e.tree && !scope.preview && published) {
      const index = indexTree(await loadTreeNodes(db, reg, e))
      const ancestors = new Set<string>()
      for (const id of addresses.keys()) for (const n of chainOf(index, id)) if (n.id !== id) ancestors.add(n.id)
      const liveAncestors = ancestors.size
        ? new Set<string>((await db.select({ id: e.table.id }).from(e.table).where(and(published, inArray(e.table.id, [...ancestors]))) as any[]).map((r) => r.id))
        : new Set<string>()
      for (const id of addresses.keys()) {
        if (chainOf(index, id).some((n) => n.id !== id && !liveAncestors.has(n.id))) addresses.set(id, null)
      }
    }
    for (const [id, list] of ids) for (const ref of list) out.set(ref, addresses.get(id) ?? null)
  }
  return out
}

/**
 * Replace the references in `rows` (rows of `e`, as served: translations already laid
 * over) with addresses. Nothing the rows hold is modified in place except the fields
 * that change, which are assigned new values.
 */
export async function resolveContentLinks(db: any, reg: CmsRegistry, e: CmsEntity, rows: Record<string, any>[], scope: LinkScope): Promise<void> {
  if (!rows.length || !linkFieldsOf(e.fields as any).length) return
  const refs = new Set<string>()
  for (const r of rows) linkRefsOf(e.fields as any, r, refs)
  if (!refs.size) return
  const resolved = await resolveLinkRefs(db, reg, refs, scope)
  const follow = (v: string) => (looksLikeLinkRef(v) ? (resolved.get(v) ?? null) : undefined)
  for (const r of rows) Object.assign(r, mapRowLinks(e.fields as any, r, { field: follow, mark: follow }))
}

export type LinkTargetState = 'live' | 'draft' | 'missing'
export interface LinkTargetInfo {
  entity: string
  id: string
  /** The entry's title in the language asked for. */
  title: string
  /** Its address on the website in that language (null: it has none). */
  path: string | null
  state: LinkTargetState
}

/**
 * What the admin shows for a stored link reference: the target's title and address, and
 * whether visitors can follow it (`live`), it waits for the entry to be published
 * (`draft`) or the entry is gone (`missing`). An entry this person may not read is
 * `missing` too: telling "not yours" from "not there" would say which ids exist.
 */
export async function describeLinkRefs(db: any, reg: CmsRegistry, user: any, refs: string[], locale: string | null): Promise<Record<string, LinkTargetInfo>> {
  const out: Record<string, LinkTargetInfo> = {}
  const gone = (ref: string, entity = '', id = ''): LinkTargetInfo => ({ entity, id, title: '', path: null, state: 'missing' })
  const wanted = new Map<string, Map<string, string[]>>()
  for (const ref of refs) {
    const parsed = parseLinkRef(ref)
    const e = parsed ? reg.byName.get(parsed.entity) : undefined
    if (!parsed || !isLinkable(e)) {
      out[ref] = gone(ref, parsed?.entity, parsed?.id)
      continue
    }
    const ids = wanted.get(e.name) ?? new Map<string, string[]>()
    ids.set(parsed.id, [...(ids.get(parsed.id) ?? []), ref])
    wanted.set(e.name, ids)
  }
  for (const [name, ids] of wanted) {
    const e = reg.byName.get(name)!
    const { allowed, where } = accessWhere(e, 'read', user)
    if (!allowed) {
      for (const [id, list] of ids) for (const ref of list) out[ref] = gone(ref, name, id)
      continue
    }
    const liveCond = publishedCond(e, liveLocale(reg, locale))
    const titleCol = (e.table as any)[e.titleField]
    const cols: Record<string, any> = { id: e.table.id, title: titleCol, live: liveCond ? sql<boolean>`${liveCond}` : sql<boolean>`true` }
    for (const k of addressKeys(e)) cols[k] = (e.table as any)[k]
    const idCond = inArray(e.table.id, [...ids.keys()])
    const rows: any[] = await db.select(cols).from(e.table).where(where ? and(idCond, where) : idCond)
    const addresses = await entryAddresses(db, reg, e, rows, locale)
    // The title in the language being edited, when it is translated.
    const titles = new Map<string, string>(rows.map((r) => [r.id, r.title == null ? '' : String(r.title)]))
    const t = e.localesTable
    if (locale && reg.locales && locale !== reg.locales.default && t && e.localized.includes(e.titleField) && t[e.titleField] && rows.length) {
      const trs: any[] = await db.select({ parentId: t.parentId, title: t[e.titleField] }).from(t).where(and(inArray(t.parentId, rows.map((r) => r.id)), eq(t.locale, locale)))
      for (const r of trs) if (r.title) titles.set(r.parentId, String(r.title))
    }
    const found = new Map(rows.map((r) => [r.id, r]))
    for (const [id, list] of ids) {
      for (const ref of list) {
        const row = found.get(id)
        if (!row) out[ref] = gone(ref, name, id)
        else out[ref] = { entity: name, id, title: titles.get(id) ?? '', path: addresses.get(id) ?? null, state: row.live ? 'live' : 'draft' }
      }
    }
  }
  return out
}

export interface LinkedFrom {
  entity: string
  id: string
  /** The entry's title; empty for a global (see `label`). */
  title: string
  /** A global (a menu, the site settings): named by its collection label, not a title. */
  singleton: boolean
  label: unknown
  /** The language of the translation that holds the link; null for the entry itself. */
  locale: string | null
  /** The fields that hold the link (the refusal names the entry only to people who may read one of them). */
  fields: string[]
}

/**
 * Everything that links to an entry by reference: entries and globals whose link
 * fields or rich text hold `cms:<entity>/<id>`, translations included. Found by text
 * search on the stored JSON, so a link inside a block the config no longer knows
 * still counts. For one entry, its link to itself does not count. At most `perEntity` of each.
 *
 * Given several ids (a page and the pages below it), finds what links to any of them, in
 * one query per collection (and one for its translations); nothing is left out as "itself".
 */
export async function linksTo(db: any, reg: CmsRegistry, target: CmsEntity, idOrIds: string | string[], perEntity = 5): Promise<LinkedFrom[]> {
  const targets = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
  const id = targets.length === 1 ? targets[0]! : null
  if (!targets.length) return []
  const refs = targets.map((t) => linkRef(target.name, t).toLowerCase())
  const has = (col: any) => or(...refs.map((ref) => sql`strpos(lower(cast(${col} as text)), ${ref}) > 0`))
  const out: LinkedFrom[] = []
  for (const e of reg.entities) {
    const keys = linkFieldsOf(e.fields as any).map(([k]) => k)
    if (!keys.length) continue
    const own = (e.table as any)
    const titleCol = own[e.titleField] ?? own.id
    const notSelf = id !== null && e.name === target.name ? ne(own.id, id) : undefined
    const direct = or(...keys.map((k) => has(own[k])))
    const found = new Map<string, LinkedFrom>()
    const add = (r: { id: string; title: unknown }, locale: string | null, fields: string[]) => {
      const key = `${r.id}:${locale ?? ''}`
      const seen = found.get(key)
      if (seen) { seen.fields = [...new Set([...seen.fields, ...fields])]; return }
      if (found.size >= perEntity) return
      found.set(key, { entity: e.name, id: r.id, title: e.singleton || r.title == null ? '' : String(r.title), singleton: !!e.singleton, label: e.label, locale, fields })
    }
    const rows: any[] = await db.select({ id: own.id, title: titleCol }).from(own).where(notSelf ? and(direct, notSelf) : direct).limit(perEntity)
    // Which field holds it: asked per field, so the refusal can say it only to people who may read that field.
    for (const r of rows) {
      const via = keys.length > 1 ? (await Promise.all(keys.map(async (k) => {
        const [hit] = await db.select({ id: own.id }).from(own).where(and(eq(own.id, r.id), has(own[k]))).limit(1)
        return hit ? k : null
      }))).filter((k): k is string => !!k) : keys
      add(r, null, via)
    }
    const t = e.localesTable
    const tkeys = keys.filter((k) => e.localized.includes(k) && t?.[k])
    if (t && tkeys.length && found.size < perEntity) {
      const hits: any[] = await db.select({ parentId: t.parentId, locale: t.locale }).from(t).where(or(...tkeys.map((k) => has(t[k])))).limit(perEntity)
      for (const h of hits) {
        if (id !== null && e.name === target.name && h.parentId === id) continue
        const [parent] = await db.select({ id: own.id, title: titleCol }).from(own).where(eq(own.id, h.parentId))
        if (parent) add(parent, h.locale, tkeys)
      }
    }
    out.push(...found.values())
  }
  return out
}

/**
 * Split entries (`{ entity, id }`) into those this person may read and a count of the
 * rest, so a refusal can name what is in the way without telling anyone the titles of
 * entries a row-level `access.read` rule keeps from them. Globals follow their collection's rule.
 */
export async function splitReadable<T extends { entity: string; id: string }>(db: any, reg: CmsRegistry, user: any, items: T[]): Promise<{ visible: T[]; hidden: number }> {
  const byEntity = new Map<string, T[]>()
  for (const it of items) byEntity.set(it.entity, [...(byEntity.get(it.entity) ?? []), it])
  const readable = new Set<string>()
  for (const [name, list] of byEntity) {
    const e = reg.byName.get(name)
    if (!e) continue
    const { allowed, where } = accessWhere(e, 'read', user)
    if (!allowed) continue
    // Found through a field this person may not read: the entry is counted, not named.
    const hiddenFields = unreadableFields(e, user)
    const sees = (it: T) => !hiddenFields.size || !(it as any).fields?.length || (it as any).fields.some((k: string) => !hiddenFields.has(k))
    if (!where) {
      for (const it of list) if (sees(it)) readable.add(`${name}\u0000${it.id}`)
      continue
    }
    const rows: any[] = await db.select({ id: e.table.id }).from(e.table).where(and(inArray(e.table.id, [...new Set(list.map((it) => it.id))]), where))
    for (const r of rows) for (const it of list) if (it.id === r.id && sees(it)) readable.add(`${name}\u0000${r.id}`)
  }
  const visible = items.filter((it) => readable.has(`${it.entity}\u0000${it.id}`))
  return { visible, hidden: items.length - visible.length }
}
