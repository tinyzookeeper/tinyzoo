// Development only: when the server starts, look at the client's logos (cms.admin.logo)
// and say in the log what will look wrong: an address the admin cannot use, a file that
// is missing, a mark that is not square, a picture too small to stay sharp. Never stops
// the start, never slows it (the files are read after it), and a build skips it.
// The checks themselves: server/utils/cmsLogoCheck.ts and src/themeLogo.ts.

export default defineNitroPlugin(() => {
  if (!import.meta.dev || import.meta.prerender) return
  const theme = cmsAdminTheme()
  if (!theme.logo.full && !theme.logo.mark && !theme.notes.some((n) => n.kind === 'logo')) return
  const publicDir = String((useRuntimeConfig().cms as any)?.devPublicDir || '')
  void checkAdminLogos(theme, publicDir)
    .then((notes) => {
      for (const n of notes) console.warn(`[tinyzoo] ${n.message}`)
    })
    .catch(() => { /* a check that cannot run says nothing */ })
})
