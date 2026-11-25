import { BINDING_ENTRIES_MAX, BINDING_LIMIT_MAX, BINDING_MORE_MAX, type CmsBinding } from '../../src/binding'
import { CUSTOM_PREFIX } from '../../src/model-doc'

// The pure logic behind the control of a block that shows entries of one of the site's own
// content types (`CmsFieldBinding.vue`): which types and fields can be offered, what a stored
// binding names that is gone, and the setters. A setter returns a NEW value, drops what became
// empty and writes only the keys the schema knows (the server refuses the others).

/** One field of a type, as the admin graph lists it. */
export interface CmsBindingField {
  key: string
  type: string
  label: string
  optional?: boolean
  meta?: Record<string, any>
  relation?: { to?: string; kind?: string } | null
}

/** One of the site's own content types, as the admin graph lists it. */
export interface CmsBindingType {
  name: string
  label: any
  titleField: string
  fields: CmsBindingField[]
}

/** The places of a card that take one field each. */
export type CmsBindingPlace = 'image' | 'text' | 'date' | 'label'
export const CMS_BINDING_PLACES: readonly CmsBindingPlace[] = ['image', 'text', 'date', 'label']

/** What a stored binding names that the site does not have. */
export interface CmsBindingMissing {
  /** The content type is not among the site's own. */
  type: boolean
  /** Fields the type does not have (empty when the type is missing: nothing can be told then). */
  fields: { place: CmsBindingPlace | 'more' | 'order'; key: string }[]
}

// Fields the model mapper adds itself: never offered.
const MAPPED = new Set(['slug', 'status', 'position'])
const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)

/** The site's own types (names start with `custom_`) from the admin graph. */
export function cmsBindingTypes(graph: readonly any[] | null | undefined): CmsBindingType[] {
  return (Array.isArray(graph) ? graph : [])
    .filter((e) => typeof e?.name === 'string' && e.name.startsWith(CUSTOM_PREFIX))
    .map((e) => ({
      name: e.name,
      label: e.label,
      titleField: String(e.titleField ?? ''),
      fields: (Array.isArray(e.fields) ? e.fields : []).map((f: any) => ({
        key: f.key, type: f.type, label: f.meta?.label ?? f.key, optional: f.optional, meta: f.meta ?? {}, relation: f.relation ?? null,
      })),
    }))
}

const format = (f: CmsBindingField): string => {
  const x = f.meta?.format
  return typeof x === 'string' && x !== 'plain' ? x : ''
}
const isLong = (f: CmsBindingField) => f.type === 'text' && !!f.meta?.multiline && !format(f)
const isShort = (f: CmsBindingField) => f.type === 'text' && !f.meta?.multiline && !format(f)
const isToOne = (f: CmsBindingField) => !!f.relation && (f.meta?.kind ?? f.relation.kind ?? 'many-to-one') === 'many-to-one'

/** Fields that can go to any place: not the title (the card shows it already), nor the mapper's own. */
function usable(type: CmsBindingType): CmsBindingField[] {
  return type.fields.filter((f) => f.key !== type.titleField && !MAPPED.has(f.key))
}

/**
 * The fields that fit one place:
 * image: a picture (not a file); text: long texts first, then rich text, then short ones (not a colour,
 * e-mail, address or link); date: dates; label: a choice, a short text or a related entry.
 */
export function cmsBindingFieldsFor(type: CmsBindingType, place: CmsBindingPlace): CmsBindingField[] {
  const all = usable(type)
  switch (place) {
    case 'image': return all.filter((f) => f.type === 'media' && !f.meta?.file)
    case 'text': return [...all.filter(isLong), ...all.filter((f) => f.type === 'richtext'), ...all.filter(isShort)]
    case 'date': return all.filter((f) => f.type === 'datetime')
    case 'label': return all.filter((f) => f.type === 'select' || isShort(f) || isToOne(f))
  }
}

/**
 * The fields offered as "more details": short texts, numbers, yes/no, dates, choices and related entries,
 * without the ones already chosen for a place. A colour is left out: a card would show its code.
 */
export function cmsBindingMoreFields(type: CmsBindingType, show: CmsBinding['show'] | null | undefined): CmsBindingField[] {
  const taken = new Set(CMS_BINDING_PLACES.map((p) => show?.[p]).filter((k): k is string => typeof k === 'string'))
  return usable(type).filter((f) => !taken.has(f.key)
    && (isShort(f) || f.type === 'number' || f.type === 'boolean' || f.type === 'datetime' || f.type === 'select' || isToOne(f)))
}

/** The fields a list can be put in order by: what the content API sorts by (never pictures, rich text, links to other entries). */
export function cmsBindingSortFields(type: CmsBindingType): CmsBindingField[] {
  return type.fields.filter((f) => !MAPPED.has(f.key) && !f.relation
    && !['relation', 'media', 'richtext', 'blocks', 'group', 'gallery'].includes(f.type))
}

/** How a field sorts, for the words of the direction. */
export type CmsBindingDirKind = 'date' | 'number' | 'text' | 'other'
export const cmsBindingDirKind = (f: Pick<CmsBindingField, 'type'> | undefined): CmsBindingDirKind =>
  f?.type === 'datetime' ? 'date' : f?.type === 'number' ? 'number' : f?.type === 'text' || f?.type === 'select' ? 'text' : 'other'

/** How a list is put in order: the type's own way, by when it was made, or by a field. */
export type CmsBindingOrderMode = 'own' | 'newest' | 'oldest' | 'field'
export function cmsBindingOrderMode(order: unknown): CmsBindingOrderMode {
  if (!isObject(order) || typeof order.by !== 'string') return 'own'
  if (order.by === 'createdAt' && order.dir === 'desc') return 'newest'
  if (order.by === 'createdAt' && order.dir === 'asc') return 'oldest'
  return 'field'
}

// ── reading a stored value that may be anything ──

/** The stored value cleaned of everything the schema has no place for; null when it is not a binding. */
export function cmsBindingRead(value: unknown): CmsBinding | null {
  if (!isObject(value) || typeof value.type !== 'string' || !value.type) return null
  const out: CmsBinding = { type: value.type }
  if (isObject(value.show)) {
    const show: NonNullable<CmsBinding['show']> = {}
    for (const p of CMS_BINDING_PLACES) if (typeof value.show[p] === 'string' && value.show[p]) show[p] = value.show[p]
    if (Array.isArray(value.show.more)) {
      const more = [...new Set(value.show.more.filter((k: unknown): k is string => typeof k === 'string' && !!k))].slice(0, BINDING_MORE_MAX)
      if (more.length) show.more = more
    }
    if (Object.keys(show).length) out.show = show
  }
  if (isObject(value.order) && typeof value.order.by === 'string' && value.order.by && (value.order.dir === 'asc' || value.order.dir === 'desc')) {
    out.order = { by: value.order.by, dir: value.order.dir }
  }
  if (typeof value.limit === 'number' && Number.isInteger(value.limit) && value.limit >= 1 && value.limit <= BINDING_LIMIT_MAX) out.limit = value.limit
  if (Array.isArray(value.entries)) {
    const entries = [...new Set(value.entries.filter((k: unknown): k is string => typeof k === 'string' && !!k))].slice(0, BINDING_ENTRIES_MAX)
    if (entries.length) out.entries = entries
  }
  return out
}

/** What a stored binding names that the site does not have. Null (no type chosen yet) names nothing. */
export function cmsBindingMissing(value: unknown, types: readonly CmsBindingType[]): CmsBindingMissing {
  const b = cmsBindingRead(value)
  if (!b) return { type: false, fields: [] }
  const type = types.find((x) => x.name === b.type)
  if (!type) return { type: true, fields: [] }
  const has = (key: string) => type.fields.some((f) => f.key === key)
  const fields: CmsBindingMissing['fields'] = []
  for (const p of CMS_BINDING_PLACES) {
    const key = b.show?.[p]
    if (key && !has(key)) fields.push({ place: p, key })
  }
  for (const key of b.show?.more ?? []) if (!has(key)) fields.push({ place: 'more', key })
  const by = b.order?.by
  if (by && by !== 'createdAt' && by !== 'updatedAt' && !has(by)) fields.push({ place: 'order', key: by })
  return { type: false, fields }
}

// ── setters: each returns a new value ──

const tidy = (b: CmsBinding): CmsBinding => {
  const out: CmsBinding = { type: b.type }
  if (b.show) {
    const show: NonNullable<CmsBinding['show']> = {}
    for (const p of CMS_BINDING_PLACES) if (b.show[p]) show[p] = b.show[p]
    if (b.show.more?.length) show.more = b.show.more
    if (Object.keys(show).length) out.show = show
  }
  if (b.order) out.order = b.order
  if (b.limit != null) out.limit = b.limit
  if (b.entries?.length) out.entries = b.entries
  return out
}

/**
 * Chooses the type. Nothing chosen (null) empties the whole value. A new type keeps only the limit:
 * the places, the order and the chosen entries belonged to the old type.
 */
export function cmsBindingSetType(value: unknown, type: string | null): CmsBinding | null {
  if (!type) return null
  const old = cmsBindingRead(value)
  if (old?.type === type) return old
  return tidy({ type, ...(old?.limit != null ? { limit: old.limit } : {}) })
}

/** Puts a field in a place, or (null) takes it out. With no type chosen there is nothing to change. */
export function cmsBindingSetPlace(value: unknown, place: CmsBindingPlace, key: string | null): CmsBinding | null {
  const b = cmsBindingRead(value)
  if (!b) return null
  return tidy({ ...b, show: { ...b.show, [place]: key } })
}

/** Ticks or unticks one more detail (at most `BINDING_MORE_MAX`: a tick beyond that is ignored). */
export function cmsBindingToggleMore(value: unknown, key: string, on: boolean): CmsBinding | null {
  const b = cmsBindingRead(value)
  if (!b) return null
  const now = b.show?.more ?? []
  const more = on ? (now.includes(key) || now.length >= BINDING_MORE_MAX ? now : [...now, key]) : now.filter((k) => k !== key)
  return tidy({ ...b, show: { ...b.show, more } })
}

/** The way a list is put in order; null is the type's own order. */
export function cmsBindingSetOrder(value: unknown, order: { by: string; dir: 'asc' | 'desc' } | null): CmsBinding | null {
  const b = cmsBindingRead(value)
  if (!b) return null
  return tidy({ ...b, order: order ? { by: order.by, dir: order.dir } : null })
}

/** How many entries a list shows: a whole number from 1 to the most; null, empty or nonsense leaves it out (the default). */
export function cmsBindingSetLimit(value: unknown, limit: number | null | undefined): CmsBinding | null {
  const b = cmsBindingRead(value)
  if (!b) return null
  const n = typeof limit === 'number' && Number.isFinite(limit) ? Math.min(BINDING_LIMIT_MAX, Math.max(1, Math.trunc(limit))) : null
  return tidy({ ...b, limit: n })
}

/** The chosen entries, in the picked order (no repeats, at most `BINDING_ENTRIES_MAX`). */
export function cmsBindingSetEntries(value: unknown, ids: readonly string[]): CmsBinding | null {
  const b = cmsBindingRead(value)
  if (!b) return null
  return tidy({ ...b, entries: [...new Set(ids)].slice(0, BINDING_ENTRIES_MAX) })
}

/** One entry one place up or down; the same list when it cannot move. */
export function cmsBindingMoveEntry(ids: readonly string[], index: number, delta: -1 | 1): string[] {
  const to = index + delta
  if (index < 0 || index >= ids.length || to < 0 || to >= ids.length) return [...ids]
  const next = [...ids]
  ;[next[index], next[to]] = [next[to]!, next[index]!]
  return next
}
