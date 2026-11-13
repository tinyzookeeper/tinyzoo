import type { LocalizedText } from './i18n'
import { isSafeLink } from './richtext'
import { type BlockDef, type BlocksValue, blocksGraph, blocksSchema } from './blocks'
import {
  boolean, integer, jsonb, numeric, text, timestamp, uuid,
  type PgColumnBuilder,
} from 'drizzle-orm/pg-core'
import { z, type ZodTypeAny } from 'zod'
import { richTextSchema, type RichTextDoc } from './richtext'
import type {
  ColumnBase, ColumnSpec, FieldDescriptor, FieldKind, OnDelete, RelationKind, RelationSpec, ValidationMode,
} from './descriptor'

// ── naming helpers ───────────────────────────────────────────────────────────
export const snake = (s: string) => s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())
export const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
export const pascal = (s: string) => { const c = camel(s); return c.charAt(0).toUpperCase() + c.slice(1) }

// ── ONE IR, TWO SINKS ─────────────────────────────────────────────────────────
// buildColumn → live drizzle builder (runtime + type-inference anchor)
// serializeColumn → source string written to db/schema.ts (drizzle-kit input)
// Both consume the same ColumnSpec, so the live table and the committed file cannot diverge.

export interface BuildCtx {
  /** the pgEnum instance for `select` columns (created by defineEntity) */
  enumInstance?: (name: string) => PgColumnBuilder
  /** lazy thunk to the referenced column for FK columns */
  refTarget?: () => any
}

export function buildColumn(spec: ColumnSpec, colName: string, ctx: BuildCtx = {}): PgColumnBuilder {
  let col: any
  switch (spec.base.kind) {
    case 'uuid': col = uuid(colName); break
    case 'text': col = text(colName); break
    case 'integer': col = integer(colName); break
    case 'numeric': col = numeric(colName, { precision: spec.base.precision, scale: spec.base.scale }); break
    case 'boolean': col = boolean(colName); break
    case 'timestamp': col = timestamp(colName, { withTimezone: true, mode: 'date', precision: 3 }); break
    case 'jsonb': col = jsonb(colName); break
    case 'enum': col = ctx.enumInstance!(colName); break
  }
  if (spec.tsType) col = col.$type()
  if (spec.notNull) col = col.notNull()
  if (spec.unique) col = col.unique()
  if (spec.default?.kind === 'now') col = col.defaultNow()
  else if (spec.default?.kind === 'random') col = col.defaultRandom()
  else if (spec.default?.kind === 'value') col = col.default(spec.default.value)
  if (spec.reference && ctx.refTarget) col = col.references(ctx.refTarget, { onDelete: spec.reference.onDelete })
  return col
}

export interface SerializeCtx {
  enumVar?: string
  refTargetVar?: string
}

export function serializeColumn(spec: ColumnSpec, colName: string, ctx: SerializeCtx = {}): string {
  let s: string
  switch (spec.base.kind) {
    case 'uuid': s = `uuid('${colName}')`; break
    case 'text': s = `text('${colName}')`; break
    case 'integer': s = `integer('${colName}')`; break
    case 'numeric': s = `numeric('${colName}', { precision: ${spec.base.precision}, scale: ${spec.base.scale} })`; break
    case 'boolean': s = `boolean('${colName}')`; break
    case 'timestamp': s = `timestamp('${colName}', { withTimezone: true, mode: 'date', precision: 3 })`; break
    case 'jsonb': s = `jsonb('${colName}')`; break
    case 'enum': s = `${ctx.enumVar}('${colName}')`; break
  }
  if (spec.tsType) s += `.$type<${spec.tsType}>()`
  if (spec.notNull) s += '.notNull()'
  if (spec.unique) s += '.unique()'
  if (spec.default?.kind === 'now') s += '.defaultNow()'
  else if (spec.default?.kind === 'random') s += '.defaultRandom()'
  else if (spec.default?.kind === 'value') s += `.default(${JSON.stringify(spec.default.value)})`
  if (spec.reference) s += `.references(() => ${ctx.refTargetVar}.id, { onDelete: '${spec.reference.onDelete}' })`
  return s
}

/**
 * Field types whose value can differ per language. Media, relations, numbers, dates
 * and switches are the same in every language (translate the text around them).
 * Blocks are translated as a whole list per language.
 */
export const LOCALIZABLE_TYPES = new Set(['text', 'slug', 'richtext', 'blocks'])

/** The stored value of a gallery field. */
export type CmsGalleryValue = { mediaId: string; caption?: string | null }[]

// ── the single field factory ──────────────────────────────────────────────────
interface FieldConfig {
  type: string
  ui: { edit: string; cell: string }
  base: ColumnBase | null            // null ⇒ owns no column
  zod: () => ZodTypeAny
  meta?: Record<string, unknown>
  relation?: RelationSpec
  tsType?: string
  nameSuffix?: string
  reference?: { target: 'media' | 'relation'; onDeleteRequired: OnDelete; onDeleteOptional: OnDelete }
  defaultDbDefault?: 'now' | 'random'
  /** Payload default applied ONLY on create (e.g. [] for m2m). Never on update. */
  createDefault?: unknown
  /** Block type definitions (blocks fields only). */
  blocks?: Record<string, BlockDef>
}

interface Mods {
  isRequired?: boolean
  isUnique?: boolean
  isLocalized?: boolean
  isOptional?: boolean
  default?: unknown
  dbDefault?: 'now' | 'random'
  label?: LocalizedText
  help?: LocalizedText
  position?: 'main' | 'sidebar'
  group?: LocalizedText
}

function createField(cfg: FieldConfig, mods: Mods = {}): FieldDescriptor {
  const isOptional = mods.isOptional ?? false
  const isRequired = mods.isRequired ?? false
  const isUnique = mods.isUnique ?? false
  const dbDefault = mods.dbDefault ?? cfg.defaultDbDefault

  const spec: ColumnSpec | null = cfg.base == null ? null : {
    base: cfg.base,
    notNull: !isOptional,
    unique: isUnique,
    tsType: cfg.tsType,
    nameSuffix: cfg.nameSuffix,
    default:
      dbDefault === 'now' ? { kind: 'now' }
      : dbDefault === 'random' ? { kind: 'random' }
      : mods.default !== undefined ? { kind: 'value', value: mods.default }
      : undefined,
    reference: cfg.reference
      ? { target: cfg.reference.target, onDelete: isOptional ? cfg.reference.onDeleteOptional : cfg.reference.onDeleteRequired }
      : undefined,
  }

  const zod = (mode: ValidationMode = 'create'): ZodTypeAny => {
    let s = cfg.zod()
    // Defaults apply ONLY on create. On update, omitted keys must stay omitted
    // (a fired default would silently overwrite — e.g. clear m2m / reset enum).
    const createDefault = mods.default !== undefined ? mods.default : cfg.createDefault
    if (mode === 'create' && createDefault !== undefined) s = (s as any).default(createDefault)
    if (isOptional) s = s.nullish() as ZodTypeAny
    else if (mode === 'update') s = s.optional() as ZodTypeAny
    return s
  }

  // Admin label/help live in meta so they flow through the serialized graph untouched.
  const meta: Record<string, unknown> = { ...(cfg.meta ?? {}) }
  if (mods.label !== undefined) meta.label = mods.label
  if (mods.help !== undefined) meta.help = mods.help
  if (mods.position !== undefined) meta.position = mods.position
  if (mods.group !== undefined) meta.group = mods.group

  const descriptor = {
    type: cfg.type,
    isRequired, isUnique, isOptional, isLocalized: !!mods.isLocalized,
    default: mods.default, dbDefault,
    ui: cfg.ui, meta, relation: cfg.relation, blocks: cfg.blocks,
    spec, zod,
    optional: () => createField(cfg, { ...mods, isOptional: true, isRequired: false }),
    unique: () => createField(cfg, { ...mods, isUnique: true }),
    localized: () => {
      if (!LOCALIZABLE_TYPES.has(cfg.type)) {
        throw new Error(`Only ${[...LOCALIZABLE_TYPES].join(', ')} fields can be localized (got "${cfg.type}").`)
      }
      return createField(cfg, { ...mods, isLocalized: true })
    },
    withDefault: (value: unknown) => createField(cfg, { ...mods, default: value }),
    label: (text: LocalizedText) => createField(cfg, { ...mods, label: text }),
    help: (text: LocalizedText) => createField(cfg, { ...mods, help: text }),
    position: (where: 'main' | 'sidebar') => createField(cfg, { ...mods, position: where }),
    group: (label: LocalizedText) => createField(cfg, { ...mods, group: label }),
  }
  return descriptor as unknown as FieldDescriptor
}

// ── type-level kinds for each field (drive Row/Insert inference) ────────────────
type ScalarKind<Out, In = Out, OptIn extends boolean = false> = { out: Out; in: In; col: 'scalar'; optionalIn: OptIn }
type FkKind<OptIn extends boolean = false> = { out: OptIn extends true ? string | null : string; in: OptIn extends true ? string | null | undefined : string; col: 'fk'; optionalIn: OptIn }
type RelationFieldKind<Kind extends RelationKind, Req extends boolean> =
  Kind extends 'many-to-many' ? { out: never; in: string[]; col: 'none'; optionalIn: true }
  : Kind extends 'one-to-many' ? { out: never; in: never; col: 'none'; optionalIn: true }
  : FkKind<Req extends true ? false : true>

const as = <K extends FieldKind>(d: FieldDescriptor): FieldDescriptor<K> => d as unknown as FieldDescriptor<K>

// ── the closed MVP field catalog ───────────────────────────────────────────────
export const f = {
  text: (o: { required?: boolean; format?: 'email' | 'url' | 'path' | 'link' } = {}) =>
    as<ScalarKind<string>>(createField({
      type: 'text', ui: { edit: 'CmsFieldText', cell: 'CmsCellText' },
      base: { kind: 'text' },
      zod: () => {
        let s: ZodTypeAny = o.format === 'email' ? z.email() : o.format === 'url' ? z.url()
          // An address on this site: starts with one slash; no spaces, query, fragment
          // or trailing slash (so each address has exactly one spelling).
          : o.format === 'path' ? z.string().max(2000).regex(/^\/(?!\/)(?:[^\s\\?#]*[^\s\\?#/])?$/, 'Start with / (e.g. /old-page), without ? or # or a trailing /')
          // A link: a site path, #anchor, or http(s) / mailto / tel — never javascript: or data:.
          : o.format === 'link' ? z.string().max(2000).refine(isSafeLink, 'Use /page, https://…, mailto: or tel:')
          : z.string()
        if (o.required) s = (s as any).min(1, 'Required')
        return s
      },
    }, { isRequired: o.required })),

  slug: (o: { from?: string; unique?: boolean } = {}) =>
    as<ScalarKind<string>>(createField({
      type: 'slug', ui: { edit: 'CmsFieldSlug', cell: 'CmsCellCode' },
      base: { kind: 'text' }, meta: { from: o.from },
      zod: () => z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes only'),
    }, { isRequired: true, isUnique: o.unique })),

  number: (o: { int?: boolean; min?: number; max?: number } = {}) =>
    as<ScalarKind<number>>(createField({
      type: 'number', ui: { edit: 'CmsFieldNumber', cell: 'CmsCellNumber' },
      base: o.int === false ? { kind: 'numeric', precision: 12, scale: 2 } : { kind: 'integer' },
      zod: () => {
        let s = z.number()
        if (o.int !== false) s = s.int()
        if (o.min != null) s = s.min(o.min)
        if (o.max != null) s = s.max(o.max)
        return s
      },
    })),

  boolean: (o: { default?: boolean } = {}) =>
    as<ScalarKind<boolean, boolean, true>>(createField({
      type: 'boolean', ui: { edit: 'CmsFieldBoolean', cell: 'CmsCellBoolean' },
      base: { kind: 'boolean' }, zod: () => z.boolean(),
    }, { default: o.default ?? false })),

  datetime: (o: { default?: 'now' } = {}) =>
    as<ScalarKind<Date, Date | string>>(createField({
      type: 'datetime', ui: { edit: 'CmsFieldDate', cell: 'CmsCellDate' },
      base: { kind: 'timestamp' }, zod: () => z.coerce.date(),
    }, { dbDefault: o.default === 'now' ? 'now' : undefined })),

  select: <const T extends readonly [string, ...string[]], D extends T[number] | undefined = undefined>(
    o: {
      options: T
      default?: D
      /** How each option reads in the admin, e.g. `{ draft: { en: 'Draft', cs: 'Koncept' } }`. Defaults to the value. */
      labels?: Partial<Record<T[number], LocalizedText>>
    },
  ) =>
    as<ScalarKind<T[number], T[number], undefined extends D ? false : true>>(createField({
      type: 'select', ui: { edit: 'CmsFieldSelect', cell: 'CmsCellBadge' },
      base: { kind: 'enum', values: o.options },
      tsType: o.options.map((v) => `'${v}'`).join(' | '),
      meta: { options: o.options, ...(o.labels ? { labels: o.labels } : {}) },
      zod: () => z.enum([...o.options] as [string, ...string[]]),
    }, { default: o.default })),

  richtext: () =>
    as<ScalarKind<RichTextDoc>>(createField({
      type: 'richtext', ui: { edit: 'CmsFieldRichText', cell: 'CmsCellExcerpt' },
      base: { kind: 'jsonb' }, tsType: 'RichTextDoc', zod: () => richTextSchema as ZodTypeAny,
    })),

  /**
   * An ordered list of typed sections (hero, text, gallery…) that editors arrange
   * into a page. Define each type with `defineBlock()`. Stored as jsonb; defaults to [].
   *
   *   sections: f.blocks({ hero: defineBlock({ label: 'Hero', fields: { heading: f.text() } }) })
   */
  blocks: <const B extends Record<string, BlockDef<any>>>(blocks: B) =>
    as<ScalarKind<BlocksValue<B>, BlocksValue<B>, true>>(createField({
      type: 'blocks', ui: { edit: 'CmsFieldBlocks', cell: 'CmsCellBlocks' },
      base: { kind: 'jsonb' }, tsType: 'CmsBlock[]',
      meta: { blocks: blocksGraph(blocks as Record<string, BlockDef>) },
      zod: () => blocksSchema(blocks as Record<string, BlockDef>),
      createDefault: [],
      blocks: blocks as Record<string, BlockDef>,
    }, { default: [] })),

  /**
   * Several files in order, each with an optional caption (a photo gallery, an album).
   * Stored as `[{ mediaId, caption }]`; the content API returns each as the full media
   * object plus `caption`.
   */
  gallery: (o: { accept?: string; max?: number } = {}) =>
    as<ScalarKind<CmsGalleryValue, CmsGalleryValue, true>>(createField({
      type: 'gallery', ui: { edit: 'CmsFieldGallery', cell: 'CmsCellGallery' },
      base: { kind: 'jsonb' }, tsType: 'CmsGalleryValue',
      meta: { accept: o.accept ?? 'image/*' },
      zod: () => z.array(z.object({ mediaId: z.uuid(), caption: z.string().trim().max(500).nullish() })).max(o.max ?? 200),
      createDefault: [],
    }, { default: [] })),

  media: (o: { accept?: string } = {}) =>
    as<FkKind>(createField({
      type: 'media', ui: { edit: 'CmsFieldMedia', cell: 'CmsCellThumb' },
      base: { kind: 'uuid' }, meta: { accept: o.accept }, nameSuffix: '_id',
      reference: { target: 'media', onDeleteRequired: 'restrict', onDeleteOptional: 'set null' },
      zod: () => z.uuid(),
    })),

  relation: <Kind extends RelationKind, Req extends boolean = false>(
    o: { to: () => any; kind: Kind; required?: Req; onDelete?: OnDelete; inverseOf?: string; through?: string },
  ) => {
    const isMany = o.kind === 'many-to-many'
    const isVirtual = o.kind === 'one-to-many'
    const ownsColumn = !isMany && !isVirtual
    return as<RelationFieldKind<Kind, Req>>(createField({
      type: 'relation',
      ui: { edit: isMany ? 'CmsFieldRelationMany' : 'CmsFieldRelationOne', cell: 'CmsCellRelation' },
      base: ownsColumn ? { kind: 'uuid' } : null,
      nameSuffix: ownsColumn ? '_id' : undefined,
      relation: o as RelationSpec,
      // NB: never call o.to() here — forward refs (Author.posts → Post) would TDZ.
      meta: { kind: o.kind },
      reference: ownsColumn
        ? { target: 'relation', onDeleteRequired: o.onDelete ?? 'restrict', onDeleteOptional: o.onDelete ?? 'set null' }
        : undefined,
      zod: () => (isMany ? z.array(z.uuid()) : z.uuid()),
      createDefault: isMany ? [] : undefined,
    }, { isRequired: !!o.required, isOptional: ownsColumn ? !o.required : false }))
  },
}
