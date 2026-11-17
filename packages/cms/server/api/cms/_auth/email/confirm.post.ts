import { and, eq, isNull, sql } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/_auth/email/confirm — make the change of sign-in email the link was sent
// for. Works signed in or not: the password was checked when the change was asked for,
// and the link proves the new mailbox; it is bound to one account and one address.
//
// Like a password change, it ends every session of the account (the address is half of
// how it signs in). A browser signed in to this same account stays signed in, now with
// the new address; any other browser's session is left alone. The old address is told,
// with a link that undoes the change (revert.post.ts): someone who knew the password
// could ask for a change to their own address and confirm it at once, and the owner,
// who still reads the old mailbox, gets the account back with it.
const body = z.object({ token: z.string().min(1).max(200) })
const GONE = 'This link has expired or was already used'

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  if (!(await rateLimit(`email-confirm:ip:${clientIp(event)}`, 40, 15 * 60_000))) throw tooManyRequests(event, 'Too many attempts; try again later', 15 * 60_000)
  const data = parseOr422(body, await readBody(event))
  const { db, reg } = useCms()
  const found = await findToken(db, reg, data.token, 'email')
  const pending = found ? await readLiveEmailChange(db, reg, found.user.id) : null
  if (!found || !emailChangeUsable(pending, found.token, found.user)) throw createError({ statusCode: 410, statusMessage: GONE })
  const before = found.user
  // Resolved before anything changes: without a public address (production) nothing happens.
  const revertBase = adminLink(event, '/admin/email/revert/')

  const taken = () => createError({ statusCode: 409, statusMessage: 'This address already belongs to another account', data: { code: 'email_taken' } })
  if (await emailTaken(db, reg, pending.email, before.id)) {
    // Only this link and its request end: a newer request made meanwhile stays.
    await db.update(reg.cmsTokens).set({ usedAt: new Date() })
      .where(and(eq(reg.cmsTokens.id, found.token.id), isNull(reg.cmsTokens.usedAt)))
    await forgetEmailChange(db, reg, before.id, found.token.id)
    throw taken()
  }

  let updated: any
  let revertSecret = ''
  try {
    updated = await db.transaction(async (tx: any) => {
      await lockUser(tx, reg, before.id)
      // Claim the link atomically: of two simultaneous requests only one gets the row.
      const [claimed] = await tx.update(reg.cmsTokens).set({ usedAt: new Date() })
        .where(and(eq(reg.cmsTokens.id, found.token.id), isNull(reg.cmsTokens.usedAt))).returning({ id: reg.cmsTokens.id })
      if (!claimed) throw createError({ statusCode: 410, statusMessage: GONE })
      const u = reg.cmsUsers
      const [row] = await tx.update(u)
        .set({ email: pending.email, sessionVersion: sql`${u.sessionVersion} + 1`, updatedAt: new Date() })
        .where(and(eq(u.id, before.id), eq(u.sessionVersion, pending.sv), eq(u.status, 'active'))).returning()
      if (!row) throw createError({ statusCode: 410, statusMessage: GONE })
      // Reset and email links already sent (to the old address, or an older request) stop working.
      await endLinksOf(tx, reg, before.id, ['reset', 'email'])
      // The way back, for the notice to the old address.
      revertSecret = await issueEmailRevert(tx, reg, { userId: before.id, email: before.email, createdBy: before.id })
      return row
    })
  }
  catch (err) {
    // Two accounts confirming the same address at once: the unique index lets one through.
    if (isUniqueViolation(err)) throw taken()
    throw err
  }

  const sameAccount = getCmsSession(event)?.id === updated.id
  if (sameAccount) await continueCmsSession(event, updated) // the sign-in time stays
  await audit(event, 'account.email', { userId: updated.id, meta: { email: updated.email, previousEmail: before.email } })

  const locale = updated.locale || requestLocale(event)
  event.waitUntil(sendCmsMail(emailChangedNotice({ to: before.email, newEmail: updated.email, revertUrl: revertBase + revertSecret, locale }))
    .catch((err) => console.error('[cms] could not send the email changed notice', redactEmails(safeErrorMessage(err)))))
  return { email: updated.email, signedIn: sameAccount }
})
