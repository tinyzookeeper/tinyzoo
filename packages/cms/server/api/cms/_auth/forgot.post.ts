import { eq } from 'tinyzoo'
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
    throw tooManyRequests(event, 'Too many requests; try again later', 60 * 60_000)
  }
  // Resolved now, while the request is alive (it needs the configured public URL, and the
  // language of the person asking, for an account that never saved one).
  const asked = requestLocale(event)
  let linkBase: string | null = null
  try {
    linkBase = adminLink(event, '/admin/reset/')
  }
  catch (err) {
    console.error('[cms] password reset links need cms.publicUrl', redactEmails(safeErrorMessage(err)))
  }

  const work = (async () => {
    if (!linkBase || isDemoAccount(email)) return // the demo account's password is public
    const { db, reg } = useCms()
    const [user] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.email, email))
    if (!user || user.status !== 'active') return
    const secret = await issueToken(db, reg, { userId: user.id, kind: 'reset', ttlMs: RESET_TTL_MS })
    await sendCmsMail(await resetEmail(event, { to: user.email, url: linkBase + secret, locale: user.locale || asked }))
    await audit(event, 'auth.reset_request', { userId: user.id })
  })().catch((err) => console.error('[cms] could not send the password reset email', redactEmails(safeErrorMessage(err))))

  event.waitUntil(work)
  return { ok: true }
})
