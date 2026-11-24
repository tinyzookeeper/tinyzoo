import { eq } from 'drizzle-orm'
import { z } from 'zod'

// Ask for a link to choose a new password. The answer is the same whether the address has an
// account or not. (Development, e-mail only printed: the link comes back, to open by hand.)
const input = z.object({ email: emailSchema })

export default defineEventHandler(async (event) => {
  const { email } = await readInput(event, input)
  if (tooManyAttempts(`forgot:${clientIp(event)}`, 5) || tooManyAttempts(`forgot:${email}`, 3, 60 * 60_000)) {
    throw fail(429, 'tooMany', 'Too many attempts, try again in a few minutes')
  }
  const [user] = await useDb().select().from(schema.users).where(eq(schema.users.email, email))
  let devResetUrl: string | null = null
  if (user) {
    const secret = await issueEmailToken(user.id, 'reset', RESET_TTL_MS)
    const url = `${publicUrl(event)}/reset/${secret}`
    await sendMail(resetEmail(user, url))
    if (showsMailLinks()) devResetUrl = url
  }
  return { ok: true, devResetUrl }
})
