// POST /api/cms/_privacy/delete { email } — erase one person (GDPR right to erasure):
// their form submissions are deleted, their account (if any) is disabled and anonymised,
// and the audit entries about them lose their personal fields. Not your own account,
// never the last active administrator. Audited with counts only; administrators only,
// rate limited. A link to a tinyzoo account goes with the account, and the account service is told.
export default defineEventHandler(async (event) => {
  const me = requireCmsAdmin(event)
  await privacyRateLimit(event, me.id, 'delete')
  const { email } = parseOr422(privacyBody, await readBody(event))
  const { db, reg } = useCms()
  const { unlinked, ...result } = await erasePerson(db, reg, email, me.id)
  await audit(event, 'privacy.delete', { meta: result })
  // The person was linked to a tinyzoo account: the account service hears that this site no
  // longer lets them in, as when a user is deleted (after the response; counts only are kept here).
  const account = cmsAccount()
  if (unlinked && account && unlinked.issuer === account.issuer) void reportAccountMembership(event, account, { sub: unlinked.sub, role: unlinked.role, active: false })
  return { ok: true, ...result }
})
