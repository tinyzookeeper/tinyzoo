/**
 * What the `cms:error` Nitro hook receives: a server error the host may want to send
 * to its error tracker (Sentry, GlitchTip, a Slack message…). Nothing in the package
 * talks to a vendor; the host subscribes in a server plugin:
 *
 *   export default defineNitroPlugin((nitro) => {
 *     nitro.hooks.hook('cms:error', (report) => Sentry.captureException(report.error, { tags: { source: report.source } }))
 *   })
 */
export interface CmsErrorReport {
  /** Where it happened: a request (5xx), a scheduled task, or a webhook delivery that gave up. */
  source: 'request' | 'task' | 'webhook'
  /**
   * The error as thrown. Careful: a failed database query's message carries the query's
   * bound values (emails, content) — report `message` when in doubt, or scrub it.
   */
  error: unknown
  /** The error's message without query values — safe to log and to send away. */
  message: string
  /** HTTP status of the failed request (5xx); null for tasks and webhooks. */
  status: number | null
  /** The `X-Request-Id` the browser got, for requests. */
  requestId: string | null
  method: string | null
  /** The request path, without its query string. */
  path: string | null
  /** The signed-in person's id (never their email), for requests. */
  userId: string | null
  /** The task name (`cms:scheduled`), when `source` is 'task'. */
  task?: string
  /** The webhook that failed, when `source` is 'webhook': its address (without query) and the change. */
  webhook?: { url: string; type: string; delivery: string }
}
