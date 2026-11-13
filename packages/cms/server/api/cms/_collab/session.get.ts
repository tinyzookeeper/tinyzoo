import { eq } from 'tinyzoo'

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
  if (!(await rateLimit(`collab:${user.id}`, 120, 60_000))) throw createError({ statusCode: 429, statusMessage: 'Too many requests; try again shortly' })
  const access = await collabAccess(user, target)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  const { epoch } = await ensureCollabDocument(target)
  // Stored text the editor cannot hold is edited alone, so it is never replaced.
  const saved = await savedContent(target)
  const fields = collabFields(target.entity, target.locale).filter((k) => fitsEditor(saved?.values[k]))
  // The name on this person's cursor, exactly as the server will check it.
  const { db } = useCms()
  const [me] = await db.select({ name: reg.cmsUsers.name, email: reg.cmsUsers.email }).from(reg.cmsUsers).where(eq(reg.cmsUsers.id, user.id))
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { name: target.name, epoch, fields, access, you: displayName(me?.name, me?.email ?? user.email) }
})
