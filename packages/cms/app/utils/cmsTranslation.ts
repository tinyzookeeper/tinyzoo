import { isEmptyRichText } from './cmsJson'

/**
 * When what the editor shows was last saved, for the bar's "Saved 2 minutes ago".
 *
 * A translation is saved apart from the entry: its own row has its own time (`__version`), while `updatedAt`
 * on the row the server sends is the entry's, the default language's. Taking that one made a translation
 * "saved" when someone last touched the original, a moment ago or weeks ago, and a translation nobody has
 * saved yet "saved" too. A translation that was never saved has no time at all (`null`: the bar says nothing).
 */
export function cmsSavedAt(row: Record<string, any> | null | undefined, translation: boolean): string | null {
  const at = translation ? row?.__version : row?.updatedAt
  return typeof at === 'string' && at ? at : null
}

/** A field value that says nothing: no text, no list items, no blocks, a rich text of empty paragraphs, a group of blanks. */
export function cmsBlank(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') {
    if ((value as any).type === 'doc') return isEmptyRichText(value)
    return Object.values(value as Record<string, unknown>).every(cmsBlank)
  }
  return false
}
