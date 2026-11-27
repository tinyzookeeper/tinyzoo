import { setAdminTimeZone } from '../runtime'
import { forgetEntryPaths, forgetSettings } from './context'
import { flushViews, forgetConsentId } from './ingest'
import { countRobotPage, flushRobots } from './robots'

// The analytics plugin's Nitro plugin: the time zone days are counted in, what waits written
// when the server stops, the pages robots load, what is kept in memory forgotten when content
// changes, and the consent id of a visitor who takes statistics back removed from their views.
export default defineNitroPlugin((nitroApp) => {
  setAdminTimeZone((useAppConfig() as any)?.cms?.admin?.timeZone)
  nitroApp.hooks.hook('close', async () => {
    // Single mode: the one buffer. Multi mode: no current site here, so every site's buffer.
    await flushViews()
    await flushRobots()
  })
  // The pages robots load, counted after the response is sent (robots.ts): it never slows a page.
  nitroApp.hooks.hook('afterResponse', async (event: any) => {
    await countRobotPage(event).catch((err) => console.error('[cms] analytics: could not count a robot', scrubError(err)))
  })
  nitroApp.hooks.hook('cms:change', (change: any) => {
    // The hook runs inside the site whose content changed; outside a site there is nothing to forget.
    if (!currentCmsSite()) return
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
