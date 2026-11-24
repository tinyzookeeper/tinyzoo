import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

// Change my password; other sessions of the account end.
const input = z.object({ current: z.string().min(1).max(200), next: passwordSchema })

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const { current, next } = await readInput(event, input)
  const key = `password:${me.id}`
  if (isLimited(key)) throw fail(429, 'tooMany', 'Too many attempts, try again in a few minutes')
  const db = useDb()
  const [user] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, me.id))
  if (!user || !(await verifyPassword(user.hash, current))) {
    noteFailure(key)
    throw fail(403, 'password.wrong', 'The current password is wrong')
  }
  clearAttempts(key)
  await db.update(schema.users).set({ passwordHash: await hashPassword(next), sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, me.id))
  await startSession(event, me.id)
  return { ok: true }
})
