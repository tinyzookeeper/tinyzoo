import { propOf, type CmsChange, type CmsChangeType, type CmsEntity, type CmsRegistry } from '@my-cms/core'

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

/** Identifies this process on the shared channel, so it can skip its own messages. */
export const instanceId = crypto.randomUUID()

/** Is this stored row live on the website? Content without a publish workflow always is. */
export function isLiveRow(e: CmsEntity, row: Record<string, any> | null | undefined): boolean {
  if (!row) return false
  const p = e.publish
  if (!p) return true
  return row[propOf(p.field, e.fields[p.field]!)] === p.publishedValue
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

/** The website addresses of these versions of an entry, in `locale` (null = default language). */
export function entryPaths(reg: CmsRegistry, e: CmsEntity, rows: (Record<string, any> | null | undefined)[], locale: string | null): string[] {
  const template = e.content?.path
  if (!template || e.singleton) return []
  const lang = locale ?? reg.locales?.default ?? null
  const out = new Set<string>()
  for (const row of rows) {
    if (!row) continue
    const p = fillPath(template, row)
    if (p) out.add(localePrefix(reg, lang) + p)
  }
  return [...out]
}

export interface ReportChange {
  type: CmsChangeType
  entity: CmsEntity
  id: string
  /** The row before and after the write (either may be missing: create / delete). */
  before?: Record<string, any> | null
  after?: Record<string, any> | null
  locale?: string | null
  /** For translations: the translated values, overlaid on the entry to build its address. */
  translation?: Record<string, any> | null
}

export async function reportChange(event: any, r: ReportChange): Promise<void> {
  try {
    const { reg } = useCms()
    const e = r.entity
    const locale = r.locale ?? null
    const live = isLiveRow(e, r.before) || isLiveRow(e, r.after)
    const overlay = (row?: Record<string, any> | null) => {
      if (!row || !r.translation) return row
      const merged = { ...row }
      for (const [k, v] of Object.entries(r.translation)) if (v !== null && v !== undefined && v !== '') merged[k] = v
      return merged
    }
    const change: CmsChange = {
      type: r.type,
      entity: e.name,
      id: r.id,
      locale,
      public: !!e.content?.public && live,
      paths: entryPaths(reg, e, [overlay(r.before), overlay(r.after)], locale),
      by: event?.context?.cmsUser?.id ?? null,
      at: new Date().toISOString(),
    }
    applyChangeLocally(change)
    notifyChangeListeners(change)
    const store = await useCmsStore()
    await store.publish(CHANGES_CHANNEL, JSON.stringify({ origin: instanceId, change }))
      .catch((err) => console.error('[cms] could not publish change', err))
    await useNitroApp().hooks.callHook('cms:change', change).catch((err: unknown) => console.error('[cms] cms:change hook failed', err))
    if (change.public) sendWebhooks(event, change)
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
