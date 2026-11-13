// Server errors as one JSON line each on stderr (Pushbase collects both streams), with the request id
// the user saw in X-Request-Id. Expected errors (4xx) are not logged, nor 503s (the
// API refusing work while migrations run or after they failed — logged once at start).
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error: any, ctx: any) => {
    const status = error?.statusCode ?? error?.status ?? 500
    if (status < 500 || status === 503) return
    const event = ctx?.event
    const cause = error?.cause instanceof Error ? error.cause : error
    console.error(JSON.stringify({
      level: 'error',
      msg: error?.statusMessage || error?.message || 'Server error',
      status,
      requestId: event?.context?.requestId ?? null,
      method: event?.method ?? null,
      path: event?.path ? String(event.path).split('?')[0] : null,
      user: event?.context?.cmsUser?.id ?? null,
      error: safeMessage(cause),
      stack: typeof cause?.stack === 'string' && !String(cause.message).startsWith('Failed query') ? cause.stack.split('\n').slice(0, 8).join('\n') : undefined,
    }))
  })
})

/**
 * The message without query parameters: drizzle's "Failed query: … params: …" would
 * put emails, password hashes or draft text in the log. The driver's own error (the
 * cause) says what went wrong without them.
 */
function safeMessage(err: any): string {
  const msg = String(err?.message || err?.statusMessage || 'unknown')
  if (!msg.startsWith('Failed query')) return msg
  const inner = err?.cause
  if (!inner?.message) return 'Query failed'
  return 'Query failed: ' + inner.message + (inner.code ? ' (' + inner.code + ')' : '')
}
