import { eq } from 'drizzle-orm'

// Send a test e-mail to myself (owner or admin), to see that the SMTP settings work.
export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  if (!me.memberships.some(isManager)) throw createError({ statusCode: 403, statusMessage: 'Only an owner or admin can send a test e-mail' })
  if (tooManyAttempts(`mail-test:${me.userId}`, 5)) throw createError({ statusCode: 429, statusMessage: 'Too many test e-mails, try again in a few minutes' })
  const [user] = await useDb().select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, me.userId))
  const status = mailStatus()
  const via = status.host ? ' through ' + status.host : ''
  const result = await sendMail({
    to: [user!.email],
    subject: 'Keeper can send e-mail',
    text: `This is a test from Keeper${via}. Alerts and invitations will arrive the same way.\n\n— Keeper`,
  })
  if (result.status === 'failed') throw createError({ statusCode: 502, statusMessage: `Could not send: ${result.error}` })
  return { status: result.status, to: user!.email }
})
