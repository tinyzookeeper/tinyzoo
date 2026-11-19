import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { z } from 'zod'
import type { SiteDetail, SiteSummary } from '#keeper/types/keeper'
import type { TrafficGlance } from '#keeper/types/traffic'

/** A site with the name of its client ('' without one). */
export type SiteRow = typeof schema.sites.$inferSelect & { clientName: string }

// ── Who sees which sites ───────────────────────────────────────────────────────────────

/** The sites of the workspace this person may see: all of them, or those of their clients. */
export function visibleSites(m: SignedInMember): SQL {
  const ws = eq(schema.sites.workspaceId, m.workspaceId)
  if (seesAllClients(m)) return ws
  return m.clientIds.length ? and(ws, inArray(schema.sites.clientId, m.clientIds))! : sql`false`
}

/** The clients of the workspace this person may see. */
export function visibleClients(m: SignedInMember): SQL {
  const ws = eq(schema.clients.workspaceId, m.workspaceId)
  if (seesAllClients(m)) return ws
  return m.clientIds.length ? and(ws, inArray(schema.clients.id, m.clientIds))! : sql`false`
}

/** Sites with their client's name, filtered by `where`, by name. */
export async function selectSites(where: SQL | undefined): Promise<SiteRow[]> {
  const rows = await useDb().select({ site: schema.sites, clientName: schema.clients.name })
    .from(schema.sites)
    .leftJoin(schema.clients, eq(schema.clients.id, schema.sites.clientId))
    .where(where)
    .orderBy(schema.sites.name)
  return rows.map((r) => ({ ...r.site, clientName: r.clientName ?? '' }))
}

/** The sites this person may see. */
export const loadSites = (m: SignedInMember) => selectSites(visibleSites(m))

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
  /** The client's name: an existing one (any case), a new one, or '' for none. */
  client: z.string().trim().max(120).optional(),
  url,
  environment: z.enum(['production', 'staging']).optional(),
  token: z.string().trim().max(500).optional(),
  repoUrl: z.string().trim().max(500).optional(),
  notes: z.string().max(5000).optional(),
})

/** The site in the address, if this person may see it; 404 otherwise (a hidden site does not exist for them). */
export async function siteOf(event: H3Event, m: SignedInMember): Promise<SiteRow> {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'No such site' })
  const [site] = await selectSites(and(eq(schema.sites.id, id), visibleSites(m)))
  if (!site) throw createError({ statusCode: 404, statusMessage: 'No such site' })
  return site
}

/**
 * The client a site is given, by name (any case): its id, or null for none. A name not yet
 * used makes a new client. People limited to some clients must pick one of theirs: they can
 * neither leave a site without a client nor make a new one (they would lose sight of the site).
 */
export async function resolveClient(m: SignedInMember, name: string): Promise<string | null> {
  const wanted = name.trim()
  const all = seesAllClients(m)
  if (!wanted) {
    if (all) return null
    throw createError({ statusCode: 403, statusMessage: 'Pick one of your clients for the site' })
  }
  const db = useDb()
  const find = async () => (await db.select({ id: schema.clients.id }).from(schema.clients)
    .where(and(eq(schema.clients.workspaceId, m.workspaceId), sql`lower(${schema.clients.name}) = lower(${wanted})`)))[0]?.id
  const found = await find()
  if (found && (all || m.clientIds.includes(found))) return found
  if (!all) throw createError({ statusCode: 403, statusMessage: `You can only use your own clients${m.clientIds.length ? '' : ' (you have none yet)'}` })
  // A new client; a twin made at the same moment wins and is used.
  const [made] = await db.insert(schema.clients).values({ workspaceId: m.workspaceId, name: wanted }).onConflictDoNothing().returning({ id: schema.clients.id })
  return made?.id ?? (await find())!
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

export function summarize(site: SiteRow, uptime: { d1: number | null; d30: number | null } | undefined, latest: string | null, traffic: TrafficGlance | null = null): SiteSummary {
  const s = site.status
  const version = s?.tinyzoo ?? null
  const errors = s?.errors?.last24h
  return {
    id: site.id,
    name: site.name,
    client: site.clientName,
    clientId: site.clientId,
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
  const [uptime, latest, traffic, checks, incidents] = await Promise.all([
    uptimeFor([site.id]),
    latestKnown([site]),
    trafficGlances([site]),
    db.select({ at: schema.checks.at, ok: schema.checks.ok, ms: schema.checks.ms }).from(schema.checks)
      .where(and(eq(schema.checks.siteId, site.id), gte(schema.checks.at, sql`now() - interval '24 hours'`)))
      .orderBy(schema.checks.at),
    db.select().from(schema.incidents).where(eq(schema.incidents.siteId, site.id)).orderBy(desc(schema.incidents.startedAt)).limit(20),
  ])
  return {
    ...summarize(site, uptime.get(site.id), latest, traffic.get(site.id) ?? null),
    repoUrl: site.repoUrl,
    notes: site.notes,
    statusAt: iso(site.statusAt),
    status: site.status ?? null,
    certError: site.certError,
    checks: checks.map((c) => ({ at: c.at.toISOString(), ok: c.ok, ms: c.ms })),
    incidents: incidents.map((i) => ({ id: i.id, startedAt: i.startedAt.toISOString(), endedAt: iso(i.endedAt), cause: i.cause })),
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
export async function createSite(event: H3Event, m: SignedInMember, data: SiteInputData, opts: { wait?: boolean } = {}): Promise<string> {
  const clientId = await resolveClient(m, data.client ?? '')
  const [row] = await useDb().insert(schema.sites).values({
    workspaceId: m.workspaceId,
    name: data.name,
    clientId,
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
export async function updateSite(event: H3Event, m: SignedInMember, site: SiteRow, data: Partial<SiteInputData>, opts: { wait?: boolean } = {}): Promise<void> {
  const urlChanged = data.url !== undefined && data.url !== site.url
  const tokenChanged = data.token !== undefined
  const clientId = data.client !== undefined ? await resolveClient(m, data.client) : undefined
  await useDb().update(schema.sites).set({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(clientId !== undefined ? { clientId } : {}),
    ...(data.url !== undefined ? { url: data.url } : {}),
    ...(data.environment !== undefined ? { environment: data.environment } : {}),
    ...(data.repoUrl !== undefined ? { repoUrl: data.repoUrl } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(tokenChanged ? { tokenEnc: data.token ? encryptSecret(data.token) : null, statusError: null } : {}),
    // Another address is another site as far as the checks go.
    ...(urlChanged ? { state: 'unknown' as const, stateSince: null, failStreak: 0, status: null, statusAt: null, statusError: null, certExpiresAt: null, certError: null } : {}),
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
