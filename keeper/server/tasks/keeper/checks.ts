export default defineTask({
  meta: { name: 'keeper:checks', description: 'Uptime of every site (and its status when due)' },
  async run() {
    return { result: { sites: await runAllChecks() } }
  },
})
