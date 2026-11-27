// Live preview: what an editor has typed but not saved, shown on the website preview
// as they type.
//
// The editor's preview panel sends the form's values here (POST /api/cms/_preview)
// and the preview page refetches its content. The content API then lays those values
// over the saved entry — only for that same signed-in editor, only with ?preview, and
// never cached. Nobody else, and no published page, ever sees them.
//
// Kept in this server's memory for a while (one server process; a draft is gone after
// a restart, and the preview simply shows the saved version again).
import { blocksSchema, type BlockDef, type CmsEntity, type CmsRegistry } from 'tinyzoo'
import { splitPayload } from './cmsCrud'
import { isTranslationLocale } from './cmsLocales'
import { isPreviewAuthorized } from './cmsContent'

const TTL = 30 * 60_000
const MAX = 500
// Per site: a draft belongs to a site's editor.
const drafts = cmsSiteScoped(() => new Map<string, { values: Record<string, any>; at: number }>())

const keyOf = (userId: string, entity: string, id: string, locale: string | null) => `${userId}\u0000${entity}\u0000${id}\u0000${locale ?? ''}`
// The default language and "no languages" are the same draft.
const draftLocale = (reg: CmsRegistry, locale: string | null | undefined) => (isTranslationLocale(reg, locale) ? locale : null)

/**
 * Keep an editor's unsaved values for the preview. Each value is checked against its
 * field (a half-typed one that is not valid yet keeps the saved value; in a list of blocks,
 * only the blocks that are not valid yet are left out) and turned into
 * the entry's columns, as a save would. Lists of related entries are not previewed.
 */
export function putPreviewDraft(reg: CmsRegistry, e: CmsEntity, userId: string, id: string, locale: string | null, data: Record<string, any>) {
  const loc = draftLocale(reg, locale)
  const valid: Record<string, any> = {}
  for (const [key, value] of Object.entries(data ?? {})) {
    const fld = e.fields[key]
    if (!fld || (loc && !e.localized.includes(key))) continue
    const schema = fld.zod('update')
    let parsed = schema.safeParse(value)
    // A list of blocks with one block not filled in yet (just added) shows the others as they
    // are now, in their new order, instead of falling back to the saved list as a whole. The
    // same inside a block's lists: a small block just added to a layout leaves the layout shown.
    if (!parsed.success && fld.type === 'blocks' && fld.blocks && Array.isArray(value)) {
      parsed = schema.safeParse(validPart(value, fld.blocks))
    }
    if (parsed.success) valid[key] = parsed.data
  }
  const { values } = splitPayload(e, valid)
  const now = Date.now()
  if (drafts().size >= MAX) {
    for (const [k, d] of drafts()) if (now - d.at > TTL) drafts().delete(k)
    if (drafts().size >= MAX) drafts().delete(drafts().keys().next().value!)
  }
  drafts().set(keyOf(userId, e.name, id, loc), { values, at: now })
}

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * The blocks of a list that are valid on their own. A block that is not, but whose lists hold
 * items that are not valid yet, is tried again without those items (at any depth).
 */
function validPart(list: unknown[], defs: Record<string, BlockDef>): unknown[] {
  const one = blocksSchema(defs)
  return list.flatMap((block) => {
    if (one.safeParse([block]).success) return [block]
    const def = isObject(block) && typeof block.type === 'string' && Object.hasOwn(defs, block.type) ? defs[block.type]! : undefined
    if (!def) return []
    let pruned: Record<string, any> = block as Record<string, any>
    for (const [key, inner] of Object.entries(def.fields)) {
      if (inner.type === 'blocks' && inner.blocks && Array.isArray(pruned[key])) pruned = { ...pruned, [key]: validPart(pruned[key], inner.blocks) }
    }
    return pruned !== block && one.safeParse([pruned]).success ? [pruned] : []
  })
}

export function dropPreviewDraft(reg: CmsRegistry, e: CmsEntity, userId: string, id: string, locale: string | null) {
  drafts().delete(keyOf(userId, e.name, id, draftLocale(reg, locale)))
}

/**
 * Lay the signed-in editor's unsaved values over the rows a ?preview request reads
 * (after translations are merged, before related entries are filled in). Returns
 * whether anything was laid over, so the caller can keep the answer out of caches.
 */
export function applyPreviewDrafts(event: any, reg: CmsRegistry, e: CmsEntity, rows: any[], locale: string | null): boolean {
  const user = event.context?.cmsUser
  if (!user || !drafts().size || !isPreviewAuthorized(event)) return false
  const loc = draftLocale(reg, locale)
  let applied = false
  for (const row of rows) {
    const draft = drafts().get(keyOf(user.id, e.name, row.id, loc))
    if (!draft) continue
    if (Date.now() - draft.at > TTL) {
      drafts().delete(keyOf(user.id, e.name, row.id, loc))
      continue
    }
    Object.assign(row, draft.values)
    applied = true
  }
  return applied
}
