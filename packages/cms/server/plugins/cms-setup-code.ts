// Production, no setup token, no account yet: make (or find) the one-time setup code
// and print it. Waits for the start-up migrations, which create the tables it uses.
export default defineNitroPlugin(() => {
  if (!setupCodeApplies()) return
  void (async () => {
    try {
      await cmsMigrationsReady()
      await ensureSetupCode({ reissue: true })
    }
    catch (err) {
      // Not fatal: the status endpoint tries again when someone opens /admin/setup.
      console.error('[cms] could not prepare the setup code', (err as Error)?.message ?? err)
    }
  })()
})
