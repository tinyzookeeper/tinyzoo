import { eq } from 'tinyzoo'

// POST /api/cms/_users/:id/resend — send a fresh invitation link (the old one stops
// working). Returns the link for copying. Administrators only.
export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsAdmin(event)
  const id = getIdParam(event)
  const { db, reg } = useCms()
  const [user] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, id))
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  if (user.status !== 'invited') throw createError({ statusCode: 409, statusMessage: 'This person has already accepted' })

  const secret = await issueToken(db, reg, { userId: user.id, kind: 'invite', ttlMs: INVITE_TTL_MS, createdBy: me.id })
  const inviteUrl = adminLink(event, `/admin/invite/${secret}`)
  let emailed = false
  try {
    emailed = await sendCmsMail(inviteEmail({ to: user.email, inviter: me.name || me.email || 'An administrator', url: inviteUrl, role: user.role, locale: me.locale || requestLocale(event) }))
  }
  catch (err) {
    console.error('[cms] could not send the invitation email', redactEmails(safeErrorMessage(err)))
  }
  await audit(event, 'user.resend', { recordId: id, meta: { emailed } })
  return { inviteUrl, emailed }
})
