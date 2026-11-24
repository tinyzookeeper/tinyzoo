// In production, /sitemap.xml needs the site's address from the configuration:
// NUXT_CMS_PUBLIC_URL, NUXT_SITE_URL or `site.url` in nuxt.config. Without one it is a 404
// rather than @nuxtjs/sitemap's fallback, the request's (forwarded) host: a forged host
// would end up in a sitemap that a CDN keeps for everybody. The start-up check has already
// logged that NUXT_CMS_PUBLIC_URL is missing. Development uses the request's address.
const SITEMAP_ROUTE = /^\/(?:[^/?#]*sitemap[^/?#]*\.xml|__sitemap__\/)/

// Per site: each site has its own address.
const configured = cmsSiteScoped<boolean | undefined>(() => undefined)

/** Whether the site's address is configured anywhere the site config reads it from (not the request). */
function configuredSiteUrl(): boolean {
  const config = useRuntimeConfig() as any
  if (String(cmsSettings().publicUrl || '').trim()) return true
  if (process.env.NUXT_SITE_URL || process.env.NUXT_PUBLIC_SITE_URL) return true
  if (config.site?.url || config.public?.site?.url) return true
  // nuxt.config's `site.url`: the build-time entries of nuxt-site-config.
  return (config['nuxt-site-config']?.stack ?? []).some((c: any) => c?.url)
}

export default defineEventHandler((event) => {
  if (import.meta.dev || process.env.NODE_ENV !== 'production' || !SITEMAP_ROUTE.test(event.path || '')) return
  // A site of the directory always has an address (the directory requires it).
  if (cmsIsMultiTenant()) return
  if (configured() === undefined) configured.set(configuredSiteUrl())
  if (!configured()) throw createError({ statusCode: 404, statusMessage: 'Not found' })
})
