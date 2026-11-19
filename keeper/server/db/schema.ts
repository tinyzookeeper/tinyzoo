import { bigserial, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { CmsStatus } from 'tinyzoo'

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
