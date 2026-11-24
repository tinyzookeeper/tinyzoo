// A site's own content types, as one document of data (docs/custom-types-plan.md, sections 2, 3,
// 6 and 7). The document says what `defineEntity` and `f.*` say, without functions; the mapper
// (`model-map.ts`) turns it into entities. This file holds its format and the operations that
// change it. Everything here is pure: the facts only the database knows come in `ModelContext`.

import { z } from 'zod'
import { LIST_PARAMS, RESERVED_FIELD_NAMES } from './entity'
import { snake } from './fields'

/** The start of every custom type's name (and of its tables). Written here only. @internal */
export const CUSTOM_PREFIX = 'x_'

/** The version of the document's format this tinyzoo writes and reads. @internal */
export const MODEL_FORMAT = 1

/** How many custom types, fields of a type and choices of a field a site may have, hidden ones included. @internal */
export interface ModelLimits {
  types: number
  fields: number
  options: number
}

/** @internal */
export const DEFAULT_MODEL_LIMITS: Readonly<ModelLimits> = { types: 12, fields: 30, options: 30 }

/** The longest label (characters). @internal */
export const MODEL_LABEL_MAX = 80
/** The longest help text or description (characters). @internal */
export const MODEL_HELP_MAX = 300
/** The largest document (bytes of its JSON). @internal */
export const MODEL_DOC_MAX_BYTES = 256 * 1024
/** A hidden type or field is deleted for good this long after it was hidden… @internal */
export const MODEL_PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000
/** …or this long after, when it held no content at that moment. @internal */
export const MODEL_PURGE_EMPTY_AFTER_MS = 60 * 60 * 1000

/** Text a person reads, per admin language: `{ cs: 'Kurzy', en: 'Courses' }`. At least one language. @internal */
export type ModelLabel = Record<string, string>

/** One choice of a select field. Its `value` never changes; `removed` means it is not offered any more. @internal */
export interface ModelOption {
  value: string
  label: ModelLabel
  removed?: boolean
}

interface ModelFieldBase {
  /** Never changes. Lower camel case; the column is `snake(key)` (plus `_id` for relation, media and file). */
  key: string
  label: ModelLabel
  help?: ModelLabel | null
  /** When the field was hidden (ISO 8601), or null while it is visible. */
  removedAt?: string | null
  /** The field held no value when it was hidden, so it may be deleted after an hour. */
  removedEmpty?: boolean
}

/**
 * One field of a custom type, by kind (`type`). A field is optional unless it says `required`.
 * A picture, a file and a relation are always optional: a required one would hold on to its target
 * in the database (`ON DELETE restrict`), also while the field is hidden.
 *
 * @internal
 */
export type ModelField = ModelFieldBase & (
  | { type: 'text'; required?: boolean; long?: boolean; format?: 'email' | 'url' | 'link' | null; max?: number | null }
  | { type: 'richtext'; required?: boolean }
  | { type: 'number'; required?: boolean; decimal?: boolean; min?: number | null; max?: number | null }
  | { type: 'boolean'; default?: boolean }
  | { type: 'datetime'; required?: boolean; allDay?: boolean }
  | { type: 'select'; required?: boolean; options: ModelOption[]; default?: string | null }
  | { type: 'media' }
  | { type: 'file' }
  | { type: 'gallery' }
  | { type: 'color'; required?: boolean }
  | { type: 'relation'; to: string }
)

/** @internal */
export type ModelFieldType = ModelField['type']

/** @internal */
export const MODEL_FIELD_TYPES: readonly ModelFieldType[] = ['text', 'richtext', 'number', 'boolean', 'datetime', 'select', 'media', 'file', 'gallery', 'color', 'relation']

/** The page of each entry, at `/<prefix>/<slug>`. `image` and `summary` name fields used for sharing and search engines. @internal */
export interface ModelPage {
  prefix: string
  image?: string | null
  summary?: string | null
}

/** The order the website shows by default: by a field, or arranged by hand. @internal */
export type ModelOrder = 'manual' | { by: string; dir: 'asc' | 'desc' }

/** @internal */
export interface ModelType {
  /** Never changes: `x_` and a key (`x_course`). The table has this name. */
  name: string
  label: ModelLabel
  labelSingular?: ModelLabel | null
  description?: ModelLabel | null
  icon?: string | null
  /** The text field every entry is named by. Always the field `title` that `type.add` makes. */
  titleField: string
  page?: ModelPage | null
  publish?: boolean
  order?: ModelOrder | null
  /** The columns of the admin's list, or null for the default. */
  listColumns?: string[] | null
  removedAt?: string | null
  removedEmpty?: boolean
  fields: ModelField[]
}

/** @internal */
export interface ModelDoc {
  format: number
  types: ModelType[]
}

type FieldInput<F> = F extends { type: 'select' }
  ? Omit<F, 'key' | 'removedAt' | 'removedEmpty' | 'options'> & { key?: string; options: { value?: string; label: ModelLabel }[] }
  : Omit<F, 'key' | 'removedAt' | 'removedEmpty'> & { key?: string }

/**
 * A field as `field.add` takes it: the key, and the value of a choice, may be left out (they are
 * made from the label).
 *
 * @internal
 */
export type ModelFieldInput = ModelField extends infer F ? (F extends ModelField ? FieldInput<F> : never) : never

/** One change of the document, as data. @internal */
export type ModelOp =
  | {
    op: 'type.add'
    /** Made from the label when left out. */
    name?: string
    label: ModelLabel
    labelSingular?: ModelLabel | null
    description?: ModelLabel | null
    icon?: string | null
    /** A page per entry; the prefix is made from the label when left out. */
    page?: { prefix?: string } | null
    publish?: boolean
    order?: ModelOrder | null
    /** The label of the title field (default: Název / Title / Titel). */
    titleLabel?: ModelLabel
  }
  | {
    op: 'type.update'
    type: string
    label?: ModelLabel
    labelSingular?: ModelLabel | null
    description?: ModelLabel | null
    icon?: string | null
    listColumns?: string[] | null
    order?: ModelOrder | null
    page?: { image?: string | null; summary?: string | null }
  }
  | { op: 'type.remove'; type: string }
  | { op: 'type.restore'; type: string }
  | { op: 'field.add'; type: string; field: ModelFieldInput; after?: string }
  | {
    op: 'field.update'
    type: string
    key: string
    label?: ModelLabel
    help?: ModelLabel | null
    required?: boolean
    long?: boolean
    format?: 'email' | 'url' | 'link' | null
    max?: number | null
    min?: number | null
    allDay?: boolean
    default?: string | boolean | null
    addOptions?: { value?: string; label: ModelLabel }[]
    optionLabels?: Record<string, ModelLabel>
    removeOptions?: string[]
    restoreOptions?: string[]
  }
  | { op: 'field.remove'; type: string; key: string }
  | { op: 'field.restore'; type: string; key: string }
  | { op: 'field.order'; type: string; keys: string[] }
  | { op: 'purge'; types?: string[]; fields?: { type: string; key: string }[] }

/** What `applyModelOps` needs besides the document. @internal */
export interface ModelContext {
  /** The design's code-first types, as far as the document needs to know them. */
  design: { name: string; singleton: boolean; pathPrefix: string | null }[]
  limits: ModelLimits
  now: Date
  /**
   * Facts only the database knows, given by the caller for the types and fields the operations
   * touch. Keys are 'x_course' and 'x_course.price'. Absent means unknown, treated as "has
   * entries", "has values" and "has missing values" (the safe side).
   */
  counts?: { entries?: Record<string, number>; values?: Record<string, number>; missing?: Record<string, number> }
  /** True only for the server's own sweep: allows `purge`. */
  internal?: boolean
  /** How long a hidden thing waits before it may be deleted; default `MODEL_PURGE_AFTER_MS`. (The tests make it shorter.) */
  purgeAfterMs?: number
  /** The same for a hidden thing that held no content; default `MODEL_PURGE_EMPTY_AFTER_MS`. */
  purgeEmptyAfterMs?: number
}

/** The waits before the later deletion, when they are not the defaults. @internal */
export interface ModelPurgeTimes {
  purgeAfterMs?: number
  purgeEmptyAfterMs?: number
}

/** What an operation made safe on the way (a use of a removed field cleared, say). @internal */
export interface ModelNote {
  code: string
  message: string
  /** The index of the operation. */
  op: number
  type: string
  field?: string
}

/** A refused change: `code` is stable kebab-case, `message` plain English, `op` the index of the operation. @internal */
export class ModelProblem extends Error {
  readonly code: string
  readonly op: number
  readonly details?: Record<string, unknown>
  constructor(code: string, message: string, op: number, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ModelProblem'
    this.code = code
    this.op = op
    if (details) this.details = details
  }
}

// ---------------------------------------------------------------------------------------------
// Names (design section 3)

/** The longest type name, prefix included. */
const TYPE_NAME_MAX = 26
/** The longest column name Postgres needs us to keep uncut. */
const COLUMN_MAX = 30
/** The longest column a generated key may have: room for `_id`. */
const GENERATED_COLUMN_MAX = 27
const PREFIX_MAX = 40
const OPTION_VALUE_MAX = 40
const RESERVED_PREFIXES: readonly string[] = ['admin', 'api', 'home']
/** Fields the mapper makes itself. */
const MAPPER_KEYS: readonly string[] = ['slug', 'status', 'position']
/** Columns every table has. */
const SYSTEM_COLUMNS: readonly string[] = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'slug', 'status', 'position']

const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/
const TYPE_NAME = new RegExp(`^${CUSTOM_PREFIX}[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`)
const FIELD_KEY = /^[a-z][a-zA-Z0-9]*$/
const PAGE_PREFIX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const OPTION_VALUE = /^[a-z0-9][a-z0-9_-]*$/
const ICON = /^i-[a-z0-9]+(?:-[a-z0-9]+)*$/

const utf8 = (s: string): number => new TextEncoder().encode(s).length
const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const wordsOf = (s: string): string[] => fold(s).split(/[^a-z0-9]+/).filter(Boolean)
const cut = (s: string, max: number, tail: RegExp): string => s.slice(0, Math.max(0, max)).replace(tail, '')
const suffixOf = (kind: ModelFieldType): string => (kind === 'relation' || kind === 'media' || kind === 'file' ? '_id' : '')
const columnOf = (key: string, kind: ModelFieldType): string => snake(key) + suffixOf(kind)
/** The name of the Postgres type a select field makes. */
const choiceTypeName = (type: string, key: string): string => `${snake(type)}_${snake(key)}`

function isReservedKey(key: string): boolean {
  return RESERVED_FIELD_NAMES.has(key) || LIST_PARAMS.includes(key) || MAPPER_KEYS.includes(key) || key.startsWith('_')
}

function typeNameProblem(name: string): string | null {
  if (!TYPE_NAME.test(name)) return `"${name}" is not a type name: it is ${CUSTOM_PREFIX}, a letter, then lower-case letters, digits and single underscores`
  if (name.length > TYPE_NAME_MAX) return `"${name}" is longer than ${TYPE_NAME_MAX} characters`
  if (name.endsWith('_locales')) return `"${name}" ends with _locales, which names a translation table`
  if (name.includes('_to_')) return `"${name}" contains _to_, which names a relation table`
  return null
}

function fieldKeyProblem(key: string, kind: ModelFieldType): { code: string; message: string } | null {
  if (isReservedKey(key)) return { code: 'reserved-key', message: `"${key}" is a name tinyzoo uses itself. Pick another key` }
  if (!FIELD_KEY.test(key)) return { code: 'invalid-name', message: `"${key}" is not a field key: it starts with a lower-case letter and has only letters and digits` }
  if (columnOf(key, kind).length > COLUMN_MAX) return { code: 'invalid-name', message: `"${key}" is too long: its column would have more than ${COLUMN_MAX} characters` }
  return null
}

function prefixProblem(prefix: string): string | null {
  if (!PAGE_PREFIX.test(prefix)) return `"${prefix}" is not a page address part: lower-case letters and digits, with single dashes between`
  if (prefix.length > PREFIX_MAX) return `"${prefix}" is longer than ${PREFIX_MAX} characters`
  if (RESERVED_PREFIXES.includes(prefix)) return `"${prefix}" is an address tinyzoo uses itself`
  return null
}

/** Makes `base`, then `base-2`, `base-3`, … until the result is free, always within `max` characters. */
function freeSlug(base: string, taken: Iterable<string>, max: number, reserved: readonly string[] = []): string {
  const used = new Set(taken)
  for (let n = 1; ; n++) {
    const tail = n === 1 ? '' : `-${n}`
    const slug = cut(base, max - tail.length, /-+$/) + tail
    if (!used.has(slug) && !reserved.includes(slug)) return slug
  }
}

/**
 * The name of a new custom type from its label: `x_` and the words, without accents:
 * "Kurzy a školení" gives `x_kurzy_a_skoleni`. At most 26 characters. A number is added
 * (`x_kurzy2`) while the name is in `taken`.
 * @internal
 */
export function modelTypeName(label: string, taken: Iterable<string> = []): string {
  const used = new Set(taken)
  let key = wordsOf(label).filter((w) => w !== 'to').join('_')
  if (!/^[a-z]/.test(key)) key = 'type'
  const room = TYPE_NAME_MAX - CUSTOM_PREFIX.length
  for (let n = 1; ; n++) {
    const digits = n === 1 ? '' : String(n)
    let name = CUSTOM_PREFIX + cut(key, room - digits.length, /_+$/) + digits
    if (name.endsWith('_locales')) name = name.slice(0, -1)
    if (!used.has(name)) return name
  }
}

/**
 * The key of a new field from its label, in lower camel case without accents: "Datum zahájení"
 * gives `datumZahajeni`. Its column is at most 27 characters. A number is added while the key is in
 * `taken` or is a name tinyzoo uses.
 * @internal
 */
export function modelFieldKey(label: string, taken: Iterable<string> = []): string {
  const used = new Set(taken)
  let base = wordsOf(label).map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('')
  if (!/^[a-z]/.test(base)) base = 'field'
  for (let n = 1; ; n++) {
    const digits = n === 1 ? '' : String(n)
    let key = base
    while (key.length > 1 && snake(key).length > GENERATED_COLUMN_MAX - digits.length) key = key.slice(0, -1)
    key += digits
    if (!used.has(key) && !isReservedKey(key)) return key
  }
}

/**
 * The address part of a new type's pages from its label: "Kurzy a školení" gives
 * `kurzy-a-skoleni`. At most 40 characters. A number is added (`kurzy-2`) while the prefix is in
 * `taken` or is one tinyzoo uses.
 * @internal
 */
export function modelPagePrefix(label: string, taken: Iterable<string> = []): string {
  return freeSlug(wordsOf(label).join('-') || 'entries', taken, PREFIX_MAX, RESERVED_PREFIXES)
}

/** An empty model. @internal */
export function emptyModelDoc(): ModelDoc {
  return { format: MODEL_FORMAT, types: [] }
}

// ---------------------------------------------------------------------------------------------
// Reading a document

function labelSchema(max: number) {
  return z.record(
    z.string().regex(LANG, 'a language key looks like cs, en or pt-BR'),
    z.string().min(1, 'the text is empty').max(max, `the text is longer than ${max} characters`),
  ).refine((o) => Object.keys(o).length > 0, 'a label needs at least one language')
}

const docLabel = labelSchema(MODEL_LABEL_MAX)
const docHelp = labelSchema(MODEL_HELP_MAX)
const docDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'not a date')

const docFieldBase = {
  key: z.string().min(1),
  label: docLabel,
  help: docHelp.nullish(),
  removedAt: docDate.nullish(),
  removedEmpty: z.boolean().optional(),
}

const docOption = z.strictObject({
  value: z.string().regex(OPTION_VALUE, 'a choice value is lower-case letters, digits, dashes and underscores').refine((v) => utf8(v) <= OPTION_VALUE_MAX, `a choice value is at most ${OPTION_VALUE_MAX} bytes`),
  label: docLabel,
  removed: z.boolean().optional(),
})

const docField = z.discriminatedUnion('type', [
  z.strictObject({ ...docFieldBase, type: z.literal('text'), required: z.boolean().optional(), long: z.boolean().optional(), format: z.enum(['email', 'url', 'link']).nullish(), max: z.number().int().min(1).max(100000).nullish() }),
  z.strictObject({ ...docFieldBase, type: z.literal('richtext'), required: z.boolean().optional() }),
  z.strictObject({ ...docFieldBase, type: z.literal('number'), required: z.boolean().optional(), decimal: z.boolean().optional(), min: z.number().nullish(), max: z.number().nullish() }),
  z.strictObject({ ...docFieldBase, type: z.literal('boolean'), default: z.boolean().optional() }),
  z.strictObject({ ...docFieldBase, type: z.literal('datetime'), required: z.boolean().optional(), allDay: z.boolean().optional() }),
  z.strictObject({ ...docFieldBase, type: z.literal('select'), required: z.boolean().optional(), options: z.array(docOption), default: z.string().nullish() }),
  z.strictObject({ ...docFieldBase, type: z.literal('media') }),
  z.strictObject({ ...docFieldBase, type: z.literal('file') }),
  z.strictObject({ ...docFieldBase, type: z.literal('gallery') }),
  z.strictObject({ ...docFieldBase, type: z.literal('color'), required: z.boolean().optional() }),
  z.strictObject({ ...docFieldBase, type: z.literal('relation'), to: z.string().min(1) }),
], { error: () => `unknown kind of field (this tinyzoo knows ${MODEL_FIELD_TYPES.join(', ')})` })

const orderSchema = z.union([z.literal('manual'), z.strictObject({ by: z.string(), dir: z.enum(['asc', 'desc']) })])

const docType = z.strictObject({
  name: z.string(),
  label: docLabel,
  labelSingular: docLabel.nullish(),
  description: docHelp.nullish(),
  icon: z.string().max(80).nullish(),
  titleField: z.string(),
  page: z.strictObject({ prefix: z.string(), image: z.string().nullish(), summary: z.string().nullish() }).nullish(),
  publish: z.boolean().optional(),
  order: orderSchema.nullish(),
  listColumns: z.array(z.string()).nullish(),
  removedAt: docDate.nullish(),
  removedEmpty: z.boolean().optional(),
  fields: z.array(docField),
})

const docSchema = z.strictObject({ format: z.literal(MODEL_FORMAT), types: z.array(docType) })

const pathText = (path: readonly PropertyKey[]): string =>
  path.map((p, i) => (typeof p === 'number' ? `[${p}]` : (i ? '.' : '') + String(p))).join('')

const invalidDoc = (message: string): ModelProblem => new ModelProblem('invalid-doc', message, -1)

/**
 * Reads a model document from stored data and checks all of it: the format, the shape (unknown
 * keys are refused), the names, and the rules between types and fields. Throws a `ModelProblem`
 * with the code `invalid-doc` that says what is wrong.
 * @internal
 */
export function parseModelDoc(value: unknown): ModelDoc {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalidDoc('The model is not an object')
  const format = (value as { format?: unknown }).format
  if (typeof format === 'number' && format > MODEL_FORMAT) {
    throw invalidDoc(`The model was written by a newer tinyzoo: format ${format}, this one reads format ${MODEL_FORMAT}`)
  }
  if (format !== MODEL_FORMAT) throw invalidDoc(`The model has format ${String(format)}, this one reads format ${MODEL_FORMAT}`)
  let json: string
  try {
    json = JSON.stringify(value)
  } catch {
    throw invalidDoc('The model is not plain data')
  }
  if (utf8(json) > MODEL_DOC_MAX_BYTES) throw invalidDoc(`The model is larger than ${MODEL_DOC_MAX_BYTES / 1024} KB`)
  const parsed = docSchema.safeParse(value)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw invalidDoc(issue ? (issue.path.length ? `${pathText(issue.path)}: ${issue.message}` : issue.message) : 'The model is not valid')
  }
  const doc = parsed.data as ModelDoc
  const names = new Set<string>()
  doc.types.forEach((t, ti) => {
    const at = `types[${ti}]`
    const problem = typeNameProblem(t.name)
    if (problem) throw invalidDoc(`${at}.name: ${problem}`)
    if (names.has(t.name)) throw invalidDoc(`${at}.name: "${t.name}" is used by two types`)
    names.add(t.name)
    if (t.page) {
      const pp = prefixProblem(t.page.prefix)
      if (pp) throw invalidDoc(`${at}.page.prefix: ${pp}`)
    }
    const keys = new Set<string>()
    const columns = new Set<string>(SYSTEM_COLUMNS)
    t.fields.forEach((f, fi) => {
      const fat = `${at}.fields[${fi}]`
      const kp = fieldKeyProblem(f.key, f.type)
      if (kp) throw invalidDoc(`${fat}.key: ${kp.message}`)
      if (keys.has(f.key)) throw invalidDoc(`${fat}.key: "${f.key}" is used by two fields of "${t.name}"`)
      keys.add(f.key)
      const column = columnOf(f.key, f.type)
      if (columns.has(column)) throw invalidDoc(`${fat}.key: "${f.key}" would use the column ${column}, which is taken`)
      columns.add(column)
      if (f.type === 'select') {
        if (f.options.length === 0) throw invalidDoc(`${fat}.options: a select field needs at least one choice`)
        const values = new Set<string>()
        for (const o of f.options) {
          if (values.has(o.value)) throw invalidDoc(`${fat}.options: the choice "${o.value}" is there twice`)
          values.add(o.value)
        }
        if (f.default != null && !values.has(f.default)) throw invalidDoc(`${fat}.default: "${f.default}" is not one of the choices`)
      }
    })
    const title = t.fields.find((f) => f.key === t.titleField)
    if (!title || title.type !== 'text' || title.removedAt) {
      throw invalidDoc(`${at}.titleField: "${t.titleField}" is not a visible text field of "${t.name}"`)
    }
  })
  return doc
}

const docBytes = (doc: ModelDoc): number => utf8(JSON.stringify(doc))

// ---------------------------------------------------------------------------------------------
// The shape of an operation

const opLabel = z.record(z.string(), z.string())
const opOrder = orderSchema
const opFieldBase = { key: z.string().optional(), label: opLabel, help: opLabel.nullish() }
const opOption = z.strictObject({ value: z.string().optional(), label: opLabel })
const opRequired = { required: z.boolean().optional() }

const opField = z.discriminatedUnion('type', [
  z.strictObject({ ...opFieldBase, ...opRequired, type: z.literal('text'), long: z.boolean().optional(), format: z.enum(['email', 'url', 'link']).nullish(), max: z.number().nullish() }),
  z.strictObject({ ...opFieldBase, ...opRequired, type: z.literal('richtext') }),
  z.strictObject({ ...opFieldBase, ...opRequired, type: z.literal('number'), decimal: z.boolean().optional(), min: z.number().nullish(), max: z.number().nullish() }),
  z.strictObject({ ...opFieldBase, type: z.literal('boolean'), default: z.boolean().optional() }),
  z.strictObject({ ...opFieldBase, ...opRequired, type: z.literal('datetime'), allDay: z.boolean().optional() }),
  z.strictObject({ ...opFieldBase, ...opRequired, type: z.literal('select'), options: z.array(opOption), default: z.string().nullish() }),
  z.strictObject({ ...opFieldBase, type: z.literal('media') }),
  z.strictObject({ ...opFieldBase, type: z.literal('file') }),
  z.strictObject({ ...opFieldBase, type: z.literal('gallery') }),
  z.strictObject({ ...opFieldBase, ...opRequired, type: z.literal('color') }),
  z.strictObject({ ...opFieldBase, type: z.literal('relation'), to: z.string() }),
], { error: () => `unknown kind of field (use ${MODEL_FIELD_TYPES.join(', ')})` })

const opSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('type.add'),
    name: z.string().optional(),
    label: opLabel,
    labelSingular: opLabel.nullish(),
    description: opLabel.nullish(),
    icon: z.string().nullish(),
    page: z.strictObject({ prefix: z.string().optional() }).nullish(),
    publish: z.boolean().optional(),
    order: opOrder.nullish(),
    titleLabel: opLabel.optional(),
  }),
  z.strictObject({
    op: z.literal('type.update'),
    type: z.string(),
    label: opLabel.optional(),
    labelSingular: opLabel.nullish(),
    description: opLabel.nullish(),
    icon: z.string().nullish(),
    listColumns: z.array(z.string()).nullish(),
    order: opOrder.nullish(),
    page: z.strictObject({ image: z.string().nullish(), summary: z.string().nullish() }).optional(),
  }),
  z.strictObject({ op: z.literal('type.remove'), type: z.string() }),
  z.strictObject({ op: z.literal('type.restore'), type: z.string() }),
  z.strictObject({ op: z.literal('field.add'), type: z.string(), field: opField, after: z.string().optional() }),
  z.strictObject({
    op: z.literal('field.update'),
    type: z.string(),
    key: z.string(),
    label: opLabel.optional(),
    help: opLabel.nullish(),
    required: z.boolean().optional(),
    long: z.boolean().optional(),
    format: z.enum(['email', 'url', 'link']).nullish(),
    max: z.number().nullish(),
    min: z.number().nullish(),
    allDay: z.boolean().optional(),
    default: z.union([z.string(), z.boolean()]).nullish(),
    addOptions: z.array(opOption).optional(),
    optionLabels: z.record(z.string(), opLabel).optional(),
    removeOptions: z.array(z.string()).optional(),
    restoreOptions: z.array(z.string()).optional(),
  }),
  z.strictObject({ op: z.literal('field.remove'), type: z.string(), key: z.string() }),
  z.strictObject({ op: z.literal('field.restore'), type: z.string(), key: z.string() }),
  z.strictObject({ op: z.literal('field.order'), type: z.string(), keys: z.array(z.string()) }),
  z.strictObject({
    op: z.literal('purge'),
    types: z.array(z.string()).optional(),
    fields: z.array(z.strictObject({ type: z.string(), key: z.string() })).optional(),
  }),
], { error: () => 'unknown operation' })

// ---------------------------------------------------------------------------------------------
// Running operations

interface Run {
  doc: ModelDoc
  ctx: ModelContext
  notes: ModelNote[]
  /** The index of the operation that runs. */
  i: number
}

function fail(r: Run, code: string, message: string, details?: Record<string, unknown>): never {
  throw new ModelProblem(code, message, r.i, details)
}

const isHidden = (x: { removedAt?: string | null }): boolean => !!x.removedAt
const firstText = (label: ModelLabel | null | undefined): string | undefined => (label ? Object.values(label)[0] : undefined)
const typeText = (t: ModelType): string => `"${firstText(t.label) ?? t.name}"`
const fieldText = (f: ModelField): string => `"${firstText(f.label) ?? f.key}"`

function typeOf(r: Run, name: string, allowHidden = false): ModelType {
  if (r.ctx.design.some((d) => d.name === name)) fail(r, 'design-type', `"${name}" is part of the design. Its structure is not changed here`)
  const t = r.doc.types.find((x) => x.name === name)
  if (!t) fail(r, 'unknown-type', `There is no type "${name}"`)
  if (!allowHidden && isHidden(t)) fail(r, 'type-hidden', `${typeText(t)} is removed. Restore it first`)
  return t
}

function fieldOf(r: Run, t: ModelType, key: string, allowHidden = false): ModelField {
  const f = t.fields.find((x) => x.key === key)
  if (!f || (!allowHidden && isHidden(f))) fail(r, 'unknown-field', `${typeText(t)} has no field "${key}"`)
  return f
}

/** Checks a label's languages, texts and lengths. Help texts and descriptions are `kind: 'help'`. */
function checkLabel(r: Run, label: ModelLabel, what: string, kind: 'label' | 'help' = 'label'): void {
  const max = kind === 'label' ? MODEL_LABEL_MAX : MODEL_HELP_MAX
  const entries = Object.entries(label)
  if (entries.length === 0) fail(r, 'invalid-label', `${what} needs at least one language`)
  for (const [lang, text] of entries) {
    if (!LANG.test(lang)) fail(r, 'invalid-label', `${what}: "${lang}" is not a language key (use cs, en or pt-BR)`)
    if (text.trim() === '') fail(r, 'invalid-label', `${what}: the text for "${lang}" is empty`)
    if (text.length > max) fail(r, kind === 'label' ? 'limit-label' : 'limit-help', `${what}: the text for "${lang}" is longer than ${max} characters`)
  }
}

function checkOptionalLabel(r: Run, label: ModelLabel | null | undefined, what: string, kind: 'label' | 'help' = 'label'): void {
  if (label) checkLabel(r, label, what, kind)
}

function checkIcon(r: Run, icon: string | null | undefined): void {
  if (icon != null && (!ICON.test(icon) || icon.length > 80)) fail(r, 'invalid-icon', `"${icon}" is not an icon name (like i-lucide-book, at most 80 characters)`)
}

/** The names the database holds as types: each custom type's table and each select field's choice type. */
function databaseNames(doc: ModelDoc): Map<string, string> {
  const names = new Map<string, string>()
  for (const t of doc.types) if (!names.has(t.name)) names.set(t.name, `the type ${typeText(t)}`)
  for (const t of doc.types) {
    for (const f of t.fields) {
      if (f.type !== 'select') continue
      const name = choiceTypeName(t.name, f.key)
      if (!names.has(name)) names.set(name, `the choices of ${fieldText(f)} in ${typeText(t)}`)
    }
  }
  return names
}

const takenTypeNames = (r: Run): Set<string> => new Set([...r.doc.types.map((t) => t.name), ...r.ctx.design.map((d) => d.name)])

const takenPrefixes = (r: Run): Set<string> => {
  const set = new Set<string>()
  for (const t of r.doc.types) if (t.page) set.add(t.page.prefix)
  for (const d of r.ctx.design) if (d.pathPrefix !== null) set.add(d.pathPrefix)
  return set
}

/** Why `key` cannot be a new field of `t` of this kind, or null. */
function newKeyProblem(r: Run, t: ModelType, key: string, kind: ModelFieldType): { code: string; message: string } | null {
  const own = fieldKeyProblem(key, kind)
  if (own) return own
  const same = t.fields.find((f) => f.key === key)
  if (same) return { code: 'name-taken', message: `${typeText(t)} already has a field "${key}"${isHidden(same) ? ' (removed, not yet deleted)' : ''}` }
  const column = columnOf(key, kind)
  if (SYSTEM_COLUMNS.includes(column)) return { code: 'name-taken', message: `"${key}" would use the column ${column}, which tinyzoo keeps for itself` }
  const clash = t.fields.find((f) => columnOf(f.key, f.type) === column)
  if (clash) return { code: 'name-taken', message: `"${key}" would use the column ${column}, which the field "${clash.key}" of ${typeText(t)} has` }
  if (kind === 'select') {
    const owner = databaseNames(r.doc).get(choiceTypeName(t.name, key))
    if (owner) return { code: 'name-clash', message: `The choices of "${key}" would be named ${choiceTypeName(t.name, key)}, which is the name of ${owner}` }
  }
  return null
}

/** A relation may point at a collection of the design or a visible custom type. `self` is a type that is being restored. */
function checkTarget(r: Run, to: string, self?: string): void {
  if (to === self) return
  const design = r.ctx.design.find((d) => d.name === to)
  if (design) {
    if (design.singleton) fail(r, 'unknown-target', `"${to}" is a single page, not a collection. A relation points at a collection`)
    return
  }
  const t = r.doc.types.find((x) => x.name === to)
  if (!t) fail(r, 'unknown-target', `There is no collection "${to}" to point at`)
  if (isHidden(t)) fail(r, 'target-hidden', `${typeText(t)} is removed. Restore it first`)
}

const ORDER_KINDS: readonly ModelFieldType[] = ['text', 'number', 'datetime', 'select', 'boolean']

/** Checks the `by` of an order against the visible fields of a type. */
function checkOrder(r: Run, t: ModelType, order: ModelOrder | null | undefined): void {
  if (order == null || order === 'manual') return
  const f = t.fields.find((x) => x.key === order.by && !isHidden(x))
  if (!f) fail(r, 'unknown-field', `${typeText(t)} has no field "${order.by}" to order by`)
  if (!ORDER_KINDS.includes(f.type)) fail(r, 'invalid-op', `${fieldText(f)} is a ${f.type} field. Entries are ordered by text, number, date, choice or switch fields`)
}

function typeAdd(r: Run, op: Extract<ModelOp, { op: 'type.add' }>): void {
  const { doc, ctx } = r
  if (doc.types.length >= ctx.limits.types) fail(r, 'limit-types', `A site can have ${ctx.limits.types} content types at most (removed ones count until they are deleted)`)
  checkLabel(r, op.label, 'The label')
  checkOptionalLabel(r, op.labelSingular, 'The singular label')
  checkOptionalLabel(r, op.description, 'The description', 'help')
  checkOptionalLabel(r, op.titleLabel, 'The title label')
  checkIcon(r, op.icon)
  const text = firstText(op.label) ?? ''

  const taken = takenTypeNames(r)
  const owners = databaseNames(doc)
  let name: string
  if (op.name !== undefined) {
    name = op.name
    const problem = typeNameProblem(name)
    if (problem) fail(r, 'invalid-name', problem)
    if (taken.has(name)) fail(r, 'name-taken', `The name "${name}" is already used`)
    const owner = owners.get(name)
    if (owner) fail(r, 'name-clash', `The name "${name}" is already the name of ${owner}`)
  } else {
    name = modelTypeName(text, [...taken, ...owners.keys()])
  }

  let page: ModelPage | null = null
  if (op.page) {
    let prefix: string
    if (op.page.prefix !== undefined) {
      prefix = op.page.prefix
      const problem = prefixProblem(prefix)
      if (problem) fail(r, 'invalid-prefix', problem)
      if (takenPrefixes(r).has(prefix)) fail(r, 'prefix-taken', `The address "${prefix}" is already used by another type`)
    } else {
      prefix = modelPagePrefix(text, takenPrefixes(r))
    }
    page = { prefix, image: null, summary: null }
  }

  const titleKey = 'title'
  if (op.order && op.order !== 'manual' && op.order.by !== titleKey) {
    fail(r, 'unknown-field', `A new type has only the field "${titleKey}" to order by`)
  }

  doc.types.push({
    name,
    label: op.label,
    labelSingular: op.labelSingular ?? null,
    description: op.description ?? null,
    icon: op.icon ?? null,
    titleField: titleKey,
    page,
    publish: !!op.publish,
    order: op.order ?? null,
    listColumns: null,
    removedAt: null,
    fields: [{ key: titleKey, type: 'text', required: true, label: op.titleLabel ?? { cs: 'Název', en: 'Title', de: 'Titel' } }],
  })
}

function typeUpdate(r: Run, op: Extract<ModelOp, { op: 'type.update' }>): void {
  const t = typeOf(r, op.type)
  if (op.label !== undefined) checkLabel(r, op.label, 'The label')
  if (op.labelSingular !== undefined) checkOptionalLabel(r, op.labelSingular, 'The singular label')
  if (op.description !== undefined) checkOptionalLabel(r, op.description, 'The description', 'help')
  if (op.icon !== undefined) checkIcon(r, op.icon)

  if (op.listColumns != null) {
    const keys = op.listColumns
    if (keys.length < 1 || keys.length > 10) fail(r, 'invalid-op', `The list shows 1 to 10 columns, not ${keys.length}`)
    if (new Set(keys).size !== keys.length) fail(r, 'invalid-op', 'A column is in the list twice')
    for (const key of keys) {
      const ok = t.fields.some((f) => f.key === key && !isHidden(f)) || (key === 'slug' && !!t.page) || (key === 'status' && !!t.publish)
      if (!ok) fail(r, 'unknown-field', `${typeText(t)} has no column "${key}" to show`)
    }
  }

  if (op.order !== undefined) {
    if (op.order !== 'manual' && t.order === 'manual') {
      fail(r, 'order-manual', `${typeText(t)} is arranged by hand. Going back to an order by a field is not available yet`)
    }
    checkOrder(r, t, op.order)
  }

  if (op.page !== undefined) {
    const page = t.page
    if (!page) fail(r, 'no-page', `${typeText(t)} has no pages, so it has no page picture or summary`)
    if (op.page.image != null) {
      const f = t.fields.find((x) => x.key === op.page?.image && !isHidden(x))
      if (!f) fail(r, 'unknown-field', `${typeText(t)} has no field "${op.page.image}"`)
      if (f.type !== 'media') fail(r, 'invalid-op', `${fieldText(f)} is not a media field, so it cannot be the page picture`)
    }
    if (op.page.summary != null) {
      const f = t.fields.find((x) => x.key === op.page?.summary && !isHidden(x))
      if (!f) fail(r, 'unknown-field', `${typeText(t)} has no field "${op.page.summary}"`)
      if (f.type !== 'text') fail(r, 'invalid-op', `${fieldText(f)} is not a text field, so it cannot be the page summary`)
    }
    if (op.page.image !== undefined) page.image = op.page.image
    if (op.page.summary !== undefined) page.summary = op.page.summary
  }

  if (op.label !== undefined) t.label = op.label
  if (op.labelSingular !== undefined) t.labelSingular = op.labelSingular
  if (op.description !== undefined) t.description = op.description
  if (op.icon !== undefined) t.icon = op.icon
  if (op.listColumns !== undefined) t.listColumns = op.listColumns
  if (op.order !== undefined) t.order = op.order
}

function typeRemove(r: Run, op: Extract<ModelOp, { op: 'type.remove' }>): void {
  const t = typeOf(r, op.type, true)
  if (isHidden(t)) fail(r, 'already-removed', `${typeText(t)} is already removed`)
  const pointing: { type: string; key: string }[] = []
  for (const other of r.doc.types) {
    if (other === t || isHidden(other)) continue
    for (const f of other.fields) if (f.type === 'relation' && f.to === t.name && !isHidden(f)) pointing.push({ type: other.name, key: f.key })
  }
  if (pointing.length) {
    const where = pointing.map((p) => `"${p.key}" of "${p.type}"`).join(', ')
    fail(r, 'points-at-type', `${typeText(t)} cannot be removed while other types point at it: ${where}`, { fields: pointing })
  }
  t.removedAt = r.ctx.now.toISOString()
  t.removedEmpty = r.ctx.counts?.entries?.[t.name] === 0
}

function typeRestore(r: Run, op: Extract<ModelOp, { op: 'type.restore' }>): void {
  const t = typeOf(r, op.type, true)
  if (!isHidden(t)) fail(r, 'not-removed', `${typeText(t)} is not removed`)
  if (t.page && r.ctx.design.some((d) => d.pathPrefix === t.page?.prefix)) {
    fail(r, 'prefix-taken', `The address "${t.page.prefix}" of ${typeText(t)} is used by the design now`)
  }
  for (const f of t.fields) if (f.type === 'relation' && !isHidden(f)) checkTarget(r, f.to, t.name)
  t.removedAt = null
  delete t.removedEmpty
}

/** The value of a choice made from its label, free among `used`. */
function optionValue(label: ModelLabel, used: Set<string>): string {
  const value = freeSlug(wordsOf(firstText(label) ?? '').join('-') || 'option', used, OPTION_VALUE_MAX)
  used.add(value)
  return value
}

/** Checks one choice the caller gave and returns it with its value. */
function newOption(r: Run, option: { value?: string; label: ModelLabel }, used: Set<string>): ModelOption {
  checkLabel(r, option.label, 'The label of a choice')
  if (option.value === undefined) return { value: optionValue(option.label, used), label: option.label }
  const v = option.value
  if (!OPTION_VALUE.test(v) || utf8(v) > OPTION_VALUE_MAX) fail(r, 'invalid-option', `"${v}" is not a choice value: lower-case letters, digits, dashes and underscores, at most ${OPTION_VALUE_MAX} bytes`)
  if (used.has(v)) fail(r, 'invalid-option', `The choice "${v}" is there twice`)
  used.add(v)
  return { value: v, label: option.label }
}

function fieldAdd(r: Run, op: Extract<ModelOp, { op: 'field.add' }>): void {
  const t = typeOf(r, op.type)
  const input = op.field
  if (t.fields.length >= r.ctx.limits.fields) fail(r, 'limit-fields', `${typeText(t)} can have ${r.ctx.limits.fields} fields at most (removed ones count until they are deleted)`)
  checkLabel(r, input.label, 'The label')
  checkOptionalLabel(r, input.help, 'The help text', 'help')
  const kind = input.type

  let key: string
  if (input.key !== undefined) {
    key = input.key
    const problem = newKeyProblem(r, t, key, kind)
    if (problem) fail(r, problem.code, problem.message)
  } else {
    const skip = new Set(t.fields.map((f) => f.key))
    const text = firstText(input.label) ?? ''
    for (;;) {
      key = modelFieldKey(text, skip)
      if (!newKeyProblem(r, t, key, kind)) break
      skip.add(key)
    }
  }

  let field: ModelField
  switch (input.type) {
    case 'select': {
      const max = r.ctx.limits.options
      if (input.options.length < 1) fail(r, 'limit-options', 'A choice field needs at least one choice')
      if (input.options.length > max) fail(r, 'limit-options', `A choice field can have ${max} choices at most`)
      const used = new Set<string>()
      const given = input.options.map((o) => (o.value !== undefined ? newOption(r, o, used) : undefined))
      const options = input.options.map((o, n) => given[n] ?? newOption(r, o, used))
      if (input.default != null && !options.some((o) => o.value === input.default)) fail(r, 'invalid-option', `The default "${input.default}" is not one of the choices`)
      field = { ...input, key, options }
      break
    }
    case 'text':
      if (input.max != null && (!Number.isInteger(input.max) || input.max < 1 || input.max > 100000)) fail(r, 'invalid-op', 'The longest text is a whole number from 1 to 100000')
      field = { ...input, key }
      break
    case 'number':
      if (input.min != null && input.max != null && input.min > input.max) fail(r, 'invalid-op', 'The smallest number is above the largest')
      field = { ...input, key }
      break
    case 'relation':
      checkTarget(r, input.to)
      field = { ...input, key }
      break
    default:
      field = { ...input, key } as ModelField
  }

  const entriesKnownEmpty = r.ctx.counts?.entries?.[t.name] === 0
  const hasDefault = field.type === 'select' && field.default != null
  if (!entriesKnownEmpty && 'required' in field && field.required === true && !hasDefault) {
    fail(r, 'needs-optional', `${fieldText(field)} cannot be required: ${typeText(t)} may have entries without it. Add it as optional`)
  }

  if (op.after === undefined) {
    t.fields.push(field)
  } else {
    const at = t.fields.findIndex((f) => f.key === op.after && !isHidden(f))
    if (at < 0) fail(r, 'unknown-field', `${typeText(t)} has no field "${op.after}" to put the new field after`)
    t.fields.splice(at + 1, 0, field)
  }
}

const UPDATE_KEYS = ['required', 'long', 'format', 'max', 'min', 'allDay', 'default', 'addOptions', 'optionLabels', 'removeOptions', 'restoreOptions'] as const
const UPDATE_ALLOWED: Record<ModelFieldType, readonly string[]> = {
  text: ['required', 'long', 'format', 'max'],
  richtext: ['required'],
  number: ['required', 'min', 'max'],
  boolean: ['default'],
  datetime: ['required', 'allDay'],
  select: ['required', 'default', 'addOptions', 'optionLabels', 'removeOptions', 'restoreOptions'],
  media: [],
  file: [],
  gallery: [],
  color: ['required'],
  relation: [],
}

function fieldUpdate(r: Run, op: Extract<ModelOp, { op: 'field.update' }>): void {
  const t = typeOf(r, op.type)
  const f = fieldOf(r, t, op.key)
  const name = `${fieldText(f)}`
  for (const k of UPDATE_KEYS) {
    if (op[k] !== undefined && !UPDATE_ALLOWED[f.type].includes(k)) fail(r, 'invalid-op', `"${k}" does not belong to ${name}, which is a ${f.type} field`)
  }
  if (op.label !== undefined) checkLabel(r, op.label, 'The label')
  if (op.help != null) checkLabel(r, op.help, 'The help text', 'help')

  if (op.required !== undefined) {
    const was = (f as { required?: boolean }).required === true
    if (op.required === false && op.key === t.titleField) fail(r, 'title-field', `${name} names every entry of ${typeText(t)}, so it stays required`)
    if (op.required && !was) {
      const k = `${t.name}.${f.key}`
      const missing = r.ctx.counts?.missing?.[k]
      if (missing !== 0) {
        fail(r, 'has-missing-values', `${name} cannot be required yet: ${missing === undefined ? 'some' : missing} entries of ${typeText(t)} have no value for it`, { missing: missing ?? null })
      }
    }
    ;(f as { required?: boolean }).required = op.required
  }
  if (op.label !== undefined) f.label = op.label
  if (op.help !== undefined) f.help = op.help

  switch (f.type) {
    case 'text':
      if (op.long !== undefined) f.long = op.long
      if (op.format !== undefined) f.format = op.format
      if (op.max !== undefined) {
        if (op.max !== null && (!Number.isInteger(op.max) || op.max < 1 || op.max > 100000)) fail(r, 'invalid-op', 'The longest text is a whole number from 1 to 100000')
        f.max = op.max
      }
      break
    case 'number': {
      const min = op.min !== undefined ? op.min : f.min
      const max = op.max !== undefined ? op.max : f.max
      if (min != null && max != null && min > max) fail(r, 'invalid-op', 'The smallest number is above the largest')
      if (op.min !== undefined) f.min = op.min
      if (op.max !== undefined) f.max = op.max
      break
    }
    case 'datetime':
      if (op.allDay !== undefined) f.allDay = op.allDay
      break
    case 'boolean':
      if (op.default !== undefined) {
        if (typeof op.default !== 'boolean') fail(r, 'invalid-op', 'The default of a switch is on or off')
        f.default = op.default
      }
      break
    case 'select':
      updateOptions(r, op, t, f)
      break
    default:
  }
}

function updateOptions(r: Run, op: Extract<ModelOp, { op: 'field.update' }>, t: ModelType, f: Extract<ModelField, { type: 'select' }>): void {
  const options = f.options
  const find = (value: string): ModelOption => {
    const o = options.find((x) => x.value === value)
    if (!o) fail(r, 'invalid-option', `${fieldText(f)} has no choice "${value}"`)
    return o
  }
  for (const [value, label] of Object.entries(op.optionLabels ?? {})) {
    checkLabel(r, label, 'The label of a choice')
    find(value).label = label
  }
  for (const value of op.restoreOptions ?? []) {
    const o = find(value)
    if (!o.removed) fail(r, 'invalid-option', `The choice "${value}" is not removed`)
    delete o.removed
  }
  if (op.addOptions?.length) {
    if (options.length + op.addOptions.length > r.ctx.limits.options) fail(r, 'limit-options', `A choice field can have ${r.ctx.limits.options} choices at most (removed ones count)`)
    const used = new Set(options.map((o) => o.value))
    for (const o of op.addOptions) options.push(newOption(r, o, used))
  }
  for (const value of op.removeOptions ?? []) {
    const o = find(value)
    if (o.removed) fail(r, 'invalid-option', `The choice "${value}" is already removed`)
    if (options.filter((x) => !x.removed).length <= 1) fail(r, 'last-option', `${fieldText(f)} needs at least one choice. Add another before removing "${value}"`)
    o.removed = true
  }
  if (op.default !== undefined) {
    if (op.default !== null && typeof op.default !== 'string') fail(r, 'invalid-op', 'The default of a choice field is one of its choices, or nothing')
    if (op.default !== null && !options.some((o) => o.value === op.default && !o.removed)) fail(r, 'invalid-option', `The default "${op.default}" is not one of the offered choices`)
    f.default = op.default
  } else if (f.default != null && options.find((o) => o.value === f.default)?.removed) {
    r.notes.push({ code: 'default-cleared', message: `The default of ${fieldText(f)} was "${f.default}", which is removed. It has no default now`, op: r.i, type: t.name, field: f.key })
    f.default = null
  }
}

function fieldRemove(r: Run, op: Extract<ModelOp, { op: 'field.remove' }>): void {
  const t = typeOf(r, op.type)
  if (MAPPER_KEYS.includes(op.key)) fail(r, 'system-field', `"${op.key}" is made by tinyzoo itself and cannot be removed`)
  const f = fieldOf(r, t, op.key, true)
  if (op.key === t.titleField) fail(r, 'title-field', `${fieldText(f)} names every entry of ${typeText(t)} and cannot be removed`)
  if (isHidden(f)) fail(r, 'already-removed', `${fieldText(f)} is already removed`)
  f.removedAt = r.ctx.now.toISOString()
  f.removedEmpty = r.ctx.counts?.values?.[`${t.name}.${f.key}`] === 0

  // Only the type's own uses of the field are cleared here. Whether a block shows the field,
  // orders by it, or content links to it is for the server to check before it runs the change:
  // those places are in the stored content, which this module does not see.
  const note = (code: string, message: string): void => {
    r.notes.push({ code, message, op: r.i, type: t.name, field: f.key })
  }
  if (t.listColumns?.includes(f.key)) {
    const rest = t.listColumns.filter((k) => k !== f.key)
    t.listColumns = rest.length ? rest : null
    note('list-column-cleared', `${fieldText(f)} is no longer a column of the list of ${typeText(t)}`)
  }
  if (t.order && t.order !== 'manual' && t.order.by === f.key) {
    t.order = null
    note('order-cleared', `${typeText(t)} is no longer ordered by ${fieldText(f)}`)
  }
  if (t.page?.image === f.key) {
    t.page.image = null
    note('page-image-cleared', `${fieldText(f)} is no longer the page picture of ${typeText(t)}`)
  }
  if (t.page?.summary === f.key) {
    t.page.summary = null
    note('page-summary-cleared', `${fieldText(f)} is no longer the page summary of ${typeText(t)}`)
  }
}

function fieldRestore(r: Run, op: Extract<ModelOp, { op: 'field.restore' }>): void {
  const t = typeOf(r, op.type)
  const f = fieldOf(r, t, op.key, true)
  if (!isHidden(f)) fail(r, 'not-removed', `${fieldText(f)} is not removed`)
  if (f.type === 'relation') checkTarget(r, f.to)
  f.removedAt = null
  delete f.removedEmpty
  const asRequired = f as { required?: boolean }
  if (asRequired.required === true && r.ctx.counts?.missing?.[`${t.name}.${f.key}`] !== 0) {
    asRequired.required = false
    r.notes.push({ code: 'restored-optional', message: `${fieldText(f)} is optional again: entries were saved without it while it was removed`, op: r.i, type: t.name, field: f.key })
  }
}

function fieldOrder(r: Run, op: Extract<ModelOp, { op: 'field.order' }>): void {
  const t = typeOf(r, op.type)
  const visible = t.fields.filter((f) => !isHidden(f))
  const same = op.keys.length === visible.length && new Set(op.keys).size === op.keys.length && visible.every((f) => op.keys.includes(f.key))
  if (!same) fail(r, 'invalid-op', `The order must name each visible field of ${typeText(t)} once (${visible.map((f) => f.key).join(', ')})`)
  const byKey = new Map(visible.map((f) => [f.key, f]))
  const next = op.keys.map((k) => byKey.get(k) as ModelField)
  let n = 0
  t.fields = t.fields.map((f) => (isHidden(f) ? f : (next[n++] as ModelField)))
}

// Purge

/** A hidden thing is due once it has been hidden long enough (an hour when it held nothing). */
function isDue(item: { removedAt?: string | null; removedEmpty?: boolean }, now: Date, times: ModelPurgeTimes = {}): boolean {
  if (!item.removedAt) return false
  const age = now.getTime() - Date.parse(item.removedAt)
  if (Number.isNaN(age)) return false
  const after = times.purgeAfterMs ?? MODEL_PURGE_AFTER_MS
  const empty = times.purgeEmptyAfterMs ?? MODEL_PURGE_EMPTY_AFTER_MS
  return age >= after || (item.removedEmpty === true && age >= empty)
}

const fieldId = (type: string, key: string): string => `${type}.${key}`

/** Relation fields of types that stay, pointing at a purged type, that are not purged with it. */
function purgeBlockers(doc: ModelDoc, types: Set<string>, fields: Set<string>): { type: string; key: string; to: string }[] {
  const found: { type: string; key: string; to: string }[] = []
  for (const t of doc.types) {
    if (types.has(t.name)) continue
    for (const f of t.fields) {
      if (f.type === 'relation' && types.has(f.to) && !fields.has(fieldId(t.name, f.key))) found.push({ type: t.name, key: f.key, to: f.to })
    }
  }
  return found
}

function purge(r: Run, op: Extract<ModelOp, { op: 'purge' }>): void {
  if (r.ctx.internal !== true) fail(r, 'internal-only', 'Deleting removed things for good is done by the server only')
  const types = new Set<string>()
  for (const name of op.types ?? []) {
    const t = typeOf(r, name, true)
    if (!isHidden(t)) fail(r, 'not-removed', `${typeText(t)} is not removed`)
    if (!isDue(t, r.ctx.now, r.ctx)) fail(r, 'not-due', `${typeText(t)} was removed too recently to be deleted`)
    types.add(name)
  }
  const fields = new Set<string>()
  for (const ref of op.fields ?? []) {
    if (types.has(ref.type)) continue
    const t = typeOf(r, ref.type, true)
    const f = fieldOf(r, t, ref.key, true)
    if (!isHidden(f)) fail(r, 'not-removed', `${fieldText(f)} in ${typeText(t)} is not removed`)
    if (!isDue(f, r.ctx.now, r.ctx)) fail(r, 'not-due', `${fieldText(f)} in ${typeText(t)} was removed too recently to be deleted`)
    fields.add(fieldId(ref.type, ref.key))
  }
  const blockers = purgeBlockers(r.doc, types, fields)
  if (blockers.length) {
    const where = blockers.map((b) => `"${b.key}" of "${b.type}" points at "${b.to}"`).join(', ')
    fail(r, 'points-at-type', `A type cannot be deleted while a field points at it: ${where}`, { fields: blockers.map((b) => ({ type: b.type, key: b.key })) })
  }
  r.doc.types = r.doc.types.filter((t) => !types.has(t.name))
  for (const t of r.doc.types) t.fields = t.fields.filter((f) => !fields.has(fieldId(t.name, f.key)))
}

/**
 * What the server's sweep may delete for good now: every removed type that is due, and every
 * removed field that is due on a type that stays. A type that a field outside the purge still
 * points at is left out, so `applyModelOps` with this as a `purge` operation does not refuse it.
 * `times` are the waits, when they are not the defaults (give `applyModelOps` the same).
 * @internal
 */
export function modelPurgeDue(doc: ModelDoc, now: Date, times: ModelPurgeTimes = {}): { types: string[]; fields: { type: string; key: string }[] } {
  const types = new Set(doc.types.filter((t) => isDue(t, now, times)).map((t) => t.name))
  const fieldsFor = (): { type: string; key: string }[] =>
    doc.types.filter((t) => !types.has(t.name)).flatMap((t) => t.fields.filter((f) => isDue(f, now, times)).map((f) => ({ type: t.name, key: f.key })))
  for (;;) {
    const ids = new Set(fieldsFor().map((f) => fieldId(f.type, f.key)))
    const held = new Set(purgeBlockers(doc, types, ids).map((b) => b.to))
    if (held.size === 0) break
    for (const name of held) types.delete(name)
  }
  return { types: doc.types.filter((t) => types.has(t.name)).map((t) => t.name), fields: fieldsFor() }
}

// ---------------------------------------------------------------------------------------------
// The entry point

/** Changes that are not in the first version, by operation: what the call must not carry. */
const NOT_CHANGEABLE: Record<string, readonly string[]> = {
  'type.update': ['name', 'publish', 'titleField'],
  'field.update': ['to', 'decimal', 'newKey', 'kind', 'fieldType'],
}

function checkChangeable(raw: unknown, i: number): void {
  if (typeof raw !== 'object' || raw === null) return
  const op = (raw as { op?: unknown }).op
  if (typeof op !== 'string') return
  const record = raw as Record<string, unknown>
  for (const key of NOT_CHANGEABLE[op] ?? []) {
    if (key in record) throw new ModelProblem('not-changeable', `"${key}" cannot be changed after it is made. Add a new ${op === 'type.update' ? 'type' : 'field'} instead`, i)
  }
  if (op === 'type.update' && 'page' in record) {
    const page = record.page
    if (page === null) throw new ModelProblem('not-changeable', 'Pages cannot be switched off after the type is made', i)
    if (typeof page === 'object' && page !== null && 'prefix' in page) throw new ModelProblem('not-changeable', 'The address of the pages cannot be changed after the type is made', i)
  }
}

/**
 * Applies operations to a document and returns the new document and what was made safe on the
 * way. Nothing is changed in place. All or nothing: the first refused operation throws a
 * `ModelProblem` with its code and the index of the operation. Facts only the database knows
 * (entry counts) come from `ctx.counts`; absent means "not empty".
 * @internal
 */
export function applyModelOps(doc: ModelDoc, ops: ModelOp[], ctx: ModelContext): { doc: ModelDoc; notes: ModelNote[] } {
  const run: Run = { doc: structuredClone(doc), ctx, notes: [], i: 0 }
  ops.forEach((raw, i) => {
    run.i = i
    checkChangeable(raw, i)
    const parsed = opSchema.safeParse(raw)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ModelProblem('invalid-op', issue ? `The change is not valid${issue.path.length ? ` (${pathText(issue.path)})` : ''}: ${issue.message}` : 'The change is not valid', i)
    }
    const op = parsed.data as ModelOp
    switch (op.op) {
      case 'type.add': typeAdd(run, op); break
      case 'type.update': typeUpdate(run, op); break
      case 'type.remove': typeRemove(run, op); break
      case 'type.restore': typeRestore(run, op); break
      case 'field.add': fieldAdd(run, op); break
      case 'field.update': fieldUpdate(run, op); break
      case 'field.remove': fieldRemove(run, op); break
      case 'field.restore': fieldRestore(run, op); break
      case 'field.order': fieldOrder(run, op); break
      case 'purge': purge(run, op); break
    }
    if (docBytes(run.doc) > MODEL_DOC_MAX_BYTES) fail(run, 'limit-size', `The model is larger than ${MODEL_DOC_MAX_BYTES / 1024} KB`)
  })
  return { doc: parseModelDoc(run.doc), notes: run.notes }
}
