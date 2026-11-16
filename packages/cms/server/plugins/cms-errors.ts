// Server errors as one JSON line each on stderr (Pushbase collects both streams), with the request id
// the user saw in X-Request-Id. Expected errors (4xx) are not logged, nor 503s (the
// API refusing work while migrations run or after they failed — logged once at start).
// The same errors run the `cms:error` hook for the host's error tracker (cmsErrors.ts).
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error: any, ctx: any) => {
    const status = error?.statusCode ?? error?.status ?? 500
    if (status < 500 || status === 503) return
    const event = ctx?.event
    const cause = error?.cause instanceof Error ? error.cause : error
    const requestId: string | null = event?.context?.requestId ?? null
    const method: string | null = event?.method ?? null
    const path: string | null = event?.path ? String(event.path).split('?')[0] ?? null : null
    const userId: string | null = event?.context?.cmsUser?.id ?? null
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
    reportCmsError({ source: 'request', error, status, requestId, method, path, userId }, event)
  })
})
