import { bigserial, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { CmsStatus } from '../../shared/types/status'

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
  // owner: manages the team and settings; member: manages sites.
  role: text('role').$type<'owner' | 'member'>().notNull().default('member'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })])

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  client: text('client').notNull().default(''),
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
}, (t) => [index('sites_workspace_idx').on(t.workspaceId)])

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
