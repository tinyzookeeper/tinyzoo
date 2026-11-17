// GET /api/cms/_auth/email/revert/:token — what the "undo the change" page shows: the
// address the account gets back. 410 when the link no longer works (expired, used, or
// a change before it was undone). Opening the page changes nothing (mail scanners open
// links); the undo is a POST with a new password (revert.post.ts).
export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  if (!(await rateLimit(`email-revert:view:ip:${clientIp(event)}`, 40, 15 * 60_000))) throw tooManyRequests(event, 'Too many attempts; try again later', 15 * 60_000)
  const { db, reg } = useCms()
  const found = await findToken(db, reg, getRouterParam(event, 'token') ?? '', 'email-revert')
  const revert = found ? await readEmailRevert(db, reg, found.user.id, found.token.id) : null
  if (!found || !revert || found.user.status !== 'active') {
    throw createError({ statusCode: 410, statusMessage: 'This link has expired or was already used' })
  }
  return { email: revert.email }
})
