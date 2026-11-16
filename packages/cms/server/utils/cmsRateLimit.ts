// Sliding-window rate limiter keyed by an arbitrary string.
//
// Per-process, in-memory state: the fallback when Redis is not configured or cannot
// answer (see rateLimit in cmsStore.ts, which shares counts between replicas).
//
// Memory is bounded: keys are capped in length, and once the map grows past
// MAX_KEYS, expired entries are swept and, if still too many, the oldest dropped —
// so a flood of distinct keys cannot grow the heap without limit.
const hits = new Map<string, number[]>()
const MAX_KEYS = 10_000
const MAX_KEY_LENGTH = 200

function sweep(now: number, windowMs: number) {
  for (const [k, times] of hits) {
    if (!times.length || times[times.length - 1]! <= now - windowMs) hits.delete(k)
  }
  // Still too many live keys: drop the oldest (Map keeps insertion order).
  for (const k of hits.keys()) {
    if (hits.size <= MAX_KEYS * 0.9) break
    hits.delete(k)
  }
}

/**
 * Returns true if the action is allowed and records it; false if `key` has
 * already used `max` slots within `windowMs`. `max <= 0` means unlimited.
 */
export function rateLimitOk(key: string, max: number, windowMs: number): boolean {
  if (max <= 0) return true
  const k = key.length > MAX_KEY_LENGTH ? key.slice(0, MAX_KEY_LENGTH) : key
  const now = Date.now()
  const cutoff = now - windowMs
  const recent = (hits.get(k) ?? []).filter((t) => t > cutoff)
  if (recent.length >= max) {
    hits.set(k, recent)
    return false
  }
  recent.push(now)
  hits.delete(k) // re-insert so the most recently used key is the newest
  hits.set(k, recent)
  if (hits.size > MAX_KEYS) sweep(now, windowMs)
  return true
}

/** Number of tracked keys (for tests and diagnostics). */
export function rateLimitKeyCount(): number {
  return hits.size
}

/**
 * The client's IP from `X-Forwarded-For`, trusting exactly `trustedHops` proxies in
 * front of the app. Each proxy appends the address it saw, so the client is the
 * entry `trustedHops` places from the end — never the first entry, which the client
 * can write itself. With no trusted proxies, the socket address is used.
 */
export function pickClientIp(xff: string | undefined, socketIp: string | undefined, trustedHops: number): string {
  if (trustedHops <= 0 || !xff) return socketIp || 'unknown'
  const chain = xff.split(',').map((s) => s.trim()).filter(Boolean)
  const ip = chain[chain.length - trustedHops]
  return (ip || chain[0] || socketIp || 'unknown').slice(0, 64)
}

/** Hits for `key` in the last `windowMs`, counting this one (memory store). */
export function rateLimitCount(key: string, windowMs: number): number {
  const k = key.length > MAX_KEY_LENGTH ? key.slice(0, MAX_KEY_LENGTH) : key
  const now = Date.now()
  const recent = (hits.get(k) ?? []).filter((t) => t > now - windowMs)
  recent.push(now)
  hits.delete(k)
  hits.set(k, recent)
  if (hits.size > MAX_KEYS) sweep(now, windowMs)
  return recent.length
}

/** Take back one hit of `key` (memory store): a sign-in that succeeded is not an attempt to guess. */
export function rateLimitRefundMemory(key: string, windowMs: number): void {
  const k = key.length > MAX_KEY_LENGTH ? key.slice(0, MAX_KEY_LENGTH) : key
  const recent = (hits.get(k) ?? []).filter((t) => t > Date.now() - windowMs)
  recent.pop()
  if (recent.length) hits.set(k, recent)
  else hits.delete(k)
}
