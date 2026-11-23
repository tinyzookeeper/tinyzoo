import { eq } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/_users — invite someone. Creates the account (status "invited"),
// emails a one-time link, and returns the link too so an administrator can pass it
// on another way if the email gets lost. Administrators only.
const body = z.object({
  email: emailSchema,
  name: z.string().trim().max(120).optional().default(''),
  role: assignableRoleSchema(),
})

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsAdmin(event)
  const data = parseOr422(body, await readBody(event))
  const { db, reg } = useCms()

  const [existing] = await db.select({ id: reg.cmsUsers.id }).from(reg.cmsUsers).where(eq(reg.cmsUsers.email, data.email))
  // An address another account can still take back (a way back from a change) counts as taken.
  if (existing || await emailReserved(db, reg, data.email)) {
    throw createError({ statusCode: 409, statusMessage: 'This person already has access', data: [{ path: ['email'], code: 'unique', message: 'Already has access' }] })
  }

  const [user] = await db.insert(reg.cmsUsers).values({ email: data.email, name: data.name, role: data.role, status: 'invited' }).returning()
  if (!user) throw createError({ statusCode: 500, statusMessage: 'Could not create the account' })
  const secret = await issueToken(db, reg, { userId: user.id, kind: 'invite', ttlMs: INVITE_TTL_MS, createdBy: me.id })
  const inviteUrl = adminLink(event, `/admin/invite/${secret}`)

  let emailed = false
  try {
    emailed = await sendCmsMail(await inviteEmail(event, { to: user.email, inviter: me.name || me.email || 'An administrator', url: inviteUrl, role: user.role, locale: me.locale || requestLocale(event), account: !!cmsAccount() }))
  }
  catch (err) {
    console.error('[cms] could not send the invitation email', redactEmails(safeErrorMessage(err)))
  }
  await audit(event, 'user.invite', { recordId: user.id, meta: { email: user.email, role: user.role, emailed } })
  setResponseStatus(event, 201)
  return { user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status }, inviteUrl, emailed }
})
