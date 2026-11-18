import { accentTextContrast, adminAccentCss, adminAccentName, contrastRatio, resolveAdminTheme, themeHash, type CmsAdminTheme } from '../../src/theme'

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

/** Where the notes were shown in this browser session (sessionStorage), keyed by what they say. */
const NOTES_SHOWN_KEY = 'tinyzoo:theme-notes'
let notesShown: string | null = null
/**
 * Development: the theme's notes (what the contrast guard changed, logo checks) in the console,
 * once per browser session, and again only when they change. Nuxt forwards the browser's console
 * to the dev server's log, so printing on every page load filled it with the same lines.
 */
export function cmsShowThemeNotes(theme: Pick<CmsAdminTheme, 'notes'>, where = { dev: import.meta.dev, client: import.meta.client }) {
  if (!where.dev || !where.client || !theme.notes?.length) return
  const key = themeHash(theme.notes.map((n) => n.message).join('\n'))
  if (notesShown === key) return
  notesShown = key
  try {
    if (sessionStorage.getItem(NOTES_SHOWN_KEY) === key) return
    sessionStorage.setItem(NOTES_SHOWN_KEY, key)
  }
  catch { /* storage blocked: once per page load, then */ }
  for (const note of theme.notes) console.warn(`[tinyzoo] cms.admin: ${note.message}`)
}

/** The WCAG 2 contrast ratio of two hexes (the design-system page shows the guard's numbers). */
export const cmsContrastRatio = (a: string, b: string) => contrastRatio(a, b)
/** How a colour reads as accent text where the contrast guard checks it: the worst ratio and its surface (`white`, `cream`, `hoverGrey`, `tint`; dark: `page`, `cards`, `charcoal`, `tint`). */
export const cmsAccentTextContrast = (hex: string, scheme: 'light' | 'dark' = 'light') => accentTextContrast(hex, scheme)
