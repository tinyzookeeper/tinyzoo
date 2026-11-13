import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

/**
 * The CMS's own tables besides cms_media: people who use the admin, the one-time
 * links they are sent (invites, password resets), and an audit log.
 *
 * Like cms_media, each table exists twice: as a runtime Drizzle table (used by the
 * server) and as source emitted verbatim into the host's db/schema.ts (so
 * drizzle-kit migrations create it). test/unit/system-tables.spec.ts checks the two
 * agree.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date', precision: 3 })

/** Built-in roles. `admin` also manages people; `author` edits only what they created and cannot publish. */
export const CMS_ROLES = ['admin', 'editor', 'author'] as const
export type CmsRole = (typeof CMS_ROLES)[number]

export const cmsUsers = pgTable('cms_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Stored lower-cased; unique.
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  role: text('role').notNull().default('editor'),
  // invited (has not set a password yet) | active | disabled
  status: text('status').notNull().default('invited'),
  passwordHash: text('password_hash'),
  // Admin interface language the person chose (null = browser/default).
  locale: text('locale'),
  // Bumped on password change, disable or "sign out everywhere": sessions carrying
  // an older version stop working on their next request.
  sessionVersion: integer('session_version').notNull().default(0),
  lastLoginAt: ts('last_login_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('cms_users_email_unique').on(t.email)])

export const cmsTokens = pgTable('cms_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => cmsUsers.id, { onDelete: 'cascade' }),
  // invite | reset
  kind: text('kind').notNull(),
  // SHA-256 of the secret sent in the link; the secret itself is never stored.
  tokenHash: text('token_hash').notNull(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdBy: uuid('created_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('cms_tokens_hash_unique').on(t.tokenHash), index('cms_tokens_user_idx').on(t.userId)])

export const cmsAudit = pgTable('cms_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Who did it (null for anonymous events like a failed sign-in).
  userId: uuid('user_id'),
  // e.g. auth.login, user.invite, user.role, entry.create, entry.publish
  action: text('action').notNull(),
  entity: text('entity'),
  recordId: text('record_id'),
  meta: jsonb('meta'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('cms_audit_created_idx').on(t.createdAt)])

/** Source emitted verbatim into db/schema.ts (imports provided by the emitter). */
export const CMS_SYSTEM_SOURCE = `export const cmsUsers = pgTable('cms_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  role: text('role').notNull().default('editor'),
  status: text('status').notNull().default('invited'),
  passwordHash: text('password_hash'),
  locale: text('locale'),
  sessionVersion: integer('session_version').notNull().default(0),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date', precision: 3 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
}, (t) => [uniqueIndex('cms_users_email_unique').on(t.email)])

export const cmsTokens = pgTable('cms_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => cmsUsers.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true, mode: 'date', precision: 3 }),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
}, (t) => [uniqueIndex('cms_tokens_hash_unique').on(t.tokenHash), index('cms_tokens_user_idx').on(t.userId)])

export const cmsAudit = pgTable('cms_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  entity: text('entity'),
  recordId: text('record_id'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
}, (t) => [index('cms_audit_created_idx').on(t.createdAt)])`
