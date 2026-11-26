// Whether the editor in the preview is on for this page. Only the preview's own message turns
// it on (plugins/cmsLivePreview.client.ts); this folder is not auto-imported, so a site that
// never gets that message never loads anything of the tool beyond this flag.
import { shallowRef } from 'vue'

export const cmsBuilderOn = shallowRef(false)

/**
 * Each <CmsBlocks> on the page, to mark its blocks again. A block drawn by a component that
 * loads later (or changes its own root) gets its element after <CmsBlocks> last updated; the
 * overlay calls these whenever the page's elements change.
 */
export const cmsBuilderMarkers = new Set<() => void>()

/** The admin's names of the block types and its word for a block that draws nothing, for what the page draws while the tool is on. */
export const cmsBuilderWords = shallowRef<{ names: Record<string, string>; blank: string }>({ names: {}, blank: '' })
