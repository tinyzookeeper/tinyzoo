import { and, eq, fillPathTemplate, indexTree, inArray, pathTemplateKeys, sitePath, sitePrefix, sql, type CmsChange, type CmsChangeType, type CmsEntity, type CmsRegistry } from 'tinyzoo'

/**
 * One place every content write reports to. A change:
 *
 *  - clears this instance's caches built from content (redirects, sitemap) at once;
 *  - is published on the shared store's `changes` channel, so the other replicas clear
 *    theirs too and the realtime hub can tell people looking at the same content;
 *  - runs the `cms:change` Nitro hook, for host apps that react in-process;
 *  - when it can change the public website, is sent to the configured webhooks
 *    (signed; see cmsWebhooks.ts) so the site can purge its cache.
 *
 * Reporting never fails the write that triggered it.
 */
export const CHANGES_CHANNEL = 'changes'

/**
 * Identifies this process on the shared channel, so it can skip its own messages.
 * Made on first use.
 */
let _instanceId: string | undefined
export function instanceId(): string {
  return (_instanceId ??= crypto.randomUUID())
}

/** The address prefix of a language ('/en'), per `defineLocales({ prefix })`. */
export function localePrefix(reg: CmsRegistry, locale: string | null): string {
  return sitePrefix(reg.locales, locale)
}

/** A path template filled in from a row ('/blog/:slug' → '/blog/hello'), or null when a part is empty. */
export const fillPath = fillPathTemplate

/** Placeholder keys of `content.path` (every language's, for a per-language map). */
export const pathKeys = pathTemplateKeys

/**
 * What visitors can see of one entry right now: whether it is live (public
 * collection, and its `content.published` rule holds — the same rule the content
 * API applies, scheduling included) and its addresses in every language.
 */
export interface ChangeSnapshot {
  /** Live (for an entity that publishes per language: in the default language, which gates every other, so in at least one). */
  live: boolean
  /** Only for an entity that publishes per language: the languages it is live in. */
  locales?: string[]
  /**
   * `fallback`: a language that follows the default one without a translation of its own (only for
   * an entity that publishes per language). It is served, so it is purged when a change is about that
   * language; it is not part of "the address changed" or of a change to the entry itself.
   */
  paths: { locale: string | null; path: string; fallback?: boolean }[]
  /** Page tree: which of the entry and everything below it are live (the entry's own pages' addresses are in `paths`). */
  liveIds?: string[]
}

/**
 * In a page tree an entry's reach is its whole subtree: unpublishing, moving or renaming
 * it changes what visitors see of every page below it, so `paths` lists theirs too.
 */
async function treeSnapshot(db: any, e: CmsEntity, id: string): Promise<ChangeSnapshot> {
  const { reg } = useCms()
  const nodes = await loadTreeNodes(db, reg, e)
  const ids = subtreeIds(nodes, id)
  const live = await liveAmong(db, e, ids)
  const index = indexTree(nodes)
  const paths = ids.filter((i) => live.has(i)).flatMap((i) => treeVersions(reg, e, index, i).map((v) => ({ locale: v.locale, path: v.loc })))
  return { live: live.has(id), paths, liveIds: [...live] }
}

export async function changeSnapshot(e: CmsEntity, id: string, tx?: any): Promise<ChangeSnapshot> {
  const none: ChangeSnapshot = { live: false, paths: [] }
  if (!e.content?.public) return none
  const { db: appDb, reg } = useCms()
  const db = tx ?? appDb
  if (e.tree) return treeSnapshot(db, e, id)
  const keys = !e.singleton ? pathKeys(e.content.path).filter((k) => e.table[k]) : []
  const cols: Record<string, any> = { id: e.table.id }
  for (const k of keys) cols[k] = e.table[k]
  if (perLocalePublishing(e) && reg.locales) return localeSnapshot(db, e, id, keys, cols)
  const [row] = await db.select(cols).from(e.table).where(both(eq(e.table.id, id), publishedCond(e)))
  if (!row) return none
  const out: ChangeSnapshot = { live: true, paths: [] }
  if (!keys.length) return out
  const defaultLocale = reg.locales?.default ?? null
  const base = sitePath(reg.locales, e.content.path, defaultLocale, row)
  if (base) out.paths.push({ locale: defaultLocale, path: base })
  const t = e.localesTable
  const others = reg.locales?.locales.filter((l) => l !== defaultLocale) ?? []
  if (t && others.length) {
    const tcols: Record<string, any> = { locale: t.locale }
    for (const k of keys) if (e.localized.includes(k)) tcols[k] = t[k]
    const rows: any[] = await db.select(tcols).from(t).where(and(eq(t.parentId, id), inArray(t.locale, others)))
    for (const tr of rows) {
      // Untranslated parts of the address fall back to the default language.
      const merged = { ...row }
      for (const k of keys) if (tr[k] !== null && tr[k] !== undefined && tr[k] !== '') merged[k] = tr[k]
      const p = sitePath(reg.locales, e.content.path, tr.locale, merged)
      if (p) out.paths.push({ locale: tr.locale, path: p })
    }
  }
  return out
}

/**
 * The snapshot of an entry that publishes per language: which languages it is live in, and
 * the address in each of them — a language without a translation row of its own too, marked
 * `fallback` (it is served through the default language, and is purged when that language
 * is what changed).
 */
async function localeSnapshot(db: any, e: CmsEntity, id: string, keys: string[], cols: Record<string, any>): Promise<ChangeSnapshot> {
  const { reg } = useCms()
  const languages = reg.locales!.locales
  const defaultLocale = reg.locales!.default
  languages.forEach((l, i) => { cols[`live${i}`] = sql<boolean>`coalesce(${publishedCond(e, l) ?? sql`true`}, false)` })
  const [row] = await db.select(cols).from(e.table).where(eq(e.table.id, id))
  const live = row ? languages.filter((_, i) => row[`live${i}`] === true) : []
  if (!live.length) return { live: false, paths: [] }
  const out: ChangeSnapshot = { live: true, locales: live, paths: [] }
  if (!keys.length) return out
  const translated = new Map<string, any>()
  const t = e.localesTable
  const others = live.filter((l) => l !== defaultLocale)
  if (t && others.length) {
    const tcols: Record<string, any> = { locale: t.locale }
    for (const k of keys) if (e.localized.includes(k)) tcols[k] = t[k]
    const rows: any[] = await db.select(tcols).from(t).where(and(eq(t.parentId, id), inArray(t.locale, others)))
    for (const tr of rows) translated.set(tr.locale, tr)
  }
  for (const l of live) {
    const merged = { ...row }
    const tr = translated.get(l)
    // Untranslated parts of the address fall back to the default language.
    if (tr) for (const k of keys) if (tr[k] !== null && tr[k] !== undefined && tr[k] !== '') merged[k] = tr[k]
    const p = sitePath(reg.locales, e.content!.path, l, merged)
    if (p) out.paths.push({ locale: l, path: p, ...(l !== defaultLocale && !tr ? { fallback: true } : {}) })
  }
  return out
}

/** Did what visitors could reach change: live or not, or the address in some language? */
export function addressesDiffer(before: ChangeSnapshot, after: ChangeSnapshot): boolean {
  const key = (s: ChangeSnapshot) => JSON.stringify(s.live ? s.paths.filter((p) => !p.fallback).map((p) => `${p.locale ?? ''}=${p.path}`).sort() : null)
  return key(before) !== key(after)
}

export interface ReportChange {
  type: CmsChangeType
  entity: CmsEntity
  id: string
  /** What visitors saw before the write (changeSnapshot); omit for a new entry. */
  before?: ChangeSnapshot | null
  /** The row after the write, for its version. */
  after?: Record<string, any> | null
  /** The language a translation change is about. */
  locale?: string | null
  /** Page tree: addresses that moved with this write (see `CmsChange.moved`). */
  moved?: { id: string; locale: string | null; from: string; to: string }[]
  /** Nothing was saved (a scheduled entry went live): no revision. */
  noRevision?: boolean
}

export async function reportChange(event: any, r: ReportChange): Promise<void> {
  try {
    const e = r.entity
    const locale = r.locale ?? null
    const deleted = r.type === 'entry.deleted'
    // Publishing per language: a change about one language is public when that language is live.
    const liveFor = (snap: ChangeSnapshot) => (locale && snap.locales ? snap.locales.includes(locale) : snap.live)
    const before = r.before ?? { live: false, paths: [] }
    const after = deleted ? { live: false, paths: [] } : await changeSnapshot(e, r.id)
    // Only addresses a visitor could have reached, in the language the change is about.
    const paths = new Set<string>()
    // Publishing per language: a language that went live or off. Its address is purged even where it is only served through the default language, and what links to it reads differently.
    const languageFlipped = !!locale && liveFor(before) !== liveFor(after)
    // (The default language gates every other: when it goes live or off, the languages it takes along are in `before` and
    // `after` as live ones, so a change to it names each of their addresses. A language served only through the default
    // language, with no row of its own, is `fallback` and stays out of a change to the default language, as it always did.)
    for (const snap of [before, after]) {
      if (!snap.live) continue
      for (const p of snap.paths) if (locale ? p.locale === locale && (!p.fallback || languageFlipped) : !p.fallback) paths.add(p.path)
    }
    // Links follow their target: when this entry's address (or whether it can be reached at
    // all) changed, everything that links to it reads differently now. Those pages go in
    // `paths`, and the public globals (menus, settings) that link to it are named in `globals`:
    // whatever shows them — usually every page — is stale too.
    const globals = new Set<string>()
    const { db, reg } = useCms()
    const addressChanged = !deleted && !!e.content?.path && !e.singleton && (addressesDiffer(before, after) || languageFlipped)
    // An entry that went live at an address a redirect leaves from would be hidden by it: the redirect goes.
    // (Writes that can do it in their own transaction have done so already; this catches every other path.)
    if (addressChanged && after.live) {
      await dropRedirectsFrom(db, reg, after.paths.map((p) => p.path)).catch((err) => console.error('[cms] could not remove redirects from the new addresses', scrubError(err)))
    }
    if (addressChanged && hasLinkFields(reg)) {
      // In a page tree the whole subtree changed address (or went away) with the entry: what links to any of those pages reads differently too.
      const ids = new Set([r.id, ...(r.moved ?? []).map((m) => m.id), ...(before.liveIds ?? []), ...(after.liveIds ?? [])])
      for (const dep of await linksTo(db, reg, e, [...ids], 50).catch(() => [])) {
        const target = reg.byName.get(dep.entity)
        if (!target?.content?.public || (dep.locale && locale && dep.locale !== locale)) continue
        if (target.singleton) globals.add(target.name)
        else for (const p of (await changeSnapshot(target, dep.id)).paths) if (!locale || p.locale === locale) paths.add(p.path)
      }
    }
    const change: CmsChange = {
      type: r.type,
      entity: e.name,
      id: r.id,
      locale,
      public: liveFor(before) || liveFor(after),
      paths: [...paths],
      ...(globals.size ? { globals: [...globals] } : {}),
      ...(r.moved?.length ? { moved: r.moved } : {}),
      by: event?.context?.cmsUser?.id ?? null,
      version: r.after?.updatedAt ? new Date(r.after.updatedAt).toISOString() : null,
      at: new Date().toISOString(),
    }
    // What was saved, for the history (not for deletions).
    if (!r.noRevision && r.type !== 'entry.deleted' && r.type !== 'translation.deleted') {
      await recordRevision(event, e, r.id, locale && (r.type === 'translation.updated' || r.type === 'entry.published' || r.type === 'entry.unpublished') ? locale : null, r.type)
    }
    // The search index follows every write (its own failure never stops the rest).
    if (r.type !== 'global.updated') {
      await syncSearchIndex(e, r.id, r.type).catch((err) => console.error('[cms] could not update the search index', scrubError(err)))
    }
    applyChangeLocally(change)
    notifyChangeListeners(change)
    // Neither the other replicas nor the host's hooks hold up the response.
    const background: Promise<unknown>[] = [
      useCmsStore().then((store) => store.publish(CHANGES_CHANNEL, JSON.stringify({ origin: instanceId(), change })))
        .catch((err) => console.error('[cms] could not publish change', scrubError(err))),
      Promise.resolve(useNitroApp().hooks.callHook('cms:change', change))
        .catch((err: unknown) => console.error('[cms] cms:change hook failed', scrubError(err))),
    ]
    if (change.public) background.push(sendWebhooks(change))
    const all = Promise.all(background)
    if (typeof event?.waitUntil === 'function') event.waitUntil(all)
  }
  catch (err) {
    console.error('[cms] reporting a change failed', scrubError(err))
  }
}

/** Clear what this instance derived from content the change touched. */
export function applyChangeLocally(change: Pick<CmsChange, 'entity'>): void {
  const { reg } = useCms()
  const e = reg.byName.get(change.entity)
  if (!e) return
  if ((e as any).preset === 'redirects') invalidateRedirects()
  // A page's address moved or it went away: redirects to it (stored as a reference) point somewhere else now.
  if (e.content?.path) {
    invalidateSitemap()
    invalidateRedirects()
  }
}

const listeners = new Set<(change: CmsChange) => void>()

/** Run `fn` for every change — saved here or on another replica. Returns an unsubscribe function. */
export function onCmsChange(fn: (change: CmsChange) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function notifyChangeListeners(change: CmsChange): void {
  for (const fn of listeners) {
    try {
      fn(change)
    }
    catch (err) {
      console.error('[cms] change listener failed', scrubError(err))
    }
  }
}
