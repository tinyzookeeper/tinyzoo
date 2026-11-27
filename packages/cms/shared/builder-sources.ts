// The editor in the preview: content a block draws from elsewhere (since 2f). A block of a page may show
// entries of a collection (the notices valid today, the team, a menu) or the values of a global (the
// opening hours, the site's settings) next to its own fields. The block's component says nothing about it:
// while the tools are on, the page keeps what it loaded through the content API (app/builder/sources.ts),
// and these functions find, in a block, the elements that show an entry's texts and pictures, the smallest
// element that holds one entry (its "card"), and which sources a block draws from. The admin describes the
// collections and globals (their names, their fields' kinds, the field that is an entry's title).
//
// The texts are compared as 2e compares a block's own (shared/builder-match.ts): in the normal form, the
// smallest element whose text is a value. A text that is a value of the block itself belongs to the block,
// never to an entry. A text that two entries share is decided by what is around it: the nearest element
// around it that holds the texts of exactly one of those entries. A text that belongs to nothing (today's
// date, a look's own word) stays the block's: a click there selects the block.
//
// Pure functions of plain values and of anything shaped like a DOM node, tested on a small fake tree
// (test/unit/builder-sources.spec.ts) and used by the overlay (app/builder/overlay.ts).
import {
  cmsMatchElements, cmsMatchFieldsWith, cmsMatchPlacesInText, cmsMatchShown, cmsMatchSquash, cmsMatchValue, cmsRichPlain, isCmsRichDoc,
  type CmsMatchField, type CmsMatchNode,
} from './builder-match'
import { cmsFormKey, cmsValueForms, cmsValueMatch, type CmsValueField, type CmsValueIndex, type CmsValuePath } from './builder-values'

// ── what the admin says about a collection or a global ──

/**
 * A field of a collection or a global as the page needs it: a plain text, a rich text, a picture, or a
 * relation (`to`: the collection whose entries the content API puts in it), and its name.
 */
export interface CmsBuilderEntityField {
  /** Since 2g also a value that is no text (`value`), a list of items (`list`) and a group of fields (`group`). */
  kind: 'text' | 'rich' | 'picture' | 'relation' | 'value' | 'list' | 'group'
  to?: string
  label?: string
  /** Since 2g: a plain text is typed in the page: one line or several, and its maximum. A text without it (an address, a link) is edited in its own control. */
  text?: 'line' | 'lines'
  max?: number
  /** Since 2g, for `value`: a number, a date and time, or a choice, with each option's names in every language the admin has. */
  value?: 'number' | 'date' | 'choice'
  options?: Record<string, string[]>
  /** Since 2g, for `list`: the fields of its items, by the item's type; for `group`: its fields, under `''`. */
  items?: Record<string, Record<string, CmsBuilderEntityField>>
  /** Since 2g: this person may not change the field here (their role, or a field of all languages while a translation is shown). */
  locked?: boolean
}

/** A collection or a global, in the admin's words, for content a block draws from it. */
export interface CmsBuilderEntity {
  /** Its name in the admin ("Oznámení", "Ordinační hodiny"). */
  label: string
  /** A global (one set of values), not a collection of entries. */
  global?: boolean
  /** The field that is an entry's title. */
  title?: string | null
  /** How it is published: the status field and its published value, and the date it goes live. */
  publish?: { field: string; published: string; date?: string | null } | null
  /** Its plain texts, rich texts and pictures, by name. */
  fields: Record<string, CmsBuilderEntityField>
  /** Whether the person may change its entries (its values), and add an entry. */
  edit?: boolean
  create?: boolean
}

/** An entry a block shows, as the panel lists it. */
export interface CmsBuilderSourceEntry {
  id: string
  title: string
  /** Not on the website as it is: a draft, or published from a date ahead. */
  state?: 'draft' | 'scheduled' | null
}

/**
 * Where a block's content comes from: a collection or a global, and the entries it shows now. None: it
 * shows nothing of it now, or (`unmatched`) it draws something of it that the page cannot tell apart entry
 * by entry (a text made from the values: the hours of a week written as spans).
 */
export interface CmsBuilderSource {
  entity: string
  entries: CmsBuilderSourceEntry[]
  unmatched?: true
}

/** What the page loaded of a collection or a global through the content API: its entries by id, with their values. */
export interface CmsSourceRecord {
  entity: string
  global: boolean
  entries: Map<string, Record<string, unknown>>
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const NAME = /^[A-Za-z_$][\w$]{0,63}$/

// ── the admin's side ──

/**
 * Since 2f: the address of an entry in the admin (a global: its form; `id: null`: a new entry), and with
 * `embed` the same page as the sheet beside the page shows it (the editor without the admin around it).
 */
export function cmsBuilderEntryAddress(entity: string, id: string | null, global: boolean, embed?: { field?: string | null }): string {
  const base = global ? `/admin/${encodeURIComponent(entity)}` : `/admin/${encodeURIComponent(entity)}/${id === null ? 'new' : encodeURIComponent(id)}`
  if (!embed) return base
  const query = new URLSearchParams({ embed: 'builder' })
  if (embed.field) query.set('field', embed.field)
  return `${base}?${query}`
}

/** The admin's field types the page can find by their text (`text`), as a rich text (`rich`) or by a picture's address. */
const SOURCE_KINDS: Record<string, 'text' | 'rich' | 'picture'> = { text: 'text', richtext: 'rich', media: 'picture', gallery: 'picture' }
/** Since 2g: the field types whose value is drawn in a form of its own. */
const VALUE_KINDS: Record<string, 'number' | 'date' | 'choice'> = { number: 'number', datetime: 'date', select: 'choice' }

/** Every way a name is written: a text, or one per language. */
function namesOf(label: unknown): string[] {
  if (typeof label === 'string') return label ? [label] : []
  return isObject(label) ? Object.values(label).filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 500) : []
}

/**
 * The fields of a collection, of a list's item or of a group as the page needs them (since 2g with what a
 * plain text takes, what a value is, and the fields inside a list and a group, `depth` levels down).
 */
function entityFields(list: any[], words: { field: (field: any) => string }, o: { top: boolean; depth: number; skip: Set<string>; locked: (f: any) => boolean }): Record<string, CmsBuilderEntityField> {
  const out: Record<string, CmsBuilderEntityField> = {}
  for (const f of list) {
    if (!f || typeof f.key !== 'string' || !NAME.test(f.key) || o.skip.has(f.key)) continue
    const more = { label: words.field(f), ...(f.readOnly || o.locked(f) ? { locked: true } : {}) }
    const kind = SOURCE_KINDS[f.type]
    const value = VALUE_KINDS[f.type]
    if (f.relation) {
      if (o.top && f.relation.to && f.relation.kind !== 'one-to-many') out[f.key] = { kind: 'relation', to: f.relation.to, label: more.label }
    }
    else if (kind === 'text') {
      // A colour is drawn as a colour, not as its text.
      if (f.ui?.edit === 'CmsFieldColor') continue
      const max = typeof f.meta?.max === 'number' && f.meta.max > 0 ? Math.floor(f.meta.max) : undefined
      out[f.key] = { kind, ...more, ...(f.meta?.format ? {} : { text: f.meta?.multiline ? 'lines' as const : 'line' as const, ...(max ? { max } : {}) }) }
    }
    else if (kind === 'rich' || (kind === 'picture' && o.top)) out[f.key] = { kind, ...more }
    else if (value) {
      const options: Record<string, string[]> = {}
      if (value === 'choice') for (const option of Array.isArray(f.meta?.options) ? f.meta.options : []) if (typeof option === 'string') options[option] = namesOf(f.meta?.labels?.[option]).slice(0, 20)
      out[f.key] = { kind: 'value', value, ...more, ...(value === 'choice' ? { options } : {}) }
    }
    else if (f.type === 'blocks' && f.meta?.list && isObject(f.meta.blocks) && o.depth > 0) {
      const items: Record<string, Record<string, CmsBuilderEntityField>> = {}
      for (const [type, def] of Object.entries(f.meta.blocks)) if (isObject(def) && Array.isArray(def.fields)) items[type] = entityFields(def.fields, words, { ...o, top: false, depth: o.depth - 1, skip: new Set() })
      out[f.key] = { kind: 'list', ...more, items }
    }
    else if (f.type === 'group' && Array.isArray(f.meta?.fields) && o.depth > 0) {
      out[f.key] = { kind: 'group', ...more, items: { '': entityFields(f.meta.fields, words, { ...o, top: false, depth: o.depth - 1, skip: new Set() }) } }
    }
  }
  return out
}

/**
 * Since 2f: the collections and globals of the admin's graph as the page needs them for content a block draws
 * from them: their names, their plain texts, rich texts and pictures, the title field, how they are
 * published, and what the person may do (the graph's `can`, the same the lists and the editor check).
 */
export function cmsBuilderEntities(
  graph: any[] | null | undefined,
  words: { entity: (meta: any) => string; field: (field: any) => string },
  /** Since 2g: the preview shows a translation (`translating`): only the fields that are per-language can be changed in it. */
  options: { translating?: boolean } = {},
): Record<string, CmsBuilderEntity> {
  const out: Record<string, CmsBuilderEntity> = {}
  for (const meta of graph ?? []) {
    if (!meta?.name || !Array.isArray(meta.fields)) continue
    const p = meta.publish
    // The order is set by arranging the list; the status and the date it goes live by publishing.
    const skip = new Set<string>([meta.orderField, p?.field].filter((k): k is string => typeof k === 'string'))
    const fields = entityFields(meta.fields, words, { top: true, depth: 2, skip, locked: (f) => (!!options.translating && !f.localized) || (!!p?.dateField && f.key === p.dateField) })
    if (!Object.values(fields).some((f) => f.kind !== 'relation')) continue
    out[meta.name] = {
      label: words.entity(meta) || meta.name,
      ...(meta.singleton ? { global: true } : {}),
      title: meta.titleField ?? null,
      publish: p?.field && typeof p.publishedValue === 'string' ? { field: p.field, published: p.publishedValue, date: p.dateField ?? null } : null,
      fields,
      edit: meta.can?.update !== false,
      create: !meta.singleton && meta.can?.create !== false && meta.adminCreate !== false,
    }
  }
  return out
}

/**
 * Since 2g: what the admin says of the field at a path of an entry: the field, a field of a list's item
 * (found by the item's type in the entry's values) or of a group. `null` when the path leads nowhere.
 */
export function cmsEntityFieldAt(info: CmsBuilderEntity | undefined, values: Record<string, unknown> | undefined, at: readonly string[]): CmsBuilderEntityField | null {
  let fields: Record<string, CmsBuilderEntityField> | undefined = info?.fields
  let value: unknown = values
  let field: CmsBuilderEntityField | null = null
  for (const step of at) {
    if (Array.isArray(value)) {
      const item = value.find((x) => isObject(x) && x.id === step) as Record<string, unknown> | undefined
      const type = typeof item?.type === 'string' ? item.type : ''
      fields = field?.kind === 'list' && field.items && Object.hasOwn(field.items, type) ? field.items[type] : undefined
      if (!item || !fields) return null
      value = item
      field = null
      continue
    }
    field = fields && Object.hasOwn(fields, step) ? fields[step]! : null
    if (!field || !isObject(value)) return null
    value = value[step]
    if (field.kind === 'group') fields = field.items?.['']
  }
  return field
}

/** Since 2f: what the editor in the sheet beside the page tells the sheet (same origin, from the frame to its parent; app/composables/useCmsEmbedded.ts). */
export type CmsEmbedMessage =
  | { type: 'cms:entry:state'; entity: string; id: string | null; dirty: boolean; saving: boolean; title: string }
  | { type: 'cms:entry:saved'; entity: string; id: string }
  | { type: 'cms:entry:draft'; entity: string; id: string }

/** A message of the editor in the sheet. */
export function isCmsEmbedMessage(x: unknown): x is CmsEmbedMessage {
  if (!x || typeof x !== 'object') return false
  const m = x as Record<string, unknown>
  if (typeof m.entity !== 'string') return false
  if (m.type === 'cms:entry:state') return (m.id === null || typeof m.id === 'string') && typeof m.dirty === 'boolean' && typeof m.saving === 'boolean' && typeof m.title === 'string'
  return (m.type === 'cms:entry:saved' || m.type === 'cms:entry:draft') && typeof m.id === 'string'
}

/** Since 2g: what the sheet tells the editor in it (same origin, from the sheet to its frame): values to put into the form, each at its path. */
export interface CmsEmbedSet { type: 'cms:entry:set'; sets: { at: CmsValuePath; value: unknown }[] }

export function isCmsEmbedSet(x: unknown): x is CmsEmbedSet {
  if (!isObject(x) || x.type !== 'cms:entry:set' || !Array.isArray(x.sets) || x.sets.length > 200) return false
  return x.sets.every((s) => isObject(s) && Array.isArray(s.at) && s.at.length >= 1 && s.at.length <= 6 && s.at.every((p) => typeof p === 'string' && p.length > 0 && p.length <= 200) && NAME.test(s.at[0] as string) && 'value' in s)
}

// ── the content API's requests and answers ──

/**
 * What a request of the content API reads, from its address: a collection (its list, or one entry by
 * its address) or a global. Not a request of the content API (another path, another site), or one of its
 * own routes (`_search`, `_sitemap`, `_tree`, `_types`): `null`. The app may live under a base path.
 */
export function cmsContentRequest(url: string, origin: string): { entity: string; global: boolean } | null {
  let u: URL
  try {
    u = new URL(url, origin)
  }
  catch {
    return null
  }
  if (u.origin !== origin) return null
  const at = u.pathname.indexOf('/api/content/')
  if (at < 0) return null
  const parts = u.pathname.slice(at + '/api/content/'.length).split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p)
    }
    catch {
      return p
    }
  })
  if (parts[0] === '_global') return parts.length === 2 && NAME.test(parts[1]!) ? { entity: parts[1]!, global: true } : null
  if (!parts[0] || parts[0].startsWith('_') || !NAME.test(parts[0]) || parts.length > 2) return null
  return { entity: parts[0], global: false }
}

/** The same address asking for an editor's preview (`?preview`): what the editor has typed and not saved shows in it. */
export function cmsContentWithPreview(url: string, origin: string): string {
  let u: URL
  try {
    u = new URL(url, origin)
  }
  catch {
    return url
  }
  if (u.searchParams.has('preview')) return url
  u.searchParams.set('preview', '')
  const out = `${u.pathname}${u.search.replace(/([?&])preview=(&|$)/, '$1preview$2')}${u.hash}`
  return /^[a-z][a-z\d+.-]*:\/\//i.test(url) || url.startsWith('//') ? `${u.origin}${out}` : out
}

/** The entries in an answer of the content API: `{ items }` of a list, `{ item }` of an entry or a global. */
export function cmsContentEntries(body: unknown): Record<string, unknown>[] {
  if (!isObject(body)) return []
  if (Array.isArray(body.items)) return body.items.filter(isObject)
  return isObject(body.item) ? [body.item] : []
}

// ── an entry's title and state ──

/** An entry's title as the admin shows it: its title field, else the word for an entry without one. A global: its name. */
export function cmsSourceTitle(values: Record<string, unknown>, info: CmsBuilderEntity | undefined, untitled: string): string {
  if (info?.global) return info.label
  const v = info?.title ? values[info.title] : undefined
  const text = typeof v === 'string' ? cmsMatchValue(v) : isCmsRichDoc(v) ? cmsRichPlain(v) : typeof v === 'number' ? String(v) : ''
  return text || untitled
}

/** Whether an entry is not on the website as it is: a draft, or published from a date ahead. */
export function cmsSourceState(values: Record<string, unknown>, info: CmsBuilderEntity | undefined, now = Date.now()): 'draft' | 'scheduled' | null {
  const p = info?.publish
  if (!p || !(p.field in values)) return null
  if (values[p.field] !== p.published) return 'draft'
  const date = p.date ? values[p.date] : null
  const at = typeof date === 'string' || typeof date === 'number' ? new Date(date).getTime() : Number.NaN
  return Number.isFinite(at) && at > now ? 'scheduled' : null
}

// ── the texts and pictures of entries ──

/** A text or a picture of an entry (or of a global) that a block shows. */
export interface CmsSourcePart {
  entity: string
  id: string
  /** The entry's field (for a value inside a list or a group: the field that holds it). */
  field: string
  /** Since 2g also `value`: a value that is no text, or several values the element shows together. */
  kind: 'text' | 'rich' | 'picture' | 'value'
  /** Since 2g: where the text is inside the entry, when it is not a field of its own (an item of a list). */
  at?: CmsValuePath
  /** Since 2g, for `value`: every value the element shows, in the text's order. */
  values?: CmsValuePath[]
}

/** An entry's picture field and the addresses of what it holds. */
export interface CmsSourcePicture {
  entity: string
  id: string
  field: string
  urls: string[]
  ids: string[]
}

const isMedia = (x: unknown): x is { id?: unknown; url: string } => isObject(x) && typeof x.url === 'string' && x.url.length > 0

/**
 * The page's records with the entries the content API put inside them through a relation (a lesson's
 * teacher, a fixture's team): each is an entry of its own collection, as if loaded on its own. An entry
 * loaded on its own keeps its values; one level deep.
 */
export function cmsSourceWithRelated(records: Map<string, CmsSourceRecord>, entities: Record<string, CmsBuilderEntity>): Map<string, CmsSourceRecord> {
  const out = new Map<string, CmsSourceRecord>()
  for (const [name, r] of records) out.set(name, { entity: r.entity, global: r.global, entries: new Map(r.entries) })
  for (const record of records.values()) {
    const info = Object.hasOwn(entities, record.entity) ? entities[record.entity] : undefined
    if (!info) continue
    const relations = Object.entries(info.fields).filter(([, f]) => f.kind === 'relation' && f.to && Object.hasOwn(entities, f.to))
    if (!relations.length) continue
    for (const values of record.entries.values()) {
      for (const [key, f] of relations) {
        for (const x of Array.isArray(values[key]) ? values[key] as unknown[] : [values[key]]) {
          if (!isObject(x) || typeof x.id !== 'string' || !x.id) continue
          const target = out.get(f.to!) ?? { entity: f.to!, global: false, entries: new Map() }
          if (!target.entries.has(x.id)) target.entries.set(x.id, x)
          out.set(f.to!, target)
        }
      }
    }
  }
  return out
}

/**
 * The texts and pictures of everything the page loaded, as the matcher reads them: a field of an entry is a
 * field of an item (`item`: the entry's id) of a list named after its collection (`list`: the collection),
 * so 2e's rules for the items of a list hold. The page's own entry (`self`, the page being edited) is left
 * out: its blocks are the block's own. Only what the admin describes counts (a collection it does not
 * know, a field that is no text or picture: nothing).
 *
 * Since 2g also the texts inside an entry's lists and groups (`at`: where), and `values`: every plain text
 * and every value that is no text (a number, a date, a choice) with the forms it may be drawn in
 * (`langs`: the page's languages), for a text made of values (shared/builder-values.ts).
 */
export function cmsSourceFields(
  records: Iterable<CmsSourceRecord>, entities: Record<string, CmsBuilderEntity>, self?: { entity: string; id: string } | null, langs: readonly string[] = [],
): { texts: CmsMatchField[]; pictures: CmsSourcePicture[]; values: CmsValueField[] } {
  const texts: CmsMatchField[] = []
  const pictures: CmsSourcePicture[] = []
  const values: CmsValueField[] = []
  for (const record of records) {
    const info = Object.hasOwn(entities, record.entity) ? entities[record.entity] : undefined
    if (!info) continue
    for (const [id, row] of record.entries) {
      if (self && self.entity === record.entity && self.id === id) continue
      const walk = (holder: Record<string, unknown>, fields: Record<string, CmsBuilderEntityField>, at: string[], depth: number) => {
        for (const [key, f] of Object.entries(fields)) {
          const value = holder[key]
          const path = [...at, key]
          const field = path[0]!
          const inside = at.length ? { at: path } : {}
          if (f.kind === 'text' && typeof value === 'string') {
            const norm = cmsMatchValue(value)
            if (!norm) continue
            texts.push({ field, item: id, list: record.entity, kind: 'text', norm, text: /\n/.test(value) ? 'lines' : 'line', ...inside })
            const form = cmsFormKey(norm)
            if (form) values.push({ entity: record.entity, id, at: path, kind: 'text', keys: [form] })
          }
          else if (f.kind === 'rich' && isCmsRichDoc(value)) {
            const norm = cmsRichPlain(value)
            if (norm) texts.push({ field, item: id, list: record.entity, kind: 'rich', norm, ...inside })
          }
          else if (f.kind === 'picture' && !at.length) {
            const all = (Array.isArray(value) ? value : [value]).map((x) => (isObject(x) && isMedia(x.media) ? x.media : x)).filter(isMedia)
            if (all.length) pictures.push({ entity: record.entity, id, field, urls: all.map((m) => m.url), ids: all.map((m) => (typeof m.id === 'string' ? m.id : '')).filter(Boolean) })
          }
          else if (f.kind === 'value') {
            const keys = cmsValueForms(value, f, langs)
            if (keys.length) values.push({ entity: record.entity, id, at: path, kind: 'value', keys })
          }
          else if (f.kind === 'list' && Array.isArray(value) && depth < 3) {
            for (const item of value) {
              const inner = isObject(item) && typeof item.id === 'string' && item.id && typeof item.type === 'string' && f.items && Object.hasOwn(f.items, item.type) ? f.items[item.type] : undefined
              if (inner) walk(item as Record<string, unknown>, inner, [...path, (item as { id: string }).id], depth + 1)
            }
          }
          else if (f.kind === 'group' && isObject(value) && f.items?.[''] && depth < 3) walk(value, f.items[''], path, depth + 1)
        }
      }
      walk(row, info.fields, [], 0)
    }
  }
  return { texts, pictures, values }
}

/** The path of an address, without its origin, query and hash. */
function pathOf(url: string): string {
  return url.trim().replace(/^[a-z][a-z\d+.-]*:\/\/[^/]+/i, '').replace(/^\/\/[^/]+/, '').replace(/[?#].*$/, '')
}

/** The entry picture an image shows, from its addresses; `null` when none, or when two entries have it. */
export function cmsSourcePictureOf(sources: string[], pictures: CmsSourcePicture[]): CmsSourcePicture | null {
  const paths = sources.filter(Boolean).map(pathOf).filter(Boolean)
  if (!paths.length) return null
  const hits = pictures.filter((p) => p.urls.some((u) => paths.includes(pathOf(u))) || p.ids.some((id) => paths.some((x) => x.includes(`/${id}/`) || x.endsWith(`/${id}`))))
  const keys = new Set(hits.map((h) => `${h.entity}\n${h.id}`))
  return keys.size === 1 ? hits[0]! : null
}

// ── finding them in a block ──

/** An entry a block shows: the elements that hold it (its card; one, or a few when its texts stand among another entry's). */
export interface CmsSourceCard<N> {
  entity: string
  id: string
  els: N[]
}

export interface CmsSourceFound<N> {
  /** Each element (or text node beside other content) that shows a text or a picture of an entry. */
  parts: Map<N, CmsSourcePart>
  /** The entries the block shows, in the page's order, each with its card. */
  cards: CmsSourceCard<N>[]
  /** The elements that show a text of the block itself. */
  own: N[]
}

function contains(outer: CmsMatchNode, inner: CmsMatchNode): boolean {
  for (let n: CmsMatchNode | null = inner; n; n = n.parentNode) if (n === outer) return true
  return false
}
const isElement = (n: CmsMatchNode) => n.nodeType === 1
const attr = (n: CmsMatchNode, name: string) => n.getAttribute?.(name) ?? null
const elementChildren = (n: CmsMatchNode): CmsMatchNode[] => Array.from(n.childNodes).filter(isElement)
const partKey = (p: { entity: string; id: string }) => `${p.entity}\n${p.id}`
const fieldKey = (f: CmsMatchField) => `${f.list}\n${f.item}`

/** Whether a node is inside an element a site marks for a field of the block (`cmsField()`): the block's own. */
function marked<N extends CmsMatchNode>(n: N, roots: N[]): boolean {
  for (let at: CmsMatchNode | null = n; at; at = at.parentNode) {
    const field = isElement(at) ? attr(at, 'data-cms-field') : null
    if (field && field !== 'off') return true
    if (roots.includes(at as N)) return false
  }
  return false
}

/** The smallest parts of a block that show a text: elements none of whose children has the same text, and text nodes beside other content. */
function smallest<N extends CmsMatchNode>(roots: N[], text: (n: N) => string, visible: (n: N) => boolean, all = cmsMatchElements(roots, { texts: true, text })): { el: N; text: string }[] {
  const out: { el: N; text: string }[] = []
  for (const el of all) {
    if (!visible(el.nodeType === 3 ? el.parentNode as N : el)) continue
    const t = text(el)
    if (!t) continue
    if (el.nodeType === 1 && elementChildren(el).some((c) => text(c as N) === t)) continue
    out.push({ el, text: t })
  }
  return out
}

/**
 * The entries a block shows and where. Each smallest element whose text is a value of exactly one entry
 * (and of nothing of the block's own, `own`) shows that entry's field; a text of several entries is the
 * entry whose other texts stand nearest around it (the smallest element around it that holds parts of one of
 * them only). An image is an entry's picture by its address (`picture`). An entry's card is the smallest
 * element around all its parts, taken up to the largest element that holds nothing else that is found but
 * entries put inside it through a relation (`related`: a lesson's teacher) (its
 * picture, its date line and its label come with it, also when only one of its texts is found); when that
 * smallest element holds a
 * part of another entry of the same collection (a list drawn as a table of titles and texts), parts of two
 * entries of another one (a teacher's name in each lesson of a timetable), or is the
 * block itself, each of its parts is a card piece of its own, as large as it can be without holding
 * anything else that is found.
 */
export function cmsSourceFind<N extends CmsMatchNode>(
  roots: N[],
  texts: CmsMatchField[],
  options: {
    own?: CmsMatchField[]; text?: (n: N) => string; visible?: (n: N) => boolean; picture?: (n: N) => CmsSourcePicture | null
    /** Whether entries of `child` are put inside entries of `parent` through a relation: they may stand inside its card. */
    related?: (parent: string, child: string) => boolean
    /** The collections the block loads itself: a text that entries of two collections share goes to one of these when nothing around it tells. */
    prefer?: ReadonlySet<string>
    /** Since 2g: the values of everything the page loaded, for a text that is no value as it is stored but is made of values. */
    values?: CmsValueIndex
    /** Since 2g: whether something found may count in this block (a text inside a list of a global: only where the block loads that global). */
    allow?: (part: CmsSourcePart) => boolean
  } = {},
): CmsSourceFound<N> {
  const text = options.text ?? cmsMatchShown
  const visible = options.visible ?? (() => true)
  const ownFields = options.own ?? []
  const parts = new Map<N, CmsSourcePart>()
  const own: N[] = []
  const order = new Map<N, number>()
  /** For each text that could be an entry's: the entries it could be of, each with what it would be there. */
  const cands = new Map<N, Map<string, CmsSourcePart>>()
  const all = cmsMatchElements(roots, { texts: true, text })
  all.forEach((n, i) => order.set(n, i))
  const pieces = smallest(roots, text, visible, all)
  // Images are leaves without text: asked for their picture.
  if (options.picture) {
    for (const el of all) {
      if (el.nodeType !== 1 || el.nodeName.toUpperCase() !== 'IMG' || !visible(el)) continue
      const p = options.picture(el)
      if (p) parts.set(el, { entity: p.entity, id: p.id, field: p.field, kind: 'picture' })
    }
  }
  for (const { el, text: t } of pieces) {
    if (marked(el, roots) || (ownFields.length && (cmsMatchFieldsWith(ownFields, t).length || (el.nodeType === 3 && cmsMatchPlacesInText(t, ownFields).length)))) {
      own.push(el)
      continue
    }
    const of = new Map<string, CmsSourcePart>()
    const allowed = (part: CmsSourcePart) => !options.allow || options.allow(part)
    for (const h of cmsMatchFieldsWith(texts, t)) {
      if ((el.nodeType === 3 && h.kind !== 'text') || of.has(fieldKey(h))) continue
      const part: CmsSourcePart = { entity: h.list!, id: h.item!, field: h.field, kind: h.kind, ...(h.at ? { at: h.at } : {}) }
      if (allowed(part)) of.set(fieldKey(h), part)
    }
    // No value as it is stored: a value in another form (a number, a date, a choice's name), or several values
    // in a row. Only for a text of its own (nothing inside it has a text of its own): an element around
    // several texts is not one value with words around it.
    if (!of.size && options.values && (el.nodeType === 3 || !elementChildren(el).some((c) => !!text(c as N)))) {
      for (const hit of cmsValueMatch(t, options.values)) {
        const part: CmsSourcePart = { entity: hit.entity, id: hit.id, field: hit.values[0]!.at[0]!, kind: 'value', values: hit.values.map((v) => v.at) }
        if (allowed(part)) of.set(`${hit.entity}\n${hit.id}`, part)
      }
    }
    if (!of.size) continue
    cands.set(el, of)
    if (of.size === 1) parts.set(el, [...of.values()][0]!)
  }
  const deferred = [...cands].filter(([, of]) => of.size > 1)
  // A text several entries could have made is decided by what stands around it. Since 2g first by every
  // text around it that only some of those entries could have made (the day's name beside the hours of that
  // day, the hours beside a note), from the nearest element around it outwards: each narrows the entries
  // down; texts at one level that disagree with each other settle nothing, and nothing further out is asked.
  const disputed = new Set<N>()
  if (deferred.length) {
    const within = new Map<N, N[]>()
    for (const el of cands.keys()) {
      for (let at = el.parentNode as N | null; at; at = at.parentNode as N | null) {
        const list = within.get(at)
        if (list) list.push(el)
        else within.set(at, [el])
        if (roots.includes(at)) break
      }
    }
    const settled: [N, CmsSourcePart][] = []
    for (const [el, of] of deferred) {
      let keys = new Set(of.keys())
      for (let at = el.parentNode as N | null; at && keys.size > 1; at = at.parentNode as N | null) {
        let narrowed: Set<string> | null = null
        for (const other of within.get(at) ?? []) {
          if (other === el) continue
          const theirs = cands.get(other)!
          const both = [...keys].filter((k) => theirs.has(k))
          if (!both.length || both.length === keys.size) continue
          narrowed = narrowed ? new Set(both.filter((k) => narrowed!.has(k))) : new Set(both)
        }
        if (narrowed) {
          if (!narrowed.size) {
            disputed.add(el)
            break
          }
          keys = narrowed
        }
        if (roots.includes(at)) break
      }
      if (keys.size === 1) settled.push([el, of.get([...keys][0]!)!])
    }
    for (const [el, part] of settled) parts.set(el, part)
  }
  // Then, as since 2f: the entry whose parts (found without doubt) stand nearest around it.
  const sure = new Map([...parts].filter(([el]) => (cands.get(el)?.size ?? 1) === 1))
  for (const [el, of] of deferred) {
    if (parts.has(el) || disputed.has(el)) continue
    for (let at = el.parentNode as N | null; at; at = at.parentNode as N | null) {
      const inside = new Set<string>()
      for (const [p, part] of sure) if (of.has(partKey(part)) && contains(at, p)) inside.add(partKey(part))
      if (inside.size === 1) {
        parts.set(el, of.get([...inside][0]!)!)
        break
      }
      if (inside.size > 1 || roots.includes(at)) break
    }
  }
  // Nothing around it tells: the one entry of a collection the block loads itself, if there is one.
  if (options.prefer) {
    for (const [el, of] of deferred) {
      if (parts.has(el)) continue
      const mine = [...of.values()].filter((p) => options.prefer!.has(p.entity))
      if (mine.length === 1) parts.set(el, mine[0]!)
    }
  }
  // The cards, in the page's order of their first part.
  const sorted = [...parts.entries()].sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
  const byKey = new Map<string, { entity: string; id: string; els: N[] }>()
  for (const [el, part] of sorted) {
    const key = partKey(part)
    const at = byKey.get(key) ?? { entity: part.entity, id: part.id, els: [] }
    at.els.push(el.nodeType === 3 ? el.parentNode as N : el)
    byKey.set(key, at)
  }
  const inRoots = (n: CmsMatchNode) => roots.some((r) => contains(r, n))
  const cards: CmsSourceCard<N>[] = []
  for (const [key, { entity, id, els }] of byKey) {
    const sameEntity = sorted.filter(([, p]) => p.entity === entity && partKey(p) !== key).map(([el]) => el)
    const foreign = [...sorted.filter(([, p]) => partKey(p) !== key && (p.entity === entity || !options.related?.(entity, p.entity))).map(([el]) => el), ...own]
    let lca: N = els[0]!
    for (const el of els.slice(1)) while (!contains(lca, el) && lca.parentNode) lca = lca.parentNode as N
    // Inside the smallest element around its parts: entries of other collections, but for those put inside it through a relation.
    const others = new Map<string, Set<string>>()
    for (const [el, p] of sorted) {
      if (p.entity === entity || options.related?.(entity, p.entity) || !contains(lca, el)) continue
      others.set(p.entity, (others.get(p.entity) ?? new Set()).add(p.id))
    }
    const many = [...others.values()].some((ids) => ids.size > 1)
    if (!roots.includes(lca) && inRoots(lca) && !many && !sameEntity.some((o) => contains(lca, o)) && !own.some((o) => contains(lca, o))) {
      // Up to the largest element that holds nothing else that is found: the card with its picture, its
      // date line and its label, also when only one of its texts is found.
      let card = lca
      while (card.parentNode && !roots.includes(card.parentNode as N) && inRoots(card.parentNode) && !foreign.some((o) => contains(card.parentNode as N, o))) card = card.parentNode as N
      cards.push({ entity, id, els: [card] })
      continue
    }
    // Its parts stand among other things: each as large as it can be without holding anything else found.
    const pieces: N[] = []
    for (const el of els) {
      let at = el
      while (!roots.includes(at) && at.parentNode && !roots.includes(at.parentNode as N) && !foreign.some((o) => contains(at.parentNode as N, o))) at = at.parentNode as N
      if (!pieces.some((p) => contains(p, at))) {
        for (let i = pieces.length - 1; i >= 0; i--) if (contains(at, pieces[i]!)) pieces.splice(i, 1)
        pieces.push(at)
      }
    }
    cards.push({ entity, id, els: pieces })
  }
  return { parts, cards, own }
}

/** The card a node is in (the innermost one, when a card holds another entry's). */
export function cmsSourceCardAt<N extends CmsMatchNode>(found: CmsSourceFound<N>, target: N | null): CmsSourceCard<N> | null {
  if (!target) return null
  let best: CmsSourceCard<N> | null = null
  let depth = -1
  for (const card of found.cards) {
    for (const el of card.els) {
      if (!contains(el, target)) continue
      let d = 0
      for (let n: CmsMatchNode | null = el; n; n = n.parentNode) d++
      if (d > depth) { best = card; depth = d }
    }
  }
  return best
}

/** The part a node is in: the node itself, or the nearest element around it that shows an entry's text or picture. */
export function cmsSourcePartAt<N extends CmsMatchNode>(found: CmsSourceFound<N>, target: N | null): { el: N; part: CmsSourcePart } | null {
  for (let n = target; n; n = n.parentNode as N | null) {
    const part = found.parts.get(n)
    if (part) return { el: n, part }
  }
  return null
}

/**
 * The sources of a block: each collection or global it shows, with the entries it shows (in the page's
 * order), then each collection it loads (`known`, from its own requests) that it shows no entry of: when the
 * block draws something (`blank`: it draws nothing) and the page loaded entries of it, it draws them in a
 * way the page cannot tell apart (`unmatched`). A global counts only when shown: every block reads the
 * site's settings for its look.
 */
export function cmsSourcesOf<N extends CmsMatchNode>(
  found: CmsSourceFound<N>, known: string[], records: Map<string, CmsSourceRecord>, entities: Record<string, CmsBuilderEntity>, untitled: string, now = Date.now(), blank = false,
): CmsBuilderSource[] {
  const out = new Map<string, CmsBuilderSource>()
  for (const card of found.cards) {
    const info = Object.hasOwn(entities, card.entity) ? entities[card.entity] : undefined
    if (!info) continue
    const source = out.get(card.entity) ?? { entity: card.entity, entries: [] }
    if (!source.entries.some((e) => e.id === card.id)) {
      const values = records.get(card.entity)?.entries.get(card.id) ?? {}
      const state = cmsSourceState(values, info, now)
      source.entries.push({ id: card.id, title: cmsSourceTitle(values, info, untitled), ...(state ? { state } : {}) })
    }
    out.set(card.entity, source)
  }
  for (const entity of known) {
    const info = Object.hasOwn(entities, entity) ? entities[entity] : undefined
    if (!info || info.global || out.has(entity)) continue
    out.set(entity, { entity, entries: [], ...(!blank && (records.get(entity)?.entries.size ?? 0) > 0 ? { unmatched: true as const } : {}) })
  }
  return [...out.values()]
}

// ── what the texts of a block resolve to (for the measuring script) ──

/** What a visible text of a block is: a field of the block, of an entry, of a global, or nothing. */
export type CmsTextResolution = 'own' | 'entry' | 'global' | 'none'
/** Since 2g: how an entry's or a global's text was found: as the value it is stored as, or (`value`) by a form of a value or as several values in a row. */
export type CmsTextBy = 'value'
/** What a text that is nothing is like: a date or a time, a number, a text made from a value (shortened, joined), a part of a form, or a look's own word. */
export type CmsTextRest = 'date' | 'number' | 'derived' | 'form' | 'word'

const DATE = /\b\d{1,2}\.\s?\d{1,2}\.|\b\d{1,2}:\d{2}\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:pondělí|úterý|středa|středu|čtvrtek|pátek|sobota|sobotu|neděle|neděli|monday|tuesday|wednesday|thursday|friday|saturday|sunday|leden|ledna|únor|února|březen|března|duben|dubna|květen|května|červen|června|červenec|července|srpen|srpna|září|říjen|října|listopad|listopadu|prosinec|prosince|january|february|march|april|june|july|august|september|october|november|december)\b/iu
const NUMBER = /^[\s\d.,:/%+\-–—×x()€$£Kčkč]+$/u

/** The kind of a text that is no value: a date or a time, a number, made from a value (`values`), in a form, else a word. */
export function cmsTextRest(text: string, values: string[], inForm = false): CmsTextRest {
  if (inForm) return 'form'
  if (DATE.test(text)) return 'date'
  if (NUMBER.test(text)) return 'number'
  const t = text.toLocaleLowerCase('cs')
  if (t.length >= 3 && values.some((v) => v.length >= 3 && (t.includes(v.toLocaleLowerCase('cs')) || v.toLocaleLowerCase('cs').includes(t)))) return 'derived'
  return 'word'
}

/**
 * Every visible text of a block (an element with a text and nothing inside it with a text of its own, or a
 * text node beside other content) and what it resolves to, from itself up through the elements around it:
 * a field of the block (`own`: a mark, its value, or its value inside a longer text), a text of an entry or
 * a global (`found`), or nothing, then with its kind (`cmsTextRest`). For the measuring script.
 */
export function cmsTextsReport<N extends CmsMatchNode>(
  roots: N[], ownFields: CmsMatchField[], found: CmsSourceFound<N>, entities: Record<string, CmsBuilderEntity>,
  options: { text?: (n: N) => string; visible?: (n: N) => boolean; values?: string[] } = {},
): { text: string; res: CmsTextResolution; rest?: CmsTextRest; by?: CmsTextBy; of?: string }[] {
  const text = options.text ?? cmsMatchShown
  const visible = options.visible ?? (() => true)
  const values = options.values ?? []
  const inForm = (n: CmsMatchNode) => {
    for (let at: CmsMatchNode | null = n; at; at = at.parentNode) if (isElement(at) && ['FORM', 'LABEL', 'BUTTON', 'SELECT', 'OPTION'].includes(at.nodeName.toUpperCase())) return true
    return false
  }
  const own = new Set(found.own)
  const hidden = (n: CmsMatchNode) => {
    for (let at: CmsMatchNode | null = n; at; at = at.parentNode) {
      if (isElement(at) && attr(at, 'aria-hidden') === 'true') return true
      if (roots.includes(at as N)) return false
    }
    return false
  }
  const pieces: { el: N; text: string }[] = []
  for (const n of cmsMatchElements(roots, { texts: true, text })) {
    if (!visible(n.nodeType === 3 ? n.parentNode as N : n) || hidden(n)) continue
    const t = text(n)
    if (!t) continue
    // A text node beside other content is a text of its own; an element is one when nothing inside it has a text of its own.
    if (n.nodeType === 1 && elementChildren(n).some((c) => !!text(c as N))) continue
    pieces.push({ el: n, text: t })
  }
  return pieces.map(({ el, text: t }) => {
    // What the text, or the nearest element around it in the block, is found as.
    for (let at: CmsMatchNode | null = el; at; at = at.parentNode) {
      const part = found.parts.get(at as N)
      if (part) return { text: t, res: Object.hasOwn(entities, part.entity) && entities[part.entity]!.global ? 'global' as const : 'entry' as const, of: part.entity, ...(part.kind === 'value' ? { by: 'value' as const } : {}) }
      if (own.has(at as N)) return { text: t, res: 'own' as const }
      if (roots.includes(at as N)) break
    }
    if (marked(el, roots) || cmsMatchFieldsWith(ownFields, t).length || cmsMatchPlacesInText(t, ownFields).length) return { text: t, res: 'own' as const }
    return { text: t, res: 'none' as const, rest: cmsTextRest(cmsMatchSquash(t), values, inForm(el)) }
  })
}
