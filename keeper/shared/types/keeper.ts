import type { CmsStatus } from './status'
import type { TrafficGlance } from './traffic'

export type { CmsStatus }

/**
 * A person's role in a workspace. owner: everything, the only one who makes or removes owners.
 * admin: the workspace, its teams and people, every site. member: works on the sites of their
 * teams. guest: a client's person, only looks at the sites of their teams.
 */
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest'

/** Where a site lives. */
export interface SiteScope {
  workspace: { id: string; slug: string; name: string }
  team: { id: string; slug: string; name: string }
}

/** up: the last checks answered; down: several in a row did not; unknown: not checked yet. */
export type SiteState = 'up' | 'down' | 'unknown'

/** One row of the overview. */
export interface SiteSummary extends SiteScope {
  id: string
  name: string
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
  /** The team (its workspace follows). On a new site without it: the default team of `workspace`. */
  teamId?: string
  workspace?: string
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
  role: WorkspaceRole
  /** The teams of this workspace they are on, and those they lead. */
  teamIds: string[]
  leadTeamIds: string[]
  lastLoginAt: string | null
}

/** A team in Settings → Teams. */
export interface Team {
  id: string
  name: string
  slug: string
  isDefault: boolean
  sites: number
  people: { userId: string; name: string; email: string; role: 'lead' | 'member' }[]
  /** Whether I may rename it and change who is on it (an owner, an admin or its lead). */
  canManage: boolean
}

/** A workspace's settings (General and Alerts). */
export interface WorkspaceSettings {
  id: string
  slug: string
  name: string
  /** Who gets the e-mails when a site goes down or comes back; empty = everyone who works on it. Only owners and admins see it. */
  alertEmails: string[]
  role: WorkspaceRole
  /** Whether it can be deleted now: it has no sites (and I am an owner). */
  canDelete: boolean
}

/** Health in a few numbers, for a switcher's dot. */
export interface Health {
  sites: number
  down: number
  /** Sites on an older tinyzoo than the newest release. */
  behind: number
}

export interface MeTeam extends Health {
  id: string
  slug: string
  name: string
  isDefault: boolean
  /** I lead this team. */
  lead: boolean
}

export interface MeWorkspace extends Health {
  id: string
  slug: string
  name: string
  role: WorkspaceRole
  /** The teams I see, the default first. */
  teams: MeTeam[]
}

/** GET /api/me: who I am and every workspace I am in (the switchers). */
export interface MeResponse {
  user: { id: string; name: string; email: string }
  workspaces: MeWorkspace[]
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
}

/** A token just made: the only time its value is shown. */
export interface NewAccessToken {
  token: AccessToken
  value: string
}

/** Settings → About: the newest tinyzoo release Keeper knows, and when npm last told it (null before the first read). */
export interface KeeperAbout {
  tinyzoo: { version: string; checkedAt: string } | null
}

/** How Keeper sends e-mail (Settings shows it; never the password). */
export interface MailStatus {
  /** smtp: sends; log: only prints each e-mail to the server log. */
  transport: 'smtp' | 'log'
  /** SMTP with a host and a sender. */
  ready: boolean
  host: string | null
  port: number | null
  /** tls: TLS from the start (465); starttls: required STARTTLS (587); opportunistic: STARTTLS when offered. */
  security: 'tls' | 'starttls' | 'opportunistic' | null
  from: string | null
}

/** An invitation in Settings → People (pending ones; an expired one can be sent again). */
export interface Invitation {
  id: string
  email: string
  role: WorkspaceRole
  /** The teams they join; empty: the default team. */
  teamIds: string[]
  invitedBy: string | null
  expiresAt: string
  createdAt: string
  expired: boolean
}

/** What inviting one address came to. `link` is there when the e-mail was not sent (mail is only logged, or it failed): pass it on yourself. */
export interface InviteOutcome {
  email: string
  ok: boolean
  /** Why it was not made (already in the team, already invited…). */
  error?: string
  /** sent, logged (NUXT_MAIL_TRANSPORT=log) or failed. */
  mail?: 'sent' | 'logged' | 'failed'
  link?: string
}

/** GET /api/invitations/:token — what the invitation page shows, before anyone signs in. */
export interface InvitationPreview {
  email: string
  role: WorkspaceRole
  workspaceName: string
  /** The teams a guest is invited to look at (a colleague's teams are the workspace's business). */
  teams: string[]
  inviterName: string | null
  expiresAt: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  /** Whether Keeper already has an account for this address: then they sign in to accept. */
  hasAccount: boolean
}
