import tls from 'node:tls'
import { and, eq, isNull, lt, sql } from 'drizzle-orm'
import type { CmsStatus } from '#keeper/types/status'

/**
 * The checks. Every minute each site's GET /api/health/ready (uptime and response time);
 * every few minutes its GET /api/health/status with the stored token (versions, counts), and at
 * once when the site serves a new build (a deploy); about hourly its visits, when it counts them
 * (traffic.ts); once a day its logo (logos.ts); twice a day its TLS certificate. A site is down after `checks.downAfter` failures in a
 * row, which opens an incident and e-mails the team; the first success closes it.
 */

type SiteRow = typeof schema.sites.$inferSelect

const settings = () => {
  const c = (useRuntimeConfig().checks ?? {}) as Record<string, unknown>
  return {
    downAfter: Math.max(1, Number(c.downAfter) || 2),
    timeoutMs: Math.max(1000, Number(c.timeoutMs) || 10_000),
    statusEveryMin: Math.max(1, Number(c.statusEveryMin) || 5),
    keepDays: Math.max(1, Number(c.keepDays) || 90),
  }
}

const USER_AGENT = 'tinyzoo-keeper/0.1 (+uptime)'

interface Probe { ok: boolean; code: number | null; ms: number | null; error: string | null; body?: unknown }

const REASONS: Record<string, string> = {
  ECONNREFUSED: 'connection refused',
  ECONNRESET: 'connection reset',
  ENOTFOUND: 'address not found (DNS)',
  EAI_AGAIN: 'address lookup failed (DNS)',
  EHOSTUNREACH: 'host unreachable',
  ETIMEDOUT: 'connection timed out',
  CERT_HAS_EXPIRED: 'certificate expired',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'self-signed certificate',
  ERR_TLS_CERT_ALTNAME_INVALID: 'certificate is for another address',
  ERR_SSL_WRONG_VERSION_NUMBER: 'no https on this address',
}

/** A network error in words (the code kept for searching). */
function explain(code: string | undefined, message: string | undefined): string {
  if (code && REASONS[code]) return `${REASONS[code]} (${code})`
  return String(code || message || 'unreachable')
}

async function probe(url: string, headers: Record<string, string> = {}): Promise<Probe> {
  const started = performance.now()
  try {
    const res = await fetch(url, {
      headers: { 'accept': 'application/json', 'user-agent': USER_AGENT, ...headers },
      signal: AbortSignal.timeout(settings().timeoutMs),
      redirect: 'follow',
    })
    const ms = Math.round(performance.now() - started)
    const text = await res.text()
    let body: unknown = null
    try { body = text ? JSON.parse(text) : null }
    catch { /* not JSON */ }
    return { ok: res.ok, code: res.status, ms, error: res.ok ? null : `HTTP ${res.status}`, body }
  }
  catch (err: any) {
    const reason = err?.name === 'TimeoutError' ? `no answer within ${settings().timeoutMs / 1000} s` : explain(err?.cause?.code, err?.cause?.message || err?.message)
    return { ok: false, code: null, ms: null, error: reason }
  }
}

/** GET /api/health/ready: is the site up and its database answering? */
export const probeReady = (url: string) => probe(`${url}/api/health/ready`)

/** The id of the build the site serves (Nuxt's app manifest), or null when it has none. */
export async function probeBuild(url: string): Promise<string | null> {
  const r = await probe(`${url}/_nuxt/builds/latest.json`)
  const id = r.ok ? (r.body as { id?: unknown } | null)?.id : null
  return typeof id === 'string' && id.length <= 100 ? id : null
}

/** GET /api/health/status with the token: the status, or why it could not be read. */
export async function probeStatus(url: string, token: string): Promise<{ status: CmsStatus } | { error: string }> {
  const r = await probe(`${url}/api/health/status`, { 'x-api-key': token })
  if (r.code === 404) return { error: 'The site has no status route: set NUXT_CMS_STATUS_TOKEN on it (tinyzoo 1.1 or newer).' }
  if (r.code === 401) return { error: 'The token does not match the site\'s NUXT_CMS_STATUS_TOKEN.' }
  if (r.code === 429) return { error: 'The site refused: too many requests.' }
  if (!r.ok) return { error: r.error ?? 'The status could not be read.' }
  const body = r.body as CmsStatus | null
  if (!body || body.format !== 'tinyzoo-status') return { error: 'The answer is not a tinyzoo status.' }
  return { status: body }
}

/** When the site's TLS certificate expires (https only). */
export function probeCertificate(url: string): Promise<{ expiresAt: Date } | { error: string }> {
  const u = new URL(url)
  if (u.protocol !== 'https:') return Promise.resolve({ error: 'Not served over https' })
  return new Promise((resolve) => {
    const socket = tls.connect({ host: u.hostname, port: Number(u.port) || 443, servername: u.hostname, timeout: settings().timeoutMs })
    const done = (v: { expiresAt: Date } | { error: string }) => { socket.destroy(); resolve(v) }
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate()
      if (!cert?.valid_to) return done({ error: 'No certificate' })
      if (!socket.authorized) return done({ error: `Certificate not trusted: ${socket.authorizationError}` })
      done({ expiresAt: new Date(cert.valid_to) })
    })
    socket.once('timeout', () => done({ error: 'No answer' }))
    socket.once('error', (err) => done({ error: err.message }))
  })
}

/** Check one site now: uptime, and the status when it is due (or `forceStatus`). */
export async function checkSite(siteId: string, opts: { forceStatus?: boolean; forceTraffic?: boolean } = {}): Promise<void> {
  const db = useDb()
  const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, siteId))
  if (!site) return
  const { downAfter, statusEveryMin } = settings()
  const now = new Date()
  const r = await probeReady(site.url)
  await db.insert(schema.checks).values({ siteId, at: now, ok: r.ok, code: r.code, ms: r.ms, error: r.error })

  const patch: Partial<SiteRow> = { lastCheckAt: now, lastResponseMs: r.ms }
  if (r.ok) {
    patch.failStreak = 0
    if (site.state !== 'up') {
      patch.state = 'up'
      patch.stateSince = now
      if (site.state === 'down') {
        await db.update(schema.incidents).set({ endedAt: now }).where(and(eq(schema.incidents.siteId, siteId), isNull(schema.incidents.endedAt)))
        await alertTeam(site, 'up', `${site.name} is back up`, `${site.name} (${site.url}) answers again (${r.ms} ms).`)
      }
    }
  }
  else {
    patch.failStreak = site.failStreak + 1
    if (patch.failStreak >= downAfter && site.state !== 'down') {
      patch.state = 'down'
      patch.stateSince = now
      await db.insert(schema.incidents).values({ siteId, startedAt: now, cause: r.error ?? 'unreachable' })
      await alertTeam(site, 'down', `${site.name} is down`, `${site.name} (${site.url}) did not answer ${patch.failStreak} checks in a row: ${r.error}.`)
    }
  }

  // A new build is a deploy: read the status now, so a new version shows within the minute.
  let redeployed = false
  if (r.ok) {
    const build = await probeBuild(site.url)
    if (build) {
      redeployed = !!site.buildId && build !== site.buildId
      patch.buildId = build
    }
  }

  const token = decryptSecret(site.tokenEnc)
  const due = !site.statusAt || now.getTime() - site.statusAt.getTime() >= statusEveryMin * 60_000 - 5_000
  if (token && (opts.forceStatus || due || redeployed)) {
    const s = await probeStatus(site.url, token)
    if ('status' in s) Object.assign(patch, { status: s.status, statusAt: now, statusError: null })
    else patch.statusError = s.error
  }
  else if (site.tokenEnc && !token) {
    patch.statusError = 'The stored token cannot be read (was NUXT_KEEPER_SECRET changed?). Paste it again.'
  }
  await db.update(schema.sites).set(patch).where(eq(schema.sites.id, siteId))

  // The site's logo: when its brand icon changed, else once a day (logos.ts). Only while it answers.
  if (r.ok) await refreshSiteLogo(site, patch.status ?? site.status).catch((err: any) => console.error('[keeper] logo failed', err?.message ?? err))

  // Visits, about once an hour, for a site whose status lists the analytics plugin (traffic.ts).
  await checkTraffic(siteId, token, { force: opts.forceTraffic }).catch((err: any) => console.error('[keeper] traffic failed', err?.message ?? err))
}

/** Read one site's certificate and warn the team once when it expires within 14 days. */
export async function checkCertificate(site: SiteRow): Promise<void> {
  const db = useDb()
  const c = await probeCertificate(site.url)
  if ('error' in c) {
    await db.update(schema.sites).set({ certCheckedAt: new Date(), certError: c.error }).where(eq(schema.sites.id, site.id))
    return
  }
  const days = Math.floor((c.expiresAt.getTime() - Date.now()) / 86_400_000)
  const warn = days <= 14 && site.certWarnedFor?.getTime() !== c.expiresAt.getTime()
  await db.update(schema.sites).set({ certCheckedAt: new Date(), certError: null, certExpiresAt: c.expiresAt, ...(warn ? { certWarnedFor: c.expiresAt } : {}) }).where(eq(schema.sites.id, site.id))
  if (warn) await alertTeam(site, 'cert', `${site.name}: certificate expires in ${days} days`, `The TLS certificate of ${site.url} expires on ${c.expiresAt.toISOString().slice(0, 10)}. Most hosts renew it themselves; if this one does not, renew it before then.`)
}

/** Run `fn` for every item, at most `limit` at a time. */
async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!
      try { await fn(item) }
      catch (err: any) { console.error('[keeper] check failed', err?.message ?? err) }
    }
  }))
}

/** One run over every site, skipped when the previous run still holds the lock. */
async function withLock(id: number, fn: () => Promise<void>): Promise<boolean> {
  const client = await usePool().connect()
  try {
    const { rows } = await client.query('select pg_try_advisory_lock($1) as ok', [id])
    if (!rows[0]?.ok) return false
    try { await fn() }
    finally { await client.query('select pg_advisory_unlock($1)', [id]) }
    return true
  }
  finally {
    client.release()
  }
}

export async function runAllChecks(): Promise<number> {
  await migrationsReady()
  let count = 0
  await withLock(7_301, async () => {
    const all = await useDb().select({ id: schema.sites.id }).from(schema.sites)
    count = all.length
    await eachLimited(all, 8, (s) => checkSite(s.id))
  })
  // The newest release, asked again when the stored answer is over an hour old.
  await latestRelease(LATEST_BACKGROUND_MS)
  return count
}

export async function runDaily(): Promise<void> {
  await migrationsReady()
  await withLock(7_302, async () => {
    const db = useDb()
    await refreshLatestRelease()
    const all = await db.select().from(schema.sites)
    await eachLimited(all, 4, (s) => checkCertificate(s))
    const cutoff = new Date(Date.now() - settings().keepDays * 86_400_000)
    await db.delete(schema.checks).where(lt(schema.checks.at, cutoff))
    await pruneTraffic()
    await pruneLogos()
  })
}

// ── the newest tinyzoo release ──────────────────────────────────────────────────
//
// Read from npm, which is where sites install from. Kept fresh three ways: a page or tool that
// shows it asks again when the stored answer is over 10 minutes old, the minute task asks when it
// is over an hour old (so "behind" holds also while nobody looks), and the daily task asks anyway.

const LATEST_FRESH_MS = 10 * 60_000
const LATEST_BACKGROUND_MS = 60 * 60_000
// How long a page waits for npm before it shows what is stored; the answer is saved either way.
const LATEST_WAIT_MS = 2_500
// After a failed attempt, npm is left alone this long (a page view must not become a retry loop).
const LATEST_RETRY_MS = 60_000

let refreshing: Promise<string | null> | null = null
let lastAttemptAt = 0

/**
 * Ask npm for the newest release and store it. A version counts only once its package can be
 * downloaded: npm lists a release a few minutes before its file is served, and a site upgraded in
 * that window fails to install. Until then the stored answer stays. Concurrent callers share one
 * request.
 */
export function refreshLatestRelease(): Promise<string | null> {
  refreshing ??= (async () => {
    lastAttemptAt = Date.now()
    try {
      const headers = { 'user-agent': USER_AGENT, 'accept': 'application/json' }
      const res = await fetch('https://registry.npmjs.org/tinyzoo/latest', { headers, signal: AbortSignal.timeout(10_000) })
      if (!res.ok) return null
      const body = (await res.json()) as { version?: unknown; dist?: { tarball?: unknown } }
      const version = String(body?.version || '')
      if (!/^\d+\.\d+\.\d+/.test(version)) return null
      const tarball = typeof body.dist?.tarball === 'string' ? body.dist.tarball : ''
      if (tarball.startsWith('https://')) {
        const file = await fetch(tarball, { method: 'HEAD', headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) })
        if (!file.ok) return null
      }
      await useDb().insert(schema.state).values({ key: 'latest', value: { version } })
        .onConflictDoUpdate({ target: schema.state.key, set: { value: { version }, updatedAt: new Date() } })
      return version
    }
    catch {
      return null
    }
    finally {
      refreshing = null
    }
  })()
  return refreshing
}

/** The newest release Keeper knows and when npm last confirmed it, asking again when it is older than `maxAgeMs`. */
export async function latestReleaseInfo(maxAgeMs = LATEST_FRESH_MS): Promise<{ version: string; checkedAt: Date } | null> {
  const read = async () => {
    const [row] = await useDb().select().from(schema.state).where(eq(schema.state.key, 'latest'))
    const version = (row?.value as { version?: string } | undefined)?.version
    return version && row ? { version, checkedAt: row.updatedAt } : null
  }
  const stored = await read()
  const stale = !stored || Date.now() - stored.checkedAt.getTime() > maxAgeMs
  if (!stale || Date.now() - lastAttemptAt < LATEST_RETRY_MS) return stored
  const asked = refreshLatestRelease()
  // Nothing stored yet: wait for npm. Otherwise wait a moment, then show what is stored.
  if (stored) await Promise.race([asked, new Promise((resolve) => setTimeout(resolve, LATEST_WAIT_MS))])
  else await asked
  return (await read()) ?? stored
}

/** The newest release (see latestReleaseInfo). */
export async function latestRelease(maxAgeMs?: number): Promise<string | null> {
  return (await latestReleaseInfo(maxAgeMs))?.version ?? null
}

/** -1, 0 or 1 for two versions like 1.2.3 (a pre-release sorts before its release). */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core = '', pre] = v.split('-', 2)
    return { nums: core.split('.').map((n) => Number(n) || 0), pre }
  }
  const x = parse(a), y = parse(b)
  for (let i = 0; i < 3; i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0)
    if (d) return Math.sign(d)
  }
  if (x.pre && !y.pre) return -1
  if (!x.pre && y.pre) return 1
  return 0
}

/** Uptime shares per site over the last 24 hours and 30 days. */
export async function uptimeFor(siteIds: string[]): Promise<Map<string, { d1: number | null; d30: number | null }>> {
  const out = new Map<string, { d1: number | null; d30: number | null }>()
  if (!siteIds.length) return out
  const rows = await useDb().execute<{ site_id: string; d1: string | null; d30: string | null }>(sql`
    select site_id,
      avg(case when ok then 1 else 0 end) filter (where at > now() - interval '24 hours') as d1,
      avg(case when ok then 1 else 0 end) as d30
    from checks
    where at > now() - interval '30 days' and site_id in (${sql.join(siteIds.map((id) => sql`${id}::uuid`), sql`, `)})
    group by site_id`)
  for (const r of rows.rows) out.set(r.site_id, { d1: r.d1 == null ? null : Number(r.d1), d30: r.d30 == null ? null : Number(r.d30) })
  return out
}
