import { eq } from 'tinyzoo'
import { CMS_IMAGE_WIDTHS, imageVariant, isResizableImage } from '../../../../../utils/cmsImageSizes'

// GET /api/cms/_media/img/<media id>/<width>.webp — a smaller copy of an uploaded
// picture (see cmsImageSizes). Public like the files themselves, cached for a year.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const width = Number(/^(\d+)\.webp$/.exec(getRouterParam(event, 'file') ?? '')?.[1])
  if (!UUID.test(id) || !(CMS_IMAGE_WIDTHS as readonly number[]).includes(width)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const { db, reg } = useCms()
  const [m] = await db.select({ key: reg.cmsMedia.key, mime: reg.cmsMedia.mime }).from(reg.cmsMedia).where(eq(reg.cmsMedia.id, id))
  if (!m || !isResizableImage(m.mime)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const body = await imageVariant(m.key, width)
  if (!body) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setResponseHeader(event, 'Content-Type', 'image/webp')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return body
})
