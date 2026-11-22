// Send the confirmation link again (signed in, address not confirmed yet).
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  if (me.emailVerifiedAt) return { ok: true, devVerifyUrl: null }
  if (tooManyAttempts(`verify-resend:${me.id}`, 5, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  return { ok: true, devVerifyUrl: await sendVerification(event, me) }
})
