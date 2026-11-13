import { eq } from '@my-cms/core'
import { z } from 'zod'

// POST /api/cms/_auth/login — email + password. One generic answer for every
// failure (unknown email, wrong password, not yet accepted, disabled), equal work
// either way, and rate limits per address and per IP.
const body = z.object({ email: z.string().trim().toLowerCase().max(320), password: z.string().max(200) })
const WINDOW = 15 * 60_000

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const { email, password } = parseOr422(body, await readBody(event))
  const ip = clientIp(event)
  if (!(await rateLimit(`login:ip:${ip}`, 30, WINDOW)) || !(await rateLimit(`login:email:${email}`, 10, WINDOW))) {
    throw createError({ statusCode: 429, statusMessage: 'Too many sign-in attempts; wait a few minutes and try again' })
  }

  const { db, reg } = useCms()
  const [user] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.email, email))
  const ok = user?.passwordHash
    ? await verifyPassword(user.passwordHash, password)
    : (await verifyPassword(await dummyPasswordHash(), password), false)

  if (!user || !ok || user.status !== 'active') {
    await audit(event, 'auth.login_failed', { userId: user?.id ?? null, meta: { email, ip } })
    throw createError({ statusCode: 401, statusMessage: 'Wrong email or password' })
  }

  const updates: Record<string, unknown> = { lastLoginAt: new Date() }
  if (passwordNeedsReHash(user.passwordHash!)) updates.passwordHash = await hashPassword(password)
  const [updated] = await db.update(reg.cmsUsers).set(updates).where(eq(reg.cmsUsers.id, user.id)).returning()
  const current = updated ?? user

  await startCmsSession(event, current)
  await audit(event, 'auth.login', { userId: user.id })
  return { user: sessionUser(current) }
})
