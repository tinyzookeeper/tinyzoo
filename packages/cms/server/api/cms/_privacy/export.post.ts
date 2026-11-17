// POST /api/cms/_privacy/export { email } — everything stored about one email address,
// as a JSON file to hand to the person (GDPR right of access). Audited; administrators
// only, rate limited. Never includes password hashes or sign-in secrets.
export default defineEventHandler(async (event) => {
  const me = requireCmsAdmin(event)
  await privacyRateLimit(event, me.id, 'read')
  const { email } = parseOr422(privacyBody, await readBody(event))
  const { db, reg } = useCms()

  const found = await findSubmissions(db, reg, email)
  const account = await findAccount(db, reg, email)
  const entries = await findAuditEntries(db, reg, email, account?.id ?? null)
  const states = await findEmailStates(db, reg, email)
  const document = {
    exportedAt: new Date().toISOString(),
    email,
    formSubmissions: found.map(({ form, row }) => submissionView(form, row)),
    account: account ? accountView(account) : null,
    // A change of address names another address too; it is left out where it isn't this person's (auditExportMeta).
    auditEntries: entries.map((a) => ({ id: a.id, createdAt: a.createdAt, action: a.action, entity: a.entity, recordId: a.recordId, userId: a.userId, meta: auditExportMeta(a, email, account?.id ?? null) })),
    // A change of sign-in address waiting for this one to be confirmed, or a way back to it after a change.
    emailChanges: states.map((r) => ({ kind: r.kind === 'change' ? 'waiting for confirmation' : 'way back to this address', accountId: r.userId, expiresAt: r.expiresAt })),
  }
  // The audit entry records that an export happened and its size, never the address.
  await audit(event, 'privacy.export', { meta: { submissions: found.length, account: !!account, auditEntries: entries.length } })
  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'content-disposition', 'attachment; filename="personal-data.json"')
  return JSON.stringify(document, null, 2)
})
