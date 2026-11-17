import type { FieldUi, RelationKind } from './descriptor'

// The admin's extension points: what a site's own field renderer receives. A renderer is a
// global Vue component registered by name in `app.config.ts` (`cms.fields[type].edit` /
// `.cell`, see `CmsFieldRenderer`); `CmsField` and `CmsCell` resolve it and pass it the props
// below. These types describe them for a component's `defineProps`:
//
//   const props = defineProps<CmsFieldEditProps>()
//   const model = defineModel<string | null>()

/**
 * One field as the admin graph describes it (`/api/cms/_graph`): what a renderer reads to
 * know how to show it. Fields inside a block, a list item or a group carry no `localized`,
 * `default` or `relation`.
 */
export interface CmsAdminField {
  /** The field's key in the entity (the key of the API). */
  key: string
  /** The field type: `text`, `slug`, `number`, `boolean`, `datetime`, `select`, `richtext`, `blocks`, `group`, `media`, `gallery`, `relation`. */
  type: string
  optional: boolean
  required: boolean
  unique: boolean
  localized?: boolean
  /** What a new entry starts with (select defaults, switches), null when none. */
  default?: unknown
  /** The renderer components the descriptor asks for by default (`CmsFieldText`, `CmsCellText`…). */
  ui: FieldUi
  /** Options of the field: `accept`, `options`, `labels`, `format`, `max`, `blocks`, `fields`… (see the field's factory). */
  meta: Record<string, unknown>
  /** A relation field: the entity it points at and how. */
  relation?: { to: string; kind: RelationKind; required: boolean }
}

/**
 * The props of a field editor (`cms.fields[type].edit`): `v-model` carries the value
 * (`defineModel`); `id` is the DOM id the control should take, so the label and the error
 * message find it. The component also gets `aria-labelledby` as an attribute for fields
 * that have no single control.
 */
export interface CmsFieldEditProps {
  field: CmsAdminField
  /** The entity the form is for. */
  entity: string
  id?: string
}

/** The props of a list cell (`cms.fields[type].cell`): the field and the row the list shows. */
export interface CmsFieldCellProps {
  field: CmsAdminField
  /** The row as the list loaded it (relations populated with their title). */
  row: Record<string, unknown>
  entity: string
}
