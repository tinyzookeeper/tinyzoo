import { CUSTOM_PAGE_FIELD, customFieldKind, type CustomFieldKind } from '../../src/custom-kinds'
import type { CmsBindingField, CmsBindingType } from './cmsBinding'

// The pure logic behind the control of a small block's reference to a field of the entry a card shows
// (`CmsFieldRef.vue`): what kind each field of the site's own type is, which fields a block can take,
// and what a stored reference says about itself (set, gone from the type, not fitting the block).

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)

/** The icon of each kind: the content type editor's own, and one each for the three it has no field for. */
export const CMS_REF_KIND_ICONS: Record<CustomFieldKind, string> = {
  text: 'i-lucide-type',
  longText: 'i-lucide-align-left',
  richText: 'i-lucide-text',
  number: 'i-lucide-hash',
  yesNo: 'i-lucide-toggle-right',
  date: 'i-lucide-calendar',
  choice: 'i-lucide-list-checks',
  picture: 'i-lucide-image',
  file: 'i-lucide-paperclip',
  gallery: 'i-lucide-images',
  color: 'i-lucide-palette',
  relation: 'i-lucide-link-2',
  link: 'i-lucide-link',
  email: 'i-lucide-mail',
  page: 'i-lucide-square-arrow-out-up-right',
}

/**
 * The kind of a field as the admin graph lists it, or null for one a block cannot show (the status, the
 * position, a field of a kind this admin does not know). The graph says a colour as a text with the format
 * `color`, a file as a picture with `file` set, the entry's page as the slug.
 */
export function cmsGraphFieldKind(f: CmsBindingField): CustomFieldKind | null {
  if (!f || typeof f.key !== 'string') return null
  const meta = f.meta ?? {}
  const format = typeof meta.format === 'string' && meta.format !== 'plain' ? meta.format : null
  if (f.key === 'status' || f.key === 'position') return null
  if (f.type === 'slug') return f.key === CUSTOM_PAGE_FIELD ? 'page' : null
  if (f.type === 'text' && format === 'color') return customFieldKind({ type: 'color' })
  if (f.type === 'media') return customFieldKind({ type: meta.file ? 'file' : 'media' })
  if (f.type === 'text') return customFieldKind({ type: 'text', long: !!meta.multiline, format })
  if (f.relation) return customFieldKind({ type: 'relation' })
  return customFieldKind({ type: f.type })
}

/** One field a reference may name. */
export interface CmsRefField { key: string; label: string | object; kind: CustomFieldKind }

/** Every field of the type a reference may name, in the type's order: its own fields with a kind, and the page (`slug`) when it has one. */
export function cmsRefFields(type: CmsBindingType): CmsRefField[] {
  const out: CmsRefField[] = []
  for (const f of Array.isArray(type?.fields) ? type.fields : []) {
    const kind = cmsGraphFieldKind(f)
    if (kind) out.push({ key: f.key, label: f.label ?? f.key, kind })
  }
  return out
}

/** The fields of a type a block that takes these kinds can show. */
export function cmsRefFitting(type: CmsBindingType, takes: readonly CustomFieldKind[]): CmsRefField[] {
  return cmsRefFields(type).filter((f) => takes.includes(f.kind))
}

/** What a stored reference says about itself, against the type its card shows. */
export type CmsRefState =
  | { state: 'empty' }
  | { state: 'ok'; field: CmsRefField }
  | { state: 'gone'; key: string }
  | { state: 'unfit'; field: CmsRefField }
  | { state: 'noType'; key?: string }

/** Empty (not a non-empty text), fine, gone from the type, not a kind the block takes, or no type to tell by (the key stays). */
export function cmsRefState(value: unknown, type: CmsBindingType | undefined, takes: readonly CustomFieldKind[]): CmsRefState {
  if (typeof value !== 'string' || !value) return { state: 'empty' }
  if (!type) return { state: 'noType', key: value }
  const field = cmsRefFields(type).find((f) => f.key === value)
  if (!field) return { state: 'gone', key: value }
  return takes.includes(field.kind) ? { state: 'ok', field } : { state: 'unfit', field }
}

/**
 * The value of the card binding of a top-level block (its def's field of that kind): null while the block
 * has none yet, undefined when the def shows no card.
 */
export function cmsCardBindingOf(block: unknown, def: { fields?: any[] } | undefined): unknown | undefined {
  const field = (Array.isArray(def?.fields) ? def!.fields : []).find((f) => f?.type === 'binding' && f.meta?.binding === 'card')
  if (!field || !isObject(block)) return undefined
  return block[field.key] ?? null
}
