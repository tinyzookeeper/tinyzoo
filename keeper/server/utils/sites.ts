import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { z } from 'zod'
import type { SiteDetail, SiteSummary } from '#keeper/types/keeper'
import type { TrafficGlance } from '#keeper/types/traffic'

/** A site with where it lives: its workspace and team. */
export type SiteRow = typeof schema.sites.$inferSelect & {
  workspace: { id: string; slug: string; name: string }
  team: { id: string; slug: string; name: string }
}

// ── Who sees which sites ───────────────────────────────────────────────────────────────

/** The sites of the teams this person sees (in every workspace of theirs). */
export function visibleSites(access: Pick<Access, 'memberships'>): SQL {
  const ids = visibleTeamIds(access)
  return ids.length ? inArray(schema.sites.teamId, ids) : sql`false`
}

/** Narrow to one workspace (slug or id) and one team (slug, or 'all'); unknown ones are 404. */
export function scopeFilter(access: Pick<Access, 'memberships'>, workspace?: string, team?: string): SQL | undefined {
  if (!workspace) return undefined
  const m = membershipOf(access, workspace)
  const ws = eq(schema.sites.workspaceId, m.workspaceId)
  if (!team || team === 'all') return ws
  return and(ws, sql`${schema.sites.teamId} in (select ${schema.teams.id} from ${schema.teams} where ${schema.teams.workspaceId} = ${m.workspaceId} and ${schema.teams.slug} = ${team})`)
}

/** Sites with their workspace and team, filtered by `where`, by name. */
export async function selectSites(where: SQL | undefined): Promise<SiteRow[]> {
  const rows = await useDb().select({
    site: schema.sites,
    workspace: { id: schema.workspaces.id, slug: schema.workspaces.slug, name: schema.workspaces.name },
    team: { id: schema.teams.id, slug: schema.teams.slug, name: schema.teams.name },
  })
    .from(schema.sites)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.sites.teamId))
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.sites.workspaceId))
    .where(where)
    .orderBy(schema.sites.name)
  return rows.map((r) => ({ ...r.site, workspace: r.workspace, team: r.team }))
}

/** The sites this person may see, optionally in one workspace and team. */
export const loadSites = (access: Pick<Access, 'memberships'>, workspace?: string, team?: string) => selectSites(and(visibleSites(access), scopeFilter(access, workspace, team)))

/** One site by id (whoever asks), or undefined. */
export async function siteById(id: string): Promise<SiteRow | undefined> {
  return (await selectSites(eq(schema.sites.id, id)))[0]
}

/** A site's origin: https://example.com (no path, no trailing slash), or null. */
export function normalizeUrl(input: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.username || u.password) return null
    return u.origin
  }
  catch {
    return null
  }
}

const url = z.string().trim().min(1).max(500).transform((v, ctx) => {
  const n = normalizeUrl(v)
  if (!n) ctx.addIssue({ code: 'custom', message: 'Not a web address' })
  return n ?? ''
})

export const siteInput = z.object({
  name: z.string().trim().min(1).max(120),
  /** The team the site belongs to (its workspace follows). Left out on a new site: the default team of `workspace`. */
  teamId: z.string().uuid().optional(),
  /** A new site's workspace (slug or id), when no team is named. */
  workspace: z.string().max(120).optional(),
  url,
  environment: z.enum(['production', 'staging']).optional(),
  token: z.string().trim().max(500).optional(),
  repoUrl: z.string().trim().max(500).optional(),
  notes: z.string().max(5000).optional(),
})

/** The site in the address, if this person may see it; 404 otherwise (a hidden site does not exist for them). */
export async function siteOf(event: H3Event, access: Pick<Access, 'memberships'>): Promise<SiteRow> {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'No such site' })
  const [site] = await selectSites(and(eq(schema.sites.id, id), visibleSites(access)))
  if (!site) throw createError({ statusCode: 404, statusMessage: 'No such site' })
  return site
}

/** My membership of the site's workspace, refusing a write I may not make there (403). */
export function writableSite(access: Access, site: Pick<SiteRow, 'workspaceId'>): Membership {
  const m = membershipOf(access, site.workspaceId)
  assertWrite(access, m)
  return m
}

/**
 * The team a site goes to: the one named (a team I see, in a workspace where I may write), or the
 * default team of the workspace named. A member with one workspace may name neither.
 */
export async function resolveTeam(access: Access, teamId?: string, workspace?: string): Promise<{ teamId: string; workspaceId: string }> {
  if (teamId) {
    const m = access.memberships.find((x) => x.teamIds.includes(teamId))
    if (!m) throw createError({ statusCode: 404, statusMessage: 'No such team' })
    assertWrite(access, m)
    return { teamId, workspaceId: m.workspaceId }
  }
  const writable = access.memberships.filter((x) => canWriteIn(access, x))
  const m = workspace ? membershipOf(access, workspace) : writable.length === 1 ? writable[0]! : null
  if (!m) throw createError({ statusCode: 422, statusMessage: 'Say which workspace (or team) the site belongs to' })
  assertWrite(access, m)
  const [team] = await useDb().select({ id: schema.teams.id }).from(schema.teams)
    .where(and(eq(schema.teams.workspaceId, m.workspaceId), eq(schema.teams.isDefault, true)))
  // A member sees only their teams: their only one, when the default is not theirs.
  const id = team && m.teamIds.includes(team.id) ? team.id : m.teamIds.length === 1 ? m.teamIds[0]! : null
  if (!id) throw createError({ statusCode: 422, statusMessage: `Say which of your teams in ${m.name} the site belongs to` })
  return { teamId: id, workspaceId: m.workspaceId }
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

export function summarize(site: SiteRow, uptime: { d1: number | null; d30: number | null } | undefined, latest: string | null, traffic: TrafficGlance | null = null): SiteSummary {
  const s = site.status
  const version = s?.tinyzoo ?? null
  const errors = s?.errors?.last24h
  return {
    id: site.id,
    name: site.name,
    workspace: site.workspace,
    team: site.team,
    url: site.url,
    environment: site.environment,
    state: site.state,
    stateSince: iso(site.stateSince),
    lastCheckAt: iso(site.lastCheckAt),
    responseMs: site.lastResponseMs,
    uptime24h: uptime?.d1 ?? null,
    uptime30d: uptime?.d30 ?? null,
    version,
    outdated: !!(version && latest && compareVersions(version, latest) < 0),
    adminUrl: `${site.url}${s?.site?.admin ?? '/admin'}`,
    lastEditAt: s?.content?.lastEditAt ?? null,
    lastSignInAt: s?.people?.lastSignInAt ?? null,
    errors24h: errors ? errors.request + errors.task + errors.webhook : 0,
    certExpiresAt: iso(site.certExpiresAt),
    statusError: site.statusError,
    hasToken: !!site.tokenEnc,
    traffic,
    trafficError: hasAnalytics(s) ? site.trafficError : null,
  }
}

/** The newest release; without npm, the newest version in the fleet. */
export async function latestKnown(rows: SiteRow[]): Promise<string | null> {
  const npm = await latestRelease()
  const fleet = rows.map((r) => r.status?.tinyzoo).filter((v): v is string => !!v).sort(compareVersions).at(-1) ?? null
  if (!npm) return fleet
  return fleet && compareVersions(fleet, npm) > 0 ? fleet : npm
}

export async function siteDetail(site: SiteRow): Promise<SiteDetail> {
  const db = useDb()
  const [uptime, latest, traffic, checks, incidents, recent, [first]] = await Promise.all([
    uptimeFor([site.id]),
    latestKnown([site]),
    trafficGlances([site]),
    db.select({ at: schema.checks.at, ok: schema.checks.ok, ms: schema.checks.ms }).from(schema.checks)
      .where(and(eq(schema.checks.siteId, site.id), gte(schema.checks.at, sql`now() - interval '24 hours'`)))
      .orderBy(schema.checks.at),
    db.select().from(schema.incidents).where(eq(schema.incidents.siteId, site.id)).orderBy(desc(schema.incidents.startedAt)).limit(20),
    // Every incident that touches the last 30 days, for the 30-day strip and its sentence.
    db.select().from(schema.incidents)
      .where(and(eq(schema.incidents.siteId, site.id), sql`coalesce(${schema.incidents.endedAt}, now()) > now() - interval '30 days'`))
      .orderBy(desc(schema.incidents.startedAt)).limit(500),
    db.select({ at: sql<Date | string | null>`min(${schema.checks.at})` }).from(schema.checks).where(eq(schema.checks.siteId, site.id)),
  ])
  const incident = (i: typeof incidents[number]) => ({ id: i.id, startedAt: i.startedAt.toISOString(), endedAt: iso(i.endedAt), cause: i.cause })
  return {
    ...summarize(site, uptime.get(site.id), latest, traffic.get(site.id) ?? null),
    repoUrl: site.repoUrl,
    notes: site.notes,
    statusAt: iso(site.statusAt),
    status: site.status ?? null,
    certError: site.certError,
    checks: checks.map((c) => ({ at: c.at.toISOString(), ok: c.ok, ms: c.ms })),
    incidents: incidents.map(incident),
    incidents30d: recent.map(incident),
    firstCheckAt: first?.at ? new Date(first.at).toISOString() : null,
    latest,
  }
}

/** Check a new or changed site at once (uptime, status, certificate), after the response. The promise is for callers that want to wait. */
export function checkSoon(event: H3Event, siteId: string): Promise<void> {
  const run = (async () => {
    try {
      await checkSite(siteId, { forceStatus: true })
      const [site] = await useDb().select().from(schema.sites).where(eq(schema.sites.id, siteId))
      if (site) await checkCertificate(site)
    }
    catch (err: any) {
      console.error('[keeper] first check failed', err?.message ?? err)
    }
  })()
  event.waitUntil?.(run)
  return run
}

// ── Changing sites: the API routes and the MCP tools both go through these ─────────────────

export type SiteInputData = z.infer<typeof siteInput>

/** Add a site to the workspace, and check it straight after. */
export async function createSite(event: H3Event, access: Access, data: SiteInputData, opts: { wait?: boolean } = {}): Promise<string> {
  const { teamId, workspaceId } = await resolveTeam(access, data.teamId, data.workspace)
  const [row] = await useDb().insert(schema.sites).values({
    workspaceId,
    teamId,
    name: data.name,
    url: data.url,
    environment: data.environment ?? 'production',
    tokenEnc: data.token ? encryptSecret(data.token) : null,
    repoUrl: data.repoUrl ?? '',
    notes: data.notes ?? '',
  }).returning({ id: schema.sites.id })
  const first = checkSoon(event, row!.id)
  if (opts.wait) await first
  return row!.id
}

/** Change a site. `token` left out keeps the stored one; '' removes it. A new address or token is checked straight after. */
export async function updateSite(event: H3Event, access: Access, site: SiteRow, data: Partial<SiteInputData>, opts: { wait?: boolean } = {}): Promise<void> {
  writableSite(access, site)
  const urlChanged = data.url !== undefined && data.url !== site.url
  const tokenChanged = data.token !== undefined
  // Another team of the same workspace (a team moves between workspaces as a whole).
  let teamId: string | undefined
  if (data.teamId !== undefined && data.teamId !== site.teamId) {
    const to = await resolveTeam(access, data.teamId)
    if (to.workspaceId !== site.workspaceId) throw createError({ statusCode: 422, statusMessage: 'A site moves only to another team of its workspace' })
    teamId = to.teamId
  }
  await useDb().update(schema.sites).set({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(teamId !== undefined ? { teamId } : {}),
    ...(data.url !== undefined ? { url: data.url } : {}),
    ...(data.environment !== undefined ? { environment: data.environment } : {}),
    ...(data.repoUrl !== undefined ? { repoUrl: data.repoUrl } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(tokenChanged ? { tokenEnc: data.token ? encryptSecret(data.token) : null, statusError: null } : {}),
    // Another address is another site as far as the checks go.
    ...(urlChanged ? { state: 'unknown' as const, stateSince: null, failStreak: 0, status: null, statusAt: null, statusError: null, certExpiresAt: null, certError: null, buildId: null } : {}),
    ...(tokenChanged && !data.token ? { status: null, statusAt: null } : {}),
    updatedAt: new Date(),
  }).where(eq(schema.sites.id, site.id))
  if (urlChanged || tokenChanged) {
    const next = checkSoon(event, site.id)
    if (opts.wait) await next
  }
}

/** Remove a site with its checks and incidents. */
export async function removeSite(site: SiteRow): Promise<void> {
  await useDb().delete(schema.sites).where(eq(schema.sites.id, site.id))
}

/** Check a site now (uptime and status; the certificate when it was never read), and answer with the fresh detail. */
export async function checkNow(site: SiteRow): Promise<SiteDetail> {
  await checkSite(site.id, { forceStatus: true, forceTraffic: true })
  if (!site.certCheckedAt) await checkCertificate(site)
  return siteDetail((await siteById(site.id))!)
}
