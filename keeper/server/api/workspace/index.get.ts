import { eq } from 'drizzle-orm'
import type { WorkspaceSettings } from '#keeper/types/keeper'

export default defineEventHandler(async (event): Promise<WorkspaceSettings> => {
  const me = await requireMember(event)
  const [ws] = await useDb().select().from(schema.workspaces).where(eq(schema.workspaces.id, me.workspaceId))
  return { name: ws!.name, alertEmails: ws!.alertEmails ?? [] }
})
