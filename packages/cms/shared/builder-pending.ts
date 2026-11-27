// The editor in the preview: the changes to entries and globals made in the page, waiting in the page's
// editor (since 2g). The page's editor keeps, per entry it was asked to change, the row as the entry's own
// form loads it (`base`, with its version) and the fields changed since (`values`, whole top-level fields,
// as a save sends them). One save stores the page and each of these through the entry's own update route,
// with the version it was loaded at; the preview shows them through the draft store (per person, entity
// and id), and the page's undo and redo hold them as steps beside the page's own.
//
// Pure functions of plain values (the admin's bridge, app/composables/useCmsBuilder.ts, does the
// requests), tested in test/unit/builder-pending.spec.ts.
import { cmsTextClip } from './builder'
import { cmsValueAt, cmsValueSet } from './builder-values'

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** An entry (or a global) with changes made in the page. */
export interface CmsPendingEntry {
  entity: string
  /** The entry as the page names it (a global whose answer has no id: the global's name). */
  id: string
  /** The row's own id, for the draft and the save. */
  rowId: string
  global: boolean
  /** The language written to: a translation's code, or `null` for the entry itself. */
  locale: string | null
  /** The row as the entry's form loads it, and the version it was loaded at. */
  base: Record<string, unknown>
  version: string | null
  /** The changed fields (top-level, whole values), by key. */
  values: Record<string, unknown>
  /** Whether this person may save it (the server's verdict with the row). */
  can: boolean
  /** Why the last save of it was refused. */
  error: string | null
}

export const cmsPendingKey = (entity: string, id: string): string => `${entity}\n${id}`

/** The entry's row with the changes laid over it. */
export const cmsPendingRow = (entry: Pick<CmsPendingEntry, 'base' | 'values'>): Record<string, unknown> => ({ ...entry.base, ...entry.values })

/**
 * What a change at `at` does to the entry: the top-level field it is in, that field's whole value before
 * and after. `null` when the path is not there (an item that is gone) or nothing changes.
 */
export function cmsPendingChange(entry: Pick<CmsPendingEntry, 'base' | 'values'>, at: readonly string[], value: unknown): { key: string; before: unknown; after: unknown } | null {
  const key = at[0]
  if (!key) return null
  const row = cmsPendingRow(entry)
  if (!Object.hasOwn(row, key) && at.length > 1) return null
  const before = row[key]
  const after = at.length === 1 ? value : cmsValueSet(before, at.slice(1), value)
  if (after === undefined || same(before, after)) return null
  return { key, before, after }
}

/** The changed fields with `key` set to `value`: a field put back to what the row holds is no change. */
export function cmsPendingPut(entry: Pick<CmsPendingEntry, 'base' | 'values'>, key: string, value: unknown): Record<string, unknown> {
  const { [key]: _gone, ...rest } = entry.values
  return same(entry.base[key], value) ? rest : { ...rest, [key]: value }
}

/** A field of the admin's graph, as far as these functions read it. */
export interface CmsGraphField {
  key: string
  type: string
  optional?: boolean
  readOnly?: boolean
  localized?: boolean
  relation?: { kind?: string } | null
  meta?: Record<string, unknown> | null
}

/**
 * The field's description at a path of an entry: the field itself, a field of a list's item (by the
 * item's type) or of a group. `null` when the path leads nowhere.
 */
export function cmsEntryFieldAt<F extends CmsGraphField>(fields: readonly F[], row: Record<string, unknown>, at: readonly string[]): F | null {
  let list: readonly F[] = fields
  let value: unknown = row
  let field: F | null = null
  for (let i = 0; i < at.length; i++) {
    const step = at[i]!
    if (Array.isArray(value)) {
      // An item of a list: its fields are those of its type.
      const item = value.find((x) => isObject(x) && x.id === step) as Record<string, unknown> | undefined
      const defs = field?.meta?.blocks
      const def = item && isObject(defs) && typeof item.type === 'string' && Object.hasOwn(defs, item.type) ? defs[item.type] : undefined
      if (!item || !isObject(def) || !Array.isArray(def.fields)) return null
      list = def.fields as F[]
      value = item
      field = null
      continue
    }
    field = list.find((f) => f.key === step) ?? null
    if (!field || !isObject(value)) return null
    value = value[step]
    if (field.type === 'group' && Array.isArray(field.meta?.fields)) list = field.meta.fields as F[]
  }
  return field
}

/** A plain text as its field takes it: one line unless it is multiline, at most its maximum. */
export function cmsPendingText(field: CmsGraphField | null, value: string): string {
  const max = typeof field?.meta?.max === 'number' && field.meta.max > 0 ? field.meta.max : undefined
  return cmsTextClip(value, { lines: !!field?.meta?.multiline, max })
}

/** Whether a field at a path may be typed in the page as a plain text. */
export const cmsIsPlainText = (field: CmsGraphField | null): boolean => !!field && field.type === 'text' && !field.meta?.format && !field.readOnly

/**
 * What a save of the entry sends. An entry of a collection: the changed fields only (its update takes a
 * part). A global: every field this person may write, as its form sends them (its save replaces the whole
 * global), with the changes laid over the row; an empty optional value is left out, as the form leaves it.
 * A translation: the changed fields that are per-language.
 */
export function cmsPendingBody(entry: Pick<CmsPendingEntry, 'base' | 'values' | 'global' | 'locale'>, fields: readonly CmsGraphField[]): Record<string, unknown> {
  if (entry.locale) {
    const localized = new Set(fields.filter((f) => f.localized).map((f) => f.key))
    return Object.fromEntries(Object.entries(entry.values).filter(([key]) => localized.has(key)))
  }
  if (!entry.global) return { ...entry.values }
  const row = cmsPendingRow(entry)
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.relation?.kind === 'one-to-many' || f.readOnly) continue
    const many = f.relation?.kind === 'many-to-many'
    let v = row[f.key]
    if (!Object.hasOwn(row, f.key)) v = f.type === 'boolean' ? false : many ? [] : f.type === 'richtext' ? { type: 'doc', content: [] } : f.type === 'blocks' ? [] : f.type === 'group' ? (f.optional ? null : {}) : undefined
    // A value that is not there is not sent (as JSON leaves it out); an empty optional one is left out, as the form leaves it.
    if (v === undefined || (v === '' && (f.optional || many))) continue
    out[f.key] = v
  }
  return out
}

/** What one save stores, for the line beside the save button: the page itself, and how many entries and globals besides. */
export function cmsPendingSummary(pageDirty: boolean, entries: readonly Pick<CmsPendingEntry, 'values'>[]): { page: boolean; others: number } {
  return { page: pageDirty, others: entries.filter((e) => Object.keys(e.values).length > 0).length }
}

/** A step of the editor's history: a page-blocks field's whole value, or one field of an entry or a global. */
export type CmsBuilderStep =
  | { key: string; value: unknown[] }
  | { entry: { entity: string; id: string }; field: string; value: unknown }

export const isEntryStep = (step: CmsBuilderStep): step is Extract<CmsBuilderStep, { entry: object }> => 'entry' in step

/** The value an entry's text has now (its row with the changes), as a string for the page to start typing from. */
export function cmsPendingValueAt(entry: Pick<CmsPendingEntry, 'base' | 'values'>, at: readonly string[]): unknown {
  return cmsValueAt(cmsPendingRow(entry), at)
}
