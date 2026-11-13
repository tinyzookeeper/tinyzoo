import { eq } from '@my-cms/core'
import { z } from 'zod'

// POST /api/cms/_auth/forgot — email a password-reset link. Always the same answer,
// whether or not the address has an account (no way to probe who has one).
const body = z.object({ email: z.string().trim().toLowerCase().max(320) })

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const { email } = parseOr422(body, await readBody(event))
  if (!rateLimitOk(`forgot:ip:${clientIp(event)}`, 10, 60 * 60_000) || !rateLimitOk(`forgot:email:${email}`, 3, 60 * 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests — try again later' })
  }

  const { db, reg } = useCms()
  const [user] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.email, email))
  if (user && user.status === 'active') {
    const secret = await issueToken(db, reg, { userId: user.id, kind: 'reset', ttlMs: RESET_TTL_MS })
    const url = adminLink(event, `/admin/reset/${secret}`)
    try {
      await sendCmsMail(resetEmail({ to: user.email, url, locale: user.locale }))
    }
    catch (err) {
      console.error('[cms] could not send the password reset email', err)
    }
    await audit(event, 'auth.reset_request', { userId: user.id })
  }
  return { ok: true }
})
