import { sql } from 'drizzle-orm'
import { excludedPath } from '../core/enrich'
import { ROBOT_DIMENSION, robotKey, robotOf } from '../core/robots'
import { localDay } from '../core/visitor'
import { analyticsOptionsOf } from '../options'
import { analyticsDaily } from '../tables'
import { serverAllowsCollecting, settingsAllowCollecting, siteTimeZone } from './context'

/**
 * The pages robots load (core/robots.ts), counted on the server after each response: a page of
 * the website (GET, 200, HTML) whose user agent is a robot's adds one to that robot's number of
 * the day. A person's page costs one look at its user agent and nothing else.
 *
 * Nothing about the request is kept but the robot's name: no address, no page, no user agent.
 * The numbers wait in memory per site and are added to `analytics_daily` every few seconds
 * (dimension `robot`, value `assistant:Claude`, the count in `pageviews`), so today's are there
 * at once. The nightly totals leave these rows alone (rollup.ts).
 */

/** Paths that are never a page of the website. */
const NOT_PAGES = ['/admin', '/api/', '/_nuxt/', '/__nuxt', '/_ipx/', '/_i18n/', '/favicon']
/** Kinds of robot one buffer holds at most (the names come from a fixed list, so this is far off). */
const MAX_KEYS = 500

const flushMs = (): number => {
  const v = Number(process.env.CMS_TEST_ANALYTICS_FLUSH_MS)
  return Number.isFinite(v) && v > 0 ? v : 10_000
}

interface Counts {
  site: string
  /** `day|value` → pages. */
  counts: Map<string, number>
  timer: ReturnType<typeof setTimeout> | null
  running: Promise<void> | null
}
const buffer = cmsSiteScoped<Counts>(() => ({ site: useCmsSite().id, counts: new Map(), timer: null, running: null }), {
  // A site unloaded while still served writes what waits; one that left the directory has no database here.
  dispose: async (b) => {
    if (b.timer) clearTimeout(b.timer)
    b.timer = null
    if (!b.counts.size) return
    const site = cmsSiteById(b.site)
    if (site) await runInCmsSite(site, () => write(b))
  },
})

/** Is this response a page of the website, as a robot would read it? */
function isPage(event: any): boolean {
  if (event.method !== 'GET') return false
  const res = event.node?.res
  if (!res || res.statusCode !== 200) return false
  const type = String(res.getHeader?.('content-type') ?? '')
  if (!type.startsWith('text/html')) return false
  const path = String(event.path || '/').split('?')[0]!
  return !NOT_PAGES.some((p) => path.startsWith(p))
}

/** After a response (the Nitro plugin's `afterResponse`): count it when a robot loaded a page. */
export async function countRobotPage(event: any): Promise<void> {
  // A person's browser, or not a page: done, without touching anything else.
  const robot = robotOf(event.node?.req?.headers?.['user-agent'])
  if (!robot || !isPage(event)) return
  // No site (multi mode, a request no site answered), or a site without the plugin.
  if (!currentCmsSite()) return
  const opts = analyticsOptionsOf(useCms().reg)
  if (!opts || !opts.countRobots || !serverAllowsCollecting()) return
  if (excludedPath(String(event.path || '/').split('?')[0]!, opts.excludePaths)) return
  if (!(await settingsAllowCollecting())) return
  const b = buffer()
  const key = `${localDay(new Date(), siteTimeZone())}|${robotKey(robot)}`
  if (!b.counts.has(key) && b.counts.size >= MAX_KEYS) return
  b.counts.set(key, (b.counts.get(key) ?? 0) + 1)
  if (b.timer) return
  // Started inside the site's request, so it fires inside the site.
  b.timer = setTimeout(() => { b.timer = null; void flushRobots() }, flushMs())
  ;(b.timer as any).unref?.()
}

/** Add what waits to `analytics_daily` (one write at a time). */
export async function flushRobots(): Promise<void> {
  // No current site (multi mode, the server stopping): every site writes its own.
  if (!currentCmsSite()) { await forEachCmsSite(() => flushRobots(), { what: 'writing robot counts' }); return }
  const b = buffer()
  while (b.running) await b.running
  if (!b.counts.size) return
  b.running = write(b).finally(() => { b.running = null })
  await b.running
}

async function write(b: Counts): Promise<void> {
  const entries = [...b.counts.entries()]
  b.counts.clear()
  const rows = entries.map(([key, pages]) => {
    const i = key.indexOf('|')
    return { day: key.slice(0, i), dimension: ROBOT_DIMENSION, value: key.slice(i + 1), pageviews: pages }
  })
  try {
    const { db } = useCms()
    const d = analyticsDaily
    await db.insert(d).values(rows).onConflictDoUpdate({
      target: [d.day, d.dimension, d.value],
      set: { pageviews: sql`${d.pageviews} + excluded.pageviews` },
    })
  }
  catch (err) {
    console.error('[cms] analytics: could not save robot counts', scrubError(err))
  }
}
