import type { CmsErrorReport } from 'tinyzoo'

/**
 * Error reporting for the host: besides the JSON log line, a server error runs the
 * `cms:error` Nitro hook (see CmsErrorReport), so a host plugin can forward it to
 * Sentry or anything else. Reporting never throws, never waits for the host's code
 * to finish before the response is gone, and a failing hook is only logged.
 */

/** Run the `cms:error` hook for one report, in the background. Never rejects. */
export function reportCmsError(report: Omit<CmsErrorReport, 'message' | 'error' | 'rawError'> & { error: unknown; message?: string }, event?: any): void {
  const { error: raw, ...rest } = report
  const error = scrubError(raw)
  const full: CmsErrorReport = { ...rest, error, rawError: raw, message: report.message ?? error.message }
  noteCmsErrorForStatus(full.source)
  const run = async () => {
    try {
      await useNitroApp().hooks.callHook('cms:error', full)
    }
    catch (err) {
      console.error('[cms] cms:error hook failed', safeErrorMessage(err))
    }
  }
  // After the response: the next turn of the event loop, and the platform is told to
  // keep a serverless worker alive until the host's code has finished.
  const done = new Promise<void>((resolve) => setTimeout(() => { run().finally(resolve) }, 0))
  if (typeof event?.waitUntil === 'function') event.waitUntil(done)
}

/** Run a scheduled task body; a failure is reported through `cms:error` (source 'task') and thrown again. */
export async function runReportedTask<T>(task: string, body: () => Promise<T>): Promise<T> {
  try {
    return await body()
  }
  catch (err) {
    const cause = (err as any)?.cause instanceof Error ? (err as any).cause : err
    console.error(JSON.stringify({ level: 'error', msg: 'cms task failed', task, error: safeErrorMessage(cause) }))
    reportCmsError({ source: 'task', error: err, status: null, requestId: null, method: null, path: null, userId: null, task })
    throw err
  }
}
