import { eq } from '@my-cms/core'

// PATCH /api/cms/_media/:id — update editable media metadata (alt text). Alt text is
// the accessibility/SEO description; it's the only user-editable field on a blob.
export default defineEventHandler(async (event) => {
  requireCmsUser(event)
  const { db, reg } = useCms()
  const id = getRouterParam(event, 'id')!

  const body = await readBody(event).catch(() => ({})) as { alt?: unknown }
  // Normalize: trim, cap length, empty → null.
  const raw = typeof body.alt === 'string' ? body.alt.trim().slice(0, 1000) : ''
  const alt = raw.length ? raw : null

  const [media] = await db
    .update(reg.cmsMedia)
    .set({ alt })
    .where(eq(reg.cmsMedia.id, id))
    .returning()
  if (!media) throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  return media
})
