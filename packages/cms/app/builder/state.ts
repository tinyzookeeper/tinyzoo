// Whether the editor in the preview is on for this page. Only the preview's own message turns
// it on (plugins/cmsLivePreview.client.ts); this folder is not auto-imported, so a site that
// never gets that message never loads anything of the tool beyond this flag.
import { shallowRef } from 'vue'
import type { ComponentInternalInstance } from 'vue'

export const cmsBuilderOn = shallowRef(false)

/**
 * Each <CmsBlocks> on the page, to mark its blocks again. A block drawn by a component that
 * loads later (or changes its own root) gets its element after <CmsBlocks> last updated; the
 * overlay calls these whenever the page's elements change.
 */
export const cmsBuilderMarkers = new Set<() => void>()

/**
 * Since 2e: each marked block's values as <CmsBlocks> drew it, by its list and id (`<list>\n<id>`, as the
 * overlay keys a block): a text a site's component does not mark is found by comparing the page's text
 * with them (shared/builder-match.ts).
 */
export const cmsBuilderBlocks = new Map<string, Record<string, unknown>>()

/**
 * Since 2f: each marked block's component, by the same key: what it loads through the content API is found
 * from what its drawing depends on (app/builder/sources.ts), also when it shows nothing of it now.
 */
export const cmsBuilderInstances = new Map<string, ComponentInternalInstance>()

/** The admin's names of the block types and its word for a block that draws nothing, for what the page draws while the tool is on. */
export const cmsBuilderWords = shallowRef<{ names: Record<string, string>; blank: string; texts: CmsBuilderCardTexts }>({ names: {}, blank: '', texts: { chooseField: '', fieldMissing: '', fieldUnfit: '', emptyCard: '', sampleCard: '' } })

/** Since 3b: the admin's words for a card's placeholders (`fieldMissing` and `fieldUnfit` hold `{name}`); `''` for a word the admin did not send. */
export interface CmsBuilderCardTexts { chooseField: string; fieldMissing: string; fieldUnfit: string; emptyCard: string; sampleCard: string }

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

/**
 * Since 2g: the entries and globals changed in the page that wait in the editor (by `<entity>\n<id>`: the
 * changed fields), those the person may not change after all, and who wants to hear of the next ones: a
 * text of an entry typed in the page waits for its value here before the page loads its content anew.
 */
export const cmsBuilderPending: {
  entries: Map<string, Record<string, unknown>>; locked: Set<string>; listeners: Set<() => void>
  /** The entry open in the sheet beside the page: its own form holds its changes. */
  sheet: { entity: string; id: string | null } | null
} = { entries: new Map(), locked: new Set(), listeners: new Set(), sheet: null }
