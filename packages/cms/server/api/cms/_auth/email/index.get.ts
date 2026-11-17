// GET /api/cms/_auth/email — the change of your sign-in email that is waiting for its
// link to be opened, if any: { pending: { email, expiresAt } | null }. A change that can
// no longer happen (expired, cancelled by a new password) is forgotten on the way.
export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsAccount(event)
  const { db, reg } = useCms()
  const pending = await readLiveEmailChange(db, reg, me.id)
  return { pending: pending ? { email: pending.email, expiresAt: pending.expiresAt } : null }
})
