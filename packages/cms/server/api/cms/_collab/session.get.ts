// GET /api/cms/_collab/session?entity=&id=&locale= — the shared document for one entry
// (or one translation): its name, the epoch to present when connecting, the fields
// edited together, and whether this person may write or only watch. See cmsCollab.ts.
export default defineEventHandler(async (event) => {
  const user = requireCmsUser(event)
  if (cmsAuthMode() !== 'builtin') throw createError({ statusCode: 404, statusMessage: 'Shared editing needs the built-in sign-in' })
  const { reg } = useCms()
  const q = getQuery(event)
  const locale = requestedLocale(event, reg)
  const translation = isTranslationLocale(reg, locale) ? locale : null
  const target = parseCollabName(collabName(String(q.entity ?? ''), String(q.id ?? ''), translation))
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const access = await collabAccess(user, target)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  const { epoch } = await ensureCollabDocument(target)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { name: target.name, epoch, fields: collabFields(target.entity, target.locale), access }
})
