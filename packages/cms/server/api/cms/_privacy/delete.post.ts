// POST /api/cms/_privacy/delete { email } — erase one person (GDPR right to erasure):
// their form submissions are deleted, their account (if any) is disabled and anonymised,
// and the audit entries about them lose their personal fields. Not your own account,
// never the last active administrator. Audited with counts only; administrators only,
// rate limited.
export default defineEventHandler(async (event) => {
  const me = requireCmsAdmin(event)
  await privacyRateLimit(event, me.id, 'delete')
  const { email } = parseOr422(privacyBody, await readBody(event))
  const { db, reg } = useCms()
  const result = await erasePerson(db, reg, email, me.id)
  await audit(event, 'privacy.delete', { meta: result })
  return { ok: true, ...result }
})
