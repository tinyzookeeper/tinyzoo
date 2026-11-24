import {
  assertAllowedStatement, buildRegistry, customShape, DEFAULT_MODEL_LIMITS, modelEntities, planModelDdl, propOf, snake,
  type CmsEntity, type CmsRegistry, type Entity, type ModelContext, type ModelDdlAllow, type ModelDoc, type ModelLimits, type ModelOp,
} from 'tinyzoo'

// The pure parts of a change of a site's own content types (cmsModelChange.ts does the rest):
// the settings of a site's row, what the operations need to know of the design, the counting
// queries, and the statements. No database, no request, no Nitro helper: each is a function of
// its arguments.

const quoteIdent = (id: string) => `"${id.replace(/"/g, '""')}"`
const keyed = (entities: Record<string, Entity>): Record<string, Entity> => Object.fromEntries(Object.entries(entities).map(([name, e]) => [`custom:${name}`, e]))

/** An entity the mapper built, by name; never an inherited key of the object (`__proto__`, `constructor`). */
function entityOf(entities: Record<string, CmsEntity | Entity>, name: string): CmsEntity | undefined {
  return Object.hasOwn(entities, name) ? entities[name] as CmsEntity : undefined
}
/** A field of such an entity, the same way. */
function fieldOf(entities: Record<string, CmsEntity | Entity>, name: string, key: string): any {
  const e = entityOf(entities, name)
  return e && Object.hasOwn(e.fields, key) ? (e.fields as Record<string, any>)[key] : undefined
}

/** The most a site's row may set a limit to. */
const LIMIT_MAX = 200

/** The limits a site's `config.customTypes` sets, over the defaults: each a whole number from 0 to 200, anything else keeps the default. */
export function customTypesLimits(raw: unknown): ModelLimits {
  const own = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const pick = (key: keyof ModelLimits): number => {
    const v = own[key]
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= LIMIT_MAX ? v : DEFAULT_MODEL_LIMITS[key]
  }
  return { types: pick('types'), fields: pick('fields'), options: pick('options') }
}

/** Whether a site's `config.customTypes` leaves the feature on for it: only `enabled: false` switches it off. */
export function customTypesEnabled(raw: unknown): boolean {
  return !(raw && typeof raw === 'object' && (raw as Record<string, unknown>).enabled === false)
}

/**
 * The design's code-first types as the document's operations need them: name, whether it is a
 * single page, and the first part of its address (one entry per language when it differs).
 */
export function designTypesForModel(reg: CmsRegistry): ModelContext['design'] {
  const out: ModelContext['design'] = []
  for (const e of reg.entities) {
    const path = e.content?.path
    const templates = !path ? [] : typeof path === 'string' ? [path] : Object.values(path as Record<string, string>)
    const prefixes = [...new Set(templates.map((t) => String(t).split('/').filter(Boolean)[0] ?? '').filter((p) => p && !p.startsWith(':')))]
    if (!prefixes.length) out.push({ name: e.name, singleton: !!e.singleton, pathPrefix: null })
    else for (const p of prefixes) out.push({ name: e.name, singleton: !!e.singleton, pathPrefix: p })
  }
  return out
}

/** The type and field names each operation touches (`purge` and `type.add` touch nothing that exists yet). */
function touched(ops: ModelOp[]): { types: Set<string>; fields: Map<string, Set<string>> } {
  const types = new Set<string>()
  const fields = new Map<string, Set<string>>()
  for (const op of ops as any[]) {
    if (!op || typeof op !== 'object' || typeof op.type !== 'string') continue
    types.add(op.type)
    if (typeof op.key === 'string') fields.set(op.type, new Set([...(fields.get(op.type) ?? []), op.key]))
  }
  return { types, fields }
}

/**
 * The counting queries the operations need, read from the entities the mapper built (names never
 * come from the request: a name in an operation only picks an entity or a field that exists).
 * `entries` per type; `values` and `missing` per field (`'x_course.price'`).
 */
export function modelCountQueries(customEntities: Record<string, CmsEntity | Entity>, ops: ModelOp[]): { kind: 'entries' | 'values' | 'missing'; key: string; text: string }[] {
  const { types, fields } = touched(ops)
  const out: { kind: 'entries' | 'values' | 'missing'; key: string; text: string }[] = []
  for (const name of types) {
    const e = entityOf(customEntities, name)
    if (!e) continue
    const table = quoteIdent(snake(e.name))
    out.push({ kind: 'entries', key: e.name, text: `select count(*)::int as n from ${table}` })
    for (const key of fields.get(name) ?? []) {
      const fld = fieldOf(customEntities, name, key)
      const column = fld && !fld.isLocalized ? (e.table as any)[propOf(key, fld)]?.name : undefined
      if (typeof column !== 'string') continue
      out.push({ kind: 'values', key: `${e.name}.${key}`, text: `select count(*)::int as n from ${table} where ${quoteIdent(column)} is not null` })
      out.push({ kind: 'missing', key: `${e.name}.${key}`, text: `select count(*)::int as n from ${table} where ${quoteIdent(column)} is null` })
    }
  }
  return out
}

/**
 * What the statements may do beyond adding and loosening, for this call only: `SET NOT NULL` for
 * the fields an operation of it made required, drops for what a `purge` of it removed. SQL names.
 */
export function modelDdlAllow(before: ModelDoc, after: ModelDoc, ops: ModelOp[], beforeEntities: Record<string, CmsEntity | Entity>, beforeReg: CmsRegistry): ModelDdlAllow {
  const setNotNull: string[] = []
  const drop = { tables: [] as string[], columns: [] as string[], types: [] as string[] }
  const required = (f: any) => !!f && !f.removedAt && f.required === true
  for (const op of ops as any[]) {
    if ((op?.op !== 'field.update' || op.required !== true) && op?.op !== 'field.restore') continue
    const was = before.types.find((t) => t.name === op.type)?.fields.find((f) => f.key === op.key)
    const now = after.types.find((t) => t.name === op.type)?.fields.find((f) => f.key === op.key)
    if (required(was) || !required(now)) continue
    const fld = fieldOf(beforeEntities, op.type, op.key)
    const column = fld ? (beforeEntities[op.type]!.table as any)[propOf(op.key, fld)]?.name : undefined
    if (typeof column === 'string') setNotNull.push(`${snake(op.type)}.${column}`)
  }
  for (const op of ops as any[]) {
    if (op?.op !== 'purge') continue
    for (const name of op.types ?? []) {
      const e = entityOf(beforeEntities, name)
      if (!e) continue
      drop.tables.push(snake(e.name))
      if (e.localesTable) drop.tables.push(`${snake(e.name)}_locales`)
      for (const j of beforeReg.junctions) if (j.ownerEntity === e.name || j.targetEntity === e.name) drop.tables.push(j.tableName)
      for (const en of e.enums) drop.types.push(en.enumName)
    }
    for (const ref of op.fields ?? []) {
      const e = entityOf(beforeEntities, ref.type)
      const fld = fieldOf(beforeEntities, ref.type, ref.key)
      if (!e || !fld) continue
      const column = (e.table as any)[propOf(ref.key, fld)]?.name
      if (typeof column === 'string') drop.columns.push(`${snake(e.name)}.${column}`)
      const en = e.enums.find((x) => x.key === ref.key)
      if (en) drop.types.push(en.enumName)
    }
  }
  return { setNotNull, drop }
}

/** The custom types of a document built over the design, hidden things included (the statements are planned from these). */
export function modelPlanningBuild(doc: ModelDoc, design: Record<string, any>): { entities: Record<string, Entity>; reg: CmsRegistry } {
  const { entities } = modelEntities(doc, design, { withHidden: true })
  return { entities, reg: buildRegistry({ ...design, ...keyed(entities) }) }
}

/**
 * The statements from one document to the next, and what the planner refuses.
 *
 * A required field added to a type that has no entries (the operations allow it only when the
 * count says so) is added as an optional column first, then made required: the planner never
 * adds a required column without a default to a table that is there already.
 */
export function planModelChange(before: ModelDoc, after: ModelDoc, design: Record<string, any>, ops: ModelOp[]): { statements: string[]; refused: string[] } {
  const b = modelPlanningBuild(before, design)
  const a = modelPlanningBuild(after, design)
  const allow = modelDdlAllow(before, after, ops, b.entities, b.reg)
  const added: { type: string; key: string }[] = []
  for (const t of after.types) {
    const was = before.types.find((x) => x.name === t.name)
    if (!was) continue
    for (const f of t.fields) if (!f.removedAt && (f as { required?: boolean }).required === true && !was.fields.some((x) => x.key === f.key)) added.push({ type: t.name, key: f.key })
  }
  if (!added.length) return planModelDdl(customShape(b.reg), customShape(a.reg), allow)
  const middle = structuredClone(after)
  for (const { type, key } of added) {
    const f = middle.types.find((x) => x.name === type)!.fields.find((x) => x.key === key) as { required?: boolean }
    f.required = false
  }
  const m = modelPlanningBuild(middle, design)
  const columns = added.flatMap(({ type, key }) => {
    const fld = fieldOf(m.entities, type, key)
    const column = fld ? (m.entities[type]!.table as any)[propOf(key, fld)]?.name : undefined
    return typeof column === 'string' ? [`${snake(type)}.${column}`] : []
  })
  const first = planModelDdl(customShape(b.reg), customShape(m.reg), allow)
  const then = planModelDdl(customShape(m.reg), customShape(a.reg), { setNotNull: columns })
  return { statements: [...first.statements, ...then.statements], refused: [...first.refused, ...then.refused] }
}

/** A statement of a change that is not on the allowed list: nothing after it runs, and the transaction is rolled back. */
export class ModelStatementRefused extends Error {
  constructor(readonly reason: string) {
    super(reason)
    this.name = 'ModelStatementRefused'
  }
}

/** Run the statements of a change, each checked against the allowed list first (again: the planner checked them too). */
export async function runModelStatements(exec: (text: string) => Promise<unknown>, statements: string[]): Promise<void> {
  for (const statement of statements) {
    try { assertAllowedStatement(statement) }
    catch (err) { throw new ModelStatementRefused((err as Error).message) }
    await exec(statement)
  }
}

/**
 * The design's types as the structure editor shows them (read-only). `relatable`: a collection of
 * content a field may sensibly point at; forms' messages, redirects and what a plugin keeps are not.
 */
export function describeDesignTypes(reg: CmsRegistry): { name: string; label: unknown; labelSingular: unknown; icon: string | null; singleton: boolean; relatable: boolean; fields: { key: string; type: string; label: unknown }[] }[] {
  return reg.entities.map((e) => ({
    name: e.name,
    label: e.label,
    labelSingular: e.labelSingular ?? e.label,
    icon: e.icon ?? null,
    singleton: !!e.singleton,
    relatable: !e.singleton && !(e as { preset?: string }).preset && !reg.pluginOf.has(e.name),
    fields: Object.entries(e.fields as Record<string, any>).map(([key, fld]) => ({ key, type: String(fld.type), label: fld.meta?.label ?? key })),
  }))
}
