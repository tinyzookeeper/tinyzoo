import { eq } from 'drizzle-orm'
import type { OverviewResponse } from '#keeper/types/keeper'

export default defineEventHandler(async (event): Promise<OverviewResponse> => {
  const me = await requireAccess(event)
  const rows = await useDb().select().from(schema.sites).where(eq(schema.sites.workspaceId, me.workspaceId)).orderBy(schema.sites.name)
  const [uptime, latest] = await Promise.all([uptimeFor(rows.map((r) => r.id)), latestKnown(rows)])
  return { sites: rows.map((r) => summarize(r, uptime.get(r.id), latest)), latest }
})
