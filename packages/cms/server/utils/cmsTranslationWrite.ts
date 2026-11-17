import { and, eq, isNull, ne, or, propOf, sql } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'
import { z } from 'zod'
import type { CmsUser } from './cmsSession'

/**
 * The admin's view of an entry in a translation language, with (publishing per language)
 * the state of every language: read off the entry before `translationFormRow` puts this
 * language's own state on its status and date.
 */
async function formResult(db: any, reg: CmsRegistry, e: CmsEntity, row: any, locale: string) {
  const states = e.publish?.perLocale ? (await translationStates(db, reg, e, [row])).get(row.id) : undefined
  const result = await translationFormRow(db, reg, e, row, locale)
  if (states) result.__states = states
  return result
}

/** The admin's view of one entry in a translation language (GET/PATCH response shape). */
export async function translationFormRow(db: any, reg: CmsRegistry, e: CmsEntity, row: any, locale: string) {
  const found = (await translationRows(db, e, [row.id], locale)).get(row.id)
  const tr = found ? upgradedCopy(e, found, { admin: true, recordId: row.id }) : found
  row.__defaults = Object.fromEntries(e.localized.map((k) => [k, row[k]]))
  for (const k of e.localized) row[k] = tr?.[k] ?? null
  row.__translated = !!tr && (!e.publish?.perLocale || hasTranslatedText(e, tr))
  // Publishing per language: the state of this language (its own, or the entry's while it follows
  // the default language), under the status and date keys the entry has, so the editor reads it as it reads the entry's.
  const p = e.publish
  if (p?.perLocale) {
    if (found) applyTranslationState(e, row, found)
    row.__stateOwn = found?.published !== null && found?.published !== undefined
  }
  // The translation's own version: what a translation save is checked against.
  row.__version = tr?.updatedAt ? new Date(tr.updatedAt).toISOString() : null
  return row
}

/** Nothing written: no text, no list items, no blocks (an emptied field means "use the default language"). */
function emptyTranslationValue(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') {
    const o = v as any
    if (o.type === 'doc') return !(o.content ?? []).some((n: any) => n?.type !== 'paragraph' || n.content?.length)
    return Object.keys(o).length === 0
  }
  return false
}

/** The state a language is in right now, as the entry's own status value: its own, or the entry's while it follows the default language. */
function effectiveStatus(e: CmsEntity, base: Record<string, any>, tr: Record<string, any> | undefined): unknown {
  const p = e.publish!
  if (tr && tr.published !== null && tr.published !== undefined) return tr.published ? p.publishedValue : p.draftValue
  return base[propOf(p.field, e.fields[p.field]!)]
}

/**
 * Per-language publishing: what a write to one language says about its state. The keys are
 * the entry's own (`publish.field`, and `publish.dateField`): the status is the published or
 * draft value, or null to follow the default language again; the date is when it goes live.
 * Leaving a key out leaves it as it is.
 */
interface StateWrite { touched: boolean; published?: boolean | null; date?: Date | null | undefined }
function readStateWrite(e: CmsEntity, body: Record<string, unknown>): StateWrite {
  const p = e.publish
  if (!p?.perLocale) return { touched: false }
  const statusKey = p.field
  const dateKey = p.dateField
  const out: StateWrite = { touched: false }
  if (statusKey in body) {
    const v = body[statusKey]
    if (v !== null && v !== p.publishedValue && v !== p.draftValue) {
      throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: [{ code: 'invalid_value', path: [statusKey], message: `Must be "${p.publishedValue}", "${p.draftValue}" or null (follow the default language)` }] })
    }
    out.touched = true
    out.published = v === null ? null : v === p.publishedValue
  }
  if (dateKey && dateKey in body) {
    const schema = z.object({ [dateKey]: (e.fields[dateKey]!.zod('update') as any).nullable().optional() })
    out.date = (parseOr422(schema, { [dateKey]: body[dateKey] }) as any)[dateKey] ?? null
    out.touched = true
  }
  return out
}

/** The condition "this language is not live" for writes by people who may not publish (the entry's own for the default language). */
function notLiveInLanguage(e: CmsEntity, user: CmsUser, locale: string): any {
  const p = e.publish
  if (!p?.perLocale || canPublish(user)) return notLiveCond(e, user)
  const status = localeView(e, e.table, locale)[propOf(p.field, e.fields[p.field]!)]
  return or(isNull(status), ne(status, p.publishedValue))
}

/**
 * Write the translation of one entry: only `.localized()` fields, empty = fall back to
 * the default language. Same access as editing the entry (row rules, and people who
 * cannot publish cannot change a live entry). The entry's own version (updatedAt) stays:
 * the translation has its own, so translating never conflicts with editing the entry
 * — but two people saving the same language do (X-CMS-Version, 409).
 */
export async function writeTranslation(event: any, e: CmsEntity, id: string, locale: string, user: CmsUser, rowFilter: any) {
  const { db, reg } = useCms()
  const t = e.localesTable
  if (!t) throw createError({ statusCode: 404, statusMessage: 'This content has nothing to translate' })

  const raw = (await readBody(event)) ?? {}
  assertFieldsEditable(e, user, bodyKeys(raw))
  // An emptied field means "use the default language".
  const cleaned = Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, v === '' ? null : v]))
  // Publishing per language: the state keys are not translated text.
  const stateIn = readStateWrite(e, cleaned)
  if (e.publish?.perLocale) {
    delete cleaned[e.publish.field]
    if (e.publish.dateField) delete cleaned[e.publish.dateField]
  }

  const [base] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!base) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  // The translation as it is now: blocks that are behind or of a type that is gone are only kept when stored already.
  const before = (await translationRows(db, e, [id], locale)).get(id)
  if (e.publish?.perLocale) {
    // Changing the text of a language that is live, like changing a live entry, is for people who may publish; so is any change of its state.
    assertPublishAllowed(e, user, stateIn.touched ? { [propOf(e.publish.field, e.fields[e.publish.field]!)]: e.publish.publishedValue } : {}, { [propOf(e.publish.field, e.fields[e.publish.field]!)]: effectiveStatus(e, base, before) })
  }
  else assertPublishAllowed(e, user, {}, base)
  const seenBefore = await changeSnapshot(e, id)
  const schema = z.object(Object.fromEntries(e.localized.map((k) => [k, (e.fields[k]!.zod('update', { stored: before?.[k] }) as any).nullable().optional()]))).strict()
  const data: Record<string, unknown> = parseOr422(schema, cleaned)
  const jsonKeys = e.localized.filter((k) => JSON_MEDIA_TYPES.has(e.fields[k]!.type) && k in data)
  const oldMedia = jsonKeys.flatMap((k) => jsonMediaIds(e.fields[k], before?.[k]))

  const baseTr = baseVersion(event)
  // Saving with nothing written is not translating: no empty row that would make the
  // language count as translated ("Missing: EN" and the publish warning must stay). An
  // existing translation emptied entirely is gone, as if removed.
  const merged: Record<string, unknown> = { ...(before ?? {}), ...data }
  // A language with a state of its own keeps its row, text or not (it has to hold the state).
  const p = e.publish
  const statePublished: boolean | null = !p?.perLocale ? null : stateIn.published !== undefined ? stateIn.published : (before?.published ?? null)
  const dateKept: Date | null = before?.publishedAt ?? null
  if (stateIn.date !== undefined && stateIn.published === undefined && statePublished === null) {
    throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: [{ code: 'invalid_value', path: [p!.dateField!], message: 'Set the status of this language together with its publish date' }] })
  }
  if (e.localized.every((k) => emptyTranslationValue(merged[k])) && statePublished === null) {
    if (before) {
      await assertCurrentVersion(e, { updatedAt: before.updatedAt, updatedBy: null }, baseTr)
      await deleteTranslation(event, e, id, locale, user, rowFilter)
    }
    const [bare] = await db.select().from(e.table).where(eq(e.table.id, id))
    await hydrateRowForForm(db, reg, e, bare)
    return stripUnreadable(e, user, await formResult(db, reg, e, bare, locale))
  }
  const { row, effect } = await db.transaction(async (tx: any) => {
    // A page tree: the tree lock before any row lock, in the order every tree write takes
    // them (moves and page saves lock the tree, then rows), or two writes can deadlock.
    if (e.tree) await lockTree(tx, e)
    // Touch the entry first, under the same rules as editing it — including "not
    // live" for people who cannot publish, re-checked here at write time (an editor
    // may have published it since we read it).
    // A no-op update: it locks the entry and re-checks access at write time.
    const [touched] = await tx.update(e.table).set({ updatedAt: sql`${e.table.updatedAt}` })
      .where(both(both(eq(e.table.id, id), rowFilter), notLiveInLanguage(e, user, locale))).returning({ id: e.table.id })
    if (!touched) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
    // The entry is locked now, so this is the translation as it stands.
    const [current] = await tx.select({ updatedAt: t.updatedAt }).from(t).where(and(eq(t.parentId, id), eq(t.locale, locale)))
    if (current) await assertCurrentVersion(e, { updatedAt: current.updatedAt, updatedBy: null }, baseTr)
    // A page tree: a translated address part (or a first translation) changes the address of the
    // page in this language and of every page below it.
    let writeTree: Awaited<ReturnType<typeof beginTreeWrite>> | null = null
    let wasLive = new Set<string>()
    const tp = e.tree ? treeProps(e) : null
    if (tp && (!current || (e.localized.includes(tp.slug) && tp.slug in data))) {
      // The parent and address part come from the tree under the lock, not from `base` (read before it).
      writeTree = await beginTreeWrite(tx, reg, e, (nodes) => {
        const node = nodes.find((n) => n.id === id)
        if (!node) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
        return {
          id, parentId: node.parentId, slug: node.slug, title: node.title ?? '',
          slugs: { [locale]: e.localized.includes(tp.slug) ? (data[tp.slug] as string | null | undefined) ?? null : null },
          locales: [...new Set([...(node.locales ?? []), locale])],
        }
      }, user)
      wasLive = await liveAmong(tx, e, subtreeIds(writeTree.nodes, id))
    }
    // A new version, never equal to the last one (clocks may differ between replicas).
    const now = new Date(Math.max(Date.now(), current ? new Date(current.updatedAt).getTime() + 1 : 0))
    // Publishing per language: the state in this write (stamping the publish date as an entry's is: the database's clock).
    const state: Record<string, unknown> = {}
    if (p?.perLocale && stateIn.touched) {
      state.published = statePublished
      const date = stateIn.date !== undefined ? stateIn.date : dateKept
      state.publishedAt = statePublished === null ? null
        : statePublished && p.dateField && date === null ? sql`date_trunc('milliseconds', clock_timestamp())` : date
    }
    const [saved] = await tx.insert(t).values({ parentId: id, locale, ...data, ...state, updatedAt: now })
      .onConflictDoUpdate({ target: [t.parentId, t.locale], set: { ...data, ...state, updatedAt: now } })
      .returning()
    const effect = writeTree ? await treeEffect(tx, reg, e, writeTree.nodes, writeTree.next, id, wasLive, actorId(user)) : null
    // A translated address part (or a first translation) may put the entry where a redirect leaves from: that one goes, in this transaction.
    if (e.content?.path && (!current || pathKeys(e.content.path).some((k) => k in data))) await dropRedirectsFromLiveAddresses(tx, reg, e, id)
    return { row: saved, effect }
  }).catch((err: unknown) => rethrowDbError(err, e, 'write'))

  if (oldMedia.length) {
    const still = new Set(jsonKeys.flatMap((k) => jsonMediaIds(e.fields[k], row[k])))
    const storage = useCmsStorage()
    for (const mid of new Set(oldMedia)) if (!still.has(mid)) await gcMediaIfOrphan(db, reg, storage, mid, gcScope(user))
  }
  // Publishing per language: a write that turned the language on or off is a publish or unpublish of it.
  let flip: 'entry.publish' | 'entry.unpublish' | null = null
  if (p?.perLocale && stateIn.touched) {
    const was = effectiveStatus(e, base, before) === p.publishedValue
    const is = effectiveStatus(e, base, row) === p.publishedValue
    if (was !== is) flip = is ? 'entry.publish' : 'entry.unpublish'
  }
  await audit(event, flip ?? 'entry.translate', { entity: e.name, recordId: id, meta: { locale } })
  await noteCollabSave(event, { entity: e, id, locale }, row.updatedAt)

  const [fresh] = await db.select().from(e.table).where(eq(e.table.id, id))
  await reportChange(event, {
    type: flip === 'entry.publish' ? 'entry.published' : flip === 'entry.unpublish' ? 'entry.unpublished' : 'translation.updated',
    entity: e, id, locale, before: seenBefore, after: { updatedAt: row.updatedAt }, moved: effect?.moved,
  })
  if (effect) await reportTreeRedirects(event, reg, effect.redirects)
  await hydrateRowForForm(db, reg, e, fresh)
  const result = stripUnreadable(e, user, await formResult(db, reg, e, fresh, locale))
  // Old addresses that now lead to the new one (a translated address part changed): told, so the editor knows.
  if (effect?.redirects.length) result.__redirects = effect.redirects.length
  return result
}

/** Remove one entry's translation (falls back to the default language again). */
export async function deleteTranslation(event: any, e: CmsEntity, id: string, locale: string, user: CmsUser, rowFilter: any) {
  const { db, reg } = useCms()
  const t = e.localesTable
  if (!t) throw createError({ statusCode: 404, statusMessage: 'This content has nothing to translate' })
  // Removing a translation removes every translated field of it: all must be the person's to change.
  assertFieldsEditable(e, user, e.localized)
  const [base] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!base) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  if (e.publish?.perLocale) {
    const current = (await translationRows(db, e, [id], locale)).get(id)
    assertPublishAllowed(e, user, {}, { [propOf(e.publish.field, e.fields[e.publish.field]!)]: effectiveStatus(e, base, current) })
  }
  else assertPublishAllowed(e, user, {}, base)
  const seenBefore = await changeSnapshot(e, id)
  const { gone, effect } = await db.transaction(async (tx: any) => {
    if (e.tree) await lockTree(tx, e) // the tree lock before the row lock, as every tree write takes them
    const [touched] = await tx.update(e.table).set({ updatedAt: sql`${e.table.updatedAt}` })
      .where(both(both(eq(e.table.id, id), rowFilter), notLiveInLanguage(e, user, locale))).returning({ id: e.table.id })
    if (!touched) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
    // A page tree: without its translation the page falls back to the default language's address
    // part, and so does every page below it.
    const tp = e.tree ? treeProps(e) : null
    let writeTree: Awaited<ReturnType<typeof beginTreeWrite>> | null = null
    let wasLive = new Set<string>()
    if (tp) {
      writeTree = await beginTreeWrite(tx, reg, e, (nodes) => {
        const node = nodes.find((n) => n.id === id)
        if (!node) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
        return {
          id, parentId: node.parentId, slug: node.slug, title: node.title ?? '',
          slugs: { [locale]: null },
          locales: (node.locales ?? []).filter((l) => l !== locale),
        }
      }, user)
      wasLive = await liveAmong(tx, e, subtreeIds(writeTree.nodes, id))
    }
    const [deleted]: any[] = await tx.delete(t).where(and(eq(t.parentId, id), eq(t.locale, locale))).returning()
    if (!deleted) throw createError({ statusCode: 404, statusMessage: 'No translation in this language' })
    const effect = writeTree ? await treeEffect(tx, reg, e, writeTree.nodes, writeTree.next, id, wasLive, actorId(user)) : null
    return { gone: deleted, effect }
  })
  const storage = useCmsStorage()
  for (const k of e.localized) {
    for (const mid of new Set(jsonMediaIds(e.fields[k], gone[k]))) await gcMediaIfOrphan(db, reg, storage, mid, gcScope(user))
  }
  await audit(event, 'entry.translation_delete', { entity: e.name, recordId: id, meta: { locale } })
  await dropCollabDocuments(e.name, id, locale)
  await dropTranslationRevisions(e, id, locale)
  await reportChange(event, { type: 'translation.deleted', entity: e, id, locale, before: seenBefore, after: null, moved: effect?.moved })
  if (effect) await reportTreeRedirects(event, reg, effect.redirects)
  return { ok: true }
}

/** Media referenced by all translations of an entry (for cleanup when it is deleted). */
export async function translationMediaIds(db: any, e: CmsEntity, id: string): Promise<string[]> {
  if (!e.localesTable) return []
  const rows: any[] = await db.select().from(e.localesTable).where(eq(e.localesTable.parentId, id))
  return rows.flatMap((r) => e.localized.flatMap((k) => jsonMediaIds(e.fields[k], r[k])))
}
