import { CMS_WEBHOOK_HEADERS, webhookPayload, type CmsChange } from 'tinyzoo'

/**
 * Publish webhooks: POST each public content change to the configured URLs so the
 * website can purge its cache (`cms.webhooks.urls`, env NUXT_CMS_WEBHOOKS_URLS — comma
 * separated; `cms.webhooks.secret` / NUXT_CMS_WEBHOOKS_SECRET signs them).
 *
 * Body (`CmsWebhookPayload`): { delivery, type, entity, id, locale, public, paths, globals?, moved?,
 * version, at } as JSON.
 * `paths` are the website addresses to purge (old and new); `globals` the public globals that
 * read differently now; in a page tree `moved` lists each address that changed with the write,
 * `[{ id, locale, from, to }]`, the page's subpages included.
 * `delivery` is unique per change and the same on every retry: deduplicate on it
 * (it is inside the signed body, so a replay cannot pass as a new delivery).
 * Headers (`CMS_WEBHOOK_HEADERS`):
 *   X-CMS-Event      the change type, e.g. entry.published
 *   X-CMS-Delivery   the delivery id again, for logs
 *   X-CMS-Signature  t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${body}` with the secret>
 *
 * Verify by recomputing the HMAC over the raw body and rejecting a `t` older than a
 * few minutes. Up to 3 attempts (the 2nd 1 s after the 1st fails, the 3rd 5 s after
 * the 2nd); a 4xx answer other than 408/429 is final. Runs after the response and
 * only ever logs failures. In production nothing is sent without a secret.
 */
const RETRY_DELAY_MS = 1_000
/** The 2nd attempt after the first delay, the 3rd after five times as long (the test build shortens it: CMS_TEST_WEBHOOK_RETRY_MS). */
const retryDelays = (): number[] => { const first = cmsTimerMs('CMS_TEST_WEBHOOK_RETRY_MS', RETRY_DELAY_MS); return [first, first * 5] }
const TIMEOUT_MS = 5_000

export function webhookConfig(): { urls: string[]; secret: string } {
  const cfg = cmsSettings().webhooks ?? {}
  const raw: string = Array.isArray(cfg.urls) ? cfg.urls.join(',') : String(cfg.urls || '')
  const urls = raw.split(/[\s,]+/).map((u) => u.trim()).filter((u) => {
    try {
      const url = new URL(u)
      return url.protocol === 'http:' || url.protocol === 'https:'
    }
    catch {
      return false
    }
  })
  return { urls, secret: String(cfg.secret || '') }
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function signWebhook(secret: string, timestamp: number, body: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${body}`)))
}

const warnedUnsigned = cmsProcessWide({ done: false }, 'one log line per process')

/** Send a change to every webhook URL. Never rejects. */
export async function sendWebhooks(change: CmsChange): Promise<void> {
  // Read now, inside the site: the retries run later, from timers.
  const { urls, secret } = webhookConfig()
  if (!urls.length) return
  if (!secret) {
    const production = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'
    if (!warnedUnsigned.done) {
      warnedUnsigned.done = true
      console.warn(production
        ? '[cms] webhooks are not sent: set NUXT_CMS_WEBHOOKS_SECRET'
        : '[cms] webhooks are sent unsigned (development) — set NUXT_CMS_WEBHOOKS_SECRET')
    }
    if (production) return
  }
  const delivery = crypto.randomUUID()
  // Who made the change stays inside the admin (webhookPayload leaves `by` out).
  const body = JSON.stringify(webhookPayload(change, delivery))
  await Promise.all(urls.map((url) => deliver(url, secret, change.type, delivery, body).catch(() => {})))
}

async function deliver(url: string, secret: string, type: string, delivery: string, body: string): Promise<void> {
  let lastError = ''
  const delays = retryDelays()
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, delays[attempt - 1]))
    try {
      const t = Math.floor(Date.now() / 1000)
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'user-agent': 'cms-webhooks/1',
        [CMS_WEBHOOK_HEADERS.event]: type,
        [CMS_WEBHOOK_HEADERS.delivery]: delivery,
      }
      if (secret) headers[CMS_WEBHOOK_HEADERS.signature] = `t=${t},v1=${await signWebhook(secret, t, body)}`
      const res = await fetch(url, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
      // Drain the body so the connection can be reused.
      await res.arrayBuffer().catch(() => {})
      if (res.ok) return
      lastError = `HTTP ${res.status}`
      if (res.status >= 300 && res.status < 500 && res.status !== 408 && res.status !== 429) break
    }
    catch (err) {
      lastError = (err as Error)?.message || String(err)
    }
  }
  console.error(JSON.stringify({ level: 'error', msg: 'cms webhook delivery failed', url: safeUrl(url), type, delivery, error: lastError }))
  reportCmsError({
    source: 'webhook', error: new Error(`Webhook delivery failed: ${lastError}`), status: null, requestId: null, method: null, path: null, userId: null,
    webhook: { url: safeUrl(url), type, delivery },
  })
}
