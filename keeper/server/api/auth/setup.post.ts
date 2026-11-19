import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { z } from 'zod'

// First run: the first account, its team, signed in. Only while there is no account.
// In production it asks for NUXT_SETUP_TOKEN, so a fresh deploy cannot be taken over.
const input = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
  workspace: z.string().trim().min(1).max(100),
  token: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  await migrationsReady()
  const data = await readInput(event, input)
  const expected = String(useRuntimeConfig().setupToken || '')
  if (process.env.NODE_ENV === 'production' && !expected) throw createError({ statusCode: 403, statusMessage: 'Set NUXT_SETUP_TOKEN on the server first' })
  if (expected) {
    const a = Buffer.from(data.token ?? ''), b = Buffer.from(expected)
    if (tooManyAttempts(`setup:${getRequestIP(event, { xForwardedFor: true })}`, 10) || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw createError({ statusCode: 403, statusMessage: 'Wrong setup token' })
    }
  }
  const db = useDb()
  const passwordHash = await hashPassword(data.password)
  const userId = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4242)`)
    const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.users)
    if ((row?.n ?? 0) > 0) throw createError({ statusCode: 409, statusMessage: 'Keeper is already set up' })
    const [ws] = await tx.insert(schema.workspaces).values({ name: data.workspace }).returning({ id: schema.workspaces.id })
    const [user] = await tx.insert(schema.users).values({ email: data.email, name: data.name, passwordHash }).returning({ id: schema.users.id })
    await tx.insert(schema.memberships).values({ workspaceId: ws!.id, userId: user!.id, role: 'owner' })
    return user!.id
  })
  await startSession(event, userId)
  setResponseStatus(event, 201)
  return { ok: true }
})
