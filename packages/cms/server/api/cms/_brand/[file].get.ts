import { CMS_BRAND_FILES, type CmsBrandFile } from 'tinyzoo'
import { adminWebManifest, brandFileCacheControl } from '../../../utils/cmsBrandFiles'
import { brandFilePng } from '../../../utils/cmsBrandSource'

// GET /api/cms/_brand/<file>: the PNG versions of the client's logo (CMS_BRAND_FILES in
// src/theme.ts) and the admin's web manifest. Public: email clients and the browser's
// icon and manifest requests come without a session, and nothing here is more than the
// sign-in page shows. Everything comes from the site's admin settings (cmsAdminSettings),
// never from the request.
//
// Addresses carry `?v=<version>` (brandFileUrl): a hash of the logo's bytes and of how
// tinyzoo draws them. Asked with the version of the file it gets, the file is kept for a
// year; without it (or with an old one) only briefly, so a new logo shows soon. Development
// never lets the browser keep it: the logo may change under the running server.
export default defineEventHandler(async (event) => {
  const file = getRouterParam(event, 'file') ?? ''
  const { theme, defaultLocale } = await cmsAdminSettings(event)

  if (file === 'admin.webmanifest') {
    setResponseHeaders(event, { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-cache' })
    return JSON.stringify(adminWebManifest(theme, defaultLocale))
  }

  if (!(CMS_BRAND_FILES as readonly string[]).includes(file)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const made = await brandFilePng(file as CmsBrandFile, theme)
  if (!made) throw createError({ statusCode: 404, statusMessage: 'No logo for this file' })
  const cache = brandFileCacheControl({ dev: !!import.meta.dev, asked: getQuery(event).v, version: made.version })
  setResponseHeaders(event, { 'Content-Type': 'image/png', 'Cache-Control': cache })
  return made.png
})
