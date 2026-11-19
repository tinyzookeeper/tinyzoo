import { setAdminTimeZone } from '../runtime'
import { forgetEntryPaths, forgetSettings } from './context'
import { flushViews, forgetConsentId } from './ingest'

// The analytics plugin's Nitro plugin: the time zone days are counted in, what waits written
// when the server stops, what is kept in memory forgotten when content changes, and the consent
// id of a visitor who takes statistics back removed from their views.
export default defineNitroPlugin((nitroApp) => {
  setAdminTimeZone((useAppConfig() as any)?.cms?.admin?.timeZone)
  nitroApp.hooks.hook('close', async () => {
    await flushViews()
  })
  nitroApp.hooks.hook('cms:change', (change: any) => {
    // An address may have changed (a new slug, a page moved, an entry published or deleted).
    if (change?.paths?.length) forgetEntryPaths()
    if (change?.entity === 'analytics_settings') forgetSettings()
  })
  // The consent plugin's choice endpoint (only there in modes with a cookie banner).
  nitroApp.hooks.hook('cms:consent' as any, async (c: { consentId?: string; withdrawn?: string[] }) => {
    if (!c?.consentId || !c.withdrawn?.includes('analytics')) return
    await forgetConsentId(c.consentId).catch((err) => console.error('[cms] analytics: could not forget a consent id', scrubError(err)))
  })
})
