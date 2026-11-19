import { bigint, bigserial, boolean, date, index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * The analytics plugin's tables. Written twice, as the plugin API asks: the Drizzle objects
 * the server queries, and `ANALYTICS_TABLES_SOURCE`, the same tables as source, which
 * `tinyzoo generate` pastes into the site's schema.ts (and compares with these).
 *
 * - `analytics_events`: one row per page view, kept `keepRawDays` (default 90). No address,
 *   no cookie: `visitor` is a hash that changes every day (see core/visitor.ts).
 * - `analytics_daily`: totals per day, dimension and value. No personal data; kept.
 */
/**
 * One row per page view. Read it on the server with `useCms().reg.pluginTables.get('analytics_events')`
 * or this import; its columns may change in a minor release (with a migration).
 *
 * @internal
 */
export const analyticsEvents = pgTable('analytics_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  at: timestamp('at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
  path: text('path').notNull(),
  entity: text('entity'),
  entryId: text('entry_id'),
  locale: text('locale'),
  visitor: text('visitor').notNull(),
  session: text('session').notNull(),
  consentId: text('consent_id'),
  view: text('view').notNull(),
  isEntry: boolean('is_entry').notNull().default(false),
  referrerHost: text('referrer_host'),
  source: text('source').notNull().default('Direct'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  country: text('country'),
  device: text('device'),
  browser: text('browser'),
  os: text('os'),
  language: text('language'),
  engagedMs: integer('engaged_ms').notNull().default(0),
}, (t) => [
  index('analytics_events_at_idx').on(t.at),
  index('analytics_events_visitor_idx').on(t.visitor, t.at),
  index('analytics_events_view_idx').on(t.view),
  index('analytics_events_entry_idx').on(t.entity, t.entryId, t.at),
])

/**
 * Totals per day, dimension and value. For code outside the plugin, `dailyRollups()` is the stable way to read them.
 *
 * @internal
 */
export const analyticsDaily = pgTable('analytics_daily', {
  day: date('day').notNull(),
  dimension: text('dimension').notNull(),
  value: text('value').notNull(),
  visitors: integer('visitors').notNull().default(0),
  visits: integer('visits').notNull().default(0),
  pageviews: integer('pageviews').notNull().default(0),
  bounces: integer('bounces').notNull().default(0),
  engagedMs: bigint('engaged_ms', { mode: 'number' }).notNull().default(0),
}, (t) => [
  primaryKey({ name: 'analytics_daily_pk', columns: [t.day, t.dimension, t.value] }),
  index('analytics_daily_dimension_idx').on(t.dimension, t.day),
])

/** The same tables as source, for the site's schema.ts (plain JavaScript; `tinyzoo generate` checks it against the objects above). */
export const ANALYTICS_TABLES_SOURCE = `export const analyticsEvents = pgTable('analytics_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  at: timestamp('at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
  path: text('path').notNull(),
  entity: text('entity'),
  entryId: text('entry_id'),
  locale: text('locale'),
  visitor: text('visitor').notNull(),
  session: text('session').notNull(),
  consentId: text('consent_id'),
  view: text('view').notNull(),
  isEntry: boolean('is_entry').notNull().default(false),
  referrerHost: text('referrer_host'),
  source: text('source').notNull().default('Direct'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  country: text('country'),
  device: text('device'),
  browser: text('browser'),
  os: text('os'),
  language: text('language'),
  engagedMs: integer('engaged_ms').notNull().default(0),
}, (t) => [
  index('analytics_events_at_idx').on(t.at),
  index('analytics_events_visitor_idx').on(t.visitor, t.at),
  index('analytics_events_view_idx').on(t.view),
  index('analytics_events_entry_idx').on(t.entity, t.entryId, t.at),
])

export const analyticsDaily = pgTable('analytics_daily', {
  day: date('day').notNull(),
  dimension: text('dimension').notNull(),
  value: text('value').notNull(),
  visitors: integer('visitors').notNull().default(0),
  visits: integer('visits').notNull().default(0),
  pageviews: integer('pageviews').notNull().default(0),
  bounces: integer('bounces').notNull().default(0),
  engagedMs: bigint('engaged_ms', { mode: 'number' }).notNull().default(0),
}, (t) => [
  primaryKey({ name: 'analytics_daily_pk', columns: [t.day, t.dimension, t.value] }),
  index('analytics_daily_dimension_idx').on(t.dimension, t.day),
])`
