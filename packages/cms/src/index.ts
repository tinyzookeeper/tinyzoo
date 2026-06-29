// Public API of @my-cms/core (consumed by host cms.config.ts and by the runtime).
export { defineEntity, defineSingleton, buildRegistry, propOf } from './entity'
export type { CmsEntity, CmsRegistry, ContentConfig, PublishConfig, EntityDef, Entity, Junction, Row, Insert, Update } from './entity'
export { f, snake, camel, pascal, buildColumn, serializeColumn } from './fields'
export { seo } from './presets'
export { emitSchema } from './emitter'
export { buildOpenApiDocument, type OpenApiOptions } from './openapi'
export { emitContentTypes, type SdkOptions } from './sdk'
export {
  buildContentModel,
  type ContentModel,
  type ContentShape,
  type ContentField,
  type ContentFieldType,
  type EmbeddedShape,
  type RefShape,
  type FilterParam,
} from './content-shape'
export { cmsMedia } from './media'
export { richTextSchema, sanitizeRichText, emptyDoc, type RichTextDoc } from './richtext'
export type * from './descriptor'

// Re-export drizzle query helpers so host access rules can use them
// (e.g. `update: ({ user }) => eq(Post.table.authorId, user.id)`).
export { eq, and, or, ilike, inArray, sql, desc, asc } from 'drizzle-orm'
