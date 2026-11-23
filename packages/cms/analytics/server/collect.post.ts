import { cleanUtm, sourceOf } from '../core/source'
import { cleanPath, countryFromHeaders, deviceOf, excludedPath, languageOf } from '../core/enrich'
import { parseUserAgent } from '../core/ua'
import { localDay, visitorHash } from '../core/visitor'
import { currentChoiceOf } from '../../consent/server/state'
import { consentDecision } from '../core/consent'
import { analyticsOptions, saltOf, serverAllowsCollecting, settingsAllowCollecting, siteTimeZone } from './context'
import { countryOfAddress } from './geoip'
import { MAX_ENGAGED_MS, queueEngagement, queueView } from './ingest'

// POST /api/content/_analytics/e — the website's tracker: a page view ({ v, p, r, u, w, l, lc }),
// or the time one was looked at ({ v, e }). Always answered 202 with nothing, at once: what is
// not counted (a robot, a signed-in editor, a preview, collecting switched off) is dropped
// without a word, and what is counted waits a few seconds and is written with others (ingest.ts).
//
// Nothing that identifies the visitor is kept: the address and the user agent only go into
// the day's hash (core/visitor.ts) and the country lookup, and are then forgotten.
//
// With a cookie banner (the consent plugin): in `mode: 'strict'` nothing is counted without the
// visitor's consent to statistics (the tracker does not send then either); in `mode: 'consent'`
// everyone is counted as above, and a visitor who allowed statistics also has the consent id of
// their cookie kept with the view (`consent_id`), for the reports among those who agreed.
const VIEW_ID = /^[A-Za-z0-9_-]{8,40}$/
const MAX_BODY = 4096

export default defineEventHandler(async (event) => {
  setResponseStatus(event, 202)
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    await take(event)
  }
  catch (err) {
    console.error('[cms] analytics: a visit could not be read', scrubError(err))
  }
  return ''
})

function ownHosts(event: any): string[] {
  const hosts = new Set<string>()
  // Many sites share the server in multi mode: the site's own hosts, not the request's.
  if (cmsIsMultiTenant()) for (const h of useCmsSite().hosts) hosts.add(h.replace(/^www\./, ''))
  const configured = String(cmsSettings().publicUrl || '')
  try { if (configured) hosts.add(new URL(configured).hostname.toLowerCase().replace(/^www\./, '')) }
  catch { /* not an address */ }
  if (!cmsIsMultiTenant()) hosts.add(getRequestURL(event).hostname.toLowerCase().replace(/^www\./, ''))
  return [...hosts]
}

async function take(event: any): Promise<void> {
  const opts = analyticsOptions()
  if (!serverAllowsCollecting()) return
  // Editors looking at their own website are not visitors.
  if (event.context.cmsUser) return
  const ua = getRequestHeader(event, 'user-agent') || ''
  const parsed = parseUserAgent(ua)
  if (parsed.bot) return
  if (opts.respectDoNotTrack && (getRequestHeader(event, 'dnt') === '1' || getRequestHeader(event, 'sec-gpc') === '1')) return
  // A page of this site only (browsers say where a POST comes from).
  const hosts = ownHosts(event)
  const origin = getRequestHeader(event, 'origin')
  if (origin) {
    let host = ''
    try { host = new URL(origin).hostname.toLowerCase().replace(/^www\./, '') }
    catch { return }
    if (!hosts.includes(host)) return
  }
  // A preview in the admin (?preview) is not a visit, whatever the page said.
  const referer = getRequestHeader(event, 'referer') || ''
  if (/[?&]preview(=|&|$)/.test(referer)) return

  const length = Number(getRequestHeader(event, 'content-length') || 0)
  if (length > MAX_BODY) return
  const raw = await readRawBody(event, 'utf8')
  if (!raw || raw.length > MAX_BODY) return
  let body: Record<string, any>
  try { body = JSON.parse(raw) }
  catch { return }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return
  if (typeof body.v !== 'string' || !VIEW_ID.test(body.v)) return

  const ip = clientIp(event)
  // Five a second from one address is more than a person clicks: the rest is dropped.
  if (!(await rateLimit(`analytics:${ip}`, 300, 60_000))) return
  if (!(await settingsAllowCollecting())) return

  // The consent cookie, read here on the server (same site): the browser sends it with the beacon.
  const { count, consentId } = consentDecision(opts.mode, opts.mode === 'cookieless' ? null : await currentChoiceOf(event))
  if (!count) return

  const now = new Date()
  const day = localDay(now, siteTimeZone())
  const visitor = visitorHash(await saltOf(day), hosts[0]!, ip, ua)

  // The time a view was looked at, sent when the visitor leaves it.
  if (body.p === undefined && typeof body.e === 'number') {
    if (body.e > 0) queueEngagement(body.v, visitor, Math.min(body.e, MAX_ENGAGED_MS))
    return
  }

  const path = cleanPath(body.p)
  if (!path || excludedPath(path, opts.excludePaths)) return
  const u = body.u && typeof body.u === 'object' ? body.u : {}
  const utm = { source: cleanUtm(u.s), medium: cleanUtm(u.m), campaign: cleanUtm(u.c) }
  const from = sourceOf(typeof body.r === 'string' ? body.r.slice(0, 1000) : null, hosts, utm)
  const { reg } = useCms()
  // The page's language (<html lang>: `cs` or `cs-CZ`), when it is one of the site's.
  const lang = typeof body.lc === 'string' ? body.lc.trim() : ''
  const locale = reg.locales?.locales.find((l) => l === lang || l === lang.split('-')[0]) ?? null
  const country = countryFromHeaders((name) => getRequestHeader(event, name), opts.countryHeaders)
    ?? await countryOfAddress(opts.geoipFile ?? process.env.NUXT_CMS_ANALYTICS_GEOIP_FILE ?? null, ip)

  queueView({
    at: now.getTime(),
    visitor,
    view: body.v,
    path,
    locale,
    referrerHost: from.referrerHost,
    source: from.source,
    internal: from.internal,
    utmSource: utm.source,
    utmMedium: utm.medium,
    utmCampaign: utm.campaign,
    country,
    device: deviceOf(body.w),
    browser: parsed.browser,
    os: parsed.os,
    language: languageOf(body.l),
    consentId,
    engagedMs: 0,
  })
}
