// Retention (GDPR): delete form submissions and audit entries past their time
// (defineForm `retentionDays`, `cms.retention.auditDays`). Runs daily; one instance at
// a time. `npx nitro task run cms:retention` runs it by hand.
export default defineTask({
  meta: { name: 'cms:retention', description: 'Delete form submissions and audit entries past their retention' },
  async run() {
    // Outside a request there is no site: run it in each (one site in single mode).
    const results: unknown[] = []
    await runReportedTask('cms:retention', async () => {
      await forEachCmsSite(async () => { results.push(await runRetention()) }, { concurrency: 5, what: 'retention' })
    })
    // One site: its own result, as before.
    if (!cmsIsMultiTenant()) return { result: results[0] ?? { skipped: 'another instance is running it' } }
    return { result: { sites: results.filter(Boolean).length, skipped: results.filter((r) => !r).length } }
  },
})
