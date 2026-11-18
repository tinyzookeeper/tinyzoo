import { CMS_BRAND_FILES, type CmsBrandFile } from 'tinyzoo'
import { adminWebManifest, brandFileVersion } from '../../../utils/cmsBrandFiles'
import { brandFilePng } from '../../../utils/cmsBrandSource'

// GET /api/cms/_brand/<file>: the PNG versions of the client's logo (CMS_BRAND_FILES in
// src/theme.ts) and the admin's web manifest. Public: email clients and the browser's
// icon and manifest requests come without a session, and nothing here is more than the
// sign-in page shows. The theme comes from cmsAdminTheme(), never from the request.
//
// Addresses carry `?v=<hash of the logo>` (brandFileUrl): with the current `v` the file is
// kept for a year; without it (or with an old one) only briefly, so a new logo shows soon.
const LONG = 'public, max-age=31536000, immutable'
const SHORT = 'public, max-age=300'

export default defineEventHandler(async (event) => {
  const file = getRouterParam(event, 'file') ?? ''
  const theme = cmsAdminTheme(event)

  if (file === 'admin.webmanifest') {
    const admin = ((useAppConfig() as any)?.cms?.admin ?? {}) as Record<string, any>
    setResponseHeaders(event, { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-cache' })
    return JSON.stringify(adminWebManifest(theme, String(admin.defaultLocale || 'en')))
  }

  if (!(CMS_BRAND_FILES as readonly string[]).includes(file)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const png = await brandFilePng(event, file as CmsBrandFile, theme)
  if (!png) throw createError({ statusCode: 404, statusMessage: 'No logo for this file' })
  const current = getQuery(event).v === brandFileVersion(file as CmsBrandFile, theme)
  setResponseHeaders(event, { 'Content-Type': 'image/png', 'Cache-Control': current ? LONG : SHORT })
  return png
})
