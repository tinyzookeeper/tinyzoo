// Server errors as one JSON line each (Pushbase indexes stdout), with the request id
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
      error: cause?.message || cause?.statusMessage || 'unknown',
      stack: typeof cause?.stack === 'string' ? cause.stack.split('\n').slice(0, 8).join('\n') : undefined,
    }))
  })
})
