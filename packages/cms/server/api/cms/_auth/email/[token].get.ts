// GET /api/cms/_auth/email/:token — what the confirmation page shows: the new address
// the link is for. 410 when the link no longer works (expired, used, replaced by a
// newer request, or cancelled by a password change). Opening the page changes
// nothing: mail scanners open links too. The change is a POST (confirm.post.ts).
export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  if (!(await rateLimit(`email-confirm:ip:${clientIp(event)}`, 40, 15 * 60_000))) throw tooManyRequests(event, 'Too many attempts; try again later', 15 * 60_000)
  const { db, reg } = useCms()
  const found = await findToken(db, reg, getRouterParam(event, 'token') ?? '', 'email')
  // The account's pending change, if it can still happen (a dead one is deleted here).
  const pending = found ? await readLiveEmailChange(db, reg, found.user.id) : null
  if (!found || !emailChangeUsable(pending, found.token, found.user)) {
    throw createError({ statusCode: 410, statusMessage: 'This link has expired or was already used' })
  }
  return { email: pending.email }
})
