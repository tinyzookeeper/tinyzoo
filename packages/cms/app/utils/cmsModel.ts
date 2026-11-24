// The structure editor's shared logic (/admin/_model): what the list and the dialogs read from
// the document, the operations a form turns into, and a refusal in a person's words. Pure, so it
// is tested without a browser. Names and limits come from tinyzoo's own rules (`model-doc.ts`),
// never copied here.
import {
  modelTypeName, modelFieldKey, modelPagePrefix, MODEL_PURGE_AFTER_MS, MODEL_PURGE_EMPTY_AFTER_MS,
  type ModelDoc, type ModelType, type ModelField, type ModelOp, type ModelLabel,
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
  fields: { key: string; type: string; label: ModelLabel | string | null }[]
}

/** A change that did not work, said for a person. */
export interface CmsModelProblemInfo {
  kind: 'stale' | 'busy' | 'in-use' | 'refused' | 'other'
  code: string
  text: string
  /** The form field it is about, or null when the dialog says it. */
  at: 'label' | 'help' | 'key' | 'prefix' | 'options' | 'required' | 'to' | 'icon' | null
  places?: { entity: string; id: string; title: string; field: string | null; block: string | null; locale: string | null; admin: string }[]
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
/** The types that are hidden and wait for their deletion. */
export const cmsModelHiddenTypes = (doc: ModelDoc): ModelType[] => doc.types.filter((t) => !!t.removedAt)
/** The fields of a type a person sees, in the form's order. */
export const cmsModelFields = (type: ModelType): ModelField[] => type.fields.filter((f) => !f.removedAt)
/** The fields of a type that are hidden. */
export const cmsModelHiddenFields = (type: ModelType): ModelField[] => type.fields.filter((f) => !!f.removedAt)

/** When a hidden thing is deleted for good, or null when it is not hidden. */
export function cmsModelPurgeAt(item: { removedAt?: string | null; removedEmpty?: boolean }): Date | null {
  if (!item.removedAt) return null
  const at = Date.parse(item.removedAt)
  if (Number.isNaN(at)) return null
  return new Date(at + (item.removedEmpty === true ? MODEL_PURGE_EMPTY_AFTER_MS : MODEL_PURGE_AFTER_MS))
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
  'invalid-request': 'generic', 'internal-only': 'generic', 'not-due': 'generic', 'too-large': 'generic',
}
const KNOWN = new Set([
  'limit-types', 'limit-fields', 'limit-options', 'limit-label', 'limit-help', 'limit-size', 'invalid-label', 'invalid-name', 'reserved-key',
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
