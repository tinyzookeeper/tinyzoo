import type { ScopeTraffic } from '#keeper/types/traffic'

// GET /api/traffic?workspace=<slug>&team=<slug|all>&period=today|7|30|90 — the visits of every
// site in a workspace and team, added up, with a line per site. Without `workspace`: every
// workspace where I am more than a guest (the Every workspace page). Today is read live.
export default defineEventHandler(async (event): Promise<ScopeTraffic> => {
  const me = await requireAccess(event)
  const q = getQuery(event)
  const workspace = typeof q.workspace === 'string' && q.workspace ? q.workspace : undefined
  const team = typeof q.team === 'string' && q.team ? q.team : undefined
  const period = isTrafficPeriod(q.period) ? q.period : '30'
  let rows = await loadSites(me, workspace, team)
  if (!workspace) {
    const working = new Set(me.memberships.filter((m) => m.role !== 'guest').map((m) => m.workspaceId))
    rows = rows.filter((r) => working.has(r.workspaceId))
  }
  setResponseHeader(event, 'cache-control', 'no-store')
  return scopeTraffic(rows, period)
})
