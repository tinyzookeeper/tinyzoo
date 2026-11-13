import { eq } from '@my-cms/core'
import { z } from 'zod'

// POST /api/cms/_auth/forgot — email a password-reset link. Always the same answer,
// at the same speed, whether or not the address has an account: the lookup, token
// and email happen after the response (event.waitUntil), so neither the reply nor
// its timing tells who has an account.
const body = z.object({ email: z.string().trim().toLowerCase().max(320) })

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const { email } = parseOr422(body, await readBody(event))
  if (!(await rateLimit(`forgot:ip:${clientIp(event)}`, 10, 60 * 60_000)) || !(await rateLimit(`forgot:email:${email}`, 3, 60 * 60_000))) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests — try again later' })
  }
  // Resolved now, while the request is alive (it needs the configured public URL).
  let linkBase: string | null = null
  try {
    linkBase = adminLink(event, '/admin/reset/')
  }
  catch (err) {
    console.error('[cms] password reset links need cms.publicUrl', err)
  }

  const work = (async () => {
    if (!linkBase) return
    const { db, reg } = useCms()
    const [user] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.email, email))
    if (!user || user.status !== 'active') return
    const secret = await issueToken(db, reg, { userId: user.id, kind: 'reset', ttlMs: RESET_TTL_MS })
    await sendCmsMail(resetEmail({ to: user.email, url: linkBase + secret, locale: user.locale }))
    await audit(event, 'auth.reset_request', { userId: user.id })
  })().catch((err) => console.error('[cms] could not send the password reset email', err))

  event.waitUntil(work)
  return { ok: true }
})
