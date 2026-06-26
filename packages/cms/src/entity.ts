import { type PgColumn, pgEnum, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { buildColumn, camel, snake } from './fields'
import { cmsMedia } from './media'
import type { AnyFieldDescriptor, FieldDescriptor } from './descriptor'

// ── type-level inference helpers ────────────────────────────────────────────────
type Prettify<T> = { [K in keyof T]: T[K] } & {}
type KindOf<D> = D extends FieldDescriptor<infer K> ? K : never

/** DB-column property key for a field: scalars keep the key, FKs become `${K}Id`, virtual relations drop. */
type ColumnKey<K extends string, D> = KindOf<D>['col'] extends 'none' ? never
  : KindOf<D>['col'] extends 'fk' ? `${K}Id`
  : K

/** A selected row: system columns + each owned column at its DB key. */
type RowFields<F> = Prettify<
  { id: string; createdAt: Date; updatedAt: Date } &
  { [K in keyof F & string as ColumnKey<K, F[K]>]: KindOf<F[K]>['out'] }
>

type Included<D> = [KindOf<D>['in']] extends [never] ? false : true   // false for one-to-many
/** Insert payload (API keys, not DB keys): required vs optional split by `optionalIn`. */
type InsertFields<F> = Prettify<
  { [K in keyof F & string as Included<F[K]> extends true ? (KindOf<F[K]>['optionalIn'] extends true ? never : K) : never]: KindOf<F[K]>['in'] } &
  { [K in keyof F & string as Included<F[K]> extends true ? (KindOf<F[K]>['optionalIn'] extends true ? K : never) : never]?: KindOf<F[K]>['in'] }
>

/** The entity's drizzle table, typed enough for `eq()` + key autocomplete in access rules. */
type TableColumns<F> = Prettify<
  { id: PgColumn; createdAt: PgColumn; updatedAt: PgColumn } &
  { [K in keyof F & string as ColumnKey<K, F[K]>]: PgColumn }
>

export interface EntityDef<F extends Record<string, AnyFieldDescriptor>> {
  label: string
  titleField: keyof F & string
  fields: F
  admin?: { list?: { columns: (keyof F & string)[]; searchable?: (keyof F & string)[] } }
  access?: Partial<Record<'read' | 'create' | 'update' | 'delete', (ctx: { user: any; table: TableColumns<F> }) => unknown>>
}

/** The precisely-typed entity returned by defineEntity. */
export interface Entity<F extends Record<string, AnyFieldDescriptor> = Record<string, AnyFieldDescriptor>> {
  __cms: 'entity'
  name: string
  label: string
  titleField: keyof F & string
  table: TableColumns<F>
  fields: F
  enums: EntityEnum[]
  insertSchema: z.ZodType<InsertFields<F>>
  updateSchema: z.ZodType<Partial<InsertFields<F>>>
  admin?: EntityDef<F>['admin']
  access?: EntityDef<F>['access']
}

/** Public data-shape helpers — `Row<typeof Post>`, `Insert<typeof Post>`, `Update<typeof Post>`. */
export type Row<E> = E extends Entity<infer F> ? RowFields<F> : never
export type Insert<E> = E extends Entity<infer F> ? InsertFields<F> : never
export type Update<E> = E extends Entity<infer F> ? Partial<InsertFields<F>> : never

/** Runtime-facing (erased) entity view used by the registry/server. */
export interface CmsEntity {
  __cms: 'entity'
  name: string
  label: string
  titleField: string
  table: any
  fields: Record<string, FieldDescriptor>
  enums: EntityEnum[]
  insertSchema: z.ZodTypeAny
  updateSchema: z.ZodTypeAny
  admin?: { list?: { columns: string[]; searchable?: string[] } }
  access?: Record<string, (ctx: { user: any; table: any }) => unknown>
}

interface EntityEnum { key: string; varName: string; enumName: string; values: readonly string[] }

/** DB column property name for a field (FKs become `${key}Id`). */
export function propOf(key: string, fld: FieldDescriptor): string {
  return fld.spec?.nameSuffix === '_id' ? key + 'Id' : key
}

export function defineEntity<F extends Record<string, AnyFieldDescriptor>>(
  name: string,
  def: EntityDef<F>,
): Entity<F> {
  const fields = def.fields as unknown as Record<string, FieldDescriptor>

  // 1) pgEnums for select fields
  const enums: EntityEnum[] = []
  const enumInstances: Record<string, any> = {}
  for (const [key, fld] of Object.entries(fields)) {
    if (fld.spec?.base.kind === 'enum') {
      const enumName = `${name}_${snake(key)}`
      enumInstances[key] = pgEnum(enumName, [...fld.spec.base.values] as [string, ...string[]])
      enums.push({ key, varName: camel(enumName), enumName, values: fld.spec.base.values })
    }
  }

  // 2) live columns (the InferSelectModel anchor)
  const columns: Record<string, any> = { id: uuid('id').primaryKey().defaultRandom() }
  for (const [key, fld] of Object.entries(fields)) {
    if (!fld.spec) continue
    const dbName = snake(key) + (fld.spec.nameSuffix ?? '')
    const refTarget = fld.spec.reference
      ? (fld.spec.reference.target === 'media'
          ? () => cmsMedia.id
          : () => (fld.relation!.to() as CmsEntity).table.id)
      : undefined
    columns[propOf(key, fld)] = buildColumn(fld.spec, dbName, { enumInstance: enumInstances[key], refTarget })
  }
  columns.createdAt = timestamp('created_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow()
  columns.updatedAt = timestamp('updated_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow()
  const table = pgTable(name, columns)

  // 3) validation — create and update built separately (update carries no defaults)
  const createShape: Record<string, z.ZodTypeAny> = {}
  const updateShape: Record<string, z.ZodTypeAny> = {}
  for (const [key, fld] of Object.entries(fields)) {
    if (fld.relation?.kind === 'one-to-many') continue
    createShape[key] = fld.zod('create')
    updateShape[key] = fld.zod('update')
  }

  return {
    __cms: 'entity',
    name, label: def.label, titleField: def.titleField,
    table, admin: def.admin, access: def.access, fields: def.fields,
    enums,
    insertSchema: z.object(createShape),
    updateSchema: z.object(updateShape),
  } as unknown as Entity<F>
}

// ── registry: junctions + serializable graph, memoized per config module ────────
export interface Junction {
  name: string
  table: any
  ownerEntity: string
  targetEntity: string
  ownerCol: string
  targetCol: string
  fieldKey: string
}

export interface CmsRegistry {
  entities: CmsEntity[]
  byName: Map<string, CmsEntity>
  junctions: Junction[]
  junctionByOwnerField: Map<string, Junction>
  schema: Record<string, any>
  graph: any[]
  cmsMedia: typeof cmsMedia
}

const _regCache = new WeakMap<object, CmsRegistry>()
const _junctionCache = new Map<string, any>()

function isEntity(v: any): v is CmsEntity {
  return v && typeof v === 'object' && v.__cms === 'entity'
}

export function buildRegistry(config: Record<string, any>): CmsRegistry {
  const cached = _regCache.get(config)
  if (cached) return cached

  const entities = Object.values(config).filter(isEntity)
  const byName = new Map(entities.map((e) => [e.name, e]))

  const junctions: Junction[] = []
  const junctionByOwnerField = new Map<string, Junction>()
  for (const e of entities) {
    for (const [key, fld] of Object.entries(e.fields)) {
      if (fld.relation?.kind !== 'many-to-many') continue
      const target = fld.relation.to() as CmsEntity
      const pair = [e.name, target.name].sort()
      const jname = fld.relation.through ?? `${pair[0]}_to_${pair[1]}`
      const ownerCol = `${e.name}Id`
      const targetCol = `${target.name}Id`
      let jtable = _junctionCache.get(jname)
      if (!jtable) {
        jtable = pgTable(jname, {
          [ownerCol]: uuid(`${snake(e.name)}_id`).notNull().references(() => e.table.id, { onDelete: 'cascade' }),
          [targetCol]: uuid(`${snake(target.name)}_id`).notNull().references(() => target.table.id, { onDelete: 'cascade' }),
        }, (t: any) => [primaryKey({ columns: [t[ownerCol], t[targetCol]] })])
        _junctionCache.set(jname, jtable)
      }
      const j: Junction = { name: jname, table: jtable, ownerEntity: e.name, targetEntity: target.name, ownerCol, targetCol, fieldKey: key }
      junctions.push(j)
      junctionByOwnerField.set(`${e.name}.${key}`, j)
    }
  }

  const schema: Record<string, any> = { cmsMedia }
  for (const e of entities) schema[e.name] = e.table
  for (const j of junctions) schema[j.name] = j.table

  const graph = entities.map(entityGraph)
  const reg: CmsRegistry = { entities, byName, junctions, junctionByOwnerField, schema, graph, cmsMedia }
  _regCache.set(config, reg)
  return reg
}

function entityGraph(e: CmsEntity) {
  return {
    name: e.name,
    label: e.label,
    titleField: e.titleField,
    listColumns: e.admin?.list?.columns ?? Object.keys(e.fields).slice(0, 4),
    searchable: e.admin?.list?.searchable ?? [],
    fields: Object.entries(e.fields).map(([key, fld]) => ({
      key,
      type: fld.type,
      optional: fld.isOptional,
      required: fld.isRequired,
      unique: fld.isUnique,
      ui: fld.ui,
      meta: fld.meta,
      relation: fld.relation
        ? { to: (fld.relation.to() as CmsEntity).name, kind: fld.relation.kind, required: !!fld.relation.required }
        : undefined,
    })),
  }
}
