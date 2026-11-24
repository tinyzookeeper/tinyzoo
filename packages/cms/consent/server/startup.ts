import { forgetConsentSettings } from './state'

// The consent plugin's Nitro plugin: the settings kept in memory are forgotten when an editor saves them.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cms:change', (change: any) => {
    // The hook runs inside the site whose content changed; outside a site there is nothing to forget.
    if (!currentCmsSite()) return
    if (change?.entity === 'consent_settings') forgetConsentSettings()
  })
})
