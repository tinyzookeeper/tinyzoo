import { bigserial, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * The consent log, `consent_log`: one row per choice a visitor made, so the site can show that
 * a consent was given, when, under which texts, and when it was changed or taken back. No
 * address, no user agent, nothing about the visitor but the random consent id their cookie
 * holds. Kept `keepLogDays` (default three years), then deleted by the nightly task.
 *
 * Written twice, as the plugin API asks: the Drizzle object the server writes, and
 * `CONSENT_TABLES_SOURCE`, the same table as source for the site's schema.ts.
 *
 * @internal
 */
export const consentLog = pgTable('consent_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  consentId: text('consent_id').notNull(),
  at: timestamp('at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
  /** `given`, `changed` or `withdrawn`. */
  action: text('action').notNull(),
  /** Yes or no per category asked about: `{ "analytics": true, "marketing": false }` (necessary is always on). */
  choice: jsonb('choice').notNull(),
  /** The version of the texts the visitor answered (the consent settings' `version`). */
  version: integer('version').notNull(),
}, (t) => [
  index('consent_log_consent_idx').on(t.consentId, t.at),
  index('consent_log_at_idx').on(t.at),
])

/** The same table as source, for the site's schema.ts (plain JavaScript; `tinyzoo generate` checks it against the object above). */
export const CONSENT_TABLES_SOURCE = `export const consentLog = pgTable('consent_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  consentId: text('consent_id').notNull(),
  at: timestamp('at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
  action: text('action').notNull(),
  choice: jsonb('choice').notNull(),
  version: integer('version').notNull(),
}, (t) => [
  index('consent_log_consent_idx').on(t.consentId, t.at),
  index('consent_log_at_idx').on(t.at),
])`
