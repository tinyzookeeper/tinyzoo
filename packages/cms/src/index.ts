// Public API of @my-cms/core (consumed by host cms.config.ts and by the runtime).
export { defineEntity, buildRegistry, propOf } from './entity'
export type { CmsEntity, CmsRegistry, ContentConfig, EntityDef, Entity, Junction, Row, Insert, Update } from './entity'
export { f, snake, camel, pascal, buildColumn, serializeColumn } from './fields'
export { emitSchema } from './emitter'
export { cmsMedia } from './media'
export { richTextSchema, emptyDoc, type RichTextDoc } from './richtext'
export type * from './descriptor'

// Re-export drizzle query helpers so host access rules can use them
// (e.g. `update: ({ user }) => eq(Post.table.authorId, user.id)`).
export { eq, and, or, ilike, inArray, sql, desc, asc } from 'drizzle-orm'
