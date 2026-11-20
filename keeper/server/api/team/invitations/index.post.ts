import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { InviteOutcome } from '#keeper/types/keeper'

// Invite people (owner or admin): their addresses, one role and the clients they will see.
// Each gets an e-mail with a link that works for 7 days. While mail is only logged, or when it
// fails, the link comes back to pass on by hand. Someone already in the team, or with an open
// invitation, is skipped with a reason; the others still go out.
const input = accessInput.extend({ emails: z.array(emailSchema).min(1).max(20) })

export default defineEventHandler(async (event): Promise<{ outcomes: InviteOutcome[] }> => {
  const me = await requireManager(event)
  const { emails, ...access } = await readInput(event, input)
  assertMayAssign(me, null, access.role)
  const all = access.role === 'owner' || access.role === 'admin' || access.allClients
  const clientIds = all ? [] : [...new Set(access.clientIds)]
  if (!all && !clientIds.length) throw createError({ statusCode: 422, statusMessage: 'clientIds: pick at least one client' })
  await assertClientsOf(me.workspaceId, clientIds)
  const db = useDb()
  const [inviter] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, me.userId))

  const outcomes: InviteOutcome[] = []
  for (const email of [...new Set(emails)]) {
    const [member] = await db.select({ id: schema.users.id }).from(schema.users)
      .innerJoin(schema.memberships, and(eq(schema.memberships.userId, schema.users.id), eq(schema.memberships.workspaceId, me.workspaceId)))
      .where(eq(schema.users.email, email))
    if (member) {
      outcomes.push({ email, ok: false, error: 'Already in the team' })
      continue
    }
    const { token, hash, expiresAt } = newInviteToken()
    const values = { role: access.role, allClients: all, clientIds, tokenHash: hash, invitedBy: me.userId, status: 'pending' as const, expiresAt, createdAt: new Date(), updatedAt: new Date() }
    // One row per address: an answered or expired invitation is replaced, an open one is not.
    const [row] = await db.insert(schema.workspaceInvitations)
      .values({ workspaceId: me.workspaceId, email, ...values })
      .onConflictDoUpdate({
        target: [schema.workspaceInvitations.workspaceId, schema.workspaceInvitations.email],
        set: values,
        setWhere: sql`${schema.workspaceInvitations.status} <> 'pending' or ${schema.workspaceInvitations.expiresAt} < now()`,
      })
      .returning({ id: schema.workspaceInvitations.id })
    if (!row) {
      outcomes.push({ email, ok: false, error: 'Already invited: send it again from the list' })
      continue
    }
    outcomes.push(await deliverInvitation(event, { email, role: access.role, token, expiresAt, workspaceId: me.workspaceId, inviterName: inviter?.name || null }))
  }
  setResponseStatus(event, 201)
  return { outcomes }
})
