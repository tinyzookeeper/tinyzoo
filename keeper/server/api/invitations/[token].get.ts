import { and, eq, inArray } from 'drizzle-orm'
import type { InvitationPreview } from '#keeper/types/keeper'

// Public: what an invitation link is for, so its page can say who invited whom, to what, and
// whether to make an account or sign in. The token is the secret; without it nothing is shown.
export default defineEventHandler(async (event): Promise<InvitationPreview> => {
  const token = getRouterParam(event, 'token') ?? ''
  const db = useDb()
  const [inv] = await db.select({
    email: schema.workspaceInvitations.email,
    workspaceId: schema.workspaceInvitations.workspaceId,
    teamIds: schema.workspaceInvitations.teamIds,
    role: schema.workspaceInvitations.role,
    status: schema.workspaceInvitations.status,
    expiresAt: schema.workspaceInvitations.expiresAt,
    workspaceName: schema.workspaces.name,
    inviterName: schema.users.name,
  }).from(schema.workspaceInvitations)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceInvitations.workspaceId))
    .leftJoin(schema.users, eq(schema.users.id, schema.workspaceInvitations.invitedBy))
    .where(eq(schema.workspaceInvitations.tokenHash, hashInviteToken(token)))
  if (!inv) throw createError({ statusCode: 404, statusMessage: 'This invitation link is not valid. It may have been sent again or taken back.' })
  const [account] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, inv.email))
  // A guest is asked to look at their own sites, so the page names the teams; a colleague's
  // teams are the workspace's business, and the token holder is not in it yet.
  const teams = inv.role === 'guest' && inv.teamIds.length
    ? (await db.select({ name: schema.teams.name }).from(schema.teams).where(and(eq(schema.teams.workspaceId, inv.workspaceId), inArray(schema.teams.id, inv.teamIds))).orderBy(schema.teams.name)).map((t) => t.name)
    : []
  const expired = inv.status === 'pending' && inv.expiresAt.getTime() < Date.now()
  return {
    email: inv.email,
    role: inv.role,
    workspaceName: inv.workspaceName,
    teams,
    inviterName: inv.inviterName || null,
    expiresAt: inv.expiresAt.toISOString(),
    status: expired ? 'expired' : inv.status,
    hasAccount: !!account,
  }
})
