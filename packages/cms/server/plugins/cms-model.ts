// A site's own content types (experimental; cmsCustomTypes.ts). Multi-tenant mode only, with
// NUXT_CMS_CUSTOM_TYPES=on: listen on the `model` channel of the shared store for changes of
// structure made on the OTHER instances. A site this process has loaded with an older model is
// retired, so its next request reads the new one (cmsModelChange.ts, `cmsModelMessage`).
//
// With the switch off this plugin does nothing at all.
export default defineNitroPlugin(() => {
  if (!cmsCustomTypesSwitch()) return
  if (!cmsIsMultiTenant()) {
    console.info('[cms] NUXT_CMS_CUSTOM_TYPES is on, but a site\'s own content types need multi-tenant mode (NUXT_CMS_TENANCY_MODE=multi) for now: they stay off')
    return
  }
  void (async () => {
    try {
      const store = await useCmsStore()
      await store.subscribe(MODEL_CHANNEL, (raw) => {
        try { cmsModelMessage(JSON.parse(raw)) }
        catch { /* not ours */ }
      })
    }
    catch (err) {
      console.error('[cms] could not listen for changes of content types from other instances', scrubError(err))
    }
  })()
})
