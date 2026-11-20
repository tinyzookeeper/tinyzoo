import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { InviteOutcome } from '#keeper/types/keeper'

// Invite people (owner or admin): their addresses, one role and the teams they join (none: the
// default team; a guest always names teams). Each gets an e-mail with a link that works for 7
// days. While mail is only logged, or when it fails, the link comes back to pass on by hand.
// Someone already in the workspace, or with an open invitation, is skipped with a reason.
const input = z.object({
  emails: z.array(emailSchema).min(1).max(20),
  role: z.enum(['owner', 'admin', 'member', 'guest']),
  teamIds: z.array(z.string().uuid()).max(100).default([]),
})

export default defineEventHandler(async (event): Promise<{ outcomes: InviteOutcome[] }> => {
  const { access, m } = await requireWorkspace(event, { manager: true })
  const { emails, role, teamIds: picked } = await readInput(event, input)
  assertMayAssign(m, null, role)
  const teamIds = [...new Set(picked)]
  if (role === 'guest' && !teamIds.length) throw createError({ statusCode: 422, statusMessage: 'teamIds: a guest sees only their teams: pick at least one' })
  const db = useDb()
  await assertTeamsOf(db, m.workspaceId, teamIds)
  const [inviter] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, access.userId))

  const outcomes: InviteOutcome[] = []
  for (const email of [...new Set(emails)]) {
    const [member] = await db.select({ id: schema.users.id }).from(schema.users)
      .innerJoin(schema.workspaceMembers, and(eq(schema.workspaceMembers.userId, schema.users.id), eq(schema.workspaceMembers.workspaceId, m.workspaceId)))
      .where(eq(schema.users.email, email))
    if (member) {
      outcomes.push({ email, ok: false, error: `Already in ${m.name}` })
      continue
    }
    const { token, hash, expiresAt } = newInviteToken()
    const values = { role, teamIds, tokenHash: hash, invitedBy: access.userId, status: 'pending' as const, expiresAt, createdAt: new Date(), updatedAt: new Date() }
    // One row per address: an answered or expired invitation is replaced, an open one is not.
    const [row] = await db.insert(schema.workspaceInvitations)
      .values({ workspaceId: m.workspaceId, email, ...values })
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
    outcomes.push(await deliverInvitation(event, { email, role, token, expiresAt, workspaceId: m.workspaceId, inviterName: inviter?.name || null }))
  }
  setResponseStatus(event, 201)
  return { outcomes }
})
