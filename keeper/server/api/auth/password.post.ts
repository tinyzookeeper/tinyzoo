import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

// Change my password; other sessions of the account end.
const input = z.object({ current: z.string().min(1).max(200), next: passwordSchema })

export default defineEventHandler(async (event) => {
  const me = { userId: (await requireUser(event)).id }
  const { current, next } = await readInput(event, input)
  const db = useDb()
  const [user] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, me.userId))
  if (!user || !(await verifyPassword(user.hash, current))) throw createError({ statusCode: 403, statusMessage: 'The current password is wrong' })
  await db.update(schema.users).set({ passwordHash: await hashPassword(next), sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, me.userId))
  await startSession(event, me.userId)
  return { ok: true }
})
