import { Resolver } from 'node:dns/promises'
import { and, asc, eq, isNotNull, ne } from 'drizzle-orm'
import {
  domainPointsAtTarget, MAX_DOMAINS_PER_SITE, normalizeDomain, parseDomainTarget,
  type DnsAnswers, type DomainRules, type DomainsView, type DomainTarget, type DomainView, type DomainWait,
} from '#shared/domains'
import { redirectHostList } from '#shared/hosts'
import { SHARED_SERVICE_HOST } from '#shared/sharedHosting'
import { slugProblem } from '#shared/slug'
import type { SiteDomainRow, SiteRow } from '../db/schema'
import { useHosting } from '../hosting'

// A website's own domains. The owner adds a name; the cloud looks at its DNS; once the name
// leads to the service it goes into the site's row of the site directory (the hosting
// driver's `refresh`), and one such name may become the site's address. What the platform in
// front must do with the names (send them to the template's process, hold their certificates)
// is outside this app: it asks GET /api/domains/ask before it issues a certificate.

/** Outside production a `*.localhost` name may be added and counts as leading here: the whole flow can be tried on one machine. */
const localNamesAllowed = (): boolean => process.env.NODE_ENV !== 'production'

/** NUXT_HOSTING_DOMAIN_TARGET: where a customer's domain must lead (a host name for a CNAME and/or IP addresses). */
export function domainTarget(): DomainTarget {
  return parseDomainTarget((useRuntimeConfig().hosting as any)?.domainTarget)
}

function domainRules(): DomainRules {
  const own: string[] = []
  try { own.push(new URL(publicUrl()).hostname) }
  catch { /* no address configured */ }
  // The names the cloud itself used to be reached at stay its own.
  own.push(...redirectHostList(useRuntimeConfig().redirectHosts))
  const target = domainTarget()
  if (target.cname) own.push(target.cname)
  return { allowLocalhost: localNamesAllowed(), serviceHosts: own }
}

// ── the DNS ─────────────────────────────────────────────────────────────────────

const quiet = <T>(work: Promise<T[]>): Promise<T[]> => work.catch(() => [])

/** What the DNS says about a name: its CNAME chain (a few steps of it) and the addresses it ends at. */
async function lookUp(host: string): Promise<DnsAnswers> {
  const resolver = new Resolver({ timeout: 3000, tries: 2 })
  const cnames: string[] = []
  let at = host
  for (let i = 0; i < 5; i++) {
    const [next] = await quiet(resolver.resolveCname(at))
    if (!next || cnames.includes(next)) break
    cnames.push(next)
    at = next
  }
  const [v4, v6] = await Promise.all([quiet(resolver.resolve4(host)), quiet(resolver.resolve6(host))])
  return { cnames, ips: [...v4, ...v6] }
}

/** The addresses of the target: the ones configured, and the ones its host name has now. */
async function targetAddresses(target: DomainTarget): Promise<string[]> {
  if (!target.cname) return target.ips
  const resolver = new Resolver({ timeout: 3000, tries: 2 })
  const [v4, v6] = await Promise.all([quiet(resolver.resolve4(target.cname)), quiet(resolver.resolve6(target.cname))])
  return [...target.ips, ...v4, ...v6]
}

/** Does the name lead to the service now? */
export async function checkDomain(host: string): Promise<{ ok: true } | { ok: false; reason: DomainWait }> {
  if (localNamesAllowed() && host.endsWith('.localhost')) return { ok: true }
  const target = domainTarget()
  if (!target.cname && !target.ips.length) return { ok: false, reason: 'no_target' }
  const [answers, ips] = await Promise.all([lookUp(host), targetAddresses(target)])
  return domainPointsAtTarget(answers, { cname: target.cname, ips })
}

// ── a site's domains ────────────────────────────────────────────────────────────

const toView = (row: SiteDomainRow): DomainView => ({
  id: row.id, host: row.host, verified: !!row.verifiedAt, main: row.main && !!row.verifiedAt,
  wait: row.verifiedAt ? null : (row.wait as DomainWait | null), checkedAt: row.checkedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(),
})

async function domainsOf(siteId: string): Promise<SiteDomainRow[]> {
  return useDb().select().from(schema.siteDomains).where(eq(schema.siteDomains.siteId, siteId)).orderBy(asc(schema.siteDomains.createdAt), asc(schema.siteDomains.host))
}

export async function domainsView(site: SiteRow): Promise<DomainsView> {
  return { domains: (await domainsOf(site.id)).map(toView), max: MAX_DOMAINS_PER_SITE, target: domainTarget(), serviceUrl: site.internalUrl }
}

/** Domains are for a site that is ready, served, and on a driver that keeps the names outside the site's own process. */
function requireDomainsPossible(site: SiteRow): void {
  if (!useHosting(site.driver).refresh) throw fail(409, 'domain.unavailable', 'This website cannot have a domain of its own here')
  if (site.status !== 'ready') throw fail(409, 'site.notReady', 'The website is not ready')
  if (site.hostState !== 'active') throw fail(409, 'domain.busy', 'The website is being moved; try again in a moment')
}

async function requireDomain(site: SiteRow, id: string): Promise<SiteDomainRow> {
  const [row] = /^[0-9a-f-]{36}$/i.test(id) ? await useDb().select().from(schema.siteDomains).where(and(eq(schema.siteDomains.id, id), eq(schema.siteDomains.siteId, site.id))) : []
  if (!row) throw fail(404, 'domain.none', 'No such domain')
  return row
}

/**
 * The site's row of the directory follows its domains: the driver writes it again, and the
 * site's address (here, and at the account service, where a sign-in comes back to that
 * address and no other) becomes what the row now says. One site at a time.
 */
export async function applySiteAddress(siteId: string): Promise<SiteRow> {
  let done: SiteRow | undefined
  const ran = await withSiteLock(siteId, async () => {
    const [site] = await useDb().select().from(schema.sites).where(eq(schema.sites.id, siteId))
    if (!site) throw fail(404, 'site.none', 'No such website')
    const driver = useHosting(site.driver)
    if (!driver.refresh) throw fail(409, 'domain.unavailable', 'This website cannot have a domain of its own here')
    const { publicUrl: address } = await driver.refresh(hostedSite(site))
    if (address !== site.publicUrl) {
      await useDb().update(schema.sites).set({ publicUrl: address, updatedAt: new Date() }).where(eq(schema.sites.id, site.id))
      await setSiteClientAddress(site.id, address)
    }
    done = { ...site, publicUrl: address }
  })
  if (!ran || !done) throw fail(409, 'domain.busy', 'The website is busy; try again in a moment')
  return done
}

/** Look at the name's DNS and write down what was seen. Returns whether it became verified with this look. */
async function look(row: SiteDomainRow): Promise<{ row: SiteDomainRow; becameVerified: boolean }> {
  if (row.verifiedAt) return { row, becameVerified: false }
  const seen = await checkDomain(row.host)
  const now = new Date()
  const change = seen.ok ? { verifiedAt: now, checkedAt: now, wait: null } : { checkedAt: now, wait: seen.reason }
  const [next] = await useDb().update(schema.siteDomains).set(change).where(eq(schema.siteDomains.id, row.id)).returning()
  return { row: next ?? row, becameVerified: seen.ok }
}

/** Add a domain to a site. It is looked at once right away; a name that already leads here is in use at once (it redirects to the site's address). */
export async function addDomain(site: SiteRow, input: unknown): Promise<DomainView> {
  requireDomainsPossible(site)
  const name = normalizeDomain(input, domainRules())
  if (!name.ok) throw fail(422, `domain.${name.problem}`, 'This name cannot be used as a domain', { field: 'host' })
  const db = useDb()
  const mine = await domainsOf(site.id)
  if (mine.some((d) => d.host === name.host)) throw fail(409, 'domain.exists', 'This domain is already on the website', { field: 'host' })
  if (mine.length >= MAX_DOMAINS_PER_SITE) throw fail(403, 'domain.limit', `A website can have ${MAX_DOMAINS_PER_SITE} domains`, { max: MAX_DOMAINS_PER_SITE })
  let row: SiteDomainRow | undefined
  try {
    ;[row] = await db.insert(schema.siteDomains).values({ siteId: site.id, host: name.host }).returning()
  }
  catch (err: any) {
    // The name is on another website (the unique index): a domain belongs to one website at a time.
    if (err?.code === '23505' || err?.cause?.code === '23505') throw fail(409, 'domain.taken', 'This domain belongs to another website', { field: 'host' })
    throw err
  }
  if (!row) throw fail(500, 'unexpected', 'Could not save the domain')
  const seen = await look(row)
  if (seen.becameVerified) await applySiteAddress(site.id)
  return toView(seen.row)
}

/** "Check again": look at a waiting domain's DNS once more. */
export async function recheckDomain(site: SiteRow, id: string): Promise<DomainView> {
  requireDomainsPossible(site)
  const seen = await look(await requireDomain(site, id))
  if (seen.becameVerified) await applySiteAddress(site.id)
  return toView(seen.row)
}

/** Make a verified domain the site's address, or (with `main` false) go back to the service address. */
export async function setMainDomain(site: SiteRow, id: string, main: boolean): Promise<DomainView> {
  requireDomainsPossible(site)
  const row = await requireDomain(site, id)
  if (main && !row.verifiedAt) throw fail(409, 'domain.waiting', 'This domain does not lead to the website yet')
  const db = useDb()
  await db.transaction(async (tx) => {
    // One main domain per site: the others stop being it first.
    await tx.update(schema.siteDomains).set({ main: false }).where(and(eq(schema.siteDomains.siteId, site.id), ne(schema.siteDomains.id, row.id)))
    await tx.update(schema.siteDomains).set({ main }).where(eq(schema.siteDomains.id, row.id))
  })
  await applySiteAddress(site.id)
  return toView({ ...row, main })
}

/** Take a domain off a site. Was it the site's address, the site goes back to its service address. */
export async function removeDomain(site: SiteRow, id: string): Promise<void> {
  if (site.hostState === 'read-only') throw fail(409, 'domain.busy', 'The website is being moved; try again in a moment')
  const row = await requireDomain(site, id)
  await useDb().delete(schema.siteDomains).where(eq(schema.siteDomains.id, row.id))
  if (row.verifiedAt && site.status === 'ready' && useHosting(site.driver).refresh) await applySiteAddress(site.id)
}

/** The site is gone from here (deleted, or it moved away): its names are free for another website. */
export async function releaseDomains(siteId: string): Promise<void> {
  await useDb().delete(schema.siteDomains).where(eq(schema.siteDomains.siteId, siteId))
}

// ── "may I issue a certificate for this name?" ──────────────────────────────────

/**
 * Is `host` a name the service serves: a verified domain of a ready website, or a ready
 * website's own address at the service? What the platform's certificate issuer asks before
 * it gets a certificate for a name somebody pointed at it.
 */
export async function servesHost(input: unknown): Promise<boolean> {
  const host = String(input ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (!host || host.length > 253 || !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host)) return false
  const db = useDb()
  const [domain] = await db.select({ id: schema.siteDomains.id }).from(schema.siteDomains)
    .innerJoin(schema.sites, eq(schema.sites.id, schema.siteDomains.siteId))
    .where(and(eq(schema.siteDomains.host, host), isNotNull(schema.siteDomains.verifiedAt), eq(schema.sites.status, 'ready'), ne(schema.sites.hostState, 'moved')))
  if (domain) return true
  // A site's own address at the service: <slug>.<the service's host>. A moved site keeps it (it redirects).
  const suffix = `.${SHARED_SERVICE_HOST}`
  if (!host.endsWith(suffix)) return false
  const slug = host.slice(0, -suffix.length)
  if (slugProblem(slug)) return false
  const [site] = await db.select({ id: schema.sites.id }).from(schema.sites)
    .where(and(eq(schema.sites.slug, slug), eq(schema.sites.status, 'ready'), eq(schema.sites.driver, 'shared')))
  return !!site
}
