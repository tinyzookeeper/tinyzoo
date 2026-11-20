import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

// Public: accept an invitation, and be signed in to its team.
// - Signed in with the invited address: joins with that account.
// - A new address: makes the account here (name and password); the link is the proof of the address.
// - An address that has an account: its password, so the link alone never opens an account.
const input = z.object({
  token: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(100).optional(),
  password: z.string().min(1).max(200).optional(),
})

export default defineEventHandler(async (event) => {
  const data = await readInput(event, input)
  const db = useDb()
  const [inv] = await db.select().from(schema.workspaceInvitations)
    .where(eq(schema.workspaceInvitations.tokenHash, hashInviteToken(data.token)))
  if (!inv) throw createError({ statusCode: 404, statusMessage: 'This invitation link is not valid. It may have been sent again or taken back.' })
  if (inv.status !== 'pending') throw createError({ statusCode: 409, statusMessage: `This invitation was already ${inv.status}` })
  if (inv.expiresAt.getTime() < Date.now()) throw createError({ statusCode: 410, statusMessage: 'This invitation has expired. Ask for a new one.' })

  // Who is accepting: the signed-in account, an existing one by its password, or a new one.
  const session = await getUserSession(event)
  const [account] = await db.select({ id: schema.users.id, hash: schema.users.passwordHash, sv: schema.users.sessionVersion }).from(schema.users).where(eq(schema.users.email, inv.email))
  let userId: string | null = null
  if (session.user) {
    const [signedIn] = await db.select({ email: schema.users.email, sv: schema.users.sessionVersion }).from(schema.users).where(eq(schema.users.id, session.user.id))
    if (signedIn && signedIn.sv === session.sv) {
      if (signedIn.email !== inv.email) throw createError({ statusCode: 403, statusMessage: `This invitation is for ${inv.email}. Sign out first, then open the link again.` })
      userId = session.user.id
    }
  }
  if (!userId && account) {
    const key = `accept:${getRequestIP(event, { xForwardedFor: true })}:${inv.email}`
    if (isLimited(key)) throw createError({ statusCode: 429, statusMessage: 'Too many attempts, try again in a few minutes' })
    if (!data.password || !(await verifyPassword(account.hash, data.password))) {
      noteFailure(key)
      throw createError({ statusCode: 401, statusMessage: 'Wrong password' })
    }
    clearAttempts(key)
    userId = account.id
  }
  let newAccount: { name: string; passwordHash: string } | null = null
  if (!userId) {
    if (!data.name) throw createError({ statusCode: 422, statusMessage: 'name: Required' })
    const pw = passwordSchema.safeParse(data.password ?? '')
    if (!pw.success) throw createError({ statusCode: 422, statusMessage: `password: ${pw.error.issues[0]?.message ?? 'Invalid'}` })
    newAccount = { name: data.name, passwordHash: await hashPassword(pw.data) }
  }

  const joined = await db.transaction(async (tx) => {
    // Once only: the row is taken while it is still open.
    const [open] = await tx.select({ id: schema.workspaceInvitations.id }).from(schema.workspaceInvitations)
      .where(and(eq(schema.workspaceInvitations.id, inv.id), eq(schema.workspaceInvitations.status, 'pending')))
      .for('update')
    if (!open) throw createError({ statusCode: 409, statusMessage: 'This invitation was just used' })
    let id = userId
    if (!id) {
      const [made] = await tx.insert(schema.users).values({ email: inv.email, ...newAccount! }).onConflictDoNothing().returning({ id: schema.users.id })
      if (!made) throw createError({ statusCode: 409, statusMessage: 'An account with this address was just made: sign in to accept' })
      id = made.id
    }
    const inserted = await tx.insert(schema.memberships).values({ workspaceId: inv.workspaceId, userId: id, role: inv.role }).onConflictDoNothing().returning()
    if (inserted.length) {
      // Clients removed since the invitation went out are left out.
      const clientIds = inv.clientIds.length
        ? (await tx.select({ id: schema.clients.id }).from(schema.clients).where(and(eq(schema.clients.workspaceId, inv.workspaceId), inArray(schema.clients.id, inv.clientIds)))).map((c) => c.id)
        : []
      await setMemberClients(tx, inv.workspaceId, id, { role: inv.role, allClients: inv.allClients, clientIds })
    }
    else {
      // Already in the team (Postyard's rule): a viewer invited to work on the sites becomes
      // that role; nobody loses access by accepting an invitation.
      const [current] = await tx.select({ role: schema.memberships.role }).from(schema.memberships)
        .where(and(eq(schema.memberships.workspaceId, inv.workspaceId), eq(schema.memberships.userId, id)))
      if (current?.role === 'viewer' && inv.role !== 'viewer') {
        await tx.update(schema.memberships).set({ role: inv.role })
          .where(and(eq(schema.memberships.workspaceId, inv.workspaceId), eq(schema.memberships.userId, id)))
      }
    }
    await tx.update(schema.workspaceInvitations).set({ status: 'accepted', updatedAt: new Date() }).where(eq(schema.workspaceInvitations.id, inv.id))
    return id
  })
  await startSession(event, joined, inv.workspaceId)
  return { ok: true }
})
