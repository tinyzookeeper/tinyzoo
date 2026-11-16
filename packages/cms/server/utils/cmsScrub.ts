import { createHash } from 'node:crypto'

/**
 * What may be logged or sent to an error tracker: messages without query values, error
 * copies without their payload, and webhook addresses without their secret. Pure
 * functions with no Nitro globals, so the unit tests can load them.
 */

/**
 * The message without query parameters: drizzle's "Failed query: … params: …" would
 * put emails, password hashes or draft text in the log. The driver's own error (the
 * innermost cause) says what went wrong without them. h3 copies the message of the
 * error it wraps, so the chain can hold several "Failed query" layers.
 */
export function safeErrorMessage(err: any): string {
  const msg = String(err?.message || err?.statusMessage || 'unknown')
  if (!msg.startsWith('Failed query')) return msg
  let inner = err?.cause
  for (let depth = 0; depth < 8 && inner && String(inner.message ?? '').startsWith('Failed query'); depth++) inner = inner.cause
  if (!inner?.message) return 'Query failed'
  return 'Query failed: ' + inner.message + (inner.code ? ' (' + inner.code + ')' : '')
}

/**
 * A copy of the error that is safe to send away: the message is `safeErrorMessage`, the
 * stack keeps its frames (file names and line numbers, no values), and the causes are
 * copied the same way (to a depth of 5). Everything else on the original — `data`, a
 * driver's `detail`, query parameters — is left behind.
 */
export function scrubError(err: unknown, depth = 0): Error {
  if (!err || typeof err !== 'object') return new Error(typeof err === 'string' ? err : 'unknown')
  const src = err as any
  const copy = new Error(safeErrorMessage(src), depth < 5 && src.cause ? { cause: scrubError(src.cause, depth + 1) } : undefined)
  if (typeof src.name === 'string') copy.name = src.name
  const frames = typeof src.stack === 'string' ? src.stack.split('\n').filter((l: string) => /^\s+at\s/.test(l)) : []
  copy.stack = [`${copy.name}: ${copy.message}`, ...frames].join('\n')
  return copy
}

/**
 * A webhook address for logs and the `cms:error` hook: the origin and a short hash of the
 * path — no credentials, no query, and no path, because Slack, Discord and similar
 * services keep their secret in it (`/services/T000/B000/XXXX`). The hash still tells two
 * webhooks on the same host apart.
 */
export function safeUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : `/…#${createHash('sha256').update(u.pathname).digest('hex').slice(0, 8)}`
    return u.origin + path
  }
  catch {
    return '(invalid url)'
  }
}
