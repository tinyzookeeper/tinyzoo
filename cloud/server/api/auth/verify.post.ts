import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

// Confirm an e-mail address with the link from the e-mail. Works signed in or not (the link
// may be opened on another device). Websites that waited for it start being made.
const input = z.object({ token: z.string().min(1).max(200) })

export default defineEventHandler(async (event) => {
  const { token } = await readInput(event, input)
  if (tooManyAttempts(`verify:${clientIp(event)}`, 20)) throw fail(429, 'tooMany', 'Too many attempts, try again in a few minutes')
  const userId = await consumeEmailToken(token, 'verify')
  if (!userId) throw fail(410, 'link.expired', 'This link has expired or was already used')
  await useDb().update(schema.users).set({ emailVerifiedAt: sql`coalesce(${schema.users.emailVerifiedAt}, now())` }).where(eq(schema.users.id, userId))
  forgetDevLink(userId, 'verify')
  const started = await startWaitingSites(userId)
  const me = await currentUser(event)
  // The site to go to, only for the person themselves.
  return { ok: true, siteId: me?.id === userId ? started[0] ?? null : null, signedIn: me?.id === userId }
})
