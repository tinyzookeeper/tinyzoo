import { and, desc, eq, gte, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { z } from 'zod'
import type { SiteDetail, SiteSummary } from '#keeper/types/keeper'

type SiteRow = typeof schema.sites.$inferSelect

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
  client: z.string().trim().max(120).optional(),
  url,
  environment: z.enum(['production', 'staging']).optional(),
  token: z.string().trim().max(500).optional(),
  repoUrl: z.string().trim().max(500).optional(),
  notes: z.string().max(5000).optional(),
})

/** The workspace's site, or 404. */
export async function siteOf(event: H3Event, workspaceId: string): Promise<SiteRow> {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'No such site' })
  const [site] = await useDb().select().from(schema.sites).where(and(eq(schema.sites.id, id), eq(schema.sites.workspaceId, workspaceId)))
  if (!site) throw createError({ statusCode: 404, statusMessage: 'No such site' })
  return site
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

export function summarize(site: SiteRow, uptime: { d1: number | null; d30: number | null } | undefined, latest: string | null): SiteSummary {
  const s = site.status
  const version = s?.tinyzoo ?? null
  const errors = s?.errors?.last24h
  return {
    id: site.id,
    name: site.name,
    client: site.client,
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
  const [uptime, latest, checks, incidents] = await Promise.all([
    uptimeFor([site.id]),
    latestKnown([site]),
    db.select({ at: schema.checks.at, ok: schema.checks.ok, ms: schema.checks.ms }).from(schema.checks)
      .where(and(eq(schema.checks.siteId, site.id), gte(schema.checks.at, sql`now() - interval '24 hours'`)))
      .orderBy(schema.checks.at),
    db.select().from(schema.incidents).where(eq(schema.incidents.siteId, site.id)).orderBy(desc(schema.incidents.startedAt)).limit(20),
  ])
  return {
    ...summarize(site, uptime.get(site.id), latest),
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

/** Check a new or changed site at once (uptime, status, certificate), after the response. */
export function checkSoon(event: H3Event, siteId: string): void {
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
}
