import { sql } from 'drizzle-orm'
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { Step } from '../../shared/steps'
import type { SiteStatus } from '../../shared/api'
import type { Locale } from '../../shared/templates'

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date', precision: 3 })

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Stored lower-cased.
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  // When the address was confirmed (the link in the e-mail); null until then.
  emailVerifiedAt: ts('email_verified_at'),
  // The language of the pages and e-mails.
  locale: text('locale').$type<Locale>().notNull().default('cs'),
  // Bumped on a password change: older sessions stop working.
  sessionVersion: integer('session_version').notNull().default(0),
  lastLoginAt: ts('last_login_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_unique').on(t.email)])

/**
 * The links sent by e-mail: confirm the address (`verify`), choose a new password (`reset`).
 * Only the SHA-256 of the secret is stored; a link works once and until it expires.
 */
export const emailTokens = pgTable('email_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'verify' | 'reset'>().notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('email_tokens_hash_unique').on(t.tokenHash), index('email_tokens_user_idx').on(t.userId, t.kind)])

/**
 * A website someone made. `waiting`: its owner has yet to confirm their e-mail. `creating`:
 * the steps are running (or wait to be picked up after a restart). `ready`, `failed` (a step
 * failed; "Try again" resumes from it), `removing`, `removed` (kept as a record; its address is free again).
 */
export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  // The address: <slug>.localhost:<port> locally, <slug>.pushbase.app on Pushbase. Also the database's and the folder's name.
  slug: text('slug').notNull(),
  template: text('template').notNull(),
  // The look of the template chosen in the wizard (shared/templates.ts); null for a template with one design.
  look: text('look'),
  status: text('status').$type<SiteStatus>().notNull().default('creating'),
  // The hosting driver that made it (local, pushbase): it also runs and removes it.
  driver: text('driver').notNull(),
  publicUrl: text('public_url'),
  // Where the cloud itself reaches the site (the same as publicUrl on a real host).
  internalUrl: text('internal_url'),
  // Whatever the driver needs to find the site again (the local one: its port, folder and database).
  driverState: jsonb('driver_state').$type<Record<string, unknown>>(),
  // Encrypted JSON (server/utils/secret.ts): the site's app secret, setup code, status token and the service account's password.
  secrets: text('secrets').notNull(),
  // Encrypted: the link where the owner chooses their password for the admin.
  inviteUrl: text('invite_url'),
  inviteSentAt: ts('invite_sent_at'),
  ownerAcceptedAt: ts('owner_accepted_at'),
  steps: jsonb('steps').$type<Step[]>().notNull().default([]),
  // Technical detail of the last failure (the step's own `message` holds the plain-words code).
  error: text('error'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  readyAt: ts('ready_at'),
  removedAt: ts('removed_at'),
}, (t) => [
  // An address belongs to one website at a time; a removed one gives it back.
  uniqueIndex('sites_slug_unique').on(t.slug).where(sql`${t.status} <> 'removed'`),
  index('sites_owner_idx').on(t.ownerId),
])

export type UserRow = typeof users.$inferSelect
export type SiteRow = typeof sites.$inferSelect
