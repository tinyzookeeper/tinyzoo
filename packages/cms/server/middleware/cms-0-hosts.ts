import { hostRedirectTarget, redirectHostList } from '../../shared/host-redirect'

// A site that moved to another address (cms.redirectHosts / NUXT_CMS_REDIRECT_HOSTS): a page
// asked for on one of its old host names is sent to the public address, for good (301). The
// API and build assets still answer on the old name (shared/host-redirect.ts says why). In
// multi-tenant mode each site's row names its hosts, and the site plugin redirects them.
export default defineEventHandler((event) => {
  if (cmsIsMultiTenant()) return
  const cms = useRuntimeConfig().cms as { publicUrl?: string; redirectHosts?: unknown } | undefined
  const redirectHosts = redirectHostList(cms?.redirectHosts)
  if (!redirectHosts.length) return
  const req = event.node.req
  // The name the visitor asked for: a proxy that rewrites Host says it in X-Forwarded-Host. A
  // made-up header only changes where the sender itself is sent, and always to the public address.
  const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0]
  const target = hostRedirectTarget({
    method: event.method,
    url: String(req.url || '/'),
    host: forwarded || req.headers.host,
    publicUrl: String(cms?.publicUrl || ''),
    redirectHosts,
  })
  if (target) return sendRedirect(event, locationHeader(target), 301)
})
