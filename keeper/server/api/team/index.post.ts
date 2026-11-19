import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Member } from '#keeper/types/keeper'

// Add a person (owner or admin), with their role and the clients they see. They get a
// generated password, shown once, to pass on; they can change it in Settings. An address
// that already has an account joins with that account.
const input = accessInput.extend({ name: z.string().trim().min(1).max(100), email: emailSchema })

export default defineEventHandler(async (event): Promise<{ member: Member; password: string | null }> => {
  const me = await requireManager(event)
  const { name, email, ...access } = await readInput(event, input)
  assertMayAssign(me, null, access.role)
  const db = useDb()
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email))
  let password: string | null = null
  let user = existing
  if (!user) {
    password = randomBytes(12).toString('base64url')
    ;[user] = await db.insert(schema.users).values({ email, name, passwordHash: await hashPassword(password) }).returning()
  }
  await db.transaction(async (tx) => {
    const inserted = await tx.insert(schema.memberships).values({ workspaceId: me.workspaceId, userId: user!.id, role: access.role }).onConflictDoNothing().returning()
    if (!inserted.length) throw createError({ statusCode: 409, statusMessage: 'This person is already in the team' })
    await setMemberClients(tx, me.workspaceId, user!.id, access)
  })
  const member = (await listTeam(me)).find((m) => m.id === user!.id)!
  setResponseStatus(event, 201)
  return { member, password }
})
