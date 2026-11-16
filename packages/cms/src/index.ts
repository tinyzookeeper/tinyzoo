// Public API of tinyzoo (consumed by host cms.config.ts and by the runtime).
export { defineEntity, defineSingleton, buildRegistry, propOf, editorLayout, listLayout } from './entity'
export type { CmsEntity, CmsRegistry, ContentConfig, PublishConfig, EntityDef, Entity, Junction, Row, Insert, Update, CmsEditorLayout, CmsListLayout, CmsFormSection } from './entity'
export { f, snake, camel, pascal, buildColumn, serializeColumn, type CmsGalleryValue, type CmsListValue } from './fields'
export { seo, linkBlock, definePages, defineNavigation, defineRedirects, defineForm, defineFormSettings, FORM_FIELD_TYPES, type FormOptions } from './presets'
export { defineBlock, blocksSchema, mediaIdsInBlocks, blockMediaKeys, BLOCK_FIELD_TYPES, type BlockDef, type BlockValue, type BlocksValue, type CmsBlock } from './blocks'
export { resolveText, type LocalizedText } from './i18n'
export { defineLocales, type LocalesDef } from './locales'
export { sitePrefix, pathTemplateFor, pathTemplateKeys, fillPathTemplate, sitePath, prefixedTemplates, type PathTemplate } from './paths'
export { applyMigrations, sqlWithParams, isConnectionError, type MigrationJournal, type MigrationSource, type SqlRunner } from './migrate'
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
export { cmsUsers, cmsTokens, cmsAudit, cmsCollab, cmsRevisions, cmsState, cmsSearch, CMS_ROLES, type CmsRole } from './system'
export { searchTerms, foldSearchText, entryTexts, richTextPlain, isSearchableField, matchEntry, excerptOf, highlightRanges, wordMatch, editDistance, allowedTypos, SEARCH_MAX_QUERY, type SearchMatch } from './search'
export { richTextSchema, sanitizeRichText, emptyDoc, type RichTextDoc } from './richtext'
export type * from './descriptor'

// Re-export drizzle query helpers so host access rules can use them
// (e.g. `update: ({ user }) => eq(Post.table.authorId, user.id)`).
export { eq, ne, gt, gte, lt, lte, and, or, not, ilike, inArray, notInArray, isNull, isNotNull, sql, desc, asc } from 'drizzle-orm'
