import { sql } from 'drizzle-orm'
import { bigint, bigserial, boolean, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { CmsStatus } from '../../shared/types/status'
import type { TrafficDrop, TrafficItem } from '../../shared/types/traffic'

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date', precision: 3 })

/**
 * A team that looks after sites. Self-hosted Keeper has one; every other table hangs
 * off it, so a hosted Keeper can hold many without a migration of the data.
 */
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // Who gets the down/up e-mails; empty = every member.
  alertEmails: jsonb('alert_emails').$type<string[]>().notNull().default([]),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Stored lower-cased.
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  // Bumped on a password change or removal: older sessions stop working.
  sessionVersion: integer('session_version').notNull().default(0),
  lastLoginAt: ts('last_login_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_unique').on(t.email)])

export const memberships = pgTable('memberships', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /**
   * owner: everything, and the only one who can make or remove owners. admin: the team,
   * clients and settings. member: works on sites. viewer: only looks (a client's own people).
   */
  role: text('role').$type<MemberRole>().notNull().default('member'),
  // Sees every client's sites (and sites without a client). Otherwise only the clients in
  // membership_clients. Owners and admins always see everything.
  allClients: boolean('all_clients').notNull().default(true),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })])

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer'

/**
 * Whose sites they are: the team's clients. A site belongs to one client or none; what a
 * person may see can be narrowed to some clients (membership_clients).
 */
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Also told when one of the client's sites goes down, comes back or its certificate runs out.
  alertEmails: jsonb('alert_emails').$type<string[]>().notNull().default([]),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('clients_workspace_name_unique').on(t.workspaceId, sql`lower(${t.name})`)])

/** The clients a person with `all_clients = false` may see. Gone with the membership or the client. */
export const membershipClients = pgTable('membership_clients', {
  workspaceId: uuid('workspace_id').notNull(),
  userId: uuid('user_id').notNull(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.userId, t.clientId] }),
  foreignKey({ columns: [t.workspaceId, t.userId], foreignColumns: [memberships.workspaceId, memberships.userId], name: 'membership_clients_membership_fk' }).onDelete('cascade'),
  index('membership_clients_client_idx').on(t.clientId),
])

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Removing the client leaves its sites without one.
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  // The site's origin, no trailing slash (https://example.com).
  url: text('url').notNull(),
  environment: text('environment').$type<'production' | 'staging'>().notNull().default('production'),
  // The site's NUXT_CMS_STATUS_TOKEN, encrypted (AES-GCM with NUXT_KEEPER_SECRET).
  tokenEnc: text('token_enc'),
  repoUrl: text('repo_url').notNull().default(''),
  notes: text('notes').notNull().default(''),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),

  // What the checks found (kept on the row so the overview is one query).
  state: text('state').$type<'up' | 'down' | 'unknown'>().notNull().default('unknown'),
  stateSince: ts('state_since'),
  failStreak: integer('fail_streak').notNull().default(0),
  lastCheckAt: ts('last_check_at'),
  lastResponseMs: integer('last_response_ms'),
  status: jsonb('status').$type<CmsStatus>(),
  statusAt: ts('status_at'),
  statusError: text('status_error'),
  certExpiresAt: ts('cert_expires_at'),
  certCheckedAt: ts('cert_checked_at'),
  certError: text('cert_error'),
  // When the "certificate expires soon" e-mail went out (once per certificate).
  certWarnedFor: ts('cert_warned_for'),
  // Visits (the site's analytics plugin): when Keeper last asked, why it could not read them,
  // the first and the last day the site has totals for.
  trafficCheckedAt: ts('traffic_checked_at'),
  trafficError: text('traffic_error'),
  trafficSince: date('traffic_since'),
  trafficThrough: date('traffic_through'),
  // The drop the team was told about (once per drop); null while visits are as usual.
  trafficDrop: jsonb('traffic_drop').$type<TrafficDrop>(),
}, (t) => [index('sites_workspace_idx').on(t.workspaceId), index('sites_client_idx').on(t.clientId)])

/** One uptime check: GET /api/health/ready. */
export const checks = pgTable('checks', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  at: ts('at').notNull().defaultNow(),
  ok: boolean('ok').notNull(),
  code: integer('code'),
  ms: integer('ms'),
  error: text('error'),
}, (t) => [index('checks_site_at_idx').on(t.siteId, t.at)])

/**
 * A site's visits on one day, from its analytics plugin (GET /api/content/_analytics/rollups):
 * totals, and the top pages, sources, countries and devices of the day. No personal data.
 */
export const siteTraffic = pgTable('site_traffic', {
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  // The site's own day (its time zone).
  day: date('day').notNull(),
  visitors: integer('visitors').notNull().default(0),
  visits: integer('visits').notNull().default(0),
  pageviews: integer('pageviews').notNull().default(0),
  bounces: integer('bounces').notNull().default(0),
  engagedMs: bigint('engaged_ms', { mode: 'number' }).notNull().default(0),
  pages: jsonb('pages').$type<TrafficItem[]>().notNull().default([]),
  sources: jsonb('sources').$type<TrafficItem[]>().notNull().default([]),
  countries: jsonb('countries').$type<TrafficItem[]>().notNull().default([]),
  devices: jsonb('devices').$type<TrafficItem[]>().notNull().default([]),
  fetchedAt: ts('fetched_at').notNull().defaultNow(),
}, (t) => [primaryKey({ name: 'site_traffic_pk', columns: [t.siteId, t.day] })])

/** A stretch of time a site was down. */
export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  startedAt: ts('started_at').notNull(),
  endedAt: ts('ended_at'),
  cause: text('cause').notNull().default(''),
}, (t) => [index('incidents_site_idx').on(t.siteId, t.startedAt)])

/** Small bits of Keeper's own state (the newest tinyzoo release). */
export const state = pgTable('state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

/**
 * Programs that registered themselves to connect over OAuth (RFC 7591). A registration grants
 * nothing: it is a name and the addresses a code may be sent back to. Every connection still
 * goes through a person on the consent page.
 */
export const oauthClients = pgTable('oauth_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  // What the client calls itself: a claim, shown next to the redirect host (a fact).
  name: text('name').notNull(),
  redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
  clientUri: text('client_uri'),
  lastUsedAt: ts('last_used_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

/** An authorization waiting for a person to decide on the consent page. */
export const oauthRequests = pgTable('oauth_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  state: text('state'),
  codeChallenge: text('code_challenge').notNull(),
  // The most the client asked for.
  scope: text('scope').$type<'read' | 'write'>().notNull(),
  resource: text('resource'),
  // Set once: a request is decided only once.
  decidedAt: ts('decided_at'),
  expiresAt: ts('expires_at').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

/** A code handed back to the client after consent, exchanged once for tokens. Only its SHA-256 is kept. */
export const oauthCodes = pgTable('oauth_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  codeHash: text('code_hash').notNull(),
  clientId: uuid('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  resource: text('resource'),
  scope: text('scope').$type<'read' | 'write'>().notNull(),
  name: text('name').notNull(),
  consumedAt: ts('consumed_at'),
  expiresAt: ts('expires_at').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('oauth_codes_hash_unique').on(t.codeHash)])

/**
 * An access token for the API and the MCP server (`Authorization: Bearer kpr_…`). Only its
 * SHA-256 is stored. It acts as the person who made it, while they are in the workspace:
 * removing them ends their tokens too.
 *
 * Two kinds, one table: a token made in Settings (`manual`, shown once, until revoked) and a
 * connection signed in over OAuth (`oauth`): its access token lasts an hour and is replaced
 * with the refresh token, which lasts 60 days from its last use.
 */
export const tokens = pgTable('tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  // read: looks only; write: may also add, change, check and remove sites.
  scope: text('scope').$type<'read' | 'write'>().notNull().default('read'),
  // SHA-256 of the whole (current access) token, hex.
  hash: text('hash').notNull(),
  // The start of the token (kpr_ab12cd), to tell tokens apart in the list.
  prefix: text('prefix').notNull(),
  origin: text('origin').$type<'manual' | 'oauth'>().notNull().default('manual'),
  // The OAuth client that signed in (null for a token made by hand, or a client since removed).
  clientId: uuid('client_id').references(() => oauthClients.id, { onDelete: 'set null' }),
  accessExpiresAt: ts('access_expires_at'),
  refreshHash: text('refresh_hash'),
  refreshExpiresAt: ts('refresh_expires_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastUsedAt: ts('last_used_at'),
  revokedAt: ts('revoked_at'),
}, (t) => [
  uniqueIndex('tokens_hash_unique').on(t.hash),
  uniqueIndex('tokens_refresh_hash_unique').on(t.refreshHash),
  index('tokens_workspace_idx').on(t.workspaceId),
])
