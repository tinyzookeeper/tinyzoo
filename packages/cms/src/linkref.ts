/**
 * The stored form of a link that follows its target: `cms:<entity>/<id>`. Kept apart
 * (no imports) so the rich-text sanitiser and the link walker can both use it.
 */

const PREFIX = 'cms:'
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const REF = new RegExp(`^cms:([A-Za-z][A-Za-z0-9_-]{0,63})/(${UUID})$`)

/** @internal */
export interface LinkRef { entity: string; id: string }

/**
 * The stored form of a link to an entry: `cms:post/2f6c…` (the id in lower case).
 *
 * @internal
 */
export function linkRef(entity: string, id: string): string {
  return `${PREFIX}${entity}/${id.toLowerCase()}`
}

/**
 * The entity and id a stored link refers to; null when it is not a well-formed reference.
 *
 * @internal
 */
export function parseLinkRef(value: unknown): LinkRef | null {
  if (typeof value !== 'string') return null
  const m = REF.exec(value)
  return m ? { entity: m[1]!, id: m[2]!.toLowerCase() } : null
}

/**
 * Is this a well-formed reference to an entry (`cms:<entity>/<id>`)?
 *
 * @internal
 */
export const isLinkRef = (value: unknown): boolean => parseLinkRef(value) !== null

/**
 * Does this look like a reference, well-formed or not? Anything that starts with `cms:`
 * is an internal value: it is resolved or dropped on read, never served as it is.
 *
 * @internal
 */
export const looksLikeLinkRef = (value: unknown): boolean => typeof value === 'string' && value.slice(0, PREFIX.length).toLowerCase() === PREFIX
