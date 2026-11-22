import { eq, sql } from 'drizzle-orm'
import type { WorkspaceSettings } from '#keeper/types/keeper'

export default defineEventHandler(async (event): Promise<WorkspaceSettings> => {
  const { m } = await requireWorkspace(event)
  const [ws] = await useDb().select({
    alertEmails: schema.workspaces.alertEmails,
    signature: schema.workspaces.signature,
    sites: sql<number>`(select count(*)::int from "sites" s where s."workspace_id" = "workspaces"."id")`,
  }).from(schema.workspaces).where(eq(schema.workspaces.id, m.workspaceId))
  const logos = await logosOf([m.workspaceId])
  return {
    ...logoOrigin(logos.workspaces.get(m.workspaceId)),
    id: m.workspaceId,
    slug: m.slug,
    name: m.name,
    role: m.role,
    signature: ws?.signature ?? '',
    // Alert addresses are the workspace's business: only owners and admins see them.
    alertEmails: isManager(m) ? (ws?.alertEmails ?? []) : [],
    canDelete: m.role === 'owner' && !ws?.sites,
  }
})
