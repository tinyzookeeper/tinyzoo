// Retention (GDPR): delete form submissions and audit entries past their time
// (defineForm `retentionDays`, `cms.retention.auditDays`). Runs daily; one instance at
// a time. `npx nitro task run cms:retention` runs it by hand.
//
// Multi-tenant mode: every site, a few at a time and a pause between one site and the next
// (so thousands of sites are not all opened at once), and a run still going when the next day's
// starts is not joined by it.

/** The pause between one site and the next, in each of the few at a time. */
const SPREAD_MS = () => cmsTimerMs('CMS_TEST_RETENTION_PAUSE_MS', 1000)
const CONCURRENCY = 5

export default defineTask({
  meta: { name: 'cms:retention', description: 'Delete form submissions and audit entries past their retention' },
  async run() {
    // Outside a request there is no site: run it in each (one site in single mode).
    const results: unknown[] = []
    if (!cmsIsMultiTenant()) {
      await runReportedTask('cms:retention', async () => {
        await forEachCmsSite(async () => { results.push(await runRetention()) }, { concurrency: CONCURRENCY, what: 'retention' })
      })
      // One site: its own result, as before.
      return { result: results[0] ?? { skipped: 'another instance is running it' } }
    }
    if (retentionRound.running) {
      console.warn('[cms] retention: the previous run is still going, this one is skipped')
      return { result: { skipped: 'the previous run is still going' } }
    }
    retentionRound.running = true
    let started = 0
    let failed = 0
    try {
      await runReportedTask('cms:retention', async () => {
        failed = (await forEachCmsSite(async () => {
          if (started++ >= CONCURRENCY) await new Promise((r) => setTimeout(r, SPREAD_MS()))
          results.push(await runRetention())
        }, { concurrency: CONCURRENCY, what: 'retention' })).length
      })
    }
    finally {
      retentionRound.running = false
    }
    return { result: { sites: results.filter(Boolean).length, skipped: results.filter((r) => !r).length, failed } }
  },
})
