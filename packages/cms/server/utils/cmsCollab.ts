import { and, eq, sql, type CmsEntity } from 'tinyzoo'
import * as Y from 'yjs'
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap'
import { editorSchema } from '../../shared/richtext-editor'
import { stableJson } from '../../shared/json'
import { withoutTrailingEmpty } from '../../shared/richtext-normalize'
import type { CmsUser } from './cmsSession'

/**
 * Shared editing of rich text: several people type in the same text at once.
 *
 * One Yjs document per entry and language — `<entity>/<id>` for the entry itself,
 * `<entity>/<id>/<locale>` for a translation — with one shared fragment per rich-text
 * field (top-level fields only; text inside blocks is edited as before). The shared
 * document is the working copy everyone types into; saving the entry stores its
 * content exactly as before, so the content API, versions and webhooks are unchanged.
 *
 * The document's state lives in `cms_collab`, so every replica and every browser
 * that reconnects shares one history. `epoch` names that history: a document is
 * started afresh from the saved entry (new epoch) when nobody has it open and the
 * entry was saved some other way since, or after a week of inactivity. A browser
 * presents its epoch when it connects (the token); one holding an older history is
 * refused and starts over instead of merging stale text back in.
 *
 * Text typed in a tab that was closed (or crashed) without saving stays in the
 * document. The next person to open the entry with nobody else there does not get it
 * as their own unsaved work: the document starts afresh from the saved entry, and
 * the left-over text waits in a side row (`<name>~unsaved`, with who typed it and
 * when) for them to keep or discard. `<name>~by` records who typed last. Both are
 * ordinary rows of `cms_collab` under names no browser can open as a document, so
 * they need no table of their own and are purged and dropped with it.
 */

export interface CollabTarget { entity: CmsEntity; id: string; locale: string | null; name: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Someone is still editing it if its instance refreshed `active_at` this recently (seconds). */
const ACTIVE_WINDOW_S = 90
/** Unused this long, it starts afresh from the saved entry (seconds). */
const STALE_AFTER_S = 7 * 24 * 60 * 60

export function collabName(entity: string, id: string, locale: string | null): string {
  return locale ? `${entity}/${id}/${locale}` : `${entity}/${id}`
}

const unsavedName = (name: string) => `${name}~unsaved`
const byName = (name: string) => `${name}~by`

/** The text of one field as one comparable string: schema defaults filled in, trailing empty paragraphs ignored, empty = ''. */
function comparableText(value: unknown): string {
  if (value === null || value === undefined) return ''
  let v: any = value
  try {
    v = editorSchema().nodeFromJSON(value).toJSON()
  }
  catch { /* text the editor cannot hold is compared as stored */ }
  v = withoutTrailingEmpty(v)
  if (v?.type === 'doc' && !(v.content ?? []).length) return ''
  return stableJson(v)
}

/** What a stored document holds for each field, as editor JSON. */
export function documentValues(state: string, keys: string[]): Record<string, any> {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, decodeState(state))
    return Object.fromEntries(keys.map((k) => [k, yXmlFragmentToProsemirrorJSON(doc.getXmlFragment(k))]))
  }
  finally {
    doc.destroy()
  }
}

/** The fields (with their text) where the shared document is ahead of the saved entry. */
export function leftoverText(state: string, saved: Record<string, any>): Record<string, any> {
  const keys = Object.keys(saved)
  const mine = documentValues(state, keys)
  return Object.fromEntries(keys.filter((k) => comparableText(mine[k]) !== comparableText(saved[k])).map((k) => [k, mine[k]]))
}

/** The document a name points at, or null for a made-up one. */
export function parseCollabName(name: string): CollabTarget | null {
  const m = /^([a-zA-Z][\w-]{0,63})\/([0-9a-fA-F-]{36})(?:\/([a-zA-Z-]{2,20}))?$/.exec(name)
  if (!m || !UUID.test(m[2]!)) return null
  const { reg } = useCms()
  const entity = reg.byName.get(m[1]!)
  if (!entity) return null
  const locale = m[3] ?? null
  if (locale !== null && !isTranslationLocale(reg, locale)) return null
  const id = m[2]!.toLowerCase()
  return { entity, id, locale, name: collabName(entity.name, id, locale) }
}

/**
 * The fields edited together: top-level rich text (in a translation, the translatable ones).
 * Not a field with an `.access()` rule: the shared document is one for everyone who has the
 * entry open, so it would hand a field to people who may not read it, or let people who may
 * not edit it type into it. Such a field is edited alone and saved the usual way, where the
 * server checks the person.
 */
export function collabFields(e: CmsEntity, locale: string | null): string[] {
  return Object.entries(e.fields)
    .filter(([key, f]) => (f as any).type === 'richtext' && !(f as any).meta?.access && (!locale || e.localized.includes(key)))
    .map(([key]) => key)
}

/** The shared texts a stored document holds that are not among `allowed` (a field that has an access rule now, or is gone). */
function documentKeysOutside(state: string, allowed: ReadonlySet<string>): string[] {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, decodeState(state))
    return [...doc.share.keys()].filter((k) => !allowed.has(k))
  }
  finally {
    doc.destroy()
  }
}

/**
 * What this person may do with the document: 'write' (may edit the entry, or this
 * translation), 'read' (may read it: sees the others typing), or null.
 */
export async function collabAccess(user: CmsUser, t: CollabTarget): Promise<'write' | 'read' | null> {
  const { db } = useCms()
  const e = t.entity
  if (!collabFields(e, t.locale).length) return null
  let readFilter: any
  try {
    readFilter = authorize(e, 'read', user)
  }
  catch {
    return null
  }
  const [row] = await db.select({ id: e.table.id }).from(e.table).where(both(eq(e.table.id, t.id), readFilter))
  if (!row) return null
  try {
    const writeFilter = authorize(e, 'update', user)
    const [ok] = await db.select({ id: e.table.id }).from(e.table)
      .where(both(both(eq(e.table.id, t.id), writeFilter), notLiveCond(e, user)))
    return ok ? 'write' : 'read'
  }
  catch {
    return 'read'
  }
}

/**
 * The entry's (or translation's) saved values of the shared fields, and its version.
 * `db` may be a transaction: inside one, everything must go through it (a second
 * pooled connection could wait forever for the one the transaction holds).
 */
export async function savedContent(t: CollabTarget, db: any = useCms().db): Promise<{ values: Record<string, any>; version: Date | null } | null> {
  const e = t.entity
  const keys = collabFields(e, t.locale)
  const [row] = await db.select().from(e.table).where(eq(e.table.id, t.id))
  if (!row) return null
  if (!t.locale) return { values: Object.fromEntries(keys.map((k) => [k, row[k]])), version: row.updatedAt ?? null }
  const tr = (await translationRows(db, e, [t.id], t.locale)).get(t.id)
  return { values: Object.fromEntries(keys.map((k) => [k, tr?.[k] ?? null])), version: tr?.updatedAt ?? null }
}

/**
 * Can the editor hold this stored rich text? Text written through the API may use
 * nodes or marks the editor does not know; such a field is edited alone (not shared),
 * so its stored content is never replaced by an empty shared copy.
 */
export function fitsEditor(value: unknown): boolean {
  if (value === null || value === undefined) return true
  try {
    editorSchema().nodeFromJSON(value).check()
    return true
  }
  catch {
    return false
  }
}

/** A fresh document holding the saved content, one fragment per field. */
export function seedDocument(values: Record<string, any>): Y.Doc {
  const doc = new Y.Doc()
  const schema = editorSchema()
  for (const [key, value] of Object.entries(values)) {
    const json = value && typeof value === 'object' && value.type === 'doc' ? value : { type: 'doc', content: [] }
    try {
      prosemirrorJSONToYXmlFragment(schema, json, doc.getXmlFragment(key))
    }
    catch (err) {
      // Content the editor's schema does not know (written by an API client): start
      // that field empty rather than refuse the whole document.
      console.error(`[cms] collab: could not load ${key}`, safeErrorMessage(err))
    }
  }
  return doc
}

export const encodeState = (doc: Y.Doc) => Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')
export const decodeState = (state: string) => new Uint8Array(Buffer.from(state, 'base64'))

/**
 * The document to join: the current one, or — when nobody has it open and the saved
 * entry moved on (or it sat unused for a week) — a fresh one from the saved entry.
 * Serialised per document, so two people opening it at once get the same epoch.
 */
export async function ensureCollabDocument(t: CollabTarget): Promise<{ epoch: string }> {
  const { db, reg } = useCms()
  const c = reg.cmsCollab
  return db.transaction(async (tx: any) => {
    // Waiting for another request opening the same document: briefly, never forever.
    await tx.execute(sql`set local lock_timeout = '5s'`)
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'cms-collab:' + t.name}))`)
    // Times compared on the database's clock (replicas' clocks may differ).
    const [row] = await tx.select({
      epoch: c.epoch,
      state: c.state,
      baseVersion: c.baseVersion,
      updatedAt: c.updatedAt,
      active: sql<boolean>`coalesce(${c.activeAt} > now() - make_interval(secs => ${ACTIVE_WINDOW_S}), false)`,
      fresh: sql<boolean>`${c.updatedAt} > now() - make_interval(secs => ${STALE_AFTER_S})`,
    }).from(c).where(eq(c.name, t.name))
    const saved = await savedContent(t, tx)
    if (!saved) throw createError({ statusCode: 404, statusMessage: 'Not found' })
    const sameBase = row && (row.baseVersion?.getTime() ?? null) === (saved.version?.getTime() ?? null)
    // A document made before a field got an access rule still holds that field's text: it is not
    // reused (everyone is sent to a fresh one), so the text goes to nobody who may not read it.
    const outdated = !!row && documentKeysOutside(row.state, new Set(collabFields(t.entity, t.locale))).length > 0
    if (row?.active && !outdated) return { epoch: row.epoch }
    if (row && sameBase && row.fresh && !outdated) {
      // Nobody has it open. Text in it that was never saved (a tab closed or crashed)
      // is not this person's work: it waits aside, and they start from the saved entry.
      // (A document stored before the entry's last save is behind it, not ahead: the
      // save came from here and the rest of its text is still on its way in.)
      if (saved.version && row.updatedAt.getTime() < saved.version.getTime()) return { epoch: row.epoch }
      const left = leftoverText(row.state, saved.values)
      if (!Object.keys(left).length) return { epoch: row.epoch }
      const [who] = await tx.select({ name: c.state }).from(c).where(eq(c.name, byName(t.name)))
      await putSideRow(tx, unsavedName(t.name), JSON.stringify({ by: who?.name ?? null, at: row.updatedAt.toISOString(), values: left }), saved.version)
    }
    const epoch = crypto.randomUUID()
    const state = encodeState(seedDocument(saved.values))
    await tx.insert(c).values({ name: t.name, epoch, state, baseVersion: saved.version, updatedAt: sql`now()`, activeAt: null })
      .onConflictDoUpdate({ target: c.name, set: { epoch, state, baseVersion: saved.version, updatedAt: sql`now()`, activeAt: null } })
    return { epoch }
  })
}

/** A side row (see the top of this file): a note kept next to the document. */
async function putSideRow(db: any, name: string, note: string, version: Date | null) {
  const c = useCms().reg.cmsCollab
  await db.insert(c).values({ name, epoch: crypto.randomUUID(), state: note, baseVersion: version, updatedAt: sql`now()`, activeAt: null })
    .onConflictDoUpdate({ target: c.name, set: { state: note, baseVersion: version, updatedAt: sql`now()` } })
}

/** Remember who typed last in a document (called as typing is stored). */
export async function noteCollabEditor(documentName: string, name: string): Promise<void> {
  const { db } = useCms()
  await putSideRow(db, byName(documentName), name, null)
}

export interface UnsavedText { by: string | null; at: string; values: Record<string, any> }

/**
 * Text left in the document by a tab that closed without saving, for this entry as
 * it is saved now (a later save makes it obsolete: gone), or null.
 */
export async function unsavedText(t: CollabTarget, savedVersion: Date | null): Promise<UnsavedText | null> {
  const { db, reg } = useCms()
  const c = reg.cmsCollab
  const [row] = await db.select({ state: c.state, baseVersion: c.baseVersion }).from(c).where(eq(c.name, unsavedName(t.name)))
  if (!row) return null
  if ((row.baseVersion?.getTime() ?? null) !== (savedVersion?.getTime() ?? null)) {
    await db.delete(c).where(eq(c.name, unsavedName(t.name)))
    return null
  }
  try {
    const note = JSON.parse(row.state)
    const keys = new Set(collabFields(t.entity, t.locale))
    const values = Object.fromEntries(Object.entries(note.values ?? {}).filter(([k]) => keys.has(k)))
    return Object.keys(values).length ? { by: note.by ?? null, at: String(note.at), values } : null
  }
  catch {
    return null
  }
}

/** Forget the left-over text (kept or discarded). */
export async function dropUnsavedText(t: CollabTarget): Promise<void> {
  const { db, reg } = useCms()
  await db.delete(reg.cmsCollab).where(eq(reg.cmsCollab.name, unsavedName(t.name)))
}

/**
 * After a save made from the shared document (the browser sends its epoch in
 * `X-CMS-Collab`): the document now matches this version of the entry.
 */
export async function noteCollabSave(event: any, t: { entity: CmsEntity; id: string; locale: string | null }, version: Date | string | null | undefined): Promise<void> {
  const epoch = getRequestHeader(event, 'x-cms-collab')
  if (!epoch || !UUID.test(epoch) || !version) return
  try {
    const { db, reg } = useCms()
    const c = reg.cmsCollab
    await db.update(c).set({ baseVersion: new Date(version) })
      .where(and(eq(c.name, collabName(t.entity.name, t.id, t.locale)), eq(c.epoch, epoch)))
  }
  catch (err) {
    console.error('[cms] collab: could not record the save', scrubError(err))
  }
}
