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
  /**
   * Website addresses the change touches (from `content.path`), old and new — and, when
   * the entry's address changed or it stopped being reachable, the addresses of the
   * entries that link to it (their links read differently now).
   */
  paths: string[]
  /**
   * Public globals (menus, site settings) that link to this entry and read differently
   * now, when its address changed or it stopped being reachable. Left out when none.
   * Whatever shows them (a menu: every page) is stale.
   */
  globals?: string[]
  /** Who made it (user id), when known. */
  by: string | null
  /** The entry's version after the change (its updatedAt, ISO), null when deleted. */
  version: string | null
  /** ISO timestamp. */
  at: string
}
