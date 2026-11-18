import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * How a receiver checks `X-CMS-Signature` (`t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`):
 * split on ",", take `t`, and accept the delivery when any `v1=` matches. The header may carry more
 * parts later (a second `v1=` while a secret is being changed, another scheme): an exact pattern
 * for the whole header would refuse those. `toleranceSeconds` keeps an old delivery from being replayed.
 */
export function verifyWebhookSignature(header: string | undefined, rawBody: string, secret: string, toleranceSeconds = 300, now = Date.now()): boolean {
  const parts = String(header ?? '').split(',').map((p) => p.trim())
  const t = parts.find((p) => p.startsWith('t='))?.slice(2) ?? ''
  if (!/^\d+$/.test(t) || Math.abs(now / 1000 - Number(t)) > toleranceSeconds) return false
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest()
  return parts.filter((p) => p.startsWith('v1=')).some((p) => {
    const given = Buffer.from(p.slice(3), 'hex')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}
