import type { AnalyticsLive, SiteLive, TrafficItem, TrafficTotals } from '#keeper/types/traffic'

/**
 * Today, live. A site on tinyzoo 1.6+ answers GET /api/content/_analytics/live (read with the
 * status token): visitors in the last 5 minutes, today so far by hour, today's top lists and
 * yesterday up to the same time. Keeper asks only while someone looks (a page, the MCP server)
 * and keeps each answer 20 s, so a site hears from it at most about 3 times a minute however
 * many people watch. Nothing of it is stored: a day's final numbers come with its totals the
 * night after (traffic.ts).
 */

const LIVE_TTL_MS = 20_000
const LIVE_TIMEOUT_MS = 8_000
const DEFAULT_LIVE_PATH = '/api/content/_analytics/live'

type LiveSite = Pick<typeof schema.sites.$inferSelect, 'id' | 'url' | 'status' | 'tokenEnc'>

const cache = new Map<string, { at: number; value: Promise<SiteLive> }>()

const zero = (): TrafficTotals => ({ visitors: 0, visits: 0, pageviews: 0, bounces: 0, engagedMs: 0 })
const num = (v: unknown): number => Math.max(0, Math.round(Number(v) || 0))
const totals = (t: any): TrafficTotals => ({ visitors: num(t?.visitors), visits: num(t?.visits), pageviews: num(t?.pageviews), bounces: num(t?.bounces), engagedMs: num(t?.engagedMs) })
const items = (list: unknown): TrafficItem[] => (Array.isArray(list) ? list : []).slice(0, 10).map((i: any) => ({
  value: String(i?.value ?? '').slice(0, 500),
  ...(i?.title ? { title: String(i.title).slice(0, 300) } : {}),
  visitors: num(i?.visitors),
  visits: num(i?.visits),
  pageviews: num(i?.pageviews),
}))

/** A site's today without an answer: not counting, or why it could not be read. */
export function emptyLive(available: boolean, error: string | null = null, update = false): SiteLive {
  return {
    available, error, ...(update ? { update } : {}), at: null, timeZone: null, day: null, hour: null, active: 0,
    totals: zero(), yesterdaySoFar: zero(), hours: [], pages: [], sources: [], countries: [], devices: [],
  }
}

/** The site's answer in Keeper's shape, checked and trimmed. */
export function liveOf(body: AnalyticsLive): SiteLive {
  const today = body.today ?? ({} as AnalyticsLive['today'])
  return {
    available: true,
    error: null,
    at: typeof body.at === 'string' ? body.at : new Date().toISOString(),
    timeZone: typeof body.timeZone === 'string' ? body.timeZone : null,
    day: typeof body.day === 'string' ? body.day : null,
    hour: Number.isInteger(body.hour) ? body.hour : null,
    active: num(body.active),
    totals: totals(today),
    yesterdaySoFar: totals(body.yesterdaySoFar),
    hours: (Array.isArray(body.hours) ? body.hours : []).slice(0, 24).map((h) => ({ hour: Math.min(23, num(h?.hour)), visitors: num(h?.visitors), pageviews: num(h?.pageviews) })),
    pages: items(today.pages),
    sources: items(today.sources),
    countries: items(today.countries),
    devices: items(today.devices),
  }
}

async function fetchLive(site: LiveSite): Promise<SiteLive> {
  if (!hasAnalytics(site.status)) return emptyLive(false)
  const token = decryptSecret(site.tokenEnc)
  if (!token) return emptyLive(true, 'Keeper has no status token for this site.')
  const target = new URL(site.status?.analytics?.livePath || DEFAULT_LIVE_PATH, site.url)
  let res: Response
  try {
    res = await fetch(target, {
      headers: { 'accept': 'application/json', 'user-agent': 'tinyzoo-keeper (+live)', 'x-api-key': token },
      signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
      redirect: 'follow',
    })
  }
  catch (err: any) {
    return emptyLive(true, err?.name === 'TimeoutError' ? 'The site took too long to answer.' : 'The site could not be reached.')
  }
  if (res.status === 404) return emptyLive(true, 'Today’s visits show live once the site runs tinyzoo 1.6 or newer.', true)
  if (res.status === 401) return emptyLive(true, 'The site did not accept the status token.')
  if (res.status === 429) return emptyLive(true, 'The site asked Keeper to slow down for a minute.')
  if (!res.ok) return emptyLive(true, `The site answered HTTP ${res.status}.`)
  const body = await res.json().catch(() => null) as AnalyticsLive | null
  if (!body || body.format !== 'tinyzoo-analytics-live') return emptyLive(true, 'The site’s answer is not one Keeper knows.')
  if (body.version !== 1) return emptyLive(true, 'The site shares today in a newer format; update Keeper.')
  return liveOf(body)
}

/** A site's today: from the last 20 s when someone asked already, else from the site. Never throws. */
export function siteLive(site: LiveSite): Promise<SiteLive> {
  const now = Date.now()
  const hit = cache.get(site.id)
  if (hit && now - hit.at < LIVE_TTL_MS) return hit.value
  const value = fetchLive(site).catch(() => emptyLive(true, 'Today’s visits could not be read.'))
  cache.set(site.id, { at: now, value })
  // An old entry of a site nobody looks at any more goes in time.
  if (cache.size > 500) for (const [id, e] of cache) if (now - e.at > LIVE_TTL_MS) cache.delete(id)
  return value
}

/** Today of several sites at once, by site id. */
export async function sitesLive(sites: LiveSite[]): Promise<Map<string, SiteLive>> {
  const answers = await Promise.all(sites.map(async (s) => [s.id, await siteLive(s)] as const))
  return new Map(answers)
}
