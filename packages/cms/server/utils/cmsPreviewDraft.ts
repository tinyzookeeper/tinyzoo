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
import type { CmsEntity, CmsRegistry } from 'tinyzoo'
import { splitPayload } from './cmsCrud'
import { isTranslationLocale } from './cmsLocales'
import { isPreviewAuthorized } from './cmsContent'

const TTL = 30 * 60_000
const MAX = 500
const drafts = new Map<string, { values: Record<string, any>; at: number }>()

const keyOf = (userId: string, entity: string, id: string, locale: string | null) => `${userId}\u0000${entity}\u0000${id}\u0000${locale ?? ''}`
// The default language and "no languages" are the same draft.
const draftLocale = (reg: CmsRegistry, locale: string | null | undefined) => (isTranslationLocale(reg, locale) ? locale : null)

/**
 * Keep an editor's unsaved values for the preview. Each value is checked against its
 * field (a half-typed one that is not valid yet keeps the saved value) and turned into
 * the entry's columns, as a save would. Lists of related entries are not previewed.
 */
export function putPreviewDraft(reg: CmsRegistry, e: CmsEntity, userId: string, id: string, locale: string | null, data: Record<string, any>) {
  const loc = draftLocale(reg, locale)
  const valid: Record<string, any> = {}
  for (const [key, value] of Object.entries(data ?? {})) {
    const fld = e.fields[key]
    if (!fld || (loc && !e.localized.includes(key))) continue
    const parsed = fld.zod('update').safeParse(value)
    if (parsed.success) valid[key] = parsed.data
  }
  const { values } = splitPayload(e, valid)
  const now = Date.now()
  if (drafts.size >= MAX) {
    for (const [k, d] of drafts) if (now - d.at > TTL) drafts.delete(k)
    if (drafts.size >= MAX) drafts.delete(drafts.keys().next().value!)
  }
  drafts.set(keyOf(userId, e.name, id, loc), { values, at: now })
}

export function dropPreviewDraft(reg: CmsRegistry, e: CmsEntity, userId: string, id: string, locale: string | null) {
  drafts.delete(keyOf(userId, e.name, id, draftLocale(reg, locale)))
}

/**
 * Lay the signed-in editor's unsaved values over the rows a ?preview request reads
 * (after translations are merged, before related entries are filled in). Returns
 * whether anything was laid over, so the caller can keep the answer out of caches.
 */
export function applyPreviewDrafts(event: any, reg: CmsRegistry, e: CmsEntity, rows: any[], locale: string | null): boolean {
  const user = event.context?.cmsUser
  if (!user || !drafts.size || !isPreviewAuthorized(event)) return false
  const loc = draftLocale(reg, locale)
  let applied = false
  for (const row of rows) {
    const draft = drafts.get(keyOf(user.id, e.name, row.id, loc))
    if (!draft) continue
    if (Date.now() - draft.at > TTL) {
      drafts.delete(keyOf(user.id, e.name, row.id, loc))
      continue
    }
    Object.assign(row, draft.values)
    applied = true
  }
  return applied
}
