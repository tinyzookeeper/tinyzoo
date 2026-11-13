/**
 * A content change, as the CMS reports it: to the other replicas, to the realtime
 * hub, to the `cms:change` Nitro hook and (when public) to publish webhooks.
 */
export type CmsChangeType =
  | 'entry.created' | 'entry.updated' | 'entry.deleted' | 'entry.published' | 'entry.unpublished'
  | 'translation.updated' | 'translation.deleted' | 'global.updated'

export interface CmsChange {
  type: CmsChangeType
  entity: string
  id: string
  /** The language a translation change is about; null for the entry itself. */
  locale: string | null
  /** Whether the change can be seen on the public website (live content of a public collection). */
  public: boolean
  /** Website addresses the change touches (from `content.path`), old and new. */
  paths: string[]
  /** Who made it (user id), when known. */
  by: string | null
  /** The entry's version after the change (its updatedAt, ISO), null when deleted. */
  version: string | null
  /** ISO timestamp. */
  at: string
}
