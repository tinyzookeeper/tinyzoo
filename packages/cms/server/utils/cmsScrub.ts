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
 * A mail server's refusal often names the address ("550 5.1.1 <jana@example.com>: Recipient
 * address rejected"): for the logs, anything that looks like an email becomes `<email>`.
 */
export function redactEmails(text: string): string {
  return text.replace(/[^\s<>"'(),;:@]+@[^\s<>"'(),;:@]+\.[^\s<>"'(),;:@]+/g, '<email>')
}

/** A copy of an error with everything it has (message, stack, causes, payload), taken before `hushError` changes the original. */
export function snapshotError<T>(err: T): T {
  if (!err || typeof err !== 'object') return err
  return Object.create(Object.getPrototypeOf(err), Object.getOwnPropertyDescriptors(err))
}

/**
 * Make an unhandled error safe for what prints it without us: Nitro writes
 * "[request error] [unhandled] [GET] <url>" and then the error itself (message, stack,
 * `cause` with a failed query's `params`) to stderr, and h3 has copied the failed query's
 * text, values included, into the message.
 *
 * Changed on the error itself, because that object is what gets printed (and what other
 * `error` hooks see afterwards): the message is the fixed "Server Error" — the same words
 * the client already gets for an unhandled error, so responses do not change —, the
 * causes are scrubbed copies (`scrubError`: driver message and frames, no values), `data`
 * is dropped, and the error is no longer marked `unhandled`/`fatal`, which is the only
 * thing that makes Nitro and h3 print it. The one line that is written is tinyzoo's own
 * JSON line (`cms-errors.ts`). Take a `snapshotError` first if the original is needed.
 */
export function hushError(err: any): void {
  if (!err || typeof err !== 'object') return
  const safe = scrubError(err)
  const set = (key: string, value: unknown) => { try { err[key] = value } catch { /* frozen: nothing more to do */ } }
  set('message', 'Server Error')
  set('stack', safe.stack?.replace(/^[^\n]*/, `${safe.name}: Server Error`))
  set('cause', safe.cause)
  set('data', undefined)
  set('unhandled', false)
  set('fatal', false)
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
