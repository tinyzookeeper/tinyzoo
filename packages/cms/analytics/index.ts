/**
 * Website analytics, as a plugin (`tinyzoo/analytics`): how many people visit the site, what
 * they read and where they come from, in the site's own admin. No cookies, nothing stored in
 * the browser and no address kept, so the site needs no consent banner for it.
 *
 *   // cms.config.ts
 *   import { analyticsPlugin } from 'tinyzoo/analytics'
 *
 *   export const plugins = [analyticsPlugin({ keepRawDays: 90 })]
 *
 * What the plugin brings:
 *  - a small tracker in the website's pages (an app plugin, no dependencies) that sends a page
 *    view on load and on every route change, and the time the page was looked at;
 *  - `POST /api/content/_analytics/e`, which answers at once and writes in batches;
 *  - the tables `analytics_events` (raw views, kept `keepRawDays`) and `analytics_daily`
 *    (totals per day, kept), made by the site's next `tinyzoo generate` migration;
 *  - the Analytics page in the admin, a card on its home page and a panel in the entry editor;
 *  - the settings `analytics_settings`, where an administrator stops and restarts collecting.
 *
 * The docs: docs/analytics.md.
 */
import { defineSingleton } from '../src/entity'
import { f } from '../src/fields'
import { defineCmsPlugin, pluginFile, type CmsPlugin } from '../src/plugin'
import pkg from '../package.json'
import { ANALYTICS_MESSAGES } from './messages'
import { type AnalyticsOptions, type ResolvedAnalyticsOptions, resolveAnalyticsOptions } from './options'
import { analyticsRetention } from './rollup'
import { ANALYTICS_TABLES_SOURCE, analyticsDaily, analyticsEvents } from './tables'

export type { AnalyticsOptions } from './options'
export { analyticsDaily, analyticsEvents } from './tables'
export { dailyRollups, type DailyRollup } from './rollup'

/** Administrators switch collecting off and on; everyone else may only see whether it runs. */
const adminOnly = ({ user }: { user: { base?: string | null; role?: string } }) => (user?.base ?? user?.role) === 'admin'

/**
 * The plugin's settings: whether visits are collected. Switching off stops collecting and keeps
 * what was collected. (`NUXT_CMS_ANALYTICS_ENABLED=false` stops it on the server, whatever this says.)
 *
 * @internal
 */
export const AnalyticsSettings = defineSingleton('analytics_settings', {
  label: { en: 'Counting visits', cs: 'Počítání návštěv', de: 'Besuchszählung' },
  description: {
    en: 'Whether the website counts its visits. Without cookies; nobody is recognised from one day to the next.',
    cs: 'Zda web počítá návštěvy. Bez cookies; nikoho nelze poznat z jednoho dne na druhý.',
    de: 'Ob die Website ihre Besuche zählt. Ohne Cookies; niemand wird von einem Tag zum nächsten wiedererkannt.',
  },
  icon: 'i-lucide-chart-line',
  titleField: 'collect',
  fields: {
    collect: f.boolean({ default: true })
      .label({ en: 'Count visits', cs: 'Počítat návštěvy', de: 'Besuche zählen' })
      .help({
        en: 'Off: the website stops counting. What it counted so far stays in the reports.',
        cs: 'Vypnuto: web přestane počítat. Co už napočítal, v přehledech zůstane.',
        de: 'Aus: Die Website hört auf zu zählen. Was bisher gezählt wurde, bleibt in den Berichten.',
      }),
  },
  access: { update: adminOnly as any },
} as any)

/** The plugin, with its options for the server (`analyticsOptionsOf(reg)`). @internal */
export type AnalyticsPlugin = CmsPlugin & { readonly analytics: ResolvedAnalyticsOptions }

/** The plugin: the tracker, the endpoint, the tables, the reports. */
export function analyticsPlugin(options: AnalyticsOptions = {}): CmsPlugin {
  const resolved = resolveAnalyticsOptions(options)
  const file = (p: string) => pluginFile(import.meta.url, p)
  const plugin = defineCmsPlugin({
    name: 'analytics',
    version: pkg.version,
    singletons: [AnalyticsSettings],
    tables: [analyticsEvents, analyticsDaily],
    tablesSource: ANALYTICS_TABLES_SOURCE,
    components: file('./components'),
    appPlugins: [{ src: file('./app/tracker.client.ts'), mode: 'client' }],
    serverPlugins: [file('./server/startup.ts')],
    serverHandlers: [
      // The tracker's address: neutral, so a blocker's list of tracking words does not stop it.
      { method: 'post', contentPath: '_analytics/e', handler: file('./server/collect.post.ts') },
      { method: 'get', route: '/stats', handler: file('./server/stats.get.ts') },
      { method: 'get', route: '/live', handler: file('./server/live.get.ts') },
      { method: 'get', route: '/summary', handler: file('./server/summary.get.ts') },
      { method: 'get', route: '/entry', handler: file('./server/entry.get.ts') },
    ],
    adminPages: [{ path: '', file: file('./pages/index.vue') }],
    navItems: [{ label: { en: 'Analytics', cs: 'Návštěvnost', de: 'Besucherstatistik' }, icon: 'i-lucide-chart-line', page: '' }],
    dashboardWidgets: [{ component: 'AnalyticsHomeCard', order: 10 }],
    entityPanels: [{ component: 'AnalyticsEntryPanel', label: { en: 'Visits', cs: 'Návštěvy', de: 'Besuche' } }],
    hooks: { retention: analyticsRetention(resolved) },
    i18n: ANALYTICS_MESSAGES,
  })
  return Object.freeze({ ...plugin, analytics: resolved }) as AnalyticsPlugin
}
