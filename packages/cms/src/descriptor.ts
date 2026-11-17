import type { LocalizedText } from './i18n'
import type { ZodTypeAny } from 'zod'

export type OnDelete = 'cascade' | 'restrict' | 'set null' | 'no action'
export type RelationKind = 'many-to-one' | 'one-to-many' | 'many-to-many'
/** @internal */
export type ValidationMode = 'create' | 'update'

/**
 * What a write is checked against besides the payload.
 *
 * @internal
 */
export interface ValidationContext {
  /**
   * What the field holds in the row being written, as stored (nothing on create).
   * Blocks and lists use it to tell a block that is already stored from one the
   * client made up (see `blocksSchema`).
   */
  stored?: unknown
}

export interface RelationSpec {
  /**
   * Lazy thunk to the target entity. Typed `() => any` ON PURPOSE: any structural
   * return type (even `() => unknown`) makes TS evaluate the target entity while
   * inferring THIS one, re-creating the circular-reference cycle. `any` short-circuits
   * the assignability check so the target is never evaluated. The runtime casts back.
   */
  to: () => any
  kind: RelationKind
  required?: boolean
  onDelete?: OnDelete
  inverseOf?: string
  through?: string
}

export interface FieldUi {
  edit: string
  cell: string
}

// ── the serializable column IR (one source for live builder + emitted source) ──
/** @internal */
export type ColumnBase =
  | { kind: 'uuid' }
  | { kind: 'text' }
  | { kind: 'integer' }
  | { kind: 'numeric'; precision: number; scale: number }
  | { kind: 'boolean' }
  | { kind: 'timestamp' }
  | { kind: 'jsonb' }
  | { kind: 'enum'; values: readonly string[] }

/** @internal */
export type ColumnDefault =
  | { kind: 'value'; value: unknown }
  | { kind: 'now' }
  | { kind: 'random' }

/** @internal */
export interface ColumnReference {
  target: 'media' | 'relation'
  onDelete: OnDelete
}

/** @internal */
export interface ColumnSpec {
  base: ColumnBase
  notNull: boolean
  unique: boolean
  default?: ColumnDefault
  tsType?: string
  reference?: ColumnReference
  nameSuffix?: string
}

// ── type-level field metadata (phantom; drives Row/Insert/table inference) ──────
export interface FieldKind {
  /** value of the column this field owns, in a selected row (e.g. `authorId: string`) */
  out: unknown
  /** value accepted on insert for this field's API key (e.g. `author: string`, `tags: string[]`) */
  in: unknown
  /** how the field maps to a DB column */
  col: 'scalar' | 'fk' | 'none'
  /** is the field omittable on insert (nullable or has a default)? */
  optionalIn: boolean
}

/** `.optional()` → nullable + omittable on insert. */
export type Nullable<K extends FieldKind> = {
  out: K['out'] | null
  in: K['in'] | null | undefined
  col: K['col']
  optionalIn: true
}

/** `.withDefault()` → omittable on insert. */
export type Defaulted<K extends FieldKind> = {
  out: K['out']
  in: K['in']
  col: K['col']
  optionalIn: true
}

export interface FieldDescriptor<K extends FieldKind = FieldKind> {
  /** phantom — never set at runtime; carries the type-level kind. */
  readonly __k?: K
  type: string
  isRequired: boolean
  isUnique: boolean
  isOptional: boolean
  /** Has a value per language (see `.localized()` and `defineLocales`). */
  isLocalized: boolean
  default?: unknown
  /** @internal */
  dbDefault?: 'now' | 'random'
  ui: FieldUi
  meta: Record<string, unknown>
  relation?: RelationSpec
  /** Block type definitions (blocks fields only). */
  blocks?: Record<string, import('./blocks').BlockDef>
  /** The fields a group holds (group fields only). */
  fields?: Record<string, FieldDescriptor>
  /**
   * The column this field owns (null ⇒ none: many-to-many, one-to-many).
   *
   * @internal
   */
  spec: ColumnSpec | null
  /** @internal */
  zod(mode?: ValidationMode, context?: ValidationContext): ZodTypeAny
  optional(): FieldDescriptor<Nullable<K>>
  unique(): FieldDescriptor<K>
  /**
   * The field has a value per language (text, slug, rich text, blocks). The entry's
   * own row holds the default language; translations live in `<entity>_locales`, and
   * an untranslated value falls back to the default language. Needs `defineLocales`.
   */
  localized(): FieldDescriptor<K>
  withDefault(value: K['out']): FieldDescriptor<Defaulted<K>>
  /** Human-friendly admin label (defaults to a humanized field key). One string, or one per admin locale. */
  label(text: LocalizedText): FieldDescriptor<K>
  /** Help text shown under the field in the admin form. */
  help(text: LocalizedText): FieldDescriptor<K>
  /**
   * Where the field sits in the writing editor (rich-text entries such as news):
   * 'main' (the text column) or 'sidebar' (the details beside it). Unset = decided by
   * field type: text, rich text and media go in the main column; slugs, selects,
   * dates, switches and relations in the details. Form and preview editors show every
   * field in sections (see `admin.sections`).
   */
  position(where: 'main' | 'sidebar'): FieldDescriptor<K>
  /**
   * The icon shown in the field's control in the admin (any Iconify name, e.g.
   * `i-lucide-map-pin`). Unset = from the kind of field: dates, links, e-mails.
   */
  icon(name: string): FieldDescriptor<K>
  /** Put the field in a named, collapsible group in the editor (e.g. 'Search & sharing'). */
  group(label: LocalizedText): FieldDescriptor<K>
}

/** Any descriptor, regardless of kind. */
export type AnyFieldDescriptor = FieldDescriptor<FieldKind>
