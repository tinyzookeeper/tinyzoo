import type { CmsChange } from '@my-cms/core'

/**
 * Publish webhooks: POST each public content change to the configured URLs so the
 * website can purge its cache (`cms.webhooks.urls`, env NUXT_CMS_WEBHOOKS_URLS — comma
 * separated; `cms.webhooks.secret` / NUXT_CMS_WEBHOOKS_SECRET signs them).
 *
 * Body: the change as JSON ({ type, entity, id, locale, paths, at, … }).
 * Headers:
 *   X-CMS-Event      the change type, e.g. entry.published
 *   X-CMS-Delivery   a unique id per change (the same on every retry: deduplicate on it)
 *   X-CMS-Signature  t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${body}` with the secret>
 *
 * Verify by recomputing the HMAC over the raw body and rejecting a `t` older than a
 * few minutes. Delivery is attempted up to 3 times (now, +1 s, +5 s); a 4xx answer
 * other than 408/429 is final. It runs after the response (waitUntil where the
 * platform has it) and only ever logs failures.
 */
const RETRY_DELAYS_MS = [1_000, 5_000]
const TIMEOUT_MS = 5_000

export function webhookConfig(): { urls: string[]; secret: string } {
  const cfg = (useRuntimeConfig().cms as any)?.webhooks ?? {}
  const raw: string = Array.isArray(cfg.urls) ? cfg.urls.join(',') : String(cfg.urls || '')
  const urls = raw.split(/[\s,]+/).map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u))
  return { urls, secret: String(cfg.secret || '') }
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function signWebhook(secret: string, timestamp: number, body: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${body}`)))
}

let warnedUnsigned = false

export function sendWebhooks(event: any, change: CmsChange): void {
  const { urls, secret } = webhookConfig()
  if (!urls.length) return
  if (!secret && !warnedUnsigned) {
    warnedUnsigned = true
    console.warn('[cms] webhooks are sent unsigned — set NUXT_CMS_WEBHOOKS_SECRET')
  }
  const body = JSON.stringify(change)
  const delivery = crypto.randomUUID()
  const work = Promise.all(urls.map((url) => deliver(url, secret, change.type, delivery, body)))
  if (typeof event?.waitUntil === 'function') event.waitUntil(work)
  else void work
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
  console.error(JSON.stringify({ level: 'error', msg: 'cms webhook delivery failed', url: new URL(url).origin + new URL(url).pathname, type, delivery, error: lastError }))
}
