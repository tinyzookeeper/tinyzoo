import { z } from 'zod'
import { FIELD_KEY, TYPE_NAME } from './model-doc'

// The value of a field of the kind `binding`: which custom type a block shows and which
// of its fields go where. It lives apart from `custom-blocks.ts` because `fields.ts`
// needs the schema and `custom-blocks.ts` needs `fields.ts`.

/**
 * Which custom type a block shows, and which field goes to which place. A card's binding
 * (`customTypeCard()`) holds the type, the order and the limit only: the card's own blocks say
 * which field each shows.
 */
export interface CmsBinding {
  /** The name of the custom type. */
  type: string
  /** The fields that go to the places of a card. */
  show?: { image?: string | null; text?: string | null; date?: string | null; label?: string | null; more?: string[] }
  /** A list only: the field to order by. Null or left out is the type's own order. */
  order?: { by: string; dir: 'asc' | 'desc' } | null
  /** A list only: how many entries, 1 to 48. Left out is 6. */
  limit?: number | null
  /** Chosen entries only: their ids, in the picked order. */
  entries?: string[]
}

/** How many entries a list shows when no limit is given. @internal */
export const BINDING_LIMIT_DEFAULT = 6
/** The most entries a list may show. @internal */
export const BINDING_LIMIT_MAX = 48
/** The most entries a block of chosen entries may hold. @internal */
export const BINDING_ENTRIES_MAX = 12
/** The most extra fields a card may show. @internal */
export const BINDING_MORE_MAX = 6
/** The longest type name or field key a binding may hold. @internal */
export const BINDING_NAME_MAX = 64

/**
 * The shape of a binding: strings, lengths, ids. Whether the type and its fields exist is
 * not checked here (a block's definition is shared by every site of a design; the model is
 * each site's own). Built on first use: `model-doc.ts` and `fields.ts` import each other.
 *
 * @internal
 */
export const bindingSchema = z.lazy(() => {
  const key = z.string().max(BINDING_NAME_MAX).regex(FIELD_KEY, 'Not a field key')
  const place = key.nullish()
  return z.strictObject({
    type: z.string().max(BINDING_NAME_MAX).regex(TYPE_NAME, 'Not the name of a custom type'),
    show: z.strictObject({ image: place, text: place, date: place, label: place, more: z.array(key).max(BINDING_MORE_MAX).optional() }).optional(),
    order: z.strictObject({ by: key, dir: z.enum(['asc', 'desc']) }).nullish(),
    limit: z.number().int().min(1).max(BINDING_LIMIT_MAX).nullish(),
    entries: z.array(z.uuid()).max(BINDING_ENTRIES_MAX).optional(),
  })
})

/**
 * The shape of a card's binding: the type, the order and how many. No places and no picked
 * entries: the card's blocks name their fields themselves.
 *
 * @internal
 */
export const cardBindingSchema = z.lazy(() => {
  const key = z.string().max(BINDING_NAME_MAX).regex(FIELD_KEY, 'Not a field key')
  return z.strictObject({
    type: z.string().max(BINDING_NAME_MAX).regex(TYPE_NAME, 'Not the name of a custom type'),
    order: z.strictObject({ by: key, dir: z.enum(['asc', 'desc']) }).nullish(),
    limit: z.number().int().min(1).max(BINDING_LIMIT_MAX).nullish(),
  })
})

/**
 * The shape of a reference to a field of the type a card shows: a field key, or an empty text
 * for none. Whether the type has the field, and whether its kind fits, is each site's own and is
 * checked by the server.
 *
 * @internal
 */
export const fieldRefSchema = z.lazy(() => z.string().trim().max(BINDING_NAME_MAX).refine((v) => v === '' || FIELD_KEY.test(v), 'Not a field key'))
