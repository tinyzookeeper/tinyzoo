import { eq } from 'drizzle-orm'
import { z } from 'zod'

const input = z.object({ email: emailSchema, password: z.string().min(1).max(200) })

export default defineEventHandler(async (event) => {
  const { email, password } = await readInput(event, input)
  const key = `login:${clientIp(event)}:${email}`
  if (isLimited(key)) throw fail(429, 'tooMany', 'Too many attempts, try again in a few minutes')
  const [user] = await useDb().select({ id: schema.users.id, hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.email, email))
  // Hash anyway, so a missing account takes as long as a wrong password.
  const ok = user ? await verifyPassword(user.hash, password) : (await hashPassword(password), false)
  if (!user || !ok) {
    noteFailure(key)
    throw fail(401, 'auth.wrong', 'Wrong e-mail or password')
  }
  clearAttempts(key)
  await startSession(event, user.id)
  return { ok: true }
})
