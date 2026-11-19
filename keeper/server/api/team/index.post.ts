import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Member } from '#shared/types/keeper'

// Add a person (owner). They get a generated password, shown once, to pass on; they can
// change it in Settings. An address that already has an account joins with that account.
const input = z.object({ name: z.string().trim().min(1).max(100), email: emailSchema })

export default defineEventHandler(async (event): Promise<{ member: Member; password: string | null }> => {
  const me = await requireOwner(event)
  const { name, email } = await readInput(event, input)
  const db = useDb()
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email))
  let password: string | null = null
  let user = existing
  if (!user) {
    password = randomBytes(12).toString('base64url')
    ;[user] = await db.insert(schema.users).values({ email, name, passwordHash: await hashPassword(password) }).returning()
  }
  const inserted = await db.insert(schema.memberships).values({ workspaceId: me.workspaceId, userId: user!.id, role: 'member' }).onConflictDoNothing().returning()
  if (!inserted.length) throw createError({ statusCode: 409, statusMessage: 'This person is already in the team' })
  setResponseStatus(event, 201)
  return { member: { id: user!.id, name: user!.name, email: user!.email, role: 'member', lastLoginAt: null }, password }
})
