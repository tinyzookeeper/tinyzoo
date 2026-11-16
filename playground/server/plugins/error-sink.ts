import { appendFileSync } from 'node:fs'

// How a site forwards server errors: subscribe to the `cms:error` hook and send each
// report to the error tracker (see docs/deploying.md for a Sentry example). Here the
// "tracker" is a file, so the API tests can read what the hook delivered — active
// only when CMS_ERROR_SINK_FILE is set.
export default defineNitroPlugin((nitro) => {
  const file = process.env.CMS_ERROR_SINK_FILE
  if (!file) return
  nitro.hooks.hook('cms:error', (report) => {
    appendFileSync(file, JSON.stringify({ ...report, error: String((report.error as any)?.message ?? report.error) }) + '\n')
    // A hook that fails must never break the request or the task (tests set this).
    if (process.env.CMS_ERROR_SINK_THROW) throw new Error('the error tracker is down')
  })
})
