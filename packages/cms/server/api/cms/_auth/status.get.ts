import { sql } from 'tinyzoo'

// GET /api/cms/_auth/status — what the sign-in page needs to know: whether the CMS
// still needs its first administrator. Public.
export default defineEventHandler(async () => {
  if (cmsAuthMode() !== 'builtin') return { mode: 'external', needsSetup: false }
  const { db, reg } = useCms()
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(reg.cmsUsers)
  const needsSetup = (row?.n ?? 0) === 0
  // Whether first-run setup asks for a setup code, and where to find it (never the code
  // itself): 'config' = the deploy's NUXT_CMS_AUTH_SETUP_TOKEN, 'log' = printed by the server.
  const configured = !!setupToken()
  const generated = needsSetup && setupCodeApplies()
  // The start-up step may have missed (database not ready); make sure there is a code.
  if (generated) await ensureSetupCode().catch((err) => console.error('[cms] could not prepare the setup code', (err as Error)?.message ?? err))
  return { mode: 'builtin', needsSetup, needsToken: needsSetup && (configured || generated), codeIn: needsSetup ? (configured ? 'config' : generated ? 'log' : null) : null }
})
