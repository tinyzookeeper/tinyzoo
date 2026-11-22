import { eq } from 'drizzle-orm'
import { z } from 'zod'

// A new account, signed in at once. The address is confirmed by a link in an e-mail; in
// development (e-mail only printed) the answer carries the link, to open by hand.
const input = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema, locale: localeSchema.default('cs') })

export default defineEventHandler(async (event) => {
  await migrationsReady()
  const data = await readInput(event, input)
  if (tooManyAttempts(`signup:${clientIp(event)}`, 10)) throw fail(429, 'tooMany', 'Too many attempts, try again in a few minutes')
  const db = useDb()
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, data.email))
  if (existing) throw fail(409, 'email.taken', 'An account with this e-mail already exists')
  const passwordHash = await hashPassword(data.password)
  let userId: string
  try {
    const [user] = await db.insert(schema.users).values({ email: data.email, name: data.name, passwordHash, locale: data.locale }).returning({ id: schema.users.id })
    userId = user!.id
  }
  catch (err: any) {
    if (err?.code === '23505' || err?.cause?.code === '23505') throw fail(409, 'email.taken', 'An account with this e-mail already exists')
    throw err
  }
  await startSession(event, userId)
  const devVerifyUrl = await sendVerification(event, { id: userId, ...data })
  setResponseStatus(event, 201)
  return { ok: true, devVerifyUrl }
})
