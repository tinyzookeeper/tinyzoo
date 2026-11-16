import { eq, sql } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/_auth/setup — create the first administrator on a fresh install and
// sign them in. Refused (409) as soon as any account exists. The check and the
// insert run under a transaction-scoped advisory lock, so two simultaneous setups
// cannot both win.
//
// Setup also needs a code, so a fresh deploy cannot be claimed by whoever opens the
// page first: NUXT_CMS_AUTH_SETUP_TOKEN when it is set, otherwise (in production) a
// one-time code the server prints in its log (cmsSetupCode.ts). Development needs none.
const body = z.object({ name: z.string().trim().min(1).max(120), email: emailSchema, password: passwordSchema, token: z.string().max(200).optional() })
const SETUP_LOCK = 72_011_001

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  if (!(await rateLimit(`setup:${clientIp(event)}`, 10, 15 * 60_000))) throw tooManyRequests(event, 'Too many attempts; try again later', 15 * 60_000)
  const data = parseOr422(body, await readBody(event))
  const required = setupToken()
  const codeOk = required
    ? constantTimeEqual(data.token ?? '', required)
    : setupCodeApplies() ? await setupCodeAccepts(data.token) : true
  if (!codeOk) {
    await audit(event, 'auth.setup_failed', { userId: null })
    throw createError({ statusCode: 403, statusMessage: 'The setup code is missing or wrong', data: { code: 'setup_token' } })
  }
  const { db, reg } = useCms()
  const passwordHash = await hashPassword(data.password)

  const user = await db.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${SETUP_LOCK})`)
    const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(reg.cmsUsers)
    if ((row?.n ?? 0) > 0) throw createError({ statusCode: 409, statusMessage: 'Already set up; sign in instead' })
    const [created] = await tx.insert(reg.cmsUsers).values({
      email: data.email, name: data.name, role: 'admin', status: 'active', passwordHash, lastLoginAt: new Date(),
    }).returning()
    // The code has done its job; it must not outlive the first account.
    await tx.delete(reg.cmsState).where(eq(reg.cmsState.key, SETUP_CODE_KEY))
    return created
  })

  await startCmsSession(event, user)
  await audit(event, 'auth.setup', { userId: user.id })
  setResponseStatus(event, 201)
  return { user: sessionUser(user) }
})
