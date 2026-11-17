// DELETE /api/cms/_auth/email — cancel your pending change of sign-in email: the link
// that was sent stops working.
export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsAccount(event)
  const { db, reg } = useCms()
  const pending = await readEmailChange(db, reg, me.id)
  await endLinksOf(db, reg, me.id, ['email'])
  if (pending) await audit(event, 'account.email_cancel', { meta: { email: pending.email } })
  return { ok: true }
})
