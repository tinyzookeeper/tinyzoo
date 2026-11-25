// The structure editor's shared logic (/admin/_model): what the list and the dialogs read from
// the document, the operations a form turns into, and a refusal in a person's words. Pure, so it
// is tested without a browser. Names and limits come from tinyzoo's own rules (`model-doc.ts`),
// never copied here.
import {
  modelTypeName, modelFieldKey, modelPagePrefix, MODEL_PURGE_EMPTY_AFTER_MS,
  type ModelDoc, type ModelType, type ModelField, type ModelFieldInput, type ModelOp, type ModelLabel, type ModelOrder,
  MODEL_LABEL_MAX, MODEL_HELP_MAX,
} from '../../src/model-doc'
import { snake } from '../../src/fields'
import { cmsRequestError } from './cmsIssues'
import en from '../i18n/en'
import cs from '../i18n/cs'
import de from '../i18n/de'

type T = (key: any, params?: Record<string, any>) => string

/** What `GET /api/cms/_model` answers. */
export interface CmsModelData {
  version: number
  doc: ModelDoc
  problems: { type: string; field?: string; message: string }[]
  limits: { types: number; fields: number; options: number }
  used: { types: number }
  design: CmsModelDesignType[]
  entries: Record<string, number>
}

/** One type of the website's design, as the server describes it (read-only here). */
export interface CmsModelDesignType {
  name: string
  label: ModelLabel | string | null
  labelSingular?: ModelLabel | string | null
  icon?: string | null
  singleton: boolean
  /** A collection of content a field may point at (not a form's messages, redirects or a plugin's own). */
  relatable?: boolean
  fields: { key: string; type: string; label: ModelLabel | string | null }[]
}

/** Where a content type or one of its fields is shown: an entry, and the block of it when it is in one. */
export interface CmsModelPlace {
  entity: string
  id: string
  title: string
  /** The blocks field (`sections`), or a link field. */
  field: string | null
  /** The block that shows it; `label` is the block type's label. */
  block: { id: string; type: string; heading: string | null; label: any } | null
  locale: string | null
  /** Where the entry is edited. */
  admin: string
}

/** A place in the answer of `/api/cms/_model/attention`: what it shows that is gone. */
export interface CmsModelAttentionPlace extends CmsModelPlace {
  missing: { type?: string; fields?: string[] }
}

/** One thing code reads that a model does not keep (`ModelMisfit` of `src/model-fit.ts`). */
export interface CmsModelMisfit {
  type: string
  /** A field key, or a sort key or filter parameter of the list. */
  field?: string
  why: string
  message?: string
}

/** A registration a refused change would break (409 `breaks-code`). */
export interface CmsModelCodeBreak {
  name: string
  registeredAt: string
  updatedAt: string
  source: string
  breaks: CmsModelMisfit[]
}

/** One registration, as `GET /api/cms/_model/code` lists it. */
export interface CmsModelCodeRegistration {
  name: string
  /** When something first registered under this name. */
  registeredAt: string
  /** When the file in force now was registered. */
  updatedAt: string
  /** 'app' (the site's own build), 'token' or 'session'. */
  source: string
  by: { id: string; name: string } | null
  version: number
  /** How many types the file reads; null when this version cannot read the stored file. */
  types: number | null
  /** What the site lacks now of what the file reads; null when the file cannot be read. */
  breaks: CmsModelMisfit[] | null
}

/** A change that did not work, said for a person. */
export interface CmsModelProblemInfo {
  kind: 'stale' | 'busy' | 'in-use' | 'breaks-code' | 'refused' | 'other'
  code: string
  text: string
  /** The form field it is about, or null when the dialog says it. */
  at: 'label' | 'help' | 'key' | 'prefix' | 'options' | 'required' | 'to' | 'icon' | null
  places?: CmsModelPlace[]
  /** `breaks-code`: the code that reads what the change would take away. */
  registrations?: CmsModelCodeBreak[]
  /** `too-soon`: whole seconds until the thing may be deleted for good. */
  secondsLeft?: number
  fields?: { type: string; key: string }[]
  missing?: number
}

/** The modal's classes that make it a full sheet on a phone (Nuxt UI centres it with translate; these undo that below 640 px). */
export function cmsSheetUi(width = 'sm:max-w-xl'): { content: string } {
  return { content: `${width} max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-none max-sm:h-dvh max-sm:max-h-none max-sm:rounded-none max-sm:ring-0` }
}

/** Icons a content type can wear: the things a small business lists. */
export const CMS_MODEL_ICONS: readonly string[] = [
  'i-lucide-graduation-cap', 'i-lucide-calendar-days', 'i-lucide-map-pin', 'i-lucide-users-round',
  'i-lucide-briefcase', 'i-lucide-package', 'i-lucide-quote', 'i-lucide-utensils',
  'i-lucide-newspaper', 'i-lucide-tag', 'i-lucide-house', 'i-lucide-car',
  'i-lucide-book-open', 'i-lucide-music', 'i-lucide-dumbbell', 'i-lucide-gift',
  'i-lucide-award', 'i-lucide-circle-help', 'i-lucide-file-text', 'i-lucide-camera',
  'i-lucide-heart', 'i-lucide-star', 'i-lucide-scissors', 'i-lucide-shapes',
]

/** The icon of a type that has none. */
export const CMS_MODEL_DEFAULT_ICON = 'i-lucide-shapes'

export type CmsModelKindId = 'text' | 'longtext' | 'richtext' | 'number' | 'boolean' | 'datetime' | 'select' | 'media' | 'file' | 'gallery' | 'color' | 'relation'

/** The kinds of field a person picks from: `type` is the document's kind, `long` marks the long text. Texts: `model.kinds.<id>`. */
export const CMS_MODEL_KINDS: readonly { id: CmsModelKindId; type: ModelField['type']; long?: true; icon: string }[] = [
  { id: 'text', type: 'text', icon: 'i-lucide-type' },
  { id: 'longtext', type: 'text', long: true, icon: 'i-lucide-align-left' },
  { id: 'richtext', type: 'richtext', icon: 'i-lucide-text' },
  { id: 'number', type: 'number', icon: 'i-lucide-hash' },
  { id: 'boolean', type: 'boolean', icon: 'i-lucide-toggle-right' },
  { id: 'datetime', type: 'datetime', icon: 'i-lucide-calendar' },
  { id: 'select', type: 'select', icon: 'i-lucide-list-checks' },
  { id: 'media', type: 'media', icon: 'i-lucide-image' },
  { id: 'file', type: 'file', icon: 'i-lucide-paperclip' },
  { id: 'gallery', type: 'gallery', icon: 'i-lucide-images' },
  { id: 'color', type: 'color', icon: 'i-lucide-palette' },
  { id: 'relation', type: 'relation', icon: 'i-lucide-link-2' },
]

/** The kind a field is shown as (a text that is long is its own kind). */
export function cmsModelKindOf(field: Pick<ModelField, 'type'> & { long?: boolean }): CmsModelKindId {
  if (field.type === 'text' && field.long) return 'longtext'
  return field.type === 'text' ? 'text' : field.type
}

/** The icon of a kind. */
export const cmsModelKindIcon = (id: CmsModelKindId): string => CMS_MODEL_KINDS.find((k) => k.id === id)?.icon ?? CMS_MODEL_DEFAULT_ICON

/** Whether a field of this kind may be required (a picture, a file, a gallery, a switch and a link never are). */
export const cmsModelCanRequire = (id: CmsModelKindId): boolean => !['media', 'file', 'gallery', 'boolean', 'relation'].includes(id)

/** The types a person sees: not hidden, in the document's order. */
export const cmsModelVisibleTypes = (doc: ModelDoc): ModelType[] => doc.types.filter((t) => !t.removedAt)
/** The types that are removed (hidden, content kept) until a person restores or deletes them. */
export const cmsModelHiddenTypes = (doc: ModelDoc): ModelType[] => doc.types.filter((t) => !!t.removedAt)
/** The fields of a type a person sees, in the form's order. */
export const cmsModelFields = (type: ModelType): ModelField[] => type.fields.filter((f) => !f.removedAt)
/** The fields of a type that are removed. */
export const cmsModelHiddenFields = (type: ModelType): ModelField[] => type.fields.filter((f) => !!f.removedAt)
/** How many fields of a type count toward the limit: the visible ones, removed ones do not. */
export const cmsModelFieldsUsed = (type: ModelType): number => cmsModelFields(type).length
/** Whether a type has all the fields it may have. */
export const cmsModelFieldsAtLimit = (type: ModelType, limit: number): boolean => cmsModelFieldsUsed(type) >= limit
/** Whether the site has all the content types it may have (removed ones do not count). */
export const cmsModelTypesAtLimit = (doc: ModelDoc, limit: number): boolean => cmsModelVisibleTypes(doc).length >= limit

/** When the server deletes a removed thing by itself, or null: only what was removed empty is ever deleted by the server, after an hour. */
export function cmsModelPurgeAt(item: { removedAt?: string | null; removedEmpty?: boolean }): Date | null {
  if (!item.removedAt || item.removedEmpty !== true) return null
  const at = Date.parse(item.removedAt)
  if (Number.isNaN(at)) return null
  return new Date(at + MODEL_PURGE_EMPTY_AFTER_MS)
}

/** Every name a new type may not have: the document's types (hidden too), the design's, and the choices' database types. */
export function cmsModelTakenTypeNames(doc: ModelDoc, design: { name: string }[]): string[] {
  const names = new Set<string>([...doc.types.map((t) => t.name), ...design.map((d) => d.name)])
  // The name the server gives the database type of a choice field: a new type may not have it.
  for (const t of doc.types) for (const f of t.fields) if (f.type === 'select') names.add(`${snake(t.name)}_${snake(f.key)}`)
  return [...names]
}

/** The address parts the document's types use for their pages, hidden types too. */
export const cmsModelTakenPrefixes = (doc: ModelDoc): string[] => doc.types.flatMap((t) => (t.page ? [t.page.prefix] : []))

export type CmsModelStarter = 'picture' | 'summary' | 'text' | 'date'

/** A label in all three admin languages, from the catalogues (`model.starters.<id>`). */
export function cmsModelStarterLabel(id: CmsModelStarter): ModelLabel {
  return { cs: cs.model.starters[id], en: en.model.starters[id], de: de.model.starters[id] }
}

export interface CmsModelNewTypeState {
  plural: string
  singular: string
  icon: string | null
  pages: boolean
  prefix: string
  drafts: boolean
  starters: CmsModelStarter[]
}

const STARTER_FIELDS: Record<CmsModelStarter, (label: ModelLabel, key: string) => Extract<ModelOp, { op: 'field.add' }>['field']> = {
  picture: (label, key) => ({ type: 'media', key, label }),
  summary: (label, key) => ({ type: 'text', long: true, key, label }),
  text: (label, key) => ({ type: 'richtext', key, label }),
  date: (label, key) => ({ type: 'datetime', key, label }),
}
const STARTER_ORDER: CmsModelStarter[] = ['picture', 'summary', 'text', 'date']

/** The operations that make a new type from the dialog's answers, and the name it will have. One request does all of it. */
export function cmsModelNewType(
  state: CmsModelNewTypeState,
  ctx: { doc: ModelDoc; design: { name: string }[]; locale: string; starterLabel?: (id: CmsModelStarter) => ModelLabel },
): { name: string; ops: ModelOp[] } {
  const { locale } = ctx
  const starterLabel = ctx.starterLabel ?? cmsModelStarterLabel
  const plural = state.plural.trim()
  const singular = state.singular.trim()
  const name = modelTypeName(plural, cmsModelTakenTypeNames(ctx.doc, ctx.design))
  const prefix = state.prefix.trim() || modelPagePrefix(plural, cmsModelTakenPrefixes(ctx.doc))
  const add: Extract<ModelOp, { op: 'type.add' }> = {
    op: 'type.add',
    name,
    label: { [locale]: plural },
    ...(singular ? { labelSingular: { [locale]: singular } } : {}),
    ...(state.icon ? { icon: state.icon } : {}),
    page: state.pages ? { prefix } : null,
    publish: state.drafts,
  }
  const ops: ModelOp[] = [add]
  const keys = ['title']
  const made: Partial<Record<CmsModelStarter, string>> = {}
  for (const id of STARTER_ORDER) {
    if (!state.starters.includes(id)) continue
    const label = starterLabel(id)
    const key = modelFieldKey(label[locale] ?? Object.values(label)[0] ?? id, keys)
    keys.push(key)
    made[id] = key
    ops.push({ op: 'field.add', type: name, field: STARTER_FIELDS[id](label, key) })
  }
  if (state.pages && (made.picture || made.summary)) {
    ops.push({ op: 'type.update', type: name, page: { ...(made.picture ? { image: made.picture } : {}), ...(made.summary ? { summary: made.summary } : {}) } })
  }
  return { name, ops }
}

// The text of each refusal code is `model.errors.<camelCase code>`. Codes that mean "this is gone" share one text.
const ERROR_ALIAS: Record<string, string> = {
  'unknown-type': 'gone', 'type-hidden': 'gone', 'unknown-field': 'gone', 'already-removed': 'gone', 'not-removed': 'gone',
  'invalid-op': 'generic', 'not-changeable': 'generic', 'design-type': 'generic', 'no-page': 'generic', 'invalid-doc': 'generic',
  'invalid-request': 'generic', 'not-due': 'generic', 'too-large': 'generic',
}
const KNOWN = new Set([
  'limit-types', 'limit-fields', 'limit-options', 'limit-label', 'limit-help', 'limit-size', 'limit-removed-types', 'limit-removed-fields', 'too-soon', 'invalid-label', 'invalid-name', 'reserved-key',
  'name-taken', 'name-clash', 'invalid-prefix', 'prefix-taken', 'needs-optional', 'has-missing-values', 'invalid-option', 'last-option',
  'unknown-target', 'target-hidden', 'title-field', 'system-field', 'order-manual', 'points-at-type', 'in-use', 'stale-version', 'busy',
  'not-allowed', 'invalid-icon', ...Object.keys(ERROR_ALIAS),
])
const camel = (code: string): string => code.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

const AT: Record<string, CmsModelProblemInfo['at']> = {
  'invalid-label': 'label', 'limit-label': 'label', 'limit-help': 'help',
  'invalid-prefix': 'prefix', 'prefix-taken': 'prefix',
  'limit-options': 'options', 'invalid-option': 'options', 'last-option': 'options',
  'needs-optional': 'required', 'has-missing-values': 'required',
  'unknown-target': 'to', 'target-hidden': 'to', 'invalid-icon': 'icon',
}

/** Whole seconds left of a wait in milliseconds, rounded up, at least one. */
export const cmsModelSecondsLeft = (ms: unknown): number => (typeof ms === 'number' && Number.isFinite(ms) ? Math.max(1, Math.ceil(ms / 1000)) : 1)

/**
 * A refused change in the admin's language, and the form field it is about. `ops` are the ones that were
 * sent: a name that is taken is about the label of a new type, and about the key of a field.
 */
export function cmsModelProblem(err: any, t: T, ops: ModelOp[] = []): CmsModelProblemInfo {
  const status: number | undefined = err?.statusCode ?? err?.status ?? err?.response?.status
  const data = err?.data?.data ?? err?.data
  const code: string = typeof data?.code === 'string' ? data.code : ''
  if (code === 'stale-version' || (status === 409 && code === 'stale-version')) {
    return { kind: 'stale', code, text: t('model.errors.staleVersion'), at: null }
  }
  if (status === 503 || code === 'busy') return { kind: 'busy', code: code || 'busy', text: t('model.errors.busy'), at: null }
  if (code === 'in-use') {
    return { kind: 'in-use', code, text: t('model.errors.inUse'), at: null, places: Array.isArray(data.places) ? data.places : [] }
  }
  // The words that name the code and what it reads need the document: `cmsModelCodeRefusalText` makes them.
  if (code === 'breaks-code') {
    const registrations = Array.isArray(data.registrations) ? data.registrations.filter((r: any) => r && typeof r.name === 'string') : []
    return { kind: 'breaks-code', code, text: t('model.code.refusal.short'), at: null, registrations }
  }
  if (!KNOWN.has(code)) return { kind: 'other', code, text: cmsRequestError(err, t as any), at: null }

  const details = data?.details && typeof data.details === 'object' ? data.details : {}
  const op = typeof data?.op === 'number' ? ops[data.op] : undefined
  let at: CmsModelProblemInfo['at'] = AT[code] ?? null
  if (code === 'invalid-name' || code === 'reserved-key' || code === 'name-taken' || code === 'name-clash') at = op?.op === 'type.add' ? 'label' : 'key'
  const out: CmsModelProblemInfo = { kind: 'refused', code, text: '', at }
  const alias = ERROR_ALIAS[code] ?? camel(code)
  if (code === 'has-missing-values') {
    if (typeof details.missing === 'number') {
      out.missing = details.missing
      out.text = t('model.errors.hasMissingValues', { count: details.missing })
    }
    else out.text = t('model.errors.hasMissingValuesSome')
  }
  else if (code === 'limit-removed-types' || code === 'limit-removed-fields') {
    out.text = t(`model.errors.${camel(code)}`, { limit: typeof details.limit === 'number' ? details.limit : 0 })
  }
  else if (code === 'too-soon') {
    out.secondsLeft = cmsModelSecondsLeft(details.msLeft)
    out.text = t('model.errors.tooSoon', { count: out.secondsLeft })
  }
  else if (code === 'limit-label') out.text = t('model.errors.limitLabel', { max: MODEL_LABEL_MAX })
  else if (code === 'limit-help') out.text = t('model.errors.limitHelp', { max: MODEL_HELP_MAX })
  else out.text = t(`model.errors.${alias}`)
  if (code === 'points-at-type' && Array.isArray(details.fields)) out.fields = details.fields
  return out
}

const NOTE_TEXT: Record<string, string> = {
  'list-column-cleared': 'model.notes.listColumnCleared',
  'order-cleared': 'model.notes.orderCleared',
  'page-image-cleared': 'model.notes.pageImageCleared',
  'page-summary-cleared': 'model.notes.pageSummaryCleared',
  'default-cleared': 'model.notes.defaultCleared',
  'restored-optional': 'model.notes.restoredOptional',
}

/** What a change made safe on the way, in words (a toast's description). An unknown code says nothing. */
export function cmsModelNoteText(note: { code: string }, t: T): string {
  const key = NOTE_TEXT[note.code]
  return key ? t(key) : ''
}

/** All notes of a change as one text, each sentence once. */
export const cmsModelNotesText = (notes: { code: string }[], t: T): string =>
  [...new Set(notes.map((n) => cmsModelNoteText(n, t)).filter(Boolean))].join(' ')

// ---------------------------------------------------------------------------------------------
// Dates of a hidden thing (the list and the page of a type say them the same way)

/** What the date helpers need: the admin's formatter, its texts, and "now" (a parameter, so tests fix it). */
export interface CmsModelDateCtx {
  t: T
  formatDateWith: (value: Date | string | number, options: Intl.DateTimeFormatOptions) => string
  now?: Date
}

/** A day and month; the year only when it is not this year. */
export function cmsModelDayText(value: Date | string, ctx: Pick<CmsModelDateCtx, 'formatDateWith' | 'now'>): string {
  const d = value instanceof Date ? value : new Date(value)
  const year = (ctx.now ?? new Date()).getFullYear()
  return ctx.formatDateWith(d, d.getFullYear() === year ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * The line under a removed row. A thing removed while it held nothing says when the server deletes it
 * (an hour after, with the time); any other says when it was removed and that its content is kept.
 * Empty when it is not removed.
 */
export function cmsModelRemovedLine(item: { removedAt?: string | null; removedEmpty?: boolean }, ctx: CmsModelDateCtx): string {
  if (!item.removedAt) return ''
  const at = cmsModelPurgeAt(item)
  if (at) return ctx.t('model.deletedOnAt', { date: cmsModelDayText(at, ctx), time: ctx.formatDateWith(at, { timeStyle: 'short' }) })
  const removed = new Date(item.removedAt)
  if (Number.isNaN(removed.getTime())) return ''
  return ctx.t('model.removedOn', { date: cmsModelDayText(removed, ctx) })
}

/** When a thing that is removed right now while it holds nothing is deleted by the server: an hour from now. */
export const cmsModelPurgeFromNow = (now: Date = new Date()): Date => new Date(now.getTime() + MODEL_PURGE_EMPTY_AFTER_MS)

// ---------------------------------------------------------------------------------------------
// Order of the fields

/** A key moved one step; the same list at either end. */
export function cmsModelMoveKey(keys: readonly string[], index: number, delta: -1 | 1): string[] {
  const next = index + delta
  if (index < 0 || index >= keys.length || next < 0 || next >= keys.length) return [...keys]
  const out = [...keys]
  const [key] = out.splice(index, 1)
  out.splice(next, 0, key!)
  return out
}

/** A key dragged to another place. */
export function cmsModelMoveKeyTo(keys: readonly string[], from: number, to: number): string[] {
  if (from < 0 || from >= keys.length || to < 0 || to >= keys.length || from === to) return [...keys]
  const out = [...keys]
  const [key] = out.splice(from, 1)
  out.splice(to, 0, key!)
  return out
}

/** The operation that saves an order of the visible fields. */
export const cmsModelOrderOp = (type: string, keys: string[]): ModelOp => ({ op: 'field.order', type, keys })

/** Whether two lists hold the same keys in the same order. */
export const cmsModelSameKeys = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((k, i) => k === b[i])

// ---------------------------------------------------------------------------------------------
// What a field row says

/** The block of a place in words: its heading, else its kind ("Entries"); empty for a place that is not in a block. */
export const cmsModelPlaceBlock = (p: Pick<CmsModelPlace, 'block'>, tl: (label: any, fallback?: string) => string): string =>
  p.block ? (p.block.heading?.trim() || tl(p.block.label, p.block.type)) : ''

/** Each place once: the same entry may show the type in several blocks, and each block is a place of its own. */
export const cmsModelDistinctPlaces = <P extends Pick<CmsModelPlace, 'entity' | 'id' | 'block'>>(all: readonly P[]): P[] =>
  all.filter((p, i) => all.findIndex((q) => q.entity === p.entity && q.id === p.id && (q.block?.id ?? '') === (p.block?.id ?? '')) === i)

/** How many different places a usage answer lists (one entry shown twice counts once). */
export const cmsModelUsageCount = (places: { id: string }[] | null | undefined): number => new Set((places ?? []).map((p) => p.id)).size

/** The words under a field's name: its kind, and what else matters ("required", "3 choices", "links to Courses"). */
export function cmsModelFieldParts(
  field: ModelField,
  ctx: { t: T; isTitle: boolean; targetName: (to: string) => string; places?: number | null },
): string[] {
  const { t } = ctx
  const parts = [t(`model.kinds.${cmsModelKindOf(field)}.name`)]
  if (ctx.isTitle) return [...parts, t('model.field.namesEvery')]
  if ('required' in field && field.required) parts.push(t('model.field.requiredShort'))
  if (field.type === 'select') parts.push(t('model.field.choicesCount', { count: field.options.filter((o) => !o.removed).length }))
  if (field.type === 'relation') parts.push(t('model.field.linksTo', { name: ctx.targetName(field.to) }))
  if (ctx.places) parts.push(t('model.field.shownOn', { count: ctx.places }))
  return parts
}

/** The kind of a field of the design, as a tile's words and icon, or a few extra words. */
export function cmsModelDesignKind(type: string): { icon: string; key: string } {
  const tile = (id: CmsModelKindId) => ({ icon: cmsModelKindIcon(id), key: `model.kinds.${id}.name` })
  switch (type) {
    case 'text': return tile('text')
    case 'richtext': return tile('richtext')
    case 'number': return tile('number')
    case 'boolean': return tile('boolean')
    case 'datetime': return tile('datetime')
    case 'select': return tile('select')
    case 'media': return tile('media')
    case 'file': return tile('file')
    case 'gallery': return tile('gallery')
    case 'color': return tile('color')
    case 'relation': return tile('relation')
    case 'slug': return { icon: 'i-lucide-link', key: 'model.designKinds.slug' }
    case 'blocks': return { icon: 'i-lucide-layout-grid', key: 'model.designKinds.blocks' }
    case 'list': return { icon: 'i-lucide-list', key: 'model.designKinds.list' }
    case 'group': return { icon: 'i-lucide-folder', key: 'model.designKinds.group' }
    default: return { icon: 'i-lucide-circle-help', key: 'model.designKinds.misc' }
  }
}

// ---------------------------------------------------------------------------------------------
// The form of one field

/** One choice in the form: `value` never changes once made; a row added in the form is `isNew`. */
export interface CmsModelOptionRow {
  value: string
  label: string
  /** The text it had when the form opened (to tell what changed). */
  initial: string
  isNew: boolean
  removed: boolean
  wasRemoved: boolean
}

export type CmsModelTextFormat = 'plain' | 'email' | 'url' | 'link'

/** What the field dialog holds. Numbers are typed as text, so an empty box means "none". */
export interface CmsModelFieldForm {
  kind: CmsModelKindId
  label: string
  help: string
  required: boolean
  key: string
  options: CmsModelOptionRow[]
  /** The preselected choice's value, '' for nothing. */
  preset: string
  decimal: boolean
  min: string
  max: string
  format: CmsModelTextFormat
  allDay: boolean
  to: string
  on: boolean
}

/** The form of a field that has not been made yet. */
export const cmsModelBlankForm = (kind: CmsModelKindId): CmsModelFieldForm => ({
  kind, label: '', help: '', required: false, key: '', options: [], preset: '', decimal: false, min: '', max: '', format: 'plain', allDay: false, to: '', on: false,
})

const numberText = (n: number | null | undefined): string => (n === null || n === undefined ? '' : String(n))

/** The form of a field that exists, filled with what it is now. `read` turns a label into the admin's language. */
export function cmsModelFormOf(field: ModelField, read: (label: ModelLabel | null | undefined) => string): CmsModelFieldForm {
  const form = cmsModelBlankForm(cmsModelKindOf(field))
  form.label = read(field.label)
  form.help = read(field.help)
  form.key = field.key
  if ('required' in field) form.required = field.required === true
  switch (field.type) {
    case 'text': form.format = field.format ?? 'plain'; form.max = numberText(field.max); break
    case 'number': form.decimal = field.decimal === true; form.min = numberText(field.min); form.max = numberText(field.max); break
    case 'boolean': form.on = field.default === true; break
    case 'datetime': form.allDay = field.allDay === true; break
    case 'select':
      form.options = field.options.map((o) => ({ value: o.value, label: read(o.label), initial: read(o.label), isNew: false, removed: o.removed === true, wasRemoved: o.removed === true }))
      form.preset = field.default ?? ''
      break
    case 'relation': form.to = field.to; break
    default:
  }
  return form
}

/** The key a new field gets from its label, free among the type's fields (hidden ones too). */
export const cmsModelNewFieldKey = (label: string, type: Pick<ModelType, 'fields'>): string => modelFieldKey(label, type.fields.map((f) => f.key))

/** The choices that are offered. */
export const cmsModelOfferedRows = (form: Pick<CmsModelFieldForm, 'options'>): CmsModelOptionRow[] => form.options.filter((o) => !o.removed)

/** A choice added to the list: its value is made from its text, free among the values there. Empty text adds nothing. */
export function cmsModelAddOptionRow(rows: readonly CmsModelOptionRow[], text: string): CmsModelOptionRow[] {
  const label = text.trim()
  if (!label) return [...rows]
  const value = modelPagePrefix(label, rows.map((r) => r.value))
  return [...rows, { value, label, initial: label, isNew: true, removed: false, wasRemoved: false }]
}

/** Removing a choice: one added in the form is dropped, one that exists is marked. */
export function cmsModelRemoveOptionRow(rows: readonly CmsModelOptionRow[], value: string): CmsModelOptionRow[] {
  return rows.flatMap((r) => (r.value !== value ? [r] : r.isNew ? [] : [{ ...r, removed: true }]))
}

/** A choice that was marked in the form comes back. */
export const cmsModelRestoreOptionRow = (rows: readonly CmsModelOptionRow[], value: string): CmsModelOptionRow[] =>
  rows.map((r) => (r.value === value ? { ...r, removed: false } : r))

/** The preselected choice, or '' when its choice is not offered any more. */
export const cmsModelPreset = (form: Pick<CmsModelFieldForm, 'options' | 'preset'>): string =>
  cmsModelOfferedRows(form).some((o) => o.value === form.preset) ? form.preset : ''

/** A typed number: null when empty, undefined when it is not a number. */
export function cmsModelParseNumber(text: string): number | null | undefined {
  const s = text.trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export interface CmsModelFieldFormErrors { label?: string; options?: string; to?: string; range?: string }

/** What the form cannot send yet, in words, by the part of the form it is about. */
export function cmsModelFieldCheck(form: CmsModelFieldForm, t: T): CmsModelFieldFormErrors {
  const errors: CmsModelFieldFormErrors = {}
  if (!form.label.trim()) errors.label = t('model.validation.labelRequired')
  if (form.kind === 'select') {
    const offered = cmsModelOfferedRows(form)
    if (!offered.length) errors.options = t('model.validation.optionsRequired')
    else if (offered.some((o) => !o.label.trim())) errors.options = t('model.validation.optionEmpty')
  }
  if (form.kind === 'relation' && !form.to) errors.to = t('model.validation.targetRequired')
  if (form.kind === 'number') {
    const min = cmsModelParseNumber(form.min)
    const max = cmsModelParseNumber(form.max)
    if (min === undefined || max === undefined) errors.range = t('model.validation.numberInvalid')
    else if (min !== null && max !== null && min > max) errors.range = t('model.validation.rangeOrder')
  }
  return errors
}

const labelOf = (locale: string, text: string): ModelLabel => ({ [locale]: text.trim() })

/** The operation that makes the field. `locale` is the admin's language: the person's words are kept in it. */
export function cmsModelFieldAddOp(type: string, form: CmsModelFieldForm, locale: string): ModelOp {
  const kind = CMS_MODEL_KINDS.find((k) => k.id === form.kind)!
  const key = form.key.trim()
  const base = {
    ...(key ? { key } : {}),
    label: labelOf(locale, form.label),
    ...(form.help.trim() ? { help: labelOf(locale, form.help) } : {}),
  }
  const required = cmsModelCanRequire(form.kind) && form.required ? { required: true as const } : {}
  let field: ModelFieldInput
  switch (kind.type) {
    case 'text':
      field = { type: 'text', ...base, ...required, ...(kind.long ? { long: true } : {}), ...(!kind.long && form.format !== 'plain' ? { format: form.format } : {}) }
      break
    case 'number': {
      const min = cmsModelParseNumber(form.min)
      const max = cmsModelParseNumber(form.max)
      field = { type: 'number', ...base, ...required, ...(form.decimal ? { decimal: true } : {}), ...(typeof min === 'number' ? { min } : {}), ...(typeof max === 'number' ? { max } : {}) }
      break
    }
    case 'boolean': field = { type: 'boolean', ...base, ...(form.on ? { default: true } : {}) }; break
    case 'datetime': field = { type: 'datetime', ...base, ...required, ...(form.allDay ? { allDay: true } : {}) }; break
    case 'select': {
      const preset = cmsModelPreset(form)
      field = {
        type: 'select', ...base, ...required,
        options: cmsModelOfferedRows(form).map((o) => ({ value: o.value, label: labelOf(locale, o.label) })),
        ...(preset ? { default: preset } : {}),
      }
      break
    }
    case 'relation': field = { type: 'relation', ...base, to: form.to }; break
    case 'richtext': field = { type: 'richtext', ...base, ...required }; break
    case 'color': field = { type: 'color', ...base, ...required }; break
    default: field = { type: kind.type, ...base } as ModelFieldInput
  }
  return { op: 'field.add', type, field }
}

/**
 * The operation that saves a change of a field: only what changed, and only what that kind of field lets
 * change. Null when nothing did. `read` turns a stored label into the admin's language, as the form did.
 */
export function cmsModelFieldUpdateOp(
  type: string, field: ModelField, form: CmsModelFieldForm, locale: string, read: (label: ModelLabel | null | undefined) => string,
): Extract<ModelOp, { op: 'field.update' }> | null {
  const op: Extract<ModelOp, { op: 'field.update' }> = { op: 'field.update', type, key: field.key }
  const before = cmsModelFormOf(field, read)
  const set = <K extends keyof typeof op>(key: K, value: (typeof op)[K]) => { op[key] = value }

  if (form.label.trim() !== before.label) set('label', labelOf(locale, form.label))
  if (form.help.trim() !== before.help) set('help', form.help.trim() ? labelOf(locale, form.help) : null)
  if (cmsModelCanRequire(form.kind) && form.required !== before.required) set('required', form.required)

  switch (field.type) {
    case 'text':
      if (!field.long && form.format !== before.format && form.format !== 'link') set('format', form.format === 'plain' ? null : form.format)
      break
    case 'number': {
      const min = cmsModelParseNumber(form.min)
      const max = cmsModelParseNumber(form.max)
      if (min !== undefined && min !== (field.min ?? null)) set('min', min)
      if (max !== undefined && max !== (field.max ?? null)) set('max', max)
      break
    }
    case 'boolean':
      if (form.on !== before.on) set('default', form.on)
      break
    case 'datetime':
      if (form.allDay !== before.allDay) set('allDay', form.allDay)
      break
    case 'select': {
      const added = form.options.filter((o) => o.isNew && !o.removed)
      const labels = form.options.filter((o) => !o.isNew && o.label.trim() !== o.initial)
      const removed = form.options.filter((o) => !o.isNew && o.removed && !o.wasRemoved)
      const restored = form.options.filter((o) => !o.isNew && !o.removed && o.wasRemoved)
      if (added.length) set('addOptions', added.map((o) => ({ value: o.value, label: labelOf(locale, o.label) })))
      if (labels.length) set('optionLabels', Object.fromEntries(labels.map((o) => [o.value, labelOf(locale, o.label)])))
      if (removed.length) set('removeOptions', removed.map((o) => o.value))
      if (restored.length) set('restoreOptions', restored.map((o) => o.value))
      const preset = cmsModelPreset(form)
      if (preset !== before.preset) set('default', preset || null)
      break
    }
    default:
  }
  // Besides the three that name it, any key is a change.
  return Object.keys(op).length > 3 ? op : null
}

// ---------------------------------------------------------------------------------------------
// The settings of a type

/** A column of the list a person can tick: a field, or the address and the status the website keeps. */
export interface CmsModelColumnChoice { key: string; kind: 'field' | 'slug' | 'status'; field?: ModelField }

/** The columns the list can show, in the order of the fields; the address and the status after them. */
export function cmsModelColumnChoices(type: ModelType): CmsModelColumnChoice[] {
  return [
    ...cmsModelFields(type).map((field): CmsModelColumnChoice => ({ key: field.key, kind: 'field', field })),
    ...(type.page ? [{ key: 'slug', kind: 'slug' as const }] : []),
    ...(type.publish ? [{ key: 'status', kind: 'status' as const }] : []),
  ]
}

/** The fields the website can order its entries by (text, number, date, choice, switch). */
export const cmsModelOrderFields = (type: ModelType): ModelField[] =>
  cmsModelFields(type).filter((f) => ['text', 'number', 'datetime', 'select', 'boolean'].includes(f.type))

export interface CmsModelSettingsForm {
  plural: string
  singular: string
  icon: string
  ownColumns: boolean
  columns: string[]
  order: 'newest' | 'field' | 'manual'
  orderBy: string
  orderDir: 'asc' | 'desc'
  image: string
  summary: string
}

/** The settings of a type as they are now. */
export function cmsModelSettingsFormOf(type: ModelType, read: (label: ModelLabel | null | undefined) => string): CmsModelSettingsForm {
  const choices = new Set(cmsModelColumnChoices(type).map((c) => c.key))
  const columns = (type.listColumns ?? []).filter((k) => choices.has(k))
  const order = type.order
  return {
    plural: read(type.label),
    singular: read(type.labelSingular),
    icon: type.icon || CMS_MODEL_DEFAULT_ICON,
    ownColumns: !!type.listColumns?.length,
    columns,
    order: order === 'manual' ? 'manual' : order ? 'field' : 'newest',
    orderBy: order && order !== 'manual' ? order.by : (cmsModelOrderFields(type)[0]?.key ?? ''),
    orderDir: order && order !== 'manual' ? order.dir : 'asc',
    image: type.page?.image ?? '',
    summary: type.page?.summary ?? '',
  }
}

/** What the settings cannot be saved with yet. */
export function cmsModelSettingsCheck(form: CmsModelSettingsForm, t: T): { plural?: string; columns?: string; orderBy?: string } {
  const errors: { plural?: string; columns?: string; orderBy?: string } = {}
  if (!form.plural.trim()) errors.plural = t('model.validation.severalRequired')
  if (form.ownColumns && (form.columns.length < 1 || form.columns.length > 10)) errors.columns = t('model.validation.columnsRange')
  if (form.order === 'field' && !form.orderBy) errors.orderBy = t('model.validation.orderByRequired')
  return errors
}

/** The one `type.update` that saves the settings: only what changed. Null when nothing did. */
export function cmsModelSettingsOp(
  type: ModelType, form: CmsModelSettingsForm, locale: string, read: (label: ModelLabel | null | undefined) => string,
): Extract<ModelOp, { op: 'type.update' }> | null {
  const op: Extract<ModelOp, { op: 'type.update' }> = { op: 'type.update', type: type.name }
  const before = cmsModelSettingsFormOf(type, read)
  let changed = false
  if (form.plural.trim() !== before.plural) { op.label = labelOf(locale, form.plural); changed = true }
  if (form.singular.trim() !== before.singular) { op.labelSingular = form.singular.trim() ? labelOf(locale, form.singular) : null; changed = true }
  if (form.icon !== before.icon) { op.icon = form.icon; changed = true }

  // The columns, in the order the fields have; the website decides when the person does not choose.
  const choices = cmsModelColumnChoices(type).map((c) => c.key)
  const columns = form.ownColumns ? choices.filter((k) => form.columns.includes(k)) : null
  const was = type.listColumns?.length ? type.listColumns : null
  if (JSON.stringify(columns) !== JSON.stringify(was)) { op.listColumns = columns; changed = true }

  // Arranged by hand stays so: going back is refused by the server, so it is never sent.
  if (type.order !== 'manual') {
    const order: ModelOrder | null = form.order === 'manual' ? 'manual' : form.order === 'field' ? { by: form.orderBy, dir: form.orderDir } : null
    if (JSON.stringify(order) !== JSON.stringify(type.order ?? null)) { op.order = order; changed = true }
  }

  if (type.page) {
    const page: { image?: string | null; summary?: string | null } = {}
    if (form.image !== before.image) page.image = form.image || null
    if (form.summary !== before.summary) page.summary = form.summary || null
    if (Object.keys(page).length) { op.page = page; changed = true }
  }
  return changed ? op : null
}

// ---------------------------------------------------------------------------------------------
// Removing

/** The visible fields of other visible types that link to a type (what stops it from being removed). */
export function cmsModelPointingAt(doc: ModelDoc, name: string): { type: string; key: string }[] {
  return cmsModelVisibleTypes(doc)
    .filter((other) => other.name !== name)
    .flatMap((other) => cmsModelFields(other).filter((f) => f.type === 'relation' && f.to === name).map((f) => ({ type: other.name, key: f.key })))
}

/** Links to fields, named: "Teacher" in "Events". An unknown one keeps its keys. */
export function cmsModelFieldRefs(
  doc: ModelDoc, refs: { type: string; key: string }[], read: (label: ModelLabel | null | undefined) => string,
): { type: string; key: string; typeLabel: string; fieldLabel: string }[] {
  return refs.map((r) => {
    const type = doc.types.find((x) => x.name === r.type)
    const field = type?.fields.find((f) => f.key === r.key)
    return { ...r, typeLabel: (type && read(type.label)) || r.type, fieldLabel: (field && read(field.label)) || r.key }
  })
}

/** The operation that hides a type, or one of its fields. */
export const cmsModelRemoveOp = (type: string, key?: string | null): ModelOp =>
  (key ? { op: 'field.remove', type, key } : { op: 'type.remove', type })

/** The operation that deletes a removed type, or one of its removed fields, for good. */
export const cmsModelPurgeOp = (type: string, key?: string | null): ModelOp =>
  (key ? { op: 'purge', fields: [{ type, key }] } : { op: 'purge', types: [type] })

/** Text for comparing a typed name: trimmed, one space between words, composed, lower case. */
const foldName = (text: string): string => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()

/** Whether what a person typed is the name of the thing (case, spaces around it and the way an accent is typed do not matter). */
export const cmsModelNameMatches = (typed: string, name: string): boolean => {
  const want = foldName(name)
  return want !== '' && foldName(typed) === want
}

/** Whether a name has to be typed before deleting for good: when the thing holds something, or that could not be read (null). */
export const cmsModelDeleteNeedsName = (count: number | null | undefined): boolean => typeof count !== 'number' || count > 0

/** Fields that stop a type from being deleted for good: every relation field of another type that links to it (removed or not). */
export const cmsModelPurgeBlockers = (doc: ModelDoc, name: string): { type: string; key: string }[] =>
  doc.types
    .filter((other) => other.name !== name)
    .flatMap((other) => other.fields.filter((f) => f.type === 'relation' && f.to === name).map((f) => ({ type: other.name, key: f.key })))

// ---------------------------------------------------------------------------------------------
// Code that reads the types (registrations: docs/model-file-plan.md, sections 6 and 8)

/** What the words about code need: the dates, the document for the labels, and the admin's language. */
export interface CmsModelCodeCtx extends CmsModelDateCtx {
  doc: ModelDoc
  /** A stored label in the admin's language, '' when it has none. */
  read: (label: ModelLabel | null | undefined) => string
  locale: string
}

/** A type's name without the prefix every custom type has, for a type the document no longer knows. */
const bareName = (name: string): string => name.replace(/^custom_/, '')

/** A filter parameter of a date (`starts.from`) is about its field (`starts`). */
const fieldOfKey = (key: string): string => key.replace(/\.(from|to)$/, '')

/** "Courses › Teacher": the labels of a misfit's type and field, the key only when the label is not known. */
export function cmsModelMisfitName(m: Pick<CmsModelMisfit, 'type' | 'field'>, ctx: Pick<CmsModelCodeCtx, 'doc' | 'read'>): string {
  const type = ctx.doc.types.find((x) => x.name === m.type)
  const typeName = (type && ctx.read(type.label)) || bareName(m.type)
  if (!m.field) return typeName
  const key = fieldOfKey(m.field)
  const field = type?.fields.find((f) => f.key === key)
  return `${typeName} › ${(field && ctx.read(field.label)) || key}`
}

/** The things code reads that are missing, as one list in the admin's language: each once, at most four, then "3 more". */
export function cmsModelMisfitList(breaks: readonly CmsModelMisfit[], ctx: Pick<CmsModelCodeCtx, 'doc' | 'read' | 't' | 'locale'>): string {
  const phrases = [...new Set(breaks.map((m) => {
    const thing = ctx.t('model.code.quoted', { text: cmsModelMisfitName(m, ctx) })
    return m.why === 'may-be-empty' ? ctx.t('model.code.alwaysFilled', { thing }) : thing
  }))]
  const shown = phrases.length > 5 ? [...phrases.slice(0, 4), ctx.t('model.code.more', { count: phrases.length - 4 })] : phrases
  return cmsModelListText(shown, ctx.locale)
}

/** "A, B and C" in the admin's language. */
export function cmsModelListText(items: readonly string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items)
  }
  catch {
    return items.join(', ')
  }
}

/** The thing one operation is about: a field it removes or changes, or a type it removes. */
function subjectOf(ops: readonly ModelOp[]): { type: string; field?: string } | null {
  if (ops.length !== 1) return null
  const op = ops[0]!
  if (op.op === 'type.remove') return { type: op.type }
  if (op.op === 'field.remove' || op.op === 'field.update') return { type: op.type, field: op.key }
  return null
}

/**
 * A change refused because code reads what it takes away (409 `breaks-code`), in the admin's words:
 * what the code reads ("this field" when the change was about that field alone, else the labels),
 * under which name and since when it is registered, and that its developer acts first.
 * `ops` are the operations that were sent.
 */
export function cmsModelCodeRefusalText(registrations: readonly CmsModelCodeBreak[], ctx: CmsModelCodeCtx, ops: readonly ModelOp[] = []): string {
  const { t } = ctx
  const breaks = registrations.flatMap((r) => r.breaks ?? [])
  if (!registrations.length || !breaks.length) return t('model.code.refusal.short')

  const subject = subjectOf(ops)
  const onSubject = (m: CmsModelMisfit) => !!subject && m.type === subject.type && (!subject.field || (!!m.field && fieldOfKey(m.field) === subject.field))
  let what: string
  if (subject && breaks.every(onSubject)) {
    if (!subject.field) what = t('model.code.refusal.type')
    else what = breaks.every((m) => m.why === 'may-be-empty') ? t('model.code.refusal.fieldFilled') : t('model.code.refusal.field')
  }
  else what = t('model.code.refusal.named', { list: cmsModelMisfitList(breaks, ctx) })

  const since = (r: CmsModelCodeBreak) => cmsModelDayText(r.registeredAt, ctx)
  const who = registrations.length === 1
    ? t('model.code.refusal.registeredOne', { name: registrations[0]!.name, date: since(registrations[0]!) })
    : t('model.code.refusal.registeredMany', { list: cmsModelListText(registrations.map((r) => t('model.code.refusal.registeredItem', { name: r.name, date: since(r) })), ctx.locale) })
  return [what, who, t('model.code.refusal.developer')].join(' ')
}

/** What a row of the list of registered code says: who and when, how many types, and what the site lacks. */
export interface CmsModelCodeRowText {
  /** "The website itself · registered 25 November · reads 2 types" */
  meta: string
  /** What the code expects and the site no longer has, or ''. */
  lacks: string
  /** The stored file is of a newer version: what it reads is not known here. */
  unreadable: boolean
}

export function cmsModelCodeRow(reg: CmsModelCodeRegistration, ctx: CmsModelCodeCtx): CmsModelCodeRowText {
  const { t } = ctx
  const who = reg.source === 'app' ? t('model.code.byWebsite') : (reg.by?.name?.trim() ?? '')
  const parts = [who, t('model.code.registeredOn', { date: cmsModelDayText(reg.updatedAt, ctx) })]
  if (typeof reg.types === 'number') parts.push(t('model.code.readsTypes', { count: reg.types }))
  const meta = parts.filter(Boolean).join(' · ')
  const unreadable = reg.types === null || reg.breaks === null
  return {
    meta: meta.charAt(0).toLocaleUpperCase(ctx.locale) + meta.slice(1),
    lacks: !unreadable && reg.breaks!.length ? t('model.code.lacks', { list: cmsModelMisfitList(reg.breaks!, ctx) }) : '',
    unreadable,
  }
}
