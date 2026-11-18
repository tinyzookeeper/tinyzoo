// Development: what the contrast guard changed or could not read in the accent (src/theme.ts),
// once when the server starts. The logo notes are printed by cms-logo-check.ts, together with
// what it finds in the files. Production adjusts quietly (cmsPublicAdminTheme sends no notes either).
export default defineNitroPlugin(() => {
  if (!import.meta.dev || import.meta.prerender) return
  // At start there is no request: the site's own settings (one site per server today).
  void cmsAdminTheme()
    .then((theme) => {
      for (const note of theme.notes.filter((n) => n.kind === 'accent')) console.warn(`[tinyzoo] cms.admin: ${note.message}`)
    })
    .catch(() => {})
})
