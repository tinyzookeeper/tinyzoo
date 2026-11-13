import type { CmsChange } from '@my-cms/core'

// Listen for content changes saved on the OTHER replicas (shared store, `changes`
// channel) and clear this instance's caches built from that content. Changes saved
// here were applied when they were reported.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', () => closeCmsStore())
  void (async () => {
    try {
      const store = await useCmsStore()
      await store.subscribe(CHANGES_CHANNEL, (raw) => {
        try {
          const msg = JSON.parse(raw)
          if (msg?.origin === instanceId()) return
          const change = validChange(msg?.change)
          if (!change) return
          applyChangeLocally(change)
          notifyChangeListeners(change)
        }
        catch { /* not ours */ }
      })
    }
    catch (err) {
      console.error('[cms] could not listen for changes from other instances', err)
    }
  })()
})

const TYPES = new Set(['entry.created', 'entry.updated', 'entry.deleted', 'entry.published', 'entry.unpublished', 'translation.updated', 'translation.deleted', 'global.updated'])
const str = (v: unknown, max = 200) => (typeof v === 'string' && v.length <= max ? v : null)

/** A change as another replica sent it, rebuilt field by field (it may reach browsers). */
function validChange(c: any): CmsChange | null {
  if (!c || !TYPES.has(c.type) || !str(c.entity, 64) || !str(c.id, 64)) return null
  return {
    type: c.type,
    entity: c.entity,
    id: c.id,
    locale: str(c.locale, 20),
    public: c.public === true,
    paths: Array.isArray(c.paths) ? c.paths.filter((p: unknown) => str(p, 2000)).slice(0, 50) : [],
    by: str(c.by, 64),
    version: str(c.version, 40),
    at: str(c.at, 40) ?? new Date().toISOString(),
  }
}
