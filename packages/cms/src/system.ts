import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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

/**
 * Built-in roles. `admin` also manages people; `author` edits only what they created and cannot publish.
 *
 * @internal
 */
export const CMS_ROLES = ['admin', 'editor', 'author'] as const satisfies readonly CmsRole[]
/** A built-in role: `admin` also manages people; `author` edits only what they created and cannot publish. */
export type CmsRole = 'admin' | 'editor' | 'author'

/** @internal */
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

/** @internal */
export const cmsTokens = pgTable('cms_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => cmsUsers.id, { onDelete: 'cascade' }),
  // invite | reset | email (a change of address; the address waits in cms_state)
  kind: text('kind').notNull(),
  // SHA-256 of the secret sent in the link; the secret itself is never stored.
  tokenHash: text('token_hash').notNull(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdBy: uuid('created_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('cms_tokens_hash_unique').on(t.tokenHash), index('cms_tokens_user_idx').on(t.userId)])

/** @internal */
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

/**
 * Shared editing documents (Yjs state, one per entry and language). The working copy
 * people type into together; saving the entry stores its content as usual. `epoch`
 * changes when the document is started afresh from the saved entry, so a browser
 * holding an older history cannot merge it back in.
 *
 * @internal
 */
export const cmsCollab = pgTable('cms_collab', {
  // <entity>/<id> or <entity>/<id>/<locale>
  name: text('name').primaryKey(),
  epoch: uuid('epoch').notNull(),
  // Yjs update (state as one update), base64.
  state: text('state').notNull(),
  // The entry (or translation) version the document last matched.
  baseVersion: ts('base_version'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  // Refreshed while anyone has the document open: it is never restarted under them.
  activeAt: ts('active_at'),
})

/**
 * Revisions: a snapshot of an entry (or one translation) after every save — its
 * field values as the editor sees them — for the history panel, compare and restore.
 *
 * @internal
 */
export const cmsRevisions = pgTable('cms_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  entity: text('entity').notNull(),
  recordId: uuid('record_id').notNull(),
  // null = the entry itself; else the translation's language.
  locale: text('locale'),
  // entry.created, entry.updated, entry.published, translation.updated, …
  action: text('action').notNull(),
  // The entry's (translation's) version after this save.
  version: ts('version'),
  data: jsonb('data').notNull(),
  // Field keys that differ from the previous revision.
  changed: jsonb('changed').notNull(),
  userId: uuid('user_id'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('cms_revisions_record_idx').on(t.entity, t.recordId, t.locale, t.createdAt)])

/**
 * Small bits of state the CMS keeps for itself (e.g. when the scheduler last ran).
 *
 * @internal
 */
export const cmsState = pgTable('cms_state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

/**
 * The search index: what each entry says, as plain text, one row per entry and
 * language ('' = an entry of a collection without translations, the same in every
 * language). `*_folded` is lowercased without accents, with trigram indexes
 * (pg_trgm) for typo-tolerant matching. `body` is what visitors may read; `extra` is
 * only for the admin's search (hidden fields, the list's searchable fields). Kept up
 * to date on every change and rebuilt when the search configuration changes.
 *
 * @internal
 */
export const cmsSearch = pgTable('cms_search', {
  entity: text('entity').notNull(),
  recordId: uuid('record_id').notNull(),
  locale: text('locale').notNull().default(''),
  title: text('title').notNull().default(''),
  body: text('body').notNull().default(''),
  extra: text('extra').notNull().default(''),
  titleFolded: text('title_folded').notNull().default(''),
  bodyFolded: text('body_folded').notNull().default(''),
  extraFolded: text('extra_folded').notNull().default(''),
  // The entry's website address in this language (collections with translations).
  path: text('path'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ name: 'cms_search_pk', columns: [t.entity, t.recordId, t.locale] }),
  index('cms_search_title_trgm').using('gin', t.titleFolded.op('gin_trgm_ops')),
  index('cms_search_body_trgm').using('gin', t.bodyFolded.op('gin_trgm_ops')),
  index('cms_search_extra_trgm').using('gin', t.extraFolded.op('gin_trgm_ops')),
])

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
}, (t) => [index('cms_audit_created_idx').on(t.createdAt)])

export const cmsCollab = pgTable('cms_collab', {
  name: text('name').primaryKey(),
  epoch: uuid('epoch').notNull(),
  state: text('state').notNull(),
  baseVersion: timestamp('base_version', { withTimezone: true, mode: 'date', precision: 3 }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
  activeAt: timestamp('active_at', { withTimezone: true, mode: 'date', precision: 3 }),
})

export const cmsRevisions = pgTable('cms_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  entity: text('entity').notNull(),
  recordId: uuid('record_id').notNull(),
  locale: text('locale'),
  action: text('action').notNull(),
  version: timestamp('version', { withTimezone: true, mode: 'date', precision: 3 }),
  data: jsonb('data').notNull(),
  changed: jsonb('changed').notNull(),
  userId: uuid('user_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
}, (t) => [index('cms_revisions_record_idx').on(t.entity, t.recordId, t.locale, t.createdAt)])

export const cmsState = pgTable('cms_state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
})

export const cmsSearch = pgTable('cms_search', {
  entity: text('entity').notNull(),
  recordId: uuid('record_id').notNull(),
  locale: text('locale').notNull().default(''),
  title: text('title').notNull().default(''),
  body: text('body').notNull().default(''),
  extra: text('extra').notNull().default(''),
  titleFolded: text('title_folded').notNull().default(''),
  bodyFolded: text('body_folded').notNull().default(''),
  extraFolded: text('extra_folded').notNull().default(''),
  path: text('path'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ name: 'cms_search_pk', columns: [t.entity, t.recordId, t.locale] }),
  index('cms_search_title_trgm').using('gin', t.titleFolded.op('gin_trgm_ops')),
  index('cms_search_body_trgm').using('gin', t.bodyFolded.op('gin_trgm_ops')),
  index('cms_search_extra_trgm').using('gin', t.extraFolded.op('gin_trgm_ops')),
])`
