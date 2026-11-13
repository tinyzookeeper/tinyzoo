// Listen for content changes saved on the OTHER replicas (shared store, `changes`
// channel) and clear this instance's caches built from that content. Changes saved
// here were applied when they were reported.
export default defineNitroPlugin(() => {
  void (async () => {
    try {
      const store = await useCmsStore()
      await store.subscribe(CHANGES_CHANNEL, (raw) => {
        try {
          const msg = JSON.parse(raw)
          if (msg?.origin === instanceId || !msg?.change?.entity) return
          applyChangeLocally(msg.change)
          notifyChangeListeners(msg.change)
        }
        catch { /* not ours */ }
      })
    }
    catch (err) {
      console.error('[cms] could not listen for changes from other instances', err)
    }
  })()
})
