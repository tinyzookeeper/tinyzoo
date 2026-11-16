// POST /api/cms/_preview — the editor's unsaved values for the live preview beside the
// form: { entity, id, locale, data }, or { entity, id, locale, clear: true } when the
// editor closes. Kept only for this editor's own ?preview requests (cmsPreviewDraft).
export default defineEventHandler(async (event) => {
  const { reg } = useCms()
  const user = requireCmsUser(event)
  const body = await readBody<{ entity?: string; id?: string; locale?: string | null; data?: Record<string, any>; clear?: boolean }>(event)
  const e = getEntity(reg, body?.entity)
  authorize(e, 'read', user)
  const id = String(body?.id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, statusMessage: 'An entry id is required' })
  const locale = body?.locale ? String(body.locale) : null
  if (body?.clear) dropPreviewDraft(reg, e, user.id, id, locale)
  else if (body?.data && typeof body.data === 'object') putPreviewDraft(reg, e, user.id, id, locale, body.data)
  setResponseStatus(event, 204)
  return null
})
