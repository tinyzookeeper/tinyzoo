import { and, eq } from 'tinyzoo'
import { z } from 'zod'

// PATCH /api/cms/_auth/me — change your own name and interface language.
//
// The update only applies if the session version is still the one this request was
// authorised with. Otherwise a stolen session could keep itself alive across the
// owner's password change by re-signing its cookie with the new version.
const body = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  locale: z.string().max(10).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsUser(event)
  if (!(await rateLimit(`me:${me.id}`, 60, 60_000))) throw tooManyRequests(event, 'Too many requests', 60_000)
  const data = parseOr422(body, await readBody(event))
  // The shared demo account keeps its name (everyone signs in as it); the language may change.
  if (data.name !== undefined && isDemoAccount(me.email)) throw createError({ statusCode: 403, statusMessage: 'The demo account keeps its name', data: { code: 'demo_account' } })
  const { db, reg } = useCms()
  const [u] = await db.update(reg.cmsUsers).set({ ...data, updatedAt: new Date() })
    .where(and(eq(reg.cmsUsers.id, me.id), eq(reg.cmsUsers.sessionVersion, event.context.cmsSessionVersion)))
    .returning()
  if (!u) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  await startCmsSession(event, u)
  await audit(event, 'account.update', { meta: { fields: Object.keys(data) } })
  return { user: sessionUser(u) }
})
