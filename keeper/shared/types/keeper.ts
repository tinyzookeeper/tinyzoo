import type { CmsStatus } from './status'
import type { TrafficGlance } from './traffic'

export type { CmsStatus }

/**
 * owner: everything, and the only one who makes or removes owners. admin: the team, clients
 * and settings. member: works on the sites they see. viewer: only looks (a client's people).
 */
export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer'

/** up: the last checks answered; down: several in a row did not; unknown: not checked yet. */
export type SiteState = 'up' | 'down' | 'unknown'

/** One row of the overview. */
export interface SiteSummary {
  id: string
  name: string
  /** The client's name, '' without one. */
  client: string
  clientId: string | null
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
  /** Visits of the last 30 days, for a site that counts them; null before the first read. */
  traffic: TrafficGlance | null
  /** Why its visits could not be read last time (a site that counts them), or null. */
  trafficError: string | null
}

export interface OverviewResponse {
  sites: SiteSummary[]
  /** The newest tinyzoo release (npm), or the newest version in the fleet when npm is out of reach. */
  latest: string | null
  /** The clients this person sees, by name (for the filter and the site form). */
  clients: { id: string; name: string }[]
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
  /** The client's name: an existing one, a new one, or '' for none. */
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
  role: MemberRole
  /** Sees every client's sites (always true for owners and admins). */
  allClients: boolean
  /** The clients they see when not all of them. */
  clientIds: string[]
  lastLoginAt: string | null
}

/** What adding or changing a person sends. */
export interface MemberAccessInput {
  role: MemberRole
  allClients: boolean
  clientIds: string[]
}

/** GET /api/clients: the clients this person sees. */
export interface ClientList {
  clients: Client[]
  /** Whether they may name a new client, or leave a site without one (people who see every client). */
  canCreate: boolean
}

/** A client in Settings. */
export interface Client {
  id: string
  name: string
  /** Also told about this client's sites going down, coming back, or certificates running out. */
  alertEmails: string[]
  sites: number
}

export interface WorkspaceSettings {
  name: string
  /** Who gets the e-mails when a site goes down or comes back; empty = every member. */
  alertEmails: string[]
}

/** An access token in the list (never the token itself). */
export interface AccessToken {
  id: string
  name: string
  /** read: looks only; write: may also add, change, check and remove sites. */
  scope: 'read' | 'write'
  /** The start of the token, to tell it apart: kpr_ab12cd. */
  prefix: string
  /** manual: made in Settings; oauth: a program that signed in (its token changes every hour). */
  origin: 'manual' | 'oauth'
  /** The program that signed in (oauth only). */
  client: string | null
  createdAt: string
  lastUsedAt: string | null
  /** Who made it (the token acts as them). */
  createdBy: string | null
  /** Whether the person looking may revoke it: their own, or any for an owner. */
  canRevoke: boolean
}

/** A token just made: the only time its value is shown. */
export interface NewAccessToken {
  token: AccessToken
  value: string
}
