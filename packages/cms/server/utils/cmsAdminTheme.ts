import { resolveAdminTheme, type CmsAdminTheme } from 'tinyzoo'
import { brandLogoFiles } from './cmsBrandSource'

// The admin's theme on the server (src/theme.ts): the one place that decides where the
// theme comes from, and everything on the server reads it here: the admin (GET
// /api/cms/_theme), the logo files and the manifest (GET /api/cms/_brand/<file>), the emails
// and the development notes.
//
// Today: `cms.admin` in the site's app.config, one site per server. The resolved theme is
// kept per config object; the logo files' versions come from reading the files
// (cmsBrandSource.ts, which keeps what it read for a while), which is why this is async.
//
// `event` is the request the theme is for (absent only at server start, in the development
// plugins). It is unused today; a hosted tinyzoo serving several sites would take the site
// from it and read that site's stored settings here, so every caller that has a request
// passes it. Such a version must also not rely on the admin's fallback in the browser
// (useCmsAdminTheme resolves app.config there until the server's theme arrives), which only
// gives the right theme while app.config is the source.

const resolved = new WeakMap<object, CmsAdminTheme>()

/** The admin settings the server reads for a site: the theme, and the language the admin and its emails default to. */
export interface CmsAdminSettings {
  theme: CmsAdminTheme
  /** `cms.admin.defaultLocale` (`'en'` when not set): the emails' language when the recipient has none, the manifest's. */
  defaultLocale: string
}

/** The site's admin settings, with the theme's logo file versions filled in. */
export async function cmsAdminSettings(_event?: unknown): Promise<CmsAdminSettings> {
  const config = (useAppConfig() as any)?.cms?.admin
  const admin = (config && typeof config === 'object' ? config : {}) as Record<string, any>
  let theme = resolved.get(admin)
  if (!theme) {
    theme = resolveAdminTheme({ name: admin.name, accent: admin.accent, logo: admin.logo, signature: admin.signature, animals: admin.animals })
    resolved.set(admin, theme)
  }
  const files = await brandLogoFiles(theme.logo)
  return { theme: { ...theme, logo: { ...theme.logo, files } }, defaultLocale: String(admin.defaultLocale || 'en') }
}

/** The resolved admin theme for the request's site. */
export async function cmsAdminTheme(event?: unknown): Promise<CmsAdminTheme> {
  return (await cmsAdminSettings(event)).theme
}

/** The theme as the browser gets it: without the developer notes in production. */
export async function cmsPublicAdminTheme(event?: unknown): Promise<CmsAdminTheme> {
  const theme = await cmsAdminTheme(event)
  return import.meta.dev ? theme : { ...theme, notes: [] }
}
