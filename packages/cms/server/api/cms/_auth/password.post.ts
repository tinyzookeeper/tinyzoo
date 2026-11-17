import { and, eq, sql } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/_auth/password — change your own password (the current one is
// required). Other browsers are signed out; this one stays signed in.
const body = z.object({ current: z.string().max(200), password: passwordSchema })

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsAccount(event)
  if (isDemoAccount(me.email)) throw createError({ statusCode: 403, statusMessage: 'The demo account keeps its password', data: { code: 'demo_account' } })
  if (!(await rateLimit(`password:${me.id}`, 10, 15 * 60_000))) throw tooManyRequests(event, 'Too many attempts; try again later', 15 * 60_000)
  const data = parseOr422(body, await readBody(event))
  const { db, reg } = useCms()
  const [u] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, me.id))
  if (!u?.passwordHash || !(await verifyPassword(u.passwordHash, data.current))) {
    throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: [{ path: ['current'], message: 'Wrong password' }] })
  }
  const [updated] = await db.update(reg.cmsUsers)
    .set({ passwordHash: await hashPassword(data.password), sessionVersion: sql`${reg.cmsUsers.sessionVersion} + 1`, updatedAt: new Date() })
    .where(and(eq(reg.cmsUsers.id, me.id), eq(reg.cmsUsers.sessionVersion, event.context.cmsSessionVersion))).returning()
  if (!updated) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  await continueCmsSession(event, updated) // the sign-in time stays
  await audit(event, 'account.password')
  return { ok: true }
})
