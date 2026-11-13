import { and, eq, isNull } from '@my-cms/core'
import { z } from 'zod'

// POST /api/cms/_auth/accept — accept an invitation: choose a name and password, and
// sign in.
const body = z.object({ token: z.string().min(1).max(200), name: z.string().trim().min(1).max(120), password: passwordSchema })

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  if (!(await rateLimit(`accept:ip:${clientIp(event)}`, 20, 15 * 60_000))) throw createError({ statusCode: 429, statusMessage: 'Too many attempts; try again later' })
  const data = parseOr422(body, await readBody(event))
  const { db, reg } = useCms()
  const found = await findToken(db, reg, data.token, 'invite')
  if (!found || found.user.status !== 'invited') {
    throw createError({ statusCode: 410, statusMessage: 'This invitation has expired or was already used' })
  }

  const passwordHash = await hashPassword(data.password)
  const user = await db.transaction(async (tx: any) => {
    // Claim the link atomically: of two simultaneous requests only one gets the row.
    const [claimed] = await tx.update(reg.cmsTokens).set({ usedAt: new Date() })
      .where(and(eq(reg.cmsTokens.id, found.token.id), isNull(reg.cmsTokens.usedAt))).returning({ id: reg.cmsTokens.id })
    if (!claimed) throw createError({ statusCode: 410, statusMessage: 'This link has expired or was already used' })
    const [u] = await tx.update(reg.cmsUsers)
      .set({ name: data.name, passwordHash, status: 'active', updatedAt: new Date(), lastLoginAt: new Date() })
      .where(eq(reg.cmsUsers.id, found.user.id)).returning()
    return u
  })

  await startCmsSession(event, user)
  await audit(event, 'auth.invite_accept', { userId: user.id })
  return { user: sessionUser(user) }
})
