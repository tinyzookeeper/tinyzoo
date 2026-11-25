// A site's own content types (experimental; cmsCustomTypes.ts), with NUXT_CMS_CUSTOM_TYPES=on:
// listen on the `model` channel of the shared store for changes of structure made on the OTHER
// instances. A site this process has loaded with an older model is retired, so its next request
// reads the new one (cmsModelChange.ts, `cmsModelMessage`). In multi-tenant mode a message names
// its site; in single mode it is about the one site (two instances of one app).
//
// With the switch off this plugin does nothing at all.
import { MODEL_FILE_ASSET, MODEL_FILE_NAME } from 'tinyzoo'

export default defineNitroPlugin(() => {
  if (!cmsCustomTypesSwitch()) return
  // One build serves many sites: a model file of the build's own is no site's (cmsAppModelFile.ts is single mode's).
  if (cmsIsMultiTenant()) {
    void useStorage(`assets:${MODEL_FILE_ASSET}`).hasItem(MODEL_FILE_NAME).then((has) => {
      if (has) console.info(`[cms] multi-tenant mode: the build's own ${MODEL_FILE_NAME} is ignored (each site has its own content types)`)
    }, () => {})
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
