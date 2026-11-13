import { eq } from '@my-cms/core'

// GET /api/cms/_media/:id/usage — where this file is used (entries this person may
// read): media fields, rich text and blocks, translations included.
export default defineEventHandler(async (event) => {
  const user = requireCmsUser(event)
  const { db, reg } = useCms()
  const id = getIdParam(event)
  const [media] = await db.select().from(reg.cmsMedia).where(eq(reg.cmsMedia.id, id))
  if (!media) throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  return { usage: await mediaUsage(db, reg, user, id, media.key) }
})
