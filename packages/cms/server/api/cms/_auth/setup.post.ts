import { sql } from '@my-cms/core'
import { z } from 'zod'

// POST /api/cms/_auth/setup — create the first administrator on a fresh install and
// sign them in. Refused (409) as soon as any account exists. The check and the
// insert run under a transaction-scoped advisory lock, so two simultaneous setups
// cannot both win.
const body = z.object({ name: z.string().trim().min(1).max(120), email: emailSchema, password: passwordSchema })
const SETUP_LOCK = 72_011_001

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  if (!(await rateLimit(`setup:${clientIp(event)}`, 10, 15 * 60_000))) throw createError({ statusCode: 429, statusMessage: 'Too many attempts; try again later' })
  const data = parseOr422(body, await readBody(event))
  const { db, reg } = useCms()
  const passwordHash = await hashPassword(data.password)

  const user = await db.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${SETUP_LOCK})`)
    const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(reg.cmsUsers)
    if ((row?.n ?? 0) > 0) throw createError({ statusCode: 409, statusMessage: 'Already set up; sign in instead' })
    const [created] = await tx.insert(reg.cmsUsers).values({
      email: data.email, name: data.name, role: 'admin', status: 'active', passwordHash, lastLoginAt: new Date(),
    }).returning()
    return created
  })

  await startCmsSession(event, user)
  await audit(event, 'auth.setup', { userId: user.id })
  setResponseStatus(event, 201)
  return { user: sessionUser(user) }
})
