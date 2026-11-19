import { sql } from 'drizzle-orm'
import type { OverviewResponse } from '#keeper/types/keeper'

// The sites this person may see, with their clients (for the filter).
export default defineEventHandler(async (event): Promise<OverviewResponse> => {
  const me = await requireAccess(event)
  const rows = await loadSites(me)
  const [uptime, latest, clients] = await Promise.all([
    uptimeFor(rows.map((r) => r.id)),
    latestKnown(rows),
    useDb().select({ id: schema.clients.id, name: schema.clients.name }).from(schema.clients).where(visibleClients(me)).orderBy(sql`lower(${schema.clients.name})`),
  ])
  return { sites: rows.map((r) => summarize(r, uptime.get(r.id), latest)), latest, clients }
})
