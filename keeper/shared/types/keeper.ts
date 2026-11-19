import type { CmsStatus } from './status'

export type { CmsStatus }

/** up: the last checks answered; down: several in a row did not; unknown: not checked yet. */
export type SiteState = 'up' | 'down' | 'unknown'

/** One row of the overview. */
export interface SiteSummary {
  id: string
  name: string
  client: string
  url: string
  environment: 'production' | 'staging'
  state: SiteState
  stateSince: string | null
  lastCheckAt: string | null
  responseMs: number | null
  /** Share of successful checks, 0–1, or null without checks. */
  uptime24h: number | null
  uptime30d: number | null
  /** The site's tinyzoo version from its status, or null without a status. */
  version: string | null
  /** Whether `version` is older than the newest tinyzoo release. */
  outdated: boolean
  /** Where the admin is (absolute). */
  adminUrl: string
  lastEditAt: string | null
  lastSignInAt: string | null
  /** Server errors the site reported in the last 24 hours. */
  errors24h: number
  certExpiresAt: string | null
  /** The status could not be read: why. Null when it was read or no token is set. */
  statusError: string | null
  hasToken: boolean
}

export interface OverviewResponse {
  sites: SiteSummary[]
  /** The newest tinyzoo release (npm), or the newest version in the fleet when npm is out of reach. */
  latest: string | null
}

export interface CheckPoint {
  at: string
  ok: boolean
  ms: number | null
}

export interface Incident {
  id: string
  startedAt: string
  endedAt: string | null
  cause: string
}

export interface SiteDetail extends SiteSummary {
  repoUrl: string
  notes: string
  statusAt: string | null
  status: CmsStatus | null
  certError: string | null
  /** The last 24 hours of checks, oldest first. */
  checks: CheckPoint[]
  incidents: Incident[]
  latest: string | null
}

/** What the add and edit forms send. `token` left out keeps the stored one; '' removes it. */
export interface SiteInput {
  name: string
  client?: string
  url: string
  environment?: 'production' | 'staging'
  token?: string
  repoUrl?: string
  notes?: string
}

export interface ConnectionTest {
  reachable: boolean
  responseMs: number | null
  /** What /api/health/ready said, or the error. */
  ready: string
  /** Status read with the token: its version, or the error. */
  status: { ok: true; version: string } | { ok: false; error: string } | null
}

export interface Member {
  id: string
  name: string
  email: string
  role: 'owner' | 'member'
  lastLoginAt: string | null
}

export interface WorkspaceSettings {
  name: string
  /** Who gets the e-mails when a site goes down or comes back; empty = every member. */
  alertEmails: string[]
}
