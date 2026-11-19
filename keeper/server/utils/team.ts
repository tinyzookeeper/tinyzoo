import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import type { Member, MemberRole } from '#keeper/types/keeper'

// People in the team: their role and which clients' sites they see.

export const accessInput = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  // Owners and admins always see everything; for them this is ignored.
  allClients: z.boolean().default(true),
  clientIds: z.array(z.string().uuid()).max(500).default([]),
})
export type AccessInput = z.infer<typeof accessInput>

/** Who may give or take which role: an admin never touches owners, and only an owner makes one. */
export function assertMayAssign(me: SignedInMember, from: MemberRole | null, to: MemberRole): void {
  if (me.role === 'owner') return
  if (from === 'owner' || to === 'owner') throw createError({ statusCode: 403, statusMessage: 'Only an owner can make or change an owner' })
}

/** Store which clients a person sees. Ids not of this workspace are refused. */
export async function setMemberClients(tx: any, workspaceId: string, userId: string, data: AccessInput): Promise<void> {
  const all = data.role === 'owner' || data.role === 'admin' || data.allClients
  const ids = all ? [] : [...new Set(data.clientIds)]
  if (ids.length) {
    const found = await tx.select({ id: schema.clients.id }).from(schema.clients)
      .where(and(eq(schema.clients.workspaceId, workspaceId), inArray(schema.clients.id, ids)))
    if (found.length !== ids.length) throw createError({ statusCode: 422, statusMessage: 'clientIds: some of these clients do not exist' })
  }
  await tx.update(schema.memberships).set({ role: data.role, allClients: all })
    .where(and(eq(schema.memberships.workspaceId, workspaceId), eq(schema.memberships.userId, userId)))
  await tx.delete(schema.membershipClients)
    .where(and(eq(schema.membershipClients.workspaceId, workspaceId), eq(schema.membershipClients.userId, userId)))
  if (ids.length) await tx.insert(schema.membershipClients).values(ids.map((clientId) => ({ workspaceId, userId, clientId })))
}

/** The team as Settings lists it. People limited to some clients see only themselves. */
export async function listTeam(me: SignedInMember): Promise<Member[]> {
  const db = useDb()
  const rows = await db.select({
    id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.memberships.role,
    allClients: schema.memberships.allClients, lastLoginAt: schema.users.lastLoginAt,
  }).from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.workspaceId, me.workspaceId), seesAllClients(me) && me.role !== 'viewer' ? undefined : eq(schema.memberships.userId, me.userId)))
    .orderBy(schema.memberships.createdAt)
  const limits = await db.select({ userId: schema.membershipClients.userId, clientId: schema.membershipClients.clientId })
    .from(schema.membershipClients).where(eq(schema.membershipClients.workspaceId, me.workspaceId))
  return rows.map((r) => {
    const all = r.role === 'owner' || r.role === 'admin' || r.allClients
    return {
      ...r,
      allClients: all,
      clientIds: all ? [] : limits.filter((l) => l.userId === r.id).map((l) => l.clientId),
      lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
    }
  })
}
