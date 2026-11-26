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

/**
 * The form's values as the admin last sent them (`cms:preview`), and who wants to hear of the next ones:
 * a text typed in the page starts from the field's own value, and waits for its value to come back.
 */
export const cmsBuilderDraft: { data: unknown; listeners: Set<(data: unknown) => void> } = { data: undefined, listeners: new Set() }

/**
 * While a text is typed in the page, the page does not refetch its content (`count` > 0): the element
 * typed in must not be drawn anew under the cursor. A refetch asked for meanwhile is `missed`, and
 * `refresh` makes it once the typing has ended.
 */
export const cmsBuilderHold: { count: number; missed: boolean; refresh: () => Promise<unknown> } = { count: 0, missed: false, refresh: async () => {} }
