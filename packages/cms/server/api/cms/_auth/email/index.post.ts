import { eq } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/_auth/email — ask to change your own sign-in email. Needs your current
// password. Nothing changes yet: a one-time link goes to the new address (it makes the
// change, see confirm.post.ts) and a notice to the current one (if it was not you, a new
// password cancels the change).
//
// Wrong passwords count against the same limits as failed sign-ins of this account
// (per address and per client address), so this is no second door for guessing it.
//
// The answer is the same whether or not the new address already has an account: the
// person asking is not told who has one. The owner of that address gets a notice
// instead of the link, and the change waits until it expires or is cancelled. The
// lookup and the emails happen after the response, so its timing tells nothing either.
const body = z.object({
  email: emailSchema.pipe(z.string().max(254)),
  password: z.string().max(200),
})
const WINDOW = 15 * 60_000

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsUser(event)
  if (isDemoAccount(me.email)) throw createError({ statusCode: 403, statusMessage: 'The demo account keeps its email', data: { code: 'demo_account' } })
  const data = parseOr422(body, await readBody(event))
  const ip = clientIp(event)
  const signInKey = `login:email:${normalizeEmail(me.email ?? '')}`
  if (!(await rateLimit(`login:ip:${ip}`, 30, WINDOW)) || !(await rateLimit(signInKey, 10, WINDOW))) {
    throw tooManyRequests(event, 'Too many attempts; wait a few minutes and try again', WINDOW)
  }

  const { db, reg } = useCms()
  const [u] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, me.id))
  const ok = u?.passwordHash
    ? await verifyPassword(u.passwordHash, data.password)
    : (await verifyPassword(await dummyPasswordHash(), data.password), false)
  if (!u || !ok) {
    await audit(event, 'account.email_failed', { meta: { ip } })
    throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: [{ path: ['password'], message: 'Wrong password' }] })
  }
  await rateLimitRefund(`login:ip:${ip}`, WINDOW)
  await rateLimitRefund(signInKey, WINDOW)

  if (data.email === u.email) {
    throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: [{ path: ['email'], code: 'same_email', message: 'This is already your address' }] })
  }
  // A handful of requests an hour: each one sends two emails.
  if (!(await rateLimit(`email-change:${u.id}`, 5, 60 * 60_000))) throw tooManyRequests(event, 'Too many requests; try again later', 60 * 60_000)
  if (u.sessionVersion !== event.context.cmsSessionVersion) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  // Resolved while the request is alive (the configured public address, the person's language).
  const linkBase = adminLink(event, '/admin/email/')
  const forgotUrl = adminLink(event, '/admin/forgot')
  const locale = u.locale || requestLocale(event)
  const secret = await startEmailChange(db, reg, { userId: u.id, email: data.email, sessionVersion: u.sessionVersion })
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS)

  const work = (async () => {
    const inUse = await emailTaken(db, reg, data.email, u.id)
    await audit(event, 'account.email_request', { userId: u.id, meta: { email: data.email, previousEmail: u.email, ...(inUse ? { inUse: true } : {}) } })
    const send = async (msg: Parameters<typeof sendCmsMail>[0], what: string) => {
      try {
        await sendCmsMail(msg)
      }
      catch (err) {
        console.error(`[cms] could not send the ${what} email`, redactEmails(safeErrorMessage(err)))
      }
    }
    await send(inUse ? emailInUseNotice({ to: data.email, locale }) : emailConfirmEmail({ to: data.email, url: linkBase + secret, locale }), inUse ? 'address-in-use' : 'email confirmation')
    await send(emailRequestedNotice({ to: u.email, newEmail: data.email, url: forgotUrl, locale }), 'email change notice')
  })().catch((err) => console.error('[cms] email change request failed', redactEmails(safeErrorMessage(err))))
  event.waitUntil(work)

  return { pending: { email: data.email, expiresAt } }
})
