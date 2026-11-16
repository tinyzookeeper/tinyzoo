import { appendFileSync } from 'node:fs'

/** An error as plain data, causes included (an Error does not serialise its message). */
const dump = (e: unknown, depth = 0): unknown => e instanceof Error
  ? { name: e.name, message: e.message, stack: e.stack, cause: depth < 8 && e.cause ? dump(e.cause, depth + 1) : undefined }
  : String(e)

// How a site forwards server errors: subscribe to the `cms:error` hook and send each
// report to the error tracker (see docs/deploying.md for a Sentry example). Here the
// "tracker" is a file, so the API tests can read what the hook delivered — active
// only when CMS_ERROR_SINK_FILE is set.
export default defineNitroPlugin((nitro) => {
  const file = process.env.CMS_ERROR_SINK_FILE
  if (!file) return
  nitro.hooks.hook('cms:error', (report) => {
    // `rawError` may hold personal data; a real tracker plugin never sends it (see docs/deploying.md).
    const { rawError, ...rest } = report
    appendFileSync(file, JSON.stringify({ ...rest, error: dump(report.error), rawErrorKept: rawError !== undefined }) + '\n')
    // A hook that fails must never break the request or the task (tests set this).
    if (process.env.CMS_ERROR_SINK_THROW) throw new Error('the error tracker is down')
  })
})
