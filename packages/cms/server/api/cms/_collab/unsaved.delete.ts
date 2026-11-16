// DELETE /api/cms/_collab/unsaved?entity=&id=&locale= — the text a closed tab left
// behind unsaved is dealt with (kept in the form, or discarded): forget it. Only for
// people who may edit the entry. See cmsCollab.ts.
export default defineEventHandler(async (event) => {
  const user = requireCmsUser(event)
  if (cmsAuthMode() !== 'builtin') throw createError({ statusCode: 404, statusMessage: 'Shared editing needs the built-in sign-in' })
  const { reg } = useCms()
  const q = getQuery(event)
  const locale = requestedLocale(event, reg)
  const translation = isTranslationLocale(reg, locale) ? locale : null
  const target = parseCollabName(collabName(String(q.entity ?? ''), String(q.id ?? ''), translation))
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  if ((await collabAccess(user, target)) !== 'write') throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  await dropUnsavedText(target)
  return { ok: true }
})
