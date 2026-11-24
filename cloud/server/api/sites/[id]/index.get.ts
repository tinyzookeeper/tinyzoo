import type { SiteRuntime, SiteStorage, SiteView } from '#shared/api'
import { eq } from 'drizzle-orm'
import { templateById } from '#shared/templates'
import { HostingError, useHosting } from '../../../hosting'

/**
 * The look the site shows now: its owner may have changed it in the site's admin since it was
 * made. The site's settings are public content; a site that does not answer in a moment keeps
 * what the cloud knows.
 */
async function currentLook(internalUrl: string | null, looks: string[]): Promise<string | null> {
  if (!internalUrl || !looks.length) return null
  try {
    const res = await fetch(`${internalUrl}/api/content/_global/siteSettings`, { signal: AbortSignal.timeout(1500), headers: { accept: 'application/json' } })
    if (!res.ok) return null
    const look = ((await res.json()) as { item?: { look?: unknown } | null })?.item?.look
    return typeof look === 'string' && looks.includes(look) ? look : null
  }
  catch {
    return null
  }
}

// One of my websites as it is now: its steps while it is being made, then its addresses and
// whether I have already chosen my password for its admin. With `runtime=1` also whether it
// runs, and how much it stores against its plan (asked of the site itself).
export default defineEventHandler(async (event): Promise<{ site: SiteView; runtime: SiteRuntime | null; storage: SiteStorage | null }> => {
  const found = await requireOwnSite(event)
  let site = await noteAcceptance(found.site)
  let runtime: SiteRuntime | null = null
  if (site.status === 'ready' && getQuery(event).runtime === '1') {
    try {
      const d = await useHosting(site.driver).describe(hostedSite(site))
      runtime = { running: d.running, memoryBytes: d.memoryBytes ?? null }
    }
    catch (err) {
      if (!(err instanceof HostingError)) console.error('[cloud] describe failed', site.slug, (err as Error)?.message)
    }
  }
  const storage = getQuery(event).runtime === '1' ? await siteStorage(site) : null
  if (site.status === 'ready' && site.hostState === 'active' && getQuery(event).runtime === '1') {
    const look = await currentLook(site.internalUrl, (templateById(site.template)?.looks ?? []).map((l) => l.id))
    if (look && look !== site.look) {
      await useDb().update(schema.sites).set({ look }).where(eq(schema.sites.id, site.id))
      site = { ...site, look }
    }
  }
  return { site: toSiteView(site), runtime, storage }
})
