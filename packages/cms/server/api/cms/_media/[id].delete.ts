import { eq } from 'tinyzoo'
import { deleteImageVariants } from '../../../utils/cmsImageSizes'

// DELETE /api/cms/_media/:id — remove a media record and its blob. Lets orphaned
// uploads be reclaimed (full auto-GC on hero replace / entity delete is a follow-up).
// If a required FK still references it, the DB's ON DELETE restrict surfaces an error.
export default defineEventHandler(async (event) => {
  const user = requireCmsUser(event)
  assertMediaLibrary(user)
  assertTokenMedia(user, 'delete')
  const { db, reg } = useCms()
  const id = getIdParam(event)

  const [media] = await db.select().from(reg.cmsMedia).where(eq(reg.cmsMedia.id, id))
  if (!media) throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  assertMediaOwner(user, media)

  // Refuse rather than orphan a live reference (entity GC handles auto-cleanup).
  if (await isMediaReferenced(db, reg, id, media.key)) {
    throw createError({ statusCode: 409, statusMessage: 'Media is in use and cannot be deleted.' })
  }

  // Remove the blob first; if that fails we keep the row so the delete stays retryable.
  await useCmsStorage().delete(media.key)
  await deleteImageVariants(media.key)
  await db.delete(reg.cmsMedia).where(eq(reg.cmsMedia.id, id))
  forgetServedMedia(media.key)

  await audit(event, 'media.delete', { recordId: id })
  return { ok: true }
})
