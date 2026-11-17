import { eq } from 'tinyzoo'

// GET /api/cms/_auth/email — the change of your sign-in email that is waiting for its
// link to be opened, if any: { pending: { email, expiresAt } | null }.
export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsUser(event)
  const { db, reg } = useCms()
  const pending = await readEmailChange(db, reg, me.id)
  if (!pending) return { pending: null }
  const [token] = await db.select().from(reg.cmsTokens).where(eq(reg.cmsTokens.id, pending.tokenId))
  const [user] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, me.id))
  const usable = !!token && !token.usedAt && !!user && emailChangeUsable(pending, token, user)
  return { pending: usable ? { email: pending.email, expiresAt: pending.expiresAt } : null }
})
