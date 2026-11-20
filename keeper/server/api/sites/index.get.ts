import type { OverviewResponse } from '#keeper/types/keeper'

// The sites this person may see: every workspace of theirs, or ?workspace=<slug>&team=<slug|all>.
export default defineEventHandler(async (event): Promise<OverviewResponse> => {
  const me = await requireAccess(event)
  const q = getQuery(event)
  const rows = await loadSites(me, typeof q.workspace === 'string' ? q.workspace : undefined, typeof q.team === 'string' ? q.team : undefined)
  const [uptime, latest, traffic] = await Promise.all([uptimeFor(rows.map((r) => r.id)), latestKnown(rows), trafficGlances(rows)])
  return { sites: rows.map((r) => summarize(r, uptime.get(r.id), latest, traffic.get(r.id) ?? null)), latest }
})
