import type { LocalizedText } from './i18n'
import type { ZodTypeAny } from 'zod'

export type OnDelete = 'cascade' | 'restrict' | 'set null' | 'no action'
export type RelationKind = 'many-to-one' | 'one-to-many' | 'many-to-many'
export type ValidationMode = 'create' | 'update'

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
export type ColumnBase =
  | { kind: 'uuid' }
  | { kind: 'text' }
  | { kind: 'integer' }
  | { kind: 'numeric'; precision: number; scale: number }
  | { kind: 'boolean' }
  | { kind: 'timestamp' }
  | { kind: 'jsonb' }
  | { kind: 'enum'; values: readonly string[] }

export type ColumnDefault =
  | { kind: 'value'; value: unknown }
  | { kind: 'now' }
  | { kind: 'random' }

export interface ColumnReference {
  target: 'media' | 'relation'
  onDelete: OnDelete
}

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
  default?: unknown
  dbDefault?: 'now' | 'random'
  ui: FieldUi
  meta: Record<string, unknown>
  relation?: RelationSpec
  /** null ⇒ owns no DB column (many-to-many, one-to-many). */
  spec: ColumnSpec | null
  zod(mode?: ValidationMode): ZodTypeAny
  optional(): FieldDescriptor<Nullable<K>>
  unique(): FieldDescriptor<K>
  withDefault(value: K['out']): FieldDescriptor<Defaulted<K>>
  /** Human-friendly admin label (defaults to a humanized field key). One string, or one per admin locale. */
  label(text: LocalizedText): FieldDescriptor<K>
  /** Help text shown under the field in the admin form. */
  help(text: LocalizedText): FieldDescriptor<K>
}

/** Any descriptor, regardless of kind. */
export type AnyFieldDescriptor = FieldDescriptor<FieldKind>
