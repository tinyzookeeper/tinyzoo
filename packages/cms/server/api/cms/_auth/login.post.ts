import { eq } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/_auth/login — email + password. One generic answer for every
// failure (unknown email, wrong password, not yet accepted, disabled), equal work
// either way, and rate limits per address and per IP (counting failed attempts only).
const body = z.object({ email: z.string().trim().toLowerCase().max(320), password: z.string().max(200) })
const WINDOW = 15 * 60_000

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const { email, password } = parseOr422(body, await readBody(event))
  const ip = clientIp(event)
  if (!(await rateLimit(`login:ip:${ip}`, 30, WINDOW)) || !(await rateLimit(`login:email:${email}`, 10, WINDOW))) {
    throw tooManyRequests(event, 'Too many sign-in attempts; wait a few minutes and try again', WINDOW)
  }

  await ensureDemoAccount(email, password) // the public demo account (cms.demo), if these are its details
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
  // A sign-in that worked is not a guess: only failures count towards the limits (a whole
  // office behind one address, or someone who signs in and out all day, must not lock itself out).
  await rateLimitRefund(`login:ip:${ip}`, WINDOW)
  await rateLimitRefund(`login:email:${email}`, WINDOW)
  await audit(event, 'auth.login', { userId: user.id })
  return { user: sessionUser(current) }
})
