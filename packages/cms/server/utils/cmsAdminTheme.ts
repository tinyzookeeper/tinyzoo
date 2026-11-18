import { resolveAdminTheme, type CmsAdminTheme } from 'tinyzoo'

// The admin's theme on the server (src/theme.ts): the one place that decides where the
// theme comes from. Today: `cms.admin` in the site's app.config, resolved once and kept.
// A hosted tinyzoo would read the site's stored settings here instead (per request, per
// site), and everything that uses the theme (the admin, the emails, the logo files) would
// follow without a change.

let cached: { source: unknown; theme: CmsAdminTheme } | null = null

/** The resolved admin theme. `event` is unused today; it is where a per-site theme would come from. */
export function cmsAdminTheme(_event?: unknown): CmsAdminTheme {
  const admin = ((useAppConfig() as any)?.cms?.admin ?? {}) as Record<string, any>
  if (cached?.source === admin) return cached.theme
  const theme = resolveAdminTheme({ name: admin.name, accent: admin.accent, logo: admin.logo, signature: admin.signature })
  cached = { source: admin, theme }
  return theme
}

/** The theme as the browser gets it: without the developer notes in production. */
export function cmsPublicAdminTheme(event?: unknown): CmsAdminTheme {
  const theme = cmsAdminTheme(event)
  return import.meta.dev ? theme : { ...theme, notes: [] }
}
