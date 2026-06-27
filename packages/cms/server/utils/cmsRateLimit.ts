// Sliding-window rate limiter keyed by an arbitrary string.
//
// NB: per-process, in-memory state. Fine for single-instance Node. For multiple
// instances or Cloudflare Workers this won't coordinate — back it with KV / a
// Durable Object / Redis there. The map is bounded by the number of distinct
// keys (≈ active users), which is small for an admin tool.
const hits = new Map<string, number[]>()

/**
 * Returns true if the action is allowed and records it; false if `key` has
 * already used `max` slots within `windowMs`. `max <= 0` means unlimited.
 */
export function rateLimitOk(key: string, max: number, windowMs: number): boolean {
  if (max <= 0) return true
  const now = Date.now()
  const cutoff = now - windowMs
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff)
  if (recent.length >= max) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}
