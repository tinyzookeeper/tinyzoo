// Public API of tinyzoo (consumed by host cms.config.ts and by the runtime).
export { defineEntity, defineSingleton, buildRegistry, propOf, editorLayout, listLayout } from './entity'
export type { CmsEntity, CmsRegistry, ContentConfig, PublishConfig, EntityDef, Entity, Junction, Row, Insert, Update, CmsEditorLayout, CmsListLayout, CmsFormSection } from './entity'
export { f, snake, camel, pascal, buildColumn, serializeColumn, type CmsGalleryValue, type CmsListValue } from './fields'
export { seo, linkBlock, definePages, defineNavigation, defineRedirects, FORM_FIELD_TYPES } from './presets'
export { defineBlock, blocksSchema, mediaIdsInBlocks, mediaIdsInFields, blockMediaKeys, BLOCK_FIELD_TYPES, blockVersion, storedBlockVersion, upgradeBlock, upgradeBlocks, upgradeListItems, upgradeStoredRow, logUpgradeFailure, UPGRADE_FAILED_KEY, UNKNOWN_BLOCK_TYPE, type UpgradeIssue, type UpgradeOptions, type BlockDef, type BlockValue, type BlocksValue, type GroupValue, type CmsBlock } from './blocks'
export { resolveText, type LocalizedText } from './i18n'
export { defineLocales, type LocalesDef } from './locales'
export { defineAdminMenu, menuSources, resolveMenu, CMS_ADMIN_MENU_BUILTINS, CMS_ADMIN_MENU_GROUPS, type CmsAdminMenuDef, type CmsAdminMenuInput, type CmsAdminMenuBuiltin, type CmsAdminMenuItem, type CmsAdminMenuLayout, type CmsAdminMenuSource, type CmsAdminMenuSaved } from './menu'
export {
  TREE_DEFAULT_MAX_DEPTH, TREE_MAX_DEPTH_LIMIT, indexTree, existsIn, slugIn, titleIn, chainOf, depthOf, childrenMap, sortSiblings, descendantsOf, heightOf,
  slugChain, treeAddress, applyChange, checkTreeChange, checkTree, placeAmong, TREE_POSITION_STEP, movedPaths,
  type TreeConfig, type TreeNode, type TreeIndex, type TreeChange, type TreeProblem, type TreeIssue, type TreeCheckOptions, type MovedPath,
} from './tree'
export { sitePrefix, pathTemplateFor, pathTemplateKeys, fillPathTemplate, sitePath, prefixedTemplates, type PathTemplate } from './paths'
export {
  applyMigrations, runUpgrade, inspectMigrations, classifyMigrations, MigrationOrderError, ORDER_FIX, sqlWithParams, isConnectionError,
  type MigrationJournal, type MigrationSource, type SqlRunner, type JournalEntry, type UpgradeResult, type MigrationStatus, type StepStatus, type MigrationClassification,
} from './migrate'
export { CORE_UPGRADE_STEPS, allUpgradeSteps, type UpgradeStep, type UpgradeContext, type StepOutcome } from './upgrades'
export {
  defineCmsPlugin, collectPlugins, planPlugins, pluginFile, pluginUpgradeSteps, pluginStepId, pluginEntities, pluginRouteAccess, matchRoute, isCmsPlugin,
  pluginApiBase, pluginAdminBase, pluginEntityPrefix,
  type CmsPlugin, type CmsPluginDef, type CmsPluginHandler, type CmsPluginAdminPage, type CmsPluginNavItem, type CmsPluginHooks, type CmsPluginUpgradeStep,
  type CmsPluginRequirement, type CmsFieldRenderer, type CmsGraphExtension, type CmsRetentionContext, type CmsRouteAccess, type CmsHttpMethod, type PluginPlan,
  type CmsPluginAppPlugin, type CmsDashboardWidget, type CmsEntityPanel,
} from './plugin'
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
export { CMS_WEBHOOK_HEADERS, webhookPayload, type CmsChange, type CmsChangeType, type CmsSitemapEntry, type CmsWebhookPayload } from './changes'
export type { CmsErrorReport } from './errorReport'
export type { CmsStatus, CmsStatusAnalytics, CmsStatusBrand, CmsStatusCollection } from './status'
export type { CmsAdminField, CmsFieldEditProps, CmsFieldCellProps } from './admin'
export { resolveAdminTheme, brandFileUrl, themeHash, CMS_ACCENT_PRESETS, CMS_BRAND_FILES, type CmsAccent, type CmsAccentPreset, type CmsAdminLogo, type CmsAdminTheme, type CmsAdminThemeInput, type CmsAccentScheme, type CmsMomentScheme, type CmsColorRamp, type CmsThemeNote, type CmsBrandFile } from './theme'
export type { CmsImageMedia, CmsImageProps, CmsBlocksProps, CmsBlockProps, CmsContentNode, CmsContentProps, CmsNavLink, CmsNavProps, CmsHighlightProps, CmsFormProps, CmsConsentProps, CmsConsentChoice, CmsConsentApi, CmsConsentTexts, CmsConsentCategory, CmsConsentService, CmsReadonlyRef, CmsSearchItem, CmsSearchResult } from './frontend'
export { generateSetupCode, normalizeSetupCode } from './setupCode'
export { adminBrandLockup, adminIconLinks, brandInitials, logoAddressKind, logoFileNotes, resolveAdminLogo, CMS_ADMIN_MANIFEST_URL, CMS_LOGO_MIN_PX, CMS_LOGO_SLOTS, type CmsAdminIconLink, type CmsLogoFileInfo, type CmsLogoSlot } from './themeLogo'
export {
  defineRoles, resolveRole, roleName, rolesDefOf, allRoleNames, fieldReadable, fieldEditable, normalizeFieldAccess, CMS_ENTITY_OPS, CMS_MEDIA_ACCESS, CMS_ROLE_BASES,
  type CmsRoleDef, type CmsRoleRef, type CmsRoleInput, type CmsRoles, type CmsRolesDef, type CmsResolvedRole, type CmsFieldAccess, type CmsFieldRule, type CmsEntityOp, type CmsMediaAccess, type CmsRoleBase, type CmsAccessUser,
} from './roles'
export { cmsUsers, cmsTokens, cmsAccessTokens, cmsOauthClients, cmsOauthRequests, cmsOauthCodes, cmsAudit, cmsCollab, cmsRevisions, cmsState, cmsSearch, CMS_ROLES, type CmsRole } from './system'
export { searchTerms, foldSearchText, entryTexts, richTextPlain, isSearchableField, matchEntry, excerptOf, highlightRanges, wordMatch, editDistance, allowedTypos, SEARCH_MAX_QUERY, type SearchMatch } from './search'
export { linkRef, parseLinkRef, isLinkRef, looksLikeLinkRef, holdsLinks, linkFieldsOf, mapFieldLinks, mapRowLinks, mapDocLinks, linkRefsOf, type LinkRef, type LinkVisitor, type LinkFieldLike } from './links'
export { isSafeLink, richTextSchema, sanitizeRichText, emptyDoc, richTextUpgrades, upgradeRichText, type RichTextDoc, type RichTextUpgrade } from './richtext'
export { defineSeed, isSeed, type SeedContext, type SeedDefinition, type SeedEntry, type SeedInsert, type SeedWriteOptions, type SeedGlobalOptions, type SeedUploadOptions, type SeedLinkOptions, type SeedLink, type SeedRich, type SeedRichNode } from './seed'
export type * from './descriptor'
export { cmsDeprecated, cmsDeprecations, resetCmsDeprecations, type CmsDeprecation, type CmsDeprecatedOptions } from './deprecate'

// Re-export drizzle query helpers so host access rules can use them
// (e.g. `update: ({ user }) => eq(Post.table.authorId, user.id)`).
export { alias } from 'drizzle-orm/pg-core'
export { eq, ne, gt, gte, lt, lte, and, or, not, ilike, inArray, notInArray, isNull, isNotNull, sql, desc, asc } from 'drizzle-orm'
