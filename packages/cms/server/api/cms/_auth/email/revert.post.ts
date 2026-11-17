import { and, eq, isNull, sql } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/_auth/email/revert { token, password } — undo a change of sign-in email
// with the link from the "your email was changed" notice to the old address.
//
// The threat it answers: someone who knows the password (and no more) asks for a change
// to their own address and confirms it at once. Cancelling by a new password is too
// slow for that, and from then on a password reset would go to them. The old mailbox
// is the proof here, as it is for a reset link, so this one step:
//  - gives the account its old address back (unless another account has it now: 409,
//    nothing changes — an administrator has to sort that out),
//  - sets the new password chosen on the page — in the same step, because the person
//    who made the change knows the old one: restoring the address alone would let them
//    straight back in,
//  - ends every session (session version) and every reset and email link, forgets a
//    pending change, and ends the ways back of later changes (they would undo this);
//    those of earlier changes stay, they lead further back,
//  - signs this browser in, as a reset does, and is audited (account.email_revert),
//  - tells the address it replaces: the owner of that mailbox may have made the change
//    (an old work mailbox read by someone else now), and must not be locked out unheard.
const body = z.object({ token: z.string().min(1).max(200), password: passwordSchema })
const GONE = 'This link has expired or was already used'

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  if (!(await rateLimit(`email-revert:ip:${clientIp(event)}`, 20, 15 * 60_000))) throw tooManyRequests(event, 'Too many attempts; try again later', 15 * 60_000)
  const data = parseOr422(body, await readBody(event))
  const { db, reg } = useCms()
  const found = await findToken(db, reg, data.token, 'email-revert')
  const revert = found ? await readEmailRevert(db, reg, found.user.id, found.token.id) : null
  if (!found || !revert || found.user.status !== 'active') throw createError({ statusCode: 410, statusMessage: GONE })
  const before = found.user

  const taken = () => createError({ statusCode: 409, statusMessage: 'This address now belongs to another account', data: { code: 'email_taken' } })
  if (await emailTaken(db, reg, revert.email, before.id)) throw taken()

  const passwordHash = await hashPassword(data.password)
  let user: any
  try {
    user = await db.transaction(async (tx: any) => {
      await lockUser(tx, reg, before.id)
      // Claim the link atomically: of two simultaneous requests only one gets the row.
      const [claimed] = await tx.update(reg.cmsTokens).set({ usedAt: new Date() })
        .where(and(eq(reg.cmsTokens.id, found.token.id), isNull(reg.cmsTokens.usedAt))).returning({ id: reg.cmsTokens.id })
      if (!claimed) throw createError({ statusCode: 410, statusMessage: GONE })
      const u = reg.cmsUsers
      const [row] = await tx.update(u)
        .set({ email: revert.email, passwordHash, sessionVersion: sql`${u.sessionVersion} + 1`, updatedAt: new Date(), lastLoginAt: new Date() })
        .where(and(eq(u.id, before.id), eq(u.status, 'active'))).returning()
      if (!row) throw createError({ statusCode: 410, statusMessage: GONE })
      await endLinksOf(tx, reg, before.id, ['reset', 'email'])
      await endRevertLinks(tx, reg, before.id, found.token.createdAt)
      return row
    })
  }
  catch (err) {
    if (isUniqueViolation(err)) throw taken()
    throw err
  }

  await startCmsSession(event, user)
  await audit(event, 'account.email_revert', { userId: user.id, meta: { email: user.email, previousEmail: before.email } })
  const locale = user.locale || requestLocale(event)
  event.waitUntil(sendCmsMail(emailRevertedNotice({ to: before.email, restoredEmail: user.email, locale }))
    .catch((err) => console.error('[cms] could not send the email reverted notice', redactEmails(safeErrorMessage(err)))))
  return { user: sessionUser(user) }
})
