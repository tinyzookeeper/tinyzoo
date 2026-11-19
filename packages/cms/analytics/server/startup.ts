import { setAdminTimeZone } from '../runtime'
import { forgetEntryPaths, forgetSettings } from './context'
import { flushViews } from './ingest'

// The analytics plugin's Nitro plugin: the time zone days are counted in, what waits written
// when the server stops, and what is kept in memory forgotten when content changes.
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
})
