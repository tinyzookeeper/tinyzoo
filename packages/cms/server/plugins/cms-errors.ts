// Server errors as one JSON line each on stderr (Pushbase collects both streams), with the request id
// the user saw in X-Request-Id. Expected errors (4xx) are not logged, nor 503s (the
// API refusing work while migrations run or after they failed — logged once at start).
// The same errors run the `cms:error` hook for the host's error tracker (cmsErrors.ts).
//
// Nitro would also print an unhandled error itself, with a failed query's parameters (emails,
// form text, password hashes) and the request URL: this hook runs first and, in production,
// hushes the error (cmsScrub.ts `hushError`) so that only the JSON line below is written.
// The original is kept as `rawError` of the `cms:error` report. In development Nitro's own
// output stays: a developer wants the full message and a terminal is not a log store.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (thrown: any, ctx: any) => {
    const quiet = !import.meta.dev && !!thrown && typeof thrown === 'object' && (thrown.unhandled === true || thrown.fatal === true)
    const error = quiet ? snapshotError(thrown) : thrown
    if (quiet) hushError(thrown)
    const status = error?.statusCode ?? error?.status ?? 500
    // Expected errors stay out of the log — except as one short info line when Nitro's own
    // (error-looking, stack-printing) line for an unhandled one was just silenced: a 404 for
    // a mistyped address or a probe for a route that does not exist is not an error of ours.
    const expected = status < 500 || status === 503
    if (expected && !quiet) return
    const event = ctx?.event
    const cause = error?.cause instanceof Error ? error.cause : error
    const requestId: string | null = event?.context?.requestId ?? null
    const method: string | null = event?.method ?? null
    const path: string | null = event?.path ? String(event.path).split('?')[0] ?? null : null
    const userId: string | null = event?.context?.cmsUser?.id ?? null
    if (expected) {
      console.info(JSON.stringify({ level: 'info', msg: error?.statusMessage || 'Request refused', status, requestId, method, path, user: userId }))
      return
    }
    console.error(JSON.stringify({
      level: 'error',
      msg: error?.statusMessage || (error?.message ? safeErrorMessage(error) : 'Server error'),
      status,
      requestId,
      method,
      path,
      user: userId,
      error: safeErrorMessage(cause),
      stack: scrubError(cause).stack?.split('\n').slice(0, 8).join('\n'),
    }))
    if (!expected) reportCmsError({ source: 'request', error, status, requestId, method, path, userId }, event)
  })
})
