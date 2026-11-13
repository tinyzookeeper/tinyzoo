import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
  // Alt text per content language ({ en: '…' }); `alt` is the default language's.
  altLocales: jsonb('alt_locales'),
  // The file's name as uploaded (for people finding it again; never used as a path).
  name: text('name'),
  // A folder in the library (one level, e.g. 'Team photos'); null = no folder.
  folder: text('folder'),
  // Focal point in percent of width/height (0–100): what must stay when cropping.
  focalX: integer('focal_x'),
  focalY: integer('focal_y'),
  // Host user id of the uploader (no FK — the users table is host-owned). Drives per-user quota.
  uploadedBy: uuid('uploaded_by'),
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
  altLocales: jsonb('alt_locales'),
  name: text('name'),
  folder: text('folder'),
  focalX: integer('focal_x'),
  focalY: integer('focal_y'),
  uploadedBy: uuid('uploaded_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
})`
