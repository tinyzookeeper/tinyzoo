import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

// Choose a new password with the link from the e-mail. Other sessions of the account end; this
// browser is signed in. The link proves the address, so it counts as confirmed too.
const input = z.object({ token: z.string().min(1).max(200), password: passwordSchema })

export default defineEventHandler(async (event) => {
  const { token, password } = await readInput(event, input)
  if (tooManyAttempts(`reset:${clientIp(event)}`, 10)) throw fail(429, 'tooMany', 'Too many attempts, try again in a few minutes')
  const userId = await consumeEmailToken(token, 'reset')
  if (!userId) throw fail(410, 'link.expired', 'This link has expired or was already used')
  const db = useDb()
  await db.update(schema.users).set({
    passwordHash: await hashPassword(password),
    sessionVersion: sql`${schema.users.sessionVersion} + 1`,
    emailVerifiedAt: sql`coalesce(${schema.users.emailVerifiedAt}, now())`,
  }).where(eq(schema.users.id, userId))
  await startSession(event, userId)
  await startWaitingSites(userId)
  return { ok: true }
})
