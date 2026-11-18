// Development only: when the server starts, look at the client's logos (cms.admin.logo)
// and say in the log what will look wrong: an address the admin cannot use, a file that
// is missing, a mark that is not square, a picture too small to stay sharp, text in an SVG.
// Never stops the start, never slows it (the files are read after it), and a build skips it.
// The checks themselves: server/utils/cmsLogoCheck.ts and src/themeLogo.ts.

export default defineNitroPlugin(() => {
  if (!import.meta.dev || import.meta.prerender) return
  const print = (notes: Array<{ message: string }>) => {
    for (const n of notes) console.warn(`[tinyzoo] ${n.message}`)
  }
  void (async () => {
    // At start there is no request: the site's own settings (one site per server today).
    const theme = await cmsAdminTheme()
    // The address notes first: they need no file, and a file check that fails must not hide them.
    print(theme.notes.filter((n) => n.kind === 'logo'))
    if (!theme.logo.full && !theme.logo.mark) return
    print(await checkAdminLogos(theme, String((useRuntimeConfig().cms as any)?.devPublicDir || '')))
  })().catch(() => { /* a check that cannot run says nothing */ })
})
