import { cardBindingKey, CUSTOM_PAGE_FIELD, customFieldKind, fieldRefTakes, isFieldRef } from 'tinyzoo'
import type { BlockDef, CmsBinding, CustomFieldKind, ModelDoc, ModelField, ModelLabel, ModelOrder, ModelType } from 'tinyzoo'

// The bindings the generic blocks of a page hold (docs/custom-types-plan.md, sections 7 and 8), and
// the references of a card's blocks to the fields of the type it shows (docs/builder-plan.md, part 3),
// as pure functions: finding them in stored blocks, saying which fields they use and what a site
// lacks, checking a written reference, taking the blocks out of the admin graph, and describing a
// site's types for the website. No database, no request, no Nitro helper: each is a function of its
// arguments.

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isKey = (v: unknown): v is string => typeof v === 'string' && v !== ''

/**
 * The block types that hold a binding, with the keys of their binding fields (top level of the
 * block only). A type with no binding field is not in the map.
 */
export function bindingBlockTypes(blocks: Record<string, BlockDef>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [type, def] of Object.entries(blocks ?? {})) {
    const keys = Object.entries(def?.fields ?? {}).filter(([, fld]) => (fld as { type?: string })?.type === 'binding').map(([key]) => key)
    if (keys.length) out.set(type, keys)
  }
  return out
}

/** A binding found in stored blocks, with the block that holds it. */
export interface FoundBinding {
  block: { id: string; type: string; heading: string | null }
  /** The key of the binding field in the block (`source`). */
  key: string
  binding: CmsBinding
  /** A card's binding: the fields its blocks show (each key once). Empty for any other binding. */
  refs: string[]
}

/**
 * Every binding in a stored blocks array. `types` is `bindingBlockTypes` of the field's blocks.
 * A block whose binding is absent, null or has no type is skipped; anything that is not a list of
 * blocks is tolerated and gives nothing. With `defs` (the field's blocks), a card's binding comes
 * with the fields its blocks show, at both levels (`cardRefsIn`).
 */
export function bindingsIn(value: unknown, types: Map<string, string[]>, defs?: Record<string, BlockDef>): FoundBinding[] {
  const out: FoundBinding[] = []
  if (!Array.isArray(value)) return out
  for (const item of value) {
    if (!isObject(item) || typeof item.type !== 'string') continue
    const keys = types.get(item.type)
    if (!keys) continue
    const heading = typeof item.heading === 'string' && item.heading.trim() !== '' ? item.heading : null
    const def = defs && Object.hasOwn(defs, item.type) ? defs[item.type] : undefined
    const card = cardBindingKey(def)
    for (const key of keys) {
      const binding = item[key]
      if (!isObject(binding) || !isKey(binding.type)) continue
      const refs = key === card && def ? [...new Set(cardRefsIn(item, def).map((r) => r.key))] : []
      out.push({ block: { id: typeof item.id === 'string' ? item.id : '', type: item.type, heading }, key, binding: binding as unknown as CmsBinding, refs })
    }
  }
  return out
}

/** A reference found inside a card's block: the field it names, the kinds it takes, and where it is. */
export interface FoundRef {
  key: string
  takes: CustomFieldKind[]
  /** From the card's block down: `['items', 0, 'field']`, `['items', 1, 'items', 0, 'field']`. */
  path: (string | number)[]
  /** The ids of the blocks from the card's block down to the one that holds it (the card's block not included). */
  ids: string[]
}

/**
 * The references of the blocks inside a stored block (a card's blocks and the blocks of their lists),
 * each with a field key. Empty references are left out; a block of a type the definition does not
 * have is skipped; anything of an odd shape gives nothing.
 */
export function cardRefsIn(block: unknown, def: Pick<BlockDef, 'fields'>): FoundRef[] {
  const out: FoundRef[] = []
  if (!isObject(block)) return out
  const walk = (list: unknown, defs: Record<string, BlockDef> | undefined, path: (string | number)[], ids: string[], depth: number) => {
    if (!Array.isArray(list) || !defs || depth > 2) return
    list.forEach((item, i) => {
      if (!isObject(item) || typeof item.type !== 'string' || !Object.hasOwn(defs, item.type)) return
      const id = typeof item.id === 'string' ? item.id : ''
      for (const [key, fld] of Object.entries(defs[item.type]!.fields ?? {}) as [string, any][]) {
        if (isFieldRef(fld)) {
          const v = item[key]
          if (typeof v === 'string' && v.trim() !== '') out.push({ key: v.trim(), takes: fieldRefTakes(fld), path: [...path, i, key], ids: [...ids, id] })
        }
        else if (fld?.type === 'blocks') walk(item[key], fld.blocks, [...path, i, key], [...ids, id], depth + 1)
      }
    })
  }
  for (const [key, fld] of Object.entries(def?.fields ?? {}) as [string, any][]) {
    if (fld?.type === 'blocks') walk(block[key], fld.blocks, [key], [], 1)
  }
  return out
}

/**
 * The field keys a binding uses: the places of a card and the order, and `refs`, the fields a
 * card's blocks show. Each once, strings only.
 */
export function bindingFields(binding: CmsBinding, refs: readonly string[] = []): string[] {
  const show: Record<string, unknown> = isObject(binding?.show) ? binding.show : {}
  const order: Record<string, unknown> = isObject(binding?.order) ? binding.order : {}
  const keys = [show.image, show.text, show.date, show.label, ...(Array.isArray(show.more) ? show.more : []), order.by, ...refs]
  return [...new Set(keys.filter(isKey))]
}

/**
 * Whether a binding names the type and, when `field` is given, uses that field of it (shows it or
 * orders by it, or a card's block shows it: `refs`).
 */
export function bindingUses(binding: CmsBinding, type: string, field: string | null, refs: readonly string[] = []): boolean {
  if (binding?.type !== type) return false
  return field === null || bindingFields(binding, refs).includes(field)
}

/** What a binding names that the site does not have: the type, or else the fields. */
export interface BindingMissing { type?: string; fields?: string[] }

/**
 * What a binding names that the site's document lacks, or null when nothing is missing. The type
 * is missing when the document has no such type or it is hidden; otherwise a used field is
 * missing when the type has no such visible field. Fields every type has are never missing:
 * `createdAt`, `updatedAt`, and the ones the mapper adds (`slug` with a page, `status` with
 * publishing, `position` in a manual order).
 */
export function bindingMissing(binding: CmsBinding, doc: ModelDoc | null, refs: readonly string[] = []): BindingMissing | null {
  const type = doc?.types.find((t) => t.name === binding?.type && !t.removedAt)
  if (!type) return { type: String(binding?.type ?? '') }
  const have = new Set<string>(['createdAt', 'updatedAt', type.titleField])
  for (const f of type.fields) if (!f.removedAt) have.add(f.key)
  if (type.page) have.add('slug')
  if (type.publish) have.add('status')
  if (type.order === 'manual') have.add('position')
  const fields = bindingFields(binding, refs).filter((k) => !have.has(k))
  return fields.length ? { fields } : null
}

// ── a written reference ──

/** A refusal of a written reference, as the other refusals of a write: `{ code, path, message }`. */
export interface RefProblem { code: 'custom'; path: (string | number)[]; message: string }

/** The kind of a type's field a reference may name, or null when the type has no such visible field. */
export function refKind(type: ModelType, key: string): CustomFieldKind | null {
  if (key === CUSTOM_PAGE_FIELD) return type.page ? 'page' : null
  const field = type.fields.find((f) => f.key === key && !f.removedAt)
  return field ? customFieldKind(field) : null
}

/** Why a reference to `key` cannot be written, or null when it can. */
function refRefusal(key: string, takes: readonly CustomFieldKind[], typeName: string | null, doc: ModelDoc | null): string | null {
  if (!typeName) return `Choose what the block shows first: "${key}" is a field of a content type, and none is chosen yet.`
  const type = doc?.types.find((t) => t.name === typeName && !t.removedAt)
  if (!type) return `The content type "${typeName}" is not among the site's own, so its field "${key}" cannot be shown.`
  const kind = refKind(type, key)
  if (!kind) return key === CUSTOM_PAGE_FIELD ? `The content type "${typeName}" has no pages, so there is no entry's own page to show.` : `The content type "${typeName}" has no field "${key}".`
  if (!takes.includes(kind)) return `The field "${key}" is of the kind ${kind}, and this block shows ${takes.join(', ') || 'no field'}.`
  return null
}

const parsed = (v: unknown): unknown => {
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch { return null }
}
const byId = (list: unknown): Map<string, Record<string, unknown>> => {
  const out = new Map<string, Record<string, unknown>>()
  if (Array.isArray(list)) for (const x of list) if (isObject(x) && typeof x.id === 'string' && !out.has(x.id)) out.set(x.id, x)
  return out
}

/**
 * The references of a write that the site's model refuses, at their paths from the entry's fields
 * (`['sections', 2, 'items', 0, 'field']`). `fields` are the entity's fields, `data` the checked
 * write, `stored` what the row (or the translation) holds now, `doc` the site's model.
 *
 * In each blocks field the write holds, every block that shows a card (`customTypeCard()`) has its
 * references checked against the type its binding names: a reference to a field the type does not
 * have, has hidden, or whose kind the reference does not take is refused; so is any reference while
 * the block has no type. An empty reference is never refused. A reference that is stored already
 * (the same block, found by its ids from the field down, holding the same key) is kept as it is, so
 * a page stays saveable after its type changed.
 */
export function cardRefProblems(fields: Record<string, { type?: string; blocks?: Record<string, BlockDef> }>, data: Record<string, unknown>, stored: Record<string, unknown> | null | undefined, doc: ModelDoc | null): RefProblem[] {
  const out: RefProblem[] = []
  for (const [fieldKey, fld] of Object.entries(fields ?? {})) {
    if (fld?.type !== 'blocks' || !fld.blocks || !Object.hasOwn(data ?? {}, fieldKey)) continue
    const list = data[fieldKey]
    if (!Array.isArray(list)) continue
    const storedTop = byId(parsed(stored?.[fieldKey]))
    list.forEach((block, i) => {
      if (!isObject(block) || typeof block.type !== 'string' || !Object.hasOwn(fld.blocks!, block.type)) return
      const def = fld.blocks![block.type]!
      const card = cardBindingKey(def)
      if (!card) return
      const binding = block[card]
      const typeName = isObject(binding) && isKey(binding.type) ? binding.type : null
      const before = typeof block.id === 'string' ? storedTop.get(block.id) : undefined
      for (const ref of cardRefsIn(block, def)) {
        if (before && storedHas(before, ref)) continue
        const message = refRefusal(ref.key, ref.takes, typeName, doc)
        if (message) out.push({ code: 'custom', path: [fieldKey, i, ...ref.path], message })
      }
    })
  }
  return out
}

/** Whether the stored block holds the same reference: the same blocks by their ids down to it, the same field, the same key. */
function storedHas(stored: Record<string, unknown>, ref: FoundRef): boolean {
  let node: Record<string, unknown> | undefined = stored
  // ref.path is [listKey, index, (listKey, index,) fieldKey]; ref.ids holds the id of the block at each index.
  for (let step = 0; step < ref.ids.length; step++) {
    if (!ref.ids[step]) return false
    node = byId(node?.[ref.path[step * 2] as string]).get(ref.ids[step]!)
    if (!node) return false
  }
  const value = node?.[ref.path[ref.path.length - 1] as string]
  return typeof value === 'string' && value.trim() === ref.key
}

/** A field of the admin graph, or the inner field of a block or a group. */
type GraphField = { meta?: { blocks?: Record<string, { fields?: GraphField[] } & Record<string, unknown>>; fields?: GraphField[] } & Record<string, unknown> } & Record<string, unknown>

/** The same field, or a copy without the block types that hold a binding (the same object when nothing changed). */
function fieldWithoutBindingBlocks(fld: GraphField): GraphField {
  const meta = fld?.meta
  if (!meta || typeof meta !== 'object') return fld
  let next = meta
  if (isObject(meta.blocks)) {
    let changed = false
    const blocks: Record<string, any> = {}
    for (const [type, def] of Object.entries(meta.blocks)) {
      const fields = Array.isArray(def?.fields) ? def.fields : []
      if (fields.some((x) => (x as { type?: string })?.type === 'binding')) { changed = true; continue }
      const inner = fieldsWithout(fields)
      if (inner !== fields) { changed = true; blocks[type] = { ...def, fields: inner } }
      else blocks[type] = def
    }
    if (changed) next = { ...next, blocks }
  }
  if (Array.isArray(meta.fields)) {
    const inner = fieldsWithout(meta.fields)
    if (inner !== meta.fields) next = { ...next, fields: inner }
  }
  return next === meta ? fld : { ...fld, meta: next }
}

/** A list of fields, or a copy of it when any of them changed. */
function fieldsWithout(fields: GraphField[]): GraphField[] {
  const out = fields.map(fieldWithoutBindingBlocks)
  return out.some((f, i) => f !== fields[i]) ? out : fields
}

/**
 * The admin graph without the block types that hold a binding, in every blocks field (a blocks
 * field inside a block or a group too). The input is never changed: the graph's objects are
 * shared by every site of a design and every request, so what changes is copied and what does
 * not is returned as it was.
 */
export function withoutBindingBlocks<T extends { fields?: unknown[] }>(graph: T[]): T[] {
  const out = graph.map((entity) => {
    const fields = Array.isArray(entity?.fields) ? entity.fields as GraphField[] : null
    if (!fields) return entity
    const next = fieldsWithout(fields)
    return next === fields ? entity : { ...entity, fields: next }
  })
  return out.some((e, i) => e !== graph[i]) ? out : graph
}

/** One field of a type as the website's description of types gives it. */
export interface PublicTypeField {
  key: string
  type: ModelField['type']
  /** What a block that shows it sees (`customFieldKind`); null for a kind this tinyzoo does not know. */
  kind: CustomFieldKind | null
  label: ModelLabel
  help?: ModelLabel | null
  long?: boolean
  format?: 'email' | 'url' | 'link'
  decimal?: boolean
  allDay?: boolean
  options?: { value: string; label: ModelLabel; removed?: true }[]
  to?: string
}

/** One type as `GET /api/content/_types` gives it. */
export interface PublicType {
  name: string
  label: ModelLabel
  labelSingular: ModelLabel | null
  titleField: string
  /** `/kurzy/:slug` when the type has a page, else null. */
  path: string | null
  prefix: string | null
  publish: boolean
  order: ModelOrder | null
  page: { image: string | null; summary: string | null } | null
  fields: PublicTypeField[]
}

/**
 * The site's visible types as the website may know them: names, labels, address, and each
 * visible field with the options of its kind. Hidden types and fields are left out, and so is
 * what `built` says the instance did not build (`built(type, null)`: the type; `built(type,
 * key)`: the field). Labels are as the document holds them, an object by language.
 */
export function publicCustomTypes(doc: ModelDoc | null, built: (type: string, field: string | null) => boolean = () => true): PublicType[] {
  const out: PublicType[] = []
  for (const t of doc?.types ?? []) {
    if (t.removedAt || !built(t.name, null)) continue
    const fields = t.fields.filter((f) => !f.removedAt && built(t.name, f.key)).map(publicField)
    const has = (key: string | null | undefined) => (key && fields.some((f) => f.key === key) ? key : null)
    out.push({
      name: t.name,
      label: t.label,
      labelSingular: t.labelSingular ?? null,
      titleField: t.titleField,
      path: t.page ? `/${t.page.prefix}/:slug` : null,
      prefix: t.page ? t.page.prefix : null,
      publish: !!t.publish,
      order: t.order ?? null,
      page: t.page ? { image: has(t.page.image), summary: has(t.page.summary) } : null,
      fields,
    })
  }
  return out
}

/** A field with its kind's public options, each only when set. */
function publicField(f: ModelField): PublicTypeField {
  const out: PublicTypeField = { key: f.key, type: f.type, kind: customFieldKind(f), label: f.label }
  if (f.help) out.help = f.help
  if (f.type === 'text') {
    if (f.long) out.long = true
    if (f.format) out.format = f.format
  }
  else if (f.type === 'number') { if (f.decimal) out.decimal = true }
  else if (f.type === 'datetime') { if (f.allDay) out.allDay = true }
  else if (f.type === 'select') out.options = f.options.map((o) => ({ value: o.value, label: o.label, ...(o.removed ? { removed: true as const } : {}) }))
  else if (f.type === 'relation') out.to = f.to
  return out
}
