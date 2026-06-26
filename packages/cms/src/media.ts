import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/** Built-in media entity. Blobs live in a StorageDriver; only metadata is in the DB. */
export const cmsMedia = pgTable('cms_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  key: text('key').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  width: integer('width'),
  height: integer('height'),
  alt: text('alt'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
})

/** Source emitted verbatim into db/schema.ts so migrations create the table. */
export const CMS_MEDIA_SOURCE = `export const cmsMedia = pgTable('cms_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  key: text('key').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  width: integer('width'),
  height: integer('height'),
  alt: text('alt'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
})`
