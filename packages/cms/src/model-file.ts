// The model file, `cms.model.json` (docs/model-file-plan.md, section 3): a site's visible custom
// types, written into a file a developer keeps in git. Everything here is pure.
//
// One way to write it, so two files of the same model are the same bytes:
//
// - the file:   format, site, version, types
// - a type:     name, label, labelSingular, description, icon, titleField, page, publish, order,
//               listColumns, fields
// - a page:     prefix, image, summary
// - an order:   by, dir (or the text 'manual')
// - a field:    key, type, label, help, required, long, format, decimal, min, max, allDay,
//               default, to, options
// - a choice:   value, label, removed
// - a label:    its languages in alphabetical order (cs, de, en, …)
//
// A value that is null, undefined or false is left out, and so is an empty list of columns. A
// select field's default of null and a switch's default of false are such values. Numbers stay,
// 0 included. Two spaces, and a newline at the end.

import {
  MODEL_DOC_MAX_BYTES,
  MODEL_FORMAT,
  ModelProblem,
  parseModelDoc,
  type ModelDoc,
  type ModelField,
  type ModelLabel,
  type ModelOp,
  type ModelOption,
  type ModelType,
} from './model-doc'
import { modelEntities, type ModelMapProblem } from './model-map'

/** The name of the model file, in the app's root beside `cms.config.ts`. @internal */
export const MODEL_FILE_NAME = 'cms.model.json'

/** The server asset a single-site app's build carries its model file as (`assets:<this>`, key `cms.model.json`). @internal */
export const MODEL_FILE_ASSET = 'cms-model-file'

/** A field as the file holds it: visible, so without `removedAt` and `removedEmpty`. @internal */
export type ModelFileField = ModelField extends infer F ? (F extends ModelField ? Omit<F, 'removedAt' | 'removedEmpty'> : never) : never

/** A type as the file holds it: visible, with its visible fields only. @internal */
export type ModelFileType = Omit<ModelType, 'removedAt' | 'removedEmpty' | 'fields'> & { fields: ModelFileField[] }

/**
 * The model file: the site's visible custom types, the version of the site's model they were
 * read at, and the address they came from. A removed choice of a select field stays, marked
 * `removed`: entries can still hold it. @internal
 */
export interface ModelFile {
  format: 1
  site?: string
  version: number
  types: ModelFileType[]
}

/** Why a difference cannot be sent: `code` is stable kebab-case, `message` plain English. @internal */
export interface ModelDiffProblem {
  code: string
  message: string
  type?: string
  field?: string
}

// ---------------------------------------------------------------------------------------------
// One way to write it

const TYPE_KEYS = ['name', 'label', 'labelSingular', 'description', 'icon', 'titleField', 'page', 'publish', 'order', 'listColumns', 'fields'] as const
const PAGE_KEYS = ['prefix', 'image', 'summary'] as const
const FIELD_KEYS = ['key', 'type', 'label', 'help', 'required', 'long', 'format', 'decimal', 'min', 'max', 'allDay', 'default', 'to', 'options'] as const
const OPTION_KEYS = ['value', 'label', 'removed'] as const
const LABEL_KEYS = new Set<string>(['label', 'labelSingular', 'description', 'help'])

/** Is this a value the file writes? Null, undefined and false are not. */
const kept = (v: unknown): boolean => v !== null && v !== undefined && v !== false

const sortedLabel = (label: ModelLabel): ModelLabel => {
  const out: ModelLabel = {}
  for (const lang of Object.keys(label).sort()) out[lang] = label[lang] as string
  return out
}

/** Copies the keys of `from` that the file writes, in the order of `keys`. */
function pick(from: Record<string, any>, keys: readonly string[], value: (key: string, v: any) => unknown): Record<string, any> {
  const out: Record<string, any> = {}
  for (const key of keys) {
    const v = from[key]
    if (!kept(v)) continue
    out[key] = value(key, v)
  }
  return out
}

function fileOption(o: ModelOption): ModelOption {
  return pick(o, OPTION_KEYS, (k, v) => (k === 'label' ? sortedLabel(v) : v)) as ModelOption
}

function fileField(f: ModelField | ModelFileField): ModelFileField {
  return pick(f, FIELD_KEYS, (k, v) => {
    if (LABEL_KEYS.has(k)) return sortedLabel(v)
    if (k === 'options') return (v as ModelOption[]).map(fileOption)
    return v
  }) as ModelFileField
}

function fileType(t: ModelType | ModelFileType): ModelFileType {
  return pick(t, TYPE_KEYS, (k, v) => {
    if (LABEL_KEYS.has(k)) return sortedLabel(v)
    if (k === 'page') return pick(v, PAGE_KEYS, (_k, x) => x)
    if (k === 'order') return v === 'manual' ? v : { by: v.by, dir: v.dir }
    if (k === 'listColumns') return [...v]
    if (k === 'fields') return (v as (ModelField | ModelFileField)[]).filter((f) => !('removedAt' in f && f.removedAt)).map(fileField)
    return v
  }) as ModelFileType
}

/** The file with its keys in the one order and without the values it leaves out. */
function normalFile(file: ModelFile): ModelFile {
  const types = file.types.map(fileType)
  // An empty list of columns says nothing: the default list.
  for (const t of types) if (Array.isArray(t.listColumns) && t.listColumns.length === 0) delete t.listColumns
  return {
    format: 1,
    ...(file.site ? { site: file.site } : {}),
    version: file.version,
    types,
  }
}

/**
 * The model file of a document: its visible types with their visible fields, without
 * `removedAt` and `removedEmpty`, written the one way (see the top of this file). `version` is the
 * version of the site's model the document is; `site` the address it came from.
 * @internal
 */
export function modelFileOf(doc: ModelDoc, meta: { version: number; site?: string }): ModelFile {
  const types = doc.types.filter((t) => !t.removedAt)
  return normalFile({ format: 1, ...(meta.site ? { site: meta.site } : {}), version: meta.version, types: types as ModelFileType[] })
}

/** The text of a model file: keys in the one order, two spaces, a newline at the end. @internal */
export function writeModelFile(file: ModelFile): string {
  return `${JSON.stringify(normalFile(file), null, 2)}\n`
}

/** The document a model file stands for: its types, nothing removed. @internal */
export function modelFileDoc(file: ModelFile): ModelDoc {
  return { format: MODEL_FORMAT, types: structuredClone(file.types) as ModelType[] }
}

/**
 * What `NUXT_CMS_MODEL_FILE=follow` makes of a site at start: its model `current` with what the
 * app's `file` has and the site lacks, and nothing taken away or changed. A type the file has
 * and `current` lacks comes whole. For a type both have, the fields the file has and `current`
 * lacks come after the type's own fields, in the file's order. Everything `current` has stays as
 * it is (its labels, its order, its choices), so `diffModelFile(current, merged)` only adds: a
 * new type with its fields and settings, or a new field. `version` and `site` are `current`'s.
 * @internal
 */
export function mergeModelFileAdditions(current: ModelFile, file: ModelFile): ModelFile {
  const merged = normalFile(current)
  const have = new Map(merged.types.map((t) => [t.name, t]))
  for (const t of normalFile(file).types) {
    const own = have.get(t.name)
    if (!own) {
      merged.types.push(t)
      continue
    }
    const keys = new Set(own.fields.map((f) => f.key))
    for (const f of t.fields) if (!keys.has(f.key)) own.fields.push(f)
  }
  return merged
}

// ---------------------------------------------------------------------------------------------
// Reading it

const FILE_KEYS = new Set(['format', 'site', 'version', 'types'])
const REMOVED_KEYS = ['removedAt', 'removedEmpty'] as const

const invalidFile = (message: string): ModelProblem => new ModelProblem('invalid-file', message, -1)
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Reads a model file (parsed JSON) and checks all of it: its own keys, that it holds nothing
 * removed, and every rule of the document it stands for (`parseModelDoc`). Throws a
 * `ModelProblem` with the code `invalid-file` that names the place; a refusal of the document's
 * rules keeps its message and gets this code too, so a caller has one code to look for. Returns
 * the file written the one way.
 * @internal
 */
export function parseModelFile(value: unknown): ModelFile {
  if (!isObject(value)) throw invalidFile('The model file is not an object')
  const format = value.format
  if (typeof format === 'number' && format > MODEL_FORMAT) {
    throw invalidFile(`The model file was written by a newer tinyzoo: format ${format}, this one reads format ${MODEL_FORMAT}`)
  }
  if (format !== MODEL_FORMAT) throw invalidFile(`The model file has format ${String(format)}, this one reads format ${MODEL_FORMAT}`)
  for (const key of Object.keys(value)) {
    if (!FILE_KEYS.has(key)) throw invalidFile(`${key}: not a key of a model file (it has format, site, version and types)`)
  }
  if (value.site !== undefined && (typeof value.site !== 'string' || value.site === '')) throw invalidFile('site: the address the file came from, as text')
  const version = value.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) throw invalidFile('version: a whole number, 0 or more')
  if (!Array.isArray(value.types)) throw invalidFile('types: a list of types')
  let json: string
  try {
    json = JSON.stringify(value)
  } catch {
    throw invalidFile('The model file is not plain data')
  }
  if (new TextEncoder().encode(json).length > MODEL_DOC_MAX_BYTES) throw invalidFile(`The model file is larger than ${MODEL_DOC_MAX_BYTES / 1024} KB`)
  value.types.forEach((t, ti) => {
    if (!isObject(t)) return
    for (const key of REMOVED_KEYS) if (key in t) throw invalidFile(`types[${ti}].${key}: a model file holds no removed types or fields`)
    if (!Array.isArray(t.fields)) return
    t.fields.forEach((f, fi) => {
      if (!isObject(f)) return
      for (const key of REMOVED_KEYS) if (key in f) throw invalidFile(`types[${ti}].fields[${fi}].${key}: a model file holds no removed types or fields`)
    })
  })
  let doc: ModelDoc
  try {
    doc = parseModelDoc({ format: MODEL_FORMAT, types: value.types })
  } catch (err) {
    if (err instanceof ModelProblem) throw invalidFile(err.message)
    throw err
  }
  return normalFile({ format: 1, ...(typeof value.site === 'string' ? { site: value.site } : {}), version, types: doc.types as ModelFileType[] })
}

// ---------------------------------------------------------------------------------------------
// The difference between two files, as operations
//
// The order of the operations, so that `applyModelOps` takes each one:
//
// 1. `field.remove` for the fields a kept type lost. First, so a type below its limit of fields
//    has room for the new ones, and so no field still points at a type that goes in step 2.
// 2. `type.remove` for the types that went. A type is removed once no other visible type points
//    at it; two removed types that point at each other lose one such field first.
// 3. `type.add` for the new types, before any field that points at them. It makes the field
//    `title` itself, with the label of the file's title field.
// 4. `field.add` for the new fields, type by type in the file's order, each `after` the field
//    before it in the file (which is there by then). A new choice field's removed choices are
//    added with it and removed by a `field.update` at once.
// 5. `field.update` for the fields both files have, and for the title of a new type.
// 6. `type.update`: labels, icon, the list's columns, the order, the page's picture and summary.
//    After the fields, since these name fields.
// 7. `field.order` where the fields do not stand in the file's order yet.

/** The fields a type has while the operations run, and what of the type names fields. */
interface TypeState {
  fields: string[]
  listColumns: string[] | null
  order: ModelType['order']
  image: string | null
  summary: string | null
}

const json = (v: unknown): string => JSON.stringify(v ?? null)
const sameValue = (a: unknown, b: unknown): boolean => json(a) === json(b)

function stateOf(t: ModelFileType): TypeState {
  return {
    fields: t.fields.map((f) => f.key),
    listColumns: t.listColumns?.length ? [...t.listColumns] : null,
    order: t.order ?? null,
    image: t.page?.image ?? null,
    summary: t.page?.summary ?? null,
  }
}

/** What `field.remove` does to the rest of the type (as `applyModelOps` does it). */
function removeFromState(s: TypeState, key: string): void {
  s.fields = s.fields.filter((k) => k !== key)
  if (s.listColumns?.includes(key)) {
    const rest = s.listColumns.filter((k) => k !== key)
    s.listColumns = rest.length ? rest : null
  }
  if (s.order && s.order !== 'manual' && s.order.by === key) s.order = null
  if (s.image === key) s.image = null
  if (s.summary === key) s.summary = null
}

const notChangeable = (message: string, type: string, field?: string): ModelDiffProblem => ({ code: 'not-changeable', message, type, ...(field ? { field } : {}) })

/** The changes no operation can make. */
function diffProblems(base: ModelFile, next: ModelFile): ModelDiffProblem[] {
  const problems: ModelDiffProblem[] = []
  const baseTypes = new Map(base.types.map((t) => [t.name, t]))
  for (const n of next.types) {
    const b = baseTypes.get(n.name)
    if (!b) {
      // `type.add` always names entries by a new text field `title`.
      if (n.titleField !== 'title') problems.push(notChangeable(`A new type is named by its field "title", not "${n.titleField}"`, n.name))
      continue
    }
    if (!!b.page !== !!n.page) problems.push(notChangeable(`Pages cannot be switched ${n.page ? 'on' : 'off'} after the type is made. Add a new type instead`, n.name))
    else if (b.page && n.page && b.page.prefix !== n.page.prefix) problems.push(notChangeable('The address of the pages cannot be changed after the type is made. Add a new type instead', n.name))
    if (!!b.publish !== !!n.publish) problems.push(notChangeable(`Publishing cannot be switched ${n.publish ? 'on' : 'off'} after the type is made. Add a new type instead`, n.name))
    if (b.titleField !== n.titleField) problems.push(notChangeable('The title field cannot be changed after the type is made. Add a new type instead', n.name))
    if (b.order === 'manual' && n.order !== 'manual') problems.push(notChangeable('Entries arranged by hand stay arranged by hand: the type cannot go back to an order by a field', n.name))
    const baseFields = new Map(b.fields.map((f) => [f.key, f]))
    for (const nf of n.fields) {
      const bf = baseFields.get(nf.key)
      if (!bf) continue
      if (bf.type !== nf.type) {
        problems.push(notChangeable(`The kind of a field cannot be changed after it is made (${bf.type}, now ${nf.type}). Add a new field with another key instead`, n.name, nf.key))
        continue
      }
      if (bf.type === 'number' && nf.type === 'number' && !!bf.decimal !== !!nf.decimal) {
        problems.push(notChangeable('Whether a number has decimals cannot be changed after it is made. Add a new field instead', n.name, nf.key))
      }
      if (bf.type === 'relation' && nf.type === 'relation' && bf.to !== nf.to) {
        problems.push(notChangeable(`What a relation points at cannot be changed after it is made (${bf.to}, now ${nf.to}). Add a new field instead`, n.name, nf.key))
      }
      if (bf.type === 'select' && nf.type === 'select') {
        const before = bf.options.map((o) => o.value)
        const after = nf.options.map((o) => o.value)
        if (!before.every((v, i) => after[i] === v)) {
          problems.push(notChangeable('A choice cannot be deleted or moved after it is made. Mark it removed instead, and add new choices at the end', n.name, nf.key))
        }
      }
    }
  }
  return problems
}

/** A field as `field.add` takes it: everything the file says but the removed marks of its choices. */
function fieldInput(f: ModelFileField): Extract<ModelOp, { op: 'field.add' }>['field'] {
  if (f.type === 'select') return { ...f, options: f.options.map((o) => ({ value: o.value, label: o.label })) }
  return { ...f }
}

/** The `field.update` that takes `before` to `after` (two fields of the same key and kind), or null. */
function fieldUpdateOf(type: string, before: ModelFileField, after: ModelFileField): Extract<ModelOp, { op: 'field.update' }> | null {
  const op: Extract<ModelOp, { op: 'field.update' }> = { op: 'field.update', type, key: after.key }
  if (!sameValue(before.label, after.label)) op.label = after.label
  if (!sameValue(before.help, after.help)) op.help = after.help ?? null
  const req = (f: ModelFileField): boolean => 'required' in f && f.required === true
  if ('required' in after || 'required' in before) {
    if (req(before) !== req(after)) op.required = req(after)
  }
  if (before.type === 'text' && after.type === 'text') {
    if (!!before.long !== !!after.long) op.long = !!after.long
    if ((before.format ?? null) !== (after.format ?? null)) op.format = after.format ?? null
    if ((before.max ?? null) !== (after.max ?? null)) op.max = after.max ?? null
  } else if (before.type === 'number' && after.type === 'number') {
    if ((before.min ?? null) !== (after.min ?? null)) op.min = after.min ?? null
    if ((before.max ?? null) !== (after.max ?? null)) op.max = after.max ?? null
  } else if (before.type === 'datetime' && after.type === 'datetime') {
    if (!!before.allDay !== !!after.allDay) op.allDay = !!after.allDay
  } else if (before.type === 'boolean' && after.type === 'boolean') {
    if (!!before.default !== !!after.default) op.default = !!after.default
  } else if (before.type === 'select' && after.type === 'select') {
    const known = new Map(before.options.map((o) => [o.value, o]))
    const labels: Record<string, ModelLabel> = {}
    const restore: string[] = []
    const remove: string[] = []
    const add: { value: string; label: ModelLabel }[] = []
    for (const o of after.options) {
      const was = known.get(o.value)
      if (!was) {
        add.push({ value: o.value, label: o.label })
        if (o.removed) remove.push(o.value)
        continue
      }
      if (!sameValue(was.label, o.label)) labels[o.value] = o.label
      if (was.removed && !o.removed) restore.push(o.value)
      if (!was.removed && o.removed) remove.push(o.value)
    }
    if (Object.keys(labels).length) op.optionLabels = labels
    if (restore.length) op.restoreOptions = restore
    if (add.length) op.addOptions = add
    if (remove.length) op.removeOptions = remove
    if ((before.default ?? null) !== (after.default ?? null)) op.default = after.default ?? null
  }
  return Object.keys(op).length > 3 ? op : null
}

/**
 * The operations that lead from the model of `base` to the model of `next`, in an order
 * `applyModelOps` takes (see above). A type or field that is in one file and not in the other is
 * added or removed (hidden, so it can be restored in the admin): a changed name or key is a
 * removal and an addition. What no operation can change (the kind of a field, a number's
 * decimals, a relation's target, pages on or off, their address, publishing, the title field, a
 * choice deleted or moved) is a problem `not-changeable`, and then there are no operations. The
 * order of the types is not part of the model. The site is the judge of every operation.
 * @internal
 */
export function diffModelFile(base: ModelFile, next: ModelFile): { ops: ModelOp[]; problems: ModelDiffProblem[] } {
  const b = normalFile(base)
  const n = normalFile(next)
  const problems = diffProblems(b, n)
  if (problems.length) return { ops: [], problems }

  const ops: ModelOp[] = []
  const baseTypes = new Map(b.types.map((t) => [t.name, t]))
  const nextTypes = new Map(n.types.map((t) => [t.name, t]))
  const state = new Map<string, TypeState>()
  for (const t of b.types) state.set(t.name, stateOf(t))

  // 1. The fields the kept types lost.
  for (const nt of n.types) {
    const bt = baseTypes.get(nt.name)
    if (!bt) continue
    const s = state.get(nt.name) as TypeState
    const keys = new Set(nt.fields.map((f) => f.key))
    for (const f of bt.fields) {
      if (keys.has(f.key)) continue
      ops.push({ op: 'field.remove', type: nt.name, key: f.key })
      removeFromState(s, f.key)
    }
  }

  // 2. The types that went: each once nothing visible points at it any more.
  let going = b.types.filter((t) => !nextTypes.has(t.name))
  const fieldsOf = new Map(going.map((t) => [t.name, [...t.fields]]))
  const pointsAt = (from: ModelFileType, to: string): ModelFileField[] =>
    (fieldsOf.get(from.name) ?? []).filter((f) => f.type === 'relation' && f.to === to)
  while (going.length) {
    const free = going.find((t) => !going.some((o) => o !== t && pointsAt(o, t.name).length))
    const target = free ?? (going[0] as ModelFileType)
    if (!free) {
      // Types that point at each other: the others lose their fields that point at this one.
      for (const o of going) {
        if (o === target) continue
        for (const f of pointsAt(o, target.name)) {
          ops.push({ op: 'field.remove', type: o.name, key: f.key })
          fieldsOf.set(o.name, (fieldsOf.get(o.name) ?? []).filter((x) => x !== f))
        }
      }
    }
    ops.push({ op: 'type.remove', type: target.name })
    state.delete(target.name)
    going = going.filter((t) => t !== target)
  }

  // 3. The new types.
  const made = new Map<string, ModelFileField>()
  for (const nt of n.types) {
    if (baseTypes.has(nt.name)) continue
    const title = nt.fields.find((f) => f.key === nt.titleField) as ModelFileField
    const op: Extract<ModelOp, { op: 'type.add' }> = { op: 'type.add', name: nt.name, label: nt.label }
    if (nt.labelSingular) op.labelSingular = nt.labelSingular
    if (nt.description) op.description = nt.description
    if (nt.icon) op.icon = nt.icon
    if (nt.page) op.page = { prefix: nt.page.prefix }
    if (nt.publish) op.publish = true
    op.titleLabel = title.label
    ops.push(op)
    // What type.add makes: the title field, required, with that label.
    made.set(nt.name, { key: 'title', type: 'text', label: title.label, required: true })
    state.set(nt.name, { fields: ['title'], listColumns: null, order: null, image: null, summary: null })
  }

  // 4. The new fields, each after the field before it in the file.
  const updates: ModelOp[] = []
  for (const nt of n.types) {
    const s = state.get(nt.name) as TypeState
    let previous: string | undefined
    for (const f of nt.fields) {
      if (!s.fields.includes(f.key)) {
        ops.push(previous === undefined ? { op: 'field.add', type: nt.name, field: fieldInput(f) } : { op: 'field.add', type: nt.name, field: fieldInput(f), after: previous })
        if (previous === undefined) s.fields.push(f.key)
        else s.fields.splice(s.fields.indexOf(previous) + 1, 0, f.key)
        if (f.type === 'select') {
          const removed = f.options.filter((o) => o.removed).map((o) => o.value)
          if (removed.length) ops.push({ op: 'field.update', type: nt.name, key: f.key, removeOptions: removed })
        }
      } else {
        // 5. (gathered here, sent after every addition) A field both have, or the title of a new type.
        const before = made.get(nt.name)?.key === f.key ? made.get(nt.name) : baseTypes.get(nt.name)?.fields.find((x) => x.key === f.key)
        const update = before ? fieldUpdateOf(nt.name, before, f) : null
        if (update) updates.push(update)
      }
      previous = f.key
    }
  }
  ops.push(...updates)

  // 6. What a type says about itself and its fields.
  for (const nt of n.types) {
    const s = state.get(nt.name) as TypeState
    const bt = baseTypes.get(nt.name)
    const op: Extract<ModelOp, { op: 'type.update' }> = { op: 'type.update', type: nt.name }
    if (bt) {
      if (!sameValue(bt.label, nt.label)) op.label = nt.label
      if (!sameValue(bt.labelSingular, nt.labelSingular)) op.labelSingular = nt.labelSingular ?? null
      if (!sameValue(bt.description, nt.description)) op.description = nt.description ?? null
      if ((bt.icon ?? null) !== (nt.icon ?? null)) op.icon = nt.icon ?? null
    }
    if (!sameValue(s.listColumns, nt.listColumns?.length ? nt.listColumns : null)) op.listColumns = nt.listColumns?.length ? nt.listColumns : null
    if (!sameValue(s.order, nt.order)) op.order = nt.order ?? null
    if (nt.page) {
      const page: { image?: string | null; summary?: string | null } = {}
      if (s.image !== (nt.page.image ?? null)) page.image = nt.page.image ?? null
      if (s.summary !== (nt.page.summary ?? null)) page.summary = nt.page.summary ?? null
      if (Object.keys(page).length) op.page = page
    }
    if (Object.keys(op).length > 2) ops.push(op)
  }

  // 7. The order of the fields.
  for (const nt of n.types) {
    const s = state.get(nt.name) as TypeState
    const keys = nt.fields.map((f) => f.key)
    if (!sameValue(s.fields, keys)) ops.push({ op: 'field.order', type: nt.name, keys })
  }

  return { ops, problems: [] }
}

// ---------------------------------------------------------------------------------------------
// Saying what the operations do

const textOf = (label: ModelLabel | null | undefined): string | undefined => (label ? (label.en ?? Object.values(label)[0]) : undefined)
const named = (name: string, label?: ModelLabel | null): string => {
  const text = textOf(label)
  return text ? `${name} (${text})` : name
}
const listed = (xs: string[]): string => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const choices = (n: number, values: string[]): string => `${n === 1 ? 'the choice' : 'the choices'} ${listed(values)}`

/** What a `type.update` changes, in words. */
function typeChanges(op: Extract<ModelOp, { op: 'type.update' }>): string[] {
  const out: string[] = []
  const set = (what: string, value: string | null | undefined): string => (value ? `sets ${what} to ${value}` : `removes ${what}`)
  if (op.label !== undefined) out.push(set('the label', `"${textOf(op.label)}"`))
  if (op.labelSingular !== undefined) out.push(set('the singular label', op.labelSingular ? `"${textOf(op.labelSingular)}"` : null))
  if (op.description !== undefined) out.push(op.description ? 'changes the description' : 'removes the description')
  if (op.icon !== undefined) out.push(set('the icon', op.icon))
  if (op.listColumns !== undefined) out.push(op.listColumns ? `shows the columns ${listed(op.listColumns)} in the list` : 'shows the default columns in the list')
  if (op.order !== undefined) {
    out.push(op.order === null ? 'drops its order' : op.order === 'manual' ? 'lets entries be arranged by hand' : `orders entries by ${op.order.by}, ${op.order.dir === 'asc' ? 'ascending' : 'descending'}`)
  }
  if (op.page?.image !== undefined) out.push(set('the page picture', op.page.image))
  if (op.page?.summary !== undefined) out.push(set('the page summary', op.page.summary))
  return out
}

/** What a `field.update` changes, in words. */
function fieldChanges(op: Extract<ModelOp, { op: 'field.update' }>): string[] {
  const out: string[] = []
  const set = (what: string, value: string | number | null | undefined): string => (value !== null && value !== undefined ? `sets ${what} to ${value}` : `removes ${what}`)
  if (op.label !== undefined) out.push(set('the label', `"${textOf(op.label)}"`))
  if (op.help !== undefined) out.push(op.help ? 'changes the help text' : 'removes the help text')
  if (op.required !== undefined) out.push(op.required ? 'makes it required' : 'makes it optional')
  if (op.long !== undefined) out.push(op.long ? 'makes it a long text' : 'makes it a short text')
  if (op.format !== undefined) out.push(set('the format', op.format))
  if (op.min !== undefined) out.push(set('the smallest number', op.min))
  if (op.max !== undefined) out.push(set('the largest value', op.max))
  if (op.allDay !== undefined) out.push(op.allDay ? 'makes it a date without a time' : 'makes it a date with a time')
  if (op.default !== undefined) out.push(typeof op.default === 'boolean' ? `makes it ${op.default ? 'on' : 'off'} by default` : set('the default', op.default))
  const labels = Object.keys(op.optionLabels ?? {})
  if (labels.length) out.push(`relabels ${choices(labels.length, labels)}`)
  if (op.addOptions?.length) out.push(`adds ${choices(op.addOptions.length, op.addOptions.map((o) => o.value ?? textOf(o.label) ?? ''))}`)
  if (op.removeOptions?.length) out.push(`stops offering ${choices(op.removeOptions.length, op.removeOptions)}`)
  if (op.restoreOptions?.length) out.push(`offers ${choices(op.restoreOptions.length, op.restoreOptions)} again`)
  return out
}

/**
 * One plain English line per operation, for a command line: "adds the type custom_course
 * (Courses)", "hides the field price of custom_course: it can be restored in the admin".
 * @internal
 */
export function describeModelOps(ops: ModelOp[]): string[] {
  return ops.map((op) => {
    switch (op.op) {
      case 'type.add': {
        const extra = [op.page ? `with pages at /${op.page.prefix ?? '…'}/` : '', op.publish ? 'with drafts and publishing' : ''].filter(Boolean)
        return `adds the type ${named(op.name ?? 'new', op.label)}${extra.length ? `, ${extra.join(', ')}` : ''}`
      }
      case 'type.update': return `changes the type ${op.type}: ${typeChanges(op).join(', ') || 'nothing'}`
      case 'type.remove': return `hides the type ${op.type} with its entries: it can be restored in the admin`
      case 'type.restore': return `restores the type ${op.type}`
      case 'field.add': {
        const f = op.field
        const what = f.type === 'relation' ? `a relation to ${f.to}` : `${f.type}`
        return `adds the field ${named(f.key ?? 'new', f.label)} to ${op.type}: ${what}${'required' in f && f.required ? ', required' : ''}${op.after ? `, after ${op.after}` : ''}`
      }
      case 'field.update': return `changes the field ${op.key} of ${op.type}: ${fieldChanges(op).join(', ') || 'nothing'}`
      case 'field.remove': return `hides the field ${op.key} of ${op.type}: it can be restored in the admin`
      case 'field.restore': return `restores the field ${op.key} of ${op.type}`
      case 'field.order': return `puts the fields of ${op.type} in this order: ${op.keys.join(', ')}`
      case 'purge': {
        const things = [...(op.types ?? []).map((t) => `the type ${t}`), ...(op.fields ?? []).map((x) => `the field ${x.key} of ${x.type}`)]
        return `deletes for good ${listed(things) || 'nothing'}`
      }
    }
    return 'an unknown change'
  })
}

// ---------------------------------------------------------------------------------------------
// The config of a site with its own types

/**
 * What a site's content model is with its own types: the design's exports (what `cms.config.ts`
 * exports) and the entities of the document's visible types under keys no export of the design
 * can have (`custom:<name>`). `problems` is what the mapper left out. The CLI builds the types of a
 * model file with this, and the server its site's model.
 * @internal
 */
export function customModelConfig(design: Record<string, any>, doc: ModelDoc): { config: Record<string, any>; problems: ModelMapProblem[] } {
  const built = modelEntities(doc, design)
  const config: Record<string, any> = { ...design }
  for (const name of Object.keys(built.entities)) config[`custom:${name}`] = built.entities[name]
  return { config, problems: built.problems }
}
