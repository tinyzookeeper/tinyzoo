// Scheduled publishing: entries whose publish date has just come are live already
// (every visibility check compares the date). This task tells the world: it reports
// them as published — webhooks (site cache), live updates, the cms:change hook.
export default defineTask({
  meta: { name: 'cms:scheduled', description: 'Announce scheduled entries that went live' },
  async run() {
    const announced = await runReportedTask('cms:scheduled', () => announceScheduled())
    return { result: { announced } }
  },
})
