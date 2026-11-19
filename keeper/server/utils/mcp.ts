import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import type { CallToolResult, McpHttpHandler } from '@modelcontextprotocol/server'
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { z } from 'zod'
import type { SiteDetail, SiteSummary } from '#keeper/types/keeper'

/**
 * Keeper's MCP server (server/routes/mcp.ts): the fleet for tools that speak MCP. One
 * server per request (stateless). Reads need any token; writes need a `write` token and go
 * through the same utils as the API routes. A site's status token is never in a result.
 */

const DAY = 86_400_000
const CERT_WARN_DAYS = 21

const INSTRUCTIONS = `Keeper watches every tinyzoo site of this team: uptime every minute (GET /api/health/ready), the site's status every few minutes (GET /api/health/status with the site's NUXT_CMS_STATUS_TOKEN: tinyzoo version, content, sign-ins, errors) and its TLS certificate twice a day.

Start with fleet_summary for what needs attention. Sites are named by id, name or address in the other tools. Results are compact JSON; fields without a value are left out. Times are ISO 8601 (UTC). "behind" means the site runs an older tinyzoo than the newest release on npm.

Sites can belong to a client (list_clients); a person may be limited to some clients, and then sees only their sites. Viewers only read.

Writes (add_site, update_site, check_site, remove_site) need a write token.`

// ── result helpers ─────────────────────────────────────────────────────────────

/** Leaves out null, undefined and empty strings, recursively. */
function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (v === null || v === undefined || v === '') continue
      out[k] = compact(v)
    }
    return out
  }
  return value
}

const ok = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(compact(data)) }] })
const fail = (message: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text: message }] })

/** Runs a tool, turning thrown errors (createError and others) into a tool error. */
async function run(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn()
  }
  catch (err: any) {
    return fail(String(err?.statusMessage || err?.message || 'Something went wrong'))
  }
}

const pct = (share: number | null) => (share == null ? null : Math.round(share * 1000) / 10)
const daysUntil = (iso: string | null) => (iso ? Math.floor((Date.parse(iso) - Date.now()) / DAY) : null)

// ── reading the fleet ──────────────────────────────────────────────────────────

async function loadFleet(access: Access) {
  const rows = await loadSites(access)
  const [uptime, latest] = await Promise.all([uptimeFor(rows.map((r) => r.id)), latestKnown(rows)])
  return { rows, latest, sites: rows.map((r) => summarize(r, uptime.get(r.id), latest)) }
}

/** One line of a site for lists. */
function siteLine(s: SiteSummary) {
  return {
    id: s.id,
    name: s.name,
    client: s.client,
    url: s.url,
    env: s.environment === 'staging' ? 'staging' : null,
    state: s.state,
    since: s.stateSince,
    version: s.version,
    behind: s.outdated || null,
    uptime24h: pct(s.uptime24h),
    ms: s.responseMs,
    errors24h: s.errors24h || null,
    certDays: daysUntil(s.certExpiresAt),
    statusError: s.statusError,
    noStatusToken: !s.hasToken || null,
  }
}

/**
 * The workspace's site named by `ref`: its id, its name (any case), or its address (the
 * host is enough). Several matches or none: an error saying which.
 */
async function findSite(access: Access, ref: string): Promise<SiteRow> {
  const all = await loadSites(access)
  const q = ref.trim()
  const lower = q.toLowerCase()
  const host = (u: string) => {
    try { return new URL(u).host.toLowerCase() }
    catch { return '' }
  }
  const asUrl = normalizeUrl(q)
  const byId = all.filter((s) => s.id === lower)
  const byName = all.filter((s) => s.name.toLowerCase() === lower)
  const byUrl = all.filter((s) => (asUrl && s.url.toLowerCase() === asUrl.toLowerCase()) || host(s.url) === lower.replace(/^www\./, '') || host(s.url) === lower)
  const matches = byId.length ? byId : byName.length ? byName : byUrl.length ? byUrl : all.filter((s) => s.name.toLowerCase().includes(lower) || host(s.url).includes(lower))
  if (matches.length === 1) return matches[0]!
  if (!matches.length) throw createError({ statusCode: 404, statusMessage: `No site matches "${q}". list_sites shows them all.` })
  throw createError({ statusCode: 409, statusMessage: `"${q}" matches several sites: ${matches.map((s) => `${s.name} (${s.id})`).join(', ')}. Use the id.` })
}

/** The last 24 hours of uptime checks in a few numbers. */
async function checksDay(siteId: string) {
  const rows = await useDb().select({ at: schema.checks.at, ok: schema.checks.ok, ms: schema.checks.ms, code: schema.checks.code, error: schema.checks.error })
    .from(schema.checks)
    .where(and(eq(schema.checks.siteId, siteId), gte(schema.checks.at, sql`now() - interval '24 hours'`)))
    .orderBy(schema.checks.at)
  const times = rows.filter((r) => r.ok && r.ms != null).map((r) => r.ms!).sort((a, b) => a - b)
  const failed = rows.filter((r) => !r.ok)
  const last = failed.at(-1)
  const share = rows.length ? (rows.length - failed.length) / rows.length : null
  return {
    checks: rows.length,
    failed: failed.length,
    uptime: pct(share),
    avgMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    p95Ms: times.length ? times[Math.min(times.length - 1, Math.floor(times.length * 0.95))] : null,
    maxMs: times.at(-1) ?? null,
    lastFailure: last ? { at: last.at.toISOString(), code: last.code, error: last.error } : null,
  }
}

/** Everything about one site: the full status, a summary of the day's checks and its incidents. */
async function siteReport(site: SiteRow, detail?: SiteDetail) {
  const d = detail ?? await siteDetail(site)
  return {
    site: {
      ...siteLine(d),
      env: d.environment,
      latest: d.latest,
      adminUrl: d.adminUrl,
      repoUrl: d.repoUrl,
      notes: d.notes,
      lastCheckAt: d.lastCheckAt,
      uptime30d: pct(d.uptime30d),
      lastEditAt: d.lastEditAt,
      lastSignInAt: d.lastSignInAt,
      statusAt: d.statusAt,
      certExpiresAt: d.certExpiresAt,
      certError: d.certError,
    },
    checks24h: await checksDay(site.id),
    incidents: d.incidents.map((i) => ({ startedAt: i.startedAt, endedAt: i.endedAt, open: !i.endedAt || null, cause: i.cause })),
    status: d.status,
  }
}

// ── inputs ─────────────────────────────────────────────────────────────────────

const siteRef = z.string().min(1).max(500).describe('The site: its id, its name, or its address (the host is enough, e.g. example.com).')
const fields = {
  client: z.string().max(120).optional().describe('The client the site belongs to, by name (list_clients). A new name makes a new client; "" leaves the site without one. People limited to some clients must pick one of theirs.'),
  environment: z.enum(['production', 'staging']).optional().describe('production (the default) or staging.'),
  repoUrl: z.string().max(500).optional().describe('Where the code lives, e.g. a GitHub address.'),
  notes: z.string().max(5000).optional().describe('Free notes for the team.'),
}

/** Validate like the API does (siteInput), so a tool takes exactly what the form takes. */
function parseSite<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw createError({ statusCode: 422, statusMessage: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input' })
  }
  return parsed.data
}

// ── the server ─────────────────────────────────────────────────────────────────

export function createKeeperMcp(event: H3Event, access: Access): McpServer {
  const server = new McpServer({ name: 'keeper', title: 'Keeper', version: '0.5.0' }, { instructions: INSTRUCTIONS })
  const canWrite = () => (access.scope === 'write' ? null : fail(access.role === 'viewer'
    ? 'Your role in Keeper only looks at sites. Ask an owner or admin for more.'
    : 'This access token is read-only. Make a write token in Keeper → Settings → Access tokens.'))
  const readOnlyHints = { readOnlyHint: true, openWorldHint: false }

  server.registerTool('fleet_summary', {
    title: 'Fleet summary',
    description: 'What needs attention across all sites, in one call: sites that are down (with the cause), sites behind the newest tinyzoo, TLS certificates expiring within 21 days (or unreadable), sites whose status cannot be read (wrong or missing status token), and sites that reported server errors in the last 24 hours. Start here.',
    inputSchema: z.object({}),
    annotations: readOnlyHints,
  }, () => run(async () => {
    const { sites, latest } = await loadFleet(access)
    const open = sites.length
      ? await useDb().select({ siteId: schema.incidents.siteId, startedAt: schema.incidents.startedAt, cause: schema.incidents.cause }).from(schema.incidents)
        .where(and(inArray(schema.incidents.siteId, sites.map((s) => s.id)), isNull(schema.incidents.endedAt)))
      : []
    const cause = new Map(open.map((i) => [i.siteId, i.cause]))
    const ref = (s: SiteSummary) => ({ id: s.id, name: s.name, client: s.client })
    const certs = sites.filter((s) => {
      const days = daysUntil(s.certExpiresAt)
      return days != null && days <= CERT_WARN_DAYS
    })
    return ok({
      latest,
      sites: sites.length,
      up: sites.filter((s) => s.state === 'up').length,
      down: sites.filter((s) => s.state === 'down').map((s) => ({ ...ref(s), url: s.url, since: s.stateSince, cause: cause.get(s.id) })),
      notCheckedYet: sites.filter((s) => s.state === 'unknown').map(ref),
      behind: sites.filter((s) => s.outdated).map((s) => ({ ...ref(s), version: s.version })),
      certificates: certs.map((s) => ({ ...ref(s), expiresAt: s.certExpiresAt, days: daysUntil(s.certExpiresAt) })),
      statusUnreadable: sites.filter((s) => s.statusError || !s.hasToken).map((s) => ({ ...ref(s), error: s.statusError ?? 'No status token set' })),
      serverErrors24h: sites.filter((s) => s.errors24h > 0).map((s) => ({ ...ref(s), errors: s.errors24h })),
    })
  }))

  server.registerTool('list_sites', {
    title: 'List sites',
    description: 'Every site with its state, tinyzoo version, uptime over 24 hours (percent), last response time (ms), server errors in 24 hours, days until its certificate expires and any problem reading its status. Filter by client and state; "behind" picks sites on an older tinyzoo.',
    inputSchema: z.object({
      client: z.string().max(120).optional().describe('Only this client\'s sites (any case, part of the name is enough).'),
      state: z.enum(['up', 'down', 'unknown', 'behind']).optional().describe('up, down, unknown (not checked yet), or behind (older tinyzoo than the newest).'),
    }),
    annotations: readOnlyHints,
  }, ({ client, state }) => run(async () => {
    const { sites, latest } = await loadFleet(access)
    const c = client?.trim().toLowerCase()
    const picked = sites
      .filter((s) => !c || s.client.toLowerCase().includes(c))
      .filter((s) => !state || (state === 'behind' ? s.outdated : s.state === state))
    return ok({ latest, count: picked.length, sites: picked.map(siteLine) })
  }))

  server.registerTool('list_clients', {
    title: 'List clients',
    description: 'The team\'s clients you can see, each with how many sites it has. Sites belong to one client or none; use the name in list_sites (client) and in add_site / update_site.',
    inputSchema: z.object({}),
    annotations: readOnlyHints,
  }, () => run(async () => {
    const clients = await listClients(access)
    return ok({ count: clients.length, clients: clients.map((c) => ({ id: c.id, name: c.name, sites: c.sites })) })
  }))

  server.registerTool('get_site', {
    title: 'Get a site',
    description: 'One site in full: its settings, the whole status the site reports (tinyzoo version, Node, database and migrations, collections with entry counts, accounts and sign-ins, media, webhooks, server errors, plugins), a summary of the last 24 hours of uptime checks (count, failures, uptime, average/p95/max response time, the last failure) and its last 20 incidents.',
    inputSchema: z.object({ site: siteRef }),
    annotations: readOnlyHints,
  }, ({ site }) => run(async () => ok(await siteReport(await findSite(access, site)))))

  server.registerTool('list_versions', {
    title: 'List versions',
    description: 'Sites grouped by the tinyzoo version they run, newest first, with the newest release and whether each version is behind it. Sites whose version is unknown (no status yet) are listed apart, with the reason.',
    inputSchema: z.object({}),
    annotations: readOnlyHints,
  }, () => run(async () => {
    const { sites, latest } = await loadFleet(access)
    const groups = new Map<string, SiteSummary[]>()
    for (const s of sites) if (s.version) groups.set(s.version, [...(groups.get(s.version) ?? []), s])
    const versions = [...groups.keys()].sort(compareVersions).reverse()
    return ok({
      latest,
      versions: versions.map((v) => ({
        version: v,
        behind: (latest ? compareVersions(v, latest) < 0 : false) || null,
        sites: groups.get(v)!.map((s) => ({ id: s.id, name: s.name, client: s.client })),
      })),
      unknown: sites.filter((s) => !s.version).map((s) => ({ id: s.id, name: s.name, reason: s.statusError ?? (s.hasToken ? 'Status not read yet' : 'No status token set') })),
    })
  }))

  server.registerTool('list_incidents', {
    title: 'List incidents',
    description: 'Stretches of time sites were down, newest first: when each started and ended, how long it lasted (minutes) and the cause the uptime check saw. Open incidents have no end.',
    inputSchema: z.object({
      site: siteRef.optional().describe('Only this site (id, name or address). Leave out for all sites.'),
      open: z.boolean().optional().describe('true: only incidents still going on.'),
      days: z.number().int().min(1).max(365).optional().describe('How far back, in days (default 30).'),
      limit: z.number().int().min(1).max(200).optional().describe('At most this many (default 50).'),
    }),
    annotations: readOnlyHints,
  }, ({ site, open, days, limit }) => run(async () => {
    const one = site ? await findSite(access, site) : null
    const rows = await useDb().select({
      id: schema.incidents.id, siteId: schema.sites.id, name: schema.sites.name,
      startedAt: schema.incidents.startedAt, endedAt: schema.incidents.endedAt, cause: schema.incidents.cause,
    })
      .from(schema.incidents)
      .innerJoin(schema.sites, eq(schema.sites.id, schema.incidents.siteId))
      .where(and(
        visibleSites(access),
        one ? eq(schema.sites.id, one.id) : undefined,
        open ? isNull(schema.incidents.endedAt) : undefined,
        gte(schema.incidents.startedAt, new Date(Date.now() - (days ?? 30) * DAY)),
      ))
      .orderBy(desc(schema.incidents.startedAt))
      .limit(limit ?? 50)
    return ok({
      count: rows.length,
      incidents: rows.map((r) => ({
        site: r.name,
        siteId: r.siteId,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt?.toISOString(),
        minutes: Math.round(((r.endedAt?.getTime() ?? Date.now()) - r.startedAt.getTime()) / 60_000),
        open: !r.endedAt || null,
        cause: r.cause,
      })),
    })
  }))

  // ── writes ──

  server.registerTool('add_site', {
    title: 'Add a site',
    description: 'Start watching a tinyzoo site. Keeper checks it straight away (uptime, status, certificate) and answers with what it found. The status token is the site\'s NUXT_CMS_STATUS_TOKEN; it is stored encrypted and never shown again. Needs a write token.',
    inputSchema: z.object({
      name: z.string().min(1).max(120).describe('What the team calls the site.'),
      url: z.string().min(1).max(500).describe('The site\'s address, e.g. https://example.com (only the origin is kept).'),
      ...fields,
      statusToken: z.string().max(500).optional().describe('The site\'s NUXT_CMS_STATUS_TOKEN, for its status (version, content, errors). Without it Keeper still checks uptime and the certificate.'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, (args) => run(async () => {
    const denied = canWrite()
    if (denied) return denied
    const data = parseSite(siteInput, { ...args, token: args.statusToken })
    const [twin] = await useDb().select({ id: schema.sites.id, name: schema.sites.name }).from(schema.sites)
      .where(and(eq(schema.sites.workspaceId, access.workspaceId), eq(schema.sites.url, data.url)))
    if (twin) {
      // Name it only to someone who may see it.
      const seen = (await selectSites(and(eq(schema.sites.id, twin.id), visibleSites(access)))).length > 0
      return fail(seen ? `${twin.name} already watches ${data.url}. Change it with update_site.` : `Keeper already watches ${data.url} for another client of the team.`)
    }
    const id = await createSite(event, access, data, { wait: true })
    return ok({ added: true, ...(await siteReport((await siteById(id))!)) })
  }))

  server.registerTool('update_site', {
    title: 'Change a site',
    description: 'Change a site\'s name, client, address, environment, notes, repository or status token. Fields left out stay as they are. statusToken "" removes the stored token. A new address or token is checked straight away. Needs a write token.',
    inputSchema: z.object({
      site: siteRef,
      name: z.string().min(1).max(120).optional().describe('A new name.'),
      url: z.string().min(1).max(500).optional().describe('A new address (the checks start over).'),
      ...fields,
      statusToken: z.string().max(500).optional().describe('A new NUXT_CMS_STATUS_TOKEN for the site, or "" to remove it.'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, ({ site, statusToken, ...rest }) => run(async () => {
    const denied = canWrite()
    if (denied) return denied
    const row = await findSite(access, site)
    const data = parseSite(siteInput.partial(), { ...rest, ...(statusToken !== undefined ? { token: statusToken } : {}) })
    if (!Object.keys(data).length) return fail('Nothing to change: give at least one field.')
    await updateSite(event, access, row, data, { wait: true })
    const fresh = await siteById(row.id)
    return ok({ updated: Object.keys(data).map((k) => (k === 'token' ? 'statusToken' : k)), site: siteLine(summarize(fresh!, (await uptimeFor([row.id])).get(row.id), await latestKnown([fresh!]))) })
  }))

  server.registerTool('check_site', {
    title: 'Check a site now',
    description: 'Run the uptime check and read the status now, instead of waiting for the next round (uptime every minute, status every few minutes). Use it after a deploy to confirm the new tinyzoo version. Answers like get_site. Needs a write token.',
    inputSchema: z.object({ site: siteRef }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, ({ site }) => run(async () => {
    const denied = canWrite()
    if (denied) return denied
    const row = await findSite(access, site)
    return ok(await siteReport(row, await checkNow(row)))
  }))

  server.registerTool('remove_site', {
    title: 'Remove a site',
    description: 'Stop watching a site and delete its checks and incidents. This cannot be undone. Pass the site\'s exact name as confirm. The site itself is not touched. Needs a write token.',
    inputSchema: z.object({
      site: siteRef,
      confirm: z.string().describe('The site\'s exact name, to confirm.'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, ({ site, confirm }) => run(async () => {
    const denied = canWrite()
    if (denied) return denied
    const row = await findSite(access, site)
    if (confirm !== row.name) return fail(`To remove it, pass confirm: "${row.name}" (the site's exact name).`)
    await removeSite(row)
    return ok({ removed: { id: row.id, name: row.name, url: row.url } })
  }))

  return server
}

let handler: McpHttpHandler | undefined

/** One handler for every request: a fresh server per request, for the request's access (passed as authInfo). */
export function keeperMcpHandler(): McpHttpHandler {
  handler ??= createMcpHandler(({ authInfo }) => {
    const { event, access } = authInfo?.extra as { event: H3Event; access: Access }
    return createKeeperMcp(event, access)
  }, {
    responseMode: 'json',
    onerror: (err) => console.error('[keeper] mcp', err?.message ?? err),
  })
  return handler
}
