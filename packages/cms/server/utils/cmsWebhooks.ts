import type { CmsChange } from '@my-cms/core'

/**
 * Publish webhooks: POST each public content change to the configured URLs so the
 * website can purge its cache (`cms.webhooks.urls`, env NUXT_CMS_WEBHOOKS_URLS — comma
 * separated; `cms.webhooks.secret` / NUXT_CMS_WEBHOOKS_SECRET signs them).
 *
 * Body: { delivery, type, entity, id, locale, public, paths, version, at } as JSON.
 * `delivery` is unique per change and the same on every retry: deduplicate on it
 * (it is inside the signed body, so a replay cannot pass as a new delivery).
 * Headers:
 *   X-CMS-Event      the change type, e.g. entry.published
 *   X-CMS-Delivery   the delivery id again, for logs
 *   X-CMS-Signature  t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${body}` with the secret>
 *
 * Verify by recomputing the HMAC over the raw body and rejecting a `t` older than a
 * few minutes. Up to 3 attempts (the 2nd 1 s after the 1st fails, the 3rd 5 s after
 * the 2nd); a 4xx answer other than 408/429 is final. Runs after the response and
 * only ever logs failures. In production nothing is sent without a secret.
 */
const RETRY_DELAYS_MS = [1_000, 5_000]
const TIMEOUT_MS = 5_000

export function webhookConfig(): { urls: string[]; secret: string } {
  const cfg = (useRuntimeConfig().cms as any)?.webhooks ?? {}
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

let warnedUnsigned = false

/** Send a change to every webhook URL. Never rejects. */
export async function sendWebhooks(change: CmsChange): Promise<void> {
  const { urls, secret } = webhookConfig()
  if (!urls.length) return
  if (!secret) {
    const production = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'
    if (!warnedUnsigned) {
      warnedUnsigned = true
      console.warn(production
        ? '[cms] webhooks are not sent: set NUXT_CMS_WEBHOOKS_SECRET'
        : '[cms] webhooks are sent unsigned (development) — set NUXT_CMS_WEBHOOKS_SECRET')
    }
    if (production) return
  }
  const delivery = crypto.randomUUID()
  // Who made the change stays inside the admin.
  const { by: _by, ...rest } = change
  const body = JSON.stringify({ delivery, ...rest })
  await Promise.all(urls.map((url) => deliver(url, secret, change.type, delivery, body).catch(() => {})))
}

/** A URL without its query string or credentials, for logs. */
function safeUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.origin + u.pathname
  }
  catch {
    return '(invalid url)'
  }
}

async function deliver(url: string, secret: string, type: string, delivery: string, body: string): Promise<void> {
  let lastError = ''
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]))
    try {
      const t = Math.floor(Date.now() / 1000)
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'user-agent': 'cms-webhooks/1',
        'x-cms-event': type,
        'x-cms-delivery': delivery,
      }
      if (secret) headers['x-cms-signature'] = `t=${t},v1=${await signWebhook(secret, t, body)}`
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
}
