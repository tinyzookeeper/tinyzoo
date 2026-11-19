export default defineTask({
  meta: { name: 'keeper:daily', description: 'Certificates, the newest tinyzoo release, old checks' },
  async run() {
    await runDaily()
    return { result: 'done' }
  },
})
