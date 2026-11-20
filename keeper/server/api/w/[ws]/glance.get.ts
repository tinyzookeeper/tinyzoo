import { and, desc, eq, gte, inArray, or, isNull } from 'drizzle-orm'
import type { GuestGlance } from '#keeper/types/keeper'

// The guest view of a workspace: the sites of my teams in plain words (up or down, outages in
// 30 days, visitors, speed, certificate) and who looks after them. Nothing a client should not
// see: no versions, tokens, errors or admin links.
export default defineEventHandler(async (event): Promise<GuestGlance> => {
  const { access, m } = await requireWorkspace(event)
  const rows = await selectSites(and(visibleSites(access), eq(schema.sites.workspaceId, m.workspaceId)))
  const db = useDb()
  const ids = rows.map((r) => r.id)
  const since = new Date(Date.now() - 30 * 86_400_000)
  const [uptime, traffic, incidents, ws, teams] = await Promise.all([
    uptimeFor(ids),
    trafficGlances(rows),
    ids.length
      ? db.select().from(schema.incidents)
        .where(and(inArray(schema.incidents.siteId, ids), or(gte(schema.incidents.startedAt, since), isNull(schema.incidents.endedAt), gte(schema.incidents.endedAt, since))))
        .orderBy(desc(schema.incidents.startedAt))
      : [],
    db.select({ name: schema.workspaces.name, signature: schema.workspaces.signature }).from(schema.workspaces).where(eq(schema.workspaces.id, m.workspaceId)),
    m.teamIds.length ? db.select({ name: schema.teams.name }).from(schema.teams).where(inArray(schema.teams.id, m.teamIds)).orderBy(schema.teams.name) : [],
  ])
  const now = Date.now()
  return {
    workspace: { name: ws[0]?.name ?? m.name, signature: ws[0]?.signature ?? '' },
    teams: teams.map((t) => t.name),
    sites: rows.map((r) => {
      const own = incidents.filter((i) => i.siteId === r.id)
      const minutes = own.reduce((n, i) => n + Math.max(0, ((i.endedAt?.getTime() ?? now) - Math.max(i.startedAt.getTime(), since.getTime())) / 60_000), 0)
      const t = traffic.get(r.id)
      const last = own[0]
      return {
        id: r.id,
        name: r.name,
        url: r.url,
        environment: r.environment,
        state: r.state,
        stateSince: r.stateSince?.toISOString() ?? null,
        lastCheckAt: r.lastCheckAt?.toISOString() ?? null,
        uptime30d: uptime.get(r.id)?.d30 ?? null,
        visitors30d: t ? t.spark.reduce((a, b) => a + b, 0) : null,
        responseMs: r.lastResponseMs,
        certExpiresAt: r.certExpiresAt?.toISOString() ?? null,
        outages: { count: own.length, minutes: Math.round(minutes), last: last ? { startedAt: last.startedAt.toISOString(), endedAt: last.endedAt?.toISOString() ?? null } : null },
      }
    }),
  }
})
