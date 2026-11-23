import { eq, sql } from 'tinyzoo'
import { z } from 'zod'

// PATCH /api/cms/_users/:id — change someone's role or sign-in email, or disable /
// re-enable them. You cannot change your own role, email or access here (your own
// email changes on your account page, with your password and a confirmation link),
// and the last active administrator always stays. Disabling, a new role and a new
// email sign the person out everywhere at once. For someone linked to a tinyzoo account
// (cmsAccount.ts) the account service is told the new role, or `active: false` when disabled.
//
// A new email needs the administrator's own password (`password`): a session left open
// on a shared computer, or stolen, must not be enough to move someone's account to
// another mailbox. Wrong passwords count against the same limits as failed sign-ins of
// the administrator's address. The new email takes effect at once (the administrator
// vouches for it): links already sent stop working (a password reset waiting in the old
// mailbox would otherwise still open the account), the old address is told and the new
// one gets a note — unless the account is disabled: nobody can sign in with it, so
// neither address hears "sign in with the new one". For someone who has not accepted
// their invitation yet, the invitation goes to the new address instead (the old link
// stops working) and its link is returned, as when resending.
//
// Unlike a change the person makes, the notice to the old address carries no link that
// undoes it: the old mailbox is often the reason for the change (left, handed over), and
// such a link would give the account to whoever reads it now. The protection here is the
// administrator's password; someone who has that can do far more than this anyway.
const body = z.object({
  role: assignableRoleSchema().optional(),
  status: z.enum(['active', 'disabled']).optional(),
  email: emailSchema.pipe(z.string().max(254)).optional(),
  password: z.string().max(200).optional(),
})
const WINDOW = 15 * 60_000

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsAdmin(event)
  const id = getIdParam(event)
  const data = parseOr422(body, await readBody(event))
  const { db, reg } = useCms()
  const [target] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, id))
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  if (id === me.id) {
    throw createError({ statusCode: 409, statusMessage: data.email !== undefined ? 'Change your own email on your account page' : 'You cannot change your own role or access', data: { code: 'self' } })
  }
  if (data.status === 'active' && target.status === 'invited') {
    throw createError({ statusCode: 409, statusMessage: 'This person has not accepted the invitation yet' })
  }

  const newEmail = data.email !== undefined && data.email !== target.email ? data.email : null
  let links: { invite?: string; signIn?: string } = {}
  if (newEmail) {
    await checkOwnPassword(event, me.id, me.email, data.password)
    if (isDemoAccount(target.email)) throw createError({ statusCode: 403, statusMessage: 'The demo account keeps its email', data: { code: 'demo_account' } })
    if (await emailTaken(db, reg, newEmail, id)) throw emailInUse()
    // Resolved before anything changes: without a public address (production) nothing happens.
    links = target.status === 'invited' ? { invite: adminLink(event, '/admin/invite/') } : { signIn: adminLink(event, '/admin/login') }
  }

  const losesAdmin = target.role === 'admin' && target.status === 'active'
    && ((data.role && data.role !== 'admin') || data.status === 'disabled')

  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (data.role) set.role = data.role
  if (data.status) set.status = data.status
  if (newEmail) set.email = newEmail
  if (data.status === 'disabled' || (data.role && data.role !== target.role) || newEmail) {
    set.sessionVersion = sql`${reg.cmsUsers.sessionVersion} + 1`
  }
  // Check-and-change under one lock, so two administrators demoting each other at the
  // same moment cannot both pass the "another active admin remains" check.
  let updated: any
  try {
    updated = await db.transaction(async (tx: any) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_GUARD_LOCK})`)
      if (losesAdmin) await assertAnotherActiveAdmin(tx, reg, id)
      const [row] = await tx.update(reg.cmsUsers).set(set).where(eq(reg.cmsUsers.id, id)).returning()
      if (row && newEmail) {
        await endLinksOf(tx, reg, id, ['reset', 'email', 'invite'])
        // Ways back from earlier changes go too: the administrator chose this address,
        // often because an old mailbox is someone else's now.
        await endRevertLinks(tx, reg, id)
      }
      return row
    })
  }
  catch (err) {
    // Two changes to the same address at the same moment: the unique index lets one through.
    if (isUniqueViolation(err)) throw emailInUse()
    throw err
  }
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  if (data.role && data.role !== target.role) await audit(event, 'user.role', { recordId: id, meta: { from: target.role, to: data.role } })
  if (data.status && data.status !== target.status) await audit(event, data.status === 'disabled' ? 'user.disable' : 'user.enable', { recordId: id })
  // Linked to a tinyzoo account: the account service hears the new role, or that the person is no longer let in (after the response).
  if ((data.role && data.role !== target.role) || (data.status && data.status !== target.status)) await reportAccountMembershipOf(event, updated)

  let invitation: { inviteUrl: string; emailed: boolean } | undefined
  if (newEmail) {
    await audit(event, 'user.email', { recordId: id, meta: { email: newEmail, previousEmail: target.email } })
    const locale = updated.locale || me.locale || requestLocale(event)
    if (links.invite && updated.status === 'invited') {
      // Not accepted yet: the invitation goes to the new address (nothing to the old one — it may be a typo, a stranger's).
      const secret = await issueToken(db, reg, { userId: id, kind: 'invite', ttlMs: INVITE_TTL_MS, createdBy: me.id })
      const inviteUrl = links.invite + secret
      let emailed = false
      try {
        emailed = await sendCmsMail(await inviteEmail(event, { to: newEmail, inviter: me.name || me.email || 'An administrator', url: inviteUrl, role: updated.role, locale, account: !!cmsAccount() }))
      }
      catch (err) {
        console.error('[cms] could not send the invitation email', redactEmails(safeErrorMessage(err)))
      }
      invitation = { inviteUrl, emailed }
    }
    else if (links.signIn && updated.status === 'active') {
      const signInUrl = links.signIn
      event.waitUntil((async () => {
        for (const msg of [await emailChangedNotice(event, { to: target.email, newEmail, byAdmin: true, locale }), await emailSetNotice(event, { to: newEmail, url: signInUrl, locale })]) {
          await sendCmsMail(msg).catch((err) => console.error('[cms] could not send the email change notice', redactEmails(safeErrorMessage(err))))
        }
      })())
    }
  }
  return { user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, status: updated.status }, ...invitation }
})

/** The acting administrator's own password, for a change of someone's email (422 on `password` when wrong or missing). */
async function checkOwnPassword(event: any, myId: string, myEmail: string | undefined, password: string | undefined) {
  const ip = clientIp(event)
  const signInKey = `login:email:${normalizeEmail(myEmail ?? '')}`
  if (!(await rateLimit(`login:ip:${ip}`, 30, WINDOW)) || !(await rateLimit(signInKey, 10, WINDOW))) {
    throw tooManyRequests(event, 'Too many attempts; wait a few minutes and try again', WINDOW)
  }
  const { db, reg } = useCms()
  const [u] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, myId))
  const ok = u?.passwordHash && password
    ? await verifyPassword(u.passwordHash, password)
    : (await verifyPassword(await dummyPasswordHash(), password ?? ''), false)
  if (!ok) {
    await audit(event, 'account.email_failed', { meta: { ip } })
    throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: [{ path: ['password'], message: password ? 'Wrong password' : 'Required' }] })
  }
  await rateLimitRefund(`login:ip:${ip}`, WINDOW)
  await rateLimitRefund(signInKey, WINDOW)
}

function emailInUse() {
  return createError({ statusCode: 409, statusMessage: 'This address already has access', data: [{ path: ['email'], code: 'unique', message: 'Already has access' }] })
}
