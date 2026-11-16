import { and, eq, isNull, sql } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/_auth/reset — set a new password with a reset link. Every other
// session of the account is signed out (session version bump); this browser is
// signed in with the new one.
const body = z.object({ token: z.string().min(1).max(200), password: passwordSchema })

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  if (!(await rateLimit(`reset:ip:${clientIp(event)}`, 20, 15 * 60_000))) throw tooManyRequests(event, 'Too many attempts; try again later', 15 * 60_000)
  const data = parseOr422(body, await readBody(event))
  const { db, reg } = useCms()
  const found = await findToken(db, reg, data.token, 'reset')
  if (!found || found.user.status !== 'active') {
    throw createError({ statusCode: 410, statusMessage: 'This link has expired or was already used; ask for a new one' })
  }

  const passwordHash = await hashPassword(data.password)
  const user = await db.transaction(async (tx: any) => {
    // Claim the link atomically: of two simultaneous requests only one gets the row.
    const [claimed] = await tx.update(reg.cmsTokens).set({ usedAt: new Date() })
      .where(and(eq(reg.cmsTokens.id, found.token.id), isNull(reg.cmsTokens.usedAt))).returning({ id: reg.cmsTokens.id })
    if (!claimed) throw createError({ statusCode: 410, statusMessage: 'This link has expired or was already used' })
    const [u] = await tx.update(reg.cmsUsers)
      .set({ passwordHash, sessionVersion: sql`${reg.cmsUsers.sessionVersion} + 1`, updatedAt: new Date(), lastLoginAt: new Date() })
      .where(eq(reg.cmsUsers.id, found.user.id)).returning()
    return u
  })

  await startCmsSession(event, user)
  await audit(event, 'auth.reset', { userId: user.id })
  return { user: sessionUser(user) }
})
