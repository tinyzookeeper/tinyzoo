import { adminAccentCss, adminAccentName, resolveAdminTheme, type CmsAdminTheme } from '../../src/theme'

// The admin's accent in the browser (src/theme.ts does the maths): what goes in
// data-cms-accent, the <style> that draws a brand colour, and the development notes.
// useCmsAdminHead uses them; so does the website's design-system page.

/** `data-cms-accent`: the built-in accent's name, or `brand`. */
export const cmsAccentName = (theme: Pick<CmsAdminTheme, 'accent'>) => adminAccentName(theme)
/** The CSS that draws a brand accent (scoped to the admin), or '' for a built-in one. */
export const cmsAccentCss = (theme: Pick<CmsAdminTheme, 'accent'>) => adminAccentCss(theme)
/** An accent (a built-in name or a hex) resolved as the admin resolves `cms.admin.accent`, with the contrast guard's notes. */
export const cmsResolveAccent = (accent: string) => {
  const theme = resolveAdminTheme({ accent })
  return { accent: theme.accent, notes: theme.notes }
}

let notesShown = false
/** Development: the theme's notes (what the contrast guard changed, logo checks) once per page load in the console. */
export function cmsShowThemeNotes(theme: Pick<CmsAdminTheme, 'notes'>) {
  if (!import.meta.dev || !import.meta.client || notesShown || !theme.notes?.length) return
  notesShown = true
  for (const note of theme.notes) console.warn(`[tinyzoo] cms.admin: ${note.message}`)
}
