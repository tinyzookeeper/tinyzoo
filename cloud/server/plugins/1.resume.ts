// When the server starts: pick up what was mid-way (sites being made or removed), and start
// the ready sites that are not running. In the background: requests are served meanwhile.
export default defineNitroPlugin(() => {
  void migrationsReady()
    .then(() => resumeSites())
    .catch((err) => console.error('[cloud] could not resume sites', err?.message ?? err))
})
