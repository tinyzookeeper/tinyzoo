/**
 * What `GET /api/health/status` answers: a summary of one site for a tool that watches
 * many of them (versions, whether it is healthy, how much it is used). Only numbers,
 * dates, versions and names from the config: never content, never anyone's name or
 * email. The route is off until `cms.status.token` (NUXT_CMS_STATUS_TOKEN) is set, and
 * asks for that token.
 *
 * `format` and `version` say how to read the rest. Within `version: 1` keys are only
 * added (ignore the ones you do not know); a change that breaks readers is `version: 2`.
 */
export interface CmsStatus {
  format: 'tinyzoo-status'
  version: 1
  /** When this answer was made (ISO 8601). */
  at: string
  /** The tinyzoo version the site runs. */
  tinyzoo: string
  /** The Node.js version (`process.version`), or null on a runtime without one. */
  node: string | null
  /** The instance that answered: a site with several replicas has one of these per replica. */
  instance: {
    /** When it started (ISO 8601). */
    startedAt: string
  }
  site: {
    /** `cms.publicUrl`, or null when it is not set. */
    publicUrl: string | null
    /** Where the admin is, relative to the site (`/admin`). */
    admin: string
    /** `builtin` (tinyzoo's own sign-in) or `external` (the host signs people in). */
    auth: 'builtin' | 'external'
    /** The content languages, the default first; null for a site in one language. */
    locales: string[] | null
  }
  database: {
    /** The database answered. When it did not, the counts below are empty. */
    ok: boolean
    /** Start-up migrations: `idle` (not run at start), `running`, `done` or `failed`. */
    migrations: 'idle' | 'running' | 'done' | 'failed'
    /** The database's size on disk, or null when it could not be read. */
    bytes: number | null
  }
  content: {
    /** Every collection and global of the config (plugins' included), in config order. */
    collections: CmsStatusCollection[]
    /** The last time anything was saved (ISO 8601), or null for an empty site. */
    lastEditAt: string | null
    /** Entries waiting for a translation, over all languages (0 for a site in one language). */
    untranslated: number
  }
  /** Accounts of the built-in sign-in (all 0 with `auth: 'external'`). */
  people: {
    active: number
    /** Invited, not signed in yet. */
    invited: number
    disabled: number
    /** Accounts that signed in during the last 30 days. */
    signedInLast30Days: number
    /** The last sign-in of anyone (ISO 8601), or null. */
    lastSignInAt: string | null
  }
  media: {
    files: number
    bytes: number
  }
  webhooks: {
    /** How many publish webhook addresses are set. */
    urls: number
    /** Whether a secret signs them (in production none are sent without one). */
    signed: boolean
  }
  /**
   * Server errors this instance reported (the `cms:error` hook) in the last 24 hours, by
   * where they happened. Counted in memory: a restart starts again from 0.
   */
  errors: {
    last24h: { request: number; task: number; webhook: number }
    /** The newest of them (ISO 8601), or null. */
    lastAt: string | null
  }
  /** The site's plugins (`defineCmsPlugin`) and their versions. */
  plugins: { name: string; version: string }[]
  /**
   * Website analytics (the `tinyzoo/analytics` plugin), when the site uses it; absent
   * otherwise (and from a tinyzoo that predates this key).
   */
  analytics?: CmsStatusAnalytics
}

export interface CmsStatusAnalytics {
  /** The server may count visits: `NUXT_CMS_ANALYTICS_ENABLED` is not `false`. */
  enabled: boolean
  /** It counts them now: enabled, and an administrator has not switched counting off. */
  collecting: boolean
  /** The first day with totals (YYYY-MM-DD, in the site's time zone), or null before the first night. */
  since: string | null
  /**
   * Where the daily totals are read with the same token, relative to the site
   * (`/api/content/_analytics/rollups`). See `AnalyticsRollups` in `tinyzoo/analytics`.
   */
  rollupsPath: string
}

export interface CmsStatusCollection {
  name: string
  /** `collection` or `global`. */
  kind: 'collection' | 'global'
  /** How many entries it holds (a global: 1 once it was saved, else 0). */
  count: number
  /** When an entry was last saved (ISO 8601), or null. */
  lastEditAt: string | null
}
