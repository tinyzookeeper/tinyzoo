/**
 * A 429 that says when to come back: `Retry-After` in seconds. The window is what is
 * known here (the oldest hit leaves it sooner, so this is the most a person waits), and
 * it lets a client, a script or the admin say "in 15 minutes" instead of guessing.
 */
export function tooManyRequests(event: any, message: string, windowMs: number) {
  setResponseHeader(event, 'Retry-After', Math.max(1, Math.ceil(windowMs / 1000)))
  return createError({ statusCode: 429, statusMessage: message })
}
