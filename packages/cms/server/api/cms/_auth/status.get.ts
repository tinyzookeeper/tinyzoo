import { sql } from 'tinyzoo'

// GET /api/cms/_auth/status — what the sign-in page needs to know: whether the CMS
// still needs its first administrator, and whether people can sign in with the tinyzoo
// account here (`account: { enabled: true }`; the key is absent when they cannot). Public.
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
  if (generated) await ensureSetupCode().catch((err) => console.error('[cms] could not prepare the setup code', safeErrorMessage(err)))
  const codeIn = configured ? 'config' : generated ? 'log' : null
  return {
    mode: 'builtin', needsSetup, needsToken: needsSetup && (configured || generated), ...(needsSetup && codeIn ? { codeIn } : {}),
    // Only that it is on: never the client's secret or anything the account service sent.
    ...(cmsAccount() ? { account: { enabled: true } } : {}),
  }
})
