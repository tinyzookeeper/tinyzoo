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
    /**
     * Its memory now, and the most it may use: what tells a watching tool that a site runs close
     * to the limit its host kills it at. Absent from a tinyzoo before 1.10.
     */
    memory?: CmsStatusMemory
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
    /**
     * The pictures' smaller copies (made after each upload, in the background): how many
     * pictures have all of theirs, how many still wait (just uploaded, or from before copies
     * were made that way), and how many could not be resized (their original is shown).
     * Absent from a tinyzoo before 1.10, and while the site's migration that adds
     * `cms_media_sizes` is not applied.
     */
    sizes?: { done: number; waiting: number; failed: number }
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
  /**
   * The client's brand as the admin shows it (`cms.admin` in the site's app.config), so a
   * watching tool can show the site with its own logo. Nothing here is more than the
   * sign-in page shows. Absent from a tinyzoo before 1.9.
   */
  brand?: CmsStatusBrand
}

/** Memory of the instance that answered, in bytes. */
export interface CmsStatusMemory {
  /** What the process holds now (resident set size). */
  rss: number
  /**
   * The most the container may use (cgroup `memory.max`), or null when there is no limit
   * or it cannot be read (not in a container, another OS).
   */
  limit: number | null
  /** The most the container has used since it started (cgroup `memory.peak`), or null when it cannot be read. */
  peak: number | null
}

/**
 * The client's name, colour and logos. Logo addresses are as the site gave them: a path on the
 * site (`/brand/mark.svg`, from the site's address) or an `https://` URL; `null` when not set.
 */
export interface CmsStatusBrand {
  /** The client's name in the admin's language (`cms.admin.name`); `tinyzoo` when not set. */
  name: string
  /** The brand colour (`cms.admin.accent` as `#rrggbb`), or null for one of tinyzoo's own accents. */
  accent: string | null
  /** The full logo (wide, with the name). */
  full: string | null
  /** The full logo for dark backgrounds; null when the site has none of its own. */
  fullDark: string | null
  /** The square mark. */
  mark: string | null
  /** The mark for dark backgrounds; null when the site has none of its own. */
  markDark: string | null
  /**
   * A 180 px square PNG of the mark that tinyzoo draws (the admin's home-screen icon), relative to
   * the site (`/api/cms/_brand/mark-180.png?v=…`): one picture that is always a PNG, whatever the
   * mark's own format. Null without a mark, or when the server could not read it.
   */
  icon: string | null
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
  /**
   * Where today's visits so far are read with the same token (`/api/content/_analytics/live`).
   * See `AnalyticsLive` in `tinyzoo/analytics`. A tinyzoo before 1.6 has no such key.
   */
  livePath: string
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
