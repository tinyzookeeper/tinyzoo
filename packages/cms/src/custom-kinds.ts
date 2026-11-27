// The kinds a field of a site's own content type has for the blocks that show it (a card's heading,
// text, picture, button): one table, which the server, the admin and a website's code all read.
// Pure, with no imports, so the admin and a website's own code can take it as it is.

/**
 * Experimental: may change in a minor release.
 *
 * What a field of a content type the site made for itself is, as a block that shows it sees it:
 * `text` a short text (the title too), `longText` a text of several lines, `richText` a formatted
 * text, `number`, `date`, `choice`, `yesNo`, `picture`, `gallery`, `file`, `link` (a text with the form
 * of an address or a link), `email`, `color`, `relation` (another entry), and `page`, the entry's own
 * page (`slug`, when the type has pages).
 */
export type CustomFieldKind =
  | 'text' | 'longText' | 'richText' | 'number' | 'date' | 'choice' | 'yesNo'
  | 'picture' | 'gallery' | 'file' | 'link' | 'email' | 'color' | 'relation' | 'page'

/** Experimental: may change in a minor release. Every kind, in the order a person reads them. */
export const CUSTOM_FIELD_KINDS: readonly CustomFieldKind[] = [
  'text', 'longText', 'richText', 'number', 'date', 'choice', 'yesNo',
  'picture', 'gallery', 'file', 'link', 'email', 'color', 'relation', 'page',
]

/**
 * Experimental: may change in a minor release.
 *
 * The key a reference names for the entry's own page. It is a field of every type that has pages,
 * of the kind `page`.
 */
export const CUSTOM_PAGE_FIELD = 'slug'

/**
 * The part of a field the kind is read from: a field of the site's model, or one field of a type as
 * `GET /api/content/_types` gives it (the same names).
 */
export interface CustomFieldShape {
  type: string
  long?: boolean | null
  format?: string | null
}

/**
 * Experimental: may change in a minor release.
 *
 * The kind of a field of a site's own type, or null for a field of a kind this tinyzoo does not know.
 * A text with the form of an address or a link is a `link`, with the form of an e-mail an `email`; a
 * text of several lines is a `longText`.
 */
export function customFieldKind(field: CustomFieldShape): CustomFieldKind | null {
  switch (field?.type) {
    case 'text':
      if (field.format === 'email') return 'email'
      if (field.format === 'url' || field.format === 'link') return 'link'
      return field.long ? 'longText' : 'text'
    case 'richtext': return 'richText'
    case 'number': return 'number'
    case 'datetime': return 'date'
    case 'select': return 'choice'
    case 'boolean': return 'yesNo'
    case 'media': return 'picture'
    case 'gallery': return 'gallery'
    case 'file': return 'file'
    case 'color': return 'color'
    case 'relation': return 'relation'
    default: return null
  }
}

/** Whether a value is one of the kinds. @internal */
export const isCustomFieldKind = (value: unknown): value is CustomFieldKind => typeof value === 'string' && (CUSTOM_FIELD_KINDS as readonly string[]).includes(value)
