import type { LocalizedText } from './i18n'
import { isSafeLink } from './richtext'
import { looksLikeLinkRef } from './linkref'
import { type BlockDef, type BlockValue, type BlocksValue, type GroupValue, blocksGraph, blocksSchema, checkContainedFields, defineBlock, groupGraph } from './blocks'
import {
  boolean, integer, jsonb, numeric, text, timestamp, uuid,
  type PgColumnBuilder,
} from 'drizzle-orm/pg-core'
import { z, type ZodTypeAny } from 'zod'
import { richTextSchema, type RichTextDoc } from './richtext'
import { normalizeFieldAccess, type CmsFieldAccess, type CmsFieldRule } from './roles'
import type {
  AnyFieldDescriptor, ColumnBase, ColumnSpec, FieldDescriptor, FieldKind, OnDelete, RelationKind, RelationSpec, ValidationContext, ValidationMode,
} from './descriptor'

// ── naming helpers ───────────────────────────────────────────────────────────
/** @internal */
export const snake = (s: string) => s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())
/** @internal */
export const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
/** @internal */
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

/** @internal */
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
  /** The column points at its own table (a page's parent): TypeScript needs the return type spelled out. */
  selfReference?: boolean
}

/** @internal */
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
  if (spec.reference) s += `.references(${ctx.selfReference ? '(): AnyPgColumn' : '()'} => ${ctx.refTargetVar}.id, { onDelete: '${spec.reference.onDelete}' })`
  return s
}

/**
 * Field types whose value can differ per language. Media, relations, numbers, dates
 * and switches are the same in every language (translate the text around them).
 * Blocks are translated as a whole list per language, a group as a whole group.
 */
export const LOCALIZABLE_TYPES = new Set(['text', 'slug', 'richtext', 'blocks', 'group'])

/** The stored value of a list field: its items, each with a stable id. */
export type CmsListValue<F, K extends string = 'item'> = Array<BlockValue<K, F>>

/** The stored value of a gallery field. */
export type CmsGalleryValue = { mediaId: string; caption?: string | null }[]

// ── the single field factory ──────────────────────────────────────────────────
interface FieldConfig {
  type: string
  ui: { edit: string; cell: string }
  base: ColumnBase | null            // null ⇒ owns no column
  zod: (context?: ValidationContext) => ZodTypeAny
  meta?: Record<string, unknown>
  relation?: RelationSpec
  tsType?: string
  nameSuffix?: string
  reference?: { target: 'media' | 'relation'; onDeleteRequired: OnDelete; onDeleteOptional: OnDelete }
  defaultDbDefault?: 'now' | 'random'
  /** Payload default applied ONLY on create (e.g. [] for m2m). Never on update. */
  createDefault?: unknown
  /** false: the default fills the column (the database) but is never put into a payload, so a value that must be given cannot be skipped (a consent that must be ticked). */
  zodDefault?: boolean
  /** Block type definitions (blocks fields only). */
  blocks?: Record<string, BlockDef>
  /** The fields a group holds (group fields only). */
  groupFields?: Record<string, AnyFieldDescriptor>
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
  icon?: string
  access?: CmsFieldRule
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

  const zod = (mode: ValidationMode = 'create', context?: ValidationContext): ZodTypeAny => {
    let s = cfg.zod(context)
    // Defaults apply ONLY on create. On update, omitted keys must stay omitted
    // (a fired default would silently overwrite — e.g. clear m2m / reset enum).
    const createDefault = mods.default !== undefined ? mods.default : cfg.createDefault
    if (mode === 'create' && createDefault !== undefined && cfg.zodDefault !== false) s = (s as any).default(createDefault)
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
  if (mods.icon !== undefined) meta.icon = mods.icon
  if (mods.access !== undefined) meta.access = mods.access

  const descriptor = {
    type: cfg.type,
    isRequired, isUnique, isOptional, isLocalized: !!mods.isLocalized,
    default: mods.default, dbDefault,
    ui: cfg.ui, meta, relation: cfg.relation, blocks: cfg.blocks, fields: cfg.groupFields,
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
    icon: (name: string) => createField(cfg, { ...mods, icon: name }),
    access: (rules: CmsFieldAccess) => createField(cfg, { ...mods, access: normalizeFieldAccess(rules) }),
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
  /**
   * A line of text. `multiline` gives a growing text box (a perex, a short note —
   * plain text, line breaks kept; use richtext for formatting). `max` caps the length.
   */
  text: (o: { required?: boolean; format?: 'email' | 'url' | 'path' | 'link'; multiline?: boolean; max?: number } = {}) =>
    as<ScalarKind<string>>(createField({
      type: 'text', ui: { edit: 'CmsFieldText', cell: 'CmsCellText' },
      base: { kind: 'text' },
      meta: o.multiline || o.max || o.format
        ? { ...(o.multiline ? { multiline: true } : {}), ...(o.max ? { max: o.max } : {}), ...(o.format ? { format: o.format } : {}) }
        : undefined,
      zod: () => {
        // Spaces around a value are never meant (a pasted "/kontakt ", a title typed
        // after a space): trimmed before checking. Multi-line text keeps its layout.
        let s: any = o.multiline ? z.string() : z.string().trim()
        if (o.max) s = s.max(o.max)
        if (o.required) s = s.min(1, 'Required')
        if (o.format === 'email') return s.pipe(z.email())
        // (A `cms:` address is an internal link reference: only link fields hold, and resolve, those.)
        if (o.format === 'url') return s.pipe(z.url()).refine((v: string) => !looksLikeLinkRef(v), 'Use a full address (https://…)')
        // An address on this site: starts with one slash; no spaces, query, fragment
        // or trailing slash (so each address has exactly one spelling).
        if (o.format === 'path') return s.max(2000).regex(/^\/(?!\/)(?:[^\s\\?#]*[^\s\\?#/])?$/, 'Start with / (e.g. /old-page), without ? or # or a trailing /')
        // A link: a site path, #anchor, or http(s) / mailto / tel — never javascript: or data:.
        if (o.format === 'link') return s.max(2000).refine(isSafeLink, 'Use /page, https://…, mailto: or tel:')
        return s as ZodTypeAny
      },
    }, { isRequired: o.required })),

  slug: (o: { from?: string; unique?: boolean } = {}) =>
    as<ScalarKind<string>>(createField({
      type: 'slug', ui: { edit: 'CmsFieldSlug', cell: 'CmsCellCode' },
      base: { kind: 'text' }, meta: { from: o.from },
      zod: () => z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes only'),
    }, { isRequired: true, isUnique: o.unique })),

  /**
   * A number. Whole by default (`integer`, a JSON number). `int: false` is a decimal
   * (`numeric(12,2)`): the database and the content API give it as a **string**
   * (`"19.99"`, exact), so a `Row` reads it as `string`; an `Insert` or `Update` takes a
   * `number` or a numeric string. Convert at the point of use: `Number(row.price)`.
   */
  number: <I extends boolean = true>(o: { int?: I; min?: number; max?: number } = {}) =>
    as<ScalarKind<[I] extends [false] ? string : number, [I] extends [false] ? number | string : number>>(createField({
      type: 'number', ui: { edit: 'CmsFieldNumber', cell: 'CmsCellNumber' },
      base: o.int === false ? { kind: 'numeric', precision: 12, scale: 2 } : { kind: 'integer' },
      zod: () => {
        const limits = (n: z.ZodNumber) => {
          if (o.min != null) n = n.min(o.min)
          if (o.max != null) n = n.max(o.max)
          return n
        }
        if (o.int === false) {
          // A decimal is stored exactly and read back as a string, so a form that sends the
          // value it was given ("19.99") is accepted as well as a number. Either way the
          // value that is stored (in a column, a block, a list) is the string.
          const range = o.min != null && o.max != null ? `Enter a number from ${o.min} to ${o.max}`
            : o.min != null ? `Enter a number of at least ${o.min}`
            : o.max != null ? `Enter a number of at most ${o.max}`
            : 'Enter a number'
          const asNumber = (v: number | string) => (typeof v === 'string' ? (/^-?\d+(?:\.\d+)?$/.test(v.trim()) ? Number(v) : Number.NaN) : v)
          return z.union([z.number(), z.string()])
            .refine((v) => Number.isFinite(asNumber(v)), { message: 'Enter a number', abort: true })
            .refine((v) => limits(z.number()).safeParse(asNumber(v)).success, { message: range })
            .transform((v) => (typeof v === 'string' ? v.trim() : String(v)))
        }
        return limits(z.number().int())
      },
    })),

  /**
   * A yes/no switch (stored `false` unless given). `mustBeTrue: true` is for a consent or
   * a confirmation ("I agree to the terms"): a value of `false` is refused, so a website
   * form cannot be sent without it ticked. `needsPrevious` is for a switch in a list of
   * blocks that is about the item before it ("under the link above"): the first item does
   * not show it. `confirmOff` is for a switch whose "off" stops something (counting visits,
   * sending e-mails): the admin asks before saving it switched off, with this text.
   */
  boolean: (o: { default?: boolean; mustBeTrue?: boolean; needsPrevious?: boolean; confirmOff?: LocalizedText } = {}) =>
    as<ScalarKind<boolean, boolean, true>>(createField({
      type: 'boolean', ui: { edit: 'CmsFieldBoolean', cell: 'CmsCellBoolean' },
      base: { kind: 'boolean' },
      zod: () => (o.mustBeTrue ? z.boolean().refine((v) => v === true, { message: 'Must be ticked' }) : z.boolean()),
      ...(o.mustBeTrue || o.needsPrevious || o.confirmOff
        ? { meta: { ...(o.mustBeTrue ? { mustBeTrue: true } : {}), ...(o.needsPrevious ? { needsPrevious: true } : {}), ...(o.confirmOff ? { confirmOff: o.confirmOff } : {}) } }
        : {}),
      ...(o.mustBeTrue ? { zodDefault: false } : {}),
    }, { default: o.default ?? false })),

  /**
   * A date and time, edited as wall-clock time in the admin's time zone. `allDay`
   * adds an "All day" switch to the editor: an all-day value is stored at 0:00.
   */
  datetime: (o: { default?: 'now'; allDay?: boolean } = {}) =>
    as<ScalarKind<Date, Date | string>>(createField({
      type: 'datetime', ui: { edit: 'CmsFieldDate', cell: 'CmsCellDate' },
      base: { kind: 'timestamp' }, zod: () => z.coerce.date(),
      meta: o.allDay ? { allDay: true } : undefined,
    }, { dbDefault: o.default === 'now' ? 'now' : undefined })),

  select: <const T extends readonly [string, ...string[]], D extends T[number] | undefined = undefined>(
    o: {
      options: T
      default?: D
      /** How each option reads in the admin, e.g. `{ draft: { en: 'Draft', cs: 'Koncept' } }`. Defaults to the value. */
      labels?: Partial<Record<T[number], LocalizedText>>
      /** An icon per option (any Iconify name, e.g. `i-lucide-trophy`), shown on the choice buttons. */
      icons?: Partial<Record<T[number], string>>
    },
  ) =>
    as<ScalarKind<T[number], T[number], undefined extends D ? false : true>>(createField({
      type: 'select', ui: { edit: 'CmsFieldSelect', cell: 'CmsCellBadge' },
      base: { kind: 'enum', values: o.options },
      tsType: o.options.map((v) => `'${v}'`).join(' | '),
      meta: { options: o.options, ...(o.labels ? { labels: o.labels } : {}), ...(o.icons ? { icons: o.icons } : {}) },
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
      zod: (ctx) => blocksSchema(blocks as Record<string, BlockDef>, 500, ctx?.stored),
      createDefault: [],
      blocks: blocks as Record<string, BlockDef>,
    }, { default: [] })),

  /**
   * A repeating group of fields: opening hours, team members, FAQ, a price list.
   * Editors add, reorder (drag), duplicate and remove items. Stored as jsonb like
   * blocks with one item type, so each item has a stable `id` (a good `:key`):
   *
   *   team: f.list({ fields: { name: f.text({ required: true }), role: f.text() }, max: 30 })
   *   // → [{ id: 'k3j…', type: 'item', name: 'Jana', role: 'Trenérka' }, …]
   *
   * Item fields: text, slug, number, boolean, datetime, select, rich text, media.
   * Can be `.localized()`. Items carry a `v` once `version` is above 1 (see `defineBlock`).
   */
  list: <const F extends Record<string, AnyFieldDescriptor>, const K extends string = 'item'>(o: {
    fields: F; max?: number; itemLabel?: LocalizedText
    /** The stored `type` of every item (default 'item'); lets an existing one-type blocks field become a list. */
    itemType?: K
    /** The items' shape version (1 when left out), as for `defineBlock`: raise it when stored items need changing… */
    version?: number
    /** …and bring an item stored at `fromVersion` to `fromVersion + 1` here (called once per step). */
    upgrade?: BlockDef['upgrade']
  }) => {
    const blocks = { [o.itemType ?? 'item']: defineBlock({ label: o.itemLabel ?? { en: 'Item', cs: 'Položka', de: 'Eintrag' }, icon: 'i-lucide-list', fields: o.fields, version: o.version, upgrade: o.upgrade }) } as Record<string, BlockDef>
    return as<ScalarKind<CmsListValue<F, K>, CmsListValue<F, K>, true>>(createField({
      type: 'blocks', ui: { edit: 'CmsFieldBlocks', cell: 'CmsCellBlocks' },
      base: { kind: 'jsonb' }, tsType: 'CmsBlock[]',
      meta: { blocks: blocksGraph(blocks), list: { max: o.max ?? null, itemLabel: o.itemLabel ?? null } },
      zod: (ctx) => blocksSchema(blocks, o.max ?? 500, ctx?.stored),
      createDefault: [],
      blocks,
    }, { default: [] }))
  },

  /**
   * A named object of fields kept together: an address, a contact, an opening-hours
   * summary. Stored as one jsonb column (not one column per field), shown in the admin
   * as a fieldset and delivered as one object by the content API. Each field is checked
   * on its own, like a block's: `required: true` fields must be filled in, the rest may
   * be empty. `.optional()` lets the whole group be absent (null); `.localized()` gives
   * each language its own whole group.
   *
   *   address: f.group({ fields: {
   *     street: f.text({ required: true }),
   *     city: f.text({ required: true }),
   *     zip: f.text(),
   *     map: f.text({ format: 'url' }).optional(),
   *   } })
   *   // → { street: 'Dlouhá 1', city: 'Tábor', zip: '390 01', map: null }
   *
   * Inside: text, slug, number, boolean, datetime, select, rich text, media, groups, and
   * a list (only directly in a group on an entry, not in one inside a block, a list or
   * another group). A group is usable inside blocks and list items as well, holding
   * plain fields there.
   */
  group: <const F extends Record<string, AnyFieldDescriptor>>(o: { fields: F }) => {
    checkContainedFields('Group', o.fields, { reserved: false })
    const inner = o.fields as unknown as Record<string, FieldDescriptor>
    return as<ScalarKind<GroupValue<F>, GroupValue<F>>>(createField({
      type: 'group', ui: { edit: 'CmsFieldGroup', cell: 'CmsCellGroup' },
      base: { kind: 'jsonb' }, tsType: 'Record<string, unknown>',
      meta: { fields: groupGraph(o.fields) },
      groupFields: o.fields,
      zod: (ctx) => {
        // What the same group holds now (lists inside tell stored items from invented ones).
        const stored = ctx?.stored && typeof ctx.stored === 'object' && !Array.isArray(ctx.stored) ? ctx.stored as Record<string, unknown> : undefined
        const shape: Record<string, ZodTypeAny> = {}
        for (const [key, fld] of Object.entries(inner)) {
          // Like inside a block: a field may be left empty unless it is explicitly required.
          const s = fld.zod('create', { stored: stored?.[key] })
          shape[key] = fld.isRequired ? s : s.nullish()
        }
        return z.object(shape)
      },
    }))
  },

  /**
   * A file to download (a price list, rules, a menu as PDF): picked from the media
   * library or uploaded. Same storage and API shape as `f.media`, with a file row
   * (name, size, open) instead of a picture.
   */
  file: (o: { accept?: string } = {}) =>
    as<FkKind>(createField({
      type: 'media', ui: { edit: 'CmsFieldMedia', cell: 'CmsCellThumb' },
      base: { kind: 'uuid' }, meta: { accept: o.accept ?? 'application/pdf', file: true }, nameSuffix: '_id',
      reference: { target: 'media', onDeleteRequired: 'restrict', onDeleteOptional: 'set null' },
      zod: () => z.uuid(),
    })),

  /** A colour as #rrggbb (a category's colour, a page's accent). */
  color: (o: { required?: boolean } = {}) =>
    as<ScalarKind<string>>(createField({
      type: 'text', ui: { edit: 'CmsFieldColor', cell: 'CmsCellColor' },
      base: { kind: 'text' }, meta: { format: 'color' },
      zod: () => z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #1f6feb'),
    }, { isRequired: o.required })),

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
