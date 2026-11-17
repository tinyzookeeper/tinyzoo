import { CMS_ROLES, eq, sql } from 'tinyzoo'
import { z } from 'zod'

// PATCH /api/cms/_users/:id — change someone's role or sign-in email, or disable /
// re-enable them. You cannot change your own role, email or access here (your own
// email changes on your account page, with your password and a confirmation link),
// and the last active administrator always stays. Disabling, a new role and a new
// email sign the person out everywhere at once.
//
// A new email takes effect at once (the administrator vouches for it): links already
// sent stop working (a password reset waiting in the old mailbox would otherwise still
// open the account), the old address is told and the new one gets a note. For someone
// who has not accepted their invitation yet, the invitation goes to the new address
// instead (the old link stops working) and its link is returned, as when resending.
const body = z.object({
  role: z.enum(CMS_ROLES).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  email: emailSchema.pipe(z.string().max(254)).optional(),
})

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
  if (newEmail) {
    if (isDemoAccount(target.email)) throw createError({ statusCode: 403, statusMessage: 'The demo account keeps its email', data: { code: 'demo_account' } })
    if (await emailTaken(db, reg, newEmail, id)) throw emailInUse()
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
      if (row && newEmail) await endLinksOf(tx, reg, id, ['reset', 'email', 'invite'])
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

  let invitation: { inviteUrl: string; emailed: boolean } | undefined
  if (newEmail) {
    await audit(event, 'user.email', { recordId: id, meta: { email: newEmail, previousEmail: target.email } })
    const locale = updated.locale || me.locale || requestLocale(event)
    if (updated.status === 'invited') {
      // Not accepted yet: the invitation goes to the new address (nothing to the old one — it may be a typo, a stranger's).
      const secret = await issueToken(db, reg, { userId: id, kind: 'invite', ttlMs: INVITE_TTL_MS, createdBy: me.id })
      const inviteUrl = adminLink(event, `/admin/invite/${secret}`)
      let emailed = false
      try {
        emailed = await sendCmsMail(inviteEmail({ to: newEmail, inviter: me.name || me.email || 'An administrator', url: inviteUrl, role: updated.role, locale }))
      }
      catch (err) {
        console.error('[cms] could not send the invitation email', redactEmails(safeErrorMessage(err)))
      }
      invitation = { inviteUrl, emailed }
    }
    else {
      const signInUrl = adminLink(event, '/admin/login')
      event.waitUntil((async () => {
        for (const msg of [emailChangedNotice({ to: target.email, newEmail, byAdmin: true, locale }), emailSetNotice({ to: newEmail, url: signInUrl, locale })]) {
          await sendCmsMail(msg).catch((err) => console.error('[cms] could not send the email change notice', redactEmails(safeErrorMessage(err))))
        }
      })())
    }
  }
  return { user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, status: updated.status }, ...invitation }
})

function emailInUse() {
  return createError({ statusCode: 409, statusMessage: 'This address already has access', data: [{ path: ['email'], code: 'unique', message: 'Already has access' }] })
}
