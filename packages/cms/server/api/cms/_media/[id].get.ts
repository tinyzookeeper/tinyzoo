import { eq } from '@my-cms/core'

// GET /api/cms/_media/:id — resolve a media id to its record (used by the
// media field widget to render the existing preview when editing).
export default defineEventHandler(async (event) => {
  requireCmsUser(event)
  const { db, reg } = useCms()
  const id = getRouterParam(event, 'id')!

  const [media] = await db.select().from(reg.cmsMedia).where(eq(reg.cmsMedia.id, id))
  if (!media) throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  return media
})
