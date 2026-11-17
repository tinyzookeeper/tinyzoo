import { sql } from 'tinyzoo'

// POST /api/cms/_privacy/lookup { email } — what is stored about one email address:
// form submissions whose email fields match, the CMS account with that address, the
// audit entries about it and how many changes of sign-in address name it. Administrators only, rate limited; the address travels in the
// body (not the URL), so it does not end up in access logs.
export default defineEventHandler(async (event) => {
  const me = requireCmsAdmin(event)
  await privacyRateLimit(event, me.id, 'read')
  const { email } = parseOr422(privacyBody, await readBody(event))
  const { db, reg } = useCms()

  const found = await findSubmissions(db, reg, email)
  const account = await findAccount(db, reg, email)
  const entries = await findAuditEntries(db, reg, email, account?.id ?? null, 50)
  // A change of sign-in address waiting for this one, or a way back to it (cms_state).
  const states = await findEmailStates(db, reg, email)
  return {
    email,
    submissions: found.map(({ form, row }) => ({ ...submissionView(form, row), formLabel: form.label })),
    account: account ? accountView(account) : null,
    emailChanges: states.length,
    audit: { total: entries.length >= 50 ? await countAudit(db, reg, email, account?.id ?? null) : entries.length, latest: entries.slice(0, 20).map((a) => ({ id: a.id, action: a.action, entity: a.entity, createdAt: a.createdAt })) },
  }
})

async function countAudit(db: any, reg: any, email: string, accountId: string | null): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(reg.cmsAudit).where(auditCondition(reg, email, accountId))
  return row?.n ?? 0
}
