import { eq } from 'drizzle-orm'
import type { AnyFieldDescriptor } from './descriptor'
import { buildRegistry, defineEntity, type CmsEntity, type CmsRegistry, type Entity } from './entity'
import { camel, f, snake } from './fields'
import { CUSTOM_PREFIX, type ModelDoc, type ModelField, type ModelType } from './model-doc'

/** Something the mapper left out or could not build: the type, the field when it is one, and why. @internal */
export interface ModelMapProblem {
  type: string
  field?: string
  message: string
}

const UNKNOWN_NAME = '(unnamed)'

const URL_ADDRESS = { en: 'URL address', cs: 'Adresa (URL)', de: 'Adresse (URL)' }
const STATUS = { en: 'Status', cs: 'Stav', de: 'Status' }
const POSITION = { en: 'Position', cs: 'Pořadí', de: 'Reihenfolge' }
const STATUS_LABELS = {
  draft: { en: 'Draft', cs: 'Koncept', de: 'Entwurf' },
  published: { en: 'Published', cs: 'Zveřejněno', de: 'Veröffentlicht' },
}

/** The types that are built together: by name, with the entities made so far (relations read them lazily). */
interface Build {
  /** The design's registry. */
  design: CmsRegistry
  /** The custom types a relation may point at in this pass. */
  alive: Map<string, ModelType>
  /** The entities of this pass, filled as they are built. */
  built: Record<string, Entity>
  withHidden: boolean
}

const asAny = <T>(v: unknown): T => v as T

/** The descriptor of one document field, or a reason to leave it out. */
function buildField(field: ModelField, build: Build): { descriptor: AnyFieldDescriptor } | { problem: string } {
  const hidden = build.withHidden && !!field.removedAt
  // A hidden field keeps its column and loses NOT NULL, so the plan can say so. Booleans and
  // galleries always hold a value (their default), so they have no NOT NULL to lose.
  const forceOptional = hidden && field.type !== 'boolean' && field.type !== 'gallery'
  const required = !forceOptional && 'required' in field && !!field.required
  const optionalUnlessRequired = (d: AnyFieldDescriptor): AnyFieldDescriptor => (required ? d : asAny<{ optional: () => AnyFieldDescriptor }>(d).optional())
  let d: AnyFieldDescriptor
  switch (field.type) {
    case 'text': {
      const o: { required?: boolean; format?: 'email' | 'url' | 'link'; multiline?: boolean; max?: number } = {}
      if (required) o.required = true
      if (field.format) o.format = field.format
      if (field.long) o.multiline = true
      if (field.max != null) o.max = field.max
      d = optionalUnlessRequired(f.text(o))
      break
    }
    case 'richtext':
      d = optionalUnlessRequired(f.richtext())
      break
    case 'number': {
      const o: { int?: false; min?: number; max?: number } = {}
      if (field.decimal) o.int = false
      if (field.min != null) o.min = field.min
      if (field.max != null) o.max = field.max
      d = optionalUnlessRequired(f.number(o))
      break
    }
    case 'boolean':
      d = f.boolean({ default: field.default ?? false })
      break
    case 'datetime':
      d = optionalUnlessRequired(f.datetime(field.allDay ? { allDay: true } : {}))
      break
    case 'select': {
      const options = field.options.map((o) => o.value)
      const labels: Record<string, Record<string, string>> = {}
      for (const o of field.options) labels[o.value] = o.label
      const o: { options: [string, ...string[]]; default?: string; labels: Record<string, Record<string, string>> } = { options: asAny(options), labels }
      if (field.default != null) o.default = field.default
      d = optionalUnlessRequired(asAny<(o: unknown) => AnyFieldDescriptor>(f.select)(o))
      break
    }
    case 'media':
      // A picture, a file and a relation are always optional (see ModelField).
      d = f.media({ accept: 'image/*' }).optional()
      break
    case 'file':
      d = f.file().optional()
      break
    case 'gallery':
      d = f.gallery()
      break
    case 'color':
      d = optionalUnlessRequired(f.color(required ? { required: true } : {}))
      break
    case 'relation': {
      const to = field.to
      const target = typeof to === 'string' ? to : ''
      let thunk: (() => unknown) | null = null
      if (build.alive.has(target)) {
        thunk = () => build.built[target]
      }
      else {
        const entity = build.design.byName.get(target)
        if (entity && !entity.singleton) thunk = () => entity
        else if (target.startsWith(CUSTOM_PREFIX)) return { problem: `its relation points at "${target}", a custom type that is not available here (it is hidden, left out or does not exist), so the field is left out` }
        else if (entity) return { problem: `its relation points at "${target}", a single page, and a relation needs a collection, so the field is left out` }
        else return { problem: `its relation points at "${target}", which is not a collection of this site, so the field is left out` }
      }
      d = f.relation({ to: thunk, kind: 'many-to-one' }) as AnyFieldDescriptor
      break
    }
    default:
      return { problem: `its kind "${String((field as { type?: unknown }).type)}" is not known to this version, so the field is left out` }
  }
  d = asAny<{ label: (t: unknown) => AnyFieldDescriptor }>(d).label(field.label)
  if (field.help) d = asAny<{ help: (t: unknown) => AnyFieldDescriptor }>(d).help(field.help)
  // A removed choice stays a value of the field (entries hold it, and the database keeps it), so it
  // is still an option here. The admin reads this list and stops offering those.
  const removed = field.type === 'select' ? field.options.filter((o) => o.removed).map((o) => o.value) : []
  if (removed.length) d = { ...d, meta: { ...d.meta, removedOptions: removed } }
  return { descriptor: d }
}

/** The entity of one type, with the problems of its fields. Throws what `defineEntity` throws. */
function buildType(t: ModelType, build: Build, problems: ModelMapProblem[]): Entity {
  const fields: Record<string, AnyFieldDescriptor> = {}
  const docKeys: string[] = []
  for (const field of t.fields ?? []) {
    if (!build.withHidden && field.removedAt) continue
    const made = buildField(field, build)
    if ('problem' in made) {
      problems.push({ type: t.name, field: field.key, message: `The field "${field.key}" of "${t.name}": ${made.problem}.` })
      continue
    }
    fields[field.key] = made.descriptor
    if (!(field.type === 'richtext' || field.type === 'gallery')) docKeys.push(field.key)
  }
  const page = t.page ?? null
  const publish = !!t.publish
  const manual = t.order === 'manual'
  const extra: Record<string, AnyFieldDescriptor> = {}
  if (page) extra.slug = f.slug({ from: t.titleField, unique: true }).label(URL_ADDRESS)
  if (publish) {
    extra.status = f.select({ options: ['draft', 'published'], default: 'draft', labels: STATUS_LABELS }).label(STATUS)
  }
  if (manual) extra.position = f.number().optional().label(POSITION)
  for (const key of Object.keys(extra)) {
    if (!fields[key]) continue
    problems.push({ type: t.name, field: key, message: `The field "${key}" of "${t.name}" has the name of a field tinyzoo adds itself here, so tinyzoo's field is used.` })
    const at = docKeys.indexOf(key)
    if (at >= 0) docKeys.splice(at, 1)
  }
  Object.assign(fields, extra)

  if (!fields[t.titleField]) throw new Error(`the title field "${t.titleField}" is not a field of "${t.name}"`)

  const listed = Array.isArray(t.listColumns) ? t.listColumns.filter((k) => typeof k === 'string' && fields[k]) : []
  const columns = listed.length
    ? listed
    : [t.titleField, ...docKeys.filter((k) => k !== t.titleField).slice(0, 3)]

  const path = page ? `/${page.prefix}/:slug` : undefined
  const def = {
    label: t.label,
    ...(t.labelSingular != null ? { labelSingular: t.labelSingular } : {}),
    ...(t.description != null ? { description: t.description } : {}),
    ...(t.icon != null ? { icon: t.icon } : {}),
    titleField: t.titleField,
    fields,
    admin: { list: { columns, ...(manual ? { orderField: 'position' } : {}) } },
    content: {
      public: true,
      ...(page ? { slug: 'slug', path } : {}),
      ...(publish ? { published: (tbl: any) => eq(tbl.status, 'published') } : {}),
    },
    ...(publish ? { publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', ...(path ? { preview: path } : {}) } } : {}),
  }
  return defineEntity(t.name, asAny(def))
}

/** Every database and schema name a type takes, as `[camelCase, sql]` pairs. */
function namesOf(t: ModelType, withHidden: boolean): [string, string][] {
  const name = snake(t.name)
  const names: [string, string][] = [[camel(t.name), name], [camel(`${t.name}_locales`), `${name}_locales`]]
  for (const field of t.fields ?? []) {
    if (field.type !== 'select' || (!withHidden && field.removedAt)) continue
    const sql = `${name}_${snake(field.key)}`
    names.push([camel(sql), sql])
  }
  return names
}

/** The same pairs for what the design's registry holds. */
function designNames(reg: CmsRegistry): Map<string, string> {
  const taken = new Map<string, string>()
  const add = (ts: string, sql: string, what: string) => {
    taken.set(`ts:${ts}`, what)
    taken.set(`sql:${sql}`, what)
  }
  for (const e of reg.entities) {
    add(camel(e.name), snake(e.name), `"${e.name}"`)
    if (e.localesTable) add(`${camel(e.name)}Locales`, `${snake(e.name)}_locales`, `the translations of "${e.name}"`)
    for (const en of e.enums) add(en.varName, en.enumName, `the choices of "${en.key}" in "${e.name}"`)
  }
  for (const j of reg.junctions) add(camel(j.name), j.tableName, `the relation table ${j.tableName}`)
  return taken
}

/**
 * The entities of a site's own content types, built from its model document through
 * `defineEntity` and `f.*`, as a developer would write them. `design` is what the design's
 * `cms.config.ts` exports. Pure: no database, no environment.
 *
 * A hidden type or field is left out, unless `withHidden` is set: that build is for planning
 * database statements, and makes every hidden field optional (hiding keeps the column and
 * drops NOT NULL).
 *
 * It never throws. A type or field that cannot be built is left out and named in `problems`;
 * the rest is built, so a site loads even with a broken document. When the types together do
 * not make a valid model, `entities` is empty.
 *
 * @internal
 */
export function modelEntities(
  doc: ModelDoc,
  design: Record<string, unknown>,
  opts: { withHidden?: boolean } = {},
): { entities: Record<string, Entity>; problems: ModelMapProblem[] } {
  const types: ModelType[] = Array.isArray(doc?.types) ? doc.types : []
  const everyType = (message: string): ModelMapProblem[] => types.map((t) => ({ type: typeName(t), message }))
  try {
    return map(types, design, !!opts.withHidden)
  }
  catch (err) {
    return { entities: {}, problems: everyType(`The custom types could not be built: ${messageOf(err)}`) }
  }
}

const typeName = (t: ModelType): string => (typeof t?.name === 'string' ? t.name : UNKNOWN_NAME)
const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

function map(types: ModelType[], design: Record<string, unknown>, withHidden: boolean): { entities: Record<string, Entity>; problems: ModelMapProblem[] } {
  let reg: CmsRegistry
  try {
    reg = buildRegistry(design)
  }
  catch (err) {
    return { entities: {}, problems: types.map((t) => ({ type: typeName(t), message: `The design's own content model is not valid, so the custom types are not loaded: ${messageOf(err)}` })) }
  }

  const problems: ModelMapProblem[] = []
  const taken = designNames(reg)
  const designEntity = new Map(reg.entities.map((e: CmsEntity) => [e.name, e]))
  let alive: ModelType[] = []
  for (const t of types) {
    const name = typeName(t)
    if (typeof t?.name !== 'string' || !t.name.startsWith(CUSTOM_PREFIX)) {
      problems.push({ type: name, message: `The name "${name}" is left out: a custom type's name starts with "${CUSTOM_PREFIX}".` })
      continue
    }
    if (!withHidden && t.removedAt) continue
    if (designEntity.has(t.name)) {
      problems.push({ type: name, message: `The type "${name}" is left out: the design has a type of the same name.` })
      continue
    }
    const names = namesOf(t, withHidden)
    const clash = names.map(([ts, sql]) => taken.get(`ts:${ts}`) ?? taken.get(`sql:${sql}`)).find((c) => c !== undefined)
    if (clash !== undefined) {
      problems.push({ type: name, message: `The type "${name}" is left out: a table or choice of it would have the same name as ${clash}.` })
      continue
    }
    for (const [ts, sql] of names) {
      taken.set(`ts:${ts}`, `"${name}"`)
      taken.set(`sql:${sql}`, `"${name}"`)
    }
    alive.push(t)
  }

  // Build, and when a type fails leave it out and build the rest again: a relation to it is then
  // left out of the others. Each pass removes one type, so it ends.
  let built: Record<string, Entity> = {}
  let fieldProblems: ModelMapProblem[] = []
  for (;;) {
    const build: Build = { design: reg, alive: new Map(alive.map((t) => [t.name, t])), built: {}, withHidden }
    fieldProblems = []
    let failed: { type: ModelType; message: string } | null = null
    for (const t of alive) {
      try {
        build.built[t.name] = buildType(t, build, fieldProblems)
      }
      catch (err) {
        failed = { type: t, message: messageOf(err) }
        break
      }
    }
    if (!failed) {
      built = build.built
      break
    }
    problems.push({ type: failed.type.name, message: `The type "${failed.type.name}" is left out: ${failed.message}` })
    const gone = failed.type
    alive = alive.filter((t) => t !== gone)
  }

  problems.push(...fieldProblems)
  if (!Object.keys(built).length) return { entities: {}, problems }

  // The types and the design together must make a valid model (addresses, schema names).
  try {
    const keyed = Object.fromEntries(Object.entries(built).map(([name, e]) => [`custom:${name}`, e]))
    buildRegistry({ ...design, ...keyed })
  }
  catch (err) {
    const message = `The custom types are not valid together with the design, so none is loaded: ${messageOf(err)}`
    return { entities: {}, problems: [...problems, ...Object.keys(built).map((type) => ({ type, message }))] }
  }
  return { entities: built, problems }
}
