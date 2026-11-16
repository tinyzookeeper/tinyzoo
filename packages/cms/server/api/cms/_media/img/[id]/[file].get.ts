import { eq } from 'tinyzoo'
import { CMS_IMAGE_WIDTHS, imageVariant, isResizableImage, MAX_IMAGE_PIXELS } from '../../../../../utils/cmsImageSizes'

// GET /api/cms/_media/img/<media id>/<width>.webp — a smaller copy of an uploaded
// picture (see cmsImageSizes). Public like the files themselves, cached for a year.
//
// A picture that cannot be resized (more pixels than the limit — files stored before
// the limit was checked at upload — or a file the decoder cannot read) is sent as the
// original instead of an error: the page still shows it, and its <img srcset> does not
// break on one candidate.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const width = Number(/^(\d+)\.webp$/.exec(getRouterParam(event, 'file') ?? '')?.[1])
  if (!UUID.test(id) || !(CMS_IMAGE_WIDTHS as readonly number[]).includes(width)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const { db, reg } = useCms()
  const [m] = await db.select({ key: reg.cmsMedia.key, url: reg.cmsMedia.url, mime: reg.cmsMedia.mime, width: reg.cmsMedia.width, height: reg.cmsMedia.height }).from(reg.cmsMedia).where(eq(reg.cmsMedia.id, id))
  if (!m || !isResizableImage(m.mime)) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const original = () => {
    // Not for a year: the picture may be replaced by a smaller one under the same address.
    setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
    return sendRedirect(event, m.url, 302)
  }
  if (m.width && m.height && m.width * m.height > MAX_IMAGE_PIXELS) return original()

  let body: Buffer | null
  try {
    body = await imageVariant(m.key, width)
  }
  catch (err: any) {
    if (err?.statusCode) throw err // the store is unavailable (502): say so
    // The decoder refused the file (too many pixels, damaged): the original is all there is.
    console.warn('[cms] a picture could not be resized, sending the original:', String(err?.message ?? err).slice(0, 200))
    return original()
  }
  if (!body) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setResponseHeader(event, 'Content-Type', 'image/webp')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return body
})
