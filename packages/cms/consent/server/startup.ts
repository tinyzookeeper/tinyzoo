import { forgetConsentSettings } from './state'

// The consent plugin's Nitro plugin: the settings kept in memory are forgotten when an editor saves them.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cms:change', (change: any) => {
    if (change?.entity === 'consent_settings') forgetConsentSettings()
  })
})
