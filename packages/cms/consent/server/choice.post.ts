import { desc, eq } from 'drizzle-orm'
import { actionOf, CONSENT_COOKIE, CONSENT_ID, consentCookieString, consentDate, decodeConsent, encodeConsent, newConsentId, normalizeChoice, withdrawnFrom, type ConsentChoice } from '../core/cookie'
import { consentLog } from '../tables'
import { consentOptions, currentConsentVersion } from './state'

// POST /api/content/_consent/choice — a visitor chose ({ id?, choice: { analytics: true, … },
// version }). Writes one record to the consent log (the consent id, the time, the choice, the
// version of the texts and what it was: given, changed or withdrawn; no address, no browser)
// and sets the cookie, from the server so browsers keep it as long as it says. Tells the rest
// of the site through the Nitro hook `cms:consent` (the analytics plugin forgets the consent
// id of someone who takes statistics back).
//
// Open to everyone by design; only from this site's own pages, limited per address.
const WINDOW = 10 * 60_000
const MAX_BODY = 2048

function ownOrigins(event: any): Set<string> {
  const own = new Set([getRequestURL(event).origin])
  const configured = String(cmsSettings().publicUrl || '').replace(/\/+$/, '')
  try { if (configured) own.add(new URL(configured).origin) }
  catch { /* not an address */ }
  return own
}

/** Is `origin` this site's own? Many sites share the server in multi mode: then its hosts and its address count, not the request's. */
function fromOwnSite(event: any, origin: string): boolean {
  if (!cmsIsMultiTenant()) return ownOrigins(event).has(origin)
  try {
    if (useCmsSite().hosts.includes(cmsNormalHost(new URL(origin).host))) return true
    const configured = String(cmsSettings().publicUrl || '')
    return !!configured && new URL(configured).origin === origin
  }
  catch { return false }
}

/** HTTPS, or a production server behind a proxy that does not say so (only plain HTTP to localhost is not). */
function secureRequest(event: any): boolean {
  if (getRequestProtocol(event, { xForwardedProto: true }) === 'https') return true
  const host = getRequestURL(event).hostname
  return process.env.NODE_ENV === 'production' && !['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)
}

export default defineEventHandler(async (event) => {
  const opts = consentOptions()
  setResponseHeader(event, 'cache-control', 'no-store')
  const origin = getRequestHeader(event, 'origin')
  if (origin && !fromOwnSite(event, origin)) throw createError({ statusCode: 403, statusMessage: 'Choices are accepted from this site only' })

  const ip = clientIp(event)
  if (!(await rateLimit(`consent:${ip}`, 30, WINDOW))) throw tooManyRequests(event, 'Too many choices; try again in a few minutes', WINDOW)

  const length = Number(getRequestHeader(event, 'content-length') || 0)
  if (length > MAX_BODY || getRequestHeader(event, 'transfer-encoding')) throw createError({ statusCode: 413, statusMessage: 'Too large for a choice' })
  const body = (await readBody(event).catch(() => null)) as Record<string, any> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw createError({ statusCode: 400, statusMessage: 'Send the choice as JSON' })
  const choice = normalizeChoice(body.choice, opts.keys)
  if (!choice) {
    throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: [{ path: ['choice'], message: `A yes or no (true / false) for: ${opts.keys.join(', ')}` }] })
  }
  if (body.id !== undefined && body.id !== null && (typeof body.id !== 'string' || !CONSENT_ID.test(body.id))) {
    throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: [{ path: ['id'], message: 'Not a consent id' }] })
  }
  const current = await currentConsentVersion()
  // The texts the visitor answered: the version their page showed, never one that does not exist yet.
  const asked = Number(body.version)
  const version = Number.isInteger(asked) && asked >= 1 && asked <= current ? asked : current

  // The same consent id for as long as the visitor keeps the cookie: their changes are one history.
  const id: string = body.id ?? decodeConsent(getCookie(event, CONSENT_COOKIE))?.id ?? newConsentId()
  const { db } = useCms()
  const [prev]: any[] = await db.select({ choice: consentLog.choice, version: consentLog.version }).from(consentLog)
    .where(eq(consentLog.consentId, id)).orderBy(desc(consentLog.at), desc(consentLog.id)).limit(1)
  const previous = prev ? { choice: (prev.choice ?? {}) as ConsentChoice, version: Number(prev.version) } : null
  const action = actionOf(previous, choice, version)
  await db.insert(consentLog).values({ consentId: id, action, choice, version })

  const withdrawn = withdrawnFrom(previous?.choice, choice)
  try {
    await useNitroApp().hooks.callHook('cms:consent' as any, { consentId: id, choice, previous: previous?.choice ?? null, withdrawn, action })
  }
  catch (err) {
    console.error('[cms] consent: a listener of cms:consent failed', scrubError(err))
  }

  const value = encodeConsent({ id, version, date: consentDate(new Date()), choice })
  appendResponseHeader(event, 'set-cookie', consentCookieString(value, { days: opts.cookieDays, secure: secureRequest(event) }))
  return { id, action, version, cookie: value }
})
