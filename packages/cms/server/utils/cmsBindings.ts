import type { BlockDef, CmsBinding, ModelDoc, ModelField, ModelLabel, ModelOrder } from 'tinyzoo'

// The bindings the generic blocks of a page hold (docs/custom-types-plan.md, sections 7 and 8), as
// pure functions: finding them in stored blocks, saying which fields they use and what a site
// lacks, taking the blocks out of the admin graph, and describing a site's types for the website.
// No database, no request, no Nitro helper: each is a function of its arguments.

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
}

/**
 * Every binding in a stored blocks array. `types` is `bindingBlockTypes` of the field's blocks.
 * A block whose binding is absent, null or has no type is skipped; anything that is not a list of
 * blocks is tolerated and gives nothing.
 */
export function bindingsIn(value: unknown, types: Map<string, string[]>): FoundBinding[] {
  const out: FoundBinding[] = []
  if (!Array.isArray(value)) return out
  for (const item of value) {
    if (!isObject(item) || typeof item.type !== 'string') continue
    const keys = types.get(item.type)
    if (!keys) continue
    const heading = typeof item.heading === 'string' && item.heading.trim() !== '' ? item.heading : null
    for (const key of keys) {
      const binding = item[key]
      if (!isObject(binding) || !isKey(binding.type)) continue
      out.push({ block: { id: typeof item.id === 'string' ? item.id : '', type: item.type, heading }, key, binding: binding as unknown as CmsBinding })
    }
  }
  return out
}

/** The field keys a binding uses: the places of a card and the order. Each once, strings only. */
export function bindingFields(binding: CmsBinding): string[] {
  const show: Record<string, unknown> = isObject(binding?.show) ? binding.show : {}
  const order: Record<string, unknown> = isObject(binding?.order) ? binding.order : {}
  const keys = [show.image, show.text, show.date, show.label, ...(Array.isArray(show.more) ? show.more : []), order.by]
  return [...new Set(keys.filter(isKey))]
}

/** Whether a binding names the type and, when `field` is given, uses that field of it (shows it or orders by it). */
export function bindingUses(binding: CmsBinding, type: string, field: string | null): boolean {
  if (binding?.type !== type) return false
  return field === null || bindingFields(binding).includes(field)
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
export function bindingMissing(binding: CmsBinding, doc: ModelDoc | null): BindingMissing | null {
  const type = doc?.types.find((t) => t.name === binding?.type && !t.removedAt)
  if (!type) return { type: String(binding?.type ?? '') }
  const have = new Set<string>(['createdAt', 'updatedAt', type.titleField])
  for (const f of type.fields) if (!f.removedAt) have.add(f.key)
  if (type.page) have.add('slug')
  if (type.publish) have.add('status')
  if (type.order === 'manual') have.add('position')
  const fields = bindingFields(binding).filter((k) => !have.has(k))
  return fields.length ? { fields } : null
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
  const out: PublicTypeField = { key: f.key, type: f.type, label: f.label }
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
