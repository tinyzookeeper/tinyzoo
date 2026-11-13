import { and, eq, inArray, type CmsChange, type CmsChangeType, type CmsEntity, type CmsRegistry } from '@my-cms/core'

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
  const l = reg.locales
  if (!l || !locale || l.prefix === 'none') return ''
  if (l.prefix === 'except-default' && locale === l.default) return ''
  return `/${locale}`
}

/** `content.path` filled in from a row ('/blog/:slug' → '/blog/hello'), or null when a part is empty. */
export function fillPath(template: string, row: Record<string, any>): string | null {
  let ok = true
  const out = template.replace(/:(\w+)/g, (_m, key: string) => {
    const v = row[key]
    if (v === null || v === undefined || v === '') ok = false
    return encodeURIComponent(String(v ?? ''))
  })
  return ok ? out : null
}

/** Placeholder keys of a path template ('/blog/:slug' → ['slug']). */
export const pathKeys = (template: string) => [...template.matchAll(/:(\w+)/g)].map((m) => m[1]!)

/**
 * What visitors can see of one entry right now: whether it is live (public
 * collection, and its `content.published` rule holds — the same rule the content
 * API applies, scheduling included) and its addresses in every language.
 */
export interface ChangeSnapshot { live: boolean; paths: { locale: string | null; path: string }[] }

export async function changeSnapshot(e: CmsEntity, id: string): Promise<ChangeSnapshot> {
  const none: ChangeSnapshot = { live: false, paths: [] }
  if (!e.content?.public) return none
  const { db, reg } = useCms()
  const keys = e.content.path && !e.singleton ? pathKeys(e.content.path).filter((k) => e.table[k]) : []
  const cols: Record<string, any> = { id: e.table.id }
  for (const k of keys) cols[k] = e.table[k]
  const [row] = await db.select(cols).from(e.table).where(both(eq(e.table.id, id), publishedCond(e)))
  if (!row) return none
  const out: ChangeSnapshot = { live: true, paths: [] }
  if (!keys.length) return out
  const defaultLocale = reg.locales?.default ?? null
  const base = fillPath(e.content.path!, row)
  if (base) out.paths.push({ locale: defaultLocale, path: localePrefix(reg, defaultLocale) + base })
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
      const p = fillPath(e.content.path!, merged)
      if (p) out.paths.push({ locale: tr.locale, path: localePrefix(reg, tr.locale) + p })
    }
  }
  return out
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
}

export async function reportChange(event: any, r: ReportChange): Promise<void> {
  try {
    const e = r.entity
    const locale = r.locale ?? null
    const deleted = r.type === 'entry.deleted'
    const before = r.before ?? { live: false, paths: [] }
    const after = deleted ? { live: false, paths: [] } : await changeSnapshot(e, r.id)
    // Only addresses a visitor could have reached, in the language the change is about.
    const paths = new Set<string>()
    for (const snap of [before, after]) {
      if (!snap.live) continue
      for (const p of snap.paths) if (!locale || p.locale === locale) paths.add(p.path)
    }
    const change: CmsChange = {
      type: r.type,
      entity: e.name,
      id: r.id,
      locale,
      public: before.live || after.live,
      paths: [...paths],
      by: event?.context?.cmsUser?.id ?? null,
      version: r.after?.updatedAt ? new Date(r.after.updatedAt).toISOString() : null,
      at: new Date().toISOString(),
    }
    applyChangeLocally(change)
    notifyChangeListeners(change)
    // Neither the other replicas nor the host's hooks hold up the response.
    const background: Promise<unknown>[] = [
      useCmsStore().then((store) => store.publish(CHANGES_CHANNEL, JSON.stringify({ origin: instanceId(), change })))
        .catch((err) => console.error('[cms] could not publish change', err)),
      Promise.resolve(useNitroApp().hooks.callHook('cms:change', change))
        .catch((err: unknown) => console.error('[cms] cms:change hook failed', err)),
    ]
    if (change.public) background.push(sendWebhooks(change))
    const all = Promise.all(background)
    if (typeof event?.waitUntil === 'function') event.waitUntil(all)
  }
  catch (err) {
    console.error('[cms] reporting a change failed', err)
  }
}

/** Clear what this instance derived from content the change touched. */
export function applyChangeLocally(change: Pick<CmsChange, 'entity'>): void {
  const { reg } = useCms()
  const e = reg.byName.get(change.entity)
  if (!e) return
  if ((e as any).preset === 'redirects') invalidateRedirects()
  if (e.content?.path) invalidateSitemap()
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
      console.error('[cms] change listener failed', err)
    }
  }
}
