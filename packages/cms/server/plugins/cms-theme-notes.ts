// Development: what the admin theme's checks changed or found (src/theme.ts), once when the
// server starts: a brand colour the contrast guard adjusted, an accent it could not read, a
// logo problem. Production adjusts quietly (cmsPublicAdminTheme sends no notes either).
export default defineNitroPlugin(() => {
  if (!import.meta.dev || import.meta.prerender) return
  for (const note of cmsAdminTheme().notes) console.warn(`[tinyzoo] cms.admin: ${note.message}`)
})
