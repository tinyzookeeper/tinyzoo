import { brandFileUrl, gte, resolveText, sql, type CmsErrorReport, type CmsStatus, type CmsStatusBrand, type CmsStatusCollection } from 'tinyzoo'
import { cmsAdminSettings } from './cmsAdminTheme'
import pkg from '../../package.json'
import { analyticsStatus } from '../../analytics/server/status'

/**
 * The site summary of `GET /api/health/status` (see CmsStatus): what a tool watching
 * many sites needs to list this one — versions, health, how much it is used. Numbers,
 * dates and config names only.
 */

const startedAt = new Date()

/** When this server process started: the status reports it, and the admin's About page. */
export function cmsStartedAt(): Date {
  return startedAt
}
const DAY_MS = 24 * 60 * 60 * 1000

// Server errors by where they happened, as timestamps of the last 24 hours (reportCmsError
// notes each one). Capped, so a storm of errors cannot grow it without end.
const MAX_NOTED = 10_000
const noted: { source: CmsErrorReport['source']; at: number }[] = []

/** Count one server error for the status (called by reportCmsError). */
export function noteCmsErrorForStatus(source: CmsErrorReport['source']): void {
  noted.push({ source, at: Date.now() })
  if (noted.length > MAX_NOTED) noted.splice(0, noted.length - MAX_NOTED)
}

function errorsLastDay(now: number): CmsStatus['errors'] {
  const since = now - DAY_MS
  while (noted.length && noted[0]!.at < since) noted.shift()
  const last24h = { request: 0, task: 0, webhook: 0 }
  for (const n of noted) last24h[n.source]++
  const last = noted.at(-1)
  return { last24h, lastAt: last ? new Date(last.at).toISOString() : null }
}

const iso = (d: unknown): string | null => (d == null ? null : new Date(d as any).toISOString())
const newest = (a: string | null, b: string | null): string | null => (!a ? b : !b ? a : a > b ? a : b)

/** The token the status route asks for ('' = the route is off). */
export function cmsStatusToken(): string {
  return String((useRuntimeConfig().cms as any)?.status?.token || '')
}

/**
 * The guard of the routes a fleet monitor reads with the status token (`/api/health/status`,
 * the analytics plugin's rollups): 404 while no token is set, 30 requests a minute per address
 * and route (`bucket`), then the token as `x-api-key` or `Authorization: Bearer`, compared in
 * constant time.
 */
export async function requireCmsStatusToken(event: Parameters<typeof getHeader>[0], bucket: string): Promise<void> {
  const token = cmsStatusToken()
  if (!token) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  // A watcher asks about once a minute; anything much busier is guessing or a loop.
  if (!(await rateLimit(`${bucket}:${clientIp(event)}`, 30, 60_000))) throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  const header = getHeader(event, 'authorization') || ''
  const provided = getHeader(event, 'x-api-key') || header.replace(/^Bearer\s+/i, '')
  if (!provided || !constantTimeEqual(provided, token)) throw createError({ statusCode: 401, statusMessage: 'Invalid status token' })
}

/** The client's brand from the admin's settings (CmsStatusBrand): what the sign-in page shows. */
export async function cmsStatusBrand(baseURL: string): Promise<CmsStatusBrand> {
  const { theme, defaultLocale } = await cmsAdminSettings()
  const { logo } = theme
  const own = (dark: string | null, light: string | null, plate: boolean) => (!plate && dark !== light ? dark : null)
  const icon = logo.mark && logo.files && !logo.files.markFallback ? `${baseURL.replace(/\/$/, '')}${brandFileUrl('mark-180.png', theme)}` : null
  return {
    name: resolveText(theme.name, defaultLocale) || 'tinyzoo',
    accent: theme.accent.kind === 'brand' ? theme.accent.hex : null,
    full: logo.full,
    fullDark: own(logo.fullDark, logo.full, logo.fullDarkPlate),
    mark: logo.mark,
    markDark: own(logo.markDark, logo.mark, logo.markDarkPlate),
    icon,
  }
}

export async function collectCmsStatus(): Promise<CmsStatus> {
  const now = Date.now()
  const config = useRuntimeConfig()
  const cms = (config.cms as any) ?? {}
  const { db, reg } = useCms()
  const { urls, secret } = webhookConfig()
  const baseURL = String((config.app as any)?.baseURL || '/').replace(/\/?$/, '/')

  const status: CmsStatus = {
    format: 'tinyzoo-status',
    version: 1,
    at: new Date(now).toISOString(),
    tinyzoo: pkg.version,
    node: typeof process !== 'undefined' && process.version ? process.version : null,
    instance: { startedAt: startedAt.toISOString() },
    site: {
      publicUrl: String(cms.publicUrl || '').replace(/\/+$/, '') || null,
      admin: `${baseURL}admin`,
      auth: cmsAuthMode(),
      locales: reg.locales ? [reg.locales.default, ...reg.locales.locales.filter((l) => l !== reg.locales!.default)] : null,
    },
    database: { ok: false, migrations: cmsMigrationState(), bytes: null },
    content: {
      collections: reg.entities.map((e) => ({ name: e.name, kind: e.singleton ? 'global' : 'collection', count: 0, lastEditAt: null })),
      lastEditAt: null,
      untranslated: 0,
    },
    people: { active: 0, invited: 0, disabled: 0, signedInLast30Days: 0, lastSignInAt: null },
    media: { files: 0, bytes: 0 },
    webhooks: { urls: urls.length, signed: !!secret },
    errors: errorsLastDay(now),
    plugins: reg.plugins.map((p) => ({ name: p.name, version: p.version })),
  }
  // The brand needs no database: it is there even while the database is not.
  try {
    status.brand = await cmsStatusBrand(baseURL)
  }
  catch { /* a theme that cannot be read: the status without it */ }

  // While start-up migrations run (or after they failed) the tables may not be there yet.
  const migrations = status.database.migrations
  if (migrations === 'running' || migrations === 'failed') return status
  try {
    await db.execute(sql`select 1`)
    status.database.ok = true
  }
  catch {
    return status
  }

  try {
    const res: any = await db.execute(sql`select pg_database_size(current_database())::bigint as bytes`)
    const bytes = Number((res.rows ?? res)[0]?.bytes)
    status.database.bytes = Number.isFinite(bytes) ? bytes : null
  }
  catch { /* a role without the right to read it: leave null */ }

  status.content.collections = await Promise.all(reg.entities.map(async (e): Promise<CmsStatusCollection> => {
    const [row] = await db.select({ n: sql<number>`count(*)::int`, last: sql<Date | null>`max(${e.table.updatedAt})` }).from(e.table)
    return { name: e.name, kind: e.singleton ? 'global' : 'collection', count: Number(row?.n ?? 0), lastEditAt: iso(row?.last) }
  }))
  status.content.lastEditAt = status.content.collections.reduce<string | null>((acc, c) => newest(acc, c.lastEditAt), null)
  // Translations: everything waiting, as an admin would see it.
  status.content.untranslated = (await translationWork(db, reg, { id: 'system', role: 'admin' } as any, 1)).total

  const u = reg.cmsUsers
  const people: any[] = await db.select({ status: u.status, n: sql<number>`count(*)::int` }).from(u).groupBy(u.status)
  for (const p of people) {
    if (p.status === 'active' || p.status === 'invited' || p.status === 'disabled') status.people[p.status as 'active'] = Number(p.n)
  }
  const [signIns] = await db.select({ last: sql<Date | null>`max(${u.lastLoginAt})` }).from(u)
  status.people.lastSignInAt = iso(signIns?.last)
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(u).where(gte(u.lastLoginAt, new Date(now - 30 * DAY_MS)))
  status.people.signedInLast30Days = Number(recent?.n ?? 0)

  const m = reg.cmsMedia
  const [media] = await db.select({ n: sql<number>`count(*)::int`, bytes: sql<string>`coalesce(sum(${m.size}), 0)::bigint` }).from(m)
  status.media = { files: Number(media?.n ?? 0), bytes: Number(media?.bytes ?? 0) }

  // The analytics plugin (tinyzoo/analytics), when the site uses it.
  const analytics = await analyticsStatus(baseURL)
  if (analytics) status.analytics = analytics

  return status
}
