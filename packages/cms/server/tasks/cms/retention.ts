// Retention (GDPR): delete form submissions and audit entries past their time
// (defineForm `retentionDays`, `cms.retention.auditDays`). Runs daily; one instance at
// a time. `npx nitro task run cms:retention` runs it by hand.
export default defineTask({
  meta: { name: 'cms:retention', description: 'Delete form submissions and audit entries past their retention' },
  async run() {
    const result = await runReportedTask('cms:retention', () => runRetention())
    return { result: result ?? { skipped: 'another instance is running it' } }
  },
})
