import { sql } from '@my-cms/core'

// GET /api/cms/_auth/status — what the sign-in page needs to know: whether the CMS
// still needs its first administrator. Public.
export default defineEventHandler(async () => {
  if (cmsAuthMode() !== 'builtin') return { mode: 'external', needsSetup: false }
  const { db, reg } = useCms()
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(reg.cmsUsers)
  const needsSetup = (row?.n ?? 0) === 0
  // Whether first-run setup asks for the deploy's setup code (never the code itself).
  return { mode: 'builtin', needsSetup, needsToken: needsSetup && !!setupToken() }
})
