import { sql } from '@my-cms/core'

// GET /api/cms/_auth/status — what the sign-in page needs to know: whether the CMS
// still needs its first administrator. Public.
export default defineEventHandler(async () => {
  if (cmsAuthMode() !== 'builtin') return { mode: 'external', needsSetup: false }
  const { db, reg } = useCms()
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(reg.cmsUsers)
  return { mode: 'builtin', needsSetup: (row?.n ?? 0) === 0 }
})
