// Public API of @my-cms/core (consumed by host cms.config.ts and by the runtime).
export { defineEntity, defineSingleton, buildRegistry, propOf } from './entity'
export type { CmsEntity, CmsRegistry, ContentConfig, PublishConfig, EntityDef, Entity, Junction, Row, Insert, Update } from './entity'
export { f, snake, camel, pascal, buildColumn, serializeColumn } from './fields'
export { seo, linkBlock, definePages, defineNavigation, defineRedirects } from './presets'
export { defineBlock, blocksSchema, mediaIdsInBlocks, blockMediaKeys, BLOCK_FIELD_TYPES, type BlockDef, type BlockValue, type BlocksValue, type CmsBlock } from './blocks'
export { resolveText, type LocalizedText } from './i18n'
export { defineLocales, type LocalesDef } from './locales'
export { applyMigrations, type MigrationJournal, type MigrationSource, type SqlRunner } from './migrate'
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
export type { CmsChange, CmsChangeType } from './changes'
export { cmsUsers, cmsTokens, cmsAudit, CMS_ROLES, type CmsRole } from './system'
export { richTextSchema, sanitizeRichText, emptyDoc, type RichTextDoc } from './richtext'
export type * from './descriptor'

// Re-export drizzle query helpers so host access rules can use them
// (e.g. `update: ({ user }) => eq(Post.table.authorId, user.id)`).
export { eq, ne, gt, lt, and, or, not, ilike, inArray, isNull, isNotNull, sql, desc, asc } from 'drizzle-orm'
